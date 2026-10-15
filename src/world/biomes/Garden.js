import { addInstancedProp, modelSize } from "../Assets.js";

// Stage 1: a sunny backyard seen from a baby gecko's height. Flowers tower over the
// lizard, a wooden fence closes the yard, and big trees frame it from outside.

export const GARDEN_MODELS = [
  "garden/fence_planks.glb",
  "garden/flower_red_a.glb",
  "garden/flower_red_b.glb",
  "garden/flower_yellow_a.glb",
  "garden/flower_yellow_b.glb",
  "garden/flower_purple_a.glb",
  "garden/flower_purple_b.glb",
  "garden/plant_bush_large.glb",
  "garden/plant_bush_detailed.glb",
  "garden/plant_bush.glb",
  "garden/mushroom_red.glb",
  "garden/mushroom_red_group.glb",
  "garden/mushroom_tan_tall.glb",
  "garden/pot_large.glb",
  "garden/pot_small.glb",
  "garden/log_large.glb",
  "garden/stump_round_detailed.glb",
  "garden/path_stone_circle.glb",
  "garden/grass.glb",
  "garden/grass_large.glb",
  "garden/grass_leafs_large.glb",
  "nature/tree_oak.glb",
  "nature/tree_default.glb",
  "nature/tree_detailed.glb",
  "nature/tree_tall.glb",
  "nature/rock_large_a.glb",
  "nature/rock_large_c.glb",
  "nature/rock_small_a.glb",
];

function heightScale(path, height) {
  return height / modelSize(path).y;
}

// clearRadius keeps the spawn area open.
export function buildGarden(parent, random, halfSize, clearRadius = 5) {
  const obstacles = [];
  const taken = [];

  function isFree(x, z, radius) {
    if (Math.hypot(x, z) < clearRadius + radius) return false;
    return taken.every((item) => Math.hypot(item.x - x, item.z - z) > item.radius + radius);
  }

  function findSpot(radius, margin) {
    for (let attempt = 0; attempt < 40; attempt += 1) {
      const x = (random() * 2 - 1) * (halfSize - margin);
      const z = (random() * 2 - 1) * (halfSize - margin);
      if (isFree(x, z, radius)) return { x, z };
    }
    return null;
  }

  // Groups placements by model so each model becomes one set of instanced meshes.
  const byModel = new Map();
  function put(path, x, z, height, options = {}) {
    if (!byModel.has(path)) byModel.set(path, []);
    byModel.get(path).push({
      x,
      z,
      y: options.y ?? 0,
      rotation: options.rotation ?? random() * Math.PI * 2,
      scale: heightScale(path, height),
    });
  }

  // Fence: segments along each side, facing inward.
  const fencePath = "garden/fence_planks.glb";
  const fenceSize = modelSize(fencePath);
  const fenceHeight = 3.4;
  const fenceScale = fenceHeight / fenceSize.y;
  const segment = fenceSize.x * fenceScale;
  const count = Math.ceil((halfSize * 2) / segment);
  for (let i = 0; i < count; i += 1) {
    const along = -halfSize + segment * (i + 0.5);
    put(fencePath, along, -halfSize, fenceHeight, { rotation: 0 });
    put(fencePath, along, halfSize, fenceHeight, { rotation: Math.PI });
    put(fencePath, -halfSize, along, fenceHeight, { rotation: Math.PI / 2 });
    put(fencePath, halfSize, along, fenceHeight, { rotation: -Math.PI / 2 });
  }

  // Trees beyond the fence.
  const trees = ["nature/tree_oak.glb", "nature/tree_default.glb", "nature/tree_detailed.glb", "nature/tree_tall.glb"];
  for (let i = 0; i < 46; i += 1) {
    const angle = (i / 46) * Math.PI * 2 + random() * 0.1;
    const distance = halfSize * 1.18 + random() * halfSize * 0.5;
    const x = Math.cos(angle) * distance;
    const z = Math.sin(angle) * distance;
    put(trees[i % trees.length], x, z, 15 + random() * 10);
  }

  // Bushes hugging the fence give the yard a soft edge.
  const bushes = ["garden/plant_bush_large.glb", "garden/plant_bush_detailed.glb", "garden/plant_bush.glb"];
  for (let i = 0; i < 40; i += 1) {
    const side = i % 4;
    const along = (random() * 2 - 1) * (halfSize - 2);
    const inset = halfSize - 1.6 - random() * 1.5;
    const x = side === 0 ? along : side === 1 ? along : side === 2 ? -inset : inset;
    const z = side === 0 ? -inset : side === 1 ? inset : along;
    put(bushes[i % bushes.length], x, z, 2.6 + random() * 1.8);
    taken.push({ x, z, radius: 1.6 });
  }

  // Winding stepping-stone path across the yard.
  const stonePath = "garden/path_stone_circle.glb";
  for (let i = 0; i < 26; i += 1) {
    const t = i / 25;
    const z = -halfSize * 0.85 + t * halfSize * 1.7;
    const x = Math.sin(t * Math.PI * 2.2) * halfSize * 0.35 + 3;
    put(stonePath, x, z, 0.12, { y: 0.02 });
    byModel.get(stonePath).at(-1).scale = 2.6 / modelSize(stonePath).x;
  }

  // Flower patches: red appears most often.
  const flowers = [
    "garden/flower_red_a.glb",
    "garden/flower_red_b.glb",
    "garden/flower_red_a.glb",
    "garden/flower_yellow_a.glb",
    "garden/flower_yellow_b.glb",
    "garden/flower_purple_a.glb",
    "garden/flower_purple_b.glb",
  ];
  for (let patch = 0; patch < 16; patch += 1) {
    const spot = findSpot(2.6, 4);
    if (!spot) continue;
    taken.push({ x: spot.x, z: spot.z, radius: 2.6 });
    const kind = flowers[Math.floor(random() * flowers.length)];
    const blooms = 4 + Math.floor(random() * 6);
    for (let i = 0; i < blooms; i += 1) {
      const angle = random() * Math.PI * 2;
      const distance = random() * 2.2;
      put(random() < 0.75 ? kind : flowers[Math.floor(random() * flowers.length)], spot.x + Math.cos(angle) * distance, spot.z + Math.sin(angle) * distance, 1.5 + random() * 1.3);
    }
  }

  // Mushrooms, pots with flowers, logs, stumps, and rocks are solid obstacles.
  function solid(path, height, radius, margin) {
    const spot = findSpot(radius, margin);
    if (!spot) return null;
    put(path, spot.x, spot.z, height);
    taken.push({ x: spot.x, z: spot.z, radius });
    obstacles.push({ x: spot.x, z: spot.z, radius: radius * 0.8 });
    return spot;
  }
  for (let i = 0; i < 7; i += 1) solid("garden/mushroom_red_group.glb", 1.6 + random() * 0.8, 1.3, 4);
  for (let i = 0; i < 4; i += 1) solid("garden/mushroom_red.glb", 1.8 + random() * 0.6, 1.0, 4);
  for (let i = 0; i < 3; i += 1) solid("garden/mushroom_tan_tall.glb", 2.4, 0.9, 4);
  for (let i = 0; i < 5; i += 1) {
    const potPath = i % 2 ? "garden/pot_small.glb" : "garden/pot_large.glb";
    const potHeight = i % 2 ? 1.9 : 1.4;
    const spot = solid(potPath, potHeight, 1.3, 5);
    if (spot) put(flowers[i % flowers.length], spot.x, spot.z, 1.8, { y: potHeight * 0.85 });
  }
  for (let i = 0; i < 3; i += 1) solid("garden/log_large.glb", 1.4, 1.8, 5);
  for (let i = 0; i < 4; i += 1) solid("garden/stump_round_detailed.glb", 1.3, 1.2, 4);
  const rocks = ["nature/rock_large_a.glb", "nature/rock_large_c.glb", "nature/rock_small_a.glb"];
  for (let i = 0; i < 12; i += 1) solid(rocks[i % rocks.length], 0.7 + random() * 0.9, 0.8, 3);

  // Grass clumps everywhere, including near the spawn; they are decoration only.
  const clumps = ["garden/grass.glb", "garden/grass_large.glb", "garden/grass_leafs_large.glb"];
  for (let i = 0; i < 220; i += 1) {
    const x = (random() * 2 - 1) * (halfSize - 1);
    const z = (random() * 2 - 1) * (halfSize - 1);
    const leafy = i % clumps.length === 2;
    put(clumps[i % clumps.length], x, z, leafy ? 0.16 + random() * 0.10 : 0.22 + random() * 0.16);
  }

  for (const [path, placements] of byModel) {
    const flat = path.includes("grass") || path.includes("path_stone");
    addInstancedProp(parent, path, placements, { castShadow: !flat, tint: path.includes("path_stone") ? "#e8d2b0" : null });
  }
  return { obstacles, halfSize };
}
