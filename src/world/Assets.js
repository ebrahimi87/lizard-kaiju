import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

// Loads GLB models once and turns repeated props into instanced meshes, so a garden
// with hundreds of flowers costs a handful of draw calls.

const loader = new GLTFLoader();
// path → loaded glTF, and path → in-flight promise so one file is fetched once.
const cache = new Map();
const pending = new Map();
// Geometry, materials, and textures of cached models. Stage cleanup must keep these:
// every stage that loads the same model reuses them.
const shared = new WeakSet();

function markShared(root) {
  root.traverse((object) => {
    if (object.geometry) shared.add(object.geometry);
    const materials = Array.isArray(object.material) ? object.material : object.material ? [object.material] : [];
    for (const material of materials) {
      shared.add(material);
      for (const value of Object.values(material)) if (value?.isTexture) shared.add(value);
    }
  });
}

// Frees the GPU memory of everything under root (a finished stage's scene, or one
// actor), except cached model assets and the shared environment map. Also frees light
// shadow maps, instance buffers, and skeleton bone textures.
export function disposeTree(root) {
  const textures = new Set();
  root.traverse((object) => {
    if (object.isLight) object.dispose();
    if (object.isInstancedMesh) object.dispose();
    if (object.isSkinnedMesh) object.skeleton.dispose();
    if (object.geometry && !shared.has(object.geometry)) object.geometry.dispose();
    const materials = Array.isArray(object.material) ? object.material : object.material ? [object.material] : [];
    for (const material of materials) {
      if (shared.has(material)) continue;
      for (const value of Object.values(material)) if (value?.isTexture && !shared.has(value)) textures.add(value);
      if (material.uniforms) for (const uniform of Object.values(material.uniforms)) if (uniform.value?.isTexture && !shared.has(uniform.value)) textures.add(uniform.value);
      material.dispose();
    }
  });
  if (root.environment) textures.delete(root.environment);
  for (const texture of textures) texture.dispose();
}

export function assetUrl(path) {
  return new URL(`../../assets/models/${path}`, import.meta.url).href;
}

export async function loadModels(paths, onProgress) {
  let done = 0;
  await Promise.all(
    paths.map(async (path) => {
      if (!cache.has(path)) {
        if (!pending.has(path)) pending.set(path, loader.loadAsync(assetUrl(path)));
        const gltf = await pending.get(path);
        markShared(gltf.scene);
        cache.set(path, gltf);
        pending.delete(path);
      }
      done += 1;
      onProgress?.(done / paths.length);
    }),
  );
}

const boundsCache = new Map();

// Size of a model at scale 1, used to scale props to a target height or length.
export function modelSize(path) {
  if (!boundsCache.has(path)) {
    const box = new THREE.Box3().setFromObject(getModel(path).scene);
    boundsCache.set(path, box.getSize(new THREE.Vector3()));
  }
  return boundsCache.get(path);
}

export function getModel(path) {
  const gltf = cache.get(path);
  if (!gltf) throw new Error(`Model not loaded: ${path}`);
  return gltf;
}

// placements: [{ x, y, z, rotation, scale }]. Every sub-mesh of the model becomes one
// InstancedMesh carrying all placements.
export function addInstancedProp(parent, path, placements, { castShadow = true, receiveShadow = true, tint = null } = {}) {
  const source = getModel(path).scene;
  source.updateMatrixWorld(true);
  const placement = new THREE.Matrix4();
  const combined = new THREE.Matrix4();
  const quaternion = new THREE.Quaternion();
  const up = new THREE.Vector3(0, 1, 0);
  const position = new THREE.Vector3();
  const scale = new THREE.Vector3();
  const meshes = [];
  source.traverse((object) => {
    if (!object.isMesh) return;
    let material = object.material;
    if (tint) {
      material = material.clone();
      material.color.multiply(new THREE.Color(tint));
    }
    const instanced = new THREE.InstancedMesh(object.geometry, material, placements.length);
    placements.forEach((item, index) => {
      position.set(item.x, item.y ?? 0, item.z);
      quaternion.setFromAxisAngle(up, item.rotation ?? 0);
      const size = item.scale ?? 1;
      scale.set(size, size * (item.stretch ?? 1), size);
      placement.compose(position, quaternion, scale);
      combined.multiplyMatrices(placement, object.matrixWorld);
      instanced.setMatrixAt(index, combined);
    });
    instanced.castShadow = castShadow;
    instanced.receiveShadow = receiveShadow;
    instanced.computeBoundingSphere();
    parent.add(instanced);
    meshes.push(instanced);
  });
  return meshes;
}
