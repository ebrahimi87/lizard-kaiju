import * as THREE from "three";
import { createBuddyModel, createCageModel } from "./critters/CritterModels.js";

// Caged friends (cat, dog, horse). Fire burns a cage open; the freed buddy follows the
// lizard and helps: the dog barks the catcher slow, the cat pounces critters dizzy,
// the horse makes the lizard faster.

const BURN_TIME = 0.9; // seconds of fire to open a cage
const BUDDY_SCALE = { cat: 1, dog: 1, horse: 0.85 };

export class BuddySystem {
  constructor(scene, particles, sound) {
    this.scene = scene;
    this.particles = particles;
    this.sound = sound;
    this.cages = [];
    this.buddies = [];
    this.temp = new THREE.Vector3();
  }

  get speedBoost() {
    return this.buddies.some((buddy) => buddy.kind === "horse") ? 1.15 : 1;
  }

  clear() {
    for (const cage of this.cages) {
      this.scene.remove(cage.model.group, cage.buddy.group);
      cage.buddy.dispose();
    }
    for (const buddy of this.buddies) {
      this.scene.remove(buddy.model.group);
      buddy.model.dispose();
    }
    this.cages.length = 0;
    this.buddies.length = 0;
  }

  // Places one cage per stage buddy, away from the start and from obstacles.
  reset(stage, world, random) {
    this.clear();
    for (const { kind } of stage.buddies) {
      for (let attempt = 0; attempt < 60; attempt += 1) {
        const angle = random() * Math.PI * 2;
        const distance = 9 + random() * (world.halfSize - 14);
        const x = Math.cos(angle) * distance;
        const z = Math.sin(angle) * distance;
        if (world.obstacles.some((o) => Math.hypot(o.x - x, o.z - z) < o.radius + 2.2)) continue;
        this.addCage(kind, x, z);
        world.obstacles.push({ x, z, radius: 1.0, cage: true });
        break;
      }
    }
  }

  addCage(kind, x, z) {
    const cage = createCageModel();
    const buddy = createBuddyModel(kind);
    const scale = BUDDY_SCALE[kind];
    cage.group.position.set(x, 0, z);
    cage.group.scale.setScalar(kind === "horse" ? 1.9 : 1.2);
    buddy.group.position.set(x, 0, z);
    buddy.group.scale.setScalar(scale);
    buddy.group.rotation.y = Math.PI; // face the camera
    this.scene.add(cage.group, buddy.group);
    this.cages.push({ kind, model: cage, buddy, burn: 0, freed: false, position: new THREE.Vector3(x, 0, z), radius: 1.1, motion: { speed: 0, state: "caged", time: 0 } });
  }

  // A buddy that joins straight away (from a power card).
  addFreed(kind, position) {
    const model = createBuddyModel(kind);
    model.group.position.copy(position);
    this.scene.add(model.group);
    this.buddies.push({ kind, model, position: position.clone(), heading: 0, happy: 1.2, cooldown: 2, action: 0, motion: { speed: 0, state: "happy", time: 0 } });
    this.particles.burst("heart", position, 8, 2);
  }

  // Fire touching a cage. Returns the freed kind once the cage breaks.
  heatCage(cage, dt, world) {
    if (cage.freed) return null;
    cage.burn = Math.min(1, cage.burn + dt / BURN_TIME);
    cage.model.setBurn(cage.burn);
    if (cage.burn < 1) return null;
    cage.freed = true;
    const index = world.obstacles.findIndex((o) => o.cage && o.x === cage.position.x && o.z === cage.position.z);
    if (index >= 0) world.obstacles.splice(index, 1);
    this.particles.burst("heart", cage.position, 14, 2.5);
    this.particles.burst("sparkle", cage.position, 20, 3);
    this.buddies.push({
      kind: cage.kind,
      model: cage.buddy,
      position: cage.position.clone(),
      heading: Math.PI,
      happy: 1.6,
      cooldown: 2,
      action: 0,
      motion: { speed: 0, state: "happy", time: 0 },
    });
    this.sound.escape();
    return cage.kind;
  }

  // helpers: { critters, catcher, stage }. Buddies line up behind the lizard.
  update(dt, player, helpers) {
    for (const cage of this.cages) {
      cage.model.update(dt);
      if (!cage.freed) {
        cage.motion.time += dt;
        cage.buddy.update(dt, cage.motion);
      }
    }
    this.buddies.forEach((buddy, index) => this.updateBuddy(dt, buddy, index, player, helpers));
  }

  updateBuddy(dt, buddy, index, player, { critters, catcher, stage }) {
    const scale = BUDDY_SCALE[buddy.kind] * player.scale;
    const behind = (1.8 + index * 1.3) * player.scale;
    const goal = this.temp.copy(player.position).addScaledVector(player.forward, -behind);
    buddy.cooldown -= dt;
    buddy.happy -= dt;
    buddy.action -= dt;

    // Helping moves: they interrupt following for a moment.
    if (buddy.cooldown <= 0 && buddy.kind === "dog" && catcher.active && !catcher.stunned) {
      const near = Math.hypot(catcher.position.x - buddy.position.x, catcher.position.z - buddy.position.z);
      if (near < 6 * player.scale) {
        catcher.slow(2.6);
        buddy.action = 1;
        buddy.cooldown = 7;
        this.sound.boing();
      }
    }
    if (buddy.cooldown <= 0 && buddy.kind === "cat") {
      const prey = critters.nearest(buddy.position.x, buddy.position.z, 3 * player.scale, (c) => c.stun <= 0);
      if (prey) {
        prey.stun = 3;
        buddy.action = 0.8;
        buddy.cooldown = 5;
        buddy.position.lerp(prey.position, 0.6);
        this.particles.burst("star", prey.position, 6, 1.5);
      }
    }

    const dx = goal.x - buddy.position.x;
    const dz = goal.z - buddy.position.z;
    const distance = Math.hypot(dx, dz);
    const maxSpeed = stage.player.speed * Math.sqrt(player.scale) * 1.25;
    const speed = buddy.action > 0 || buddy.happy > 0 ? 0 : Math.min(maxSpeed, distance * 3);
    if (distance > 0.05 && speed > 0) {
      buddy.position.x += (dx / distance) * speed * dt;
      buddy.position.z += (dz / distance) * speed * dt;
      const desired = Math.atan2(dx, dz);
      const delta = Math.atan2(Math.sin(desired - buddy.heading), Math.cos(desired - buddy.heading));
      buddy.heading += delta * Math.min(1, dt * 8);
    }
    buddy.motion.speed = speed / scale;
    buddy.motion.state = buddy.action > 0 ? "action" : buddy.happy > 0 ? "happy" : speed > 0.2 ? "move" : "idle";
    buddy.motion.time += dt;
    const group = buddy.model.group;
    group.position.copy(buddy.position);
    group.rotation.y = buddy.heading;
    group.scale.setScalar(scale);
    buddy.model.update(dt, buddy.motion);
  }
}
