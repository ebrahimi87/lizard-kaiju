import { addInstancedProp, modelSize } from "../Assets.js";

export const JUNGLE_MODELS = [
  "jungle/tree_palm.glb", "jungle/tree_palm_bend.glb", "jungle/tree_palm_detailed_tall.glb",
  "jungle/plant_flat_short.glb", "jungle/plant_flat_tall.glb", "jungle/crops_bamboo_stage_b.glb",
  "garden/flower_red_a.glb", "garden/flower_yellow_b.glb", "garden/log_large.glb",
  "nature/rock_large_c.glb", "nature/rock_tall_a.glb", "garden/grass_leafs_large.glb",
  "jungle/fern.glb", "garden/flower_purple_b.glb", "garden/plant_bush_detailed.glb",
];

// A sandy winding trail between lush low islands; tall canopy stays at the rim.
export function buildJungle(parent, random, halfSize, clearRadius = 5) {
  const obstacles = [];
  const groups = new Map();
  function put(path, x, z, height, rotation = random() * Math.PI * 2) {
    if (!groups.has(path)) groups.set(path, []);
    groups.get(path).push({ x, z, scale: height / modelSize(path).y, rotation });
  }
  function solid(path, x, z, height, radius) {
    if (Math.hypot(x, z) < clearRadius + radius) return;
    put(path, x, z, height);
    obstacles.push({ x, z, radius });
  }
  const palms = JUNGLE_MODELS.slice(0, 3);
  for (let i = 0; i < 100; i += 1) {
    const side = i % 4;
    const along = -halfSize + (i >> 2) * halfSize * 2 / 24;
    const edge = halfSize + 1 + random() * 3;
    const x = side < 2 ? along : (side === 2 ? -edge : edge);
    const z = side < 2 ? (side === 0 ? -edge : edge) : along;
    put(palms[i % 3], x, z, 8 + random() * 5);
    put("nature/rock_large_c.glb", x, z, 2.6 + random() * 1.2);
  }
  // Two canopy landmarks flank the first clearing; their shadows dapple the trail.
  solid(palms[1], -7.5, 7, 6, 0.6);
  solid(palms[2], 8, 8.5, 6.5, 0.6);
  // A few large silhouettes are visible over the low foreground foliage.
  for (const [x, z] of [[-18, 13], [18, 18], [-22, -14], [23, -12], [-12, 25]]) {
    solid(palms[0], x, z, 7.5, 0.65);
    for (let i = 0; i < 7; i += 1) {
      put("jungle/crops_bamboo_stage_b.glb", x + random() * 3 - 1.5, z + random() * 3 - 1.5, 3.5 + random());
    }
  }
  for (let patch = 0; patch < 62; patch += 1) {
    const z = (random() * 2 - 1) * (halfSize - 4);
    const x = (random() * 2 - 1) * (halfSize - 4);
    if (Math.hypot(x, z) < clearRadius + 1 || Math.abs(x - Math.sin(z * 0.13) * 2) < 4) continue;
    const tall = Math.abs(x) > 18;
    for (let i = 0; i < 6; i += 1) {
      const px = x + random() * 2.5 - 1.25;
      const pz = z + random() * 2.5 - 1.25;
      put(i % 2 ? "jungle/plant_flat_short.glb" : "jungle/plant_flat_tall.glb", px, pz, (tall ? 1.3 : 0.6) + random() * 0.5);
      if (i < 3) put(i % 2 ? "garden/flower_yellow_b.glb" : "garden/flower_red_a.glb", px + 0.4, pz, 0.6 + random() * 0.4);
    }
    if (patch % 4 === 0) solid("nature/rock_large_c.glb", x, z, 0.7 + random() * 0.4, 0.7);
  }
  // Near-spawn flower islands frame the first view without covering the frill.
  for (const side of [-1, 1]) {
    for (let i = 0; i < 12; i += 1) {
      const z = -4 + i * 0.9;
      const x = side * (Math.sqrt(Math.max(0, (clearRadius + 1) ** 2 - z * z)) + random());
      put("jungle/plant_flat_short.glb", x, z, 0.8 + random() * 0.4);
      put("garden/grass_leafs_large.glb", x + side * 0.6, z + 0.3, 0.75);
      put(i % 3 ? "garden/flower_yellow_b.glb" : "garden/flower_red_a.glb", x, z + 0.5, 0.9);
    }
  }
  for (let i = 0; i < 10; i += 1) {
    const x = (i % 2 ? -1 : 1) * (10 + random() * 15);
    const z = (random() * 2 - 1) * 24;
    solid("garden/log_large.glb", x, z, 0.8, 1.2);
  }
  for (const [x, z] of [[-5.4, 0], [5.4, 0], [-4.8, 3.2], [4.8, 3.2], [-4.8, -3.2], [4.8, -3.2]]) {
    if (Math.hypot(x, z) < clearRadius + 0.3) continue;
    put("jungle/fern.glb", x, z, 1.4);
    put("jungle/plant_flat_short.glb", x + Math.sign(x) * 0.6, z, 1.7);
    put("garden/flower_purple_b.glb", x, z + 0.5, 1.3);
    put("garden/flower_red_a.glb", x + Math.sign(x) * 0.4, z - 0.6, 1.1);
  }
  // Leafy banks repeat beside, not across, the winding travel lane. Low
  // ferns and saturated blooms carry the jungle identity in the close camera.
  for (let z = -halfSize + 4; z < halfSize - 3; z += 4.2) {
    for (const side of [-1, 1]) {
      for (let row = 0; row < 3; row += 1) {
        const x = Math.sin(z * 0.13) * 2 + side * (4.4 + row * 4.5);
        if (Math.hypot(x, z) < clearRadius + 1.4) continue;
        put("garden/plant_bush_detailed.glb", x, z, 1.0 + random() * 0.5);
        for (let leaf = 0; leaf < 4; leaf += 1) {
          const px = x + (random() - 0.5) * 3;
          const pz = z + (random() - 0.5) * 2;
          if (Math.hypot(px, pz) < clearRadius + 0.7) continue;
          put(leaf % 2 ? "jungle/fern.glb" : "jungle/plant_flat_short.glb", px, pz, 0.85 + random() * 0.65);
          put(leaf % 2 ? "garden/flower_red_a.glb" : "garden/flower_purple_b.glb", px + side * 0.25, pz + 0.3, 1.0 + random() * 0.45);
        }
      }
    }
  }
  for (const [path, placements] of groups) addInstancedProp(parent, path, placements, {
    castShadow: !path.includes("fern") && !path.includes("plant_flat") && !path.includes("flower"),
    tint: path.includes("purple") ? "#ff85ba" : path.includes("rock") ? "#7f9b59" : null,
  });
  return { obstacles, halfSize };
}
