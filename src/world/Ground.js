import * as THREE from "three";

// Ground plane with painted-in-shader color variation, plus instanced grass tufts that
// sway in the wind and bend away from the player.

const NOISE_GLSL = /* glsl */ `
  float lkHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float lkNoise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(lkHash(i), lkHash(i + vec2(1.0, 0.0)), u.x),
               mix(lkHash(i + vec2(0.0, 1.0)), lkHash(i + vec2(1.0, 1.0)), u.x), u.y);
  }
  float lkFbm(vec2 p) {
    float value = 0.0;
    float amplitude = 0.5;
    for (int i = 0; i < 4; i++) {
      value += amplitude * lkNoise(p);
      p *= 2.03;
      amplitude *= 0.5;
    }
    return value;
  }
`;

export function createGround(scene, mood, size) {
  const geometry = new THREE.PlaneGeometry(size, size, 1, 1);
  geometry.rotateX(-Math.PI / 2);
  const material = new THREE.MeshStandardMaterial({ color: "#ffffff", roughness: 0.95 });
  const uniforms = {
    uGrassDark: { value: new THREE.Color(mood.grassDark) },
    uGrassLight: { value: new THREE.Color(mood.grassLight) },
    uDirt: { value: new THREE.Color(mood.dirt) },
    uStripes: { value: mood.lawnStripes },
    uDirtAmount: { value: mood.dirtAmount },
    uTrail: { value: mood.trail ? 1 : 0 },
    uRoads: { value: mood.roads ? 1 : 0 },
    uVolcanic: { value: mood.volcanic ? 1 : 0 },
    uRoadColor: { value: new THREE.Color(mood.roadColor ?? "#697182") },
  };
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vGroundPosition;")
      .replace("#include <begin_vertex>", "#include <begin_vertex>\nvGroundPosition = (modelMatrix * vec4(transformed, 1.0)).xyz;");
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        `#include <common>
        varying vec3 vGroundPosition;
        uniform vec3 uGrassDark;
        uniform vec3 uGrassLight;
        uniform vec3 uDirt;
        uniform float uStripes;
        uniform float uDirtAmount;
        uniform float uTrail;
        uniform float uRoads;
        uniform float uVolcanic;
        uniform vec3 uRoadColor;
        ${NOISE_GLSL}`,
      )
      .replace(
        "#include <color_fragment>",
        `#include <color_fragment>
        vec2 p = vGroundPosition.xz;
        float patches = lkFbm(p * 0.07);
        vec3 ground = mix(uGrassDark, uGrassLight, smoothstep(0.3, 0.75, patches));
        float stripe = step(0.0, sin(p.x * 0.42));
        ground *= 1.0 + uStripes * (stripe - 0.5) * 0.12;
        ground *= 0.92 + 0.16 * lkNoise(p * 2.7);
        float dirt = smoothstep(0.6, 0.66, lkFbm(p * 0.045 + 11.0)) * uDirtAmount;
        ground = mix(ground, uDirt * (0.9 + 0.2 * lkNoise(p * 5.0)), dirt);
        float trail = 1.0 - smoothstep(1.1, 2.2, abs(p.x - sin(p.y * 0.13) * 2.0));
        ground = mix(ground, uDirt, trail * uTrail * 0.8);
        vec2 block = abs(mod(p + 8.0, 16.0) - 8.0);
        float road = 1.0 - smoothstep(2.3, 2.4, min(block.x, block.y));
        ground = mix(ground, uRoadColor, road * uRoads);
        float dash = step(1.5, mod(p.y + p.x, 4.0));
        float line = (1.0 - smoothstep(0.06, 0.11, min(block.x, block.y))) * dash;
        ground = mix(ground, vec3(0.95, 0.79, 0.43), line * road * uRoads * 0.8);
        float fissureNoise = lkFbm(p * 0.65);
        // Thin glowing cracks, only in some patches, so the red lizard stays easy to see.
        float fissure = (1.0 - smoothstep(0.004, 0.014, abs(fissureNoise - 0.46)))
          * smoothstep(0.52, 0.62, lkFbm(p * 0.045 + 3.0))
          * smoothstep(4.5, 6.0, length(p)) * uVolcanic;
        ground = mix(ground, vec3(1.0, 0.22, 0.025), fissure);
        diffuseColor.rgb *= ground;`,
      )
      .replace("#include <emissivemap_fragment>", `#include <emissivemap_fragment>
        totalEmissiveRadiance += vec3(2.8, 0.32, 0.015) * fissure;`);
  };
  const ground = new THREE.Mesh(geometry, material);
  ground.receiveShadow = true;
  scene.add(ground);
  return ground;
}

function createTuftGeometry(bladeHeight) {
  const positions = [];
  const colors = [];
  const indices = [];
  const blades = 5;
  const segments = 4;
  const base = new THREE.Color("#6cae3e");
  const tip = new THREE.Color("#c9ec7a");
  const color = new THREE.Color();
  for (let b = 0; b < blades; b += 1) {
    const angle = (b / blades) * Math.PI * 2 + b * 0.7;
    const lean = 0.25 + (b % 3) * 0.12;
    const height = bladeHeight * (0.65 + ((b * 37) % 10) / 22);
    const width = bladeHeight * 0.16;
    const ox = Math.cos(angle) * bladeHeight * 0.08;
    const oz = Math.sin(angle) * bladeHeight * 0.08;
    const dx = Math.cos(angle);
    const dz = Math.sin(angle);
    const start = positions.length / 3;
    for (let s = 0; s <= segments; s += 1) {
      const t = s / segments;
      const bend = lean * t * t * height;
      const halfWidth = width * (1 - t) * 0.5;
      const cx = ox + dx * bend;
      const cz = oz + dz * bend;
      positions.push(cx - dz * halfWidth, t * height, cz + dx * halfWidth);
      positions.push(cx + dz * halfWidth, t * height, cz - dx * halfWidth);
      color.copy(base).lerp(tip, t);
      colors.push(color.r, color.g, color.b, color.r, color.g, color.b);
    }
    for (let s = 0; s < segments; s += 1) {
      const a = start + s * 2;
      indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  const normals = new Float32Array(positions.length);
  for (let i = 1; i < normals.length; i += 3) normals[i] = 1;
  geometry.setAttribute("normal", new THREE.BufferAttribute(normals, 3));
  geometry.setIndex(indices);
  return geometry;
}

// area: { width, depth } centered on the origin. random: seeded () => [0, 1).
export function createGrass(scene, mood, area, count, random, water = []) {
  const bladeHeight = mood.grassHeight;
  const geometry = createTuftGeometry(bladeHeight);
  const material = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, side: THREE.DoubleSide });
  const uniforms = {
    uTime: { value: 0 },
    uWind: { value: bladeHeight * 0.18 },
    uPush: { value: new THREE.Vector4(0, 0, 0, 0) }, // x, z, radius, strength
    uBladeHeight: { value: bladeHeight },
  };
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nuniform float uTime;\nuniform float uWind;\nuniform vec4 uPush;\nuniform float uBladeHeight;")
      .replace(
        "#include <project_vertex>",
        `vec4 mvPosition = vec4(transformed, 1.0);
        #ifdef USE_INSTANCING
          mvPosition = instanceMatrix * mvPosition;
          vec3 root = (instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
        #else
          vec3 root = vec3(0.0);
        #endif
        float bendWeight = clamp(position.y / uBladeHeight, 0.0, 1.2);
        bendWeight *= bendWeight;
        float gust = sin(uTime * 1.6 + root.x * 0.3 + root.z * 0.21) * 0.6 + sin(uTime * 3.1 + root.x * 0.9 - root.z * 0.4) * 0.25;
        mvPosition.x += gust * uWind * bendWeight;
        mvPosition.z += gust * uWind * 0.4 * bendWeight;
        vec2 away = root.xz - uPush.xy;
        float distanceToPush = length(away);
        float push = (1.0 - smoothstep(uPush.z * 0.4, uPush.z, distanceToPush)) * uPush.w;
        vec2 pushDirection = away / max(distanceToPush, 0.001);
        mvPosition.xz += pushDirection * push * bendWeight * uBladeHeight * 0.9;
        mvPosition.y -= push * bendWeight * uBladeHeight * 0.45;
        mvPosition = modelViewMatrix * mvPosition;
        gl_Position = projectionMatrix * mvPosition;`,
      );
  };
  const grass = new THREE.InstancedMesh(geometry, material, count);
  grass.receiveShadow = true;
  const matrix = new THREE.Matrix4();
  const quaternion = new THREE.Quaternion();
  const position = new THREE.Vector3();
  const scale = new THREE.Vector3();
  const up = new THREE.Vector3(0, 1, 0);
  const tint = new THREE.Color();
  const light = new THREE.Color(mood.grassTint);
  for (let i = 0; i < count; i += 1) {
    position.set((random() - 0.5) * area.width, 0, (random() - 0.5) * area.depth);
    // Keep blades off the shallow water without changing garden's random sequence.
    for (let attempt = 0; attempt < 30 && water.some((pool) => Math.hypot(position.x - pool.x, position.z - pool.z) < pool.radius + 0.2); attempt += 1) {
      position.set((random() - 0.5) * area.width, 0, (random() - 0.5) * area.depth);
    }
    quaternion.setFromAxisAngle(up, random() * Math.PI * 2);
    const size = 0.6 + random() * 0.8;
    scale.set(size, size * (0.8 + random() * 0.5), size);
    matrix.compose(position, quaternion, scale);
    grass.setMatrixAt(i, matrix);
    tint.setRGB(1, 1, 1).lerp(light, random() * 0.6);
    grass.setColorAt(i, tint);
  }
  grass.frustumCulled = false;
  scene.add(grass);
  return {
    mesh: grass,
    update(time, pushX, pushZ, pushRadius) {
      uniforms.uTime.value = time;
      uniforms.uPush.value.set(pushX, pushZ, pushRadius, 1);
    },
  };
}

// Shallow, walkable water and solid lava share a rippling painted surface. Pool
// circles are also the gameplay data: there is no separate hidden collision shape.
export function createPools(scene, mood, pools, lava = false) {
  const time = { value: 0 };
  const material = new THREE.MeshStandardMaterial({
    color: mood[lava ? "lavaColor" : "waterColor"],
    roughness: lava ? 0.8 : 0.28,
    metalness: 0,
    emissive: lava ? mood.lavaColor : "#000000",
    emissiveIntensity: lava ? mood.lavaIntensity : 0,
  });
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uPoolTime = time;
    shader.uniforms.uLava = { value: lava ? 1 : 0 };
    shader.uniforms.uPoolHighlight = { value: new THREE.Color(mood[lava ? "lavaHighlight" : "waterHighlight"]) };
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vPoolPosition;")
      .replace("#include <begin_vertex>", "#include <begin_vertex>\nvPoolPosition = (modelMatrix * vec4(transformed, 1.0)).xyz;");
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", `#include <common>
        varying vec3 vPoolPosition;
        uniform float uPoolTime;
        uniform vec3 uPoolHighlight;
        uniform float uLava;
        ${NOISE_GLSL}`)
      .replace("#include <color_fragment>", `#include <color_fragment>
        vec2 p = vPoolPosition.xz;
        float ripple = sin(p.x * 2.3 + sin(p.y * 1.7 + uPoolTime * 0.6) + uPoolTime * 0.8);
        float crossWave = sin(p.x * 0.73 - p.y * 0.6 - uPoolTime * 0.7);
        float glint = smoothstep(0.93, 1.0, ripple) * smoothstep(0.1, 0.8, crossWave) * 0.35;
        diffuseColor.rgb = mix(diffuseColor.rgb, uPoolHighlight, glint);
        float crust = smoothstep(0.02, 0.055, abs(lkFbm(p * 1.8 + uPoolTime * 0.035) - 0.43)) * uLava;
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.055, 0.035, 0.045), crust);`)
      .replace("#include <emissivemap_fragment>", `#include <emissivemap_fragment>
        totalEmissiveRadiance *= 1.0 - crust * 0.97;`);
  };
  const geometry = new THREE.CircleGeometry(1, 48);
  geometry.rotateX(-Math.PI / 2);
  for (const pool of pools) {
    const surface = new THREE.Mesh(geometry, material);
    surface.position.set(pool.x, lava ? 0.045 : 0.025, pool.z);
    surface.scale.setScalar(pool.radius);
    surface.receiveShadow = !lava;
    scene.add(surface);
  }
  return { update(elapsed) { time.value = elapsed; } };
}
