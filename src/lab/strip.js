import * as THREE from "three";
import { createRenderer } from "../render/Renderer.js";
import { buildWorld } from "../world/World.js";
import { LizardModel } from "../actors/lizard/LizardModel.js";
import { formById, SKINS } from "../config/forms.js";
import { Random } from "../core/Random.js";

// Filmstrip: one lizard form running in place, shown at six consecutive frames
// (left to right, 1/30 s apart) to check the walk cycle for jitter.
//   lab.html?app=strip&form=gecko&speed=4.6&fps=30

const query = new URLSearchParams(window.location.search);
const form = formById(query.get("form") ?? "gecko");
const speed = Number(query.get("speed") ?? 4.6);
const frameStep = 1 / Number(query.get("fps") ?? 30);
const canvas = document.getElementById("lab-canvas");
const graphics = createRenderer(canvas, "high");
const scene = new THREE.Scene();
const random = new Random(3);
const world = await buildWorld(scene, graphics, "garden", () => random.next(), { clearRadius: 14 });
const camera = new THREE.PerspectiveCamera(30, window.innerWidth / window.innerHeight, 0.05, 900);
const size = form.posture === "upright" ? 2.2 : 1.7;
for (let i = 0; i < 6; i += 1) {
  const model = new LizardModel(form, SKINS.ruby);
  model.group.rotation.y = Math.PI / 2;
  model.group.position.set((i - 2.5) * size, 0, 0);
  scene.add(model.group);
  const steps = 60 + i;
  for (let n = 0; n < steps; n += 1) model.update(frameStep, { speed, turnRate: 0, mouthOpen: 0, roar: 0, glow: 0, glowFront: 1.2, lookYaw: 0 });
}
camera.position.set(0, size * 0.45, size * 3.3);
camera.lookAt(0, size * 0.18, 0);
graphics.resize(window.innerWidth, window.innerHeight);
world.update(0, new THREE.Vector3(), 0.1, size * 4);
graphics.render(scene, camera);
window.__LAB__ = { ready: true };
