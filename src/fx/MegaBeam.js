import * as THREE from "three";

// The kaiju's super move. Charge: the back plates light up from tail to head. Fire: a
// huge glowing beam blasts straight ahead, with flames and sparks along it.
//   start() → update(dt, player) each frame → { charging, firing, done }

const CHARGE_TIME = 0.9;
const FIRE_TIME = 1.7;

export class MegaBeam {
  constructor(scene, particles, sound) {
    this.particles = particles;
    this.sound = sound;
    this.time = -1;
    const geometry = new THREE.CylinderGeometry(1, 1, 1, 24, 1, true);
    geometry.translate(0, 0.5, 0);
    geometry.rotateX(Math.PI / 2); // extend along +Z
    this.core = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ color: new THREE.Color(6, 5, 3.5), transparent: true, opacity: 0.95, depthWrite: false, blending: THREE.AdditiveBlending }));
    this.glow = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ color: new THREE.Color(5, 1.6, 0.3), transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending }));
    this.group = new THREE.Group();
    this.group.add(this.glow, this.core);
    this.group.visible = false;
    scene.add(this.group);
    this.light = new THREE.PointLight("#ffb050", 0, 30, 1.2);
    scene.add(this.light);
    this.point = new THREE.Vector3();
    this.velocity = new THREE.Vector3();
  }

  get active() {
    return this.time >= 0;
  }

  get firing() {
    return this.time >= CHARGE_TIME && this.time < CHARGE_TIME + FIRE_TIME;
  }

  start() {
    this.time = 0;
    this.sound.evolve();
  }

  // Returns the glow sweep values for the lizard's plates.
  update(dt, player, length) {
    if (this.time < 0) return { glow: 0, glowFront: 1.2 };
    this.time += dt;
    const scale = player.scale;
    let glow = 0;
    let glowFront = 1.2;
    if (this.time < CHARGE_TIME) {
      const t = this.time / CHARGE_TIME;
      glow = 2 + t * 4;
      glowFront = -0.1 + t * 1.3;
      if (Math.random() < 0.6) this.particles.burst("ember", player.position, 1, 2);
    } else if (this.firing) {
      if (!this.fired) {
        this.fired = true;
        this.sound.roar(6);
        this.sound.hiss({ duration: FIRE_TIME, volume: 0.45, filter: "lowpass", from: 2400, to: 400 });
      }
      const t = (this.time - CHARGE_TIME) / FIRE_TIME;
      glow = 7;
      const width = scale * (0.55 + Math.sin(this.time * 40) * 0.06) * Math.min(1, t * 6) * Math.min(1, (1 - t) * 5);
      this.group.visible = true;
      this.group.position.copy(player.mouth);
      this.group.rotation.y = player.heading;
      this.core.scale.set(width * 0.5, width * 0.5, length);
      this.glow.scale.set(width * 1.25, width * 1.25, length);
      this.light.intensity = 400 * scale;
      this.light.position.copy(player.mouth).addScaledVector(player.forward, length * 0.3);
      for (let i = 0; i < 6; i += 1) {
        this.point.copy(player.mouth).addScaledVector(player.forward, Math.random() * length);
        this.velocity.set((Math.random() - 0.5) * 4, 2 + Math.random() * 3, (Math.random() - 0.5) * 4);
        this.particles.emit(i % 3 === 0 ? "ember" : "fire", this.point, this.velocity, 2.2);
      }
    } else {
      this.group.visible = false;
      this.light.intensity = 0;
      this.time = -1;
      this.fired = false;
    }
    return { glow, glowFront };
  }

  // Is a circle at (x, z) inside the beam right now?
  hits(player, length, x, z, radius) {
    if (!this.firing) return false;
    const dx = x - player.mouth.x;
    const dz = z - player.mouth.z;
    const along = dx * player.forward.x + dz * player.forward.z;
    const lateral = Math.abs(dx * player.forward.z - dz * player.forward.x);
    return along > -radius && along < length + radius && lateral < radius + player.scale * 0.9;
  }
}
