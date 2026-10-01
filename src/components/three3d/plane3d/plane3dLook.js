// Toy look for "Đua máy bay Pokémon": toon ramp, soft rim light, inverted-hull outlines with a constant
// on-screen width, and an `anim` vertex attribute (vec3):
//   x = flap / sway amplitude (bird wings, flags, trees), y = glow (self-lit), z = flicker glow (lightning, lava, lights).
// Geometries carry `onormal` (smoothed normals) so outlines have no cracks; missing attributes read as zero.
import * as THREE from 'three';

/** Shared clock for every animated material (seconds). */
export const lookTime = { value: 0 };

/** Toon ramp generated in memory (soft pastel bands). */
export function toonRamp(steps = [120, 178, 226, 255]) {
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
uniform float uFlapF;
varying vec3 vAnim;
varying float vPh;
`;
const ANIM_VERTEX = `
  vAnim = anim;
  {
    #ifdef USE_INSTANCING
    vec3 aP = instanceMatrix[3].xyz;
    #else
    vec3 aP = modelMatrix[3].xyz;
    #endif
    vPh = aP.x * 0.71 + aP.z * 0.37 + aP.y * 0.5;
    float aPh = uTime * uFlapF + aP.x * 0.37 + aP.z * 0.11 + position.x * 0.25;
    transformed.y += sin(aPh) * anim.x;
    transformed.x += cos(aPh * 0.7) * anim.x * 0.12;
  }
`;
const FLICKER = 'vAnim.z * (max(0.0, sin(uTime * 7.0 + vPh) * sin(uTime * 2.3 + vPh * 1.7)) * 1.8 + 0.3 + 0.2 * sin(uTime * 3.0 + vPh))';

/**
 * Toon material with vertex colours, the anim attribute and a soft rim light.
 * `flash` is a uniform object ({ value: 0..1 }) for a white hit flash.
 */
export function toonMaterial({ ramp, color = '#ffffff', vertexColors = true, rim = 0.35, rimColor = '#ffffff', flapF = 12, flash = null, key = 'base', glowBoost = 1, ...extra } = {}) {
  const m = new THREE.MeshToonMaterial({ color, gradientMap: ramp, vertexColors, ...extra });
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = lookTime;
    sh.uniforms.uFlapF = { value: flapF };
    sh.uniforms.uRim = typeof rim === 'object' ? rim : { value: rim };
    sh.uniforms.uRimColor = typeof rimColor === 'object' && rimColor.value ? rimColor : { value: new THREE.Color(rimColor) };
    sh.uniforms.uFlash = flash || { value: 0 };
    sh.uniforms.uGlowBoost = typeof glowBoost === 'object' ? glowBoost : { value: glowBoost };
    sh.vertexShader = sh.vertexShader.replace('#include <common>', `#include <common>${ANIM_DECL}`).replace('#include <begin_vertex>', `#include <begin_vertex>${ANIM_VERTEX}`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vAnim;\nvarying float vPh;\nuniform float uTime;\nuniform float uRim;\nuniform vec3 uRimColor;\nuniform float uFlash;\nuniform float uGlowBoost;')
      .replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
        totalEmissiveRadiance += diffuseColor.rgb * (vAnim.y * uGlowBoost + (vAnim.z > 0.0 ? ${FLICKER} : 0.0));`
      )
      .replace(
        '#include <opaque_fragment>',
        `{
          float fr = 1.0 - clamp(dot(normalize(vViewPosition), normal), 0.0, 1.0);
          outgoingLight += uRimColor * smoothstep(0.55, 0.95, fr) * uRim;
          outgoingLight = mix(outgoingLight, vec3(1.0, 0.97, 0.85), uFlash * 0.75);
        }
        #include <opaque_fragment>`
      );
  };
  m.customProgramCacheKey = () => `plane3d-toon-${key}-${vertexColors ? 1 : 0}`;
  return m;
}

/**
 * Inverted-hull outline: back faces pushed out along `onormal` by a width that stays constant on screen
 * (`width` × distance) but never thicker than `max` (model units). With vertex colours the line is a
 * darker shade of each part.
 */
export function outlineMaterial({ width = 0.0036, max = 0.07, color = '#2a2440', vertexColors = true, darken = 0.36, flapF = 12, key = 'o' } = {}) {
  const m = new THREE.MeshBasicMaterial({ color: vertexColors ? new THREE.Color(darken, darken * 0.9, darken * 1.05) : color, side: THREE.BackSide, vertexColors });
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uOW = { value: width };
    sh.uniforms.uOM = { value: max };
    sh.uniforms.uTime = lookTime;
    sh.uniforms.uFlapF = { value: flapF };
    sh.vertexShader = sh.vertexShader.replace('#include <common>', `#include <common>\nuniform float uOW;\nuniform float uOM;\nattribute vec3 onormal;${ANIM_DECL}`).replace(
      '#include <begin_vertex>',
      `#include <begin_vertex>
      ${ANIM_VERTEX}
      {
        #ifdef USE_INSTANCING
        mat4 oM = modelMatrix * instanceMatrix;
        #else
        mat4 oM = modelMatrix;
        #endif
        vec3 oN = onormal;
        if (dot(oN, oN) > 0.0) {
          vec4 oW = oM * vec4(transformed, 1.0);
          float oD = distance(oW.xyz, cameraPosition);
          float oS = max(length(oM[0].xyz), 1e-4);
          transformed += normalize(oN) * min(uOW * oD / oS, uOM);
        }
      }`
    );
  };
  m.customProgramCacheKey = () => `plane3d-outline-${key}-${vertexColors ? 1 : 0}`;
  return m;
}

/** An outline drawn with the same geometry as `mesh` (a child of a plain mesh; for an InstancedMesh it is returned for the caller to add). */
export function outlineOf(mesh, material) {
  let o;
  if (mesh.isInstancedMesh) {
    o = new THREE.InstancedMesh(mesh.geometry, material, mesh.count);
    o.instanceMatrix = mesh.instanceMatrix;
    o.frustumCulled = mesh.frustumCulled;
  } else {
    o = new THREE.Mesh(mesh.geometry, material);
    mesh.add(o);
  }
  o.userData.outline = true;
  o.renderOrder = mesh.renderOrder;
  return o;
}

/** Fresnel bubble (shield, power-up bubbles): bright edges, clear middle, additive. */
export function bubbleMaterial(color = '#7dd3fc', { power = 2.2, strength = 1.1, base = 0.06 } = {}) {
  return new THREE.ShaderMaterial({
    uniforms: { uColor: { value: new THREE.Color(color) }, uTime: lookTime, uPower: { value: power }, uStrength: { value: strength }, uBase: { value: base }, uOpacity: { value: 1 } },
    vertexShader: `varying vec3 vN; varying vec3 vV; varying vec3 vP;
      void main(){ vec4 mv = modelViewMatrix * vec4(position, 1.0); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); vP = position; gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `uniform vec3 uColor; uniform float uTime; uniform float uPower; uniform float uStrength; uniform float uBase; uniform float uOpacity; varying vec3 vN; varying vec3 vV; varying vec3 vP;
      void main(){
        float f = pow(1.0 - abs(dot(normalize(vN), normalize(vV))), uPower);
        float shimmer = 0.5 + 0.5 * sin(vP.y * 9.0 - uTime * 4.0 + vP.x * 5.0);
        float a = (uBase + f * uStrength * (0.75 + 0.25 * shimmer)) * uOpacity;
        gl_FragColor = vec4(uColor * (0.6 + f * 0.9), a);
      }`,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
}
