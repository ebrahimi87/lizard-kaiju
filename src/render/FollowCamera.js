import * as THREE from "three";

// Angled top-down chase camera. It sits south of the target (looking north, +Z), leads
// in the direction of movement, zooms with the lizard's size, and can shake.

export class FollowCamera {
  constructor(camera) {
    this.camera = camera;
    this.focus = new THREE.Vector3();
    this.lead = new THREE.Vector3();
    this.zoom = 1;
    this.shakeAmount = 0;
    this.override = null; // { position, lookAt } for cinematics
    this.lookTarget = new THREE.Vector3();
    this.desired = new THREE.Vector3();
  }

  snap(target, settings, zoom) {
    this.focus.copy(target);
    this.lead.set(0, 0, 0);
    this.zoom = zoom;
    this.place(settings, 1);
  }

  shake(amount) {
    this.shakeAmount = Math.min(1.2, this.shakeAmount + amount);
  }

  // settings: { height, distance, lookAhead }; velocity: world units per second.
  update(dt, target, velocity, settings, zoom) {
    const follow = 1 - Math.exp(-dt * 6);
    this.focus.lerp(target, follow);
    const speed = Math.hypot(velocity.x, velocity.z);
    const leadScale = speed > 0.1 ? Math.min(1, speed / 4) * settings.lookAhead * zoom : 0;
    this.desired.set(speed > 0.1 ? (velocity.x / speed) * leadScale : 0, 0, speed > 0.1 ? (velocity.z / speed) * leadScale : 0);
    this.lead.lerp(this.desired, 1 - Math.exp(-dt * 2.2));
    this.zoom += (zoom - this.zoom) * (1 - Math.exp(-dt * 2.5));
    this.place(settings, dt);
  }

  place(settings, dt) {
    const camera = this.camera;
    if (this.override) {
      camera.position.lerp(this.override.position, 1 - Math.exp(-dt * this.override.speed));
      this.lookTarget.lerp(this.override.lookAt, 1 - Math.exp(-dt * this.override.speed));
      camera.lookAt(this.lookTarget);
      return;
    }
    const x = this.focus.x + this.lead.x;
    const z = this.focus.z + this.lead.z;
    camera.position.set(x, settings.height * this.zoom, z - settings.distance * this.zoom);
    this.lookTarget.set(x, 0, z + settings.distance * this.zoom * 0.08);
    if (this.shakeAmount > 0.001) {
      const s = this.shakeAmount * this.shakeAmount * 0.35 * this.zoom;
      camera.position.x += (Math.random() - 0.5) * s;
      camera.position.y += (Math.random() - 0.5) * s;
      camera.position.z += (Math.random() - 0.5) * s;
      this.shakeAmount = Math.max(0, this.shakeAmount - dt * 2.2);
    }
    camera.lookAt(this.lookTarget);
  }
}
