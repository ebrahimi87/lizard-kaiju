import * as THREE from "three";
import { CatcherModel } from "../catcher/CatcherModel.js";
import { NetShot } from "./NetShot.js";
import { createCircleTelegraph } from "./Telegraphs.js";

// Volcano stage: the catcher flies a toy helicopter. He hovers near the lizard, marks
// red circles on the ground, then drops nets into them. Breath reaches him through his
// ground shadow: fire or water sends him wobbling away for a while.
//
//   entering → chase → aim (circles shown) → nets drop → chase
//   fire / water → wobble ; after an escape → dizzy

const STUNNED = new Set(["wobble", "dizzy"]);

function toy(color, extra = {}) {
  return new THREE.MeshPhysicalMaterial({ color, roughness: 0.42, clearcoat: 0.5, clearcoatRoughness: 0.3, ...extra });
}

function createHelicopterModel() {
  const group = new THREE.Group();
  const red = toy("#e6463c");
  const white = toy("#fff4e6");
  const dark = toy("#3a2a2a");
  const glass = toy("#9fe3ff", { transparent: true, opacity: 0.45, roughness: 0.05 });
  const add = (geometry, material, x, y, z) => {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    group.add(mesh);
    return mesh;
  };
  const body = add(new THREE.SphereGeometry(1, 28, 20), red, 0, 1.2, 0);
  body.scale.set(0.95, 0.85, 1.2);
  const stripe = add(new THREE.TorusGeometry(0.97, 0.07, 8, 40), white, 0, 1.2, 0.05);
  stripe.scale.set(1, 1, 1.18);
  stripe.rotation.y = Math.PI / 2;
  const bubble = add(new THREE.SphereGeometry(0.78, 24, 16, 0, Math.PI * 2, 0, Math.PI * 0.6), glass, 0, 1.45, 0.45);
  bubble.rotation.x = 0.35;
  const boom = add(new THREE.CylinderGeometry(0.12, 0.28, 2.2, 12), red, 0, 1.4, -1.9);
  boom.rotation.x = Math.PI / 2 - 0.08;
  add(new THREE.BoxGeometry(0.08, 0.7, 0.45), white, 0, 1.75, -2.95);
  const tailRotor = new THREE.Group();
  tailRotor.position.set(0.12, 1.75, -2.95);
  for (const angle of [0, Math.PI / 2]) {
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.7, 0.1), dark);
    blade.rotation.x = angle;
    tailRotor.add(blade);
  }
  group.add(tailRotor);
  for (const side of [-1, 1]) {
    const skid = add(new THREE.CapsuleGeometry(0.07, 2.0, 4, 8), dark, side * 0.65, 0.12, 0);
    skid.rotation.x = Math.PI / 2;
    for (const z of [-0.5, 0.5]) {
      const strut = add(new THREE.CylinderGeometry(0.05, 0.05, 0.6, 6), dark, side * 0.55, 0.42, z);
      strut.rotation.z = side * 0.3;
    }
  }
  add(new THREE.CylinderGeometry(0.12, 0.16, 0.35, 10), dark, 0, 2.15, 0);
  const rotor = new THREE.Group();
  rotor.position.set(0, 2.36, 0);
  for (const angle of [0, Math.PI / 2]) {
    const blade = new THREE.Mesh(new THREE.BoxGeometry(4.2, 0.05, 0.28), dark);
    blade.rotation.y = angle;
    blade.castShadow = true;
    rotor.add(blade);
  }
  const blur = new THREE.Mesh(
    new THREE.CircleGeometry(2.1, 40),
    new THREE.MeshBasicMaterial({ color: "#ffffff", transparent: true, opacity: 0.18, depthWrite: false }),
  );
  blur.rotation.x = -Math.PI / 2;
  rotor.add(blur);
  group.add(rotor);
  return { group, rotor, tailRotor };
}

export class HelicopterCatcher {
  constructor(scene, particles, sound) {
    this.scene = scene;
    this.particles = particles;
    this.sound = sound;
    const heli = createHelicopterModel();
    this.group = heli.group;
    this.rotor = heli.rotor;
    this.tailRotor = heli.tailRotor;
    this.pilot = new CatcherModel();
    this.pilot.group.scale.setScalar(0.5);
    this.pilot.group.position.set(0, 0.95, 0.35);
    this.group.add(this.pilot.group);
    this.group.visible = false;
    scene.add(this.group);
    this.position = new THREE.Vector3();
    this.ground = new THREE.Vector3();
    this.velocity = new THREE.Vector3();
    this.heading = 0;
    this.altitude = 0;
    this.state = "away";
    this.stateTime = 0;
    this.stunLeft = 0;
    this.slowLeft = 0;
    this.cooldown = 2;
    this.targets = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()];
    this.circles = this.targets.map(() => createCircleTelegraph(scene));
    this.shots = this.targets.map(() => new NetShot(scene, particles, sound));
    this.pilotMotion = { speed: 0, state: "idle", stateTime: 0 };
    this.temp = new THREE.Vector3();
    this.away = new THREE.Vector3();
    this.puff = new THREE.Vector3();
  }

  get active() {
    return this.state !== "away";
  }

  get stunned() {
    return STUNNED.has(this.state);
  }

  // Breath aims at the helicopter's ground shadow.
  get aimPoint() {
    return this.ground;
  }

  get hitRadius() {
    return 1.6 * this.group.scale.x;
  }

  setState(state) {
    this.state = state;
    this.stateTime = 0;
    if (state !== "aim") for (const circle of this.circles) circle.hide();
  }

  arrive(world, player) {
    const edge = world.halfSize;
    this.position.set(player.position.x > 0 ? -edge : edge, 14, player.position.z > 0 ? -edge : edge);
    this.altitude = 14;
    this.group.visible = true;
    this.setState("entering");
    this.sound.boing();
  }

  hide() {
    this.group.visible = false;
    for (const shot of this.shots) shot.cancel();
    this.setState("away");
  }

  burn(tuning) {
    return this.startWobble(tuning.hotPantsTime);
  }

  soak(tuning) {
    return this.startWobble(tuning.slipTime);
  }

  startWobble(seconds) {
    if (!this.active || this.state === "entering" || this.state === "cheer") return false;
    const fresh = this.state !== "wobble";
    if (fresh) {
      this.setState("wobble");
      this.sound.yowch();
    }
    this.stunLeft = seconds;
    return fresh;
  }

  dizzy(tuning) {
    this.setState("dizzy");
    this.stunLeft = tuning.dizzyTime;
    for (const shot of this.shots) shot.cancel();
  }

  cheer() {
    this.setState("cheer");
    for (const shot of this.shots) shot.cancel();
  }

  slow(seconds) {
    this.slowLeft = Math.max(this.slowLeft, seconds);
  }

  update(dt, player, stage, world) {
    if (this.state === "away") return null;
    const tuning = stage.catcher;
    const scale = tuning.scale;
    this.stateTime += dt;
    this.slowLeft = Math.max(0, this.slowLeft - dt);
    this.cooldown -= dt;
    let event = null;
    let pilotState = "idle";
    let hover = tuning.hover * scale;
    // Hover a little behind and beside the lizard, never right on top of it.
    const goal = this.temp.copy(player.position).addScaledVector(player.forward, -3 * player.scale);
    goal.x += Math.sin(this.stateTime * 0.6) * 3;
    let follow = tuning.speed * (this.slowLeft > 0 ? 0.5 : 1);

    switch (this.state) {
      case "entering":
        if (this.stateTime > 2) this.setState("chase");
        break;
      case "chase":
        if (this.cooldown <= 0 && player.attackable) this.startAim(player, tuning);
        break;
      case "aim":
        pilotState = "windup";
        follow *= 0.3;
        this.targets.slice(0, tuning.dropCount).forEach((target, index) => {
          this.circles[index].show(target.x, target.z, tuning.netRadius, this.stateTime / tuning.dropAim, this.stateTime);
        });
        if (this.stateTime >= tuning.dropAim) {
          this.targets.slice(0, tuning.dropCount).forEach((target, index) => {
            this.shots[index].fire(this.position, target, 0.55, tuning.netRadius, scale * 0.9);
          });
          this.cooldown = tuning.dropCooldown;
          this.setState("chase");
        }
        break;
      case "wobble":
        pilotState = "hotPants";
        hover *= 1.5;
        this.away.set(this.position.x - player.position.x, 0, this.position.z - player.position.z).normalize();
        goal.copy(this.position).addScaledVector(this.away, 6);
        follow *= 1.2;
        this.stunLeft -= dt;
        if (Math.random() < 0.5) this.particles.emit("smoke", this.position, this.puff.set(0, -1, 0), scale);
        if (this.stunLeft <= 0) this.setState("chase");
        break;
      case "dizzy":
        pilotState = "dizzy";
        hover *= 1.3;
        follow = 0;
        this.stunLeft -= dt;
        if (this.stunLeft <= 0) this.setState("chase");
        break;
      case "cheer":
        pilotState = "cheer";
        follow = 0;
        break;
    }

    for (const shot of this.shots) {
      if (shot.active && shot.update(dt, player, stage.player.bodyRadius * player.scale) === "caught" && !event) {
        event = "caught";
        this.cheer();
      }
    }

    const dx = goal.x - this.position.x;
    const dz = goal.z - this.position.z;
    const distance = Math.hypot(dx, dz);
    const speed = Math.min(follow, distance * 1.5);
    this.velocity.set(distance > 0.01 ? (dx / distance) * speed : 0, 0, distance > 0.01 ? (dz / distance) * speed : 0);
    this.position.addScaledVector(this.velocity, dt);
    const limit = world.halfSize - 2;
    this.position.x = Math.max(-limit, Math.min(limit, this.position.x));
    this.position.z = Math.max(-limit, Math.min(limit, this.position.z));
    this.altitude += (hover - this.altitude) * Math.min(1, dt * 1.5);
    this.position.y = this.altitude + Math.sin(this.stateTime * 2) * 0.25;
    this.ground.set(this.position.x, 0, this.position.z);

    const lookX = player.position.x - this.position.x;
    const lookZ = player.position.z - this.position.z;
    const desired = this.state === "wobble" ? this.heading + dt * 6 : Math.atan2(lookX, lookZ);
    const delta = Math.atan2(Math.sin(desired - this.heading), Math.cos(desired - this.heading));
    this.heading += delta * Math.min(1, dt * 3);
    this.group.position.copy(this.position);
    this.group.position.y -= 1.2 * scale;
    this.group.rotation.set(0.12 * Math.min(1, speed / 3) + (this.state === "wobble" ? Math.sin(this.stateTime * 9) * 0.3 : 0), this.heading, this.state === "wobble" ? Math.cos(this.stateTime * 7) * 0.3 : 0, "YXZ");
    this.group.scale.setScalar(scale);
    this.rotor.rotation.y += dt * 30;
    this.tailRotor.rotation.x += dt * 40;
    this.pilotMotion.state = pilotState;
    this.pilotMotion.stateTime = this.stateTime;
    this.pilot.update(dt, this.pilotMotion);
    return event;
  }

  startAim(player, tuning) {
    const lead = this.targets[0].copy(player.position).addScaledVector(player.velocity, 0.6);
    lead.y = 0;
    // Extra circles land beside the first one so there is always a clear way out.
    for (let i = 1; i < tuning.dropCount; i += 1) {
      const angle = Math.random() * Math.PI * 2;
      this.targets[i].set(lead.x + Math.cos(angle) * tuning.netRadius * 2.6, 0, lead.z + Math.sin(angle) * tuning.netRadius * 2.6);
    }
    this.setState("aim");
    this.sound.boing();
  }

  dispose() {
    this.scene.remove(this.group);
    for (const circle of this.circles) circle.dispose();
    for (const shot of this.shots) shot.dispose();
    this.pilot.dispose();
  }
}
