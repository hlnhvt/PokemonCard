// Shared "toy" look for Snorlax nuốt cả thành phố: toon ramp, soft rim light, inverted-hull outlines
// with a constant on-screen width, and the town material (wind sway, glowing bulbs, rippling water).
// Geometries may carry an `anim` attribute (vec3: sway weight, glow, water) and an `onormal`
// attribute (smoothed normals for crack-free outlines); missing attributes read as zero.
import * as THREE from 'three';

/** Shared clock for every animated material (seconds). */
export const lookTime = { value: 0 };

/** Toon ramp generated in memory (bright, soft bands for a pastel look). */
export function toonRamp(steps = [150, 200, 236, 255]) {
  const data = new Uint8Array(steps.length * 4);
  steps.forEach((v, i) => data.set([v, v, v, 255], i * 4));
  const tex = new THREE.DataTexture(data, steps.length, 1, THREE.RGBAFormat);
  tex.minFilter = THREE.NearestFilter;
  tex.magFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  tex.needsUpdate = true;
  return tex;
}

const ANIM_DECL = `
attribute vec3 anim;
uniform float uTime;
varying vec3 vAnim;
`;
// Wind sway (anim.x) bends the top of trees/flowers; water (anim.z) bobs a little.
const ANIM_VERTEX = `
  vAnim = anim;
  {
    #ifdef USE_INSTANCING
    vec3 aP = instanceMatrix[3].xyz;
    #else
    vec3 aP = modelMatrix[3].xyz;
    #endif
    float aPh = uTime * 1.7 + aP.x * 0.37 + aP.z * 0.29;
    transformed.x += sin(aPh) * anim.x;
    transformed.z += cos(aPh * 0.83 + 1.3) * anim.x * 0.6;
    transformed.y += (0.5 + 0.5 * sin(uTime * 4.0 + transformed.x * 3.0 + transformed.z * 2.0 + aP.z)) * anim.z * 0.035;
  }
`;

/**
 * Lambert material for the town: vertex colours + wind sway + glow + water shimmer.
 * The light is wrapped a little so the shadowed sides stay pastel instead of grey.
 */
export function townMaterial(extra = {}) {
  const m = new THREE.MeshLambertMaterial({ vertexColors: true, ...extra });
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = lookTime;
    sh.vertexShader = sh.vertexShader.replace('#include <common>', `#include <common>${ANIM_DECL}`).replace('#include <begin_vertex>', `#include <begin_vertex>${ANIM_VERTEX}`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vAnim;\nuniform float uTime;')
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
        if (vAnim.z > 0.0) {
          float rip = sin(uTime * 3.2 + vViewPosition.x * 1.7) * sin(uTime * 2.3 + vViewPosition.y * 2.1);
          diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * (1.0 + 0.18 * rip) + vec3(0.06), vAnim.z);
        }`
      )
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += diffuseColor.rgb * vAnim.y;');
  };
  m.customProgramCacheKey = () => 'gulp3d-town';
  return m;
}

/**
 * Toon material with a soft rim light. `patch(shader)` may add more (Snorlax uses it for its cream masks).
 */
export function toonMaterial(color, { ramp, rim = 0.32, rimColor = '#ffffff', key = 'base', patch = null, ...extra } = {}) {
  const m = new THREE.MeshToonMaterial({ color, gradientMap: ramp, ...extra });
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uRim = { value: rim };
    sh.uniforms.uRimColor = { value: new THREE.Color(rimColor) };
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform float uRim;\nuniform vec3 uRimColor;').replace(
      '#include <opaque_fragment>',
      `{
        float fr = 1.0 - clamp(dot(normalize(vViewPosition), normal), 0.0, 1.0);
        outgoingLight += uRimColor * smoothstep(0.6, 0.92, fr) * uRim;
      }
      #include <opaque_fragment>`
    );
    patch?.(sh);
  };
  m.customProgramCacheKey = () => `gulp3d-toon-${key}`;
  return m;
}

/**
 * Inverted-hull outline: back faces pushed out along the (smoothed) normal by a width that stays
 * constant on screen (`width` × distance) but never thicker than `max` (model units). With vertex colours the
 * line is a darker shade of each part (`darken`), otherwise `color`.
 */
export function outlineMaterial({ width = 0.0042, max = 0.09, color = '#22303a', vertexColors = false, darken = 0.42, attr = 'onormal', sway = false } = {}) {
  const m = new THREE.MeshBasicMaterial({ color: vertexColors ? new THREE.Color(darken, darken * 0.92, darken * 0.98) : color, side: THREE.BackSide, vertexColors });
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uOW = { value: width };
    sh.uniforms.uOM = { value: max };
    sh.uniforms.uTime = lookTime;
    const decl = `uniform float uOW;\nuniform float uOM;\n${attr === 'onormal' ? 'attribute vec3 onormal;' : ''}${sway ? ANIM_DECL : ''}`;
    sh.vertexShader = sh.vertexShader.replace('#include <common>', `#include <common>\n${decl}`).replace(
      '#include <begin_vertex>',
      `#include <begin_vertex>
      ${sway ? ANIM_VERTEX : ''}
      {
        #ifdef USE_INSTANCING
        mat4 oM = modelMatrix * instanceMatrix;
        #else
        mat4 oM = modelMatrix;
        #endif
        vec3 oN = ${attr};
        if (dot(oN, oN) > 0.0) {
          vec4 oW = oM * vec4(transformed, 1.0);
          float oD = distance(oW.xyz, cameraPosition);
          float oS = max(length(oM[0].xyz), 1e-4);
          transformed += normalize(oN) * min(uOW * oD / oS, uOM);
        }
      }`
    );
  };
  m.customProgramCacheKey = () => `gulp3d-outline-${attr}-${sway ? 1 : 0}-${vertexColors ? 1 : 0}`;
  return m;
}

/** An outline drawn with the same geometry (and instance matrices) as `mesh`; a plain mesh gets it as a child, an InstancedMesh's goes to the caller. */
export function outlineOf(mesh, material) {
  let o;
  if (mesh.isInstancedMesh) {
    o = new THREE.InstancedMesh(mesh.geometry, material, mesh.count);
    o.instanceMatrix = mesh.instanceMatrix; // shared: no extra uploads
    o.frustumCulled = mesh.frustumCulled;
  } else {
    o = new THREE.Mesh(mesh.geometry, material);
    mesh.add(o); // follows the mesh (and its squash & stretch)
  }
  o.castShadow = false;
  o.receiveShadow = false;
  o.userData.outline = true;
  o.renderOrder = mesh.renderOrder;
  return o;
}
