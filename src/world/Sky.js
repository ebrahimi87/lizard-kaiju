import * as THREE from "three";

// Gradient sky dome with a soft sun glow. Fog uses the horizon color so the world edge
// melts into the sky.

export function createSky(scene, mood, radius) {
  const material = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: {
      uTop: { value: new THREE.Color(mood.skyTop) },
      uHorizon: { value: new THREE.Color(mood.skyHorizon) },
      uBottom: { value: new THREE.Color(mood.skyBottom) },
      uSunDirection: { value: new THREE.Vector3().copy(mood.sunDirection).normalize() },
      uSunColor: { value: new THREE.Color(mood.sunColor) },
    },
    vertexShader: /* glsl */ `
      varying vec3 vDirection;
      void main() {
        vDirection = normalize(position);
        vec4 world = modelMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * viewMatrix * world;
        gl_Position.z = gl_Position.w;
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uTop;
      uniform vec3 uHorizon;
      uniform vec3 uBottom;
      uniform vec3 uSunDirection;
      uniform vec3 uSunColor;
      varying vec3 vDirection;
      void main() {
        float h = vDirection.y;
        vec3 color = mix(uHorizon, uTop, smoothstep(0.0, 0.55, h));
        color = mix(color, uBottom, smoothstep(0.0, -0.25, h));
        float sun = max(dot(vDirection, uSunDirection), 0.0);
        color += uSunColor * (pow(sun, 64.0) * 0.8 + pow(sun, 6.0) * 0.18);
        gl_FragColor = vec4(color, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(radius, 32, 16), material);
  sky.frustumCulled = false;
  sky.renderOrder = -10;
  scene.add(sky);
  scene.fog = new THREE.Fog(mood.skyHorizon, mood.fogNear ?? radius * 0.35, mood.fogFar ?? radius * 0.95);
  scene.background = new THREE.Color(mood.skyHorizon);
  return sky;
}
