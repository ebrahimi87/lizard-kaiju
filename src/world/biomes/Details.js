import * as THREE from "three";

// Repeated simple accents share one geometry and draw call per material.
export function addShapes(parent, geometry, material, placements) {
  if (!placements.length) return null;
  const mesh = new THREE.InstancedMesh(geometry, material, placements.length);
  const transform = new THREE.Object3D();
  placements.forEach(({ x, y = 0, z, sx = 1, sy = 1, sz = 1, rotation = 0 }, index) => {
    transform.position.set(x, y, z);
    transform.scale.set(sx, sy, sz);
    transform.rotation.set(0, rotation, 0);
    transform.updateMatrix();
    mesh.setMatrixAt(index, transform.matrix);
  });
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

export function addMotes(parent, random, centers, color, rise = false) {
  const positions = [];
  for (const center of centers) {
    for (let i = 0; i < 12; i += 1) {
      positions.push(center.x + (random() - 0.5) * 4, 0.3 + random() * 2.5, center.z + (random() - 0.5) * 4);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  const time = { value: 0 };
  const material = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { uTime: time, uColor: { value: new THREE.Color(color) }, uRise: { value: rise ? 1 : 0 } },
    vertexShader: `uniform float uTime; uniform float uRise;
      void main() {
        vec3 p = position;
        p.y = 0.3 + mod(p.y + uTime * (0.15 + uRise * 0.6), 2.8);
        p.x += sin(uTime + position.z * 3.0) * 0.16;
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_PointSize = min(10.0, 36.0 / -mv.z);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `uniform vec3 uColor;
      void main() {
        float a = 1.0 - smoothstep(0.1, 0.5, length(gl_PointCoord - 0.5));
        gl_FragColor = vec4(uColor * 2.5, a * 0.8);
      }`,
  });
  parent.add(new THREE.Points(geometry, material));
  return (elapsed) => { time.value = elapsed; };
}
