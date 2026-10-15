import * as THREE from "three";
import * as SkeletonUtils from "three/addons/utils/SkeletonUtils.js";
import { CatcherModel } from "../catcher/CatcherModel.js";
import { disposeTree, getModel } from "../../world/Assets.js";
import { createCircleTelegraph } from "./Telegraphs.js";
import { NetShot } from "./NetShot.js";

// Final boss: the catcher rides a giant robot. It has armor plates that fire wears
// down; water shorts it out (sparks, no attacks, fire does extra damage). It punches
// up close and fires a big net cannon from range, always after a red warning circle.
//
//   update() events: "hit" (punch landed), "caught" (net landed), "armor" (a plate
//   broke), "defeated" (last plate broke).
//
//   dropping → walk ⇄ punchWindup → punch ; walk → cannonAim → walk
//   water → shorted ; plate breaks → stagger ; last plate → defeated

export const ROBOT_MODELS = ["vehicles/boss_robot.glb"];

const STUNNED = new Set(["shorted", "stagger", "defeated", "dropping"]);

export class RobotBoss {
  constructor(scene, particles, sound) {
    this.scene = scene;
    this.particles = particles;
    this.sound = sound;
    const gltf = getModel("vehicles/boss_robot.glb");
    this.robot = SkeletonUtils.clone(gltf.scene);
    this.robot.traverse((object) => {
      if (object.isMesh) object.castShadow = true;
    });
    this.group = new THREE.Group();
    this.group.add(this.robot);
    this.group.visible = false;
    scene.add(this.group);
    this.mixer = new THREE.AnimationMixer(this.robot);
    this.actions = {};
    for (const clip of gltf.animations) this.actions[clip.name] = this.mixer.clipAction(clip);
    for (const name of ["Punch", "Death", "Jump"]) {
      if (!this.actions[name]) continue;
      this.actions[name].setLoop(THREE.LoopOnce, 1);
      this.actions[name].clampWhenFinished = true;
    }
    this.current = null;

    // The catcher rides on the robot's head. He lives in the scene (not under the bone,
    // whose rig scale differs) and copies the head position each frame.
    this.rider = new CatcherModel();
    this.rider.group.visible = false;
    scene.add(this.rider.group);
    this.head = null;
    this.robot.traverse((object) => {
      if (object.isBone && object.name === "Head") this.head = object;
    });
    this.riderMotion = { speed: 0, state: "cheer", stateTime: 0 };
    this.ejected = false;

    this.telegraph = createCircleTelegraph(scene);
    this.cannon = new NetShot(scene, particles, sound);
    this.position = this.group.position;
    this.target = new THREE.Vector3();
    this.heading = 0;
    this.state = "away";
    this.stateTime = 0;
    this.cooldown = 3;
    this.shortLeft = 0;
    this.armor = 0;
    this.plateHealth = 0;
    this.temp = new THREE.Vector3();
    this.puff = new THREE.Vector3();
    this.flash = 0;
  }

  get active() {
    return this.state !== "away";
  }

  get stunned() {
    return STUNNED.has(this.state);
  }

  get aimPoint() {
    return this.position;
  }

  get hitRadius() {
    return 1.4 * this.scale;
  }

  // 0..1 of total armor left, for the boss bar.
  get health() {
    if (!this.tuning) return 1;
    return Math.max(0, (this.armor - 1 + this.plateHealth / this.tuning.armorHealth) / this.tuning.armor);
  }

  play(name, fade = 0.25) {
    const action = this.actions[name];
    if (!action || action === this.current) return;
    action.reset().setEffectiveWeight(1).fadeIn(fade).play();
    if (this.current) this.current.fadeOut(fade);
    this.current = action;
  }

  setState(state) {
    this.state = state;
    this.stateTime = 0;
    if (state !== "punchWindup" && state !== "punch") this.telegraph.hide();
  }

  arrive(world, player, tuning) {
    this.tuning = tuning;
    this.scale = tuning.scale;
    this.armor = tuning.armor;
    this.plateHealth = tuning.armorHealth;
    // Drop in ahead of the kaiju, in the open.
    this.position.copy(player.position).addScaledVector(player.forward, 12);
    const limit = world.halfSize - 6;
    this.position.x = Math.max(-limit, Math.min(limit, this.position.x));
    this.position.z = Math.max(-limit, Math.min(limit, this.position.z));
    this.position.y = 30;
    this.heading = Math.atan2(player.position.x - this.position.x, player.position.z - this.position.z);
    this.group.visible = true;
    this.group.scale.setScalar(this.scale);
    this.rider.group.visible = true;
    this.rider.group.scale.setScalar(this.scale);
    this.ejected = false;
    this.setState("dropping");
    this.play("Jump", 0.1);
  }

  hide() {
    this.group.visible = false;
    this.rider.group.visible = false;
    this.cannon.cancel();
    this.setState("away");
  }

  // Fire damages armor every frame it touches. Returns true on the first touch.
  burn(tuning, dt = 0) {
    if (this.state === "away" || this.state === "dropping" || this.state === "defeated") return false;
    const multiplier = this.state === "shorted" ? tuning.shortedMultiplier : 1;
    this.damage(tuning.fireDamage * multiplier * dt);
    if (Math.random() < 0.3) this.particles.burst("ember", this.temp.copy(this.position).setY(2.5 * this.scale), 2, 3);
    this.flash = 0.15;
    return false;
  }

  soak(tuning) {
    if (this.state === "away" || this.state === "dropping" || this.state === "defeated" || this.state === "stagger") return false;
    const fresh = this.state !== "shorted";
    if (fresh) {
      this.setState("shorted");
      this.play("No");
      this.sound.slip();
      this.cannon.cancel();
    }
    this.shortLeft = tuning.shortTime;
    return fresh;
  }

  damage(amount) {
    if (this.armor <= 0) return;
    this.plateHealth -= amount;
    this.pendingEvent = null;
    if (this.plateHealth > 0) return;
    this.armor -= 1;
    this.plateHealth = this.tuning.armorHealth;
    this.particles.burst("sparkle", this.temp.copy(this.position).setY(3 * this.scale), 40, 6);
    this.particles.burst("ember", this.temp, 30, 6);
    if (this.armor <= 0) {
      this.setState("defeated");
      this.play("Death", 0.2);
      this.pendingEvent = "defeated";
    } else {
      this.setState("stagger");
      this.play("No", 0.15);
      this.pendingEvent = "armor";
    }
  }

  dizzy() {
    this.setState("stagger");
    this.play("No");
  }

  cheer() {
    this.setState("cheer");
    this.play("Dance");
  }

  slow() {}

  update(dt, player, stage, world) {
    if (this.state === "away") return null;
    const tuning = stage.catcher;
    this.stateTime += dt;
    this.cooldown -= dt;
    this.flash = Math.max(0, this.flash - dt);
    let event = this.pendingEvent ?? null;
    this.pendingEvent = null;
    const dx = player.position.x - this.position.x;
    const dz = player.position.z - this.position.z;
    const distance = Math.hypot(dx, dz);
    let speed = 0;
    let riderState = "cheer";

    switch (this.state) {
      case "dropping":
        this.position.y = Math.max(0, 30 - this.stateTime * this.stateTime * 30);
        if (this.position.y <= 0) {
          this.particles.burst("dust", this.position, 40, 8, 3);
          this.sound.robotStomp();
          this.landed = true;
          this.setState("walk");
          event = "landed";
        }
        break;
      case "walk":
        riderState = "run";
        speed = tuning.speed;
        this.play("Walking");
        if (this.cooldown <= 0 && player.attackable) {
          if (distance < tuning.punchRange) this.startPunch(player, tuning);
          else if (distance > tuning.cannonRange[0] && distance < tuning.cannonRange[1]) this.startCannon(player, tuning);
        }
        break;
      case "punchWindup":
        riderState = "windup";
        this.play("Idle");
        this.telegraph.show(this.target.x, this.target.z, tuning.punchRadius, this.stateTime / tuning.punchWindup, this.stateTime);
        if (this.stateTime >= tuning.punchWindup) {
          this.setState("punch");
          this.play("Punch", 0.1);
          this.sound.robotPunch();
        }
        break;
      case "punch":
        riderState = "swing";
        this.telegraph.show(this.target.x, this.target.z, tuning.punchRadius, 1, this.stateTime);
        if (this.stateTime >= 0.35 && !this.punched) {
          this.punched = true;
          this.particles.burst("dust", this.target, 24, 5, 2.5);
          const hit = Math.hypot(player.position.x - this.target.x, player.position.z - this.target.z) < tuning.punchRadius + stage.player.bodyRadius * player.scale * 0.5;
          if (hit && player.invulnerable <= 0) event = "hit";
        }
        if (this.stateTime >= 1.1) {
          this.punched = false;
          this.cooldown = 1.6;
          this.setState("walk");
        }
        break;
      case "cannonAim":
        riderState = "windup";
        this.play("Idle");
        if (this.stateTime >= tuning.cannonAim) {
          this.temp.copy(this.position).setY(3 * this.scale);
          this.cannon.fire(this.temp, this.target, 0.9, tuning.netRadius * 1.6, this.scale * 3);
          this.cooldown = tuning.cannonCooldown;
          this.setState("walk");
        } else {
          this.cannon.circle.show(this.target.x, this.target.z, tuning.netRadius * 1.6, this.stateTime / tuning.cannonAim, this.stateTime);
        }
        break;
      case "shorted":
        riderState = "dizzy";
        this.shortLeft -= dt;
        if (Math.random() < 0.6) {
          this.temp.set(this.position.x + (Math.random() - 0.5) * 2 * this.scale, (1 + Math.random() * 4) * this.scale, this.position.z + (Math.random() - 0.5) * 2 * this.scale);
          this.particles.emit("sparkle", this.temp, this.puff.set((Math.random() - 0.5) * 6, 4, (Math.random() - 0.5) * 6), 1.5);
        }
        if (this.shortLeft <= 0) this.setState("walk");
        break;
      case "stagger":
        riderState = "dizzy";
        if (this.stateTime > 1.6) this.setState("walk");
        break;
      case "defeated":
        riderState = this.stateTime > 1.2 ? "parachute" : "dizzy";
        // The catcher ejects and floats away on his parachute.
        if (this.stateTime > 1.2) this.ejected = true;
        break;
      case "cheer":
        break;
    }

    const hit = this.cannon.update(dt, player, stage.player.bodyRadius * player.scale);
    if (hit === "caught" && !event) event = "caught";

    if (speed > 0 && distance > tuning.punchRange * 0.6) {
      this.position.x += (dx / distance) * speed * dt;
      this.position.z += (dz / distance) * speed * dt;
    }
    if (this.state !== "defeated" && this.state !== "dropping") {
      const lookX = (this.state === "punchWindup" || this.state === "punch" || this.state === "cannonAim" ? this.target.x : player.position.x) - this.position.x;
      const lookZ = (this.state === "punchWindup" || this.state === "punch" || this.state === "cannonAim" ? this.target.z : player.position.z) - this.position.z;
      const desired = Math.atan2(lookX, lookZ);
      const delta = Math.atan2(Math.sin(desired - this.heading), Math.cos(desired - this.heading));
      this.heading += delta * Math.min(1, dt * 3);
    }
    this.group.rotation.y = this.heading;
    this.mixer.update(dt);
    // Red hit flash on the robot while fire touches it.
    this.robot.position.x = this.flash > 0 ? (Math.random() - 0.5) * 0.05 : 0;
    this.placeRider(dt);
    this.riderMotion.state = riderState;
    this.riderMotion.stateTime = this.stateTime;
    this.rider.update(dt, this.riderMotion);
    return event;
  }

  placeRider(dt) {
    const rider = this.rider.group;
    if (this.ejected) {
      rider.position.y += dt * 2.4;
      rider.position.x += dt * 1.3;
      rider.scale.setScalar(this.scale * 1.3);
      return;
    }
    this.group.updateMatrixWorld(true);
    if (this.head) this.head.getWorldPosition(rider.position);
    else rider.position.copy(this.position).setY(7 * this.scale);
    rider.position.y += 0.9 * this.scale;
    rider.rotation.y = this.heading;
  }

  startPunch(player, tuning) {
    this.target.copy(player.position).addScaledVector(player.velocity, 0.25);
    this.target.y = 0;
    this.punched = false;
    this.setState("punchWindup");
    this.sound.boing();
  }

  startCannon(player, tuning) {
    this.target.copy(player.position).addScaledVector(player.velocity, 0.8);
    this.target.y = 0;
    this.setState("cannonAim");
    this.sound.boing();
  }

  dispose() {
    this.scene.remove(this.group, this.rider.group);
    this.telegraph.dispose();
    this.cannon.dispose();
    this.rider.dispose();
    this.mixer.stopAllAction();
    // Keeps the cached robot model; frees this copy's skeleton and other own resources.
    disposeTree(this.group);
  }
}
