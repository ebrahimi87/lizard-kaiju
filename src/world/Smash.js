import * as THREE from "three";

// City smashing: the kaiju crumbles buildings, cars, and trees by walking into them or
// burning them. Each crumble sinks the object, throws chunky debris, and gives growth.

const CHUNKS = 220;
const VALUE = { building: 2, car: 1, tree: 1 };
const BURN_TIME = 0.35;
const CRUMBLE_TIME = 0.8;

export class SmashSystem {
  constructor(scene, particles, sound) {
    this.scene = scene;
    this.particles = particles;
    this.sound = sound;
    this.items = [];
    const geometry = new THREE.BoxGeometry(1, 1, 1);
    const material = new THREE.MeshStandardMaterial({ color: "#ffffff", roughness: 0.8 });
    this.chunks = new THREE.InstancedMesh(geometry, material, CHUNKS);
    this.chunks.castShadow = true;
    this.chunks.frustumCulled = false;
    this.chunks.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    const white = new THREE.Color("#ffffff");
    for (let i = 0; i < CHUNKS; i += 1) this.chunks.setColorAt(i, white);
    scene.add(this.chunks);
    this.chunk = Array.from({ length: CHUNKS }, () => ({ life: 0, position: new THREE.Vector3(), velocity: new THREE.Vector3(), spin: new THREE.Vector3(), rotation: new THREE.Euler(), size: 1 }));
    this.cursor = 0;
    this.matrix = new THREE.Matrix4();
    this.quaternion = new THREE.Quaternion();
    this.scale = new THREE.Vector3();
    this.color = new THREE.Color();
    this.smokeAt = new THREE.Vector3();
    this.smokeUp = new THREE.Vector3(0, 1.5, 0);
    this.hidden = new THREE.Matrix4().makeScale(0, 0, 0);
    for (let i = 0; i < CHUNKS; i += 1) this.chunks.setMatrixAt(i, this.hidden);
  }

  reset(smashables = []) {
    this.items = smashables.map((item) => ({ ...item, heat: 0, crumbling: 0, done: false, regrow: 0, baseY: item.object.position.y, baseScale: item.object.scale.clone() }));
  }

  get remaining() {
    return this.items.filter((item) => !item.done && item.crumbling === 0);
  }

  // Returns the total value smashed this frame.
  update(dt, player, bodyRadius) {
    let value = 0;
    for (const item of this.items) {
      if (item.done) continue;
      if (item.crumbling > 0) {
        this.animateCrumble(dt, item);
        continue;
      }
      if (item.regrow > 0) {
        item.regrow = Math.min(1, item.regrow + dt * 1.5);
        const pop = item.regrow < 1 ? Math.sin(item.regrow * Math.PI * 0.5) + Math.sin(item.regrow * Math.PI) * 0.15 : 1;
        item.object.scale.copy(item.baseScale).multiplyScalar(pop);
        if (item.regrow >= 1) item.regrow = 0;
      }
      const distance = Math.hypot(player.position.x - item.x, player.position.z - item.z);
      if (distance < item.radius + bodyRadius * 0.8) value += this.crumble(item, player);
    }
    this.updateChunks(dt);
    return value;
  }

  // Endless mode: everything smashed pops back up out of the ground.
  regrow() {
    for (const item of this.items) {
      if (!item.done && item.crumbling === 0) continue;
      item.done = false;
      item.crumbling = 0;
      item.heat = 0;
      item.object.visible = true;
      item.object.position.y = item.baseY;
      item.object.rotation.set(0, item.object.rotation.y, 0);
      item.regrow = 0.0001;
    }
  }

  // Fire on a smashable: returns its value once it starts to crumble.
  heat(item, dt, player) {
    if (item.done || item.crumbling > 0) return 0;
    item.heat += dt;
    if (Math.random() < 0.3) {
      this.smokeAt.set(item.x, item.height * 0.8, item.z);
      this.particles.emit("smoke", this.smokeAt, this.smokeUp, 1.5);
    }
    return item.heat >= BURN_TIME ? this.crumble(item, player) : 0;
  }

  crumble(item, player) {
    item.crumbling = 0.0001;
    const center = new THREE.Vector3(item.x, item.height * 0.5, item.z);
    this.particles.burst("dust", center, 16, 4, 2.4);
    this.particles.burst("sparkle", center, 10, 4);
    this.sound.crumble();
    this.throwChunks(item, player);
    return VALUE[item.kind] ?? 1;
  }

  animateCrumble(dt, item) {
    item.crumbling += dt;
    const t = Math.min(1, item.crumbling / CRUMBLE_TIME);
    const object = item.object;
    object.position.y = item.baseY - t * t * item.height;
    object.rotation.z = Math.sin(item.crumbling * 40) * 0.04 * (1 - t);
    object.rotation.x = Math.cos(item.crumbling * 33) * 0.04 * (1 - t);
    if (t >= 1) {
      item.done = true;
      object.visible = false;
    }
  }

  throwChunks(item, player) {
    const count = item.kind === "building" ? 18 : 8;
    const tint = item.kind === "car" ? "#d9d4cc" : item.kind === "tree" ? "#6fb24a" : "#e8c9a0";
    for (let n = 0; n < count; n += 1) {
      const index = this.cursor;
      this.cursor = (this.cursor + 1) % CHUNKS;
      const chunk = this.chunk[index];
      chunk.life = 1.6 + Math.random() * 0.6;
      chunk.size = (0.15 + Math.random() * 0.3) * Math.max(1, item.height * 0.25);
      chunk.position.set(item.x + (Math.random() - 0.5) * item.radius, item.height * (0.3 + Math.random() * 0.6), item.z + (Math.random() - 0.5) * item.radius);
      const away = Math.atan2(item.x - player.position.x, item.z - player.position.z) + (Math.random() - 0.5) * 2.2;
      const speed = 3 + Math.random() * 5;
      chunk.velocity.set(Math.sin(away) * speed, 4 + Math.random() * 5, Math.cos(away) * speed);
      chunk.spin.set(Math.random() * 8, Math.random() * 8, Math.random() * 8);
      this.color.set(tint).offsetHSL(0, 0, (Math.random() - 0.5) * 0.2);
      this.chunks.setColorAt(index, this.color);
    }
    this.chunks.instanceColor.needsUpdate = true;
  }

  updateChunks(dt) {
    for (let i = 0; i < CHUNKS; i += 1) {
      const chunk = this.chunk[i];
      if (chunk.life <= 0) continue;
      chunk.life -= dt;
      chunk.velocity.y -= 18 * dt;
      chunk.position.addScaledVector(chunk.velocity, dt);
      if (chunk.position.y < chunk.size * 0.5) {
        chunk.position.y = chunk.size * 0.5;
        chunk.velocity.y *= -0.35;
        chunk.velocity.x *= 0.6;
        chunk.velocity.z *= 0.6;
        chunk.spin.multiplyScalar(0.6);
      }
      chunk.rotation.x += chunk.spin.x * dt;
      chunk.rotation.y += chunk.spin.y * dt;
      chunk.rotation.z += chunk.spin.z * dt;
      const shrink = Math.min(1, chunk.life / 0.4);
      this.quaternion.setFromEuler(chunk.rotation);
      this.scale.setScalar(chunk.size * shrink);
      this.matrix.compose(chunk.position, this.quaternion, this.scale);
      this.chunks.setMatrixAt(i, chunk.life > 0 ? this.matrix : this.hidden);
    }
    this.chunks.instanceMatrix.needsUpdate = true;
  }

  dispose() {
    this.scene.remove(this.chunks);
  }
}
