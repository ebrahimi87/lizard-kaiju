import * as THREE from "three";

// Pooled point particles in two layers: "glow" (additive, HDR colors that bloom: fire,
// sparks, sparkles) and "soft" (normal blending: smoke, dust, water, confetti).
//   particles.burst("sparkle", position, 12)
//   particles.emit("fire", position, velocity)
// Presets below define look and motion; each spawn adds a little randomness.

export const PRESETS = {
  fire: { layer: "glow", life: [0.35, 0.55], size: [0.2, 0.3], sizeEnd: 0.85, color: [2.2, 0.95, 0.22], colorEnd: [1.1, 0.12, 0.03], alpha: 0.6, drag: 1.6, gravity: -1.5, spread: 0.18 },
  ember: { layer: "glow", life: [0.5, 0.9], size: [0.05, 0.09], sizeEnd: 0.02, color: [6, 3, 0.8], colorEnd: [3, 0.6, 0.1], drag: 1, gravity: -2, spread: 1.6 },
  smoke: { layer: "soft", life: [0.8, 1.3], size: [0.3, 0.45], sizeEnd: 1.4, color: [0.35, 0.32, 0.32], colorEnd: [0.6, 0.58, 0.58], alpha: 0.45, drag: 1.4, gravity: -0.8, spread: 0.5 },
  water: { layer: "soft", life: [0.45, 0.7], size: [0.12, 0.2], sizeEnd: 0.32, color: [0.55, 0.85, 1.25], colorEnd: [0.85, 0.97, 1.2], alpha: 0.9, drag: 0.7, gravity: 6, spread: 0.12, bounce: true },
  mist: { layer: "soft", life: [0.5, 0.8], size: [0.25, 0.35], sizeEnd: 1.0, color: [0.8, 0.93, 1], colorEnd: [0.95, 1, 1], alpha: 0.35, drag: 2, gravity: -0.3, spread: 0.4 },
  sparkle: { layer: "glow", life: [0.4, 0.8], size: [0.1, 0.18], sizeEnd: 0.0, color: [3.2, 2.6, 1.4], colorEnd: [2.4, 1.2, 2.6], drag: 2.2, gravity: 1.5, spread: 3 },
  gold: { layer: "glow", life: [0.5, 1], size: [0.12, 0.2], sizeEnd: 0.0, color: [4, 3, 0.8], colorEnd: [3, 1.6, 0.2], drag: 2, gravity: 2, spread: 3.2 },
  dust: { layer: "soft", life: [0.4, 0.7], size: [0.18, 0.28], sizeEnd: 0.7, color: [0.78, 0.68, 0.52], colorEnd: [0.88, 0.82, 0.7], alpha: 0.55, drag: 3, gravity: -0.4, spread: 1.4 },
  star: { layer: "glow", life: [0.5, 0.8], size: [0.2, 0.3], sizeEnd: 0.05, color: [4, 3.4, 1.2], colorEnd: [3, 2, 0.6], drag: 2.5, gravity: 0, spread: 2.5 },
  confetti: { layer: "soft", life: [1.2, 1.8], size: [0.12, 0.18], sizeEnd: 0.12, color: null, alpha: 1, drag: 1.2, gravity: 4, spread: 4 },
  heart: { layer: "glow", life: [0.6, 0.9], size: [0.2, 0.28], sizeEnd: 0.1, color: [4, 0.6, 0.9], colorEnd: [3, 0.4, 1.2], drag: 2, gravity: -2.5, spread: 1 },
};

const CONFETTI_COLORS = [
  [1, 0.25, 0.25],
  [1, 0.8, 0.2],
  [0.3, 0.8, 1],
  [0.5, 1, 0.4],
  [1, 0.5, 0.9],
];

function makeLayer(capacity, blending) {
  const geometry = new THREE.BufferGeometry();
  const position = new Float32Array(capacity * 3);
  const color = new Float32Array(capacity * 4);
  const size = new Float32Array(capacity);
  geometry.setAttribute("position", new THREE.BufferAttribute(position, 3).setUsage(THREE.DynamicDrawUsage));
  geometry.setAttribute("aColor", new THREE.BufferAttribute(color, 4).setUsage(THREE.DynamicDrawUsage));
  geometry.setAttribute("aSize", new THREE.BufferAttribute(size, 1).setUsage(THREE.DynamicDrawUsage));
  const uniforms = { uScale: { value: 500 } };
  const material = new THREE.ShaderMaterial({
    uniforms,
    transparent: true,
    depthWrite: false,
    blending,
    vertexShader: /* glsl */ `
      attribute vec4 aColor;
      attribute float aSize;
      uniform float uScale;
      varying vec4 vColor;
      void main() {
        vColor = aColor;
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = aSize * uScale / max(-mvPosition.z, 0.1);
        gl_Position = projectionMatrix * mvPosition;
      }`,
    fragmentShader: /* glsl */ `
      varying vec4 vColor;
      void main() {
        float d = length(gl_PointCoord - 0.5);
        float a = smoothstep(0.5, 0.15, d) * vColor.a;
        if (a < 0.01) discard;
        gl_FragColor = vec4(vColor.rgb, a);
      }`,
  });
  const points = new THREE.Points(geometry, material);
  points.frustumCulled = false;
  points.renderOrder = 5;
  return {
    points,
    uniforms,
    capacity,
    cursor: 0,
    position,
    color,
    size,
    velocity: new Float32Array(capacity * 3),
    life: new Float32Array(capacity),
    maxLife: new Float32Array(capacity),
    size0: new Float32Array(capacity),
    size1: new Float32Array(capacity),
    color0: new Float32Array(capacity * 3),
    color1: new Float32Array(capacity * 3),
    alpha: new Float32Array(capacity),
    drag: new Float32Array(capacity),
    gravity: new Float32Array(capacity),
    bounce: new Uint8Array(capacity),
  };
}

function range([low, high]) {
  return low + Math.random() * (high - low);
}

export class Particles {
  constructor(scene) {
    this.layers = {
      glow: makeLayer(1600, THREE.AdditiveBlending),
      soft: makeLayer(1200, THREE.NormalBlending),
    };
    for (const layer of Object.values(this.layers)) scene.add(layer.points);
    this.scale = 1;
  }

  // scale multiplies sizes and speeds so effects grow with the lizard.
  setScale(scale) {
    this.scale = scale;
  }

  // Pixel scale for point sizes: viewport height / (2 tan(fov / 2)).
  resize(heightPixels, fovDegrees) {
    const value = heightPixels / (2 * Math.tan(THREE.MathUtils.degToRad(fovDegrees) / 2));
    for (const layer of Object.values(this.layers)) layer.uniforms.uScale.value = value;
  }

  emit(presetName, position, velocity, sizeScale = 1) {
    const preset = PRESETS[presetName];
    const layer = this.layers[preset.layer];
    const i = layer.cursor;
    layer.cursor = (layer.cursor + 1) % layer.capacity;
    const s = this.scale * sizeScale;
    const spread = preset.spread * s;
    layer.position[i * 3] = position.x;
    layer.position[i * 3 + 1] = position.y;
    layer.position[i * 3 + 2] = position.z;
    layer.velocity[i * 3] = velocity.x + (Math.random() - 0.5) * spread;
    layer.velocity[i * 3 + 1] = velocity.y + (Math.random() - 0.5) * spread;
    layer.velocity[i * 3 + 2] = velocity.z + (Math.random() - 0.5) * spread;
    const life = range(preset.life);
    layer.life[i] = life;
    layer.maxLife[i] = life;
    const size = range(preset.size) * s;
    layer.size0[i] = size;
    layer.size1[i] = preset.sizeEnd * s;
    const start = preset.color ?? CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)];
    const end = preset.colorEnd ?? start;
    for (let c = 0; c < 3; c += 1) {
      layer.color0[i * 3 + c] = start[c];
      layer.color1[i * 3 + c] = end[c];
    }
    layer.alpha[i] = preset.alpha ?? 1;
    layer.drag[i] = preset.drag;
    layer.gravity[i] = preset.gravity * s;
    layer.bounce[i] = preset.bounce ? 1 : 0;
  }

  // Spherical burst of count particles around position.
  burst(presetName, position, count, speed = 2, sizeScale = 1) {
    const velocity = Particles.tempVelocity;
    const s = this.scale;
    for (let n = 0; n < count; n += 1) {
      const angle = Math.random() * Math.PI * 2;
      const lift = Math.random();
      velocity.set(Math.cos(angle) * speed * s * (0.4 + Math.random() * 0.6), lift * speed * s, Math.sin(angle) * speed * s * (0.4 + Math.random() * 0.6));
      this.emit(presetName, position, velocity, sizeScale);
    }
  }

  update(dt) {
    for (const layer of Object.values(this.layers)) {
      for (let i = 0; i < layer.capacity; i += 1) {
        if (layer.life[i] <= 0) {
          layer.size[i] = 0;
          continue;
        }
        layer.life[i] -= dt;
        const t = 1 - Math.max(layer.life[i], 0) / layer.maxLife[i];
        const damping = Math.exp(-layer.drag[i] * dt);
        const v = i * 3;
        layer.velocity[v] *= damping;
        layer.velocity[v + 1] = layer.velocity[v + 1] * damping - layer.gravity[i] * dt;
        layer.velocity[v + 2] *= damping;
        layer.position[v] += layer.velocity[v] * dt;
        layer.position[v + 1] += layer.velocity[v + 1] * dt;
        layer.position[v + 2] += layer.velocity[v + 2] * dt;
        if (layer.position[v + 1] < 0.02) {
          layer.position[v + 1] = 0.02;
          if (layer.bounce[i]) {
            layer.velocity[v + 1] *= -0.25;
            layer.velocity[v] *= 0.5;
            layer.velocity[v + 2] *= 0.5;
          } else {
            layer.velocity[v + 1] = Math.max(layer.velocity[v + 1], 0);
          }
        }
        layer.size[i] = layer.size0[i] + (layer.size1[i] - layer.size0[i]) * t;
        const fade = Math.min(1, t * 8) * (1 - t * t);
        const c = i * 4;
        layer.color[c] = layer.color0[v] + (layer.color1[v] - layer.color0[v]) * t;
        layer.color[c + 1] = layer.color0[v + 1] + (layer.color1[v + 1] - layer.color0[v + 1]) * t;
        layer.color[c + 2] = layer.color0[v + 2] + (layer.color1[v + 2] - layer.color0[v + 2]) * t;
        layer.color[c + 3] = layer.alpha[i] * fade;
      }
      const geometry = layer.points.geometry;
      geometry.attributes.position.needsUpdate = true;
      geometry.attributes.aColor.needsUpdate = true;
      geometry.attributes.aSize.needsUpdate = true;
    }
  }

  clear() {
    for (const layer of Object.values(this.layers)) layer.life.fill(0);
  }
}

Particles.tempVelocity = new THREE.Vector3();
