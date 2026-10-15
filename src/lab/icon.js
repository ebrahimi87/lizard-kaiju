import * as THREE from "three";
import { createRenderer } from "../render/Renderer.js";
import { createThumbnailer } from "../render/Portraits.js";
import { LizardModel } from "../actors/lizard/LizardModel.js";
import { formById, SKINS } from "../config/forms.js";

// Builds the home-screen icon: the gecko's happy face on a warm red-gold disc.
// window.__ICONS__ = { 512: dataUrl, 192: dataUrl, 180: dataUrl } once ready.

const canvas = document.getElementById("lab-canvas");
const graphics = createRenderer(canvas, "high");
const thumbnailer = createThumbnailer(graphics.renderer, graphics.environment, 512);
const model = new LizardModel(formById("gecko"), SKINS.ruby);
model.update(0, { speed: 0, turnRate: 0, mouthOpen: 0.25, roar: 0.25, glow: 0, glowFront: 1.2, lookYaw: 0 });
// Face the camera, a little to the side, so the big eyes and smile show.
const portrait = thumbnailer.render(model.group, { yaw: 0.28, lift: 0.45, fill: 0.5 });

const image = new Image();
image.src = portrait;
await image.decode();

function compose(size) {
  const out = document.createElement("canvas");
  out.width = size;
  out.height = size;
  const context = out.getContext("2d");
  const gradient = context.createRadialGradient(size * 0.45, size * 0.35, size * 0.1, size * 0.5, size * 0.5, size * 0.75);
  gradient.addColorStop(0, "#ffe27a");
  gradient.addColorStop(0.55, "#ff9a3c");
  gradient.addColorStop(1, "#d8241f");
  context.fillStyle = gradient;
  context.fillRect(0, 0, size, size);
  // Sun rays behind the lizard.
  context.save();
  context.translate(size / 2, size / 2);
  context.fillStyle = "rgba(255, 255, 255, 0.16)";
  for (let i = 0; i < 12; i += 1) {
    context.rotate(Math.PI / 6);
    context.beginPath();
    context.moveTo(0, 0);
    context.lineTo(size, -size * 0.12);
    context.lineTo(size, size * 0.12);
    context.fill();
  }
  context.restore();
  context.drawImage(image, size * 0.0, size * 0.04, size, size);
  return out.toDataURL("image/png");
}

window.__ICONS__ = { 512: compose(512), 192: compose(192), 180: compose(180) };
window.__LAB__ = { ready: true };
