import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { ShaderPass } from "three/addons/postprocessing/ShaderPass.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";

// Quality tiers. iPads start at "medium"; the frame-time monitor can step down.
export const QUALITY = {
  high: { pixelRatio: 2, shadowSize: 2048, samples: 4, bloomScale: 0.5 },
  medium: { pixelRatio: 1.5, shadowSize: 1024, samples: 4, bloomScale: 0.5 },
  low: { pixelRatio: 1, shadowSize: 1024, samples: 0, bloomScale: 0.35 },
};

const FinishShader = {
  uniforms: {
    tDiffuse: { value: null },
    uVignette: { value: 0.28 },
    uSaturation: { value: 1.08 },
    uFlash: { value: 0 },
    uFlashColor: { value: new THREE.Color("#ffffff") },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }`,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float uVignette;
    uniform float uSaturation;
    uniform float uFlash;
    uniform vec3 uFlashColor;
    varying vec2 vUv;
    void main() {
      vec4 color = texture2D(tDiffuse, vUv);
      float luma = dot(color.rgb, vec3(0.299, 0.587, 0.114));
      color.rgb = mix(vec3(luma), color.rgb, uSaturation);
      vec2 offset = (vUv - 0.5) * vec2(1.0, 0.82);
      float edge = smoothstep(0.32, 0.86, length(offset));
      color.rgb *= 1.0 - uVignette * edge;
      color.rgb = mix(color.rgb, uFlashColor, uFlash);
      gl_FragColor = color;
    }`,
};

export function pickQuality() {
  const touch = navigator.maxTouchPoints > 1;
  return touch ? "medium" : "high";
}

export function createRenderer(canvas, qualityName) {
  const quality = QUALITY[qualityName];
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: "high-performance" });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  // Count draw calls across all passes of a frame (reset in render()).
  renderer.info.autoReset = false;

  const pmrem = new THREE.PMREMGenerator(renderer);
  const environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  pmrem.dispose();

  const target = new THREE.WebGLRenderTarget(1, 1, {
    type: THREE.HalfFloatType,
    samples: quality.samples,
  });
  const composer = new EffectComposer(renderer, target);
  const renderPass = new RenderPass(null, null);
  // Threshold above 1: only HDR highlights (fire, glow, gems) bloom, not sunlit white.
  const bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.6, 0.55, 1.7);
  const output = new OutputPass();
  const finish = new ShaderPass(FinishShader);
  composer.addPass(renderPass);
  composer.addPass(bloom);
  composer.addPass(output);
  composer.addPass(finish);

  const maxRatio = Math.min(window.devicePixelRatio || 1, quality.pixelRatio);
  let ratio = maxRatio;
  let width = 1;
  let height = 1;

  function resize(newWidth = width, newHeight = height) {
    width = newWidth;
    height = newHeight;
    renderer.setPixelRatio(ratio);
    renderer.setSize(width, height, false);
    composer.setPixelRatio(ratio);
    composer.setSize(width, height);
    bloom.resolution.set(width * ratio * quality.bloomScale, height * ratio * quality.bloomScale);
  }

  // Keeps play smooth on slower iPads: every 1.5 s, if frames averaged slower than
  // ~45 fps, render at a lower resolution (then switch off glow as a last step); after
  // a steady stretch above ~57 fps, step resolution back up.
  const monitor = { time: 0, frames: 0, good: 0 };
  function adapt(dt) {
    monitor.time += dt;
    monitor.frames += 1;
    if (monitor.time < 1.5) return;
    const average = monitor.time / monitor.frames;
    monitor.time = 0;
    monitor.frames = 0;
    if (average > 1 / 45) {
      monitor.good = 0;
      if (ratio > 1) {
        ratio = Math.max(1, ratio - 0.25);
        resize();
      } else {
        bloom.enabled = false;
      }
    } else if (average < 1 / 57) {
      monitor.good += 1;
      if (monitor.good >= 4 && ratio < maxRatio) {
        ratio = Math.min(maxRatio, ratio + 0.25);
        monitor.good = 0;
        resize();
      }
    }
  }

  // Ignore the slow frames right after loading (shaders compiling).
  function resetMonitor() {
    monitor.time = -2;
    monitor.frames = 0;
  }

  function stats() {
    return { ratio, bloom: bloom.enabled };
  }

  function render(scene, camera) {
    renderer.info.reset();
    renderPass.scene = scene;
    renderPass.camera = camera;
    composer.render();
  }

  return { renderer, composer, bloom, finish, environment, quality, resize, render, adapt, resetMonitor, stats };
}
