import * as THREE from "three";

// Fire and water breath: energy, particles, a flickering light, and the cone test that
// decides what the breath touches. Energy is 0..1 per element.

const MIN_START_ENERGY = 0.18;

export class Breath {
  constructor(scene, particles) {
    this.particles = particles;
    this.energy = { fire: 1, water: 1 };
    this.idleTime = { fire: 0, water: 0 };
    this.active = null;
    this.emitCarry = 0;
    this.light = new THREE.PointLight("#ff7a22", 0, 10, 1.4);
    scene.add(this.light);
    this.origin = new THREE.Vector3();
    this.velocity = new THREE.Vector3();
    this.tip = new THREE.Vector3();
  }

  canStart(kind) {
    return this.energy[kind] >= MIN_START_ENERGY;
  }

  // wants: { fire, water } held buttons. Returns the active element or null.
  update(dt, wants, waterUnlocked, player, tuning) {
    let next = null;
    if (wants.fire && (this.active === "fire" ? this.energy.fire > 0 : this.canStart("fire"))) next = "fire";
    else if (wants.water && waterUnlocked && (this.active === "water" ? this.energy.water > 0 : this.canStart("water"))) next = "water";
    this.active = next;

    for (const kind of ["fire", "water"]) {
      if (kind === this.active) {
        this.energy[kind] = Math.max(0, this.energy[kind] - (tuning.drain / 100) * dt);
        this.idleTime[kind] = 0;
      } else {
        this.idleTime[kind] += dt;
        if (this.idleTime[kind] > tuning.regenDelay) this.energy[kind] = Math.min(1, this.energy[kind] + (tuning.regen / 100) * dt);
      }
    }

    const scale = player.scale;
    if (this.active) this.emit(dt, player, tuning, scale);
    else this.emitCarry = 0;

    const flicker = 0.75 + Math.random() * 0.5;
    const targetIntensity = this.active === "fire" ? 26 * scale * scale * flicker : 0;
    this.light.intensity += (targetIntensity - this.light.intensity) * Math.min(1, dt * 18);
    this.light.distance = 9 * scale;
    this.light.position.copy(player.mouth).addScaledVector(player.forward, 1.2 * scale);
    this.light.position.y += 0.4 * scale;
    return this.active;
  }

  emit(dt, player, tuning, scale) {
    const fire = this.active === "fire";
    const rate = fire ? 95 : 80;
    this.emitCarry += rate * dt;
    const forward = player.forward;
    this.origin.copy(player.mouth).addScaledVector(forward, 0.06 * scale);
    const speed = (tuning.range / 0.45) * scale * (fire ? 1 : 0.95);
    while (this.emitCarry >= 1) {
      this.emitCarry -= 1;
      if (fire) {
        this.velocity.copy(forward).multiplyScalar(speed * (0.85 + Math.random() * 0.3));
        this.velocity.y += 0.3 * scale;
        this.particles.emit("fire", this.origin, this.velocity);
        if (Math.random() < 0.18) this.particles.emit("ember", this.origin, this.velocity);
        if (Math.random() < 0.12) {
          this.tip.copy(this.origin).addScaledVector(forward, tuning.range * scale * 0.8);
          this.velocity.set(0, 0.6 * scale, 0);
          this.particles.emit("smoke", this.tip, this.velocity);
        }
      } else {
        this.velocity.copy(forward).multiplyScalar(speed * (0.9 + Math.random() * 0.2));
        this.velocity.y += 1.4 * scale;
        this.particles.emit("water", this.origin, this.velocity);
        if (Math.random() < 0.25) this.particles.emit("mist", this.origin, this.velocity);
      }
    }
  }

  // Does the breath cone from the player reach a circle at (x, z) with radius r?
  reaches(player, tuning, x, z, radius) {
    const scale = player.scale;
    const dx = x - player.mouth.x;
    const dz = z - player.mouth.z;
    const along = dx * player.forward.x + dz * player.forward.z;
    if (along < -radius || along > tuning.range * scale + radius) return false;
    const lateral = Math.abs(dx * player.forward.z - dz * player.forward.x);
    return lateral <= Math.max(along, 0) * Math.tan(tuning.halfAngle) + radius + 0.25 * scale;
  }

  reset() {
    this.energy.fire = 1;
    this.energy.water = 1;
    this.active = null;
    this.light.intensity = 0;
  }
}
