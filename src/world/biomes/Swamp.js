import * as THREE from "three";
import { addInstancedProp, modelSize } from "../Assets.js";
import { addShapes, addMotes } from "./Details.js";

export const SWAMP_MODELS = [
  "swamp/swamp_lily_small.glb", "swamp/swamp_lily_large.glb", "swamp/swamp_tree_default_dark.glb",
  "swamp/swamp_tree_thin_dark.glb", "swamp/swamp_stump_square_detailed.glb", "swamp/swamp_grass_leafs.glb",
  "garden/log_large.glb", "garden/flower_yellow_a.glb", "nature/rock_large_a.glb",
  "garden/mushroom_red_group.glb",
];

// Braided shallows leave a broad dry central causeway and several crossing points.
export function buildSwamp(parent, random, halfSize, clearRadius = 5) {
  const water = [];
  const obstacles = [];
  const groups = new Map();
  function put(path, x, z, height, y = 0) {
    if (!groups.has(path)) groups.set(path, []);
    groups.get(path).push({ x, z, y, scale: height / modelSize(path).y, rotation: random() * Math.PI * 2 });
  }
  for (const side of [-1, 1]) {
    for (let i = 0; i < 12; i += 1) {
      const z = -halfSize + 3 + i * (halfSize * 2 - 6) / 11;
      const x = side * (6.6 + Math.sin(i * 0.7) * 2.1);
      // Small breaks in the river make clear, dry shortcuts.
      if (i === 3 || i === 8) continue;
      const radius = Math.min(3.6 + random() * 0.5, Math.hypot(x, z) - clearRadius - 0.4);
      if (radius > 0.5) water.push({ x, z, radius });
    }
  }
  // The first bend crosses the view ahead of spawn; all shallows are walkable.
  for (const [x, z, radius] of [[-2, 7.8, 2.4], [2.3, 8.4, 2.8], [-3, -8.5, 2.4], [-6.8, 0, 1.5], [6.8, 0, 1.5], [0, 6.7, 1.3], [-5.4, 3.2, 1.0], [5.4, 3.2, 1.0]]) {
    if (Math.hypot(x, z) >= clearRadius + radius + 0.3) water.push({ x, z, radius });
  }
  const petals = [];
  const hearts = [];
  const stalks = [];
  const catkins = [];
  for (const pool of water) {
    for (let i = 0; i < 5; i += 1) {
      const angle = random() * Math.PI * 2;
      const distance = pool.radius * Math.sqrt(random()) * 0.75;
      const x = pool.x + Math.cos(angle) * distance;
      const z = pool.z + Math.sin(angle) * distance;
      put(i % 2 ? SWAMP_MODELS[0] : SWAMP_MODELS[1], x, z, i % 2 ? 0.10 : 0.20, 0.04);
      if (i % 2 === 0) {
        hearts.push({ x, y: 0.28, z, sx: 0.12, sy: 0.1, sz: 0.12 });
        for (let petal = 0; petal < 6; petal += 1) {
          const a = petal * Math.PI / 3;
          petals.push({ x: x + Math.cos(a) * 0.17, y: 0.22, z: z + Math.sin(a) * 0.17, sx: 0.23, sy: 0.1, sz: 0.12, rotation: -a });
        }
      }
    }
    for (let i = 0; i < 7; i += 1) {
      const angle = i / 7 * Math.PI * 2;
      const x = pool.x + Math.cos(angle) * (pool.radius + 0.4);
      const z = pool.z + Math.sin(angle) * (pool.radius + 0.4);
      if (Math.hypot(x, z) < clearRadius) continue;
      put("swamp/swamp_grass_leafs.glb", x, z, 0.45 + random() * 0.35);
      if (i % 3 === 0) {
        put("garden/mushroom_red_group.glb", x + 0.5, z, 0.45);
        for (let reed = 0; reed < 3; reed += 1) {
          const px = x + reed * 0.16;
          const height = 0.7 + random() * 0.35;
          stalks.push({ x: px, y: height / 2, z, sx: 0.025, sy: height, sz: 0.025 });
          catkins.push({ x: px, y: height, z, sx: 0.075, sy: 0.28, sz: 0.075 });
        }
      }
    }
  }
  for (let i = 0; i < 88; i += 1) {
    const side = i % 4;
    const along = -halfSize + (i >> 2) * halfSize * 2 / 21;
    const edge = halfSize + random() * 3;
    const x = side < 2 ? along : (side === 2 ? -edge : edge);
    const z = side < 2 ? (side === 0 ? -edge : edge) : along;
    put(SWAMP_MODELS[2 + i % 2], x, z, 6 + random() * 4);
    put("nature/rock_large_a.glb", x, z, 1.8 + random());
  }
  for (let i = 0; i < 42; i += 1) {
    const x = (random() * 2 - 1) * (halfSize - 3);
    const z = (random() * 2 - 1) * (halfSize - 3);
    if (Math.hypot(x, z) < clearRadius + 2 || Math.abs(x) < 3 || water.some((pool) => Math.hypot(x - pool.x, z - pool.z) < pool.radius + 1.5)) continue;
    const tree = Math.abs(x) > 19;
    put(tree ? SWAMP_MODELS[3] : SWAMP_MODELS[4], x, z, tree ? 5.5 : 0.7 + random() * 0.5);
    obstacles.push({ x, z, radius: tree ? 0.55 : 0.7 });
    if (!tree) put("swamp/swamp_grass_leafs.glb", x + 0.8, z, 0.8);
  }
  // A low fallen log is a warm-colored landmark near the first river bend.
  if (Math.hypot(-6.5, 8) >= clearRadius + 1.2) {
    put("garden/log_large.glb", -6.5, 8, 0.8);
    obstacles.push({ x: -6.5, z: 8, radius: 1.2 });
  }
  // Small moss islands break up the outer mudflats without making new walls.
  const moss = [];
  for (let i = 0; i < 80; i += 1) {
    const x = (random() * 2 - 1) * (halfSize - 3);
    const z = (random() * 2 - 1) * (halfSize - 3);
    if (Math.hypot(x, z) < clearRadius + 1 || Math.abs(x) < 3 || water.some((pool) => Math.hypot(x - pool.x, z - pool.z) < pool.radius + 0.8)) continue;
    moss.push({ x, y: 0.04, z, sx: 1.1, sy: 0.15, sz: 0.8 });
    put("swamp/swamp_grass_leafs.glb", x, z, 0.4 + random() * 0.3);
    put("garden/mushroom_red_group.glb", x + 0.5, z + 0.3, 0.35 + random() * 0.2);
    if (i % 10 === 0) put("garden/log_large.glb", x, z, 0.35);
  }
  const sphere = new THREE.SphereGeometry(1, 6, 4);
  addShapes(parent, sphere, new THREE.MeshStandardMaterial({ color: "#839b4c", roughness: 1 }), moss);
  const mist = water.filter((_, index) => index % 3 === 0).map((pool) => ({ x: pool.x, y: 0.5, z: pool.z, sx: pool.radius * 1.3, sy: 0.16, sz: pool.radius * 0.65 }));
  addShapes(parent, sphere, new THREE.MeshBasicMaterial({ color: "#ffe9b7", transparent: true, opacity: 0.08, depthWrite: false }), mist);
  addShapes(parent, sphere, new THREE.MeshStandardMaterial({ color: "#ff83ba", roughness: 0.8 }), petals);
  addShapes(parent, sphere, new THREE.MeshStandardMaterial({ color: "#ffd86b" }), hearts);
  const cylinder = new THREE.CylinderGeometry(1, 1, 1, 5);
  addShapes(parent, cylinder, new THREE.MeshStandardMaterial({ color: "#708b39" }), stalks);
  addShapes(parent, cylinder, new THREE.MeshStandardMaterial({ color: "#75462c" }), catkins);
  for (const [path, placements] of groups) addInstancedProp(parent, path, placements, {
    castShadow: !path.includes("grass") && !path.includes("lily") && !path.includes("mushroom"),
    tint: path.includes("log") || path.includes("rock") ? "#8ea66d" : null,
  });
  const updateDetails = addMotes(parent, random, water, "#fff399");
  return { obstacles, halfSize, water, updateDetails };
}
