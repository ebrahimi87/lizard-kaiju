import * as THREE from "three";
import { paintEye } from "../lizard/LizardSkin.js";

const TAU = Math.PI * 2;
const UP = new THREE.Vector3(0, 1, 0);
const clamp = THREE.MathUtils.clamp;
const mix = THREE.MathUtils.lerp;
const smooth = (t) => { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };

function toy(color) {
  return new THREE.MeshPhysicalMaterial({ color, roughness: 0.48, clearcoat: 0.35, clearcoatRoughness: 0.4 });
}

function ball(parent, material, x, y, z, sx, sy = sx, sz = sx) {
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 16), material);
  mesh.position.set(x, y, z);
  mesh.scale.set(sx, sy, sz);
  mesh.castShadow = true;
  parent.add(mesh);
  return mesh;
}

function rod(parent, material, radius, length) {
  const mesh = new THREE.Mesh(new THREE.CapsuleGeometry(radius, length, 4, 12), material);
  mesh.castShadow = true;
  parent.add(mesh);
  return mesh;
}

function release(group) {
  const geometries = new Set();
  const materials = new Set();
  const textures = new Set();
  group.traverse((node) => {
    if (node.geometry) geometries.add(node.geometry);
    if (node.material) materials.add(node.material);
  });
  for (const material of materials) {
    if (material.map) textures.add(material.map);
    material.dispose();
  }
  for (const geometry of geometries) geometry.dispose();
  for (const texture of textures) texture.dispose();
}

function netMaterial() {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 128;
  const ctx = canvas.getContext("2d");
  ctx.strokeStyle = "#f3f6da";
  ctx.lineWidth = 2.5;
  for (let i = -128; i <= 256; i += 16) {
    ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i + 128, 128); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i - 128, 128); ctx.stroke();
  }
  const map = new THREE.CanvasTexture(canvas);
  map.colorSpace = THREE.SRGBColorSpace;
  return new THREE.MeshPhysicalMaterial({ map, transparent: true, opacity: 0.68, alphaTest: 0.12, depthWrite: false, side: THREE.DoubleSide, roughness: 0.7 });
}

function hoop(parent, radius, material) {
  const mesh = new THREE.Mesh(new THREE.TorusGeometry(radius, 0.025, 8, 48), material);
  mesh.rotation.x = Math.PI / 2;
  parent.add(mesh);
  return mesh;
}

function starGeometry() {
  const shape = new THREE.Shape();
  for (let i = 0; i < 10; i++) {
    const a = i * Math.PI / 5;
    const r = i % 2 ? 0.045 : 0.105;
    if (i === 0) shape.moveTo(Math.sin(a) * r, Math.cos(a) * r);
    else shape.lineTo(Math.sin(a) * r, Math.cos(a) * r);
  }
  shape.closePath();
  return new THREE.ExtrudeGeometry(shape, { depth: 0.035, bevelEnabled: false });
}

const REST = { y: 0, pitch: 0, roll: 0, yaw: 0, headYaw: 0, leftLeg: 0, rightLeg: 0, leftArm: 0, armOut: 0.12, netX: 0.82, netY: 0.95, netZ: 0.18, netPitch: 0.85, netRoll: 0, hat: 0, stars: 0, chute: 0 };

// All animation is local to body. The public group stays under game control.
export class CatcherModel {
  constructor({ outfit = "safari" } = {}) {
    this.group = new THREE.Group();
    this.group.name = `catcher-${outfit}`;
    this.body = new THREE.Group();
    this.group.add(this.body);
    this.time = 0;
    this.phase = 0;
    this.pose = { ...REST };
    this.target = { ...REST };
    this.channels = Object.keys(REST);
    this.b = new THREE.Vector3();
    this.direction = new THREE.Vector3();
    this.skin = toy("#f3b184");
    this.khaki = toy("#dfba64");
    this.shorts = toy("#90713e");
    this.dark = toy("#503026");
    this.red = toy("#e6463c");
    this.boot = toy("#61412c");
    this.wood = toy("#bd773a");
    this.cream = toy("#fff0b7");
    this.gold = toy("#ffc21c");
    this.createBody();
    this.createFace();
    this.createNet();
    this.createExtras();
    this.update(0, { state: "idle", speed: 0, stateTime: 0 });
  }

  createBody() {
    ball(this.body, this.khaki, 0, 0.78, 0, 0.34, 0.39, 0.28);
    ball(this.body, this.shorts, 0, 0.49, -0.01, 0.3, 0.19, 0.24);
    // A bright neckerchief and a belt with a gold buckle keep the safari outfit readable.
    // (Round pockets read as a second pair of eyes from the game camera.)
    ball(this.body, this.red, 0, 1.03, 0.18, 0.2, 0.055, 0.1);
    ball(this.body, this.red, 0.02, 0.91, 0.274, 0.06, 0.13, 0.035).rotation.z = -0.2;
    ball(this.body, this.boot, 0, 0.6, 0, 0.335, 0.05, 0.27);
    ball(this.body, this.gold, 0, 0.6, 0.262, 0.06, 0.05, 0.025);
    this.pantsAnchor = new THREE.Object3D();
    this.pantsAnchor.position.set(0, 0.48, -0.23);
    this.body.add(this.pantsAnchor);
    this.legs = [];
    for (const s of [-1, 1]) {
      const leg = new THREE.Group();
      leg.position.set(s * 0.175, 0.48, 0);
      this.body.add(leg);
      ball(leg, this.shorts, 0, -0.075, 0, 0.14, 0.16, 0.15);
      ball(leg, this.skin, 0, -0.23, 0, 0.085, 0.14, 0.085);
      ball(leg, this.boot, 0, -0.36, 0.055, 0.135, 0.12, 0.19);
      ball(leg, this.dark, 0, -0.437, 0.065, 0.14, 0.04, 0.195);
      this.legs.push(leg);
    }
    this.leftArm = new THREE.Group();
    this.leftArm.position.set(-0.3, 0.95, 0);
    this.body.add(this.leftArm);
    ball(this.leftArm, this.khaki, -0.035, -0.07, 0, 0.145, 0.16, 0.14);
    ball(this.leftArm, this.skin, -0.04, -0.25, 0, 0.085, 0.2, 0.09);
    ball(this.leftArm, this.skin, -0.04, -0.43, 0.015, 0.105, 0.105, 0.1);
    this.rightSleeve = ball(this.body, this.khaki, 0.3, 0.96, 0, 0.14, 0.15, 0.14);
    this.rightUpper = rod(this.body, this.skin, 0.08, 1);
    this.rightLower = rod(this.body, this.skin, 0.075, 1);
    this.hand = ball(this.body, this.skin, 0, 0, 0, 0.105);
  }

  createFace() {
    this.head = new THREE.Group();
    this.head.position.set(0, 1.3, 0.025);
    this.body.add(this.head);
    ball(this.head, this.skin, 0, 0, 0, 0.355, 0.34, 0.305);
    for (const s of [-1, 1]) {
      ball(this.head, this.skin, s * 0.35, -0.035, 0, 0.085, 0.115, 0.065);
      ball(this.head, toy("#ee8377"), s * 0.23, -0.10, 0.231, 0.09, 0.055, 0.025);
    }
    const eyeMaterial = new THREE.MeshPhysicalMaterial({ map: paintEye("#4b9d9a", 0.9), roughness: 0.12, clearcoat: 1 });
    this.eyes = [];
    for (const s of [-1, 1]) {
      const eye = ball(this.head, eyeMaterial, s * 0.145, 0.065, 0.255, 0.13, 0.145, 0.115);
      eye.rotation.x = -0.15;
      eye.rotation.y = s * 0.12;
      this.eyes.push(eye);
      const brow = ball(this.head, this.dark, s * 0.145, 0.207, 0.25, 0.105, 0.026, 0.04);
      brow.rotation.z = s * 0.18;
      // Three overlapping lobes per half make a bushy curled mustache.
      for (let i = 0; i < 3; i++) {
        const tuft = ball(this.head, this.dark, s * (0.065 + i * 0.057), -0.12 + i * 0.008, 0.305 - i * 0.015, 0.085 - i * 0.012, 0.058 - i * 0.01, 0.045);
        tuft.rotation.z = s * (0.2 + i * 0.2);
      }
    }
    ball(this.head, this.dark, 0, -0.205, 0.24, 0.085, 0.045, 0.035);
    ball(this.head, this.cream, 0, -0.19, 0.269, 0.065, 0.014, 0.012);
    ball(this.head, this.skin, 0, -0.025, 0.36, 0.105, 0.085, 0.11);
    this.hatAnchor = new THREE.Object3D();
    this.hatAnchor.position.y = 0.3;
    this.head.add(this.hatAnchor);
    this.hat = new THREE.Group();
    this.hatAnchor.add(this.hat);
    ball(this.hat, this.khaki, 0, 0, 0, 0.46, 0.047, 0.385);
    ball(this.hat, this.khaki, 0, 0.08, -0.025, 0.3, 0.18, 0.27);
    ball(this.hat, this.red, 0, 0.035, -0.025, 0.309, 0.055, 0.279);
    ball(this.hat, this.cream, 0, 0.05, 0.253, 0.052, 0.048, 0.018);
  }

  createNet() {
    this.net = new THREE.Group();
    this.body.add(this.net);
    const pole = rod(this.net, this.wood, 0.027, 1.16);
    pole.position.set(0, 0.42, -0.205);
    pole.rotation.x = -Math.atan2(0.46, 0.94);
    this.netHead = new THREE.Object3D();
    this.netHead.position.y = 0.94;
    this.net.add(this.netHead);
    hoop(this.netHead, 0.46, this.red);
    const bag = new THREE.Mesh(new THREE.SphereGeometry(0.46, 32, 16, 0, TAU, 0, Math.PI / 2), netMaterial());
    bag.scale.y = 1.4;
    bag.rotation.x = Math.PI;
    this.netHead.add(bag);
  }

  createExtras() {
    this.stars = new THREE.Group();
    this.stars.position.y = 1.95;
    this.body.add(this.stars);
    const starMaterial = toy("#ffcc26");
    starMaterial.emissive.set("#9d5900");
    starMaterial.emissiveIntensity = 0.25;
    for (let i = 0; i < 5; i++) {
      const star = new THREE.Mesh(starGeometry(), starMaterial);
      const a = i * TAU / 5;
      star.position.set(Math.cos(a) * 0.43, Math.sin(a * 2) * 0.06, Math.sin(a) * 0.43);
      star.rotation.set(-0.3, a, 0.15);
      this.stars.add(star);
    }
    this.parachute = new THREE.Group();
    this.body.add(this.parachute);
    const white = toy("#fff6df");
    for (let i = 0; i < 12; i++) {
      const panel = new THREE.Mesh(new THREE.SphereGeometry(1, 6, 12, i * TAU / 12, TAU / 12, 0, Math.PI / 2), i % 2 ? white : this.red);
      panel.scale.set(1.1, 0.54, 1.1);
      panel.position.y = 3;
      panel.material.side = THREE.DoubleSide;
      this.parachute.add(panel);
    }
    for (let i = 0; i < 6; i++) {
      const a = i * TAU / 6;
      const line = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(Math.cos(a) * 0.29, 1.0, Math.sin(a) * 0.2), new THREE.Vector3(Math.cos(a) * 1.1, 3, Math.sin(a) * 1.1)]);
      this.parachute.add(new THREE.Line(line, new THREE.LineBasicMaterial({ color: "#fff1ce" })));
    }
  }

  segment(mesh, ax, ay, az, bx, by, bz) {
    this.direction.set(bx - ax, by - ay, bz - az);
    const length = this.direction.length();
    mesh.position.set((ax + bx) / 2, (ay + by) / 2, (az + bz) / 2);
    mesh.quaternion.setFromUnitVectors(UP, this.direction.multiplyScalar(1 / Math.max(length, 0.001)));
    mesh.scale.y = length / 1.16;
  }

  update(dt, { speed = 0, state = "idle", stateTime = 0 } = {}) {
    this.time += dt;
    this.phase += dt * (4 + Math.max(0, speed) * 3.5);
    const t = this.time;
    const wave = Math.sin(this.phase);
    const p = this.target;
    Object.assign(p, REST);
    p.y = Math.sin(t * 2.5) * 0.012;
    p.headYaw = Math.sin(t * 0.8) * 0.18;
    if (state === "run" || state === "hotPants") {
      p.leftLeg = wave * 0.65; p.rightLeg = -wave * 0.65;
      p.leftArm = -wave * 0.7;
      p.pitch = 0.13; p.y = Math.abs(wave) * 0.065;
      p.netX = 0.56; p.netPitch = 1.15; p.netY = 0.93; p.netZ = 0.22;
      if (state === "hotPants") {
        p.y += Math.abs(Math.sin(t * 13)) * 0.18;
        p.leftArm = 0.8; p.armOut = -0.5;
        p.roll = Math.sin(t * 15) * 0.13; p.netRoll = Math.sin(t * 13) * 0.25;
      }
    } else if (state === "windup") {
      const f = smooth(stateTime / 0.8);
      p.netX = 0.42;
      p.pitch = -0.16 * f; p.netPitch = mix(0.85, -0.65, f);
      p.netY = mix(0.95, 1.65, f); p.netZ = mix(0.18, -0.02, f);
      p.leftArm = -2.5 * f; p.armOut = 0.4;
    } else if (state === "swing" || state === "netStuck") {
      const f = state === "netStuck" ? 1 : smooth(stateTime / 0.25);
      p.netX = 0.25;
      p.netPitch = mix(-0.65, Math.PI, f);
      p.netY = mix(1.65, 0.99, f); p.netZ = mix(-0.02, 1.2, f);
      p.y = 0; p.pitch = 0; p.leftArm = -1.1;
      if (state === "netStuck") { p.roll = Math.sin(t * 16) * 0.04; p.y = Math.abs(Math.sin(t * 8)) * 0.04; p.netY += Math.sin(t * 16) * 0.012; }
    } else if (state === "slipping") {
      p.leftLeg = -0.8; p.rightLeg = 0.9; p.roll = Math.sin(t * 9) * 0.3;
      p.yaw = stateTime * TAU; p.leftArm = stateTime * 15; p.armOut = 1;
      p.netRoll = Math.sin(t * 13) * 1.2;
    } else if (state === "dizzy") {
      p.roll = Math.sin(t * 5) * 0.19; p.headYaw = Math.sin(t * 4) * 0.4; p.stars = 1;
      p.netPitch = 1.6; p.netY = 0.7;
    } else if (state === "cheer") {
      p.y = Math.abs(Math.sin(t * 6)) * 0.16; p.leftArm = -2.8 + Math.sin(t * 9) * 0.25;
      p.armOut = 0.35;
    } else if (state === "defeated") {
      const f = smooth(stateTime / 0.5);
      p.y = -0.31 * f; p.pitch = -0.18 * f;
      p.leftLeg = -1.3 * f; p.rightLeg = -1.3 * f;
      p.leftArm = -0.7; p.netPitch = Math.PI / 2; p.netY = 0.62; p.netZ = 0.4; p.stars = f; p.hat = f;
    } else if (state === "parachute") {
      p.chute = 1; p.y = 0.25 + Math.sin(t * 2) * 0.08;
      p.roll = Math.sin(t * 2) * 0.07; p.leftLeg = wave * 0.4; p.rightLeg = -wave * 0.4;
      p.leftArm = -2.7 + Math.sin(t * 12) * 0.25; p.armOut = 0.35;
    }
    const blend = 1 - Math.exp(-dt * (state === "swing" ? 40 : 22));
    for (const key of this.channels) {
      if (key === "yaw" || key === "leftArm") {
        const delta = p[key] - this.pose[key];
        this.pose[key] += Math.atan2(Math.sin(delta), Math.cos(delta)) * blend;
      } else this.pose[key] = mix(this.pose[key], p[key], blend);
    }
    const q = this.pose;
    this.body.position.y = q.y;
    this.body.rotation.set(q.pitch, q.yaw, q.roll, "YXZ");
    this.head.rotation.y = q.headYaw;
    this.legs[0].rotation.x = q.leftLeg;
    this.legs[1].rotation.x = q.rightLeg;
    this.leftArm.rotation.set(q.leftArm, 0, -q.armOut);
    this.net.position.set(q.netX, q.netY, q.netZ);
    this.net.rotation.set(q.netPitch, 0, q.netRoll);
    this.b.set(0, 0, 0).applyEuler(this.net.rotation).add(this.net.position);
    this.hand.position.copy(this.b);
    // The bent elbow reaches between the shoulder and the pole grip.
    const ex = Math.max(0.43, (0.3 + this.b.x) * 0.5 + 0.08);
    const ey = (0.96 + this.b.y) * 0.5 - 0.09;
    const ez = this.b.z * 0.5 - 0.08;
    this.segment(this.rightUpper, 0.3, 0.96, 0, ex, ey, ez);
    this.segment(this.rightLower, ex, ey, ez, this.b.x, this.b.y, this.b.z);
    this.hat.position.set(q.hat * 0.85, -q.hat * 0.78 + Math.sin(Math.min(stateTime, 0.8) / 0.8 * Math.PI) * q.hat * 0.4, -q.hat * 0.35);
    this.hat.rotation.z = q.hat * 1.1;
    this.stars.visible = q.stars > 0.01;
    this.stars.scale.setScalar(Math.max(0.001, q.stars));
    this.stars.rotation.y = t * 2.5;
    this.parachute.visible = q.chute > 0.01;
    this.parachute.scale.setScalar(Math.max(0.001, q.chute));
    this.net.scale.setScalar(Math.max(0.001, 1 - q.chute));
    this.net.visible = q.chute < 0.99;
    const blink = Math.sin(t * 1.9) > 0.995 ? 0.15 : 1;
    for (const eye of this.eyes) eye.scale.y = 0.145 * blink;
  }

  dispose() { release(this.group); }
}

// Eight separate net wedges let the caught dome break into readable flying pieces.
export function createNetDome() {
  const group = new THREE.Group();
  const fabric = netMaterial();
  const rimMaterial = toy("#dc5140");
  const pieces = [];
  for (let i = 0; i < 8; i++) {
    const piece = new THREE.Group();
    const a = i * TAU / 8;
    const material = fabric.clone();
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(1, 8, 12, a, TAU / 8, 0, Math.PI / 2), material);
    mesh.scale.y = 0.78;
    piece.add(mesh);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(1, 0.025, 6, 8, TAU / 8), rimMaterial.clone());
    rim.rotation.set(Math.PI / 2, 0, Math.PI - a - TAU / 8);
    piece.add(rim);
    group.add(piece);
    pieces.push({ piece, material, rimMaterial: rim.material, x: -Math.cos(a + Math.PI / 8), z: Math.sin(a + Math.PI / 8) });
  }
  // The prototype materials are not attached to the scene.
  fabric.dispose(); rimMaterial.dispose();
  const pole = rod(group, toy("#bd773a"), 0.035, 1.5);
  pole.position.set(0, 0.48, -1.62);
  pole.rotation.x = -0.95;
  let time = 0;
  let burstTime = -1;
  return {
    group,
    update(dt, { struggle = 0, burst = false } = {}) {
      time += dt;
      if (burst && burstTime < 0) burstTime = 0;
      if (burstTime >= 0) burstTime += dt;
      const f = burstTime < 0 ? 0 : clamp(burstTime / 0.6, 0, 1);
      const wiggle = struggle * (1 - f);
      group.rotation.set(Math.sin(time * 24) * wiggle * 0.055, 0, Math.cos(time * 19) * wiggle * 0.065);
      group.position.y = Math.abs(Math.sin(time * 18)) * wiggle * 0.06;
      for (const { piece, material, rimMaterial, x, z } of pieces) {
        piece.position.set(x * f * 1.5, Math.sin(f * Math.PI) * 0.7, z * f * 1.5);
        piece.rotation.set(z * f * 1.3, f * x, x * f * 1.2);
        material.opacity = 0.68 * (1 - f);
        rimMaterial.transparent = f > 0;
        rimMaterial.opacity = 1 - f;
      }
      pole.visible = f < 1;
      pole.position.y = 0.48 + f * 1.2;
      pole.rotation.z = f * 1.8;
      group.visible = f < 1;
    },
    dispose() { release(group); },
  };
}
