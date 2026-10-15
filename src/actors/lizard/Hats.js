import * as THREE from "three";

// Procedural toy hats. Each hat is built for a head 1 unit wide: it sits on y = 0 and its
// front is +Z. attachHat() scales it to the form's head and puts it on the hat anchor.
//
//   attachHat(model, id)
//     └─ createHat(id)  →  BUILDERS[id]()  →  THREE.Group
//                                              userData.update(dt)  (animated hats only)
//
// Usage:
//   attachHat(lizardModel, "dragonWings");
//   lizardModel.hat?.userData.update?.(dt); // each frame, for hats that animate

export const HATS = [
  { id: "beanie", cost: 20 },
  { id: "party", cost: 30 },
  { id: "cowboy", cost: 45 },
  { id: "topHat", cost: 60 },
  { id: "propeller", cost: 75 },
  { id: "crown", cost: 100 },
  { id: "dragonHorns", cost: 110 },
  { id: "dragonWings", cost: 130 },
  { id: "dragonHood", cost: 150 },
];

// How the hat sits, in head widths. Hats are drawn a bit large (size) so they read from
// the high game camera; their bases stay narrow so they fit between the big gecko eyes.
// The hat sits a little behind the eyes; attachHat() then measures the skull under its
// front and back edges so it follows the skull's slope on every form.
const SEAT = { size: 1.6, back: 0.11, footprint: 0.13, sink: 0.035, tiltSide: 0.1 };

function glossy(color, extra = {}) {
  return new THREE.MeshPhysicalMaterial({ color, roughness: 0.45, clearcoat: 0.35, clearcoatRoughness: 0.4, ...extra });
}

function goldMaterial() {
  return glossy("#f5b82e", { metalness: 0.8, roughness: 0.3, clearcoat: 0.6 });
}

function addMesh(parent, geometry, material, x = 0, y = 0, z = 0) {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  parent.add(mesh);
  return mesh;
}

// Lathe from [radius, height] pairs; the profile turns around the Y axis.
function lathe(points, segments = 32) {
  return new THREE.LatheGeometry(
    points.map(([r, y]) => new THREE.Vector2(r, y)),
    segments,
  );
}

// Rounded ring (a flat brim or band) between two radii and two heights.
function roundRing(inner, outer, bottom, top, segments = 36) {
  const middle = (bottom + top) / 2;
  const edge = (top - bottom) / 2;
  return lathe(
    [
      [inner, bottom],
      [outer - edge, bottom],
      [outer - edge * 0.3, bottom + edge * 0.3],
      [outer, middle],
      [outer - edge * 0.3, top - edge * 0.3],
      [outer - edge, top],
      [inner, top],
      [inner, bottom],
    ],
    segments,
  );
}

// Dome profile: a quarter ellipse from the rim (radius, base) up to the top.
function domePoints(radius, base, height, steps = 10) {
  const points = [];
  for (let i = 0; i <= steps; i += 1) {
    const angle = (i / steps) * (Math.PI / 2);
    points.push([Math.max(radius * Math.cos(angle), 0.001), base + height * Math.sin(angle)]);
  }
  return points;
}

// Knit ribs: push vertices in and out around the Y axis.
function addRibs(geometry, count, depth) {
  const position = geometry.attributes.position;
  for (let i = 0; i < position.count; i += 1) {
    const x = position.getX(i);
    const z = position.getZ(i);
    const scale = 1 + depth * Math.cos(Math.atan2(z, x) * count);
    position.setX(i, x * scale);
    position.setZ(i, z * scale);
  }
  geometry.computeVertexNormals();
  return geometry;
}

function hash3(x, y, z) {
  const s = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453;
  return s - Math.floor(s);
}

// A fluffy yarn ball: a sphere with small random bumps.
function pomPomGeometry(radius) {
  const geometry = new THREE.SphereGeometry(radius, 18, 14);
  const position = geometry.attributes.position;
  const point = new THREE.Vector3();
  for (let i = 0; i < position.count; i += 1) {
    point.fromBufferAttribute(position, i);
    const bump = 1 + 0.14 * hash3(Math.round(point.x * 400), Math.round(point.y * 400), Math.round(point.z * 400));
    position.setXYZ(i, point.x * bump, point.y * bump, point.z * bump);
  }
  geometry.computeVertexNormals();
  return geometry;
}

// A curved horn or spike: a tube along `points` that narrows to a rounded tip.
function hornGeometry(points, radius, tipScale = 0.12) {
  const curve = new THREE.CatmullRomCurve3(points.map(([x, y, z]) => new THREE.Vector3(x, y, z)));
  const tubular = 16;
  const radial = 10;
  const geometry = new THREE.TubeGeometry(curve, tubular, radius, radial, false);
  const position = geometry.attributes.position;
  const center = new THREE.Vector3();
  const vertex = new THREE.Vector3();
  for (let i = 0; i <= tubular; i += 1) {
    const t = i / tubular;
    curve.getPointAt(t, center);
    const taper = THREE.MathUtils.lerp(1, tipScale, Math.pow(t, 0.9));
    for (let j = 0; j <= radial; j += 1) {
      const index = i * (radial + 1) + j;
      vertex.fromBufferAttribute(position, index).sub(center).multiplyScalar(taper).add(center);
      position.setXYZ(index, vertex.x, vertex.y, vertex.z);
    }
  }
  geometry.computeVertexNormals();
  return geometry;
}

function spikeGeometry(radius, height) {
  const geometry = new THREE.ConeGeometry(radius, height, 10);
  geometry.translate(0, height / 2, 0);
  return geometry;
}

// Paints vertex colors by a function of (angle around Y, height).
function paintByAngle(geometry, colorAt) {
  const position = geometry.attributes.position;
  const colors = new Float32Array(position.count * 3);
  const color = new THREE.Color();
  for (let i = 0; i < position.count; i += 1) {
    const angle = Math.atan2(position.getX(i), position.getZ(i)); // 0 = front
    colorAt(angle, position.getY(i), color);
    colors[i * 3] = color.r;
    colors[i * 3 + 1] = color.g;
    colors[i * 3 + 2] = color.b;
  }
  geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  return geometry;
}

// Cartoon eye for the dragon hats: white ball, black pupil, a white sparkle.
function addCartoonEye(parent, x, y, z, radius, lookX) {
  const eye = new THREE.Group();
  eye.position.set(x, y, z);
  parent.add(eye);
  addMesh(eye, new THREE.SphereGeometry(radius, 18, 14), glossy("#ffffff", { roughness: 0.2 }));
  const pupil = addMesh(eye, new THREE.SphereGeometry(radius * 0.55, 14, 10), glossy("#15100e", { roughness: 0.2 }));
  pupil.position.set(lookX * radius * 0.35, radius * 0.1, radius * 0.6);
  const sparkle = addMesh(eye, new THREE.SphereGeometry(radius * 0.18, 8, 6), new THREE.MeshBasicMaterial({ color: "#ffffff" }));
  sparkle.position.set(lookX * radius * 0.2 + radius * 0.15, radius * 0.4, radius * 0.95);
  return eye;
}

// Hats are drawn inside a narrow footprint: below y = 0.12 they reach at most about 0.15
// to each side (the gecko's big eyes are there), but they may reach far to the front and
// back, and anything above y = 0.2 may spread out.

function buildTopHat() {
  const hat = new THREE.Group();
  const black = glossy("#26222a");
  const brim = roundRing(0.001, 0.2, 0, 0.035, 40);
  brim.scale(0.74, 1, 1);
  addMesh(hat, brim, black);
  addMesh(hat, lathe([[0.001, 0.03], [0.115, 0.03], [0.108, 0.24], [0.128, 0.4], [0.122, 0.425], [0.09, 0.432], [0.001, 0.432]]), black);
  addMesh(hat, roundRing(0.108, 0.122, 0.035, 0.115), glossy("#e8262c"));
  return hat;
}

function buildCowboy() {
  const hat = new THREE.Group();
  const brown = glossy("#a8642c");
  const brim = roundRing(0.001, 0.25, 0, 0.035, 40);
  // Narrow the brim side to side and curl the sides up high, like a rodeo hat.
  const position = brim.attributes.position;
  for (let i = 0; i < position.count; i += 1) {
    const x = position.getX(i) * 0.78;
    const z = position.getZ(i);
    position.setX(i, x);
    position.setY(i, position.getY(i) + 0.17 * Math.pow(Math.abs(x) / 0.195, 2.2) - 0.015 * (z / 0.25) ** 2);
  }
  brim.computeVertexNormals();
  addMesh(hat, brim, brown);
  // Crown with the classic pinched dent on top.
  const crown = lathe([[0.001, 0.02], [0.125, 0.02], [0.125, 0.14], [0.112, 0.22], [0.08, 0.255], [0.04, 0.232], [0.001, 0.215]]);
  crown.scale(0.9, 1, 1.12);
  addMesh(hat, crown, brown);
  const band = roundRing(0.112, 0.13, 0.03, 0.08);
  band.scale(0.9, 1, 1.12);
  addMesh(hat, band, glossy("#4a2412"));
  // A little gold star on the front of the band.
  const shape = new THREE.Shape();
  for (let i = 0; i < 10; i += 1) {
    const angle = (i / 10) * Math.PI * 2;
    const radius = i % 2 === 0 ? 0.042 : 0.019;
    const x = Math.sin(angle) * radius;
    const y = Math.cos(angle) * radius;
    if (i === 0) shape.moveTo(x, y);
    else shape.lineTo(x, y);
  }
  const star = new THREE.ExtrudeGeometry(shape, { depth: 0.012, bevelEnabled: true, bevelThickness: 0.006, bevelSize: 0.006, bevelSegments: 1 });
  addMesh(hat, star, goldMaterial(), 0, 0.058, 0.142);
  return hat;
}

function buildCrown() {
  const hat = new THREE.Group();
  const gold = goldMaterial();
  const ruby = glossy("#e0142c", { roughness: 0.15, clearcoat: 1, flatShading: true });
  addMesh(hat, lathe(domePoints(0.12, 0, 0.14)), glossy("#c8102e", { roughness: 0.7, clearcoat: 0 }));
  // The band flares outward toward the top, like a real crown.
  addMesh(hat, lathe([[0.115, 0], [0.135, 0], [0.17, 0.12], [0.15, 0.12], [0.115, 0]], 40), gold);
  const points = 5;
  const spike = spikeGeometry(0.045, 0.13);
  const ball = new THREE.SphereGeometry(0.026, 12, 8);
  const gem = new THREE.OctahedronGeometry(0.032);
  gem.scale(1, 1.25, 0.6);
  for (let i = 0; i < points; i += 1) {
    const angle = (i / points) * Math.PI * 2;
    const x = Math.sin(angle);
    const z = Math.cos(angle);
    const point = addMesh(hat, spike, gold, x * 0.16, 0.11, z * 0.16);
    point.rotation.set(z * 0.12, 0, -x * 0.12);
    addMesh(hat, ball, gold, x * 0.18, 0.245, z * 0.18);
    const stone = addMesh(hat, gem, ruby, x * 0.158, 0.065, z * 0.158);
    stone.rotation.set(-0.25, angle, 0, "YXZ");
  }
  return hat;
}

function buildBeanie() {
  const hat = new THREE.Group();
  // Red and white knit stripes, so it stands out on a red head.
  const red = new THREE.Color("#e3232b");
  const white = new THREE.Color("#fff3e6");
  const dome = addRibs(lathe(domePoints(0.135, 0.05, 0.22, 16), 48), 12, 0.04);
  paintByAngle(dome, (angle, y, color) => color.copy(Math.floor((y - 0.05) / 0.06) % 2 === 0 ? white : red));
  addMesh(hat, dome, glossy("#ffffff", { vertexColors: true, roughness: 0.6, clearcoat: 0.15 }));
  addMesh(hat, addRibs(roundRing(0.11, 0.15, 0, 0.085, 48), 20, 0.035), glossy("#c8141f", { roughness: 0.6, clearcoat: 0.15 }));
  addMesh(hat, pomPomGeometry(0.095), glossy("#fff6ea", { roughness: 0.8, clearcoat: 0 }), 0, 0.31, 0);
  return hat;
}

function buildParty() {
  const hat = new THREE.Group();
  const stripes = [new THREE.Color("#ffd23a"), new THREE.Color("#2fb8ff"), new THREE.Color("#ff4fa0")];
  const profile = [[0.001, 0], [0.135, 0]];
  for (let i = 0; i <= 24; i += 1) profile.push([THREE.MathUtils.lerp(0.13, 0.008, i / 24), 0.02 + 0.48 * (i / 24)]);
  const cone = lathe(profile, 48);
  paintByAngle(cone, (angle, y, color) => {
    const stripe = Math.floor((((angle / (Math.PI * 2) + y * 4) % 1) + 1) % 1 * 3);
    color.copy(stripes[stripe]);
  });
  addMesh(hat, cone, glossy("#ffffff", { vertexColors: true }));
  addMesh(hat, new THREE.TorusGeometry(0.135, 0.022, 10, 36).rotateX(Math.PI / 2), glossy("#ffffff", { roughness: 0.75, clearcoat: 0 }), 0, 0.018, 0);
  addMesh(hat, pomPomGeometry(0.07), glossy("#e8262c", { roughness: 0.75, clearcoat: 0 }), 0, 0.51, 0);
  return hat;
}

function buildPropeller() {
  const hat = new THREE.Group();
  const panels = [new THREE.Color("#e8262c"), new THREE.Color("#ffd23a"), new THREE.Color("#2f8cff"), new THREE.Color("#4cc94a")];
  const cap = lathe(domePoints(0.15, 0, 0.19), 48);
  paintByAngle(cap, (angle, y, color) => {
    const panel = Math.floor(((angle + Math.PI / 4) / (Math.PI * 2) + 1) * 4 + 1) % 4; // yellow at the front
    color.copy(panels[panel]);
  });
  addMesh(hat, cap, glossy("#ffffff", { vertexColors: true }));
  // Short visor at the front.
  const visor = new THREE.CylinderGeometry(0.11, 0.11, 0.025, 24, 1, false, -Math.PI / 2, Math.PI);
  visor.scale(1, 1, 0.9);
  addMesh(hat, visor, glossy("#e8262c"), 0, 0.012, 0.12);
  addMesh(hat, new THREE.CylinderGeometry(0.018, 0.022, 0.08, 10), glossy("#f5f0e6"), 0, 0.22, 0);
  const propeller = new THREE.Group();
  propeller.position.set(0, 0.265, 0);
  hat.add(propeller);
  addMesh(propeller, new THREE.SphereGeometry(0.032, 12, 8), glossy("#ffd23a"));
  const blade = new THREE.SphereGeometry(1, 16, 8);
  blade.scale(0.21, 0.018, 0.06);
  for (const [side, color] of [[-1, "#e8262c"], [1, "#2f8cff"]]) {
    const mesh = addMesh(propeller, blade, glossy(color), side * 0.21, 0, 0);
    mesh.rotation.x = side * 0.3;
  }
  hat.userData.update = (dt) => {
    propeller.rotation.y += dt * 9;
  };
  return hat;
}

function buildDragonHood() {
  const hat = new THREE.Group();
  const green = glossy("#3fbf4a");
  const belly = glossy("#c8f06a");
  const ivory = glossy("#fff1c8");
  // Hood: a long round dome with a snout bump at the front.
  const hood = lathe(domePoints(0.145, 0, 0.21, 12), 40);
  hood.scale(1, 1, 1.25);
  addMesh(hat, hood, green);
  const snout = new THREE.SphereGeometry(1, 24, 16);
  snout.scale(0.115, 0.08, 0.13);
  addMesh(hat, snout, green, 0, 0.1, 0.17);
  const chin = new THREE.SphereGeometry(1, 20, 12);
  chin.scale(0.1, 0.03, 0.11);
  addMesh(hat, chin, belly, 0, 0.035, 0.18);
  for (const side of [-1, 1]) {
    addMesh(hat, new THREE.SphereGeometry(0.016, 8, 6), glossy("#1a3a1a"), side * 0.045, 0.16, 0.27);
  }
  // Little teeth along the snout's front edge, pointing down.
  const tooth = new THREE.ConeGeometry(0.016, 0.04, 8).rotateX(Math.PI);
  for (let i = 0; i < 5; i += 1) {
    const angle = (i / 4 - 0.5) * 1.9;
    addMesh(hat, tooth, ivory, Math.sin(angle) * 0.09, 0.03, 0.18 + Math.cos(angle) * 0.11);
  }
  addCartoonEye(hat, -0.075, 0.22, 0.07, 0.06, -0.3);
  addCartoonEye(hat, 0.075, 0.22, 0.07, 0.06, 0.3);
  for (const side of [-1, 1]) {
    addMesh(hat, hornGeometry([[side * 0.07, 0.2, -0.04], [side * 0.12, 0.29, -0.1], [side * 0.15, 0.33, -0.2]], 0.034), ivory);
  }
  // A row of soft spikes down the back of the hood.
  const spike = spikeGeometry(0.035, 0.075);
  const orange = glossy("#ffb326");
  for (let i = 0; i < 3; i += 1) {
    const angle = 0.5 + i * 0.35;
    const mesh = addMesh(hat, spike, orange, 0, Math.cos(angle) * 0.2, -Math.sin(angle) * 0.2 * 1.25);
    mesh.rotation.x = -angle;
    mesh.scale.setScalar(1 - i * 0.2);
  }
  return hat;
}

function buildDragonHorns() {
  const hat = new THREE.Group();
  const band = glossy("#7a3fd0");
  const ivory = glossy("#fff1c8");
  // A short band arcs over the top of the head; its ends tuck into the skull.
  const arc = [];
  for (let i = 0; i <= 8; i += 1) {
    const angle = (i / 8 - 0.5) * 1.6;
    arc.push(new THREE.Vector3(Math.sin(angle) * 0.17, -0.17 + Math.cos(angle) * 0.19, 0));
  }
  addMesh(hat, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(arc), 24, 0.04, 10, false), band);
  for (const side of [-1, 1]) {
    addMesh(
      hat,
      hornGeometry([[side * 0.08, 0.0, 0], [side * 0.12, 0.14, -0.02], [side * 0.21, 0.27, -0.08], [side * 0.24, 0.33, -0.19]], 0.052),
      ivory,
    );
  }
  const spike = spikeGeometry(0.032, 0.08);
  const orange = glossy("#ff9a26");
  for (const [x, scale] of [[-0.035, 0.75], [0, 1.1], [0.035, 0.75]]) {
    const mesh = addMesh(hat, spike, orange, x, 0.015, 0);
    mesh.scale.setScalar(scale);
    mesh.rotation.z = -x * 4;
  }
  return hat;
}

// A bat-style wing drawn in the XY plane (root at the origin, tip out along +X, leading
// edge up), then laid flat: the leading edge faces forward and the scallops trail back.
function wingGeometry() {
  const shape = new THREE.Shape();
  shape.moveTo(0, -0.03);
  shape.quadraticCurveTo(0.08, 0.2, 0.28, 0.25);
  shape.quadraticCurveTo(0.23, 0.15, 0.26, 0.08);
  shape.quadraticCurveTo(0.18, 0.08, 0.16, 0.02);
  shape.quadraticCurveTo(0.1, 0.03, 0.08, -0.04);
  shape.quadraticCurveTo(0.03, -0.02, 0, -0.03);
  const geometry = new THREE.ExtrudeGeometry(shape, { depth: 0.012, bevelEnabled: true, bevelThickness: 0.008, bevelSize: 0.008, bevelSegments: 2, curveSegments: 8 });
  geometry.translate(0, 0, -0.006);
  return geometry;
}

function buildDragonWings() {
  const hat = new THREE.Group();
  addMesh(hat, lathe(domePoints(0.15, 0, 0.17), 40), glossy("#7a3fd0"));
  const visor = new THREE.CylinderGeometry(0.11, 0.11, 0.022, 24, 1, false, -Math.PI / 2, Math.PI);
  visor.scale(1, 1, 0.9);
  addMesh(hat, visor, glossy("#5a2ca8"), 0, 0.011, 0.12);
  addMesh(hat, spikeGeometry(0.035, 0.07), glossy("#ffb326"), 0, 0.16, 0);
  const membrane = glossy("#4ccf5a", { side: THREE.DoubleSide });
  const bone = glossy("#ffc23a");
  const wing = wingGeometry();
  wing.scale(1.35, 1.35, 1);
  const wingBone = hornGeometry([[0, -0.03, 0], [0.11, 0.23, 0], [0.38, 0.34, 0]], 0.02, 0.4);
  // Lay the wings nearly flat so the high game camera sees their whole shape.
  for (const geometry of [wing, wingBone]) geometry.rotateX(Math.PI / 2).translate(0, 0, -0.22);
  const wings = [];
  for (const side of [-1, 1]) {
    const pivot = new THREE.Group();
    pivot.position.set(side * 0.1, 0.14, 0.02);
    pivot.rotation.y = side * 0.3; // sweep back a little
    pivot.scale.x = side; // mirror the left wing
    hat.add(pivot);
    addMesh(pivot, wing, membrane);
    addMesh(pivot, wingBone, bone);
    wings.push(pivot);
  }
  let time = 0;
  hat.userData.update = (dt) => {
    time += dt;
    const flap = 0.45 + Math.sin(time * 7) * 0.3; // a shallow V that beats up and down
    wings[0].rotation.z = -flap;
    wings[1].rotation.z = flap;
  };
  hat.userData.update(0);
  return hat;
}

const BUILDERS = {
  topHat: buildTopHat,
  cowboy: buildCowboy,
  crown: buildCrown,
  beanie: buildBeanie,
  party: buildParty,
  propeller: buildPropeller,
  dragonHood: buildDragonHood,
  dragonHorns: buildDragonHorns,
  dragonWings: buildDragonWings,
};

export function createHat(id) {
  const hat = BUILDERS[id]();
  hat.name = `hat-${id}`;
  return hat;
}

function disposeHat(hat) {
  hat.traverse((object) => {
    if (!object.isMesh) return;
    object.geometry.dispose();
    object.material.dispose();
  });
}

// Height of the skull under (x, z) in hat-anchor space, found by casting a ray down onto it.
const raycaster = new THREE.Raycaster();
const rayPoint = new THREE.Vector3();
const rayDown = new THREE.Vector3();

function skullHeight(lizardModel, x, z) {
  const anchor = lizardModel.hatAnchor;
  anchor.localToWorld(rayPoint.set(x, 10, z));
  rayDown.set(0, -1, 0).transformDirection(anchor.matrixWorld);
  raycaster.set(rayPoint, rayDown);
  const hit = raycaster.intersectObject(lizardModel.skull, false)[0];
  return hit ? anchor.worldToLocal(hit.point).y : 0;
}

// Puts hat `id` on the lizard (null removes it). The hat is stored on model.hat so the
// caller can run model.hat.userData.update?.(dt) each frame.
export function attachHat(lizardModel, id) {
  if (lizardModel.hat) {
    lizardModel.hatAnchor.remove(lizardModel.hat);
    disposeHat(lizardModel.hat);
    lizardModel.hat = null;
  }
  if (!id) return null;
  const hat = createHat(id);
  const width = lizardModel.form.head.width;
  const scale = width * SEAT.size;
  const z = -SEAT.back * width;
  const reach = SEAT.footprint * scale;
  lizardModel.group.updateMatrixWorld(true);
  const front = skullHeight(lizardModel, 0, z + reach);
  const back = skullHeight(lizardModel, 0, z - reach);
  const center = skullHeight(lizardModel, 0, z);
  hat.scale.setScalar(scale);
  hat.position.set(0, Math.min(center, (front + back) / 2) - SEAT.sink * width, z);
  hat.rotation.set(-Math.atan2(front - back, reach * 2), 0, SEAT.tiltSide, "YXZ");
  lizardModel.hatAnchor.add(hat);
  lizardModel.hat = hat;
  return hat;
}
