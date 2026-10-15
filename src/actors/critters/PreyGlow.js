// A faint, slowly pulsing warm glow around the edges of prey critters, so small bugs
// stand out against grass and say "food" (buddies do not get it). The glow is light
// added where a surface turns away from the camera (a rim), which reads as an outline
// from the high game camera. Bright edges also pass the bloom threshold a little.
//   addPreyGlow(model.group)   once per critter
//   updatePreyGlow(time)       once per frame (all critters share the uniforms)
//   new GlowSpots(scene, max)  soft pools of light on the ground under each critter

import * as THREE from "three";

const uniforms = {
  uRimColor: { value: new THREE.Color("#ffd75a") },
  uRimStrength: { value: 1.2 },
};

function patch(material) {
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uRimColor = uniforms.uRimColor;
    shader.uniforms.uRimStrength = uniforms.uRimStrength;
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", "#include <common>\nuniform vec3 uRimColor;\nuniform float uRimStrength;")
      .replace(
        "#include <emissivemap_fragment>",
        `#include <emissivemap_fragment>
        float rimFacing = 1.0 - saturate(dot(normal, normalize(vViewPosition)));
        totalEmissiveRadiance += uRimColor * (smoothstep(0.25, 1.0, rimFacing) * uRimStrength);`,
      );
  };
  // Every glowing material shares one compiled shader program.
  material.customProgramCacheKey = () => "prey-glow";
}

export function addPreyGlow(group) {
  group.traverse((object) => {
    if (!object.isMesh) return;
    const material = object.material;
    // Eyes (textured) and see-through parts stay as they are.
    if (!material.isMeshStandardMaterial || material.map || material.transparent) return;
    patch(material);
  });
}

export function updatePreyGlow(time) {
  uniforms.uRimStrength.value = 1.5 + 0.5 * Math.sin(time * 3.2);
}

function spotTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 64;
  canvas.height = 64;
  const context = canvas.getContext("2d");
  // A soft pool of light with a brighter ring near its edge, so it reads as a glowing
  // outline on light ground (sand, paving) as well as on grass.
  const gradient = context.createRadialGradient(32, 32, 0, 32, 32, 32);
  gradient.addColorStop(0, "rgba(255, 255, 255, 0.85)");
  gradient.addColorStop(0.4, "rgba(255, 255, 255, 0.45)");
  gradient.addColorStop(0.62, "rgba(255, 255, 255, 0.5)");
  gradient.addColorStop(0.72, "rgba(255, 255, 255, 0.95)");
  gradient.addColorStop(0.84, "rgba(255, 255, 255, 0.25)");
  gradient.addColorStop(1, "rgba(255, 255, 255, 0)");
  context.fillStyle = gradient;
  context.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(canvas);
}

// One instanced, additive disc per critter, lying on the ground and breathing in size
// and brightness. Colors are HDR so the centers bloom softly; shiny critters glow gold.
export class GlowSpots {
  constructor(scene, max) {
    const geometry = new THREE.PlaneGeometry(1, 1);
    geometry.rotateX(-Math.PI / 2);
    const material = new THREE.MeshBasicMaterial({
      map: spotTexture(),
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
    });
    this.mesh = new THREE.InstancedMesh(geometry, material, max);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 3;
    this.mesh.count = 0;
    scene.add(this.mesh);
    this.max = max;
    this.matrix = new THREE.Matrix4();
    this.position = new THREE.Vector3();
    this.quaternion = new THREE.Quaternion();
    this.scale = new THREE.Vector3();
    this.normal = new THREE.Color(0.62, 0.46, 0.12);
    this.gold = new THREE.Color(0.9, 0.62, 0.1);
    this.color = new THREE.Color();
  }

  // critters: [{ position, radius, shiny, size (0..1 pop-in / eaten shrink), phase }]
  update(critters, time) {
    let count = 0;
    for (const critter of critters) {
      if (count >= this.max || critter.size <= 0) continue;
      const breathe = 1 + 0.12 * Math.sin(time * 3.2 + critter.phase);
      const size = critter.radius * 4.2 * critter.size * breathe;
      this.position.set(critter.position.x, 0.04, critter.position.z);
      this.scale.set(size, 1, size);
      this.matrix.compose(this.position, this.quaternion, this.scale);
      this.mesh.setMatrixAt(count, this.matrix);
      this.color.copy(critter.shiny ? this.gold : this.normal).multiplyScalar(0.8 + 0.35 * Math.sin(time * 3.2 + critter.phase));
      this.mesh.setColorAt(count, this.color);
      count += 1;
    }
    this.mesh.count = count;
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }
}
