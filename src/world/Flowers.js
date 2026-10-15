import * as THREE from "three";

// Magic flower buds: spray one with water and it blooms, popping out gems (and a heart
// when the lizard has lost one). Gives the water breath a happy, non-fighting use.

const WATER_TIME = 0.6;
const BLOOM_TIME = 0.7;
const PETALS = 6;

function toy(color) {
  return new THREE.MeshPhysicalMaterial({ color, roughness: 0.45, clearcoat: 0.35, clearcoatRoughness: 0.4 });
}

function createBud() {
  const group = new THREE.Group();
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.08, 1, 8), toy("#4f9d36"));
  stem.position.y = 0.5;
  group.add(stem);
  for (const side of [-1, 1]) {
    const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 8), toy("#6cc24a"));
    leaf.scale.set(1, 0.25, 0.5);
    leaf.position.set(side * 0.2, 0.3, 0);
    leaf.rotation.z = side * 0.5;
    group.add(leaf);
  }
  const head = new THREE.Group();
  head.position.y = 1;
  group.add(head);
  const petalMaterial = toy("#ff4f6d");
  const petals = [];
  for (let i = 0; i < PETALS; i += 1) {
    const pivot = new THREE.Group();
    pivot.rotation.y = (i / PETALS) * Math.PI * 2;
    const petal = new THREE.Mesh(new THREE.SphereGeometry(0.3, 14, 10), petalMaterial);
    petal.scale.set(0.55, 1, 0.25);
    petal.position.set(0, 0.28, 0.12);
    pivot.add(petal);
    head.add(pivot);
    petals.push(pivot);
  }
  const center = new THREE.Mesh(new THREE.SphereGeometry(0.2, 14, 10), toy("#ffd23f"));
  center.position.y = 0.12;
  head.add(center);
  for (const mesh of group.children) mesh.castShadow = true;
  return { group, head, petals, center };
}

export class FlowerSystem {
  constructor(scene, particles, sound) {
    this.scene = scene;
    this.particles = particles;
    this.sound = sound;
    this.list = [];
  }

  clear() {
    for (const flower of this.list) this.scene.remove(flower.model.group);
    this.list.length = 0;
  }

  // Scatter count buds in open spots. size scales them to the stage's lizard.
  reset(count, world, random, size) {
    this.clear();
    for (let n = 0; n < count; n += 1) {
      for (let attempt = 0; attempt < 40; attempt += 1) {
        const x = (random() * 2 - 1) * (world.halfSize - 5);
        const z = (random() * 2 - 1) * (world.halfSize - 5);
        if (Math.hypot(x, z) < 7) continue;
        if (world.obstacles.some((o) => Math.hypot(o.x - x, o.z - z) < o.radius + 1.5)) continue;
        const model = createBud();
        model.group.position.set(x, 0, z);
        model.group.scale.setScalar(size);
        this.scene.add(model.group);
        this.list.push({ model, position: model.group.position, radius: 0.6 * size, water: 0, bloom: 0, done: false, time: random() * 6 });
        break;
      }
    }
  }

  // Water touching a bud. Returns true the moment it blooms.
  water(flower, dt) {
    if (flower.done) return false;
    flower.water += dt;
    if (flower.water < WATER_TIME) return false;
    flower.done = true;
    this.particles.burst("sparkle", flower.position, 20, 3);
    this.particles.burst("heart", flower.position, 6, 2);
    this.sound.twinkle();
    return true;
  }

  update(dt) {
    for (const flower of this.list) {
      flower.time += dt;
      const { head, petals, center } = flower.model;
      if (flower.done) flower.bloom = Math.min(1, flower.bloom + dt / BLOOM_TIME);
      // Closed buds sway and shiver while being watered; blooms open their petals.
      const open = THREE.MathUtils.smoothstep(flower.bloom, 0, 1);
      const wiggle = flower.done ? 0 : Math.sin(flower.time * 30) * Math.min(1, flower.water * 3) * 0.08;
      head.rotation.z = Math.sin(flower.time * 1.4) * 0.08 + wiggle;
      for (const pivot of petals) pivot.children[0].rotation.x = -0.15 - open * 1.25;
      center.scale.setScalar(0.6 + open * 0.6);
      head.scale.setScalar(1 + Math.sin(flower.bloom * Math.PI) * 0.35);
    }
  }
}
