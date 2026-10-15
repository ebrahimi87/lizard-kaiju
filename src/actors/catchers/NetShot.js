import * as THREE from "three";
import { createCircleTelegraph } from "./Telegraphs.js";
import { disposeTree } from "../../world/Assets.js";

// A thrown or fired net: flies in an arc to a marked spot and catches the lizard if it
// is still inside the red circle when the net lands.

function netTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 128;
  const context = canvas.getContext("2d");
  context.strokeStyle = "#ffffff";
  context.lineWidth = 6;
  for (let i = 0; i <= 128; i += 21) {
    context.beginPath();
    context.moveTo(i, 0);
    context.lineTo(i, 128);
    context.moveTo(0, i);
    context.lineTo(128, i);
    context.stroke();
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(3, 2);
  return texture;
}

export class NetShot {
  constructor(scene, particles, sound) {
    this.scene = scene;
    this.particles = particles;
    this.sound = sound;
    this.ball = new THREE.Group();
    const bag = new THREE.Mesh(
      new THREE.SphereGeometry(0.5, 18, 12),
      new THREE.MeshStandardMaterial({ color: "#f4f1e8", map: netTexture(), alphaTest: 0.4, transparent: true, side: THREE.DoubleSide, roughness: 0.8 }),
    );
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.06, 8, 32), new THREE.MeshStandardMaterial({ color: "#e6463c", roughness: 0.5 }));
    rim.rotation.x = Math.PI / 2;
    this.ball.add(bag, rim);
    this.ball.visible = false;
    scene.add(this.ball);
    this.circle = createCircleTelegraph(scene);
    this.from = new THREE.Vector3();
    this.to = new THREE.Vector3();
    this.active = false;
    this.time = 0;
    this.flight = 1;
    this.radius = 1;
  }

  fire(from, to, flight, radius, size) {
    this.from.copy(from);
    this.to.copy(to).setY(0);
    this.flight = flight;
    this.radius = radius;
    this.size = size;
    this.time = 0;
    this.active = true;
    this.ball.visible = true;
    this.ball.scale.setScalar(size);
    this.sound.whoosh();
  }

  // Returns "caught" when the net lands on the player.
  update(dt, player, bodyRadius) {
    if (!this.active) return null;
    this.time += dt;
    const t = Math.min(1, this.time / this.flight);
    this.ball.position.lerpVectors(this.from, this.to, t);
    this.ball.position.y = THREE.MathUtils.lerp(this.from.y, this.size * 0.4, t) + Math.sin(t * Math.PI) * this.flight * 3;
    this.ball.rotation.x += dt * 9;
    this.ball.rotation.z += dt * 5;
    this.circle.show(this.to.x, this.to.z, this.radius, t, this.time);
    if (t < 1) return null;
    this.cancel();
    this.particles.burst("dust", this.to, 10, 2, this.size);
    const distance = Math.hypot(player.position.x - this.to.x, player.position.z - this.to.z);
    return distance < this.radius + bodyRadius * 0.5 && player.invulnerable <= 0 ? "caught" : null;
  }

  cancel() {
    this.active = false;
    this.ball.visible = false;
    this.circle.hide();
  }

  dispose() {
    this.scene.remove(this.ball);
    disposeTree(this.ball);
    this.circle.dispose();
  }
}
