import * as THREE from "three";

// Paints the body texture once per form and skin. The body tube maps u around the
// body (0 and 1 = belly midline, 0.5 = spine) and v along it (0 = tail tip, 1 = neck).

const SKIN_WIDTH = 256;
const SKIN_HEIGHT = 1024;

function hexToRgb(hex) {
  const color = new THREE.Color(hex);
  // Paint in sRGB; the texture is tagged SRGBColorSpace.
  return [color.r * 255, color.g * 255, color.b * 255];
}

// hexToRgb() writes THREE.Color's linear values, so the body shows darker and more
// saturated than the head and legs (ruby's deep red body depends on this). Palettes with
// matchBodyColors use the exact sRGB values instead, so gold stays gold, not orange.
function hexToSrgb(hex) {
  const value = parseInt(hex.slice(1), 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

function mix(a, b, t) {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

function smoothstep(edge0, edge1, x) {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

function hash2(x, y) {
  const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return s - Math.floor(s);
}

// Distance from (x, y) to the nearest jittered point in a wrapped grid, in cell units.
function nearestCellPoint(x, y, cols, jitter) {
  const cx = Math.floor(x);
  const cy = Math.floor(y);
  let best = 9;
  let bestId = 0;
  for (let oy = -1; oy <= 1; oy += 1) {
    for (let ox = -1; ox <= 1; ox += 1) {
      const gx = cx + ox;
      const gy = cy + oy;
      const wrappedX = ((gx % cols) + cols) % cols;
      const px = gx + 0.5 + (hash2(wrappedX, gy) - 0.5) * jitter;
      const py = gy + 0.5 + (hash2(gy + 17.3, wrappedX + 3.1) - 0.5) * jitter;
      const d = Math.hypot(x - px, y - py);
      if (d < best) {
        best = d;
        bestId = hash2(wrappedX * 3.7, gy * 1.9);
      }
    }
  }
  return { distance: best, id: bestId };
}

// Gap between the nearest and second-nearest jittered points: near 0 on cell borders.
function cellEdgeGap(x, y, cols, jitter) {
  const cx = Math.floor(x);
  const cy = Math.floor(y);
  let first = 9;
  let second = 9;
  for (let oy = -1; oy <= 1; oy += 1) {
    for (let ox = -1; ox <= 1; ox += 1) {
      const gx = cx + ox;
      const gy = cy + oy;
      const wrappedX = ((gx % cols) + cols) % cols;
      const px = gx + 0.5 + (hash2(wrappedX + 5.3, gy) - 0.5) * jitter;
      const py = gy + 0.5 + (hash2(gy + 9.1, wrappedX + 2.7) - 0.5) * jitter;
      const d = Math.hypot(x - px, y - py);
      if (d < first) {
        second = first;
        first = d;
      } else if (d < second) {
        second = d;
      }
    }
  }
  return second - first;
}

function fract(x) {
  return x - Math.floor(x);
}

// Optional palette fields add extra patterns on top of the base skin:
//   spotAmount  spot coverage that replaces the form's own (cherry's white spots)
//   flames      { color, tip, count } flame stripes licking up the sides
//   bandColors  hex list painted as bands from neck to tail tip (rainbow)
//   stars       { color, nebula, density } star speckles and soft clouds (galaxy)
//   cracks      { color, glow } glowing cracks; also returns an emissiveMap (lava)
//   matchBodyColors  paint exact sRGB colors so the body matches the head (see hexToSrgb)
export function paintBodySkin(palette, pattern) {
  const canvas = document.createElement("canvas");
  canvas.width = SKIN_WIDTH;
  canvas.height = SKIN_HEIGHT;
  const context = canvas.getContext("2d");
  const image = context.createImageData(SKIN_WIDTH, SKIN_HEIGHT);
  const bumpCanvas = document.createElement("canvas");
  bumpCanvas.width = SKIN_WIDTH;
  bumpCanvas.height = SKIN_HEIGHT;
  const bumpContext = bumpCanvas.getContext("2d");
  const bump = bumpContext.createImageData(SKIN_WIDTH, SKIN_HEIGHT);

  const toRgb = palette.matchBodyColors ? hexToSrgb : hexToRgb;
  const back = toRgb(palette.back);
  const backDark = toRgb(palette.backDark);
  const belly = toRgb(palette.belly);
  const spot = toRgb(palette.spot);
  const scaleCols = pattern.scaleCols;
  const scaleRows = scaleCols * pattern.aspect;
  const spotCols = pattern.spotCols;
  const spotRows = spotCols * pattern.aspect;
  const spotAmount = palette.spotAmount ?? pattern.spots;
  const bandColors = palette.bandColors?.map(toRgb);
  const flames = palette.flames && { color: toRgb(palette.flames.color), tip: toRgb(palette.flames.tip), count: palette.flames.count };
  const stars = palette.stars && { color: toRgb(palette.stars.color), nebula: toRgb(palette.stars.nebula), density: palette.stars.density };
  const cracks = palette.cracks && { color: toRgb(palette.cracks.color), glow: palette.cracks.glow };
  let glowContext = null;
  let glowImage = null;
  let glowCanvas = null;
  if (cracks) {
    glowCanvas = document.createElement("canvas");
    glowCanvas.width = SKIN_WIDTH;
    glowCanvas.height = SKIN_HEIGHT;
    glowContext = glowCanvas.getContext("2d");
    glowImage = glowContext.createImageData(SKIN_WIDTH, SKIN_HEIGHT);
  }

  for (let y = 0; y < SKIN_HEIGHT; y += 1) {
    const v = 1 - y / (SKIN_HEIGHT - 1);
    for (let x = 0; x < SKIN_WIDTH; x += 1) {
      const u = x / SKIN_WIDTH;
      const dorsal = Math.cos(Math.PI * 2 * (u - 0.5)); // 1 on the spine, -1 on the belly
      let backColor = back;
      if (bandColors) {
        // Soft-edged bands; the first color sits at the neck.
        const position = (1 - v) * bandColors.length;
        const index = Math.min(Math.floor(position), bandColors.length - 1);
        const next = Math.min(index + 1, bandColors.length - 1);
        backColor = mix(bandColors[index], bandColors[next], smoothstep(0.82, 1, position - index));
      }
      let color = mix(belly, backColor, smoothstep(-0.5, 0.05, dorsal));
      // A soft darker line along the spine gives the back a readable direction.
      color = mix(color, backDark, smoothstep(0.92, 1, dorsal) * 0.35);

      // Rainbow bands and flames replace the form's own dark bands.
      if (pattern.bands > 0 && !bandColors && !flames) {
        const band = Math.sin(v * pattern.bands * Math.PI * 2 + Math.sin(u * 12) * 0.25);
        const amount = smoothstep(0.35, 0.65, band) * smoothstep(-0.15, 0.35, dorsal);
        color = mix(color, backDark, amount * 0.85);
      }

      if (stars) {
        // Soft pink clouds first, then small bright stars on top.
        const cloud = Math.sin(v * 23 + Math.sin(u * Math.PI * 6) * 1.6) * Math.sin(u * Math.PI * 4 + v * 9);
        color = mix(color, stars.nebula, smoothstep(0.35, 0.95, cloud) * 0.45 * smoothstep(-0.4, 0.2, dorsal));
        const star = nearestCellPoint(u * 26, v * 26 * pattern.aspect * 1.6, 26, 0.9);
        if (star.id < stars.density) {
          const radius = 0.1 + star.id * 0.22;
          color = mix(color, stars.color, 1 - smoothstep(radius * 0.5, radius, star.distance));
        }
      }

      if (flames) {
        // Height up the side: 0 at the belly edge, 1 on the spine. Each flame is a tongue
        // that narrows toward the spine and leans back toward the tail.
        const h = Math.min(1, Math.max(0, (dorsal + 0.45) / 1.35));
        const wiggle = Math.sin(h * 7 + v * flames.count * 9) * 0.06;
        const offset = fract(v * flames.count * 3 + h * 0.55 + wiggle) - 0.5;
        const halfWidth = 0.46 * Math.pow(1 - h, 0.9);
        const amount = (1 - smoothstep(halfWidth - 0.05, halfWidth, Math.abs(offset))) * smoothstep(-0.55, -0.4, dorsal);
        color = mix(color, mix(flames.tip, flames.color, smoothstep(0.1, 0.6, h)), amount);
      }

      let crackAmount = 0;
      if (cracks) {
        const gap = cellEdgeGap(u * 10, v * 10 * pattern.aspect, 10, 0.85);
        crackAmount = (1 - smoothstep(0.04, 0.11, gap)) * smoothstep(-0.6, -0.1, dorsal);
        color = mix(color, cracks.color, crackAmount);
      }

      if (spotAmount > 0) {
        const cell = nearestCellPoint(u * spotCols, v * spotRows, spotCols, 0.8);
        const radius = 0.2 + cell.id * 0.16;
        if (cell.id < spotAmount && dorsal > -0.25) {
          const edge = 1 - smoothstep(radius - 0.05, radius, cell.distance);
          color = mix(color, spot, edge * smoothstep(-0.25, 0.1, dorsal));
        }
      }

      // Scales: darken cell edges a little and raise cell centers in the bump map.
      const scale = nearestCellPoint(u * scaleCols, v * scaleRows, scaleCols, 0.55);
      const rim = smoothstep(0.32, 0.55, scale.distance);
      const shade = 1 - rim * pattern.scaleContrast;
      const index = (y * SKIN_WIDTH + x) * 4;
      image.data[index] = color[0] * shade;
      image.data[index + 1] = color[1] * shade;
      image.data[index + 2] = color[2] * shade;
      image.data[index + 3] = 255;
      const height = 255 * (1 - smoothstep(0.1, 0.6, scale.distance)) * (1 - crackAmount * 0.8);
      bump.data[index] = height;
      bump.data[index + 1] = height;
      bump.data[index + 2] = height;
      bump.data[index + 3] = 255;
      if (glowImage) {
        const glow = crackAmount * cracks.glow;
        glowImage.data[index] = Math.min(255, cracks.color[0] * glow);
        glowImage.data[index + 1] = Math.min(255, cracks.color[1] * glow);
        glowImage.data[index + 2] = Math.min(255, cracks.color[2] * glow);
        glowImage.data[index + 3] = 255;
      }
    }
  }
  context.putImageData(image, 0, 0);
  bumpContext.putImageData(bump, 0, 0);

  const map = new THREE.CanvasTexture(canvas);
  map.colorSpace = THREE.SRGBColorSpace;
  map.anisotropy = 4;
  const bumpMap = new THREE.CanvasTexture(bumpCanvas);
  let emissiveMap = null;
  if (glowContext) {
    glowContext.putImageData(glowImage, 0, 0);
    emissiveMap = new THREE.CanvasTexture(glowCanvas);
    emissiveMap.colorSpace = THREE.SRGBColorSpace;
  }
  return { map, bumpMap, emissiveMap };
}

// Eye texture for a SphereGeometry: the pupil sits at u = 0.25, v = 0.5, which is +Z.
export function paintEye(irisHex, pupilScale) {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 128;
  const context = canvas.getContext("2d");
  context.fillStyle = "#fffaf0";
  context.fillRect(0, 0, 256, 128);
  const cx = 64;
  const cy = 64;
  const iris = context.createRadialGradient(cx, cy, 4, cx, cy, 30);
  const irisColor = new THREE.Color(irisHex);
  const light = irisColor.clone().lerp(new THREE.Color("#ffffff"), 0.35);
  iris.addColorStop(0, `#${light.getHexString()}`);
  iris.addColorStop(1, `#${irisColor.getHexString()}`);
  context.fillStyle = "#2a1408";
  context.beginPath();
  context.arc(cx, cy, 32, 0, Math.PI * 2);
  context.fill();
  context.fillStyle = iris;
  context.beginPath();
  context.arc(cx, cy, 29, 0, Math.PI * 2);
  context.fill();
  context.fillStyle = "#0b0605";
  context.beginPath();
  context.arc(cx, cy, 18 * pupilScale, 0, Math.PI * 2);
  context.fill();
  context.fillStyle = "#ffffff";
  context.beginPath();
  context.arc(cx - 9, cy - 10, 7, 0, Math.PI * 2);
  context.fill();
  context.beginPath();
  context.arc(cx + 8, cy + 9, 3, 0, Math.PI * 2);
  context.fill();
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}
