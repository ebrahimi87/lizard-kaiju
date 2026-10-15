import * as THREE from "three";
import { paintEye } from "../lizard/LizardSkin.js";

const MAX_STEP_HZ = 5;

// Shared building blocks for the critter, buddy, and cage models.
//
//   createKit(palette, shiny)      materials per palette color, gold when shiny
//   ball / limb / tube / cone      small mesh helpers that add to a parent
//   addEyes(kit, parent, spec)     glossy cartoon eyes (paintEye), with blink + dizzy swap
//   finishModel(spec)              the shared model contract: update(), stars, sparkles, dispose()

export const Y_AXIS = new THREE.Vector3(0, 1, 0);
const SHARED = { roughness: 0.48, clearcoat: 0.35, clearcoatRoughness: 0.4 };

export function lerp(a, b, t) {
  return a + (b - a) * t;
}

export function smoothstep(edge0, edge1, x) {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

// Gold tones chosen by how light the original color is, so patterns stay readable.
const GOLDS = ["#7a4a06", "#b9790f", "#e8a915", "#ffd23d", "#fff1a8"];
const KEEP_COLORS = new Set(["eye", "pupil", "white", "mouth", "tongue", "nose", "blush"]);

function goldFor(hex) {
  const color = new THREE.Color(hex);
  const hsl = {};
  color.getHSL(hsl);
  const index = Math.min(GOLDS.length - 1, Math.floor(hsl.l * GOLDS.length * 1.1));
  return GOLDS[index];
}

// Materials keyed by palette name. Shiny kits turn every body color gold and metallic.
export function createKit(palette, shiny = false) {
  const materials = [];
  const textures = [];
  const byName = {};
  const colors = {};
  for (const [name, hex] of Object.entries(palette)) {
    const gold = shiny && !KEEP_COLORS.has(name);
    colors[name] = gold ? goldFor(hex) : hex;
    const material = new THREE.MeshPhysicalMaterial({
      ...SHARED,
      color: colors[name],
      metalness: gold ? 0.55 : 0,
      roughness: gold ? 0.28 : SHARED.roughness,
      clearcoat: gold ? 0.8 : SHARED.clearcoat,
    });
    byName[name] = material;
    materials.push(material);
  }
  const kit = {
    shiny,
    colors,
    m: byName,
    track(item) {
      if (item.isTexture) textures.push(item);
      else materials.push(item);
      return item;
    },
    // Vertex-colored material (painted spots, bellies); colors come from kit.colors.
    painted() {
      return kit.track(
        new THREE.MeshPhysicalMaterial({
          ...SHARED,
          vertexColors: true,
          metalness: shiny ? 0.55 : 0,
          roughness: shiny ? 0.28 : SHARED.roughness,
          clearcoat: shiny ? 0.8 : SHARED.clearcoat,
        }),
      );
    },
    dispose() {
      for (const material of materials) material.dispose();
      for (const texture of textures) texture.dispose();
    },
  };
  return kit;
}

function shadowed(mesh) {
  mesh.castShadow = true;
  return mesh;
}

// A sphere scaled to radii (rx, ry, rz) at a position.
export function ball(parent, material, rx, ry = rx, rz = rx, x = 0, y = 0, z = 0) {
  const mesh = shadowed(new THREE.Mesh(new THREE.SphereGeometry(1, 24, 16), material));
  mesh.scale.set(rx, ry, rz);
  mesh.position.set(x, y, z);
  parent.add(mesh);
  return mesh;
}

// A capsule between two points (static placement).
export function limb(parent, material, radius, from, to) {
  const direction = new THREE.Vector3().subVectors(to, from);
  const length = direction.length();
  const mesh = shadowed(new THREE.Mesh(new THREE.CapsuleGeometry(radius, Math.max(length, 1e-3), 6, 12), material));
  mesh.position.addVectors(from, to).multiplyScalar(0.5);
  mesh.quaternion.setFromUnitVectors(Y_AXIS, direction.normalize());
  parent.add(mesh);
  return mesh;
}

// A capsule that hangs straight down from its parent origin (for legs on a pivot).
export function hangingCapsule(parent, material, radius, length) {
  const mesh = shadowed(new THREE.Mesh(new THREE.CapsuleGeometry(radius, length, 6, 12), material));
  mesh.position.y = -length / 2;
  parent.add(mesh);
  return mesh;
}

export function cone(parent, material, radius, height, x = 0, y = 0, z = 0, segments = 12) {
  const mesh = shadowed(new THREE.Mesh(new THREE.ConeGeometry(radius, height, segments), material));
  mesh.position.set(x, y, z);
  parent.add(mesh);
  return mesh;
}

// A pivot group at a position; children rotate around it.
export function pivot(parent, x = 0, y = 0, z = 0) {
  const group = new THREE.Group();
  group.position.set(x, y, z);
  parent.add(group);
  return group;
}

// A smooth tube along points (tails, antennae, whiskers).
export function tube(parent, material, points, radius, taper = 1, segments = 24) {
  const curve = new THREE.CatmullRomCurve3(points);
  const geometry = new THREE.TubeGeometry(curve, segments, radius, 10, false);
  if (taper !== 1) {
    // Shrink rings toward the end: each ring of 11 vertices shares one curve point.
    const position = geometry.attributes.position;
    const point = new THREE.Vector3();
    const vertex = new THREE.Vector3();
    for (let i = 0; i < position.count; i += 1) {
      const ring = Math.floor(i / 11);
      const t = ring / segments;
      curve.getPointAt(t, point);
      vertex.fromBufferAttribute(position, i).sub(point).multiplyScalar(lerp(1, taper, t)).add(point);
      position.setXYZ(i, vertex.x, vertex.y, vertex.z);
    }
    geometry.computeVertexNormals();
  }
  const mesh = shadowed(new THREE.Mesh(geometry, material));
  parent.add(mesh);
  return mesh;
}

// A sphere with vertex colors. paint(x, y, z) gets the unit-sphere point and returns a
// palette name; material must come from kit.painted().
export function paintedBall(parent, kit, material, radii, position, paint) {
  const geometry = new THREE.SphereGeometry(1, 44, 30);
  const point = geometry.attributes.position;
  const colors = new Float32Array(point.count * 3);
  const color = new THREE.Color();
  for (let i = 0; i < point.count; i += 1) {
    color.set(kit.colors[paint(point.getX(i), point.getY(i), point.getZ(i))]);
    colors[i * 3] = color.r;
    colors[i * 3 + 1] = color.g;
    colors[i * 3 + 2] = color.b;
  }
  geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  const mesh = shadowed(new THREE.Mesh(geometry, material));
  mesh.scale.set(radii[0], radii[1], radii[2]);
  mesh.position.set(position[0], position[1], position[2]);
  parent.add(mesh);
  return mesh;
}

// True when unit point (x, y, z) lies within angular radius r of any spot direction.
export function nearSpot(spots, x, y, z, r) {
  for (const [sx, sy, sz] of spots) {
    const length = Math.hypot(sx, sy, sz);
    if ((x * sx + y * sy + z * sz) / length > Math.cos(r)) return true;
  }
  return false;
}

// Rounded cap that closes a tube end so it does not look hollow.
export function tubeCap(parent, material, point, radius) {
  return ball(parent, material, radius, radius, radius, point.x, point.y, point.z);
}

// Swirly "dizzy" eye used while stunned.
function paintDizzyEye() {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 128;
  const context = canvas.getContext("2d");
  context.fillStyle = "#fffaf0";
  context.fillRect(0, 0, 256, 128);
  context.strokeStyle = "#1a0d08";
  context.lineWidth = 6;
  context.beginPath();
  for (let a = 0; a < Math.PI * 6; a += 0.1) {
    const r = 3 + a * 1.6;
    const x = 64 + Math.cos(a) * r;
    const y = 64 + Math.sin(a) * r;
    if (a === 0) context.moveTo(x, y);
    else context.lineTo(x, y);
  }
  context.stroke();
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function eyeMaterial(map) {
  return new THREE.MeshPhysicalMaterial({ map, roughness: 0.12, clearcoat: 1, clearcoatRoughness: 0.05 });
}

// Two glossy eyes. spec: { size, x, y, z, iris, pupil, look: [lx, ly, lz] }
// The eyes are mirrored on ±x. "look" is the direction for the +x eye.
export function addEyes(kit, parent, spec) {
  const { size, x, y, z, iris = "#3a2410", pupil = 1.1, look = [0.55, 0.25, 0.9] } = spec;
  const normal = kit.track(eyeMaterial(kit.track(paintEye(iris, pupil))));
  const dizzy = kit.track(eyeMaterial(kit.track(paintDizzyEye())));
  const geometry = new THREE.SphereGeometry(size, 28, 18);
  const eyes = [];
  for (const side of [-1, 1]) {
    const eye = new THREE.Mesh(geometry, normal);
    eye.position.set(side * x, y, z);
    eye.lookAt(eye.position.clone().add(new THREE.Vector3(side * look[0], look[1], look[2])));
    eye.userData.normal = normal;
    eye.userData.dizzy = dizzy;
    parent.add(eye);
    eyes.push(eye);
  }
  return eyes;
}

// Point on an ellipsoid surface (center c, radii r) in unit direction (dx, dy, dz).
export function surfacePoint(c, r, dx, dy, dz, lift = 1) {
  const length = Math.hypot(dx, dy, dz);
  return new THREE.Vector3(c[0] + (r[0] * dx * lift) / length, c[1] + (r[1] * dy * lift) / length, c[2] + (r[2] * dz * lift) / length);
}

// A smile that hugs the front of an ellipsoid. elevation is the mouth height angle
// (radians, 0 = equator), halfAngle its half width, sag how much the middle dips.
export function smileOn(parent, material, c, r, { elevation = 0, halfAngle = 0.5, sag = 0.15, thickness = 0.01 }) {
  const points = [];
  for (let i = 0; i <= 10; i += 1) {
    const a = lerp(-halfAngle, halfAngle, i / 10);
    const e = elevation - sag * (1 - (a / halfAngle) ** 2);
    points.push(surfacePoint(c, r, Math.sin(a) * Math.cos(e), Math.sin(e), Math.cos(a) * Math.cos(e), 1.0));
  }
  const mesh = tube(parent, material, points, thickness, 1, 20);
  tubeCap(parent, material, points[0], thickness);
  tubeCap(parent, material, points[10], thickness);
  return mesh;
}

function starShape(points, outer, inner) {
  const shape = new THREE.Shape();
  for (let i = 0; i <= points * 2; i += 1) {
    const angle = (i / (points * 2)) * Math.PI * 2 + Math.PI / 2;
    const r = i % 2 === 0 ? outer : inner;
    if (i === 0) shape.moveTo(Math.cos(angle) * r, Math.sin(angle) * r);
    else shape.lineTo(Math.cos(angle) * r, Math.sin(angle) * r);
  }
  return shape;
}

export function createStarGeometry(points, outer, inner, depth) {
  const geometry = new THREE.ExtrudeGeometry(starShape(points, outer, inner), {
    depth,
    bevelEnabled: true,
    bevelThickness: depth * 0.5,
    bevelSize: depth * 0.5,
    bevelSegments: 2,
  });
  geometry.translate(0, 0, -depth / 2);
  return geometry;
}

// Dizzy stars that circle over the head while stunned.
function createStars(kit, radius, size) {
  const group = new THREE.Group();
  const material = kit.track(
    new THREE.MeshStandardMaterial({ color: "#ffe14a", emissive: "#ffb800", emissiveIntensity: 0.9, roughness: 0.35 }),
  );
  const geometry = createStarGeometry(5, size, size * 0.45, size * 0.35);
  const stars = [];
  for (let i = 0; i < 4; i += 1) {
    const star = new THREE.Mesh(geometry, material);
    star.userData.angle = (i / 4) * Math.PI * 2;
    group.add(star);
    stars.push(star);
  }
  group.visible = false;
  return { group, stars, radius };
}

// Twinkling four-point sparkles around a shiny critter.
function createSparkles(kit, radius, height, size) {
  const group = new THREE.Group();
  const material = kit.track(
    new THREE.MeshStandardMaterial({ color: "#fffbe0", emissive: "#ffd84a", emissiveIntensity: 2.2, roughness: 0.3 }),
  );
  const geometry = createStarGeometry(4, size, size * 0.28, size * 0.15);
  const sparkles = [];
  for (let i = 0; i < 6; i += 1) {
    const sparkle = new THREE.Mesh(geometry, material);
    sparkle.userData.angle = (i / 6) * Math.PI * 2;
    sparkle.userData.y = height * (0.25 + 0.75 * ((i * 0.37) % 1));
    sparkle.userData.offset = i * 0.83;
    group.add(sparkle);
    sparkles.push(sparkle);
  }
  return { group, sparkles, radius };
}

// Wraps a built model in the shared contract.
//   spec: { kit, group, pose, eyes, radius, height, headTop, stride, animate(rig) }
// pose is the inner group that holds the body; the game owns group's transform.
// animate(rig) poses the body. rig = { dt, time, phase, move, speed, state, stateTime }.
export function finishModel(spec) {
  const { kit, group, pose, eyes = [], radius, height, stride, animate } = spec;
  const headTop = spec.headTop ?? new THREE.Vector3(0, height, 0);
  const starsPivot = pivot(pose, headTop.x, headTop.y + height * 0.12, headTop.z);
  const stars = createStars(kit, Math.max(radius * 0.55, 0.1), Math.max(height * 0.08, 0.035));
  starsPivot.add(stars.group);
  const sparkles = kit.shiny ? createSparkles(kit, radius * 1.25, height * 1.1, Math.max(height * 0.1, 0.045)) : null;
  if (sparkles) group.add(sparkles.group);

  const rig = { dt: 0, time: Math.random() * 10, phase: 0, move: 0, speed: 0, state: "idle", stateTime: 0 };
  let blinkTimer = 1 + Math.random() * 3;
  let blink = 0;

  function updateStars(stunned) {
    stars.group.visible = stunned;
    if (!stunned) return;
    for (const star of stars.stars) {
      const angle = star.userData.angle + rig.time * 3.2;
      star.position.set(Math.cos(angle) * stars.radius, Math.sin(angle * 2) * stars.radius * 0.12, Math.sin(angle) * stars.radius);
      star.rotation.set(0, -angle, rig.time * 4);
    }
  }

  function updateSparkles() {
    if (!sparkles) return;
    for (const sparkle of sparkles.sparkles) {
      const { angle, y, offset } = sparkle.userData;
      const a = angle + rig.time * 0.7;
      const twinkle = Math.max(0, Math.sin(rig.time * 3 + offset * 2.3));
      sparkle.position.set(Math.cos(a) * sparkles.radius, y + Math.sin(rig.time * 1.3 + offset) * 0.03, Math.sin(a) * sparkles.radius);
      sparkle.scale.setScalar(0.2 + twinkle * twinkle);
      sparkle.rotation.set(0, -a, rig.time * 1.5 + offset);
    }
  }

  function updateEyes(stunned) {
    blinkTimer -= rig.dt;
    if (blinkTimer < 0) {
      blink = 0.13;
      blinkTimer = 2 + Math.random() * 3.5;
    }
    blink = Math.max(0, blink - rig.dt);
    for (const eye of eyes) {
      eye.material = stunned ? eye.userData.dizzy : eye.userData.normal;
      eye.scale.y = blink > 0 && !stunned ? 0.12 : 1;
    }
  }

  function update(dt, motion) {
    const speed = motion.speed ?? 0;
    if (motion.state !== rig.state) {
      rig.state = motion.state;
      rig.stateTime = 0;
    }
    rig.dt = dt;
    rig.time += dt;
    rig.stateTime += dt;
    rig.speed = speed;
    const targetMove = smoothstep(0.02, stride * 1.5, speed);
    rig.move = lerp(rig.move, targetMove, 1 - Math.exp(-dt * 8));
    // Cap the leg cycle: faster than ~5 steps a second reads as jitter on screen.
    rig.phase = (rig.phase + Math.min(speed / stride, MAX_STEP_HZ) * dt) % 1;
    const stunned = rig.state === "stunned";
    updateEyes(stunned);
    updateStars(stunned);
    updateSparkles();
    // Stunned wobble around the feet, shared by every critter.
    pose.rotation.z = stunned ? Math.sin(rig.time * 5) * 0.14 : 0;
    pose.rotation.x = stunned ? Math.cos(rig.time * 5) * 0.06 : 0;
    animate(rig);
  }

  function dispose() {
    group.traverse((object) => {
      if (object.geometry) object.geometry.dispose();
    });
    kit.dispose();
  }

  update(0, { speed: 0, state: "idle", time: 0 });
  return { group, radius, height, update, dispose };
}

// Starts a model: outer group (game-owned) and inner pose group (animation-owned).
export function startModel(name) {
  const group = new THREE.Group();
  group.name = name;
  const pose = pivot(group);
  return { group, pose };
}
