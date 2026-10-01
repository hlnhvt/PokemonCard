// Procedural chunky cartoon propeller plane for "Đua máy bay Pokémon" (no model files).
// Local frame: forward is -Z, up is +Y, right is +X. About 3.7 m wingspan, 3.8 m long.
// Parts: lathed fuselage with belly and stripe, cowling, striped spinner, 3-blade propeller with a motion-blur
// disc, rounded wings with stripes and tip lights, tailplane, fin with a Poké Ball emblem, glass canopy with
// frame and highlight, wheel spats, exhausts, afterburner flames, shield bubble and the pilot billboard.
import * as THREE from 'three';
import { part, merge, lathe, torus, cyl, sph, slab, roundShape, canvasTexture, glowTexture, shade, mix, TAU } from './plane3dGeo';
import { toonMaterial, outlineMaterial, outlineOf, bubbleMaterial, lookTime } from './plane3dLook';

/** Wingtip positions in the local frame (for the vapor trails). */
export const WINGTIPS = [new THREE.Vector3(-1.86, -0.12, -0.12), new THREE.Vector3(1.86, -0.12, -0.12)];
export const TAIL = new THREE.Vector3(0, 0.12, 1.85);

const NOSE_Z = -1.55;

/** Bend a geometry's vertices (dihedral): y += |x| * k. */
function dihedral(geo, k) {
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) p.setY(i, p.getY(i) + Math.abs(p.getX(i)) * k);
  geo.computeVertexNormals();
  return geo;
}

function bodyParts(L) {
  const parts = [];
  const belly = mix(L.body, '#fff8e8', 0.72);
  // Fuselage (lathe around +Y, turned so the nose points to -Z)
  // profile points sit exactly on the colour band edges, so bands are clean rings
  const R = (z) => {
    const pts = [[-1.56, 0.0], [-1.53, 0.25], [-1.44, 0.42], [-1.3, 0.51], [-1.25, 0.53], [-0.95, 0.6], [-0.55, 0.63], [-0.15, 0.62], [0.3, 0.57], [0.75, 0.48], [1.18, 0.36], [1.52, 0.25], [1.74, 0.16], [1.84, 0.0]];
    for (let i = 1; i < pts.length; i++) if (z <= pts[i][0]) return pts[i - 1][1] + ((z - pts[i - 1][0]) / (pts[i][0] - pts[i - 1][0])) * (pts[i][1] - pts[i - 1][1]);
    return 0;
  };
  const zs = [-1.56, -1.53, -1.44, -1.3, -1.25, -1.1, -0.95, -0.75, -0.55, -0.35, -0.15, 0.08, 0.3, 0.38, 0.58, 0.66, 0.74, 0.95, 1.18, 1.36, 1.52, 1.64, 1.74, 1.8, 1.84];
  const prof = zs.map((z) => [R(z), z]);
  parts.push(
    part(lathe(prof, 32), (tri, pos, i, c) => {
      if (c.z < -1.3) return L.trim;
      if (c.z > 0.38 && c.z < 0.58) return L.stripe;
      if (c.z > 0.66 && c.z < 0.74) return L.trim;
      if (c.y < -0.3) return belly;
      return L.body;
    }, { r: [Math.PI / 2, 0, 0] })
  );
  // Cowling ring and the dark intake behind the spinner
  parts.push(part(torus(0.52, 0.09, 10, 30), shade(L.trim, 0.92), { p: [0, 0, -1.32] }));
  parts.push(part(cyl(0.44, 0.44, 0.05, 24), '#3b3347', { p: [0, 0, NOSE_Z + 0.02], r: [Math.PI / 2, 0, 0] }));
  // Headrest bump behind the canopy and a little spine
  parts.push(part(sph(0.27, 16, 10), L.body, { p: [0, 0.5, 0.24], s: [0.9, 0.8, 1.5] }));
  // Exhaust stubs
  for (const sx of [-1, 1]) {
    for (let k = 0; k < 2; k++) parts.push(part(cyl(0.06, 0.07, 0.22, 10), '#5b5566', { p: [sx * 0.55, -0.02 - k * 0.14, -0.98 + k * 0.08], r: [Math.PI / 2 - 0.5, 0, sx * 0.4] }));
  }
  // Main wing: rounded planform, stripes near the tips, gentle dihedral
  const wingPts = roundShape([
    [-1.86, 0.08], [-1.72, 0.38], [-0.9, 0.52], [0, 0.55], [0.9, 0.52], [1.72, 0.38], [1.86, 0.08], [1.74, -0.22], [0.9, -0.4], [0, -0.44], [-0.9, -0.4], [-1.74, -0.22],
  ], 64);
  const wing = dihedral(slab(wingPts, 0.1, 0.05, 2).rotateX(-Math.PI / 2), 0.07);
  parts.push(
    part(wing, (tri, pos, i, c) => {
      const ax = Math.abs(c.x);
      if (ax > 1.5) return L.trim;
      if (ax > 1.05 && ax < 1.25) return L.stripe;
      if (ax < 0.62 && c.y < -0.24) return belly;
      return L.wing;
    }, { p: [0, -0.3, -0.25] })
  );
  // Tailplane and fin
  const tailPts = roundShape([[-0.95, 0.0], [-0.85, 0.22], [0, 0.3], [0.85, 0.22], [0.95, 0.0], [0.82, -0.2], [0, -0.26], [-0.82, -0.2]], 40);
  parts.push(part(dihedral(slab(tailPts, 0.07, 0.035, 2).rotateX(-Math.PI / 2), 0.05), (tri, pos, i, c) => (Math.abs(c.x) > 0.68 ? L.trim : L.wing), { p: [0, 0.12, 1.42] }));
  const finPts = roundShape([[0.62, 0.02], [0.38, 0.32], [0.12, 0.86], [-0.12, 0.98], [-0.3, 0.86], [-0.28, 0.4], [-0.45, 0.04]], 40);
  parts.push(part(slab(finPts, 0.08, 0.04, 2).rotateY(-Math.PI / 2), (tri, pos, i, c) => (c.y > 0.95 ? L.trim : L.body), { p: [0, 0.18, 1.32] }));
  // Canopy frame: an oval ring on the fuselage and an arch along the middle
  parts.push(part(torus(0.4, 0.05, 8, 32), L.trim, { p: [0, 0.5, -0.36], r: [Math.PI / 2, 0, 0], s: [0.95, 1.4, 1] }));
  parts.push(part(torus(0.4, 0.035, 6, 20, Math.PI), L.trim, { p: [0, 0.5, -0.36], r: [0, Math.PI / 2, 0], s: [1.4, 1.22, 1] }));
  // cockpit tub (dark inside) so the canopy sits on the body
  parts.push(part(cyl(0.37, 0.4, 0.22, 24), '#3b3347', { p: [0, 0.44, -0.36], s: [1, 1, 1.4] }));
  // Wheel spats, struts and tyres
  for (const sx of [-1, 1]) {
    parts.push(part(cyl(0.045, 0.06, 0.42, 8), shade(L.trim, 0.8), { p: [sx * 0.78, -0.55, -0.32], r: [0, 0, sx * 0.12] }));
    parts.push(part(sph(0.22, 16, 10), L.trim, { p: [sx * 0.82, -0.8, -0.32], s: [0.62, 0.78, 1.45] }));
    parts.push(part(torus(0.15, 0.065, 8, 18), '#2b2833', { p: [sx * 0.82, -0.92, -0.3], r: [0, Math.PI / 2, 0] }));
  }
  parts.push(part(sph(0.07, 10, 8), '#2b2833', { p: [0, -0.12, 1.66] }));
  return parts;
}

function propParts(L) {
  const parts = [];
  // Spinner: striped dome pointing forward
  const spin = [[0.0, -0.46], [0.1, -0.42], [0.18, -0.32], [0.24, -0.16], [0.27, 0.0], [0.27, 0.05]];
  parts.push(part(lathe(spin, 20), (tri, pos, i, c) => (c.z < -0.3 ? '#ffffff' : c.z < -0.16 ? L.trim : '#ffffff'), { r: [Math.PI / 2, 0, 0], p: [0, 0, 0.02] }));
  // Three chunky blades with yellow tips
  for (let k = 0; k < 3; k++) {
    const a = (k / 3) * TAU;
    const blade = roundShape([[-0.07, 0.12], [0.08, 0.12], [0.12, 0.6], [0.09, 0.95], [-0.02, 1.0], [-0.1, 0.62]], 24);
    parts.push(
      part(slab(blade, 0.035, 0.018, 2), (tri, pos, i, c) => (Math.hypot(c.x, c.y) > 0.82 ? '#ffd23f' : '#5a3f2e'), { r: [0, 0.38, a], order: 'ZYX' })
    );
  }
  return parts;
}

function blurTexture() {
  return canvasTexture(128, 128, (ctx) => {
    const g = ctx.createRadialGradient(64, 64, 8, 64, 64, 64);
    g.addColorStop(0, 'rgba(255,255,255,0.0)');
    g.addColorStop(0.25, 'rgba(255,255,255,0.18)');
    g.addColorStop(0.82, 'rgba(255,255,255,0.32)');
    g.addColorStop(0.9, 'rgba(255,220,90,0.55)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 128, 128);
    ctx.globalCompositeOperation = 'destination-out';
    for (let k = 0; k < 3; k++) {
      ctx.save();
      ctx.translate(64, 64);
      ctx.rotate((k / 3) * TAU + 0.6);
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, 64, 0, 1.1);
      ctx.fill();
      ctx.restore();
    }
  });
}

function emblemTexture() {
  return canvasTexture(128, 128, (ctx) => {
    const c = 64;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(c, c, 60, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#ef4444';
    ctx.beginPath();
    ctx.arc(c, c, 60, Math.PI, TAU);
    ctx.fill();
    ctx.fillStyle = '#1f1d2b';
    ctx.fillRect(4, c - 7, 120, 14);
    ctx.lineWidth = 8;
    ctx.strokeStyle = '#1f1d2b';
    ctx.beginPath();
    ctx.arc(c, c, 58, 0, TAU);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(c, c, 20, 0, TAU);
    ctx.fillStyle = '#1f1d2b';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(c, c, 12, 0, TAU);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.beginPath();
    ctx.ellipse(c - 22, c - 30, 14, 7, -0.6, 0, TAU);
    ctx.fill();
  });
}

function flameGeometry(r, h) {
  const pts = [];
  for (let i = 0; i <= 10; i++) {
    const t = i / 10;
    const w = Math.sin(Math.PI * Math.pow(t, 0.5)) * Math.pow(1 - t, 0.4);
    pts.push(new THREE.Vector2(Math.max(1e-4, w * r), t * h));
  }
  return new THREE.LatheGeometry(pts, 12).rotateX(Math.PI / 2); // grows towards +Z (behind the plane)
}

function drawPlaceholder(color) {
  return (ctx, w, h) => {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(w / 2, h / 2, w * 0.36, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(w * 0.4, h * 0.44, w * 0.06, 0, TAU);
    ctx.arc(w * 0.6, h * 0.44, w * 0.06, 0, TAU);
    ctx.fill();
  };
}

/**
 * Build the plane. Returns { group, update(dt, opts), setLivery(livery), setPilot(texture), flash, dispose }.
 * update opts: { prop (0..1 spin), boost (bool), shield (bool), magnet (bool), t }.
 */
export function createPlane({ livery, ramp, pilotColor = '#fbbf24' }) {
  const disposables = new Set();
  const own = (x) => {
    if (x) disposables.add(x);
    return x;
  };
  const flash = { value: 0 };
  const group = new THREE.Group();
  const tilt = new THREE.Group(); // bank / pitch / wobble live here
  group.add(tilt);

  const bodyMat = own(toonMaterial({ ramp, flash, key: 'plane', rim: 0.45 }));
  const lineMat = own(outlineMaterial({ width: 0.0032, max: 0.05, key: 'plane' }));
  const body = new THREE.Mesh(undefined, bodyMat);
  const bodyLine = outlineOf(body, lineMat);
  tilt.add(body);
  void bodyLine;

  // Propeller
  const prop = new THREE.Group();
  prop.position.set(0, 0, NOSE_Z - 0.04);
  tilt.add(prop);
  const propMesh = new THREE.Mesh(undefined, bodyMat);
  outlineOf(propMesh, lineMat);
  prop.add(propMesh);
  const discMat = own(new THREE.MeshBasicMaterial({ map: own(blurTexture()), transparent: true, depthWrite: false, opacity: 0, side: THREE.DoubleSide }));
  const disc = new THREE.Mesh(own(new THREE.CircleGeometry(1.05, 40)), discMat);
  disc.position.set(0, 0, NOSE_Z - 0.12);
  disc.renderOrder = 3;
  tilt.add(disc);

  // Wingtip lights
  const tipGlow = own(glowTexture());
  const tips = [];
  for (const [i, color] of [[0, '#ff4d6d'], [1, '#4dff88']]) {
    const lamp = new THREE.Mesh(own(new THREE.SphereGeometry(0.07, 10, 8)), own(new THREE.MeshBasicMaterial({ color })));
    lamp.position.copy(WINGTIPS[i]).add(new THREE.Vector3(0, -0.12, -0.08));
    const halo = new THREE.Sprite(own(new THREE.SpriteMaterial({ map: tipGlow, color, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })));
    halo.scale.set(0.6, 0.6, 1);
    lamp.add(halo);
    tilt.add(lamp);
    tips.push(halo);
  }

  // Fin emblem (both sides)
  const emblemMat = own(new THREE.MeshToonMaterial({ map: own(emblemTexture()), gradientMap: ramp, transparent: true, alphaTest: 0.1 }));
  const emblemGeo = own(new THREE.CircleGeometry(0.2, 28));
  for (const sx of [-1, 1]) {
    const e = new THREE.Mesh(emblemGeo, emblemMat);
    e.position.set(sx * 0.1, 0.6, 1.42);
    e.rotation.y = sx * Math.PI / 2;
    tilt.add(e);
  }

  // Pilot billboard inside the canopy (the child's Pokémon), then the glass over it
  const pilotMat = own(new THREE.SpriteMaterial({ map: own(canvasTexture(64, 64, drawPlaceholder(pilotColor))), transparent: true, alphaTest: 0.1, depthWrite: true }));
  const pilot = new THREE.Sprite(pilotMat);
  pilot.scale.set(0.62, 0.62, 1);
  pilot.position.set(0, 0.8, -0.38);
  pilot.renderOrder = 1;
  tilt.add(pilot);
  const glassMat = own(new THREE.MeshStandardMaterial({ color: '#bfefff', transparent: true, opacity: 0.3, roughness: 0.08, metalness: 0.2, emissive: '#5fb7d6', emissiveIntensity: 0.25, depthWrite: false }));
  const glassGeo = own(new THREE.SphereGeometry(0.4, 24, 12, 0, TAU, 0, Math.PI / 2));
  const glass = new THREE.Mesh(glassGeo, glassMat);
  glass.position.set(0, 0.5, -0.36);
  glass.scale.set(0.95, 1.22, 1.4);
  glass.renderOrder = 4;
  tilt.add(glass);
  const shineMat = own(new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.55, depthWrite: false, side: THREE.DoubleSide }));
  const shine = new THREE.Mesh(own(new THREE.SphereGeometry(0.405, 16, 6, -1.1, 0.55, 0.35, 0.7)), shineMat);
  shine.position.copy(glass.position);
  shine.scale.copy(glass.scale);
  shine.renderOrder = 5;
  tilt.add(shine);

  // Afterburner flames (boost)
  const flameTex = own(glowTexture('rgba(255,255,255,1)', 'rgba(255,200,80,0.5)'));
  const flames = new THREE.Group();
  const outerMat = own(new THREE.MeshBasicMaterial({ color: '#ff7a1a', transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false }));
  const innerMat = own(new THREE.MeshBasicMaterial({ color: '#fff3a0', transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false }));
  const fOuter = own(flameGeometry(0.34, 2.2));
  const fInner = own(flameGeometry(0.18, 1.4));
  const flameSets = [];
  for (const [x, y, z, s] of [[0, -0.05, 1.75, 1.35], [-0.6, -0.1, -0.9, 0.7], [0.6, -0.1, -0.9, 0.7]]) {
    const f = new THREE.Group();
    f.position.set(x, y, z);
    f.scale.setScalar(s);
    const o = new THREE.Mesh(fOuter, outerMat);
    const n = new THREE.Mesh(fInner, innerMat);
    const g = new THREE.Sprite(own(new THREE.SpriteMaterial({ map: flameTex, color: '#ffb347', transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })));
    g.scale.set(2.2, 2.2, 1);
    g.position.z = 0.4;
    f.add(o, n, g);
    flames.add(f);
    flameSets.push(f);
  }
  flames.visible = false;
  tilt.add(flames);

  // Shield bubble and magnet rings
  const shieldMat = own(bubbleMaterial('#7dd3fc', { power: 2.4, strength: 1.2, base: 0.05 }));
  const shield = new THREE.Mesh(own(new THREE.IcosahedronGeometry(2.35, 3)), shieldMat);
  shield.scale.set(1, 0.72, 1.05);
  shield.visible = false;
  group.add(shield);
  const magMat = own(new THREE.MeshBasicMaterial({ color: '#7cc4ff', transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false }));
  const magnet = new THREE.Group();
  for (let k = 0; k < 2; k++) {
    const ring = new THREE.Mesh(own(new THREE.TorusGeometry(2.1, 0.03, 6, 48)), magMat);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = -0.3 + k * 0.5;
    magnet.add(ring);
  }
  magnet.visible = false;
  group.add(magnet);

  let bodyGeo = null;
  let propGeo = null;
  function setLivery(L) {
    bodyGeo?.dispose();
    propGeo?.dispose();
    bodyGeo = merge(bodyParts(L));
    propGeo = merge(propParts(L));
    body.geometry = bodyGeo;
    body.children[0].geometry = bodyGeo;
    propMesh.geometry = propGeo;
    propMesh.children[0].geometry = propGeo;
  }
  setLivery(livery);

  let spin = 0;
  function update(dt, { prop: p = 1, boost = false, shield: sh = false, magnet: mg = false, t = lookTime.value } = {}) {
    const rate = p * (boost ? 46 : 34);
    spin += rate * dt;
    prop.rotation.z = spin;
    const fast = THREE.MathUtils.smoothstep(p, 0.35, 0.85);
    discMat.opacity = fast * 0.9;
    propMesh.visible = fast < 0.98;
    disc.rotation.z = -spin * 0.15;
    for (const h of tips) h.material.opacity = 0.6 + 0.4 * Math.sin(t * 6);
    flames.visible = boost;
    if (boost) {
      flameSets.forEach((f, i) => {
        const k = 0.85 + 0.25 * Math.sin(t * 40 + i * 2) + 0.1 * Math.sin(t * 23 + i);
        f.children[0].scale.set(1, 1, k * 1.15);
        f.children[1].scale.set(1, 1, k);
      });
    }
    shield.visible = sh;
    if (sh) {
      shield.rotation.y += dt * 0.6;
      shieldMat.uniforms.uOpacity.value = 0.85 + 0.15 * Math.sin(t * 5);
    }
    magnet.visible = mg;
    if (mg) {
      magnet.rotation.y += dt * 2;
      magnet.children.forEach((r, i) => r.scale.setScalar(1 + 0.08 * Math.sin(t * 6 + i * 1.6)));
    }
  }

  function setPilot(texture) {
    pilotMat.map = texture;
    pilotMat.needsUpdate = true;
  }

  function dispose() {
    bodyGeo?.dispose();
    propGeo?.dispose();
    for (const d of disposables) d.dispose?.();
  }

  return { group, tilt, update, setLivery, setPilot, flash, dispose, pilot };
}
