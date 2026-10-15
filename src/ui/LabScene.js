import * as THREE from "three";
import { LizardModel } from "../actors/lizard/LizardModel.js";
import { attachHat } from "../actors/lizard/Hats.js";
import { formById, SKINS } from "../config/forms.js";

// The Lizard Lab's 3D preview: the lizard turns slowly on a red-and-gold pedestal,
// wearing the chosen skin and hat. It sits on the left; the shop grid covers the right.

function createBackdrop() {
  const canvas = document.createElement("canvas");
  canvas.width = 16;
  canvas.height = 256;
  const context = canvas.getContext("2d");
  const gradient = context.createLinearGradient(0, 0, 0, 256);
  gradient.addColorStop(0, "#7cc7ff");
  gradient.addColorStop(0.6, "#ffe9b8");
  gradient.addColorStop(1, "#ffb88a");
  context.fillStyle = gradient;
  context.fillRect(0, 0, 16, 256);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export class LabScene {
  constructor(environment) {
    this.scene = new THREE.Scene();
    this.scene.background = createBackdrop();
    this.scene.environment = environment;
    this.scene.environmentIntensity = 0.45;
    this.scene.add(new THREE.HemisphereLight("#fff6e8", "#d08a60", 1.4));
    const key = new THREE.DirectionalLight("#fff1d6", 2.6);
    key.position.set(-2, 5, 4);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    key.shadow.camera.left = -4;
    key.shadow.camera.right = 4;
    key.shadow.camera.top = 4;
    key.shadow.camera.bottom = -4;
    this.scene.add(key);
    const rim = new THREE.DirectionalLight("#ffb0a0", 1.4);
    rim.position.set(3, 2, -4);
    this.scene.add(rim);

    const pedestal = new THREE.Group();
    const top = new THREE.Mesh(
      new THREE.CylinderGeometry(2.2, 2.35, 0.35, 48),
      new THREE.MeshPhysicalMaterial({ color: "#e2322b", roughness: 0.35, clearcoat: 0.6 }),
    );
    top.position.y = -0.175;
    top.receiveShadow = true;
    const band = new THREE.Mesh(new THREE.TorusGeometry(2.3, 0.08, 10, 64), new THREE.MeshPhysicalMaterial({ color: "#ffc21c", roughness: 0.3, metalness: 0.4 }));
    band.rotation.x = Math.PI / 2;
    band.position.y = -0.05;
    pedestal.add(top, band);
    this.scene.add(pedestal);

    this.camera = new THREE.PerspectiveCamera(32, 1, 0.05, 100);
    this.turn = 0.6;
    this.model = null;
    this.time = 0;
    this.motion = { speed: 0, turnRate: 0, mouthOpen: 0, roar: 0, glow: 0, glowFront: 1.2, lookYaw: 0 };
  }

  // Swaps in the lizard with this form, skin, and hat. The model is sized to fit.
  show(formId, skinId, hatId) {
    if (this.model) {
      this.scene.remove(this.model.group);
      this.model.dispose();
    }
    this.model = new LizardModel(formById(formId), SKINS[skinId] ?? SKINS.ruby);
    attachHat(this.model, hatId);
    this.model.group.traverse((object) => {
      if (object.isMesh) object.castShadow = true;
    });
    this.scene.add(this.model.group);
    this.model.group.updateMatrixWorld(true);
    const size = new THREE.Box3().setFromObject(this.model.group).getSize(new THREE.Vector3());
    this.fit = 2.6 / Math.max(size.x, size.z, size.y * 1.4);
    this.model.group.scale.setScalar(this.fit);
    this.height = size.y * this.fit;
  }

  // A happy wiggle when something new is put on.
  cheer() {
    this.cheerTime = 1;
  }

  update(dt, aspect) {
    if (!this.model) return;
    this.time += dt;
    this.turn += dt * 0.5;
    this.cheerTime = Math.max(0, (this.cheerTime ?? 0) - dt);
    this.model.group.rotation.y = this.turn;
    this.motion.roar = this.cheerTime > 0 ? Math.sin(this.cheerTime * Math.PI) : 0;
    this.motion.mouthOpen = this.motion.roar;
    this.motion.lookYaw = Math.sin(this.time * 0.8) * 0.3;
    this.model.update(dt, this.motion);
    // Frame the lizard in the left part of the screen: the camera looks straight ahead
    // from a point shifted right, so the lizard sits at about 30% of the width.
    this.camera.aspect = aspect;
    this.camera.updateProjectionMatrix();
    const centerY = this.height * 0.45;
    const halfHeight = 7.5 * Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2));
    const shift = 0.42 * halfHeight * aspect;
    this.camera.position.set(shift, centerY + 1.6, 7.5);
    this.camera.lookAt(shift, centerY + 0.3, 0);
  }

  dispose() {
    if (this.model) this.model.dispose();
  }
}
