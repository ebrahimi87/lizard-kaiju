import * as THREE from "three";
import { addInstancedProp, getModel, modelSize } from "../Assets.js";
import { addShapes } from "./Details.js";

export const CITY_MODELS = [
  "city/house_building_type_a.glb", "city/house_building_type_c.glb", "city/house_building_type_g.glb",
  "city/commercial_building_a.glb", "city/commercial_building_c.glb",
  "city/commercial_building_skyscraper_a.glb", "city/commercial_building_skyscraper_c.glb",
  "city/city_tree_small.glb", "city/light_curved.glb", "city/city_planter.glb",
  "vehicles/sedan.glb", "vehicles/taxi.glb", "vehicles/suv.glb",
];

export function buildCity(parent, random, halfSize, clearRadius = 5) {
  const smashables = [];
  const groups = new Map();
  const obstacles = [];
  const box = new THREE.Box3();
  const size = new THREE.Vector3();
  function put(path, x, z, height, rotation = 0) {
    if (!groups.has(path)) groups.set(path, []);
    groups.get(path).push({ x, z, scale: height / modelSize(path).y, rotation });
  }
  function smash(path, x, z, height, kind, rotation = 0) {
    const scale = height / modelSize(path).y;
    const radius = Math.max(modelSize(path).x, modelSize(path).z) * scale * 0.5;
    if (Math.hypot(x, z) < clearRadius + radius) return;
    const object = getModel(path).scene.clone(true);
    object.scale.setScalar(scale);
    object.rotation.y = rotation;
    object.position.set(x, 0, z);
    object.traverse((part) => {
      if (!part.isMesh) return;
      part.castShadow = true;
      part.receiveShadow = true;
      // Destruction can fade or recolor each object without touching its neighbors.
      part.material = Array.isArray(part.material) ? part.material.map((material) => material.clone()) : part.material.clone();
    });
    parent.add(object);
    box.setFromObject(object).getSize(size);
    smashables.push({ object, x, z, radius, height: size.y, kind });
  }

  // Warm sidewalks organize a small toy town into 16 m blocks. The central
  // crossroads is kept open for the robot fight and the first kaiju stomp.
  const sidewalkMaterial = new THREE.MeshStandardMaterial({ color: "#e1cbb5", roughness: 0.95 });
  const sidewalkGeometry = new THREE.BoxGeometry(10.5, 0.09, 10.5);
  const centers = [-24, -8, 8, 24];
  for (const x of centers) {
    for (const z of centers) {
      const sidewalk = new THREE.Mesh(sidewalkGeometry, sidewalkMaterial);
      sidewalk.position.set(x, 0, z);
      sidewalk.receiveShadow = true;
      parent.add(sidewalk);
      for (let i = 0; i < 4; i += 1) {
        const px = x + (i % 2 ? 2.4 : -2.4);
        const pz = z + (i < 2 ? -2.4 : 2.4);
        const path = CITY_MODELS[Math.floor(random() * 5)];
        smash(path, px, pz, 1.3 + random() * 1.5, "building", z > 0 ? Math.PI : 0);
      }
      put("city/light_curved.glb", x - 5.6, z - 5.4, 1.4);
      put("city/light_curved.glb", x + 5.6, z + 5.4, 1.4, Math.PI);
      smash("city/city_tree_small.glb", x + 4.2, z - 4.2, 1.1, "tree");
      put("city/city_planter.glb", x + 4.2, z - 4.2, 0.2);
    }
  }
  // Cars use individual objects too, and sit on the right-hand road lanes.
  for (const road of [-16, 0, 16]) {
    for (let i = 0; i < 8; i += 1) {
      const along = -27 + i * 7 + random();
      smash(CITY_MODELS[10 + i % 3], road + (i % 2 ? -1.2 : 1.2), along, 0.38 + random() * 0.1, "car", i % 2 ? Math.PI : 0);
      if (road !== 0) smash(CITY_MODELS[10 + (i + 1) % 3], along, road + 1.2, 0.42, "car", Math.PI / 2);
    }
  }
  smash("vehicles/taxi.glb", 1.2, 6.2, 0.42, "car");
  smash("vehicles/sedan.glb", -1.2, -6.2, 0.4, "car", Math.PI);
  // White crosswalks at the central square, thin enough to walk straight over.
  const stripeGeometry = new THREE.BoxGeometry(0.5, 0.015, 1.2);
  const stripeMaterial = new THREE.MeshStandardMaterial({ color: "#fff0d8" });
  for (const side of [-1, 1]) {
    for (let i = 0; i < 6; i += 1) {
      for (const rotate of [false, true]) {
        const stripe = new THREE.Mesh(stripeGeometry, stripeMaterial);
        const across = -1.75 + i * 0.7;
        stripe.position.set(rotate ? side * 4 : across, 0.015, rotate ? across : side * 4);
        if (rotate) stripe.rotation.y = Math.PI / 2;
        parent.add(stripe);
      }
    }
  }
  // Continuous low sea wall marks the playable square. A skyline stands behind
  // three sides; the north side opens onto a peach-lit bay.
  const wallMaterial = new THREE.MeshStandardMaterial({ color: "#c7a998", roughness: 0.9 });
  const wallGeometry = new THREE.BoxGeometry(halfSize * 2 + 1, 0.6, 0.7);
  for (let side = 0; side < 4; side += 1) {
    const wall = new THREE.Mesh(wallGeometry, wallMaterial);
    wall.position.set(side < 2 ? 0 : (side === 2 ? -halfSize : halfSize), 0.25, side < 2 ? (side === 0 ? -halfSize : halfSize) : 0);
    if (side > 1) wall.rotation.y = Math.PI / 2;
    wall.castShadow = true;
    parent.add(wall);
  }
  for (let i = 0; i < 27; i += 1) {
    const side = i % 3;
    const along = -halfSize + (i / 3 | 0) * halfSize / 4;
    const edge = halfSize + 5;
    put(CITY_MODELS[5 + i % 2], side === 0 ? along : (side === 1 ? -edge : edge), side === 0 ? -edge : along, 4 + random() * 3.5);
  }
  // Pocket gardens occupy the unused center of each block; buildings, cars,
  // and smashable trees keep their original placements and identities.
  const lawns = [];
  const basins = [];
  const fountainWater = [];
  const jets = [];
  for (const x of centers) {
    for (const z of centers) {
      lawns.push({ x, y: 0.055, z, sx: 1.6, sy: 0.035, sz: 8.8 });
      basins.push({ x, y: 0.10, z, sx: 0.85, sy: 0.18, sz: 0.85 });
      fountainWater.push({ x, y: 0.20, z, sx: 0.71, sy: 0.025, sz: 0.71 });
      jets.push({ x, y: 0.43, z, sx: 0.055, sy: 0.48, sz: 0.055 });
    }
  }
  addShapes(parent, new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ color: "#83b16d" }), lawns);
  const round = new THREE.CylinderGeometry(1, 1, 1, 16);
  addShapes(parent, round, new THREE.MeshStandardMaterial({ color: "#e9d4b9" }), basins);
  const waterMaterial = new THREE.MeshStandardMaterial({ color: "#72ced4", roughness: 0.25 });
  addShapes(parent, round, waterMaterial, fountainWater);
  addShapes(parent, round, waterMaterial, jets);
  for (const [path, placements] of groups) addInstancedProp(parent, path, placements);
  const water = [{ x: 0, z: halfSize + 82, radius: 81 }, { x: -90, z: halfSize + 82, radius: 81 }, { x: 90, z: halfSize + 82, radius: 81 }];
  return { obstacles, halfSize, smashables, water };
}
