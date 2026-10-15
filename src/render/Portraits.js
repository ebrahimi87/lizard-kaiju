import * as THREE from "three";
import { LizardModel } from "../actors/lizard/LizardModel.js";
import { FORMS } from "../config/forms.js";

// Renders small pictures of 3D models for the HUD, shop, and sticker book.
//   const thumbs = createThumbnailer(renderer, environment);
//   thumbs.render(object, { yaw: 0.6 }) → data URL (PNG with transparent background)
// SIZE is the square picture size in pixels.

export function createThumbnailer(renderer, environment, SIZE = 160) {
  const target = new THREE.WebGLRenderTarget(SIZE, SIZE, { samples: 4 });
  target.texture.colorSpace = THREE.SRGBColorSpace;
  const scene = new THREE.Scene();
  scene.environment = environment;
  scene.environmentIntensity = 0.5;
  scene.add(new THREE.HemisphereLight("#ffffff", "#806050", 1.6));
  const sun = new THREE.DirectionalLight("#fff4e0", 2.6);
  sun.position.set(2, 4, 3);
  scene.add(sun);
  const camera = new THREE.PerspectiveCamera(30, 1, 0.01, 100);
  const pixels = new Uint8Array(SIZE * SIZE * 4);
  const canvas = document.createElement("canvas");
  canvas.width = SIZE;
  canvas.height = SIZE;
  const context = canvas.getContext("2d");
  const image = context.createImageData(SIZE, SIZE);
  const box = new THREE.Box3();
  const center = new THREE.Vector3();
  const size = new THREE.Vector3();

  // options: yaw (turns the object), lift (camera height, × radius), fill (0..1 of frame)
  function render(object, { yaw = Math.PI / 2 + 0.35, lift = 0.25, fill = 0.62 } = {}) {
    const holder = new THREE.Group();
    holder.add(object);
    object.rotation.y = yaw;
    scene.add(holder);
    holder.updateMatrixWorld(true);
    box.setFromObject(holder);
    box.getCenter(center);
    box.getSize(size);
    const radius = Math.max(size.x, size.y, size.z) * fill;
    camera.position.set(center.x, center.y + radius * lift, center.z + radius / Math.tan(THREE.MathUtils.degToRad(15)));
    camera.lookAt(center);
    camera.near = radius * 0.05;
    camera.far = radius * 20;
    camera.updateProjectionMatrix();
    const previousTarget = renderer.getRenderTarget();
    const previousAlpha = renderer.getClearAlpha();
    renderer.setRenderTarget(target);
    renderer.setClearAlpha(0);
    renderer.clear();
    renderer.render(scene, camera);
    renderer.readRenderTargetPixels(target, 0, 0, SIZE, SIZE, pixels);
    renderer.setRenderTarget(previousTarget);
    renderer.setClearAlpha(previousAlpha);
    scene.remove(holder);
    for (let y = 0; y < SIZE; y += 1) {
      const from = (SIZE - 1 - y) * SIZE * 4;
      image.data.set(pixels.subarray(from, from + SIZE * 4), y * SIZE * 4);
    }
    context.putImageData(image, 0, 0);
    return canvas.toDataURL("image/png");
  }

  return { render, dispose: () => target.dispose() };
}

// Side portraits of every lizard form: { formId: dataUrl }.
export function renderFormPortraits(thumbnailer, skin) {
  const portraits = {};
  for (const form of FORMS) {
    const model = new LizardModel(form, skin);
    portraits[form.id] = thumbnailer.render(model.group);
    model.dispose();
  }
  return portraits;
}
