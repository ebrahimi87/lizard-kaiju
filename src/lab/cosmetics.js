import * as THREE from "three";
import { createRenderer, pickQuality } from "../render/Renderer.js";
import { buildWorld } from "../world/World.js";
import { FORMS, SKINS, formById } from "../config/forms.js";
import { SKIN_LIST } from "../config/cosmetics.js";
import { LizardModel } from "../actors/lizard/LizardModel.js";
import { HATS, attachHat } from "../actors/lizard/Hats.js";
import { Random } from "../core/Random.js";

// Cosmetics lab: hats and skins on the lizard for screenshot review.
//   lab.html?app=cosmetics&view=hats                     every hat on the gecko (HATS order)
//   lab.html?app=cosmetics&view=skins                    every skin on the gecko (SKIN_LIST order)
//   lab.html?app=cosmetics&view=forms&hat=crown&skin=lava  one hat and skin on all 5 forms
//   lab.html?app=cosmetics&view=closeup&form=gecko&hat=dragonHood&skin=ruby&yaw=-0.35&roar=1
//   lab.html?app=cosmetics&view=play&form=kaiju&hat=topHat   gameplay camera, running in a circle
// Grids read left to right, front row first. top=1 shows any view from the gameplay angle.
// t simulates that many seconds with a fixed step, then freezes unless live=1.

const query = new URLSearchParams(window.location.search);
const view = query.get("view") ?? "hats";
const simulateSeconds = Number(query.get("t") ?? 1.3);
const live = query.get("live") === "1";
const hatId = query.get("hat") === "none" ? null : query.get("hat") ?? "dragonHood"; // hat=none for a bare head
const skinId = query.get("skin") ?? "ruby";
const canvas = document.getElementById("lab-canvas");
const graphics = createRenderer(canvas, query.get("quality") ?? pickQuality());
const scene = new THREE.Scene();
const random = new Random(5);
const world = await buildWorld(scene, graphics, "garden", () => random.next(), { clearRadius: view === "play" ? 5 : 11 });
const camera = new THREE.PerspectiveCamera(40, 1, 0.05, 900);

const actors = [];
const focus = new THREE.Vector3();
let shadowExtent = 6;

function addLizard(formId, skin, hat, x, z, scale, yaw, motion = {}) {
  const model = new LizardModel(formById(formId), SKINS[skin]);
  attachHat(model, hat);
  model.group.position.set(x, 0, z);
  model.group.scale.setScalar(scale);
  model.group.rotation.y = yaw;
  scene.add(model.group);
  const lizardMotion = { speed: 0, turnRate: 0, mouthOpen: 0, roar: 0, glow: 0, glowFront: 1.2, lookYaw: 0, ...motion };
  const actor = { model, motion: lizardMotion, scale, path: null };
  actors.push(actor);
  return actor;
}

// Rows of geckos, front row nearest the camera.
function addGrid(items, columns, makeActor) {
  const rows = Math.ceil(items.length / columns);
  items.forEach((item, index) => {
    const row = Math.floor(index / columns);
    const column = index % columns;
    const inRow = Math.min(columns, items.length - row * columns);
    makeActor(item, (column - (inRow - 1) / 2) * 1.35, ((rows - 1) / 2 - row) * 1.5);
  });
}

function frame(center, distance, height, lookHeight) {
  focus.copy(center);
  camera.position.set(center.x + distance * 0.18, center.y + height, center.z + distance);
  camera.lookAt(center.x, center.y + lookHeight, center.z);
}

if (view === "hats") {
  addGrid(HATS, 3, (hat, x, z) => addLizard("gecko", skinId, hat.id, x, z, 1.25, 0.35));
  frame(new THREE.Vector3(0, 0, 0), 4.6, 3.0, 0.1);
} else if (view === "skins") {
  addGrid(SKIN_LIST, 4, (skin, x, z) => addLizard("gecko", skin.id, query.get("hat"), x, z, 1.25, 0.6));
  frame(new THREE.Vector3(0, 0, 0), 4.6, 3.0, 0.1);
} else if (view === "forms") {
  FORMS.forEach((form, index) => addLizard(form.id, skinId, hatId, (index - 2) * 2.4, 0, 1.25, 0.55));
  frame(new THREE.Vector3(0, 0, 0), 9, 3.2, 0.7);
  shadowExtent = 9;
} else if (view === "closeup") {
  const formId = query.get("form") ?? "gecko";
  const roar = query.get("roar") === "1" ? 1 : 0;
  const actor = addLizard(formId, skinId, hatId, 0, 0, 1, Number(query.get("yaw") ?? -0.35), { mouthOpen: roar, roar });
  const head = new THREE.Vector3();
  actor.model.update(0, actor.motion);
  actor.model.group.updateMatrixWorld(true);
  actor.model.hatAnchor.getWorldPosition(head);
  const size = formById(formId).head.width * 2.6;
  focus.copy(head);
  camera.position.set(head.x + size * 0.75, head.y + size * 0.85, head.z + size * 0.95);
  camera.lookAt(head.x, head.y, head.z + size * 0.05);
  shadowExtent = 3;
} else if (view === "play") {
  const actor = addLizard(query.get("form") ?? "gecko", skinId, hatId, 0, 0, 1, 0, { speed: 1.6, turnRate: 0.9 });
  actor.path = { radius: 1.8, angle: 0, speed: 1.6 };
}

if (query.get("top") === "1") {
  camera.position.set(focus.x, focus.y + 5.2, focus.z - 3.8);
  camera.lookAt(focus.x, focus.y + 0.2, focus.z + 0.4);
}

function stepActors(dt) {
  for (const actor of actors) {
    const path = actor.path;
    if (path) {
      path.angle += (path.speed / path.radius) * dt;
      actor.model.group.position.set(Math.cos(path.angle) * path.radius, 0, Math.sin(path.angle) * path.radius);
      actor.model.group.rotation.y = -path.angle;
      actor.motion.turnRate = path.speed / path.radius;
    }
    actor.model.update(dt, actor.motion);
    actor.model.hat?.userData.update?.(dt);
  }
}

// Same chase view as the game (see placePlayCamera in src/lab.js).
function placePlayCamera() {
  const target = actors[0].model.group.position;
  camera.position.set(target.x, target.y + 5.2, target.z - 3.8);
  camera.lookAt(target.x, target.y + 0.2, target.z + 0.4);
  focus.copy(target);
}

let elapsed = 0;
const step = 1 / 60;
for (let i = 0; i < Math.round(simulateSeconds / step); i += 1) {
  elapsed += step;
  stepActors(step);
}

function resize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  graphics.resize(window.innerWidth, window.innerHeight);
}
window.addEventListener("resize", resize);
resize();

let last = performance.now();
function render(now) {
  const dt = Math.min((now - last) / 1000, 0.05);
  last = now;
  if (live) {
    elapsed += dt;
    stepActors(dt);
  }
  if (view === "play") placePlayCamera();
  world.update(elapsed, focus, 0.55, shadowExtent);
  graphics.render(scene, camera);
  requestAnimationFrame(render);
}
requestAnimationFrame(render);
window.__LAB__ = { ready: true, view };
