import * as THREE from "three";
import { createRenderer, pickQuality } from "../render/Renderer.js";
import { buildWorld } from "../world/World.js";
import { SKINS, formById } from "../config/forms.js";
import { LizardModel } from "../actors/lizard/LizardModel.js";
import { Random } from "../core/Random.js";
import { BUDDY_KINDS, CRITTER_KINDS, createBuddyModel, createCageModel, createCritterModel } from "../actors/critters/CritterModels.js";

// Critter lab: fixed views of the critter, buddy, and cage models for screenshot review.
//   lab.html?app=critters&view=lineup              all critters (add shiny=1 for gold)
//   lab.html?app=critters&view=buddies             cat, dog, horse, with the gecko for scale
//   lab.html?app=critters&view=play&t=2            gameplay camera, critters running around
//   lab.html?app=critters&view=states&breakT=0.3   stunned, shiny, caged, burning cages
//   lab.html?app=critters&view=poses&kind=dog      one buddy in every state
//   lab.html?app=critters&view=closeup&kind=frog&state=stunned&shiny=1
// t simulates that many seconds with a fixed step, then freezes unless live=1.

const query = new URLSearchParams(window.location.search);
const view = query.get("view") ?? "lineup";
const simulateSeconds = Number(query.get("t") ?? 1.3);
const live = query.get("live") === "1";
const shinyAll = query.get("shiny") === "1";
const canvas = document.getElementById("lab-canvas");
const graphics = createRenderer(canvas, query.get("quality") ?? pickQuality());
const scene = new THREE.Scene();
const random = new Random(11);
const world = await buildWorld(scene, graphics, "garden", () => random.next(), { clearRadius: view === "play" ? 5 : 11 });
const camera = new THREE.PerspectiveCamera(40, 1, 0.05, 900);

const actors = [];
const cages = [];
const focus = new THREE.Vector3();
let shadowExtent = 6;
let pushRadius = 4;

function place(model, x, z, yaw, motion, scale = 1) {
  model.group.position.set(x, 0, z);
  model.group.rotation.y = yaw;
  model.group.scale.setScalar(scale);
  scene.add(model.group);
  const actor = { model, motion: { speed: 0, state: "idle", time: 0, ...motion }, path: null, scale };
  actors.push(actor);
  return actor;
}

function addCritter(kind, x, z, yaw, motion = {}, shiny = shinyAll) {
  return place(createCritterModel(kind, { shiny }), x, z, yaw, motion);
}

function addGecko(x, z, yaw, motion = {}) {
  const model = new LizardModel(formById("gecko"), SKINS.ruby);
  const lizardMotion = { speed: 0, turnRate: 0, mouthOpen: 0, roar: 0, glow: 0, glowFront: 1.2, lookYaw: 0, ...motion };
  return place(model, x, z, yaw, lizardMotion);
}

// breakAt: lab time (s) when the fire reaches 1 and the cage falls apart.
function addCage(x, z, burn, scale = 1, breakAt = Infinity) {
  const cage = createCageModel();
  cage.breakAt = breakAt;
  cage.group.position.set(x, 0, z);
  cage.group.scale.setScalar(scale);
  cage.setBurn(burn);
  scene.add(cage.group);
  cages.push(cage);
  return cage;
}

function frame(center, distance, height, lookHeight = 0.2) {
  focus.copy(center);
  camera.position.set(center.x + distance * 0.25, center.y + height, center.z + distance);
  camera.lookAt(center.x, center.y + lookHeight, center.z);
}

if (view === "lineup") {
  // Two rows of five, front-left three-quarter view.
  CRITTER_KINDS.forEach((kind, index) => {
    const row = Math.floor(index / 5);
    const column = index % 5;
    addCritter(kind, (column - 2) * 0.85, row * -0.95, 0.45);
  });
  frame(new THREE.Vector3(0, 0, -0.5), 3.4, 1.9, 0.15);
  shadowExtent = 4;
} else if (view === "buddies") {
  place(createBuddyModel("cat"), -1.7, 0.3, 0.55, {});
  place(createBuddyModel("dog"), -0.4, 0.2, 0.5, {});
  place(createBuddyModel("horse"), 1.5, -0.4, 0.45, {});
  addGecko(-2.9, 0.6, 0.6);
  frame(new THREE.Vector3(-0.4, 0, -0.1), 5.0, 2.4, 0.6);
  shadowExtent = 6;
} else if (view === "play") {
  // The gecko runs a small circle; critters run their own little circles in a ring around it.
  const gecko = addGecko(0, 0, 0, { speed: 1.4, turnRate: 0.9 });
  gecko.path = { cx: 0, cz: 0, radius: 0.7, angle: 0, speed: 1.4 };
  CRITTER_KINDS.forEach((kind, index) => {
    const angle = (index / CRITTER_KINDS.length) * Math.PI * 2;
    const speed = 0.5 + (index % 3) * 0.3;
    const critter = addCritter(kind, 0, 0, 0, { state: index % 4 === 0 ? "flee" : "move", speed }, index === 2);
    critter.path = { cx: Math.cos(angle) * 2.1, cz: Math.sin(angle) * 1.6 + 0.5, radius: 0.3, angle: index, speed };
  });
  pushRadius = 0.55;
  shadowExtent = 6;
} else if (view === "states") {
  // Front row: stunned critters. Middle row: shiny critters. Back: caged buddies and cages
  // burning (0.5) and breaking (1).
  ["ladybug", "frog", "mouse", "chicken", "drone"].forEach((kind, index) => {
    addCritter(kind, (index - 2) * 0.85, 0.9, 0.4, { state: "stunned" }, false);
  });
  ["beetle", "butterfly", "grasshopper", "crab", "fish"].forEach((kind, index) => {
    addCritter(kind, (index - 2) * 0.85, 0, 0.4, { state: "idle" }, true);
  });
  place(createBuddyModel("dog"), -1.9, -1.5, 0.4, { state: "caged" }, 0.9);
  addCage(-1.9, -1.5, 0);
  place(createBuddyModel("cat"), 0, -1.5, 0.4, { state: "caged" }, 0.9);
  addCage(0, -1.5, 0.5);
  addCage(1.9, -1.5, 0.5, 1, simulateSeconds - Number(query.get("breakT") ?? 0.3));
  frame(new THREE.Vector3(0, 0, -0.3), 5.2, 3.4, 0.2);
  shadowExtent = 6;
} else if (view === "poses") {
  const kind = query.get("kind") ?? "dog";
  const states = ["idle", "move", "happy", "action", "caged"];
  const spacing = kind === "horse" ? 2.2 : 1.15;
  const time = Number(query.get("t") ?? 1.3);
  states.forEach((state, index) => {
    const buddy = place(createBuddyModel(kind), (index - 2) * spacing, 0, 0.6, { state, speed: state === "move" ? 1.2 : 0 });
    buddy.offset = index * 0.17 * time;
  });
  frame(new THREE.Vector3(0, 0, 0), spacing * 4.2, spacing * 1.6, spacing * 0.3);
  shadowExtent = spacing * 4;
} else if (view === "closeup") {
  const kind = query.get("kind") ?? "frog";
  const state = query.get("state") ?? "idle";
  const buddy = BUDDY_KINDS.includes(kind);
  const model = buddy ? createBuddyModel(kind) : createCritterModel(kind, { shiny: shinyAll });
  place(model, 0, 0, Number(query.get("yaw") ?? 0.6), { state, speed: Number(query.get("speed") ?? 0) });
  if (query.get("cage") === "1") addCage(0, 0, Number(query.get("burn") ?? 0), kind === "horse" ? 2 : 1);
  const size = Math.max(model.height, model.radius * 2);
  frame(new THREE.Vector3(0, 0, 0), size * 2.6, size * 1.3, model.height * 0.45);
  shadowExtent = size * 2;
}

const top = query.get("top") === "1";
if (top) {
  // Same subjects, seen from the gameplay camera angle.
  camera.position.set(focus.x, focus.y + 5.2, focus.z - 3.8);
  camera.lookAt(focus.x, focus.y + 0.2, focus.z + 0.4);
}

function stepActors(dt) {
  for (const actor of actors) {
    const path = actor.path;
    if (path) {
      path.angle += (path.speed / path.radius) * dt;
      actor.model.group.position.set(path.cx + Math.cos(path.angle) * path.radius, 0, path.cz + Math.sin(path.angle) * path.radius);
      actor.model.group.rotation.y = -path.angle;
      if (actor.motion.turnRate !== undefined) actor.motion.turnRate = path.speed / path.radius;
    }
    actor.motion.time += dt;
    actor.model.update(dt, actor.motion);
  }
  for (const cage of cages) {
    if (elapsed >= cage.breakAt) cage.setBurn(1);
    cage.update(dt);
  }
}

function placePlayCamera() {
  const target = actors[0].model.group.position;
  camera.position.set(target.x, target.y + 5.2, target.z - 3.8);
  camera.lookAt(target.x, target.y + 0.2, target.z + 0.4);
  focus.copy(target);
}

let elapsed = 0;
const step = 1 / 60;
// Poses: stagger each buddy's clock so the animation cycles show different moments.
for (const actor of actors) {
  if (actor.offset) for (let i = 0; i < Math.round(actor.offset / step); i += 1) actor.model.update(step, actor.motion);
}
for (let i = 0; i < Math.round(simulateSeconds / step); i += 1) {
  elapsed += step;
  stepActors(step);
}

function resize() {
  const width = window.innerWidth;
  const height = window.innerHeight;
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  graphics.resize(width, height);
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
  world.update(elapsed, focus, pushRadius, shadowExtent);
  graphics.render(scene, camera);
  requestAnimationFrame(render);
}
requestAnimationFrame(render);
window.__LAB__ = { ready: true, view };
