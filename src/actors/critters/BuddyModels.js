import * as THREE from "three";
import {
  addEyes,
  ball,
  cone,
  createKit,
  createStarGeometry,
  finishModel,
  lerp,
  limb,
  paintedBall,
  pivot,
  smileOn,
  smoothstep,
  startModel,
  surfacePoint,
  tube,
} from "./CritterParts.js";

// Buddy animals (friends, never prey): a chibi cat, dog, and pony on one shared
// four-legged rig. States: "idle", "move", "happy", "action", "caged".
//
//   createBuddyModel(kind)
//     ├─ buildRig(kit, spec)      torso pivot at the back hips, legs, neck pivot, tail chain
//     ├─ decorateCat/Dog/Horse    head, ears, face, mane
//     └─ animateBuddy(rig, parts) walk, sit, hop-and-spin, species action
//
// All positions in the builders are absolute model coordinates: the "frame" groups undo
// their pivot offsets, so a part placed at (x, y, z) sits there in the rest pose.

export const BUDDY_KINDS = ["cat", "dog", "horse"];

const v = (x, y, z) => new THREE.Vector3(x, y, z);

// A pivot at an absolute point plus a child frame that cancels the offset.
function framedPivot(parentFrame, x, y, z) {
  const root = pivot(parentFrame, x, y, z);
  const frame = pivot(root, -x, -y, -z);
  return { root, frame };
}

// A chain of capsules on nested pivots: tails that curl and wag.
function addChain(parent, materials, { start, count, length, radius, taper }) {
  const base = pivot(parent, start.x, start.y, start.z);
  const joints = [];
  let joint = base;
  for (let i = 0; i < count; i += 1) {
    const r = radius * lerp(1, taper, i / Math.max(count - 1, 1));
    const capsule = new THREE.Mesh(new THREE.CapsuleGeometry(r, length, 6, 12), materials(i));
    capsule.position.y = length / 2;
    capsule.castShadow = true;
    joint.add(capsule);
    joints.push(joint);
    joint = pivot(joint, 0, length, 0);
  }
  return joints;
}

function heartGeometry(size) {
  const s = size;
  const shape = new THREE.Shape();
  shape.moveTo(0, -s);
  shape.bezierCurveTo(-s * 0.2, -s * 0.6, -s * 1.1, -s * 0.2, -s * 1.0, s * 0.35);
  shape.bezierCurveTo(-s * 0.9, s * 0.95, -s * 0.15, s * 0.95, 0, s * 0.45);
  shape.bezierCurveTo(s * 0.15, s * 0.95, s * 0.9, s * 0.95, s * 1.0, s * 0.35);
  shape.bezierCurveTo(s * 1.1, -s * 0.2, s * 0.2, -s * 0.6, 0, -s);
  const geometry = new THREE.ExtrudeGeometry(shape, { depth: s * 0.3, bevelEnabled: true, bevelThickness: s * 0.15, bevelSize: s * 0.15, bevelSegments: 2 });
  geometry.translate(0, 0, -s * 0.15);
  return geometry;
}

// Little hearts that float up while happy.
function addHearts(kit, parent, top, size) {
  const material = kit.track(new THREE.MeshStandardMaterial({ color: "#ff3b6b", emissive: "#ff2050", emissiveIntensity: 0.6, roughness: 0.35 }));
  const geometry = heartGeometry(size);
  return [0, 1, 2].map((i) => {
    const heart = new THREE.Mesh(geometry, material);
    heart.userData.offset = i / 3;
    heart.userData.x = (i - 1) * size * 2.2;
    heart.userData.top = top;
    heart.visible = false;
    parent.add(heart);
    return heart;
  });
}

// Shared rig: torso pivot at the back hips so sitting and rearing rotate around them.
function buildRig(kit, spec) {
  const { group, pose } = startModel(`buddy-${spec.kind}`);
  const hip = spec.hip;
  const torso = framedPivot(pose, 0, hip.y, hip.z);
  paintedBall(torso.frame, kit, kit.painted(), spec.torso.radii, spec.torso.center, spec.torso.paint);
  const legs = [];
  for (const front of [true, false]) {
    for (const side of [-1, 1]) {
      const z = front ? spec.legs.frontZ : hip.z;
      const root = pivot(torso.frame, side * spec.legs.x, hip.y, z);
      const r = spec.legs.radius;
      const length = hip.y - spec.legs.foot;
      limb(root, kit.m[spec.legs.material], r, v(0, 0, 0), v(0, -length, 0));
      spec.legs.addFoot(root, -hip.y, side);
      legs.push({ root, front, side });
    }
  }
  const neck = framedPivot(torso.frame, spec.neck.x, spec.neck.y, spec.neck.z);
  return { group, pose, torso: torso.root, torsoFrame: torso.frame, legs, neck: neck.root, head: neck.frame, hipY: hip.y };
}

function addPaw(kit, material, r) {
  return (root, groundY, side) => {
    ball(root, kit.m[material], r * 1.2, r * 0.75, r * 1.35, side * r * 0.1, groundY + r * 0.72, r * 0.35);
  };
}

function addHoof(kit, r) {
  return (root, groundY) => {
    const hoof = new THREE.Mesh(new THREE.CylinderGeometry(r * 1.05, r * 1.18, r * 0.75, 18), kit.m.hoof);
    hoof.position.y = groundY + r * 0.375;
    hoof.castShadow = true;
    root.add(hoof);
  };
}

// Cone ear with a pink inside, on a pivot so it can droop.
function addConeEar(kit, head, side, { x, y, z, radius, height, tilt, color, inner }) {
  const root = pivot(head, side * x, y, z);
  const outer = cone(root, kit.m[color], radius, height, 0, height / 2, 0, 16);
  outer.scale.z = 0.6;
  const pink = cone(root, kit.m[inner], radius * 0.6, height * 0.7, 0, height * 0.4, radius * 0.3, 16);
  pink.scale.z = 0.35;
  root.rotation.set(-0.1, 0, -side * tilt);
  root.userData.side = side;
  root.userData.tilt = tilt;
  return root;
}

function addBlush(kit, parent, c, r, side, direction) {
  const p = surfacePoint(c, r, side * direction[0], direction[1], direction[2], 0.99);
  const blush = ball(parent, kit.m.blush, r[0] * 0.16, r[1] * 0.11, 0.008, p.x, p.y, p.z);
  blush.lookAt(p.clone().add(v(side * direction[0], direction[1], direction[2])));
}

function createCat() {
  const kit = createKit({
    fur: "#ff9a3c", stripe: "#e2651c", cream: "#fff2dc", pink: "#ffa3b8", nose: "#ff7090", blush: "#ff9fb4", mouth: "#5a1e1e", whisker: "#6a4030",
  });
  const spec = {
    kind: "cat",
    hip: { y: 0.21, z: -0.17 },
    torso: {
      radii: [0.14, 0.13, 0.23],
      center: [0, 0.27, -0.05],
      paint: (x, y, z) => (y < -0.35 ? "cream" : y > 0.1 && Math.sin(z * 9 + 0.6) > 0.55 ? "stripe" : "fur"),
    },
    legs: { x: 0.078, frontZ: 0.1, radius: 0.042, foot: 0.032, material: "fur" },
    neck: { x: 0, y: 0.34, z: 0.12 },
  };
  spec.legs.addFoot = addPaw(kit, "cream", 0.042);
  const parts = buildRig(kit, spec);
  const { head } = parts;
  const headC = [0, 0.46, 0.17];
  const headR = [0.19, 0.165, 0.165];
  paintedBall(head, kit, kit.painted(), headR, headC, (x, y, z) => {
    if (y < -0.4 && z > 0.2) return "cream";
    return y > 0.55 && Math.abs(x) < 0.3 && Math.abs(Math.abs(x) - 0.13) > 0.07 ? "stripe" : "fur";
  });
  for (const side of [-1, 1]) {
    ball(head, kit.m.cream, 0.048, 0.038, 0.036, side * 0.036, 0.405, 0.305);
    addBlush(kit, head, headC, headR, side, [0.72, -0.2, 0.65]);
    for (const lift of [0.01, -0.012]) {
      tube(head, kit.m.whisker, [v(side * 0.07, 0.41, 0.315), v(side * 0.15, 0.41 + lift, 0.31), v(side * 0.22, 0.415 + lift * 2, 0.28)], 0.004, 1, 8);
    }
  }
  ball(head, kit.m.cream, 0.035, 0.026, 0.03, 0, 0.375, 0.295);
  ball(head, kit.m.nose, 0.024, 0.017, 0.014, 0, 0.432, 0.33);
  const eyes = addEyes(kit, head, { size: 0.06, x: 0.078, y: 0.485, z: 0.29, iris: "#3fae3a", pupil: 1.25, look: [0.3, 0.15, 0.95] });
  const ears = [-1, 1].map((side) =>
    addConeEar(kit, head, side, { x: 0.1, y: 0.565, z: 0.13, radius: 0.07, height: 0.13, tilt: 0.38, color: "fur", inner: "pink" }),
  );
  const tail = addChain(parts.torsoFrame, (i) => (i % 2 ? kit.m.stripe : kit.m.fur), { start: v(0, 0.3, -0.26), count: 8, length: 0.05, radius: 0.03, taper: 0.85 });
  const hearts = addHearts(kit, parts.pose, 0.72, 0.035);

  return finishModel({
    kit, group: parts.group, pose: parts.pose, eyes, radius: 0.3, height: 0.68, stride: 0.32,
    headTop: v(0, 0.66, 0.15),
    animate(rig) {
      const look = animateBuddy(rig, parts, { earDroop: ears, hearts }, catAction);
      for (let i = 0; i < tail.length; i += 1) {
        const sway = Math.sin(rig.time * 2.2 - i * 0.6) * 0.12;
        tail[i].rotation.x = i === 0 ? -1.25 + look.tailDroop * 0.9 : (0.24 + sway * 0.5) * (1 - look.tailDroop * 0.9);
        tail[i].rotation.z = i === 0 ? sway * 2 + look.wag : sway * 0.3;
      }
    },
  });
}

function createDog() {
  const kit = createKit({
    fur: "#eaa44c", cream: "#fff3dc", ear: "#a15f2c", nose: "#2a1a14", collar: "#ff2a2a", tag: "#ffd23a", tongue: "#ff7a95", mouth: "#5a1e1e", blush: "#ff9fb4",
  });
  const spec = {
    kind: "dog",
    hip: { y: 0.25, z: -0.2 },
    torso: {
      radii: [0.165, 0.155, 0.28],
      center: [0, 0.31, -0.05],
      paint: (x, y, z) => (y < -0.4 || (z > 0.55 && y < 0.35) ? "cream" : "fur"),
    },
    legs: { x: 0.09, frontZ: 0.13, radius: 0.052, foot: 0.04, material: "fur" },
    neck: { x: 0, y: 0.42, z: 0.15 },
  };
  spec.legs.addFoot = addPaw(kit, "cream", 0.052);
  const parts = buildRig(kit, spec);
  const { head } = parts;
  const headC = [0, 0.56, 0.21];
  const headR = [0.2, 0.185, 0.185];
  ball(head, kit.m.fur, ...headR, ...headC);
  const muzzleC = [0, 0.49, 0.36];
  const muzzleR = [0.11, 0.08, 0.1];
  ball(head, kit.m.cream, ...muzzleR, ...muzzleC);
  ball(head, kit.m.nose, 0.042, 0.03, 0.028, 0, 0.53, 0.455);
  // Lower jaw with a tongue; it drops open for barks and happy panting.
  const jaw = pivot(head, 0, 0.46, 0.3);
  ball(jaw, kit.m.mouth, 0.075, 0.03, 0.06, 0, 0.0, 0.08);
  ball(jaw, kit.m.cream, 0.08, 0.035, 0.075, 0, -0.022, 0.085);
  ball(jaw, kit.m.tongue, 0.042, 0.014, 0.055, 0, 0.0, 0.11);
  const eyes = addEyes(kit, head, { size: 0.062, x: 0.085, y: 0.6, z: 0.355, iris: "#5a3010", pupil: 1.3, look: [0.3, 0.2, 0.95] });
  for (const side of [-1, 1]) addBlush(kit, head, headC, headR, side, [0.75, -0.25, 0.6]);
  const ears = [-1, 1].map((side) => {
    const root = pivot(head, side * 0.165, 0.67, 0.19);
    ball(root, kit.m.ear, 0.045, 0.13, 0.075, side * 0.03, -0.1, 0).rotation.z = side * 0.2;
    root.userData.side = side;
    return root;
  });
  const collar = new THREE.Mesh(new THREE.TorusGeometry(0.135, 0.026, 10, 32), kit.m.collar);
  collar.position.set(0, 0.42, 0.11);
  collar.rotation.x = Math.PI / 2 - 0.35;
  collar.castShadow = true;
  head.add(collar);
  const tag = new THREE.Mesh(createStarGeometry(5, 0.032, 0.016, 0.01), kit.m.tag);
  tag.position.set(0, 0.34, 0.235);
  tag.rotation.x = -0.3;
  head.add(tag);
  const tail = addChain(parts.torsoFrame, () => kit.m.fur, { start: v(0, 0.37, -0.31), count: 5, length: 0.05, radius: 0.036, taper: 0.6 });
  const hearts = addHearts(kit, parts.pose, 0.85, 0.04);

  return finishModel({
    kit, group: parts.group, pose: parts.pose, eyes, radius: 0.32, height: 0.76, stride: 0.38,
    headTop: v(0, 0.76, 0.2),
    animate(rig) {
      const look = animateBuddy(rig, parts, { hearts }, dogAction);
      const wagSpeed = rig.state === "caged" ? 2 : rig.state === "happy" || rig.state === "action" ? 22 : 9 + rig.move * 6;
      const wag = Math.sin(rig.time * wagSpeed) * lerp(0.6, 0.1, look.tailDroop);
      for (let i = 0; i < tail.length; i += 1) {
        tail[i].rotation.x = i === 0 ? lerp(-0.45, -2.3, look.tailDroop) : 0.12;
        tail[i].rotation.z = i === 0 ? wag : wag * 0.3;
      }
      jaw.rotation.x = look.mouth;
      for (const ear of ears) {
        const side = ear.userData.side;
        ear.rotation.z = side * (0.05 + look.earLift * 0.7 - look.earDroop * 0.1 + Math.sin(rig.time * 9) * 0.08 * rig.move);
        ear.rotation.x = -look.earLift * 0.3;
      }
    },
  });
}

function createHorse() {
  const kit = createKit({
    coat: "#c9874c", cream: "#fff3e2", mane: "#e8322a", hoof: "#5a3a2a", nostril: "#7a4636", pink: "#ffb2bc", blush: "#ff9fb4", mouth: "#5a1e1e",
  });
  const spec = {
    kind: "horse",
    hip: { y: 0.46, z: -0.42 },
    torso: { radii: [0.31, 0.29, 0.58], center: [0, 0.69, -0.08], paint: (x, y) => (y < -0.55 ? "cream" : "coat") },
    legs: { x: 0.17, frontZ: 0.3, radius: 0.11, foot: 0.08, material: "coat" },
    neck: { x: 0, y: 0.85, z: 0.32 },
  };
  spec.legs.addFoot = addHoof(kit, 0.11);
  const parts = buildRig(kit, spec);
  const { head } = parts;
  limb(head, kit.m.coat, 0.18, v(0, 0.82, 0.3), v(0, 1.12, 0.52));
  const headC = [0, 1.26, 0.58];
  const headR = [0.25, 0.25, 0.27];
  paintedBall(head, kit, kit.painted(), headR, headC, (x, y, z) => (Math.abs(x) < 0.17 && z > 0.45 && y > -0.2 ? "cream" : "coat"));
  const muzzleC = [0, 1.13, 0.81];
  const muzzleR = [0.19, 0.16, 0.18];
  ball(head, kit.m.cream, ...muzzleR, ...muzzleC);
  for (const side of [-1, 1]) {
    const p = surfacePoint(muzzleC, muzzleR, side * 0.4, 0.35, 0.85, 0.97);
    ball(head, kit.m.nostril, 0.028, 0.02, 0.012, p.x, p.y, p.z).lookAt(p.x * 2, p.y + 0.3, p.z * 2);
    addBlush(kit, head, headC, headR, side, [0.85, -0.3, 0.45]);
  }
  smileOn(head, kit.m.mouth, muzzleC, muzzleR, { elevation: -0.25, halfAngle: 0.45, sag: 0.15, thickness: 0.011 });
  const eyes = addEyes(kit, head, { size: 0.095, x: 0.15, y: 1.31, z: 0.75, iris: "#5a3010", pupil: 1.25, look: [0.55, 0.2, 0.8] });
  const ears = [-1, 1].map((side) =>
    addConeEar(kit, head, side, { x: 0.13, y: 1.45, z: 0.5, radius: 0.065, height: 0.17, tilt: 0.3, color: "coat", inner: "pink" }),
  );
  // Fluffy red mane: puffs along the neck plus a forelock between the ears.
  const manePoints = [[1.5, 0.52, 0.1], [1.4, 0.4, 0.11], [1.27, 0.32, 0.11], [1.13, 0.26, 0.105], [0.99, 0.2, 0.095], [0.87, 0.14, 0.085]];
  // Two puffs per span so the crest reads as one fluffy ridge from above.
  for (let i = 0; i < manePoints.length * 2 - 1; i += 1) {
    const [y0, z0, r0] = manePoints[Math.floor(i / 2)];
    const [y1, z1, r1] = manePoints[Math.ceil(i / 2)];
    ball(head, kit.m.mane, (r0 + r1) * 0.45, (r0 + r1) * 0.5, (r0 + r1) * 0.5, 0, (y0 + y1) / 2, (z0 + z1) / 2);
  }
  for (const [x, y, z, r] of [[0, 1.51, 0.66, 0.075], [-0.06, 1.48, 0.7, 0.05], [0.06, 1.48, 0.7, 0.05]]) ball(head, kit.m.mane, r, r, r, x, y, z);
  const tail = addChain(parts.torsoFrame, () => kit.m.mane, { start: v(0, 0.86, -0.6), count: 6, length: 0.09, radius: 0.085, taper: 0.55 });
  const hearts = addHearts(kit, parts.pose, 1.75, 0.07);

  return finishModel({
    kit, group: parts.group, pose: parts.pose, eyes, radius: 0.55, height: 1.6, stride: 0.75,
    headTop: v(0, 1.58, 0.55),
    animate(rig) {
      const look = animateBuddy(rig, parts, { earDroop: ears, hearts }, horseAction);
      for (let i = 0; i < tail.length; i += 1) {
        const swish = Math.sin(rig.time * (2 + rig.move * 4) - i * 0.5) * 0.12;
        tail[i].rotation.x = i === 0 ? -2.25 + rig.move * 0.5 - look.tailDroop * 0.4 : 0.1 - rig.move * 0.06;
        tail[i].rotation.z = swish + (i === 0 ? look.wag * 0.4 : 0);
      }
    },
  });
}

// Per-frame pose values that the species actions write into.
const posed = {
  pitch: 0, drop: 0, front: 0, back: 0, headPitch: 0, headYaw: 0, hop: 0, lunge: 0, spin: 0,
  mouth: 0, earLift: 0, earDroop: 0, tailDroop: 0, wag: 0,
};

function dogAction(rig, cycleTime) {
  const c = (cycleTime % 0.6) / 0.6;
  const bark = c < 0.4 ? Math.sin((c / 0.4) * Math.PI) : 0;
  posed.mouth = 0.15 + bark * 0.5;
  posed.hop = bark * 0.05;
  posed.pitch = -bark * 0.12;
  posed.back = bark * 0.12;
  posed.headPitch = -bark * 0.25;
  posed.earLift = bark;
  posed.front = -bark * 0.2;
}

function catAction(rig, cycleTime) {
  const c = (cycleTime % 1.5) / 1.5;
  const crouch = smoothstep(0, 0.25, c) * (1 - smoothstep(0.5, 0.56, c));
  const leap = c > 0.55 && c < 0.85 ? Math.sin(((c - 0.55) / 0.3) * Math.PI) : 0;
  const reach = smoothstep(0.55, 0.7, c) * (1 - smoothstep(0.85, 1, c));
  posed.drop = crouch * 0.05;
  posed.front = -crouch * 0.6 - reach * 0.9;
  posed.back = crouch * 0.5 + reach * 0.8;
  posed.pitch = crouch * 0.12 - leap * 0.35;
  posed.headPitch = -crouch * 0.1;
  posed.hop = leap * 0.2;
  posed.lunge = reach * 0.18;
  posed.wag = crouch * Math.sin(rig.time * 16) * 0.5;
  posed.earLift = -crouch * 0.3;
}

function horseAction(rig, cycleTime) {
  const c = (cycleTime % 2) / 2;
  const up = smoothstep(0, 0.3, c) * (1 - smoothstep(0.7, 1, c));
  posed.pitch = -0.6 * up;
  posed.back = 0.6 * up;
  posed.front = (-1.2 + Math.sin(rig.time * 9) * 0.35) * up;
  posed.headPitch = -0.35 * up;
  posed.mouth = up;
}

const POSED_KEYS = Object.keys(posed);

function resetPosed() {
  for (const key of POSED_KEYS) posed[key] = 0;
}

// Shared buddy animation. Returns the posed values so species code can drive
// tails, ears, and jaws. options: { earDroop: cone ears to droop, hearts }
function animateBuddy(rig, parts, options, action) {
  resetPosed();
  const { state } = rig;
  const wave = Math.PI * 2 * rig.phase;

  if (state === "caged") {
    // Sad sit: rump down, front legs straight, head and ears down, tail limp.
    posed.pitch = -0.5;
    posed.drop = parts.hipY * 0.5;
    posed.back = -0.65;
    posed.front = 0.5;
    posed.headPitch = 0.45 + Math.sin(rig.time * 1.2) * 0.04;
    posed.headYaw = Math.sin(rig.time * 0.5) * 0.2;
    posed.earDroop = 1;
    posed.tailDroop = 1;
  } else if (state === "happy") {
    const c = (rig.stateTime % 1.4) / 1.4;
    posed.hop = Math.abs(Math.sin(rig.stateTime * 7)) * parts.hipY * 0.35;
    posed.spin = smoothstep(0.1, 0.6, c) * Math.PI * 2;
    posed.mouth = 0.35;
    posed.headPitch = -0.15;
    posed.earLift = 0.4 * Math.abs(Math.sin(rig.stateTime * 7));
  } else if (state === "action") {
    action(rig, rig.stateTime);
  } else {
    posed.headYaw = Math.sin(rig.time * 0.7) * 0.25 * (1 - rig.move);
    posed.headPitch = Math.sin(rig.time * 1.6) * 0.03 + Math.sin(wave * 2) * 0.05 * rig.move;
    posed.mouth = 0.08 * rig.move;
  }

  const swing = 0.55 * rig.move;
  for (const leg of parts.legs) {
    const offset = leg.front === leg.side > 0 ? 0 : Math.PI; // trot: diagonal pairs together
    const walk = Math.sin(wave + offset) * swing;
    // front/back already include any counter-rotation for the torso pitch.
    leg.root.rotation.x = walk + (leg.front ? posed.front : posed.back);
  }
  parts.torso.rotation.x = posed.pitch;
  parts.torso.position.y = parts.hipY - posed.drop + Math.abs(Math.sin(wave)) * parts.hipY * 0.06 * rig.move + Math.sin(rig.time * 2.2) * 0.004;
  parts.neck.rotation.set(posed.headPitch - posed.pitch * 0.4, posed.headYaw, 0, "YXZ");
  parts.pose.position.y = posed.hop;
  parts.pose.position.z = posed.lunge;
  parts.pose.rotation.y = posed.spin;

  if (options.earDroop) {
    for (const ear of options.earDroop) {
      const side = ear.userData.side;
      ear.rotation.z = -side * (ear.userData.tilt + posed.earDroop * 0.7 - posed.earLift * 0.2);
      ear.rotation.x = -0.1 - posed.earDroop * 0.3;
    }
  }
  updateHearts(options.hearts, rig, state === "happy");
  return posed;
}

function updateHearts(hearts, rig, show) {
  for (const heart of hearts) {
    heart.visible = show;
    if (!show) continue;
    const t = (rig.time * 0.6 + heart.userData.offset) % 1;
    const size = heart.userData.top * 0.2;
    heart.position.set(heart.userData.x + Math.sin(t * 9) * size * 0.15, heart.userData.top + t * size * 1.6, 0);
    heart.scale.setScalar(Math.sin(t * Math.PI));
    heart.rotation.y = -rig.time;
  }
}

const BUILDERS = { cat: createCat, dog: createDog, horse: createHorse };

export function createBuddyModel(kind) {
  return BUILDERS[kind]();
}
