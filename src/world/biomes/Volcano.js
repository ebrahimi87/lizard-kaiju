import * as THREE from "three";
import { addInstancedProp, modelSize } from "../Assets.js";
import { addShapes, addMotes } from "./Details.js";

export const VOLCANO_MODELS = [
  "volcano/cliff_rock.glb", "volcano/cliff_large_rock.glb", "volcano/rock_tall_c.glb",
  "volcano/rock_large_d.glb", "props/crystal_cluster.glb", "nature/stone_small_flat_b.glb",
];

// A friendly dusk canyon: broad cool stone lanes with glowing side-pocket lava.
export function buildVolcano(parent, random, halfSize, clearRadius = 5) {
  const obstacles = [];
  const lava = [];
  const groups = new Map();
  function put(path, x, z, height) {
    if (!groups.has(path)) groups.set(path, []);
    groups.get(path).push({ x, z, scale: height / modelSize(path).y, rotation: random() * Math.PI * 2 });
  }
  for (let i = 0; i < 92; i += 1) {
    const side = i % 4;
    const along = -halfSize + (i >> 2) * halfSize * 2 / 22;
    const edge = halfSize + 2 + random() * 2;
    const x = side < 2 ? along : (side === 2 ? -edge : edge);
    const z = side < 2 ? (side === 0 ? -edge : edge) : along;
    put(VOLCANO_MODELS[i % 2], x, z, 6 + random() * 5);
  }
  for (const [x, z, radius] of [[-7.2, 4, 2.4], [7.8, -1, 1.9], [-14, -12, 3.6], [17, 15, 4], [-21, 21, 4.4], [24, -19, 4], [6, 25, 3.4], [-5, -26, 3]]) {
    if (Math.hypot(x, z) < clearRadius + radius + 0.8) continue;
    const pool = { x, z, radius };
    lava.push(pool);
    obstacles.push({ x, z, radius: radius + 0.8 });
    // Rock banks mark the hazard even without the glow.
    for (let i = 0; i < 10; i += 1) {
      const angle = i / 10 * Math.PI * 2;
      const px = x + Math.cos(angle) * (radius + 0.4);
      const pz = z + Math.sin(angle) * (radius + 0.4);
      put(VOLCANO_MODELS[3], px, pz, 0.45 + random() * 0.35);
    }
  }
  for (let i = 0; i < 60; i += 1) {
    const x = (random() * 2 - 1) * (halfSize - 4);
    const z = (random() * 2 - 1) * (halfSize - 4);
    if (Math.hypot(x, z) < clearRadius + 2 || lava.some((pool) => Math.hypot(x - pool.x, z - pool.z) < pool.radius + 2)) continue;
    const tall = Math.abs(x) > 21 || Math.abs(z) > 24;
    if (i % 3 === 0) {
      put(VOLCANO_MODELS[4], x, z, 1.0 + random() * 0.9);
      obstacles.push({ x, z, radius: 0.5 });
    } else {
      put(VOLCANO_MODELS[tall ? 2 : 3], x, z, tall ? 3 + random() * 2 : 0.5 + random() * 0.6);
      obstacles.push({ x, z, radius: tall ? 1 : 0.65 });
    }
  }
  for (const [x, z] of [[-5.6, -2], [5.7, 2.5]]) {
    if (Math.hypot(x, z) < clearRadius + 0.5) continue;
    put(VOLCANO_MODELS[4], x, z, 0.8);
    obstacles.push({ x, z, radius: 0.5 });
  }
  // A pale breadcrumb trail remains readable against the warm basalt.
  for (let i = 0; i < 32; i += 1) {
    const z = -halfSize + 2 + i * 2;
    put(VOLCANO_MODELS[5], Math.sin(z * 0.12) * 2, z, 0.045);
  }
  for (const [x, z] of [[-5.5, 2.6], [5.5, 2.6], [-5.8, -3], [5.8, -3], [-3, 6], [3, 6]]) {
    if (Math.hypot(x, z) < clearRadius + 0.8 || lava.some((pool) => Math.hypot(x - pool.x, z - pool.z) < pool.radius + 1.5)) continue;
    put(VOLCANO_MODELS[3], x, z, 0.65);
    put(VOLCANO_MODELS[4], x + Math.sign(x) * 0.6, z + 0.5, 1.3);
    put(VOLCANO_MODELS[3], x - 0.4, z - 0.6, 0.35);
    obstacles.push({ x, z, radius: 0.75 });
  }
  // Low scree and crystal gardens give the close camera scale and color.
  for (let i = 0; i < 220; i += 1) {
    const x = (random() * 2 - 1) * (halfSize - 2);
    const z = (random() * 2 - 1) * (halfSize - 2);
    if (Math.hypot(x, z) < clearRadius + 0.5 || lava.some((pool) => Math.hypot(x - pool.x, z - pool.z) < pool.radius + 0.6)) continue;
    put(VOLCANO_MODELS[3], x, z, 0.15 + random() * 0.4);
    if (i % 12 === 0) put(VOLCANO_MODELS[4], x + 0.4, z, 0.7 + random() * 0.7);
  }
  const basalt = new THREE.MeshStandardMaterial({ color: "#794438", roughness: 1, flatShading: true });
  const cone = new THREE.Mesh(new THREE.CylinderGeometry(2.7, 12, 15, 12, 1, true), basalt);
  cone.position.set(-14, 7, halfSize + 11);
  parent.add(cone);
  const crater = new THREE.Mesh(new THREE.CircleGeometry(2.7, 24), new THREE.MeshStandardMaterial({ color: "#ff9b22", emissive: "#ff5109", emissiveIntensity: 5 }));
  crater.rotation.x = -Math.PI / 2;
  crater.position.set(-14, 14.55, halfSize + 11);
  parent.add(crater);
  const smoke = [];
  for (let i = 0; i < 8; i += 1) smoke.push({ x: -14 + i * 0.5, y: 16 + i * 1.9, z: halfSize + 11, sx: 1.6 + i * 0.3, sy: 1.3 + i * 0.25, sz: 1.5 + i * 0.3 });
  addShapes(parent, new THREE.IcosahedronGeometry(1, 1), new THREE.MeshStandardMaterial({ color: "#b8a4a0", transparent: true, opacity: 0.45, depthWrite: false, flatShading: true }), smoke);
  for (const [path, placements] of groups) addInstancedProp(parent, path, placements, {
    tint: path.includes("crystal") ? "#ffad62" : path.includes("stone") ? "#d6a485" : "#b47a61",
  });
  const updateDetails = addMotes(parent, random, lava, "#ff9b26", true);
  return { obstacles, halfSize, lava, updateDetails };
}
