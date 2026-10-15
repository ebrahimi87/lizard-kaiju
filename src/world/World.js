import { createLighting } from "../render/Lighting.js";
import { createSky } from "./Sky.js";
import { createGround, createGrass, createPools } from "./Ground.js";
import { BIOMES } from "../config/biomes.js";
import { loadModels } from "./Assets.js";
import { GARDEN_MODELS, buildGarden } from "./biomes/Garden.js";
import { JUNGLE_MODELS, buildJungle } from "./biomes/Jungle.js";
import { SWAMP_MODELS, buildSwamp } from "./biomes/Swamp.js";
import { VOLCANO_MODELS, buildVolcano } from "./biomes/Volcano.js";
import { CITY_MODELS, buildCity } from "./biomes/City.js";

// Builds everything static for one stage: sky, ground, grass, lights, and biome props.
//   buildWorld(scene, graphics, "garden", random, { clearRadius: 5 })
//     → { mood, lighting, grass, obstacles, halfSize, water?, lava?, smashables?, update(...) }
// grass is null in paved/rocky worlds. Layout extras stay available to gameplay.

const BIOME_BUILDERS = {
  garden: { models: GARDEN_MODELS, build: buildGarden, halfSize: 30 },
  jungle: { models: JUNGLE_MODELS, build: buildJungle, halfSize: 32 },
  swamp: { models: SWAMP_MODELS, build: buildSwamp, halfSize: 34 },
  volcano: { models: VOLCANO_MODELS, build: buildVolcano, halfSize: 34 },
  city: { models: CITY_MODELS, build: buildCity, halfSize: 32 },
};

export async function buildWorld(scene, graphics, biomeId, random, { clearRadius = 5, grassCount = null } = {}) {
  const mood = BIOMES[biomeId];
  const builder = BIOME_BUILDERS[biomeId];
  await loadModels(builder.models);
  createSky(scene, mood, 400);
  createGround(scene, mood, 600);
  const layout = builder.build(scene, random, builder.halfSize, clearRadius);
  const { halfSize } = layout;
  const waterSurface = layout.water ? createPools(scene, mood, layout.water) : null;
  const lavaSurface = layout.lava ? createPools(scene, mood, layout.lava, true) : null;
  const count = Math.round((grassCount ?? (graphics.quality.shadowSize >= 2048 ? 9000 : 6000)) * (mood.grassDensity ?? 1));
  const grass = count > 0 ? createGrass(scene, mood, { width: halfSize * 2, depth: halfSize * 2 }, count, random, layout.water) : null;
  const lighting = createLighting(scene, graphics.environment, mood, graphics.quality.shadowSize);

  function update(time, focus, pushRadius, shadowExtent) {
    lighting.follow(focus, shadowExtent);
    grass?.update(time, focus.x, focus.z, pushRadius);
    waterSurface?.update(time);
    lavaSurface?.update(time);
    layout.updateDetails?.(time);
  }

  return { ...layout, mood, lighting, grass, update };
}
