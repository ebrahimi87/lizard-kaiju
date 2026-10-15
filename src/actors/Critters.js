import * as THREE from "three";
import { createCritterModel } from "./critters/CritterModels.js";
import { GlowSpots, updatePreyGlow } from "./critters/PreyGlow.js";

// Prey critters: spawning around the player, wandering, fleeing (always slower than the
// lizard), getting dizzy from fire or pushed by water, and being eaten.

const STUN_TIME = 3.2;
const SPAWN_POP = 0.45;
const EAT_TIME = 0.16;

function pickWeighted(table, random) {
  const total = table.reduce((sum, item) => sum + item.weight, 0);
  let cursor = random() * total;
  for (const item of table) {
    cursor -= item.weight;
    if (cursor <= 0) return item;
  }
  return table[table.length - 1];
}

export class CritterSystem {
  constructor(scene, particles, random) {
    this.scene = scene;
    this.particles = particles;
    this.random = random;
    this.list = [];
    this.temp = new THREE.Vector3();
    this.spots = new GlowSpots(scene, 40);
    this.spotItems = [];
  }

  clear() {
    for (const critter of this.list) this.removeModel(critter);
    this.list.length = 0;
  }

  removeModel(critter) {
    this.scene.remove(critter.model.group);
    critter.model.dispose();
  }

  spawn(stage, world, player) {
    const table = stage.critters;
    const spec = pickWeighted(table.table, this.random);
    const limit = world.halfSize - 2;
    for (let attempt = 0; attempt < 20; attempt += 1) {
      const angle = this.random() * Math.PI * 2;
      const distance = table.spawnMin + this.random() * (table.spawnMax - table.spawnMin);
      const x = player.position.x + Math.cos(angle) * distance * Math.sqrt(player.scale);
      const z = player.position.z + Math.sin(angle) * distance * Math.sqrt(player.scale);
      if (Math.abs(x) > limit || Math.abs(z) > limit) continue;
      if (world.obstacles.some((o) => Math.hypot(o.x - x, o.z - z) < o.radius + 0.6)) continue;
      const shiny = this.random() < table.shinyChance;
      const model = createCritterModel(spec.kind, { shiny });
      const critter = {
        spec,
        model,
        shiny,
        value: spec.value * (shiny ? 5 : 1),
        scale: spec.scale,
        radius: model.radius * spec.scale,
        position: new THREE.Vector3(x, 0, z),
        velocity: new THREE.Vector3(),
        heading: this.random() * Math.PI * 2,
        state: "idle",
        stateTime: 0,
        wait: this.random() * 1.5,
        target: new THREE.Vector3(x, 0, z),
        heat: 0,
        stun: 0,
        age: 0,
        eaten: 0,
        motion: { speed: 0, state: "idle", time: 0 },
      };
      model.group.scale.setScalar(0.01);
      this.scene.add(model.group);
      this.list.push(critter);
      this.particles.burst("sparkle", critter.position, 6, 1.2, 0.6);
      return critter;
    }
    return null;
  }

  // Returns how many critters still need spawning to reach the stage's target count.
  update(dt, stage, world, player, frozen) {
    const table = stage.critters;
    this.time = (this.time ?? 0) + dt;
    updatePreyGlow(this.time);
    for (let i = this.list.length - 1; i >= 0; i -= 1) {
      const critter = this.list[i];
      critter.age += dt;
      critter.stateTime += dt;
      critter.motion.time += dt;
      if (critter.eaten > 0) {
        this.updateEaten(dt, critter, player);
        if (critter.eaten >= EAT_TIME) {
          this.removeModel(critter);
          this.list.splice(i, 1);
        }
        continue;
      }
      if (!frozen) this.think(dt, critter, stage, world, player);
      this.syncModel(dt, critter);
    }
    if (!frozen) {
      let missing = table.alive - this.list.length;
      while (missing > 0 && this.spawn(stage, world, player)) missing -= 1;
    }
    this.updateSpots();
  }

  updateSpots() {
    const items = this.spotItems;
    items.length = this.list.length;
    this.list.forEach((critter, index) => {
      const item = (items[index] ??= {});
      item.position = critter.position;
      item.radius = critter.radius;
      item.shiny = critter.shiny;
      item.phase = critter.position.x * 1.7;
      item.size = critter.eaten > 0 ? 0 : Math.min(1, critter.age / SPAWN_POP);
    });
    this.spots.update(items, this.time);
  }

  think(dt, critter, stage, world, player) {
    const spec = critter.spec;
    if (critter.stun > 0) {
      critter.stun -= dt;
      critter.state = "stunned";
      critter.velocity.multiplyScalar(Math.exp(-dt * 4));
    } else {
      const dx = critter.position.x - player.position.x;
      const dz = critter.position.z - player.position.z;
      const distance = Math.hypot(dx, dz);
      const fleeRadius = spec.fleeRadius * player.scale;
      let goalX = 0;
      let goalZ = 0;
      let speed = 0;
      if (distance < fleeRadius) {
        critter.state = "flee";
        goalX = dx / Math.max(distance, 0.01);
        goalZ = dz / Math.max(distance, 0.01);
        // Wobble so fleeing critters zigzag instead of running in perfect lines.
        const wobble = Math.sin(critter.age * 5 + critter.position.x) * 0.5;
        const wx = goalX - goalZ * wobble;
        const wz = goalZ + goalX * wobble;
        goalX = wx;
        goalZ = wz;
        speed = spec.fleeSpeed * Math.sqrt(player.scale);
      } else if (critter.wait > 0) {
        critter.state = "idle";
        critter.wait -= dt;
      } else {
        critter.state = "move";
        const tx = critter.target.x - critter.position.x;
        const tz = critter.target.z - critter.position.z;
        const toTarget = Math.hypot(tx, tz);
        if (toTarget < 0.3) {
          critter.wait = 0.4 + this.random() * 1.8;
          const angle = this.random() * Math.PI * 2;
          const reach = 1.5 + this.random() * 3;
          critter.target.set(critter.position.x + Math.cos(angle) * reach, 0, critter.position.z + Math.sin(angle) * reach);
        } else {
          goalX = tx / toTarget;
          goalZ = tz / toTarget;
          speed = spec.speed;
        }
      }
      const blend = 1 - Math.exp(-dt * 6);
      critter.velocity.x += (goalX * speed - critter.velocity.x) * blend;
      critter.velocity.z += (goalZ * speed - critter.velocity.z) * blend;
    }
    critter.position.x += critter.velocity.x * dt;
    critter.position.z += critter.velocity.z * dt;
    this.collide(critter, world);
    const moving = Math.hypot(critter.velocity.x, critter.velocity.z);
    if (moving > 0.05 && critter.stun <= 0) {
      const desired = Math.atan2(critter.velocity.x, critter.velocity.z);
      const delta = Math.atan2(Math.sin(desired - critter.heading), Math.cos(desired - critter.heading));
      critter.heading += delta * Math.min(1, dt * 10);
    }
    critter.motion.speed = moving / critter.scale;
    critter.motion.state = critter.state;
  }

  collide(critter, world) {
    for (const obstacle of world.obstacles) {
      const dx = critter.position.x - obstacle.x;
      const dz = critter.position.z - obstacle.z;
      const distance = Math.hypot(dx, dz);
      const minimum = obstacle.radius + critter.radius;
      if (distance < minimum && distance > 1e-4) {
        critter.position.x = obstacle.x + (dx / distance) * minimum;
        critter.position.z = obstacle.z + (dz / distance) * minimum;
        critter.target.copy(critter.position);
      }
    }
    const limit = world.halfSize - 1.2;
    if (Math.abs(critter.position.x) > limit || Math.abs(critter.position.z) > limit) {
      critter.position.x = Math.max(-limit, Math.min(limit, critter.position.x));
      critter.position.z = Math.max(-limit, Math.min(limit, critter.position.z));
      critter.target.set(critter.position.x * 0.8, 0, critter.position.z * 0.8);
    }
  }

  syncModel(dt, critter) {
    const group = critter.model.group;
    const pop = Math.min(1, critter.age / SPAWN_POP);
    const overshoot = pop < 1 ? Math.sin(pop * Math.PI) * 0.25 : 0;
    group.position.copy(critter.position);
    group.rotation.y = critter.heading;
    group.scale.setScalar(critter.scale * (pop + overshoot));
    critter.model.update(dt, critter.motion);
  }

  // Pull toward the mouth and shrink.
  updateEaten(dt, critter, player) {
    critter.eaten += dt;
    const t = Math.min(1, critter.eaten / EAT_TIME);
    critter.position.lerp(player.mouth, t);
    const group = critter.model.group;
    group.position.copy(critter.position);
    group.scale.setScalar(critter.scale * (1 - t));
  }

  // Marks the first critter the mouth touches as eaten and returns it, or null.
  tryEat(player, mouthRadius) {
    const mouth = player.biteCenter(this.temp);
    for (const critter of this.list) {
      if (critter.eaten > 0 || critter.age < SPAWN_POP * 0.6) continue;
      const distance = Math.hypot(critter.position.x - mouth.x, critter.position.z - mouth.z);
      if (distance < critter.radius + mouthRadius * player.scale) {
        critter.eaten = 0.0001;
        return critter;
      }
    }
    return null;
  }

  heat(critter, dt) {
    if (critter.eaten > 0) return false;
    critter.heat += dt;
    if (critter.heat > 0.12 && critter.stun <= 0) {
      critter.stun = STUN_TIME;
      critter.heat = 0;
      critter.velocity.set(0, 0, 0);
      return true;
    }
    return false;
  }

  splash(critter, forward, strength) {
    if (critter.eaten > 0) return;
    critter.velocity.addScaledVector(forward, strength);
    if (critter.stun <= 0) critter.stun = 1.4;
  }

  // Magnet perk: critters near the mouth slide toward it.
  attract(point, radius, speed, dt) {
    for (const critter of this.list) {
      if (critter.eaten > 0) continue;
      const dx = point.x - critter.position.x;
      const dz = point.z - critter.position.z;
      const distance = Math.hypot(dx, dz);
      if (distance > radius || distance < 0.01) continue;
      critter.position.x += (dx / distance) * speed * dt;
      critter.position.z += (dz / distance) * speed * dt;
    }
  }

  nearest(x, z, maxDistance, filter = null) {
    let best = null;
    let bestDistance = maxDistance;
    for (const critter of this.list) {
      if (critter.eaten > 0 || (filter && !filter(critter))) continue;
      const distance = Math.hypot(critter.position.x - x, critter.position.z - z);
      if (distance < bestDistance) {
        best = critter;
        bestDistance = distance;
      }
    }
    return best;
  }
}
