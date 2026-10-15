import * as THREE from "three";
import { smoothstep } from "./CritterParts.js";

// The catcher's wooden cage with a little red roof and a padlock. Fire burns it open:
//   const cage = createCageModel();   → { group, radius, update(dt), setBurn(amount), dispose() }
//   setBurn(0.5)   wood chars and the bars glow orange
//   setBurn(1)     the cage breaks: pieces tumble outward and fade over BREAK_TIME
// Inside space: about 1.1 × 1.1 × 0.95, enough for a buddy of size ~1.

const BREAK_TIME = 0.8;
const HALF = 0.6;
const TOP = 1.05;
const CHAR = new THREE.Color("#2a1a14");

// Box with rounded edges: a beveled extrusion so the cage looks like a toy.
function roundedBox(width, height, depth, bevel) {
  const shape = new THREE.Shape();
  const w = width / 2 - bevel;
  const h = height / 2 - bevel;
  shape.moveTo(-w, -h);
  shape.lineTo(w, -h);
  shape.lineTo(w, h);
  shape.lineTo(-w, h);
  shape.closePath();
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: depth - bevel * 2,
    bevelEnabled: true,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelSegments: 2,
    curveSegments: 4,
  });
  geometry.translate(0, 0, -(depth - bevel * 2) / 2);
  return geometry;
}

// Ember cracks: mostly black with bright orange streaks, used as the emissive map so
// burning wood glows in lines instead of as one flat color.
function paintEmbers() {
  const size = 128;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext("2d");
  context.fillStyle = "#000000";
  context.fillRect(0, 0, size, size);
  context.lineCap = "round";
  for (let i = 0; i < 9; i += 1) {
    context.strokeStyle = i % 3 === 0 ? "#ffd27a" : "#ff6a1a";
    context.lineWidth = 1.5 + Math.random() * 2.5;
    context.beginPath();
    let x = Math.random() * size;
    let y = Math.random() * size;
    context.moveTo(x, y);
    for (let j = 0; j < 4; j += 1) {
      x += (Math.random() - 0.5) * 40;
      y += (Math.random() - 0.5) * 40;
      context.lineTo(x, y);
    }
    context.stroke();
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  return texture;
}

function woodMaterial(color, embers) {
  return new THREE.MeshPhysicalMaterial({
    color,
    roughness: 0.6,
    clearcoat: 0.2,
    clearcoatRoughness: 0.5,
    emissive: "#ffffff",
    emissiveMap: embers,
    emissiveIntensity: 0,
  });
}

export function createCageModel() {
  const group = new THREE.Group();
  group.name = "cage";
  const embers = paintEmbers();
  embers.repeat.set(1.5, 1.5);
  const materials = {
    frame: woodMaterial("#c98a4e", embers),
    plank: woodMaterial("#b0743f", embers),
    bar: woodMaterial("#d9a066", embers),
    roof: woodMaterial("#e0442f", embers),
    lock: new THREE.MeshPhysicalMaterial({ color: "#ffcf3a", metalness: 0.6, roughness: 0.3, clearcoat: 0.6 }),
  };
  const materialList = Object.values(materials);
  const baseColors = new Map(materialList.map((material) => [material, material.color.clone()]));
  const pieces = [];

  function add(geometry, material, x, y, z, rx = 0, ry = 0, rz = 0) {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(x, y, z);
    mesh.rotation.set(rx, ry, rz);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.userData.home = { position: mesh.position.clone(), rotation: mesh.rotation.clone() };
    group.add(mesh);
    pieces.push(mesh);
    return mesh;
  }

  // Floor planks.
  const plank = roundedBox(HALF * 2 + 0.1, 0.08, 0.4, 0.025);
  for (const z of [-0.41, 0, 0.41]) add(plank, materials.plank, 0, 0.04, z);
  // Corner posts and the bottom and top rails.
  const post = roundedBox(0.13, TOP + 0.08, 0.13, 0.03);
  for (const x of [-HALF, HALF]) for (const z of [-HALF, HALF]) add(post, materials.frame, x, (TOP + 0.08) / 2, z);
  const rail = roundedBox(HALF * 2, 0.1, 0.1, 0.025);
  for (const y of [0.13, TOP]) {
    for (const z of [-HALF, HALF]) add(rail, materials.frame, 0, y, z);
    for (const x of [-HALF, HALF]) add(rail, materials.frame, x, y, 0, 0, Math.PI / 2);
  }
  // Round bars, three per side.
  const bar = new THREE.CylinderGeometry(0.035, 0.035, TOP - 0.13, 12);
  const barY = (TOP + 0.13) / 2;
  for (const t of [-0.3, 0, 0.3]) {
    for (const z of [-HALF, HALF]) add(bar, materials.bar, t, barY, z);
    for (const x of [-HALF, HALF]) add(bar, materials.bar, x, barY, t);
  }
  // Little peaked roof: two panels and a ridge beam.
  const slope = 0.55;
  const panelDepth = (HALF + 0.12) / Math.cos(slope);
  const panel = roundedBox(HALF * 2 + 0.3, 0.07, panelDepth, 0.03);
  const rise = Math.tan(slope) * (HALF + 0.12);
  for (const side of [-1, 1]) {
    add(panel, materials.roof, 0, TOP + 0.06 + rise / 2, (side * (HALF + 0.12)) / 2, side * slope);
  }
  add(roundedBox(HALF * 2 + 0.36, 0.09, 0.09, 0.03), materials.frame, 0, TOP + 0.08 + rise, 0);
  // Padlock on the front middle bar.
  add(roundedBox(0.13, 0.11, 0.05, 0.02), materials.lock, 0, 0.5, HALF + 0.06);
  add(new THREE.TorusGeometry(0.04, 0.012, 8, 16, Math.PI), materials.lock, 0, 0.555, HALF + 0.06);

  for (const piece of pieces) {
    const home = piece.userData.home.position;
    const outward = new THREE.Vector3(home.x, 0, home.z);
    if (outward.lengthSq() < 1e-4) outward.set(Math.random() - 0.5, 0, Math.random() - 0.5);
    outward.normalize().multiplyScalar(0.8 + Math.random() * 0.8);
    piece.userData.velocity = new THREE.Vector3(outward.x, 1.0 + Math.random() * 1.0 + home.y * 0.5, outward.z);
    piece.userData.spin = new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).multiplyScalar(9);
  }

  let burn = 0;
  let breakTime = -1;
  let time = 0;

  function setBurn(amount) {
    burn = Math.min(Math.max(amount, 0), 1);
    const charred = smoothstep(0.1, 0.6, burn);
    for (const [material, base] of baseColors) {
      if (material !== materials.lock) material.color.copy(base).lerp(CHAR, charred);
    }
    if (burn >= 1 && breakTime < 0) {
      breakTime = 0;
      for (const material of materialList) {
        material.transparent = true;
        material.needsUpdate = true;
      }
    }
  }

  function update(dt) {
    time += dt;
    const glow = smoothstep(0.25, 0.55, burn) * (0.75 + 0.25 * Math.sin(time * 17) * Math.sin(time * 7.3));
    materials.bar.emissiveIntensity = glow * 3;
    materials.frame.emissiveIntensity = glow * 2;
    materials.plank.emissiveIntensity = glow * 1.2;
    materials.roof.emissiveIntensity = glow * 1.5;
    if (breakTime < 0) return;
    breakTime += dt;
    const fade = 1 - smoothstep(BREAK_TIME * 0.35, BREAK_TIME, breakTime);
    for (const material of materialList) material.opacity = fade;
    for (const piece of pieces) {
      const { velocity, spin } = piece.userData;
      velocity.y -= 9 * dt;
      piece.position.addScaledVector(velocity, dt);
      if (piece.position.y < 0.04) {
        piece.position.y = 0.04;
        velocity.multiplyScalar(0.5);
        velocity.y = Math.abs(velocity.y) * 0.4;
      }
      piece.rotation.x += spin.x * dt;
      piece.rotation.y += spin.y * dt;
      piece.rotation.z += spin.z * dt;
    }
    group.visible = breakTime < BREAK_TIME;
  }

  function dispose() {
    const geometries = new Set(pieces.map((piece) => piece.geometry));
    for (const geometry of geometries) geometry.dispose();
    for (const material of materialList) material.dispose();
    embers.dispose();
  }

  return { group, radius: HALF + 0.12, update, setBurn, dispose };
}
