import * as THREE from "three";
import { paintBodySkin, paintEye } from "./LizardSkin.js";

// A procedural lizard. The body is one smooth tube swept along an animated spine; the
// head, legs, feet, frill, and back plates are attached to that spine every frame.
//
//   update(dt, motion)
//     ├─ animateKeys()     rest spine keys + sway, turn bend, breathing, bob
//     ├─ sampleSpine()     Catmull-Rom keys → evenly spaced rings with frames
//     ├─ writeBody()       ring frames → tube vertices and normals
//     ├─ placeHead()       head at the neck end; jaw, frill, blink
//     ├─ placeLegs()       gait targets → two-bone IK → limb meshes and feet
//     └─ placeDorsal()     spikes or glowing plates along the back

const RING_COUNT = 84;
const RING_SIDES = 30;
const DENSE_STEPS = 14;
const KEY_CHANNELS = 5; // x, y, z, width, height
const UP = new THREE.Vector3(0, 1, 0);
const Y_AXIS = new THREE.Vector3(0, 1, 0);

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function smoothstep(edge0, edge1, x) {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

function catmullRom(p0, p1, p2, p3, t) {
  const t2 = t * t;
  const t3 = t2 * t;
  return 0.5 * (2 * p1 + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3);
}

// Rest spine keys from tail tip (index 0) to neck end (last index).
function buildRestKeys(form) {
  const { torso, neck, tail, hipHeight } = form;
  const keys = [];
  const tailWidths = [0.01, 0.34, 0.6, 0.84];
  for (let i = 4; i >= 1; i -= 1) {
    const f = i / 4;
    const y = tail.tipHeight + (hipHeight - tail.tipHeight) * Math.pow(1 - f, tail.curve);
    const width = tail.width * tailWidths[4 - i];
    keys.push({ x: 0, y, z: -tail.length * f, w: Math.max(width, 0.008), h: Math.max(width * 0.92, 0.008) });
  }
  const torsoDir = new THREE.Vector3(0, Math.sin(torso.pitch), Math.cos(torso.pitch));
  const hip = new THREE.Vector3(0, hipHeight, 0);
  const mid = hip.clone().addScaledVector(torsoDir, torso.length * 0.5);
  const shoulder = hip.clone().addScaledVector(torsoDir, torso.length);
  const neckDir = new THREE.Vector3(0, Math.sin(neck.pitch), Math.cos(neck.pitch));
  const neckMid = shoulder.clone().addScaledVector(neckDir, neck.length * 0.5);
  const neckEnd = shoulder.clone().addScaledVector(neckDir, neck.length);
  keys.push({ ...hip, w: torso.width * 0.86, h: torso.height * 0.9 });
  keys.push({ x: mid.x, y: mid.y, z: mid.z, w: torso.width, h: torso.height });
  keys.push({ x: shoulder.x, y: shoulder.y, z: shoulder.z, w: torso.width * 0.86, h: torso.height * 0.86 });
  keys.push({ x: neckMid.x, y: neckMid.y, z: neckMid.z, w: neck.width * 1.05, h: neck.width * 1.0 });
  keys.push({ x: neckEnd.x, y: neckEnd.y, z: neckEnd.z, w: neck.width, h: neck.width * 0.95 });
  return keys;
}

const HIP_KEY = 4;
const MID_KEY = 5;
const SHOULDER_KEY = 6;

function createTubeGeometry() {
  const ringVerts = RING_SIDES + 1;
  const vertexCount = RING_COUNT * ringVerts + 2;
  const positions = new Float32Array(vertexCount * 3);
  const normals = new Float32Array(vertexCount * 3);
  const uvs = new Float32Array(vertexCount * 2);
  const indices = [];
  for (let r = 0; r < RING_COUNT; r += 1) {
    for (let j = 0; j <= RING_SIDES; j += 1) {
      const index = r * ringVerts + j;
      uvs[index * 2] = j / RING_SIDES;
      uvs[index * 2 + 1] = r / (RING_COUNT - 1);
    }
  }
  for (let r = 0; r < RING_COUNT - 1; r += 1) {
    for (let j = 0; j < RING_SIDES; j += 1) {
      const a = r * ringVerts + j;
      const b = a + 1;
      const c = a + ringVerts;
      const d = c + 1;
      indices.push(a, b, c, b, d, c);
    }
  }
  const tailCenter = RING_COUNT * ringVerts;
  const neckCenter = tailCenter + 1;
  uvs[tailCenter * 2 + 1] = 0;
  uvs[neckCenter * 2 + 1] = 1;
  const lastRing = (RING_COUNT - 1) * ringVerts;
  for (let j = 0; j < RING_SIDES; j += 1) {
    indices.push(tailCenter, j + 1, j);
    indices.push(neckCenter, lastRing + j, lastRing + j + 1);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3).setUsage(THREE.DynamicDrawUsage));
  geometry.setAttribute("normal", new THREE.BufferAttribute(normals, 3).setUsage(THREE.DynamicDrawUsage));
  geometry.setAttribute("uv", new THREE.BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  return geometry;
}

// Deformed sphere used for the skull and jaw. The sphere's z runs back (-1) to snout (+1).
function createHeadPart(head, colors, part) {
  const geometry = new THREE.SphereGeometry(1, 40, part === "skull" ? 26 : 18);
  geometry.rotateX(Math.PI / 2); // put the sphere poles on ±Z so the snout is smooth
  const position = geometry.attributes.position;
  const color = new Float32Array(position.count * 3);
  const top = new THREE.Color(colors.top);
  const bottom = new THREE.Color(colors.bottom);
  const inner = new THREE.Color(colors.inner);
  const accent = new THREE.Color(colors.accent);
  const mixed = new THREE.Color();
  for (let i = 0; i < position.count; i += 1) {
    const x = position.getX(i);
    const y = position.getY(i);
    const z = position.getZ(i);
    const f = (z + 1) / 2;
    const taper = lerp(1, head.snoutTaper, smoothstep(0.3, 1, f));
    const widthScale = (head.width / 2) * taper * (part === "jaw" ? 0.9 : 1);
    let height;
    if (part === "skull") {
      height = y >= 0 ? head.height * 0.6 * lerp(1, head.snoutFlat, smoothstep(0.3, 1, f)) : head.height * 0.1;
    } else {
      height = y >= 0 ? head.height * 0.06 : head.height * head.jawDepth * lerp(1, 0.7, smoothstep(0.4, 1, f));
    }
    const length = part === "skull" ? head.length : head.length * 0.94;
    position.setXYZ(i, x * widthScale, y * height, z * length * 0.5 + head.length * 0.32);

    if (part === "skull") {
      mixed.copy(bottom).lerp(top, smoothstep(-0.2, 0.35, y));
      if (y < -0.3) mixed.copy(inner);
    } else {
      // Red jaw sides with a golden chin; the flat top is the mouth and tongue.
      mixed.copy(bottom).lerp(top, smoothstep(-0.45, -0.05, y) * 0.85);
      if (y > 0.25) mixed.copy(Math.abs(x) < 0.55 ? accent : inner);
    }
    color[i * 3] = mixed.r;
    color[i * 3 + 1] = mixed.g;
    color[i * 3 + 2] = mixed.b;
  }
  geometry.setAttribute("color", new THREE.BufferAttribute(color, 3));
  geometry.computeVertexNormals();
  return geometry;
}

// Width and height of the skull surface at a fraction f from back (0) to snout (1).
// The sphere's own roundness shrinks the cross-section toward both ends.
function skullProfile(head, f) {
  const taper = lerp(1, head.snoutTaper, smoothstep(0.3, 1, f));
  const z = f * 2 - 1;
  const round = Math.sqrt(Math.max(1 - z * z, 0));
  return {
    halfWidth: (head.width / 2) * taper * round,
    top: head.height * 0.6 * lerp(1, head.snoutFlat, smoothstep(0.3, 1, f)) * round,
    z: z * head.length * 0.5 + head.length * 0.32,
  };
}

function createPlateGeometry() {
  const shape = new THREE.Shape();
  shape.moveTo(-0.36, 0);
  shape.lineTo(-0.44, 0.3);
  shape.lineTo(-0.24, 0.4);
  shape.lineTo(-0.32, 0.7);
  shape.lineTo(-0.08, 0.66);
  shape.lineTo(-0.06, 1.0);
  shape.lineTo(0.12, 0.66);
  shape.lineTo(0.32, 0.7);
  shape.lineTo(0.22, 0.4);
  shape.lineTo(0.4, 0.3);
  shape.lineTo(0.34, 0);
  shape.closePath();
  const depth = 0.07;
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: true,
    bevelThickness: 0.035,
    bevelSize: 0.035,
    bevelSegments: 2,
    curveSegments: 4,
  });
  geometry.translate(0, 0, -depth / 2);
  geometry.rotateY(-Math.PI / 2);
  geometry.computeVertexNormals();
  return geometry;
}

function createDorsalGeometry(type) {
  if (type === "plate") return createPlateGeometry();
  if (type === "bump") {
    const geometry = new THREE.SphereGeometry(0.5, 10, 8);
    geometry.scale(0.9, 0.6, 1.2);
    return geometry;
  }
  const geometry = new THREE.ConeGeometry(0.42, 1, 8);
  geometry.translate(0, 0.5, 0);
  geometry.rotateX(-0.45); // lean the tip toward the tail
  return geometry;
}

// Adds emissive glow that sweeps from the tail toward the head (the kaiju's charge-up).
function addGlowSweep(material) {
  material.userData.glow = { value: 0 };
  material.userData.glowFront = { value: 1.2 };
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uGlow = material.userData.glow;
    shader.uniforms.uGlowFront = material.userData.glowFront;
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nattribute float aSpine;\nvarying float vSpine;\nvarying float vPlateY;")
      .replace("#include <begin_vertex>", "#include <begin_vertex>\nvSpine = aSpine;\nvPlateY = position.y;");
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        "#include <common>\nuniform float uGlow;\nuniform float uGlowFront;\nvarying float vSpine;\nvarying float vPlateY;",
      )
      .replace(
        "#include <emissivemap_fragment>",
        "#include <emissivemap_fragment>\n" +
          "float lit = 1.0 - smoothstep(uGlowFront - 0.08, uGlowFront + 0.04, vSpine);\n" +
          "totalEmissiveRadiance *= uGlow * lit * (0.35 + 0.9 * smoothstep(0.1, 0.9, vPlateY));",
      );
  };
  material.customProgramCacheKey = () => "lizard-glow-sweep";
}

function createFrillGeometry(spec, colors) {
  const angular = 64;
  const radial = 6;
  const inner = 0.35;
  const span = Math.PI * 1.65;
  const positions = [];
  const vertexColors = [];
  const indices = [];
  const innerColor = new THREE.Color(colors.inner);
  const outerColor = new THREE.Color(colors.outer);
  const rib = new THREE.Color(colors.outer).multiplyScalar(0.72);
  const mixed = new THREE.Color();
  for (let a = 0; a <= angular; a += 1) {
    const theta = -span / 2 + (span * a) / angular;
    const ribWave = Math.cos(theta * spec.ribs * 1.1);
    const outer = 1 + 0.1 * ribWave;
    for (let r = 0; r <= radial; r += 1) {
      const t = r / radial;
      const radius = lerp(inner, outer, t);
      // theta 0 points up; the frill opens around the neck with a gap underneath.
      positions.push(Math.sin(theta) * radius, Math.cos(theta) * radius, -0.06 * t * t);
      mixed.copy(innerColor).lerp(outerColor, smoothstep(0.15, 0.95, t));
      if (ribWave > 0.86 && t > 0.2) mixed.lerp(rib, 0.6);
      vertexColors.push(mixed.r, mixed.g, mixed.b);
    }
  }
  for (let a = 0; a < angular; a += 1) {
    for (let r = 0; r < radial; r += 1) {
      const i = a * (radial + 1) + r;
      indices.push(i, i + radial + 1, i + 1, i + 1, i + radial + 1, i + radial + 2);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(vertexColors, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.scale(spec.radius, spec.radius, spec.radius);
  return geometry;
}

function solveTwoBone(root, target, upperLength, lowerLength, pole, outKnee, outEnd) {
  const toTarget = outEnd.subVectors(target, root);
  const distance = Math.min(Math.max(toTarget.length(), 1e-4), (upperLength + lowerLength) * 0.999);
  toTarget.normalize();
  const along = (upperLength * upperLength - lowerLength * lowerLength + distance * distance) / (2 * distance);
  const height = Math.sqrt(Math.max(upperLength * upperLength - along * along, 0));
  const bend = outKnee.copy(pole).addScaledVector(toTarget, -pole.dot(toTarget)).normalize();
  outKnee.multiplyScalar(height).addScaledVector(toTarget, along).add(root);
  outEnd.copy(toTarget).multiplyScalar(distance).add(root);
}

// Stretches a unit-height mesh between two points. Ellipsoid meshes (unit spheres) get
// their stored radius across and a little extra length so they overlap the joints.
function placeSegment(mesh, from, to) {
  const direction = mesh.userData.direction.subVectors(to, from);
  const length = direction.length();
  mesh.position.addVectors(from, to).multiplyScalar(0.5);
  mesh.quaternion.setFromUnitVectors(Y_AXIS, direction.multiplyScalar(1 / Math.max(length, 1e-5)));
  const radius = mesh.userData.ellipsoidRadius;
  if (radius) mesh.scale.set(radius, length * 0.62, radius);
  else mesh.scale.set(1, length, 1);
}

export class LizardModel {
  constructor(form, skin) {
    this.form = form;
    this.skin = skin;
    this.group = new THREE.Group();
    this.group.name = `lizard-${form.id}`;
    this.restKeys = buildRestKeys(form);
    this.keyCount = this.restKeys.length;
    this.keys = new Float32Array(this.keyCount * KEY_CHANNELS);
    this.keyBody = this.restKeys.map((_, index) => index / (this.keyCount - 1));
    const denseCount = (this.keyCount - 1) * DENSE_STEPS + 1;
    this.dense = new Float32Array(denseCount * KEY_CHANNELS);
    this.denseArc = new Float32Array(denseCount);
    this.ringCenter = new Float32Array(RING_COUNT * 3);
    this.ringTangent = new Float32Array(RING_COUNT * 3);
    this.ringSize = new Float32Array(RING_COUNT * 2);
    this.ringCos = new Float32Array(RING_SIDES + 1);
    this.ringSin = new Float32Array(RING_SIDES + 1);
    for (let j = 0; j <= RING_SIDES; j += 1) {
      // j = 0 is the belly midline so the texture seam hides underneath.
      const angle = -Math.PI / 2 + (Math.PI * 2 * j) / RING_SIDES;
      this.ringCos[j] = Math.cos(angle);
      this.ringSin[j] = Math.sin(angle);
    }

    this.time = Math.random() * 10;
    this.phase = 0;
    this.stride = form.gait.stride;
    this.moveAmount = 0;
    this.turn = 0;
    this.blinkTimer = 1 + Math.random() * 3;
    this.blink = 0;
    this.motion = { speed: 0, turnRate: 0, mouthOpen: 0, roar: 0, glow: 0, lookYaw: 0 };

    this.temp = {
      a: new THREE.Vector3(),
      b: new THREE.Vector3(),
      c: new THREE.Vector3(),
      tangent: new THREE.Vector3(),
      side: new THREE.Vector3(),
      up: new THREE.Vector3(),
      matrix: new THREE.Matrix4(),
      quaternion: new THREE.Quaternion(),
      tilt: new THREE.Quaternion(),
      basis: new THREE.Matrix4(),
      scale: new THREE.Vector3(),
      position: new THREE.Vector3(),
    };

    this.createMaterials();
    this.createBody();
    this.createHead();
    this.createLegs();
    this.createDorsal();
    this.update(0, this.motion);
  }

  // A see-through silhouette drawn only where something stands in front of the lizard,
  // so the player never loses it behind trees, buildings, or the robot.
  addXray(color = "#ff2a3a") {
    const material = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.6, depthWrite: false, depthFunc: THREE.GreaterDepth });
    for (const mesh of [this.body, this.skull, this.jaw]) {
      const ghost = new THREE.Mesh(mesh.geometry, material);
      ghost.renderOrder = 20;
      ghost.frustumCulled = false;
      mesh.add(ghost);
    }
    this.xrayMaterial = material;
  }

  createMaterials() {
    const { skin, form } = this;
    const { map, bumpMap, emissiveMap } = paintBodySkin(skin, form.pattern);
    const shared = { roughness: skin.roughness ?? 0.48, metalness: skin.metalness ?? 0, clearcoat: 0.35, clearcoatRoughness: 0.4 };
    // Skins with glowing patterns (lava cracks) light the body through an emissive map.
    const glow = emissiveMap ? { emissive: "#ffffff", emissiveMap } : {};
    this.materials = {
      body: new THREE.MeshPhysicalMaterial({ ...shared, ...glow, map, bumpMap, bumpScale: skin.bumpScale ?? 0.8 }),
      head: new THREE.MeshPhysicalMaterial({ ...shared, vertexColors: true }),
      limb: new THREE.MeshPhysicalMaterial({ ...shared, color: skin.limb }),
      pad: new THREE.MeshPhysicalMaterial({ ...shared, color: skin.toePad }),
      claw: new THREE.MeshStandardMaterial({ color: skin.claw, roughness: 0.4 }),
      teeth: new THREE.MeshStandardMaterial({ color: skin.teeth, roughness: 0.3 }),
      eye: new THREE.MeshPhysicalMaterial({
        map: paintEye(skin.iris, form.head.pupil),
        roughness: 0.12,
        clearcoat: 1,
        clearcoatRoughness: 0.05,
      }),
      dark: new THREE.MeshStandardMaterial({ color: "#2a0d0d", roughness: 0.6 }),
      brow: new THREE.MeshPhysicalMaterial({ ...shared, color: skin.backDark }),
    };
  }

  createBody() {
    this.bodyGeometry = createTubeGeometry();
    this.body = new THREE.Mesh(this.bodyGeometry, this.materials.body);
    this.body.castShadow = true;
    this.body.receiveShadow = true;
    this.body.frustumCulled = false;
    this.group.add(this.body);
  }

  createHead() {
    const { head } = this.form;
    const skin = this.skin;
    this.headPivot = new THREE.Group();
    this.group.add(this.headPivot);

    const skull = new THREE.Mesh(
      createHeadPart(head, { top: skin.back, bottom: skin.belly, inner: skin.mouth, accent: skin.tongue }, "skull"),
      this.materials.head,
    );
    skull.castShadow = true;
    this.headPivot.add(skull);
    this.skull = skull;

    this.jawPivot = new THREE.Group();
    this.jawPivot.position.set(0, -0.012, -head.length * 0.08);
    this.headPivot.add(this.jawPivot);
    const jaw = new THREE.Mesh(
      createHeadPart(head, { top: skin.back, bottom: skin.belly, inner: skin.mouth, accent: skin.tongue }, "jaw"),
      this.materials.head,
    );
    jaw.position.set(0, 0, head.length * 0.08);
    jaw.castShadow = true;
    this.jawPivot.add(jaw);
    this.jaw = jaw;

    // Eyes look outward, forward, and a little up so they read from the high camera.
    this.eyes = [];
    // The eye sits on the skull's cross-section ellipse at an angle above the side,
    // pushed out along the surface normal so it bulges instead of sinking in.
    const eyeProfile = skullProfile(head, head.eyeForward);
    const eyeAngle = head.eyeUp * 1.1;
    const surfaceX = eyeProfile.halfWidth * Math.cos(eyeAngle);
    const surfaceY = eyeProfile.top * Math.sin(eyeAngle);
    const normal = new THREE.Vector2(eyeProfile.top * Math.cos(eyeAngle), eyeProfile.halfWidth * Math.sin(eyeAngle)).normalize();
    const bulge = head.eyeSize * (head.eyeOut - 0.25);
    const eyeGeometry = new THREE.SphereGeometry(head.eyeSize, 28, 18);
    for (const side of [-1, 1]) {
      const eye = new THREE.Mesh(eyeGeometry, this.materials.eye);
      eye.position.set(side * (surfaceX + normal.x * bulge), surfaceY + normal.y * bulge, eyeProfile.z);
      const look = new THREE.Vector3(side * 0.75, 0.6, 0.7).add(eye.position);
      eye.lookAt(look);
      eye.userData.baseScale = 1;
      this.headPivot.add(eye);
      this.eyes.push(eye);
      if (head.brow > 0) {
        const brow = new THREE.Mesh(new THREE.CapsuleGeometry(head.eyeSize * 0.24, head.eyeSize * 1.1, 4, 10), this.materials.brow);
        brow.position.copy(eye.position).add(new THREE.Vector3(-side * head.eyeSize * 0.2, head.eyeSize * 0.88, head.eyeSize * 0.15));
        brow.rotation.set(0, side * 0.3, Math.PI / 2 - side * 0.28);
        brow.castShadow = true;
        this.headPivot.add(brow);
      }
    }

    const tip = skullProfile(head, 0.88);
    for (const side of [-1, 1]) {
      const nostril = new THREE.Mesh(new THREE.SphereGeometry(head.width * 0.028, 10, 8), this.materials.dark);
      nostril.position.set(side * tip.halfWidth * 0.42, tip.top * 0.94, tip.z);
      this.headPivot.add(nostril);
    }

    if (head.teeth > 0) {
      const toothGeometry = new THREE.ConeGeometry(head.width * 0.03, head.height * 0.17, 6);
      toothGeometry.rotateX(Math.PI);
      const perSide = Math.round(head.teeth / 2);
      for (const side of [-1, 1]) {
        for (let i = 0; i < perSide; i += 1) {
          const f = lerp(0.42, 0.96, i / Math.max(perSide - 1, 1));
          const profile = skullProfile(head, f);
          const tooth = new THREE.Mesh(toothGeometry, this.materials.teeth);
          tooth.position.set(side * profile.halfWidth * 0.86, -head.height * 0.1, profile.z);
          this.headPivot.add(tooth);
        }
      }
    }

    if (this.form.frill) {
      const frill = new THREE.Mesh(
        createFrillGeometry(this.form.frill, { inner: skin.frillInner, outer: skin.frillOuter }),
        new THREE.MeshPhysicalMaterial({ vertexColors: true, side: THREE.DoubleSide, roughness: 0.5, clearcoat: 0.2 }),
      );
      frill.castShadow = true;
      this.frillPivot = new THREE.Group();
      this.frillPivot.position.set(0, head.height * 0.05, -head.length * 0.12);
      this.frillPivot.add(frill);
      this.headPivot.add(this.frillPivot);
    }

    this.hatAnchor = new THREE.Group();
    const crown = skullProfile(head, 0.32);
    this.hatAnchor.position.set(0, crown.top * 0.96, crown.z);
    this.headPivot.add(this.hatAnchor);

    this.mouthAnchor = new THREE.Group();
    this.mouthAnchor.position.set(0, -head.height * 0.02, skullProfile(head, 1).z);
    this.headPivot.add(this.mouthAnchor);
  }

  createLegs() {
    const { legs, posture } = this.form;
    const upright = posture === "upright";
    this.legs = [];
    const specs = [
      { spec: legs.front, side: -1, front: true, phase: upright ? 0.5 : 0 },
      { spec: legs.front, side: 1, front: true, phase: upright ? 0 : 0.5 },
      { spec: legs.back, side: -1, front: false, phase: 0.5 },
      { spec: legs.back, side: 1, front: false, phase: 0 },
    ];
    for (const { spec, side, front, phase } of specs) {
      const isArm = Boolean(spec.arm);
      const thigh = upright && !front;
      const thick = thigh ? 1.3 : 1.15;
      // Upright hind legs get a drumstick thigh (an ellipsoid) instead of a tube.
      const upperGeometry = thigh
        ? new THREE.SphereGeometry(1, 18, 14)
        : new THREE.CylinderGeometry(spec.radius, spec.radius * thick, 1, 14, 1, true);
      const lowerGeometry = thigh
        ? new THREE.CylinderGeometry(spec.radius * 0.82, spec.radius * 0.92, 1, 14, 1, true)
        : new THREE.CylinderGeometry(spec.radius * 0.72, spec.radius, 1, 12, 1, true);
      const upper = new THREE.Mesh(upperGeometry, this.materials.limb);
      const lower = new THREE.Mesh(lowerGeometry, this.materials.limb);
      upper.userData.direction = new THREE.Vector3();
      upper.userData.ellipsoidRadius = thigh ? spec.radius * thick : 0;
      lower.userData.direction = new THREE.Vector3();
      const hipJoint = new THREE.Mesh(new THREE.SphereGeometry(spec.radius * thick, 14, 10), this.materials.limb);
      const knee = new THREE.Mesh(new THREE.SphereGeometry(spec.radius, 12, 10), this.materials.limb);
      const ankle = new THREE.Mesh(new THREE.SphereGeometry(spec.radius * 0.74, 10, 8), this.materials.limb);
      const foot = this.createFoot(spec, isArm, side, thigh);
      knee.visible = !thigh;
      hipJoint.visible = !thigh;
      for (const mesh of [upper, lower, hipJoint, knee, ankle]) {
        mesh.castShadow = true;
        this.group.add(mesh);
      }
      this.group.add(foot);
      this.legs.push({
        spec,
        side,
        front,
        isArm,
        phase,
        upper,
        lower,
        hipJoint,
        knee,
        ankle,
        foot,
        root: new THREE.Vector3(),
        target: new THREE.Vector3(),
        kneePoint: new THREE.Vector3(),
        endPoint: new THREE.Vector3(),
        pole: new THREE.Vector3(),
      });
    }
  }

  createFoot(spec, isArm, side, thigh) {
    const { legs, posture } = this.form;
    const foot = new THREE.Group();
    const palm = new THREE.Mesh(new THREE.SphereGeometry(spec.radius * 1.2, 14, 10), this.materials.limb);
    // Upright feet are long ovals that reach forward; sprawled feet are round palms.
    if (thigh) {
      palm.scale.set(0.85, 0.5, 1.35);
      palm.position.z = spec.radius * 0.45;
    } else {
      palm.scale.set(1, 0.55, 1.15);
    }
    palm.castShadow = true;
    foot.add(palm);
    const toes = isArm ? 3 : legs.toes;
    const spread = posture === "sprawl" ? 1.05 : isArm ? 0.6 : 0.42;
    const toeRadius = spec.radius * (isArm ? 0.32 : 0.36);
    const toeGeometry = new THREE.CylinderGeometry(toeRadius * 0.8, toeRadius, 1, 8, 1, true);
    for (let i = 0; i < toes; i += 1) {
      const t = toes === 1 ? 0.5 : i / (toes - 1);
      const angle = lerp(-spread, spread, t);
      const length = legs.toeLength * (isArm ? 0.55 : 1) * (1 - 0.35 * Math.abs(t - 0.55) * 2 * 0.5);
      const direction = new THREE.Vector3(Math.sin(angle), -0.08, Math.cos(angle)).normalize();
      const toeBase = spec.radius * (thigh ? 1.3 : 0.6);
      const start = direction.clone().multiplyScalar(toeBase);
      const end = direction.clone().multiplyScalar(toeBase + length);
      const toe = new THREE.Mesh(toeGeometry, this.materials.limb);
      toe.userData.direction = new THREE.Vector3();
      placeSegment(toe, start, end);
      toe.castShadow = true;
      foot.add(toe);
      if (legs.toePad > 0 && !isArm) {
        const pad = new THREE.Mesh(new THREE.SphereGeometry(legs.toePad, 12, 8), this.materials.pad);
        pad.position.copy(end);
        pad.scale.set(1, 0.7, 1);
        foot.add(pad);
      }
      if (legs.claws > 0) {
        const claw = new THREE.Mesh(new THREE.ConeGeometry(toeRadius * 0.85, legs.claws * (isArm ? 0.7 : 1), 8), this.materials.claw);
        claw.position.copy(end);
        claw.quaternion.setFromUnitVectors(Y_AXIS, direction.clone().setY(-0.35).normalize());
        foot.add(claw);
      }
    }
    foot.userData.yaw = posture === "sprawl" ? side * 0.5 : side * 0.1;
    return foot;
  }

  createDorsal() {
    const dorsal = this.form.dorsal;
    this.dorsalCount = 0;
    if (!dorsal) return;
    const geometry = createDorsalGeometry(dorsal.type);
    const count = dorsal.count * dorsal.rows;
    const spineValues = new Float32Array(count);
    for (let i = 0; i < count; i += 1) {
      spineValues[i] = (i % dorsal.count) / (dorsal.count - 1);
    }
    geometry.setAttribute("aSpine", new THREE.InstancedBufferAttribute(spineValues, 1));
    const material = new THREE.MeshPhysicalMaterial({
      color: dorsal.type === "plate" ? this.skin.plate : this.skin.backDark,
      roughness: 0.45,
      clearcoat: 0.4,
      emissive: this.skin.glow,
      emissiveIntensity: 1,
    });
    addGlowSweep(material);
    this.dorsalMaterial = material;
    this.dorsal = new THREE.InstancedMesh(geometry, material, count);
    this.dorsal.castShadow = true;
    this.dorsal.frustumCulled = false;
    this.dorsalCount = count;
    this.group.add(this.dorsal);
  }

  // motion: { speed (model units/s), turnRate (rad/s), mouthOpen, roar, glow, glowFront, lookYaw }
  update(dt, motion) {
    this.motion = motion;
    this.time += dt;
    const gait = this.form.gait;
    const targetMove = smoothstep(0.02, gait.stride * 1.4, motion.speed);
    this.moveAmount = lerp(this.moveAmount, targetMove, 1 - Math.exp(-dt * 8));
    this.turn = lerp(this.turn, THREE.MathUtils.clamp(motion.turnRate, -4, 4), 1 - Math.exp(-dt * 6));
    // Faster running makes longer strides, not faster legs: past maxHz steps per second
    // the legs would blur into a jitter at 60 frames per second.
    this.stride = Math.max(gait.stride, motion.speed / gait.maxHz);
    this.phase = (this.phase + (motion.speed * dt) / this.stride) % 1;

    this.blinkTimer -= dt;
    if (this.blinkTimer < 0) {
      this.blink = 0.14;
      this.blinkTimer = 2 + Math.random() * 3.5;
    }
    this.blink = Math.max(0, this.blink - dt);

    this.hat?.userData.update?.(dt);
    this.animateKeys();
    this.sampleSpine();
    this.writeBody();
    this.placeHead();
    this.placeLegs();
    this.placeDorsal();
  }

  animateKeys() {
    const { form, keys, restKeys } = this;
    const gait = form.gait;
    const wave = Math.PI * 2 * this.phase;
    const upright = form.posture === "upright";
    const breathe = Math.sin(this.time * 2.3) * 0.028;
    const idleWag = Math.sin(this.time * 1.4) * (1 - this.moveAmount);
    const stepBob = upright ? -Math.abs(Math.sin(wave)) * gait.bob * this.moveAmount : Math.sin(wave * 2) * gait.bob * this.moveAmount;
    const roarLift = this.motion.roar * 0.06;
    for (let i = 0; i < this.keyCount; i += 1) {
      const rest = restKeys[i];
      const along = this.keyBody[i]; // 0 tail tip, 1 neck end
      const tailness = Math.max(0, (HIP_KEY - i) / HIP_KEY);
      const swayShape = upright ? tailness * 1.4 : 0.45 + 1.1 * Math.pow(1 - along, 1.4);
      let x = rest.x + gait.sway * this.moveAmount * swayShape * Math.sin(wave - (1 - along) * 3.2);
      x += idleWag * 0.05 * tailness * tailness * Math.sin(this.time * 1.1 - along * 4);
      // Turning curves the whole body into an arc toward the turn.
      x += this.turn * 0.05 * rest.z * rest.z;
      const torsoness = i >= HIP_KEY && i <= SHOULDER_KEY ? 1 : 0.4;
      const offset = i * KEY_CHANNELS;
      keys[offset] = x;
      keys[offset + 1] = rest.y + (i >= HIP_KEY ? stepBob : stepBob * (1 - tailness)) + (i > SHOULDER_KEY ? roarLift : 0);
      keys[offset + 2] = rest.z;
      keys[offset + 3] = rest.w * (1 + breathe * torsoness);
      keys[offset + 4] = rest.h * (1 + breathe * torsoness * 1.2);
    }
  }

  sampleSpine() {
    const { keys, dense, denseArc, keyCount } = this;
    let d = 0;
    for (let segment = 0; segment < keyCount - 1; segment += 1) {
      const i0 = Math.max(segment - 1, 0) * KEY_CHANNELS;
      const i1 = segment * KEY_CHANNELS;
      const i2 = (segment + 1) * KEY_CHANNELS;
      const i3 = Math.min(segment + 2, keyCount - 1) * KEY_CHANNELS;
      const steps = segment === keyCount - 2 ? DENSE_STEPS + 1 : DENSE_STEPS;
      for (let s = 0; s < steps; s += 1) {
        const t = s / DENSE_STEPS;
        for (let c = 0; c < KEY_CHANNELS; c += 1) {
          dense[d * KEY_CHANNELS + c] = catmullRom(keys[i0 + c], keys[i1 + c], keys[i2 + c], keys[i3 + c], t);
        }
        if (d === 0) {
          denseArc[0] = 0;
        } else {
          const dx = dense[d * KEY_CHANNELS] - dense[(d - 1) * KEY_CHANNELS];
          const dy = dense[d * KEY_CHANNELS + 1] - dense[(d - 1) * KEY_CHANNELS + 1];
          const dz = dense[d * KEY_CHANNELS + 2] - dense[(d - 1) * KEY_CHANNELS + 2];
          denseArc[d] = denseArc[d - 1] + Math.hypot(dx, dy, dz);
        }
        d += 1;
      }
    }
    const total = denseArc[d - 1];
    let cursor = 0;
    for (let r = 0; r < RING_COUNT; r += 1) {
      const arc = (total * r) / (RING_COUNT - 1);
      while (cursor < d - 2 && denseArc[cursor + 1] < arc) cursor += 1;
      const span = denseArc[cursor + 1] - denseArc[cursor];
      const t = span > 0 ? Math.min(1, (arc - denseArc[cursor]) / span) : 0;
      const a = cursor * KEY_CHANNELS;
      const b = a + KEY_CHANNELS;
      this.ringCenter[r * 3] = lerp(dense[a], dense[b], t);
      this.ringCenter[r * 3 + 1] = lerp(dense[a + 1], dense[b + 1], t);
      this.ringCenter[r * 3 + 2] = lerp(dense[a + 2], dense[b + 2], t);
      this.ringSize[r * 2] = lerp(dense[a + 3], dense[b + 3], t);
      this.ringSize[r * 2 + 1] = lerp(dense[a + 4], dense[b + 4], t);
    }
    for (let r = 0; r < RING_COUNT; r += 1) {
      const prev = Math.max(r - 1, 0) * 3;
      const next = Math.min(r + 1, RING_COUNT - 1) * 3;
      const tx = this.ringCenter[next] - this.ringCenter[prev];
      const ty = this.ringCenter[next + 1] - this.ringCenter[prev + 1];
      const tz = this.ringCenter[next + 2] - this.ringCenter[prev + 2];
      const length = Math.hypot(tx, ty, tz) || 1;
      this.ringTangent[r * 3] = tx / length;
      this.ringTangent[r * 3 + 1] = ty / length;
      this.ringTangent[r * 3 + 2] = tz / length;
    }
  }

  // Frame at ring r: tangent toward the head, side toward the lizard's left (+X at rest), up.
  ringFrame(r, tangent, side, up) {
    tangent.fromArray(this.ringTangent, r * 3);
    side.crossVectors(UP, tangent).normalize();
    up.crossVectors(tangent, side).normalize();
  }

  // Interpolated spine point and frame at body fraction s (0 tail tip, 1 neck end).
  spineAt(s, center, tangent, side, up) {
    const position = THREE.MathUtils.clamp(s, 0, 1) * (RING_COUNT - 1);
    const r = Math.min(Math.floor(position), RING_COUNT - 2);
    const t = position - r;
    center.fromArray(this.ringCenter, r * 3).lerp(this.temp.c.fromArray(this.ringCenter, (r + 1) * 3), t);
    this.ringFrame(t < 0.5 ? r : r + 1, tangent, side, up);
    return {
      width: lerp(this.ringSize[r * 2], this.ringSize[(r + 1) * 2], t),
      height: lerp(this.ringSize[r * 2 + 1], this.ringSize[(r + 1) * 2 + 1], t),
    };
  }

  writeBody() {
    const position = this.bodyGeometry.attributes.position.array;
    const normal = this.bodyGeometry.attributes.normal.array;
    const { tangent, side, up } = this.temp;
    const belly = this.form.belly;
    const ringVerts = RING_SIDES + 1;
    for (let r = 0; r < RING_COUNT; r += 1) {
      this.ringFrame(r, tangent, side, up);
      const cx = this.ringCenter[r * 3];
      const cy = this.ringCenter[r * 3 + 1];
      const cz = this.ringCenter[r * 3 + 2];
      const width = this.ringSize[r * 2];
      const height = this.ringSize[r * 2 + 1];
      const prev = Math.max(r - 1, 0);
      const next = Math.min(r + 1, RING_COUNT - 1);
      const slope = (this.ringSize[next * 2] - this.ringSize[prev * 2]) / Math.max(width, 1e-3);
      for (let j = 0; j <= RING_SIDES; j += 1) {
        const cos = this.ringCos[j];
        const sin = this.ringSin[j];
        const h = sin >= 0 ? height : height * belly;
        const ridge = sin > 0 ? Math.pow(sin, 8) * width * 0.08 : 0;
        const ox = side.x * cos * width + up.x * (sin * h + ridge);
        const oy = side.y * cos * width + up.y * (sin * h + ridge);
        const oz = side.z * cos * width + up.z * (sin * h + ridge);
        const index = (r * ringVerts + j) * 3;
        position[index] = cx + ox;
        position[index + 1] = cy + oy;
        position[index + 2] = cz + oz;
        let nx = side.x * (cos / width) + up.x * (sin / h);
        let ny = side.y * (cos / width) + up.y * (sin / h);
        let nz = side.z * (cos / width) + up.z * (sin / h);
        const nLength = Math.hypot(nx, ny, nz) || 1;
        nx = nx / nLength - tangent.x * slope * 0.5;
        ny = ny / nLength - tangent.y * slope * 0.5;
        nz = nz / nLength - tangent.z * slope * 0.5;
        const length = Math.hypot(nx, ny, nz) || 1;
        normal[index] = nx / length;
        normal[index + 1] = ny / length;
        normal[index + 2] = nz / length;
      }
    }
    const tailCenter = RING_COUNT * ringVerts * 3;
    const neckCenter = tailCenter + 3;
    const last = (RING_COUNT - 1) * 3;
    for (let c = 0; c < 3; c += 1) {
      position[tailCenter + c] = this.ringCenter[c] - this.ringTangent[c] * 0.004;
      normal[tailCenter + c] = -this.ringTangent[c];
      position[neckCenter + c] = this.ringCenter[last + c];
      normal[neckCenter + c] = this.ringTangent[last + c];
    }
    this.bodyGeometry.attributes.position.needsUpdate = true;
    this.bodyGeometry.attributes.normal.needsUpdate = true;
  }

  placeHead() {
    const { form, motion } = this;
    const last = (RING_COUNT - 1) * 3;
    this.headPivot.position.fromArray(this.ringCenter, last);
    const tangentX = this.ringTangent[last];
    const tangentZ = this.ringTangent[last + 2];
    const yaw = Math.atan2(tangentX, tangentZ) * 0.6 + this.turn * 0.08 + (motion.lookYaw ?? 0);
    const pitch = form.head.pitch + motion.roar * 0.55 - motion.mouthOpen * 0.08;
    this.headPivot.rotation.set(-pitch, yaw, 0, "YXZ");
    const nod = Math.sin(this.time * 2.3) * 0.015;
    this.headPivot.rotation.x += nod;
    const open = Math.max(motion.mouthOpen, motion.roar);
    this.jawPivot.rotation.x = open * 0.62 + Math.max(0, Math.sin(this.time * 2.3)) * 0.02;
    const blinkScale = this.blink > 0 ? 0.12 : 1;
    for (const eye of this.eyes) eye.scale.set(1, blinkScale, 1);
    if (this.frillPivot) {
      const spread = smoothstep(0, 1, Math.max(open, motion.roar));
      const scale = lerp(0.5, 1.05, spread);
      this.frillPivot.scale.set(scale, scale, scale);
      this.frillPivot.rotation.x = lerp(-1.15, -0.12, spread);
    }
  }

  placeLegs() {
    const { form, temp } = this;
    const gait = form.gait;
    const upright = form.posture === "upright";
    const hip = temp.a;
    const keys = this.keys;
    for (const leg of this.legs) {
      const { spec, side } = leg;
      // Root: between hip and shoulder keys, pushed out to the side of the body.
      const attachKeyA = leg.front ? MID_KEY : HIP_KEY;
      const attachKeyB = leg.front ? SHOULDER_KEY : MID_KEY;
      const attach = leg.front ? (spec.attach - 0.5) * 2 : spec.attach * 2;
      const a = attachKeyA * KEY_CHANNELS;
      const b = attachKeyB * KEY_CHANNELS;
      hip.set(lerp(keys[a], keys[b], attach), lerp(keys[a + 1], keys[b + 1], attach), lerp(keys[a + 2], keys[b + 2], attach));
      const bodyWidth = lerp(keys[a + 3], keys[b + 3], attach);
      const bodyHeight = lerp(keys[a + 4], keys[b + 4], attach);
      temp.tangent.set(keys[b] - keys[a], keys[b + 1] - keys[a + 1], keys[b + 2] - keys[a + 2]).normalize();
      temp.side.crossVectors(UP, temp.tangent).normalize();
      leg.root.copy(hip).addScaledVector(temp.side, side * bodyWidth * 0.72).addScaledVector(UP, -bodyHeight * 0.25);

      const legPhase = (this.phase + leg.phase) % 1;
      const stance = legPhase < 0.5;
      const swing = stance ? 0 : (legPhase - 0.5) / 0.5;
      // Feet swing as far as the legs can comfortably reach; beyond that they slide.
      const stride = Math.min(this.stride / 4, (spec.upper + spec.lower) * 0.55) * this.moveAmount;
      const reach = stance ? lerp(stride, -stride, legPhase / 0.5) : lerp(-stride, stride, smoothstep(0, 1, swing));
      const lift = stance ? 0 : Math.sin(Math.PI * swing) * gait.lift * this.moveAmount;

      if (leg.isArm) {
        const swingArm = Math.sin(Math.PI * 2 * legPhase) * 0.05 * this.moveAmount;
        const reachUp = this.motion.roar * 0.12;
        leg.target.copy(leg.root).add(temp.b.set(side * 0.04, -(spec.upper + spec.lower) * 0.55 + reachUp, spec.forward + swingArm));
        leg.pole.set(side * 0.4, -0.3, -1).normalize();
      } else {
        const footHeight = spec.radius * 0.55;
        if (upright) {
          leg.target.set(side * spec.spread, footHeight + lift, hip.z + spec.forward + reach);
          leg.pole.set(side * 0.2, 0.1, 1).normalize();
        } else {
          leg.target.set(leg.root.x + side * spec.spread, footHeight + lift, leg.root.z + spec.forward + reach);
          leg.pole.set(side * 0.9, 1.1, leg.front ? -0.25 : 0.25).normalize();
        }
      }

      solveTwoBone(leg.root, leg.target, spec.upper, spec.lower, leg.pole, leg.kneePoint, leg.endPoint);
      placeSegment(leg.upper, leg.root, leg.kneePoint);
      placeSegment(leg.lower, leg.kneePoint, leg.endPoint);
      leg.hipJoint.position.copy(leg.root);
      leg.knee.position.copy(leg.kneePoint);
      leg.ankle.position.copy(leg.endPoint);
      leg.foot.position.copy(leg.endPoint);
      const footPitch = leg.isArm ? 0.9 : stance ? 0 : -0.35 * Math.sin(Math.PI * swing) * this.moveAmount;
      leg.foot.rotation.set(footPitch, leg.foot.userData.yaw, 0, "YXZ");
    }
  }

  placeDorsal() {
    if (!this.dorsal) return;
    const dorsal = this.form.dorsal;
    const { position, quaternion, tilt, basis, scale, matrix, tangent, side, up } = this.temp;
    let instance = 0;
    for (let row = 0; row < dorsal.rows; row += 1) {
      const rowSide = row === 0 ? 0 : row === 1 ? -1 : 1;
      for (let i = 0; i < dorsal.count; i += 1) {
        const along = i / (dorsal.count - 1);
        const s = lerp(dorsal.from, dorsal.to, along);
        const size = this.spineAt(s, position, tangent, side, up);
        // Biggest over the shoulders, smaller toward tail tip and neck.
        const profile = Math.pow(Math.sin(Math.PI * Math.min(1, along * 0.85 + 0.08)), 0.7);
        const rowScale = row === 0 ? 1 : 0.62;
        const height = dorsal.size * (0.35 + 0.65 * profile) * rowScale;
        position.addScaledVector(up, size.height * (row === 0 ? 0.86 : 0.72)).addScaledVector(side, rowSide * size.width * 0.38);
        basis.makeBasis(side, up, tangent);
        quaternion.setFromRotationMatrix(basis);
        if (rowSide !== 0) {
          quaternion.multiply(tilt.setFromAxisAngle(this.temp.b.set(0, 0, 1), -rowSide * 0.42));
        }
        scale.set(height, height, height);
        matrix.compose(position, quaternion, scale);
        this.dorsal.setMatrixAt(instance, matrix);
        instance += 1;
      }
    }
    this.dorsal.instanceMatrix.needsUpdate = true;
    this.dorsalMaterial.userData.glow.value = this.motion.glow ?? 0;
    this.dorsalMaterial.userData.glowFront.value = this.motion.glowFront ?? 1.2;
  }

  dispose() {
    // Geometry and materials of everything attached, including the hat.
    const materials = new Set([...Object.values(this.materials), this.dorsalMaterial, this.xrayMaterial]);
    this.group.traverse((object) => {
      if (object.geometry) object.geometry.dispose();
      if (object.material) materials.add(object.material);
    });
    for (const material of materials) {
      if (!material) continue;
      material.map?.dispose();
      material.bumpMap?.dispose();
      material.emissiveMap?.dispose();
      material.dispose();
    }
  }
}
