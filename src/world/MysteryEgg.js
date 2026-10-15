import * as THREE from "three";

// A big speckled mystery egg near the start of each stage. Fire (or walking into it)
// cracks it open for a random surprise; the game decides the prize.

const HEAT_TIME = 0.5;

function createEggModel() {
  const group = new THREE.Group();
  const shell = new THREE.Group();
  group.add(shell);
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 128;
  const context = canvas.getContext("2d");
  context.fillStyle = "#fffaf0";
  context.fillRect(0, 0, 256, 128);
  const colors = ["#e2322b", "#ffc21c", "#3fa0ff", "#3fbf4a", "#ff6fb0"];
  for (let i = 0; i < 26; i += 1) {
    context.fillStyle = colors[i % colors.length];
    context.beginPath();
    context.arc((i * 97) % 256, 10 + ((i * 53) % 108), 6 + (i % 4) * 3, 0, Math.PI * 2);
    context.fill();
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const material = new THREE.MeshPhysicalMaterial({ map: texture, roughness: 0.35, clearcoat: 0.6 });
  // Two halves so the top can pop off.
  const bottom = new THREE.Mesh(new THREE.SphereGeometry(0.5, 32, 16, 0, Math.PI * 2, Math.PI * 0.45, Math.PI * 0.55), material);
  const top = new THREE.Mesh(new THREE.SphereGeometry(0.5, 32, 16, 0, Math.PI * 2, 0, Math.PI * 0.45), material);
  for (const half of [bottom, top]) {
    half.scale.set(1, 1.3, 1);
    half.castShadow = true;
    shell.add(half);
  }
  shell.position.y = 0.62;
  return { group, shell, top, bottom };
}

export class MysteryEgg {
  constructor(scene, particles, sound) {
    this.scene = scene;
    this.particles = particles;
    this.sound = sound;
    this.model = createEggModel();
    this.position = this.model.group.position;
    this.radius = 0.6;
    this.heat = 0;
    this.opened = false;
    this.openTime = 0;
    this.time = 0;
    scene.add(this.model.group);
  }

  place(x, z, size) {
    this.position.set(x, 0, z);
    this.size = size;
    this.radius = 0.6 * size;
    this.model.group.scale.setScalar(size);
  }

  // Fire on the egg. Returns true the moment it cracks open.
  warm(dt) {
    if (this.opened) return false;
    this.heat += dt;
    return this.heat >= HEAT_TIME ? this.open() : false;
  }

  open() {
    this.opened = true;
    this.particles.burst("confetti", this.position, 30, 4, this.size);
    this.particles.burst("gold", this.position, 20, 4, this.size);
    this.sound.escape();
    return true;
  }

  update(dt) {
    this.time += dt;
    const { shell, top } = this.model;
    if (!this.opened) {
      // Wobbles now and then, faster when warmed: "something is inside!"
      const wobble = Math.max(0, Math.sin(this.time * 2.2)) ** 6 * 0.18 + this.heat * 0.25 * Math.sin(this.time * 30);
      shell.rotation.z = Math.sin(this.time * 14) * wobble;
      return;
    }
    this.openTime += dt;
    top.position.y = Math.min(1.2, this.openTime * 3) - this.openTime * this.openTime * 1.5;
    top.rotation.z = this.openTime * 4;
    top.visible = this.openTime < 1.2;
    const fade = Math.max(0, 1 - Math.max(0, this.openTime - 1.6));
    shell.scale.setScalar(fade);
    this.model.group.visible = fade > 0;
  }

  dispose() {
    this.scene.remove(this.model.group);
  }
}
