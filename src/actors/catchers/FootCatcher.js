import * as THREE from "three";
import { CatcherModel } from "../catcher/CatcherModel.js";
import { createCircleTelegraph } from "./Telegraphs.js";
import { NetShot } from "./NetShot.js";

// The lizard catcher on foot. He chases a little slower than the lizard, always warns
// before a swing (a red circle grows where the net will land), and can be stunned by
// fire (hot pants) or water (slipping). With gear "netGun" he also fires nets from
// range at a marked spot. update() returns "caught" when a net lands on the player.
//
//   away → entering → chase → windup → swing → (caught | netStuck) → chase
//                       └──→ aim → (net flies) → chase           (netGun only)
//   any chasing state → hotPants | slipping (breath) ; after an escape → dizzy

const STUNNED = new Set(["hotPants", "slipping", "dizzy"]);

export class FootCatcher {
  constructor(scene, particles, sound) {
    this.scene = scene;
    this.particles = particles;
    this.sound = sound;
    this.model = new CatcherModel();
    this.model.group.visible = false;
    scene.add(this.model.group);
    this.telegraph = createCircleTelegraph(scene);
    this.aimCircle = createCircleTelegraph(scene);
    this.netShot = new NetShot(scene, particles, sound);
    this.shotCooldown = 3;
    this.position = new THREE.Vector3();
    this.velocity = new THREE.Vector3();
    this.target = new THREE.Vector3();
    this.heading = 0;
    this.state = "away";
    this.stateTime = 0;
    this.timeOnStage = 0;
    this.stunLeft = 0;
    this.slowLeft = 0;
    this.motion = { speed: 0, state: "idle", stateTime: 0 };
    this.temp = new THREE.Vector3();
    this.pants = new THREE.Vector3();
    this.smokeCarry = 0;
  }

  get active() {
    return this.state !== "away";
  }

  get stunned() {
    return STUNNED.has(this.state);
  }

  // Where breath should aim and how big he is for breath hits.
  get aimPoint() {
    return this.position;
  }

  get hitRadius() {
    return 0.6 * this.model.group.scale.x;
  }

  setState(state) {
    this.state = state;
    this.stateTime = 0;
  }

  // Walk in from the fence on the side farthest from the player.
  arrive(world, player) {
    const edge = world.halfSize - 1.5;
    const side = Math.abs(player.position.x) > Math.abs(player.position.z) ? "z" : "x";
    if (side === "x") this.position.set(player.position.x > 0 ? -edge : edge, 0, player.position.z * 0.5);
    else this.position.set(player.position.x * 0.5, 0, player.position.z > 0 ? -edge : edge);
    this.heading = Math.atan2(player.position.x - this.position.x, player.position.z - this.position.z);
    this.model.group.visible = true;
    this.setState("entering");
  }

  hide() {
    this.model.group.visible = false;
    this.clearWarnings();
    this.setState("away");
  }

  clearWarnings() {
    this.telegraph.hide();
    this.aimCircle.hide();
  }

  // Fire on the catcher: hot pants. Returns true when it starts a new stun.
  burn(tuning) {
    if (!this.active || this.state === "entering" || this.state === "cheer") return false;
    const fresh = this.state !== "hotPants";
    if (fresh) this.setState("hotPants");
    this.stunLeft = Math.min(tuning.hotPantsTime * 1.4, (fresh ? 0 : this.stunLeft) + tuning.hotPantsTime);
    this.clearWarnings();
    if (fresh) this.sound.yowch();
    return fresh;
  }

  // Water on the catcher: slips and slides along the push direction.
  soak(tuning, forward) {
    if (!this.active || this.state === "entering" || this.state === "cheer") return false;
    const fresh = this.state !== "slipping";
    if (fresh) this.setState("slipping");
    this.stunLeft = tuning.slipTime;
    this.velocity.copy(forward).multiplyScalar(3.5);
    this.clearWarnings();
    if (fresh) this.sound.slip();
    return fresh;
  }

  dizzy(tuning) {
    this.setState("dizzy");
    this.stunLeft = tuning.dizzyTime;
    this.clearWarnings();
    this.netShot.cancel();
  }

  cheer() {
    this.setState("cheer");
    this.clearWarnings();
    this.netShot.cancel();
  }

  // A buddy dog barking slows him down for a while.
  slow(seconds) {
    this.slowLeft = Math.max(this.slowLeft, seconds);
  }

  update(dt, player, stage, world) {
    const tuning = stage.catcher;
    if (this.state === "away") return null;
    this.stateTime += dt;
    this.timeOnStage += dt;
    this.slowLeft = Math.max(0, this.slowLeft - dt);
    const scale = tuning.scale;
    const baseSpeed = Math.min(tuning.maxSpeed, tuning.speed + tuning.speedRamp * this.timeOnStage) * (this.slowLeft > 0 ? 0.5 : 1);
    const dx = player.position.x - this.position.x;
    const dz = player.position.z - this.position.z;
    const distance = Math.hypot(dx, dz);
    let event = null;
    let moveSpeed = 0;
    let faceX = dx;
    let faceZ = dz;

    switch (this.state) {
      case "entering":
        moveSpeed = baseSpeed * 0.7;
        if (this.stateTime > 1.6) this.setState("chase");
        break;
      case "chase":
        moveSpeed = baseSpeed;
        this.shotCooldown -= dt;
        if (distance < tuning.swingRange * Math.max(1, player.scale * 0.8) && player.attackable) {
          this.startWindup(player, tuning);
        } else if (tuning.gear === "netGun" && player.attackable && this.shotCooldown <= 0 && !this.netShot.active && distance > tuning.shotRange[0] && distance < tuning.shotRange[1]) {
          this.startAim(player, tuning);
        }
        break;
      case "aim":
        faceX = this.target.x - this.position.x;
        faceZ = this.target.z - this.position.z;
        this.aimCircle.show(this.target.x, this.target.z, tuning.netRadius, this.stateTime / tuning.shotAim, this.stateTime);
        if (this.stateTime >= tuning.shotAim) {
          this.aimCircle.hide();
          this.model.netHead.getWorldPosition(this.temp);
          this.netShot.fire(this.temp, this.target, tuning.shotFlight, tuning.netRadius, tuning.scale * 0.8);
          this.shotCooldown = tuning.shotCooldown;
          this.setState("chase");
        }
        break;
      case "windup":
        faceX = this.target.x - this.position.x;
        faceZ = this.target.z - this.position.z;
        if (this.stateTime >= tuning.windup) {
          this.setState("swing");
          this.sound.whoosh();
        }
        break;
      case "swing":
        faceX = this.target.x - this.position.x;
        faceZ = this.target.z - this.position.z;
        if (this.stateTime >= 0.22) {
          this.telegraph.hide();
          this.particles.burst("dust", this.target, 10, 2.2, 1.2 * scale);
          const reach = tuning.netRadius + stage.player.bodyRadius * player.scale * 0.6;
          const hit = Math.hypot(player.position.x - this.target.x, player.position.z - this.target.z) < reach;
          if (hit && player.invulnerable <= 0) {
            event = "caught";
            this.setState("cheer");
          } else {
            this.setState("netStuck");
          }
        }
        break;
      case "netStuck":
        faceX = this.target.x - this.position.x;
        faceZ = this.target.z - this.position.z;
        if (this.stateTime >= tuning.stuckTime) this.setState("chase");
        break;
      case "hotPants":
        moveSpeed = baseSpeed * 1.25;
        // Panicky zigzag away from the lizard.
        faceX = -dx + Math.sin(this.stateTime * 5) * distance;
        faceZ = -dz + Math.cos(this.stateTime * 4) * distance;
        this.emitPantsFire(dt);
        this.stunLeft -= dt;
        if (this.stunLeft <= 0) this.setState("chase");
        break;
      case "slipping":
        this.velocity.multiplyScalar(Math.exp(-dt * 1.6));
        this.position.addScaledVector(this.velocity, dt);
        faceX = Math.sin(this.heading + dt * 9);
        faceZ = Math.cos(this.heading + dt * 9);
        this.stunLeft -= dt;
        if (this.stunLeft <= 0) this.setState("chase");
        break;
      case "dizzy":
        this.stunLeft -= dt;
        if (this.stunLeft <= 0) this.setState("chase");
        break;
      case "cheer":
        break;
    }

    if (moveSpeed > 0) {
      const length = Math.hypot(faceX, faceZ) || 1;
      let mx = faceX / length;
      let mz = faceZ / length;
      // Steer around obstacles ahead so he does not get stuck on mushrooms.
      for (const obstacle of world.obstacles) {
        const ox = obstacle.x - this.position.x;
        const oz = obstacle.z - this.position.z;
        const ahead = ox * mx + oz * mz;
        const range = obstacle.radius + 1.4 * scale;
        if (ahead > 0 && ahead < range + 1.5) {
          // lateral > 0: the obstacle is on the (mz, -mx) side, so steer the other way.
          const lateral = ox * mz - oz * mx;
          if (Math.abs(lateral) < range) {
            const push = ((range - Math.abs(lateral)) / range) * 1.4 * (lateral > 0 ? 1 : -1);
            const nx = mx - mz * push;
            const nz = mz + mx * push;
            mx = nx;
            mz = nz;
          }
        }
      }
      const steer = Math.hypot(mx, mz) || 1;
      this.velocity.set((mx / steer) * moveSpeed, 0, (mz / steer) * moveSpeed);
      this.position.addScaledVector(this.velocity, dt);
    } else if (this.state !== "slipping") {
      this.velocity.multiplyScalar(Math.exp(-dt * 8));
    }
    this.collide(world, 0.45 * scale);

    if (this.state !== "slipping") {
      const desired = Math.atan2(faceX, faceZ);
      const delta = Math.atan2(Math.sin(desired - this.heading), Math.cos(desired - this.heading));
      this.heading += delta * Math.min(1, dt * (this.state === "windup" ? 12 : 7));
    } else {
      this.heading += dt * 9;
    }

    this.updateTelegraph(tuning);
    if (this.netShot.active && this.netShot.update(dt, player, stage.player.bodyRadius * player.scale) === "caught") {
      event = "caught";
      this.setState("cheer");
    }
    this.motion.speed = Math.hypot(this.velocity.x, this.velocity.z) / scale;
    this.motion.state = this.state === "entering" || this.state === "chase" ? "run" : this.state === "aim" ? "windup" : this.state;
    this.motion.stateTime = this.stateTime;
    const group = this.model.group;
    group.position.copy(this.position);
    group.rotation.y = this.heading;
    group.scale.setScalar(scale);
    this.model.update(dt, this.motion);
    return event;
  }

  startWindup(player, tuning) {
    // Aim a little ahead of a moving lizard, but never beyond his reach.
    this.target.copy(player.position).addScaledVector(player.velocity, 0.3);
    this.clampTarget(tuning.swingRange * 1.05 * Math.max(1, player.scale * 0.8));
    this.setState("windup");
  }

  startAim(player, tuning) {
    this.target.copy(player.position).addScaledVector(player.velocity, tuning.shotFlight * 0.5);
    this.clampTarget(tuning.shotRange[1]);
    this.setState("aim");
    this.sound.boing();
  }

  clampTarget(maxReach) {
    const tx = this.target.x - this.position.x;
    const tz = this.target.z - this.position.z;
    const reach = Math.hypot(tx, tz);
    if (reach > maxReach) {
      this.target.x = this.position.x + (tx / reach) * maxReach;
      this.target.z = this.position.z + (tz / reach) * maxReach;
    }
    this.target.y = 0;
  }

  updateTelegraph(tuning) {
    if (this.state === "windup") this.telegraph.show(this.target.x, this.target.z, tuning.netRadius, this.stateTime / tuning.windup, this.stateTime);
    else if (this.state === "swing") this.telegraph.show(this.target.x, this.target.z, tuning.netRadius, 1, this.stateTime);
  }

  emitPantsFire(dt) {
    this.smokeCarry += dt * 30;
    const anchor = this.model.pantsAnchor ?? this.model.group;
    anchor.getWorldPosition(this.pants);
    while (this.smokeCarry >= 1) {
      this.smokeCarry -= 1;
      this.temp.set(0, 1.4, 0);
      this.particles.emit(Math.random() < 0.6 ? "fire" : "smoke", this.pants, this.temp, 0.7);
    }
  }

  collide(world, radius) {
    for (const obstacle of world.obstacles) {
      const dx = this.position.x - obstacle.x;
      const dz = this.position.z - obstacle.z;
      const distance = Math.hypot(dx, dz);
      const minimum = obstacle.radius + radius;
      if (distance < minimum && distance > 1e-4) {
        this.position.x = obstacle.x + (dx / distance) * minimum;
        this.position.z = obstacle.z + (dz / distance) * minimum;
      }
    }
    const limit = world.halfSize - radius - 0.6;
    this.position.x = Math.max(-limit, Math.min(limit, this.position.x));
    this.position.z = Math.max(-limit, Math.min(limit, this.position.z));
  }

  dispose() {
    this.scene.remove(this.model.group);
    this.telegraph.dispose();
    this.aimCircle.dispose();
    this.netShot.dispose();
    this.model.dispose();
  }
}
