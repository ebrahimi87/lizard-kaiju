import * as THREE from "three";
import {
  addEyes,
  ball,
  createKit,
  finishModel,
  limb,
  nearSpot,
  paintedBall,
  pivot,
  smileOn,
  startModel,
  surfacePoint,
  tube,
  hangingCapsule,
  cone,
} from "./CritterParts.js";
import { createBuddyModel, BUDDY_KINDS } from "./BuddyModels.js";
import { createCageModel } from "./CageModel.js";

// Procedural prey critters in the same toy style as the lizard. Every model:
//   { group, radius, height, update(dt, { speed, state, time }), dispose() }
// group faces +Z and rests on y = 0. States: "idle", "move", "flee", "stunned".
//
//   createCritterModel(kind, { shiny })
//     └─ BUILDERS[kind](shiny) → parts (CritterParts.js) → finishModel()
//
// Buddies (cat, dog, horse) live in BuddyModels.js; the cage in CageModel.js.

export const CRITTER_KINDS = ["ladybug", "beetle", "butterfly", "grasshopper", "frog", "mouse", "chicken", "crab", "fish", "drone"];
export { BUDDY_KINDS, createBuddyModel, createCageModel };

const v = (x, y, z) => new THREE.Vector3(x, y, z);

// Six bent insect legs on hip pivots. zs lists hip positions from front to back.
function addInsectLegs(parent, material, { y, x, zs, reach, radius, knee = 0.03 }) {
  const legs = [];
  zs.forEach((z, i) => {
    const angle = ((zs.length - 1) / 2 - i) * 0.55; // front legs reach forward, back legs back
    for (const side of [-1, 1]) {
      const hip = pivot(parent, side * x, y, z);
      const dx = side * Math.cos(angle);
      const dz = Math.sin(angle);
      const kneePoint = v(dx * reach * 0.45, knee, dz * reach * 0.45);
      const foot = v(dx * reach, -y + radius, dz * reach);
      limb(hip, material, radius, v(0, 0, 0), kneePoint);
      limb(hip, material, radius * 0.85, kneePoint, foot);
      legs.push({ hip, side, offset: ((i + (side > 0 ? 1 : 0)) % 2) * 0.5 });
    }
  });
  return legs;
}

// Tripod scurry: legs swing forward and back and lift during the swing half.
function swingLegs(legs, rig, swing = 0.45, lift = 0.35) {
  for (const leg of legs) {
    const wave = Math.PI * 2 * (rig.phase + leg.offset);
    const scurry = rig.state === "stunned" ? 0.4 : rig.move;
    leg.hip.rotation.y = Math.sin(wave) * swing * scurry * leg.side;
    leg.hip.rotation.z = leg.side * Math.max(0, Math.cos(wave)) * lift * scurry;
  }
}

// Two antennae with ball tips. shape lists points for the +x antenna, relative to base.
function addAntennae(parent, material, tipMaterial, base, shape, radius, tipRadius) {
  return [-1, 1].map((side) => {
    const root = pivot(parent, side * base[0], base[1], base[2]);
    const points = [v(0, 0, 0), ...shape.map(([x, y, z]) => v(side * x, y, z))];
    tube(root, material, points, radius, 0.8, 16);
    const tip = points[points.length - 1];
    ball(root, tipMaterial, tipRadius, tipRadius, tipRadius, tip.x, tip.y, tip.z);
    root.userData.side = side;
    return root;
  });
}

function wiggleAntennae(antennae, rig, amount = 0.15) {
  for (const root of antennae) {
    const side = root.userData.side;
    root.rotation.x = Math.sin(rig.time * 3.1 + side) * amount;
    root.rotation.z = Math.sin(rig.time * 2.3 + side * 2) * amount * side;
  }
}

// Hop cycle shared by the frog and grasshopper: 0 on the ground, 1 at the top.
function hopHeight(rig) {
  return Math.sin(Math.PI * rig.phase) * rig.move;
}

function createLadybug(shiny) {
  const kit = createKit({ shell: "#ff2a1f", spot: "#1d1515", body: "#2a1f1f", leg: "#2a1f1f", mouth: "#ffd6dc", white: "#fff6ea" }, shiny);
  const { group, pose } = startModel("critter-ladybug");
  const body = pivot(pose);
  const painted = kit.painted();
  const spots = [
    [0.5, 0.7, 0.35], [-0.5, 0.7, 0.35],
    [0.65, 0.55, -0.2], [-0.65, 0.55, -0.2],
    [0.3, 0.75, -0.6], [-0.3, 0.75, -0.6],
  ];
  paintedBall(body, kit, painted, [0.135, 0.105, 0.14], [0, 0.085, -0.03], (x, y, z) => {
    if (y < -0.15) return "body";
    if (Math.abs(x) < 0.05 && z < 0.8) return "spot";
    return nearSpot(spots, x, y, z, 0.24) ? "spot" : "shell";
  });
  const headC = [0, 0.08, 0.12];
  const headR = [0.075, 0.065, 0.07];
  ball(body, kit.m.body, headR[0], headR[1], headR[2], ...headC);
  // Two white dabs on the head, like a real ladybug's face markings.
  for (const side of [-1, 1]) {
    const p = surfacePoint(headC, headR, side * 0.75, 0.55, 0.3, 0.92);
    ball(body, kit.m.white, 0.022, 0.012, 0.02, p.x, p.y, p.z);
  }
  const eyes = addEyes(kit, body, { size: 0.034, x: 0.036, y: 0.1, z: 0.168, iris: "#3a2410", pupil: 1.2, look: [0.45, 0.35, 0.9] });
  smileOn(body, kit.m.mouth, headC, headR, { elevation: -0.25, halfAngle: 0.45, sag: 0.18, thickness: 0.006 });
  const antennae = addAntennae(body, kit.m.leg, kit.m.body, [0.025, 0.135, 0.14], [[0.02, 0.04, 0.03], [0.05, 0.065, 0.045]], 0.0065, 0.014);
  const legs = addInsectLegs(body, kit.m.leg, { y: 0.05, x: 0.07, zs: [0.06, -0.02, -0.1], reach: 0.12, radius: 0.012 });

  return finishModel({
    kit, group, pose, eyes, radius: 0.17, height: 0.2, stride: 0.12,
    headTop: v(0, 0.19, 0.04),
    animate(rig) {
      swingLegs(legs, rig);
      wiggleAntennae(antennae, rig);
      body.position.y = Math.abs(Math.sin(rig.phase * Math.PI * 2)) * 0.006 * rig.move;
      body.rotation.z = Math.sin(rig.phase * Math.PI * 2) * 0.05 * rig.move;
    },
  });
}

function createBeetle(shiny) {
  const kit = createKit({ shell: "#8a3cff", shine: "#41d9ff", body: "#2d1f52", leg: "#2d1f52", mouth: "#ffd6dc" }, shiny);
  const { group, pose } = startModel("critter-beetle");
  const body = pivot(pose);
  const painted = kit.painted();
  paintedBall(body, kit, painted, [0.14, 0.1, 0.15], [0, 0.095, -0.05], (x, y, z) => {
    if (y < -0.15) return "body";
    if (Math.abs(x) < 0.04 && z < 0.9) return "body";
    return Math.abs(Math.abs(x) - 0.5) < 0.1 && y > 0.25 && z < 0.7 ? "shine" : "shell";
  });
  ball(body, kit.m.shell, 0.105, 0.08, 0.07, 0, 0.1, 0.1);
  const headC = [0, 0.085, 0.165];
  const headR = [0.07, 0.06, 0.06];
  ball(body, kit.m.body, headR[0], headR[1], headR[2], ...headC);
  // A short, rounded rhino horn between the eyes.
  const horn = [v(0, 0.12, 0.19), v(0, 0.17, 0.235), v(0, 0.22, 0.235)];
  tube(body, kit.m.shell, horn, 0.022, 0.55, 16);
  ball(body, kit.m.shell, 0.013, 0.013, 0.013, 0, 0.22, 0.235);
  const eyes = addEyes(kit, body, { size: 0.03, x: 0.048, y: 0.1, z: 0.198, iris: "#3a2410", pupil: 1.2, look: [0.6, 0.3, 0.8] });
  smileOn(body, kit.m.mouth, headC, headR, { elevation: -0.3, halfAngle: 0.4, sag: 0.15, thickness: 0.006 });
  const antennae = addAntennae(body, kit.m.leg, kit.m.leg, [0.055, 0.1, 0.2], [[0.04, 0.02, 0.04], [0.07, 0.04, 0.04]], 0.006, 0.013);
  const legs = addInsectLegs(body, kit.m.leg, { y: 0.06, x: 0.08, zs: [0.08, -0.01, -0.1], reach: 0.14, radius: 0.014 });

  return finishModel({
    kit, group, pose, eyes, radius: 0.19, height: 0.23, stride: 0.14,
    headTop: v(0, 0.2, 0.02),
    animate(rig) {
      swingLegs(legs, rig);
      wiggleAntennae(antennae, rig, 0.12);
      body.position.y = Math.abs(Math.sin(rig.phase * Math.PI * 2)) * 0.006 * rig.move;
      body.rotation.z = Math.sin(rig.phase * Math.PI * 2) * 0.04 * rig.move;
    },
  });
}

// Butterfly wing outline for the +x side in (x outward, y forward) shape space.
function wingShape() {
  const shape = new THREE.Shape();
  shape.moveTo(0.01, 0.03);
  shape.bezierCurveTo(0.06, 0.16, 0.22, 0.2, 0.26, 0.13);
  shape.bezierCurveTo(0.29, 0.07, 0.22, 0.02, 0.16, 0.0);
  shape.bezierCurveTo(0.22, -0.04, 0.23, -0.13, 0.15, -0.15);
  shape.bezierCurveTo(0.08, -0.16, 0.03, -0.09, 0.01, -0.04);
  shape.closePath();
  return shape;
}

const WING_U = 0.3;
const WING_V0 = -0.17;
const WING_V = 0.38;

function paintWing(colors) {
  const size = 256;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext("2d");
  const toCanvas = (x, y) => [(x / WING_U) * size, (1 - (y - WING_V0) / WING_V) * size];
  const path = new Path2D();
  wingShape()
    .getPoints(24)
    .forEach((point, index) => {
      const [px, py] = toCanvas(point.x, point.y);
      if (index === 0) path.moveTo(px, py);
      else path.lineTo(px, py);
    });
  path.closePath();
  const [rootX, rootY] = toCanvas(0, 0);
  const gradient = context.createRadialGradient(rootX, rootY, 10, rootX, rootY, size * 0.9);
  gradient.addColorStop(0, colors.wingIn);
  gradient.addColorStop(0.75, colors.wingOut);
  context.fillStyle = colors.wingEdge;
  context.fillRect(0, 0, size, size);
  context.fillStyle = gradient;
  context.save();
  context.clip(path);
  context.fillRect(0, 0, size, size);
  // Dark border with white dots, the classic cartoon butterfly look.
  context.lineWidth = 26;
  context.strokeStyle = colors.wingEdge;
  context.stroke(path);
  context.fillStyle = colors.dot;
  for (const [x, y, r] of [[0.235, 0.14, 7], [0.26, 0.09, 6], [0.2, 0.17, 6], [0.19, -0.12, 6], [0.21, -0.07, 5], [0.14, -0.145, 5]]) {
    const [px, py] = toCanvas(x, y);
    context.beginPath();
    context.arc(px, py, r, 0, Math.PI * 2);
    context.fill();
  }
  // A big friendly spot on each wing lobe.
  context.fillStyle = colors.wingSpot;
  for (const [x, y, r] of [[0.15, 0.1, 15], [0.12, -0.07, 12]]) {
    const [px, py] = toCanvas(x, y);
    context.beginPath();
    context.arc(px, py, r, 0, Math.PI * 2);
    context.fill();
  }
  context.restore();
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

// Flat wing in the xz plane facing up. The outline is built with y negated so that
// rotateX(-PI/2) turns shape-forward into +z without mirroring the triangles.
function createWingGeometry() {
  const outline = new THREE.Shape(wingShape().getPoints(24).map((point) => new THREE.Vector2(point.x, -point.y)));
  const geometry = new THREE.ShapeGeometry(outline);
  const position = geometry.attributes.position;
  const uv = geometry.attributes.uv;
  for (let i = 0; i < position.count; i += 1) {
    uv.setXY(i, position.getX(i) / WING_U, (-position.getY(i) - WING_V0) / WING_V);
  }
  geometry.rotateX(-Math.PI / 2);
  return geometry;
}

function createButterfly(shiny) {
  const kit = createKit(
    { body: "#3b2b55", wingIn: "#ffd23a", wingOut: "#ff7a1e", wingEdge: "#5a2a7a", wingSpot: "#ff5fa8", dot: "#fff8ec", mouth: "#ffd6dc" },
    shiny,
  );
  const { group, pose } = startModel("critter-butterfly");
  const hover = pivot(pose, 0, 0.3, 0);
  ball(hover, kit.m.body, 0.035, 0.035, 0.11, 0, 0, -0.04);
  ball(hover, kit.m.body, 0.042, 0.04, 0.04, 0, 0, 0.06);
  const headC = [0, 0.012, 0.11];
  const headR = [0.048, 0.046, 0.046];
  ball(hover, kit.m.body, headR[0], headR[1], headR[2], ...headC);
  const eyes = addEyes(kit, hover, { size: 0.03, x: 0.03, y: 0.035, z: 0.138, iris: "#3a2410", pupil: 1.2, look: [0.5, 0.4, 0.85] });
  smileOn(hover, kit.m.mouth, headC, headR, { elevation: -0.3, halfAngle: 0.45, sag: 0.15, thickness: 0.005 });
  const antennae = addAntennae(hover, kit.m.body, kit.m.wingEdge, [0.02, 0.05, 0.13], [[0.02, 0.06, 0.03], [0.05, 0.1, 0.05]], 0.005, 0.014);

  const map = kit.track(paintWing(kit.colors));
  const wingMaterial = kit.track(
    new THREE.MeshPhysicalMaterial({ map, side: THREE.DoubleSide, roughness: 0.5, clearcoat: 0.3, metalness: shiny ? 0.5 : 0 }),
  );
  const wingGeometry = createWingGeometry();
  const wings = [-1, 1].map((side) => {
    const root = pivot(hover, side * 0.02, 0.01, 0);
    const wing = new THREE.Mesh(wingGeometry, wingMaterial);
    wing.scale.x = side;
    wing.castShadow = true;
    root.add(wing);
    root.userData.side = side;
    return root;
  });

  return finishModel({
    kit, group, pose, eyes, radius: 0.24, height: 0.42, stride: 0.4,
    headTop: v(0, 0.36, 0.08),
    animate(rig) {
      const stunned = rig.state === "stunned";
      const rate = stunned ? 3 : 9 + rig.speed * 6;
      const flap = Math.sin(rig.time * rate);
      const height = stunned ? 0.07 : 0.3 + Math.sin(rig.time * 2.2) * 0.04 + flap * 0.012;
      hover.position.y = height;
      hover.rotation.x = rig.move * 0.15;
      for (const wing of wings) {
        const open = stunned ? 0.15 + flap * 0.15 : 0.35 + flap * (0.55 + 0.25 * rig.move);
        wing.rotation.z = wing.userData.side * open;
      }
      wiggleAntennae(antennae, rig, 0.1);
    },
  });
}

function createGrasshopper(shiny) {
  const kit = createKit({ body: "#7fdc2c", belly: "#ecf66a", dark: "#47a51f", leg: "#5cbf22", mouth: "#5a1e1e" }, shiny);
  const { group, pose } = startModel("critter-grasshopper");
  const body = pivot(pose);
  const painted = kit.painted();
  paintedBall(body, kit, painted, [0.065, 0.07, 0.17], [0, 0.12, -0.1], (x, y, z) => {
    if (y < -0.35) return "belly";
    return Math.sin(z * 14) > 0.6 && z < 0.4 ? "dark" : "body";
  });
  ball(body, kit.m.body, 0.07, 0.075, 0.08, 0, 0.14, 0.05);
  // Folded wings make a darker stripe down the back.
  ball(body, kit.m.dark, 0.05, 0.025, 0.17, 0, 0.18, -0.09).rotation.x = -0.12;
  const headC = [0, 0.175, 0.14];
  const headR = [0.085, 0.09, 0.085];
  ball(body, kit.m.body, headR[0], headR[1], headR[2], ...headC);
  const eyes = addEyes(kit, body, { size: 0.042, x: 0.058, y: 0.205, z: 0.178, iris: "#3a2410", pupil: 1.2, look: [0.6, 0.35, 0.8] });
  smileOn(body, kit.m.mouth, headC, headR, { elevation: -0.25, halfAngle: 0.45, sag: 0.18, thickness: 0.007 });
  const antennae = addAntennae(body, kit.m.leg, kit.m.dark, [0.03, 0.25, 0.17], [[0.03, 0.08, 0.0], [0.07, 0.13, -0.07], [0.11, 0.15, -0.15]], 0.006, 0.012);
  const legs = addInsectLegs(body, kit.m.leg, { y: 0.1, x: 0.05, zs: [0.1, 0.03], reach: 0.11, radius: 0.012 });

  // Big folded hind legs: a thick thigh up to the knee, a thin shin back down.
  const hindLegs = [-1, 1].map((side) => {
    const hip = pivot(body, side * 0.065, 0.13, -0.02);
    const knee = v(side * 0.03, 0.1, -0.15);
    const foot = v(side * 0.04, -0.12, -0.1);
    limb(hip, kit.m.body, 0.03, v(0, 0, 0), knee);
    limb(hip, kit.m.leg, 0.014, knee, foot);
    ball(hip, kit.m.leg, 0.022, 0.012, 0.03, foot.x, foot.y, foot.z + 0.015);
    return hip;
  });

  return finishModel({
    kit, group, pose, eyes, radius: 0.22, height: 0.28, stride: 0.3,
    headTop: v(0, 0.27, 0.12),
    animate(rig) {
      const hop = hopHeight(rig);
      body.position.y = hop * 0.14;
      body.rotation.x = -Math.cos(Math.PI * rig.phase) * 0.25 * rig.move;
      for (const hip of hindLegs) hip.rotation.x = hop * 0.7;
      swingLegs(legs, rig, 0.2, 0.1);
      wiggleAntennae(antennae, rig, 0.1);
    },
  });
}

function createFrog(shiny) {
  const kit = createKit({ skin: "#4fd43a", belly: "#f6f08c", spot: "#2f9e2a", blush: "#ff8fb0", mouth: "#5a1e1e" }, shiny);
  const { group, pose } = startModel("critter-frog");
  const body = pivot(pose);
  const painted = kit.painted();
  const bodyC = [0, 0.12, -0.02];
  const bodyR = [0.17, 0.12, 0.19];
  const spots = [[0.3, 0.9, -0.3], [-0.35, 0.85, -0.45], [0.0, 0.9, -0.7], [0.55, 0.6, -0.55], [-0.6, 0.6, -0.2]];
  const belly = paintedBall(body, kit, painted, bodyR, bodyC, (x, y, z) => {
    if (y < -0.25 || (z > 0.55 && y < 0.1)) return "belly";
    return nearSpot(spots, x, y, z, 0.2) ? "spot" : "skin";
  });
  belly.userData.baseScale = belly.scale.clone();
  const eyes = [];
  for (const side of [-1, 1]) {
    ball(body, kit.m.skin, 0.075, 0.07, 0.07, side * 0.085, 0.2, 0.07);
    const p = surfacePoint(bodyC, bodyR, side * 0.72, -0.05, 0.69, 0.98);
    ball(body, kit.m.blush, 0.032, 0.022, 0.012, p.x, p.y, p.z).lookAt(p.x * 3, p.y, p.z * 2);
  }
  eyes.push(...addEyes(kit, body, { size: 0.062, x: 0.09, y: 0.24, z: 0.1, iris: "#3a2410", pupil: 1.15, look: [0.45, 0.45, 0.8] }));
  smileOn(body, kit.m.mouth, bodyC, bodyR, { elevation: 0.05, halfAngle: 0.55, sag: 0.18, thickness: 0.009 });
  // A throat pouch that puffs in and out while idle.
  const throat = ball(body, kit.m.belly, 0.07, 0.04, 0.05, 0, 0.055, 0.12);

  const front = [-1, 1].map((side) => {
    limb(body, kit.m.skin, 0.024, v(side * 0.1, 0.08, 0.1), v(side * 0.13, 0.02, 0.15));
    return ball(body, kit.m.skin, 0.04, 0.014, 0.04, side * 0.14, 0.012, 0.17);
  });
  const back = [-1, 1].map((side) => {
    const hip = pivot(body, side * 0.12, 0.08, -0.1);
    ball(hip, kit.m.skin, 0.065, 0.055, 0.1, side * 0.03, -0.01, 0.0);
    ball(hip, kit.m.skin, 0.055, 0.014, 0.075, side * 0.06, -0.068, 0.09);
    return hip;
  });

  return finishModel({
    kit, group, pose, eyes, radius: 0.22, height: 0.31, stride: 0.35,
    headTop: v(0, 0.3, 0.05),
    animate(rig) {
      const hop = hopHeight(rig);
      body.position.y = hop * 0.16;
      body.rotation.x = -Math.cos(Math.PI * rig.phase) * 0.3 * rig.move;
      for (const hip of back) hip.rotation.x = hop * 0.9;
      for (const hand of front) hand.position.z = 0.17 + hop * 0.03;
      const puff = rig.move < 0.1 ? Math.max(0, Math.sin(rig.time * 3)) : 0;
      throat.scale.set(0.07 + puff * 0.02, 0.04 + puff * 0.025, 0.05 + puff * 0.02);
    },
  });
}

function createMouse(shiny) {
  const kit = createKit({ fur: "#a9a3bd", belly: "#f4eee6", pink: "#ff9fb5", ear: "#ffc4d1", nose: "#ff6f91", whisker: "#4a4458", mouth: "#5a1e1e" }, shiny);
  const { group, pose } = startModel("critter-mouse");
  const body = pivot(pose);
  const painted = kit.painted();
  paintedBall(body, kit, painted, [0.1, 0.095, 0.145], [0, 0.1, -0.06], (x, y) => (y < -0.3 ? "belly" : "fur"));
  const head = pivot(body, 0, 0.14, 0.09);
  const headR = [0.085, 0.08, 0.09];
  ball(head, kit.m.fur, headR[0], headR[1], headR[2], 0, 0, 0);
  ball(head, kit.m.belly, 0.05, 0.042, 0.05, 0, -0.022, 0.065);
  ball(head, kit.m.nose, 0.02, 0.018, 0.018, 0, -0.008, 0.115);
  smileOn(head, kit.m.mouth, [0, -0.022, 0.065], [0.05, 0.042, 0.05], { elevation: -0.25, halfAngle: 0.5, sag: 0.15, thickness: 0.005 });
  const eyes = addEyes(kit, head, { size: 0.03, x: 0.045, y: 0.025, z: 0.07, iris: "#3a2410", pupil: 1.25, look: [0.5, 0.3, 0.85] });
  const ears = [-1, 1].map((side) => {
    const root = pivot(head, side * 0.055, 0.06, -0.01);
    const ear = ball(root, kit.m.fur, 0.065, 0.065, 0.016, side * 0.03, 0.04, 0);
    ball(root, kit.m.ear, 0.044, 0.044, 0.01, side * 0.03, 0.04, 0.01);
    root.rotation.set(-0.15, side * 0.35, -side * 0.35);
    root.userData.side = side;
    return root;
  });
  for (const side of [-1, 1]) {
    for (const lift of [0.012, -0.008]) {
      tube(head, kit.m.whisker, [v(side * 0.035, -0.012, 0.095), v(side * 0.08, lift, 0.1), v(side * 0.12, lift + 0.01, 0.09)], 0.0035, 1, 8);
    }
  }
  const legs = [];
  for (const [z, offset] of [[0.03, 0], [-0.13, 0.5]]) {
    for (const side of [-1, 1]) {
      const hip = pivot(body, side * 0.06, 0.05, z);
      hangingCapsule(hip, kit.m.fur, 0.018, 0.025);
      ball(hip, kit.m.pink, 0.022, 0.012, 0.03, 0, -0.04, 0.01);
      legs.push({ hip, offset: (offset + (side > 0 ? 0.5 : 0)) % 1 });
    }
  }
  const tail = pivot(body, 0, 0.07, -0.19);
  tube(tail, kit.m.pink, [v(0, 0, 0), v(0.04, -0.03, -0.07), v(-0.03, -0.04, -0.13), v(0.02, -0.02, -0.18)], 0.012, 0.45, 20);

  return finishModel({
    kit, group, pose, eyes, radius: 0.2, height: 0.26, stride: 0.16,
    headTop: v(0, 0.26, 0.06),
    animate(rig) {
      const wave = Math.PI * 2 * rig.phase;
      for (const leg of legs) leg.hip.rotation.x = Math.sin(wave + leg.offset * Math.PI * 2) * 0.8 * rig.move;
      body.position.y = Math.abs(Math.sin(wave)) * 0.012 * rig.move;
      tail.rotation.y = Math.sin(rig.time * 4 + wave) * (0.25 + 0.25 * rig.move);
      // Sniffing nose-twitch while idle, ears flop back when running.
      head.rotation.x = Math.sin(rig.time * 9) * 0.03 * (1 - rig.move);
      for (const ear of ears) ear.rotation.x = -0.15 - rig.move * 0.4;
    },
  });
}

function createChicken(shiny) {
  const kit = createKit({ feather: "#fffaf0", wing: "#f3e3c6", comb: "#ff2e2e", beak: "#ffb21e", leg: "#ff9a1a", blush: "#ff9fb0" }, shiny);
  const { group, pose } = startModel("critter-chicken");
  const body = pivot(pose);
  ball(body, kit.m.feather, 0.2, 0.19, 0.23, 0, 0.39, -0.03);
  ball(body, kit.m.feather, 0.12, 0.13, 0.12, 0, 0.5, 0.08);
  for (const [y, z, tilt] of [[0.53, -0.24, -0.7], [0.5, -0.26, -1.0], [0.46, -0.26, -1.3]]) {
    ball(body, kit.m.feather, 0.05, 0.11, 0.035, 0, y, z).rotation.x = tilt;
  }
  const wings = [-1, 1].map((side) => {
    const root = pivot(body, side * 0.165, 0.47, -0.02);
    ball(root, kit.m.wing, 0.04, 0.1, 0.15, side * 0.01, -0.06, -0.03).rotation.x = 0.35;
    root.userData.side = side;
    return root;
  });
  const head = pivot(body, 0, 0.62, 0.11);
  const headR = [0.13, 0.13, 0.13];
  ball(head, kit.m.feather, ...headR, 0, 0, 0);
  for (const [z, y, r] of [[-0.05, 0.12, 0.034], [0.0, 0.135, 0.042], [0.05, 0.12, 0.034]]) {
    ball(head, kit.m.comb, r, r * 1.15, r, 0, y, z);
  }
  const beak = cone(head, kit.m.beak, 0.04, 0.08, 0, -0.02, 0.155);
  beak.rotation.x = Math.PI / 2;
  ball(head, kit.m.comb, 0.024, 0.04, 0.02, 0, -0.08, 0.115);
  const eyes = addEyes(kit, head, { size: 0.045, x: 0.065, y: 0.04, z: 0.1, iris: "#3a2410", pupil: 1.2, look: [0.6, 0.2, 0.8] });
  for (const side of [-1, 1]) {
    const p = surfacePoint([0, 0, 0], headR, side * 0.75, -0.25, 0.6, 0.99);
    ball(head, kit.m.blush, 0.03, 0.02, 0.01, p.x, p.y, p.z).lookAt(p.x * 3, p.y, p.z * 2);
  }
  const legs = [-1, 1].map((side) => {
    const hip = pivot(body, side * 0.08, 0.23, 0);
    limb(hip, kit.m.leg, 0.02, v(0, 0, 0), v(0, -0.205, 0));
    for (const angle of [-0.5, 0, 0.5]) {
      limb(hip, kit.m.leg, 0.014, v(0, -0.212, 0), v(Math.sin(angle) * 0.07, -0.212, Math.cos(angle) * 0.07));
    }
    return { hip, side };
  });

  return finishModel({
    kit, group, pose, eyes, radius: 0.24, height: 0.8, stride: 0.3,
    headTop: v(0, 0.8, 0.1),
    animate(rig) {
      const wave = Math.PI * 2 * rig.phase;
      for (const leg of legs) leg.hip.rotation.x = Math.sin(wave + (leg.side > 0 ? Math.PI : 0)) * 0.6 * rig.move;
      body.position.y = Math.abs(Math.sin(wave)) * 0.02 * rig.move;
      body.rotation.z = Math.sin(wave) * 0.06 * rig.move;
      head.position.z = 0.11 + Math.sin(wave * 2) * 0.03 * rig.move;
      head.rotation.y = Math.sin(rig.time * 1.3) * 0.35 * (1 - rig.move);
      const flapping = rig.state === "flee" || rig.state === "stunned" ? 1 : 0;
      for (const wing of wings) {
        wing.rotation.z = wing.userData.side * (0.05 + flapping * (0.5 + 0.5 * Math.sin(rig.time * 22)));
      }
    },
  });
}

function createCrab(shiny) {
  const kit = createKit({ shell: "#ff7a1a", belly: "#ffc685", spot: "#ffa04a", claw: "#ff6610", leg: "#ff8a2a", mouth: "#5a1e1e" }, shiny);
  const { group, pose } = startModel("critter-crab");
  const body = pivot(pose);
  const painted = kit.painted();
  const shellC = [0, 0.12, 0];
  const shellR = [0.17, 0.085, 0.13];
  const spots = [[0.4, 0.9, -0.1], [-0.4, 0.9, -0.1], [0, 0.9, -0.45], [0.65, 0.6, 0.25], [-0.65, 0.6, 0.25]];
  paintedBall(body, kit, painted, shellR, shellC, (x, y, z) => {
    if (y < -0.2) return "belly";
    return nearSpot(spots, x, y, z, 0.18) ? "spot" : "shell";
  });
  for (const side of [-1, 1]) limb(body, kit.m.leg, 0.016, v(side * 0.05, 0.17, 0.07), v(side * 0.065, 0.24, 0.1));
  const eyes = addEyes(kit, body, { size: 0.042, x: 0.065, y: 0.265, z: 0.1, iris: "#3a2410", pupil: 1.2, look: [0.35, 0.35, 0.9] });
  smileOn(body, kit.m.mouth, shellC, shellR, { elevation: 0.0, halfAngle: 0.4, sag: 0.2, thickness: 0.008 });
  const claws = [-1, 1].map((side) => {
    const arm = pivot(body, side * 0.13, 0.11, 0.07);
    limb(arm, kit.m.leg, 0.028, v(0, 0, 0), v(side * 0.08, 0.03, 0.06));
    ball(arm, kit.m.claw, 0.065, 0.05, 0.075, side * 0.1, 0.035, 0.13);
    const finger = pivot(arm, side * 0.1, 0.06, 0.16);
    ball(finger, kit.m.claw, 0.032, 0.022, 0.055, side * 0.01, 0.006, 0.04);
    arm.userData.side = side;
    arm.userData.finger = finger;
    return arm;
  });
  const legs = addInsectLegs(body, kit.m.leg, { y: 0.1, x: 0.13, zs: [0.0, -0.05, -0.1], reach: 0.17, radius: 0.016, knee: 0.04 });

  return finishModel({
    kit, group, pose, eyes, radius: 0.28, height: 0.3, stride: 0.15,
    headTop: v(0, 0.3, 0.05),
    animate(rig) {
      swingLegs(legs, rig, 0.35, 0.4);
      body.position.y = Math.abs(Math.sin(rig.phase * Math.PI * 2)) * 0.01 * rig.move;
      body.rotation.z = Math.sin(rig.phase * Math.PI * 2) * 0.06 * rig.move;
      const raised = rig.state === "flee" ? 1 : 0;
      for (const arm of claws) {
        const side = arm.userData.side;
        arm.rotation.z = side * (raised * 0.6 + Math.sin(rig.time * 2 + side) * 0.05);
        arm.userData.finger.rotation.x = -Math.max(0, Math.sin(rig.time * (raised ? 14 : 3) + side)) * 0.45;
      }
    },
  });
}

// An extruded fin shape, turned so shape x runs toward the tail (-z) and shape y is up.
function finGeometry(points, depth) {
  const shape = new THREE.Shape();
  shape.moveTo(points[0][0], points[0][1]);
  for (let i = 1; i < points.length; i += 3) {
    shape.bezierCurveTo(...points[i], ...points[i + 1], ...points[i + 2]);
  }
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: true,
    bevelThickness: depth * 0.6,
    bevelSize: depth * 0.6,
    bevelSegments: 2,
    curveSegments: 10,
  });
  geometry.translate(0, 0, -depth / 2);
  geometry.rotateY(Math.PI / 2);
  return geometry;
}

function createFish(shiny) {
  const kit = createKit({ scale: "#2f8cff", belly: "#eaf7ff", back: "#1c62d6", fin: "#ffcf2e", mouth: "#ff6f91" }, shiny);
  const { group, pose } = startModel("critter-fish");
  const body = pivot(pose, 0, 0.15, 0);
  const painted = kit.painted();
  const bodyC = [0, 0, 0.01];
  const bodyR = [0.13, 0.15, 0.24];
  paintedBall(body, kit, painted, bodyR, bodyC, (x, y, z) => {
    if (y < -0.3) return "belly";
    return y > 0.6 ? "back" : "scale";
  });
  const tail = pivot(body, 0, 0, -0.2);
  const tailFin = new THREE.Mesh(
    finGeometry([[0, 0], [0.06, 0.04], [0.1, 0.13], [0.17, 0.13], [0.13, 0.06], [0.12, -0.06], [0.17, -0.13], [0.1, -0.13], [0.06, -0.04], [0, 0]], 0.018),
    kit.m.fin,
  );
  tailFin.castShadow = true;
  tail.add(tailFin);
  const dorsal = new THREE.Mesh(finGeometry([[-0.1, 0], [-0.05, 0.08], [0.08, 0.1], [0.12, 0.0]], 0.014), kit.m.fin);
  dorsal.position.set(0, 0.13, 0.0);
  dorsal.castShadow = true;
  body.add(dorsal);
  const fins = [-1, 1].map((side) => {
    const root = pivot(body, side * 0.11, -0.05, 0.03);
    ball(root, kit.m.fin, 0.012, 0.035, 0.06, side * 0.01, -0.01, -0.04).rotation.x = -0.5;
    root.userData.side = side;
    return root;
  });
  const eyes = addEyes(kit, body, { size: 0.05, x: 0.085, y: 0.04, z: 0.15, iris: "#3a2410", pupil: 1.15, look: [0.75, 0.25, 0.6] });
  // Puckered pink lips.
  const lips = new THREE.Mesh(new THREE.TorusGeometry(0.022, 0.011, 8, 16), kit.m.mouth);
  lips.position.set(0, -0.03, 0.245);
  body.add(lips);

  return finishModel({
    kit, group, pose, eyes, radius: 0.22, height: 0.4, stride: 0.3,
    headTop: v(0, 0.36, 0.05),
    animate(rig) {
      const rate = 5 + rig.speed * 8;
      const swish = Math.sin(rig.time * rate);
      tail.rotation.y = swish * (0.3 + 0.35 * rig.move);
      body.rotation.y = -swish * 0.06 * (0.5 + rig.move);
      // Out of water it flops a little when standing still.
      body.rotation.z = Math.sin(rig.time * 3) * 0.08 * (1 - rig.move);
      for (const fin of fins) fin.rotation.z = fin.userData.side * (0.2 + Math.sin(rig.time * 6) * 0.25);
    },
  });
}

function createDrone(shiny) {
  const kit = createKit({ shell: "#f2f4fa", accent: "#ff8a1e", visor: "#1d2740", rotor: "#c9ced9", foot: "#59627a" }, shiny);
  const { group, pose } = startModel("critter-drone");
  const hover = pivot(pose, 0, 0.42, 0);
  const glow = kit.track(new THREE.MeshStandardMaterial({ color: "#7ff4ff", emissive: "#3fe6ff", emissiveIntensity: 1.6 }));
  const light = kit.track(new THREE.MeshStandardMaterial({ color: "#ff3b3b", emissive: "#ff2020", emissiveIntensity: 2 }));
  ball(hover, kit.m.shell, 0.15, 0.11, 0.14);
  ball(hover, kit.m.accent, 0.1, 0.055, 0.09, 0, 0.075, -0.01);
  const visorC = [0, -0.005, 0.085];
  const visorR = [0.115, 0.075, 0.07];
  ball(hover, kit.m.visor, ...visorR, ...visorC);
  for (const side of [-1, 1]) {
    const p = surfacePoint(visorC, visorR, side * 0.38, 0.2, 0.9, 0.97);
    ball(hover, glow, 0.02, 0.03, 0.012, p.x, p.y, p.z).lookAt(p.x * 2, p.y, p.z * 2);
  }
  smileOn(hover, glow, visorC, visorR, { elevation: -0.25, halfAngle: 0.35, sag: 0.18, thickness: 0.007 });
  limb(hover, kit.m.foot, 0.008, v(0, 0.1, -0.03), v(0, 0.18, -0.05));
  const beacon = ball(hover, light, 0.022, 0.022, 0.022, 0, 0.19, -0.05);
  for (const side of [-1, 1]) {
    limb(hover, kit.m.foot, 0.012, v(side * 0.06, -0.07, 0.03), v(side * 0.07, -0.12, 0.0));
    limb(hover, kit.m.foot, 0.012, v(side * 0.07, -0.13, -0.06), v(side * 0.07, -0.13, 0.06));
  }
  const propellers = [];
  for (const [sx, sz] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) {
    const end = v(sx * 0.2, 0.02, sz * 0.19);
    limb(hover, kit.m.shell, 0.02, v(sx * 0.08, 0, sz * 0.07), end);
    const guard = new THREE.Mesh(new THREE.TorusGeometry(0.085, 0.013, 8, 28), kit.m.accent);
    guard.rotation.x = Math.PI / 2;
    guard.position.copy(end);
    guard.castShadow = true;
    hover.add(guard);
    ball(hover, kit.m.foot, 0.022, 0.025, 0.022, end.x, end.y + 0.01, end.z);
    const spinner = pivot(hover, end.x, end.y + 0.03, end.z);
    for (const angle of [0, Math.PI / 2]) {
      const blade = ball(spinner, kit.m.rotor, 0.075, 0.005, 0.016);
      blade.rotation.y = angle;
    }
    spinner.userData.direction = sx * sz;
    propellers.push(spinner);
  }

  return finishModel({
    kit, group, pose, eyes: [], radius: 0.3, height: 0.62, stride: 0.5,
    headTop: v(0, 0.58, 0),
    animate(rig) {
      const stunned = rig.state === "stunned";
      hover.position.y = (stunned ? 0.26 : 0.42) + Math.sin(rig.time * 2.5) * 0.025;
      hover.rotation.x = rig.move * 0.25;
      hover.rotation.z = Math.sin(rig.time * 1.7) * 0.04;
      const spin = (stunned ? 8 : 30) * rig.dt;
      for (const spinner of propellers) spinner.rotation.y += spin * spinner.userData.direction;
      beacon.visible = Math.sin(rig.time * 6) > -0.3;
    },
  });
}

const BUILDERS = {
  ladybug: createLadybug,
  beetle: createBeetle,
  butterfly: createButterfly,
  grasshopper: createGrasshopper,
  frog: createFrog,
  mouse: createMouse,
  chicken: createChicken,
  crab: createCrab,
  fish: createFish,
  drone: createDrone,
};

export function createCritterModel(kind, { shiny = false } = {}) {
  return BUILDERS[kind](shiny);
}
