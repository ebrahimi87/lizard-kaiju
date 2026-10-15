import * as THREE from "three";
import { createRenderer, pickQuality } from "../render/Renderer.js";
import { buildWorld } from "../world/World.js";
import { formById, SKINS } from "../config/forms.js";
import { LizardModel } from "../actors/lizard/LizardModel.js";
import { Random } from "../core/Random.js";
import { STAGES } from "../config/stages.js";

// lab.html?app=biomes&biome=swamp&view=play[&live=1&t=2&x=0&z=0]
const query = new URLSearchParams(location.search);
const biome = query.get("biome") ?? "jungle";
const view = query.get("view") ?? "overview";
const live = query.get("live") === "1";
const graphics = createRenderer(document.getElementById("lab-canvas"), query.get("quality") ?? pickQuality());
const scene = new THREE.Scene();
const random = new Random(7);
const world = await buildWorld(scene, graphics, biome, () => random.next());
// An aerial camera is above the swamp's ground-level mist. Lift the fog only
// for layout review; the play view keeps the game's actual fog distances.
if (view === "overview" && scene.fog.near < 120) {
  scene.fog.near = 120;
  scene.fog.far = 260;
}
const stage = STAGES.find((item) => item.biome === biome);
const lizard = new LizardModel(formById(stage.form), SKINS.ruby);
lizard.group.scale.setScalar(stage.baseScale ?? 1);
scene.add(lizard.group);
const camera = new THREE.PerspectiveCamera(stage.camera.fov, 1, 0.05, 900);
const focus = new THREE.Vector3();
const originX = Number(query.get("x") ?? 0);
const originZ = Number(query.get("z") ?? 0);
const motion = { speed: 1.6, turnRate: 0.3, mouthOpen: 0, roar: 0, glow: 0, glowFront: 1.2, lookYaw: 0 };
let elapsed = 0;
function step(dt) {
  elapsed += dt;
  const angle = elapsed * 0.3;
  lizard.group.position.set(originX + Math.sin(angle) * 1.8, 0, originZ + (1 - Math.cos(angle)) * 1.8);
  lizard.group.rotation.y = Math.PI / 2 - angle;
  lizard.update(dt, motion);
}
for (let i = 0; i < Math.round(Number(query.get("t") ?? 1.3) * 60); i += 1) step(1 / 60);
function resize() {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  graphics.resize(innerWidth, innerHeight);
}
addEventListener("resize", () => {
  resize();
  if (!live) frame(performance.now());
});
resize();
window.__LAB__ = {
  ready: false, biome, view,
  obstacles: world.obstacles.length,
  water: world.water?.length ?? 0,
  lava: world.lava?.length ?? 0,
  smashables: world.smashables?.length ?? 0,
  spawnClear: world.obstacles.every((item) => Math.hypot(item.x, item.z) >= 5 + item.radius)
    && (world.smashables ?? []).every((item) => Math.hypot(item.x, item.z) >= 5 + item.radius)
    && (world.water ?? []).every((item) => Math.hypot(item.x, item.z) >= 5 + item.radius),
};
let last = performance.now();
function frame(now) {
  if (live) step(Math.min((now - last) / 1000, 0.05));
  last = now;
  focus.copy(lizard.group.position);
  if (view === "play") {
    // Same high angled camera as the game, at stage growth = 1.
    const zoom = 0.85;
    camera.position.set(focus.x, stage.camera.height * zoom, focus.z - stage.camera.distance * zoom);
    camera.lookAt(focus.x, 0, focus.z + stage.camera.distance * zoom * 0.08);
  } else {
    focus.set(0, 0, 0);
    camera.position.set(world.halfSize * 1.15, world.halfSize * 2.5, -world.halfSize * 1.9);
    camera.lookAt(0, 0, 0);
  }
  world.update(elapsed, focus, 0.6, view === "play" ? 8 : world.halfSize * 1.5);
  // Count the whole frame, including shadows and post-processing passes.
  graphics.renderer.info.autoReset = false;
  graphics.renderer.info.reset();
  graphics.render(scene, camera);
  window.__LAB__.render = { ...graphics.renderer.info.render };
  window.__LAB__.camera = { ...stage.camera, zoom: 0.85, baseScale: stage.baseScale ?? 1 };
  window.__LAB__.ready = true;
  if (live) requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
