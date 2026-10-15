import * as THREE from "three";
import { createRenderer } from "../render/Renderer.js";
import { buildWorld } from "../world/World.js";
import { Random } from "../core/Random.js";
import { CatcherModel, createNetDome } from "../actors/catcher/CatcherModel.js";
import { LizardModel } from "../actors/lizard/LizardModel.js";
import { formById, SKINS } from "../config/forms.js";

const query = new URLSearchParams(location.search);
const view = query.get("view") ?? "grid";
const graphics = createRenderer(document.getElementById("lab-canvas"), "low");
const scene = new THREE.Scene();
const random = new Random(7);
const world = await buildWorld(scene, graphics, "garden", () => random.next(), { clearRadius: 20, grassCount: 1800 });
const camera = new THREE.PerspectiveCamera(40, 1, 0.05, 200);
const focus = new THREE.Vector3();
const actors = [];
const domes = [];
const states = ["idle", "run", "windup", "swing", "netStuck", "hotPants", "slipping", "dizzy", "cheer", "defeated", "parachute"];
const times = { windup: 0.8, swing: 0.35, defeated: 1.2, slipping: 0.3 };

function label(text, x, y, z) {
  const canvas = document.createElement("canvas");
  canvas.width = 512; canvas.height = 64;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#fff7d8"; ctx.fillRect(0, 0, 512, 64);
  ctx.fillStyle = "#4c382b"; ctx.font = "bold 34px sans-serif";
  ctx.textAlign = "center"; ctx.fillText(text, 256, 45);
  const map = new THREE.CanvasTexture(canvas);
  map.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map, depthTest: false }));
  sprite.position.set(x, y, z); sprite.scale.set(2.2, 0.275, 1);
  scene.add(sprite);
}

function addCatcher(state, x, z, yaw = -0.35) {
  const model = new CatcherModel();
  model.group.position.set(x, 0, z); model.group.rotation.y = yaw;
  scene.add(model.group);
  const motion = { state, speed: state === "run" || state === "hotPants" ? 1.8 : 0, stateTime: 0 };
  actors.push({ model, motion, finalTime: times[state] ?? 1.1 });
  return model;
}

if (view === "grid") {
  states.forEach((state, i) => {
    const x = (i % 4 - 1.5) * 3.4;
    const z = (Math.floor(i / 4) - 1) * 5.5;
    addCatcher(state, x, z, 0.35);
    label(state, x, 0.1, z + 1.7);
  });
  camera.position.set(0, 13, 16.5); camera.lookAt(0, 0.7, 0);
} else if (view === "play") {
  addCatcher("run", -1.5, 0, Math.PI * 0.82);
  addCatcher("windup", 1.5, 0, Math.PI * 0.82);
  label("run", -1.5, 0.1, -1.7); label("windup", 1.5, 0.1, -1.7);
  camera.position.set(0, 7.8, -5.7); camera.lookAt(0, 0.2, 0.4);
} else if (view === "dome") {
  for (let i = 0; i < 3; i++) {
    const x = (i - 1) * 3.1;
    const model = new LizardModel(formById("gecko"), SKINS.ruby);
    model.group.position.x = x;
    model.group.scale.setScalar(1);
    model.group.rotation.y = 0.6;
    scene.add(model.group);
    const dome = createNetDome();
    const anchor = new THREE.Group(); anchor.position.x = x; anchor.add(dome.group); scene.add(anchor);
    domes.push({ dome, struggle: i === 1 ? 1 : 0, burst: i === 2 });
    label(["caught", "struggle", "burst · 0.3 s"][i], x, 0.1, 1.4);
  }
  camera.position.set(0.8, 5.6, 10); camera.lookAt(0, 0.4, 0);
} else {
  const state = query.get("state") ?? "idle";
  addCatcher(state, 0, 0);
  camera.position.set(-3.1, state === "parachute" ? 3.7 : 2.7, state === "parachute" ? 6.5 : 5.4);
  camera.lookAt(0, state === "parachute" ? 1.7 : 1, 0.15);
  label(state, 0, 0.1, 1.9);
}

for (let i = 0; i < 90; i++) {
  for (const actor of actors) {
    actor.motion.stateTime = actor.finalTime * Math.min(1, (i + 1) / 60);
    actor.model.update(1 / 60, actor.motion);
  }
}
for (const item of domes) {
  for (let i = 0; i < (item.burst ? 18 : 60); i++) item.dome.update(1 / 60, item);
}
function resize() {
  camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
  graphics.resize(innerWidth, innerHeight);
}
window.addEventListener("resize", resize); resize();
let last = performance.now();
let elapsed = 1.5;
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  if (query.get("live") === "1") {
    elapsed += dt;
    for (const actor of actors) { actor.motion.stateTime += dt; actor.model.update(dt, actor.motion); }
    for (const item of domes) item.dome.update(dt, item);
  }
  world.update(elapsed, focus, 12, view === "grid" ? 14 : 7);
  graphics.render(scene, camera);
  window.__LAB__ = { ready: true, view, actors, domes };
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
