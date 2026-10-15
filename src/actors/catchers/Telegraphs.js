import * as THREE from "three";
import { disposeTree } from "../../world/Assets.js";

// Ground warnings that always come before a catcher attack. Red means "move!".
//   circle: where a net will land. A white ring closes in and meets the red edge at impact.
//   lane:   where a jeep will charge. Chevrons slide along it toward the far end.

function flatMesh(geometry, color, opacity) {
  const mesh = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false }));
  mesh.rotation.x = -Math.PI / 2;
  mesh.renderOrder = 4;
  return mesh;
}

export function createCircleTelegraph(scene) {
  const group = new THREE.Group();
  const fill = flatMesh(new THREE.CircleGeometry(1, 48), "#ff2a1a", 0.25);
  const ring = flatMesh(new THREE.RingGeometry(0.9, 1, 64), "#ff3b2b", 0.95);
  const closing = flatMesh(new THREE.RingGeometry(0.95, 1, 64), "#ffffff", 0.9);
  group.add(fill, ring, closing);
  group.visible = false;
  scene.add(group);
  return {
    group,
    // progress 0..1 toward impact; radius in world units.
    show(x, z, radius, progress, time) {
      group.visible = true;
      group.position.set(x, 0.05, z);
      group.scale.setScalar(radius * (0.6 + 0.4 * Math.min(1, progress * 2.5)));
      fill.material.opacity = 0.18 + 0.22 * progress + 0.08 * (0.5 + 0.5 * Math.sin(time * 18));
      closing.scale.setScalar(2.2 - 1.2 * Math.min(1, progress));
    },
    hide() {
      group.visible = false;
    },
    dispose() {
      scene.remove(group);
      disposeTree(group);
    },
  };
}

function chevronTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 64;
  canvas.height = 64;
  const context = canvas.getContext("2d");
  context.fillStyle = "rgba(255, 255, 255, 0)";
  context.fillRect(0, 0, 64, 64);
  context.strokeStyle = "#ffffff";
  context.lineWidth = 9;
  context.lineCap = "round";
  context.beginPath();
  // Points down the canvas, which maps to the far end of the lane.
  context.moveTo(14, 20);
  context.lineTo(32, 42);
  context.lineTo(50, 20);
  context.stroke();
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapT = THREE.RepeatWrapping;
  return texture;
}

export function createLaneTelegraph(scene) {
  const group = new THREE.Group();
  const fill = flatMesh(new THREE.PlaneGeometry(1, 1), "#ff2a1a", 0.3);
  const texture = chevronTexture();
  const chevrons = flatMesh(new THREE.PlaneGeometry(1, 1), "#ffffff", 0.85);
  chevrons.material.map = texture;
  chevrons.position.y = 0.01;
  const edges = new THREE.Group();
  for (const side of [-0.5, 0.5]) {
    const edge = flatMesh(new THREE.PlaneGeometry(0.06, 1), "#ff3b2b", 0.95);
    edge.position.x = side;
    edges.add(edge);
  }
  // Children are laid out along local +Z from 0 to 1, then the group is scaled.
  for (const child of [fill, chevrons, ...edges.children]) child.geometry.translate(0, -0.5, 0);
  group.add(fill, chevrons, edges);
  group.visible = false;
  scene.add(group);
  return {
    group,
    // From (x, z) along heading for length, width wide.
    show(x, z, heading, length, width, progress, time) {
      group.visible = true;
      group.position.set(x, 0.05, z);
      group.rotation.y = heading;
      group.scale.set(width, 1, length * Math.min(1, 0.3 + progress * 1.4));
      fill.material.opacity = 0.2 + 0.2 * progress + 0.08 * Math.sin(time * 18);
      texture.repeat.set(1, length / width);
      texture.offset.y = -time * 2.5;
    },
    hide() {
      group.visible = false;
    },
    dispose() {
      scene.remove(group);
      disposeTree(group);
    },
  };
}
