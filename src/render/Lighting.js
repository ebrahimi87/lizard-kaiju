import * as THREE from "three";

// Sun, sky fill, and image-based reflections. The sun's shadow box follows the focus
// point so shadows stay sharp around the player without a huge shadow map.

export function createLighting(scene, environment, mood, shadowSize) {
  scene.environment = environment;
  scene.environmentIntensity = mood.environmentIntensity;

  const hemisphere = new THREE.HemisphereLight(mood.skyLight, mood.groundLight, mood.hemisphereIntensity);
  scene.add(hemisphere);

  const sun = new THREE.DirectionalLight(mood.sunColor, mood.sunIntensity);
  sun.castShadow = true;
  sun.shadow.mapSize.set(shadowSize, shadowSize);
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.02;
  sun.shadow.radius = 4;
  scene.add(sun);
  scene.add(sun.target);

  const sunOffset = new THREE.Vector3().copy(mood.sunDirection).normalize();
  // The shadow camera's own sideways and up axes (it looks from the sun toward the target).
  const lightX = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), sunOffset).normalize();
  const lightY = new THREE.Vector3().crossVectors(sunOffset, lightX).normalize();
  const snapped = new THREE.Vector3();

  // extent: half-size of the shadow box in world units around the focus point.
  // The box size moves in whole units and its position moves in whole shadow-map
  // texels, so shadow edges stay still instead of shimmering as the lizard walks.
  function follow(focus, extent) {
    const size = Math.ceil(extent);
    const texel = (2 * size) / shadowSize;
    const x = focus.dot(lightX);
    const y = focus.dot(lightY);
    snapped.copy(focus)
      .addScaledVector(lightX, Math.round(x / texel) * texel - x)
      .addScaledVector(lightY, Math.round(y / texel) * texel - y);
    sun.target.position.copy(snapped);
    sun.position.copy(snapped).addScaledVector(sunOffset, size * 3);
    const camera = sun.shadow.camera;
    if (camera.right !== size) {
      camera.left = -size;
      camera.right = size;
      camera.top = size;
      camera.bottom = -size;
      camera.near = 0.1;
      camera.far = size * 7;
      camera.updateProjectionMatrix();
    }
  }

  return { sun, hemisphere, follow };
}
