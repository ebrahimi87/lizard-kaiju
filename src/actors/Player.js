import * as THREE from "three";
import { LizardModel } from "./lizard/LizardModel.js";
import { formById } from "../config/forms.js";
import { attachHat } from "./lizard/Hats.js";

// The player's lizard: movement on the ground plane, collisions, growth scale, and the
// procedural model. Heading 0 faces +Z; heading h faces (sin h, 0, cos h).

function angleDelta(from, to) {
  return Math.atan2(Math.sin(to - from), Math.cos(to - from));
}

export class Player {
  constructor(scene, formId, skin, hatId = null) {
    this.scene = scene;
    this.skin = skin;
    this.hatId = hatId;
    this.position = new THREE.Vector3();
    this.velocity = new THREE.Vector3();
    this.heading = 0;
    this.turnRate = 0;
    this.scale = 1;
    this.pulse = 0;
    this.invulnerable = 0;
    // Seconds during which catchers may not start a new attack (after cinematics).
    this.calm = 0;
    this.motion = { speed: 0, turnRate: 0, mouthOpen: 0, roar: 0, glow: 0, glowFront: 1.2, lookYaw: 0 };
    this.mouth = new THREE.Vector3();
    this.forward = new THREE.Vector3(0, 0, 1);
    this.setForm(formId);
  }

  setForm(formId) {
    if (this.model) {
      this.scene.remove(this.model.group);
      this.model.dispose();
    }
    this.form = formById(formId);
    this.model = new LizardModel(this.form, this.skin);
    attachHat(this.model, this.hatId);
    this.model.addXray();
    this.scene.add(this.model.group);
    this.syncModel(0);
  }

  // move: desired world direction (x, z) with length ≤ 1. aimHeading: optional heading
  // the breath auto-aim wants. stage: tuning from config/stages.js.
  update(dt, move, aimHeading, breathing, stage, world) {
    const tuning = stage.player;
    const speedScale = Math.sqrt(this.scale);
    const maxSpeed = tuning.speed * speedScale * (breathing ? 0.55 : 1);
    const targetX = move.x * maxSpeed;
    const targetZ = move.z * maxSpeed;
    const blend = 1 - Math.exp(-tuning.acceleration * dt / Math.max(maxSpeed, 0.1));
    this.velocity.x += (targetX - this.velocity.x) * blend;
    this.velocity.z += (targetZ - this.velocity.z) * blend;

    const speed = Math.hypot(this.velocity.x, this.velocity.z);
    let desired = this.heading;
    if (aimHeading !== null) desired = aimHeading;
    else if (speed > 0.15) desired = Math.atan2(this.velocity.x, this.velocity.z);
    const turn = angleDelta(this.heading, desired);
    const maxTurn = tuning.turnRate * dt;
    const step = Math.max(-maxTurn, Math.min(maxTurn, turn * Math.min(1, dt * 14)));
    this.heading += step;
    this.turnRate = dt > 0 ? step / dt : 0;

    this.position.x += this.velocity.x * dt;
    this.position.z += this.velocity.z * dt;
    this.resolveCollisions(world, tuning.bodyRadius * this.scale);

    this.invulnerable = Math.max(0, this.invulnerable - dt);
    this.calm = Math.max(0, this.calm - dt);
    this.pulse = Math.max(0, this.pulse - dt * 3);
    this.motion.speed = speed / this.scale;
    this.motion.turnRate = this.turnRate;
    this.motion.mouthOpen += ((breathing ? 1 : 0) - this.motion.mouthOpen) * Math.min(1, dt * 14);
    this.syncModel(dt);
  }

  resolveCollisions(world, radius) {
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
    const limit = world.halfSize - radius - 0.5;
    this.position.x = Math.max(-limit, Math.min(limit, this.position.x));
    this.position.z = Math.max(-limit, Math.min(limit, this.position.z));
  }

  syncModel(dt) {
    const group = this.model.group;
    group.position.copy(this.position);
    group.rotation.y = this.heading;
    const squash = Math.sin(this.pulse * Math.PI) * 0.14;
    group.scale.set(this.scale * (1 + squash), this.scale * (1 - squash * 0.6), this.scale * (1 + squash));
    group.visible = this.invulnerable <= 0 || Math.floor(this.invulnerable * 12) % 2 === 0;
    this.model.update(dt, this.motion);
    group.updateMatrixWorld(true);
    this.model.mouthAnchor.getWorldPosition(this.mouth);
    this.forward.set(Math.sin(this.heading), 0, Math.cos(this.heading));
  }

  // Catchers start attacks only when this is true.
  get attackable() {
    return this.invulnerable <= 0 && this.calm <= 0;
  }

  // Ground-level point in front of the face, used for eating.
  biteCenter(out) {
    return out.set(this.mouth.x, 0, this.mouth.z);
  }

  chomp() {
    this.pulse = 1;
  }

  dispose() {
    this.scene.remove(this.model.group);
    this.model.dispose();
  }
}
