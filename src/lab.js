import * as THREE from "three";
import { createRenderer, pickQuality } from "./render/Renderer.js";
import { buildWorld } from "./world/World.js";
import { FORMS, SKINS, formById } from "./config/forms.js";
import { LizardModel } from "./actors/lizard/LizardModel.js";
import { Random } from "./core/Random.js";

// Art lab: renders the lizard forms in fixed views for screenshot review.
//   lab.html?view=lineup
//   lab.html?view=play&form=gecko&t=2
//   lab.html?view=closeup&form=kaiju&action=roar
//   lab.html?app=critters   (other lab apps live in src/lab/<app>.js)
// t simulates that many seconds with a fixed step, then freezes unless live=1.

const query = new URLSearchParams(window.location.search);
const app = query.get("app");
if (app) {
  await import(`./lab/${app}.js`);
} else {
  await runLizardLab();
}

async function runLizardLab() {
  const view = query.get("view") ?? "lineup";
  const simulateSeconds = Number(query.get("t") ?? 1.3);
  const live = query.get("live") === "1";
  const canvas = document.getElementById("lab-canvas");
  const quality = query.get("quality") ?? pickQuality();
  const graphics = createRenderer(canvas, quality);
  const scene = new THREE.Scene();
  const random = new Random(7);
  const world = await buildWorld(scene, graphics, "garden", () => random.next(), { clearRadius: view === "play" ? 5 : 11 });
  const camera = new THREE.PerspectiveCamera(40, 1, 0.05, 900);

  const actors = [];

  function addLizard(formId, x, z, scale, yaw, motion) {
    const model = new LizardModel(formById(formId), SKINS.ruby);
    model.group.position.set(x, 0, z);
    model.group.scale.setScalar(scale);
    model.group.rotation.y = yaw;
    scene.add(model.group);
    actors.push({ model, motion, scale, path: null });
    return actors[actors.length - 1];
  }

  const focus = new THREE.Vector3();
  let shadowExtent = 8;

  if (view === "lineup") {
    // Title-screen lineup: small gecko in front, the kaiju looming at the back.
    const spots = [
      { x: -3.4, z: 2.4, scale: 1, yaw: 0.95 },
      { x: -1.4, z: 0.9, scale: 1.2, yaw: 1.0 },
      { x: 0.9, z: -0.8, scale: 1.45, yaw: 1.05 },
      { x: 3.4, z: -3.0, scale: 1.9, yaw: 1.1 },
      { x: 6.6, z: -6.4, scale: 2.9, yaw: 0.85 },
    ];
    FORMS.forEach((form, index) => {
      const spot = spots[index];
      const kaiju = index === 4;
      addLizard(form.id, spot.x, spot.z, spot.scale, spot.yaw, { speed: 0, turnRate: 0, mouthOpen: kaiju ? 0.6 : 0, roar: kaiju ? 0.7 : 0, glow: kaiju ? 3 : 0, glowFront: 1.2, lookYaw: 0 });
    });
    focus.set(1.5, 0.8, -1.5);
    camera.position.set(-3.2, 2.6, 9.5);
    camera.lookAt(1.6, 1.6, -1.6);
    shadowExtent = 14;
  } else if (view === "profiles" || view === "tops") {
    // All forms at the same display size: side profiles, or the gameplay top-down angle.
    const top = view === "tops";
    FORMS.forEach((form, index) => {
      const x = (index - 2) * 3.2;
      const scale = 1.25;
      addLizard(form.id, x, 0, scale, top ? 0.4 : Math.PI / 2, { speed: 0, turnRate: 0, mouthOpen: 0, roar: 0, glow: 0, glowFront: 1.2, lookYaw: 0 });
    });
    focus.set(0, 0.5, 0);
    if (top) {
      camera.position.set(0, 9.5, -7);
      camera.lookAt(0, 0, 0.2);
    } else {
      camera.position.set(0, 1.2, 12);
      camera.lookAt(0, 0.75, 0);
    }
    shadowExtent = 10;
  } else if (view === "play") {
    const formId = query.get("form") ?? "gecko";
    const actor = addLizard(formId, 0, 0, 1, 0, { speed: 1.6, turnRate: 0.9, mouthOpen: 0, roar: 0, glow: 0, glowFront: 1.2, lookYaw: 0 });
    actor.path = { radius: 1.8, angle: 0, speed: 1.6 };
    shadowExtent = 6;
  } else if (view === "hero") {
    // One form, framed to its bounding box, seen from the front-left three-quarter.
    const formId = query.get("form") ?? "gecko";
    const roar = query.get("action") === "roar" ? 1 : 0;
    const actor = addLizard(formId, 0, 0, 1, Number(query.get("yaw") ?? 0.9), { speed: 0, turnRate: 0, mouthOpen: roar, roar, glow: roar ? 2 : 0, glowFront: 1.2, lookYaw: 0 });
    const box = new THREE.Box3().setFromObject(actor.model.group);
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3()).length();
    focus.copy(center);
    camera.position.set(center.x + size * 0.15, center.y + size * 0.32, center.z + size * 1.05);
    camera.lookAt(center);
    shadowExtent = size;
  } else if (view === "closeup") {
    const formId = query.get("form") ?? "kaiju";
    const roar = query.get("action") === "roar" ? 1 : 0;
    addLizard(formId, 0, 0, 1, 0.5, { speed: 0, turnRate: 0, mouthOpen: roar, roar, glow: roar ? 2.2 : 0, glowFront: 1.2, lookYaw: 0 });
    const form = formById(formId);
    const headHeight = form.posture === "upright" ? form.hipHeight + form.torso.length * 0.8 : form.hipHeight + 0.2;
    focus.set(0, headHeight * 0.6, 0.3);
    camera.position.set(1.5, headHeight + 0.4, 2.6);
    camera.lookAt(0, headHeight * 0.85, 0.2);
    shadowExtent = 3;
  }

  function stepActors(dt) {
    for (const actor of actors) {
      if (actor.path) {
        const path = actor.path;
        path.angle += (path.speed / path.radius) * dt;
        const x = Math.cos(path.angle) * path.radius;
        const z = Math.sin(path.angle) * path.radius;
        actor.model.group.position.set(x, 0, z);
        // Facing along the circle tangent (counter-clockwise when seen from above).
        actor.model.group.rotation.y = -path.angle;
        actor.motion.turnRate = path.speed / path.radius;
      }
      actor.model.update(dt, { ...actor.motion, speed: actor.motion.speed / actor.scale });
    }
  }

  function placePlayCamera() {
    const actor = actors[0];
    const target = actor.model.group.position;
    // Angled top-down chase view: about 55 degrees down, looking north.
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
    const width = window.innerWidth;
    const height = window.innerHeight;
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    graphics.resize(width, height);
  }
  window.addEventListener("resize", resize);
  resize();

  let last = performance.now();
  function frame(now) {
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;
    if (live) {
      elapsed += dt;
      stepActors(dt);
    }
    if (view === "play") placePlayCamera();
    world.update(elapsed, focus, 0.55 * actors[0].scale, shadowExtent);
    graphics.render(scene, camera);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
  window.__LAB__ = { ready: true, view };
}
