import * as THREE from "three";
import { CatcherModel } from "../catcher/CatcherModel.js";
import { getModel } from "../../world/Assets.js";
import { createLaneTelegraph } from "./Telegraphs.js";

// Swamp stage: the catcher drives a jeep, standing up through the roof with his net.
// He lines up, marks a red lane (with sliding chevrons), revs, then charges down it.
//
//   entering → chase → aim (lane shown) → charge → skid → chase
//   fire → overheat (smoking engine) ; water → spinOut ; after an escape → dizzy

export const JEEP_MODELS = ["vehicles/suv.glb"];

const STUNNED = new Set(["overheat", "spinOut", "dizzy"]);

export class JeepCatcher {
  constructor(scene, particles, sound) {
    this.scene = scene;
    this.particles = particles;
    this.sound = sound;
    this.group = new THREE.Group();
    this.car = getModel("vehicles/suv.glb").scene.clone(true);
    this.car.traverse((object) => {
      if (object.isMesh) object.castShadow = true;
    });
    this.wheels = [];
    this.car.traverse((object) => {
      if (object.name.startsWith("wheel")) this.wheels.push(object);
    });
    this.group.add(this.car);
    const carSize = new THREE.Box3().setFromObject(this.car).getSize(new THREE.Vector3());
    this.carLength = carSize.z;
    this.driver = new CatcherModel();
    this.driver.group.scale.setScalar(0.62);
    this.driver.group.position.set(0, carSize.y * 0.5, -carSize.z * 0.08);
    this.group.add(this.driver.group);
    this.group.visible = false;
    scene.add(this.group);
    this.lane = createLaneTelegraph(scene);
    this.position = this.group.position;
    this.heading = 0;
    this.speed = 0;
    this.state = "away";
    this.stateTime = 0;
    this.stunLeft = 0;
    this.slowLeft = 0;
    this.cooldown = 2;
    this.charged = 0;
    this.driverMotion = { speed: 0, state: "idle", stateTime: 0 };
    this.temp = new THREE.Vector3();
    this.puff = new THREE.Vector3();
    this.smokeCarry = 0;
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
    return this.carLength * 0.4 * this.group.scale.x;
  }

  setState(state) {
    this.state = state;
    this.stateTime = 0;
    if (state !== "aim") this.lane.hide();
  }

  arrive(world, player) {
    const edge = world.halfSize - 3;
    const side = Math.abs(player.position.x) > Math.abs(player.position.z) ? "x" : "z";
    if (side === "x") this.position.set(player.position.x > 0 ? -edge : edge, 0, player.position.z * 0.5);
    else this.position.set(player.position.x * 0.5, 0, player.position.z > 0 ? -edge : edge);
    this.heading = Math.atan2(player.position.x - this.position.x, player.position.z - this.position.z);
    this.group.visible = true;
    this.setState("entering");
    this.sound.boing();
  }

  hide() {
    this.group.visible = false;
    this.setState("away");
  }

  burn(tuning) {
    if (!this.active || this.state === "entering" || this.state === "cheer") return false;
    const fresh = this.state !== "overheat";
    if (fresh) {
      this.setState("overheat");
      this.sound.yowch();
    }
    this.stunLeft = tuning.hotPantsTime;
    this.speed *= 0.3;
    return fresh;
  }

  soak(tuning) {
    if (!this.active || this.state === "entering" || this.state === "cheer") return false;
    const fresh = this.state !== "spinOut";
    if (fresh) {
      this.setState("spinOut");
      this.sound.slip();
    }
    this.stunLeft = tuning.slipTime;
    return fresh;
  }

  dizzy(tuning) {
    this.setState("dizzy");
    this.stunLeft = tuning.dizzyTime;
    this.speed = 0;
  }

  cheer() {
    this.setState("cheer");
    this.speed = 0;
  }

  slow(seconds) {
    this.slowLeft = Math.max(this.slowLeft, seconds);
  }

  update(dt, player, stage, world) {
    if (this.state === "away") return null;
    const tuning = stage.catcher;
    this.stateTime += dt;
    this.slowLeft = Math.max(0, this.slowLeft - dt);
    this.cooldown -= dt;
    const scale = tuning.scale;
    this.group.scale.setScalar(scale);
    const dx = player.position.x - this.position.x;
    const dz = player.position.z - this.position.z;
    const distance = Math.hypot(dx, dz);
    const toPlayer = Math.atan2(dx, dz);
    const off = Math.atan2(Math.sin(toPlayer - this.heading), Math.cos(toPlayer - this.heading));
    const cruise = tuning.speed * (this.slowLeft > 0 ? 0.5 : 1);
    let event = null;
    let targetSpeed = 0;
    let driverState = "run";

    switch (this.state) {
      case "entering":
        targetSpeed = cruise * 0.8;
        this.steer(off, dt, 2);
        if (this.stateTime > 1.4) this.setState("chase");
        break;
      case "chase":
        targetSpeed = cruise * (1 - Math.min(0.6, Math.abs(off) * 0.5));
        this.steer(off, dt, 2.2);
        if (this.cooldown <= 0 && player.attackable && Math.abs(off) < 0.3 && distance < tuning.chargeLength * 0.85) this.setState("aim");
        break;
      case "aim":
        targetSpeed = 0;
        this.steer(off, dt, 1.2);
        driverState = "windup";
        this.lane.show(this.position.x, this.position.z, this.heading, tuning.chargeLength, tuning.laneWidth, this.stateTime / tuning.chargeAim, this.stateTime);
        if (Math.random() < 0.3) this.exhaust();
        if (this.stateTime >= tuning.chargeAim) {
          this.setState("charge");
          this.charged = 0;
          this.speed = tuning.chargeSpeed * 0.5;
          this.sound.whoosh();
        }
        break;
      case "charge": {
        targetSpeed = tuning.chargeSpeed;
        driverState = "swing";
        this.charged += this.speed * dt;
        const along = dx * Math.sin(this.heading) + dz * Math.cos(this.heading);
        const lateral = Math.abs(dx * Math.cos(this.heading) - dz * Math.sin(this.heading));
        const reach = this.carLength * 0.55 * scale;
        if (player.invulnerable <= 0 && Math.abs(along) < reach && lateral < tuning.laneWidth / 2 + stage.player.bodyRadius * player.scale * 0.4) {
          event = "caught";
          this.cheer();
        } else if (this.charged > tuning.chargeLength) {
          this.setState("skid");
        }
        break;
      }
      case "skid":
        targetSpeed = 0;
        driverState = "netStuck";
        if (Math.random() < 0.5) this.particles.emit("dust", this.position, this.puff.set(0, 1, 0), scale);
        if (this.stateTime > 1.4) {
          this.cooldown = tuning.chargeCooldown;
          this.setState("chase");
        }
        break;
      case "overheat":
        targetSpeed = 0;
        driverState = "hotPants";
        this.engineSmoke(dt);
        this.stunLeft -= dt;
        if (this.stunLeft <= 0) this.setState("chase");
        break;
      case "spinOut":
        targetSpeed = this.speed * 0.98;
        driverState = "slipping";
        this.heading += dt * 7 * (this.stunLeft / tuning.slipTime + 0.3);
        this.stunLeft -= dt;
        if (this.stunLeft <= 0) this.setState("chase");
        break;
      case "dizzy":
        driverState = "dizzy";
        this.stunLeft -= dt;
        if (this.stunLeft <= 0) this.setState("chase");
        break;
      case "cheer":
        driverState = "cheer";
        break;
    }

    this.speed += (targetSpeed - this.speed) * Math.min(1, dt * (this.state === "charge" ? 3 : 2.5));
    this.position.x += Math.sin(this.heading) * this.speed * dt;
    this.position.z += Math.cos(this.heading) * this.speed * dt;
    if (this.collide(world, this.carLength * 0.38 * scale) && this.state === "charge") this.setState("skid");
    this.group.rotation.y = this.heading;
    // Bounce while driving; shake while revving.
    this.car.position.y = Math.abs(Math.sin(this.stateTime * 14)) * 0.03 * Math.min(1, this.speed / 4) + (this.state === "aim" ? Math.random() * 0.03 : 0);
    for (const wheel of this.wheels) wheel.rotation.x += (this.speed * dt) / 0.35;
    this.driverMotion.state = driverState;
    this.driverMotion.speed = 0;
    this.driverMotion.stateTime = this.stateTime;
    this.driver.update(dt, this.driverMotion);
    return event;
  }

  steer(off, dt, rate) {
    this.heading += Math.max(-rate * dt, Math.min(rate * dt, off));
  }

  exhaust() {
    this.temp.set(Math.sin(this.heading), 0, Math.cos(this.heading)).multiplyScalar(-this.carLength * 0.5 * this.group.scale.x).add(this.position);
    this.temp.y = 0.4;
    this.particles.emit("smoke", this.temp, this.puff.set(0, 1, 0), 0.6);
  }

  engineSmoke(dt) {
    this.smokeCarry += dt * 22;
    const front = this.carLength * 0.35 * this.group.scale.x;
    while (this.smokeCarry >= 1) {
      this.smokeCarry -= 1;
      this.temp.set(Math.sin(this.heading) * front, 1.1 * this.group.scale.x, Math.cos(this.heading) * front).add(this.position);
      this.particles.emit(Math.random() < 0.45 ? "fire" : "smoke", this.temp, this.puff.set(0, 1.6, 0), 0.9);
    }
  }

  // Pushes the jeep out of obstacles and the fence. Returns true when it hit something.
  collide(world, radius) {
    let hit = false;
    for (const obstacle of world.obstacles) {
      const dx = this.position.x - obstacle.x;
      const dz = this.position.z - obstacle.z;
      const distance = Math.hypot(dx, dz);
      const minimum = obstacle.radius + radius;
      if (distance < minimum && distance > 1e-4) {
        this.position.x = obstacle.x + (dx / distance) * minimum;
        this.position.z = obstacle.z + (dz / distance) * minimum;
        hit = true;
      }
    }
    const limit = world.halfSize - radius - 0.6;
    if (Math.abs(this.position.x) > limit || Math.abs(this.position.z) > limit) {
      this.position.x = Math.max(-limit, Math.min(limit, this.position.x));
      this.position.z = Math.max(-limit, Math.min(limit, this.position.z));
      hit = true;
    }
    return hit;
  }

  dispose() {
    this.scene.remove(this.group);
    this.lane.dispose();
    this.driver.dispose();
  }
}
