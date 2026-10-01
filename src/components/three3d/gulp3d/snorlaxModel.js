// Procedural toon Snorlax (and its little cousin Munchlax) for "Snorlax nuốt cả thành phố".
// No model files: a lathed pear body, protruding cream belly and face patches, swept-tube eyelids,
// a mouth that opens with fangs and tongue, stubby arms with claws, feet with cream pads.
// Local frame: the model faces +Z, up is +Y, feet at y = 0, body radius ~1 (scale it by the engine R).
import * as THREE from 'three';

const TAU = Math.PI * 2;
const v3 = (x, y, z) => new THREE.Vector3(x, y, z);

export const SNORLAX_COLORS = {
  body: '#3a7d93',
  cream: '#f4e3bd',
  claw: '#ffffff',
  pad: '#b98a5c',
  lid: '#1d2b38',
  mouth: '#7b2337',
  tongue: '#f38ba3',
  white: '#ffffff',
  pupil: '#18202b',
};
export const MUNCHLAX_COLORS = { ...SNORLAX_COLORS, body: '#2b5672', cream: '#f2ddb0' };

/** 4-step toon ramp (generated in memory). */
function toonRamp() {
  const steps = [150, 196, 232, 255];
  const data = new Uint8Array(steps.length * 4);
  steps.forEach((v, i) => data.set([v, v, v, 255], i * 4));
  const tex = new THREE.DataTexture(data, steps.length, 1, THREE.RGBAFormat);
  tex.minFilter = THREE.NearestFilter;
  tex.magFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  tex.needsUpdate = true;
  return tex;
}

/** Tube swept along a curve with a varying radius (eyelids, mouth line, claws). */
function sweep(points, radius, { segs = 10, radial = 6 } = {}) {
  const curve = new THREE.CatmullRomCurve3(points);
  const r = typeof radius === 'function' ? radius : () => radius;
  const g = new THREE.TubeGeometry(curve, segs, 1, radial, false);
  // Rescale each ring around the curve to the wanted radius
  const pos = g.attributes.position;
  const p = new THREE.Vector3();
  const c = new THREE.Vector3();
  for (let i = 0; i <= segs; i++) {
    const t = i / segs;
    curve.getPointAt(t, c);
    for (let j = 0; j <= radial; j++) {
      const k = i * (radial + 1) + j;
      p.fromBufferAttribute(pos, k).sub(c).multiplyScalar(r(t)).add(c);
      pos.setXYZ(k, p.x, p.y, p.z);
    }
  }
  pos.needsUpdate = true;
  g.computeVertexNormals();
  return g;
}

/**
 * createSnorlax({ variant: 'snorlax' | 'munchlax' }) →
 *  group (add to the moving object; rotate.y = heading), mouth (Object3D: where food goes),
 *  update(dt, { moving, sleeping }), chomp(), bounce(k), wobble(), dispose(), parts.
 */
export function createSnorlax({ variant = 'snorlax' } = {}) {
  const munch = variant === 'munchlax';
  const C = munch ? MUNCHLAX_COLORS : SNORLAX_COLORS;
  const disposables = new Set();
  const G = (g) => (disposables.add(g), g);
  const ramp = toonRamp();
  disposables.add(ramp);
  const toon = (color, extra = {}) => {
    const m = new THREE.MeshToonMaterial({ color, gradientMap: ramp, ...extra });
    disposables.add(m);
    return m;
  };
  const mats = {
    body: toon(C.body),
    cream: toon(C.cream),
    claw: toon(C.claw),
    pad: toon(C.pad),
    lid: toon(C.lid),
    mouth: toon(C.mouth),
    tongue: toon(C.tongue),
    white: toon(C.white, { emissive: '#ffffff', emissiveIntensity: 0.25 }),
    pupil: toon(C.pupil),
  };
  const hi = G(new THREE.SphereGeometry(1, 32, 22));
  const mid = G(new THREE.SphereGeometry(1, 18, 12));
  const lo = G(new THREE.SphereGeometry(1, 10, 8));
  const blob = (parent, mat, [x, y, z], [sx, sy, sz], geo = mid, rot = null) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    m.scale.set(sx, sy, sz);
    if (rot) m.rotation.set(rot[0], rot[1], rot[2]);
    parent.add(m);
    return m;
  };

  const group = new THREE.Group();
  group.name = variant;
  const root = new THREE.Group(); // bounce / sleep pose
  group.add(root);
  const body = new THREE.Group(); // squash & stretch, wobble
  root.add(body);

  // ---- Body: pear-shaped lathe (wide hips, rounded head on top)
  const H = munch ? 2.05 : 2.4;
  const prof = munch
    ? [
        [0.0, 0.02],
        [0.62, 0.08],
        [0.9, 0.32],
        [0.98, 0.62],
        [0.92, 0.95],
        [0.88, 1.25],
        [0.84, 1.55],
        [0.66, 1.84],
        [0.32, 2.0],
        [0.0, 2.05],
      ]
    : [
        [0.0, 0.02],
        [0.66, 0.08],
        [0.94, 0.3],
        [1.02, 0.66],
        [0.98, 1.02],
        [0.86, 1.36],
        [0.8, 1.62],
        [0.74, 1.92],
        [0.54, 2.2],
        [0.24, 2.36],
        [0.0, 2.4],
      ];
  const curve = new THREE.CatmullRomCurve3(prof.map(([r, y]) => v3(r, y, 0)));
  const lathePts = curve.getPoints(40).map((p) => new THREE.Vector2(Math.max(0.0001, p.x), p.y));
  const torsoGeo = G(new THREE.LatheGeometry(lathePts, 44));
  const torso = new THREE.Mesh(torsoGeo, mats.body);
  torso.scale.set(1, 1, 0.92);
  body.add(torso);
  const rAt = (y) => {
    // radius of the lathe at height y (for placing patches on the surface)
    for (let i = 1; i < lathePts.length; i++) {
      const a = lathePts[i - 1];
      const b = lathePts[i];
      if (y >= a.y && y <= b.y) return a.x + ((b.x - a.x) * (y - a.y)) / Math.max(1e-6, b.y - a.y);
    }
    return 0;
  };
  const front = (y) => rAt(y) * 0.92; // z of the front surface at height y

  // ---- Cream belly and face patches (ellipsoids poking out of the front)
  const belly = blob(body, mats.cream, [0, munch ? 0.7 : 0.78, munch ? 0.22 : 0.26], munch ? [0.74, 0.6, 0.74] : [0.82, 0.68, 0.78], hi);
  const bellyBase = belly.scale.clone();
  const faceY = munch ? 1.5 : 1.72;
  const face = blob(body, mats.cream, [0, faceY, front(faceY) - (munch ? 0.36 : 0.38)], munch ? [0.6, 0.42, 0.44] : [0.66, 0.46, 0.46], hi);
  const faceFront = face.position.z + face.scale.z; // z of the face surface in the middle

  // ---- Ears: small pointed triangles on top of the head
  const earGeo = G(new THREE.ConeGeometry(munch ? 0.2 : 0.17, munch ? 0.46 : 0.34, 10, 1));
  earGeo.translate(0, (munch ? 0.46 : 0.34) / 2, 0);
  const ears = [];
  for (const s of [-1, 1]) {
    const pivot = new THREE.Group();
    const ey = munch ? 1.86 : 2.15;
    pivot.position.set(s * (munch ? 0.42 : 0.44), ey, 0.02);
    pivot.rotation.z = -s * (munch ? 0.32 : 0.42);
    body.add(pivot);
    const ear = new THREE.Mesh(earGeo, mats.body);
    ear.scale.set(1, 1, 0.7);
    pivot.add(ear);
    ears.push(pivot);
  }

  // ---- Eyes: closed sleepy lids (Snorlax) that swap to big open eyes when eating
  const eyeY = faceY + (munch ? 0.12 : 0.13);
  const eyeX = munch ? 0.22 : 0.24;
  const eyeZ = (x) => face.position.z + face.scale.z * Math.sqrt(Math.max(0, 1 - (x / face.scale.x) ** 2 - ((eyeY - faceY) / face.scale.y) ** 2));
  const lids = [];
  const eyes = [];
  for (const s of [-1, 1]) {
    const x0 = s * eyeX;
    const z0 = eyeZ(x0) + 0.005;
    const lid = new THREE.Mesh(
      G(sweep([v3(x0 - 0.12, eyeY + 0.01, z0 - 0.02), v3(x0 - 0.05, eyeY - 0.022, z0 + 0.005), v3(x0 + 0.05, eyeY - 0.022, z0 + 0.005), v3(x0 + 0.12, eyeY + 0.01, z0 - 0.02)], (t) => 0.018 + 0.006 * Math.sin(Math.PI * t), { segs: 10, radial: 5 })),
      mats.lid
    );
    body.add(lid);
    lids.push(lid);
    const eye = new THREE.Group();
    eye.position.set(x0, eyeY, z0 - 0.03);
    eye.lookAt(x0 * 3, eyeY + 0.1, z0 + 2);
    body.add(eye);
    const er = munch ? 0.075 : 0.1;
    blob(eye, mats.white, [0, 0, 0], [er, er * 1.15, er * 0.55], lo);
    blob(eye, mats.pupil, [0, -er * 0.12, er * 0.42], [er * 0.6, er * 0.72, er * 0.25], lo);
    blob(eye, mats.white, [s * er * 0.22, er * 0.28, er * 0.62], [er * 0.22, er * 0.22, er * 0.1], lo);
    eyes.push(eye);
  }

  // ---- Mouth: a smile line when closed; a cavity with tongue and two little fangs when open
  const mouthY = faceY - (munch ? 0.13 : 0.16);
  const mouthZ = face.position.z + face.scale.z * Math.sqrt(Math.max(0, 1 - ((mouthY - faceY) / face.scale.y) ** 2));
  const mouthGroup = new THREE.Group();
  mouthGroup.position.set(0, mouthY, mouthZ - 0.06);
  body.add(mouthGroup);
  const smile = new THREE.Mesh(
    G(sweep([v3(-0.26, 0.05, 0.02), v3(-0.13, -0.01, 0.06), v3(0.13, -0.01, 0.06), v3(0.26, 0.05, 0.02)], 0.016, { segs: 10, radial: 5 })),
    mats.lid
  );
  mouthGroup.add(smile);
  const cavity = blob(mouthGroup, mats.mouth, [0, -0.02, 0.04], [0.24, 0.02, 0.1], mid);
  const tongue = blob(mouthGroup, mats.tongue, [0, -0.06, 0.08], [0.14, 0.045, 0.06], lo);
  const jaw = new THREE.Group(); // lower lip with the fangs
  mouthGroup.add(jaw);
  const fangGeo = G(new THREE.ConeGeometry(0.035, munch ? 0.07 : 0.09, 6));
  const fangs = [];
  for (const s of [-1, 1]) {
    const f = new THREE.Mesh(fangGeo, mats.claw);
    f.position.set(s * 0.13, 0.02, 0.06);
    jaw.add(f);
    fangs.push(f);
  }
  const mouth = new THREE.Object3D(); // world target for swallowed things
  mouth.position.set(0, -0.04, 0.12);
  mouthGroup.add(mouth);

  // ---- Arms: stubby, swinging, with three cream claws
  const clawGeo = G(sweep([v3(0, 0, 0), v3(0, -0.03, 0.06), v3(0, -0.08, 0.1)], (t) => 0.042 * (1 - t) + 0.006, { segs: 5, radial: 6 }));
  const arms = [];
  for (const s of [-1, 1]) {
    const shoulder = new THREE.Group();
    shoulder.position.set(s * (munch ? 0.8 : 0.86), munch ? 1.12 : 1.32, 0.08);
    body.add(shoulder);
    blob(shoulder, mats.body, [s * 0.12, -0.24, 0.06], munch ? [0.22, 0.34, 0.24] : [0.27, 0.42, 0.29], mid, [0.25, 0, s * 0.55]);
    const hand = new THREE.Group();
    hand.position.set(s * 0.3, munch ? -0.5 : -0.6, 0.16);
    shoulder.add(hand);
    for (const k of [-1, 0, 1]) {
      const c = new THREE.Mesh(clawGeo, mats.claw);
      c.position.set(k * 0.07, 0.02, 0.06 + (k === 0 ? 0.02 : 0));
      c.rotation.y = k * 0.25;
      hand.add(c);
    }
    arms.push(shoulder);
  }

  // ---- Feet: short legs with big cream soles, a brown pad and three claws
  const feet = [];
  for (const s of [-1, 1]) {
    const foot = new THREE.Group();
    foot.position.set(s * (munch ? 0.46 : 0.52), 0.2, munch ? 0.42 : 0.5);
    root.add(foot);
    blob(foot, mats.body, [0, 0.02, -0.08], munch ? [0.26, 0.22, 0.32] : [0.32, 0.24, 0.38], mid);
    const sole = new THREE.Group();
    sole.position.set(0, 0.04, munch ? 0.2 : 0.26);
    sole.rotation.x = -0.25;
    foot.add(sole);
    blob(sole, mats.cream, [0, 0, 0], munch ? [0.24, 0.24, 0.07] : [0.29, 0.28, 0.08], mid);
    blob(sole, mats.pad, [0, -0.03, 0.06], munch ? [0.13, 0.12, 0.03] : [0.16, 0.14, 0.035], lo);
    for (const k of [-1, 0, 1]) {
      const c = new THREE.Mesh(clawGeo, mats.claw);
      c.position.set(k * 0.1, munch ? 0.17 : 0.2, 0.02);
      c.rotation.x = -1.2;
      c.scale.setScalar(0.8);
      sole.add(c);
    }
    feet.push(foot);
  }

  // ---- Animation state
  const st = { t: 0, phase: 0, move: 0, chomp: 0, chompN: 0, eyeOpen: munch ? 1 : 0, jig: 0, jigV: 0, wob: 0, wobV: 0, hop: 0, hopV: 0, sleep: 0, earLag: 0 };
  const ease = (cur, target, rate, dt) => cur + (target - cur) * (1 - Math.exp(-rate * dt));

  /** A bite: mouth snaps open and chews, eyes go wide, ears flick, belly jiggles. */
  function chomp(big = 0) {
    st.chomp = 0.42;
    st.chompN += 1;
    st.jigV += 2.2 + big * 3;
    st.earLag += 0.5;
  }
  /** Belly bounce (level up). */
  function bounce(k = 1) {
    st.jigV += 6 * k;
    st.hopV += 3.2 * k;
  }
  /** Soft wobble when bumping into something too big. */
  function wobble() {
    st.wobV += 5;
    st.jigV += 2;
  }

  function update(dt = 1 / 60, { moving = 0, sleeping = false } = {}) {
    dt = Math.min(Math.max(dt, 0), 0.1);
    st.t += dt;
    const t = st.t;
    st.move = ease(st.move, sleeping ? 0 : moving, 8, dt);
    st.sleep = ease(st.sleep, sleeping ? 1 : 0, 2.5, dt);
    const mv = st.move;
    st.phase = (st.phase + dt * (3 + mv * 7)) % TAU;
    const ph = st.phase;

    // Springs: belly jiggle, bump wobble, hop
    st.jigV += (-st.jig * 140 - st.jigV * 7) * dt;
    st.jig += st.jigV * dt;
    st.wobV += (-st.wob * 90 - st.wobV * 5) * dt;
    st.wob += st.wobV * dt;
    st.hopV -= 18 * dt;
    st.hop = Math.max(0, st.hop + st.hopV * dt);
    if (st.hop === 0 && st.hopV < 0) st.hopV = 0;

    // Walk: bouncy squash & stretch, waddle roll, breathing
    const step = Math.abs(Math.sin(ph));
    const breathe = Math.sin(t * (sleeping ? 1.2 : 2)) * (0.015 + st.sleep * 0.03);
    const squash = mv * 0.07 * Math.cos(ph * 2) + breathe - st.jig * 0.5;
    body.scale.set(1 - squash * 0.6 + st.jig * 0.3, 1 + squash, 1 - squash * 0.6 + st.jig * 0.3);
    root.position.y = step * 0.14 * mv + st.hop;
    root.rotation.z = Math.sin(ph) * 0.09 * mv + st.wob * 0.12;
    root.rotation.x = -st.sleep * 0.32 + mv * 0.06 + st.wob * 0.05;
    root.position.z = -st.sleep * 0.15;
    belly.scale.set(bellyBase.x * (1 + st.jig * 0.6 + st.sleep * 0.08 + breathe * 2), bellyBase.y * (1 + st.jig * 0.35 + st.sleep * 0.05), bellyBase.z * (1 + st.jig * 0.9 + st.sleep * 0.12 + breathe * 3));

    // Feet: alternate steps (legs out front when sleeping)
    feet.forEach((f, i) => {
      const s = i === 0 ? 1 : -1;
      const lift = Math.max(0, Math.sin(ph + (i ? Math.PI : 0))) * mv;
      f.position.y = 0.2 + lift * 0.2;
      f.position.z = (munch ? 0.42 : 0.5) + Math.sin(ph + (i ? Math.PI : 0)) * 0.12 * mv + st.sleep * 0.3;
      f.rotation.x = -lift * 0.5 + st.sleep * 0.15;
      f.rotation.z = s * st.sleep * 0.25;
    });

    // Chomp: mouth open → chew chew, eyes wide while eating
    st.chomp = Math.max(0, st.chomp - dt);
    const c = st.chomp > 0 ? st.chomp / 0.42 : 0;
    const open = st.chomp > 0 ? Math.sin(Math.PI * c) * (0.6 + 0.4 * Math.abs(Math.sin(c * 9))) : st.sleep * (0.18 + 0.06 * Math.sin(t * 1.2));
    cavity.scale.set(0.24 + open * 0.05, 0.02 + open * 0.17, 0.08);
    cavity.position.y = -0.02 - open * 0.08;
    tongue.visible = open > 0.15;
    tongue.position.y = -0.04 - open * 0.14;
    jaw.position.y = -open * 0.2;
    smile.visible = open < 0.1;
    const wantEyes = munch ? 1 : st.chomp > 0 || st.chompN > 0 ? 1 : 0;
    if (st.chomp === 0) st.chompN = Math.max(0, st.chompN - dt * 2.5); // stays wide-eyed between quick bites
    st.eyeOpen = ease(st.eyeOpen, sleeping ? 0 : wantEyes, wantEyes ? 18 : 4, dt);
    const blink = munch && Math.sin(t * 0.9) > 0.985 ? 0.1 : 1;
    eyes.forEach((e) => e.scale.set(st.eyeOpen, st.eyeOpen * blink * (1 + st.eyeOpen * 0.15), st.eyeOpen));
    lids.forEach((l) => (l.visible = st.eyeOpen < 0.5));

    // Arms swing while walking, lift to the mouth on a bite, rest on the belly asleep
    arms.forEach((a, i) => {
      const s = i === 0 ? -1 : 1;
      a.rotation.x = Math.sin(ph + (i ? 0 : Math.PI)) * 0.45 * mv - c * 0.9 - st.sleep * 0.9;
      a.rotation.z = s * (0.1 + c * 0.25 - st.sleep * 0.8) + Math.sin(t * 2 + i) * 0.03;
    });

    // Ears: lag behind the bounce and flick on a bite
    st.earLag = ease(st.earLag, 0, 5, dt);
    ears.forEach((e, i) => {
      const s = i === 0 ? -1 : 1;
      e.rotation.z = s * (munch ? 0.32 : 0.42) + s * (Math.sin(ph * 2 + 0.6) * 0.08 * mv + Math.sin(t * 30) * st.earLag * 0.25 - st.jig * 0.4);
      e.rotation.x = -Math.cos(ph * 2) * 0.06 * mv;
    });
  }

  function dispose() {
    group.traverse((o) => {
      if (o.geometry) disposables.add(o.geometry);
      if (o.material) disposables.add(o.material);
    });
    for (const d of disposables) d.dispose?.();
    disposables.clear();
    group.removeFromParent();
  }

  update(0);
  return { group, mouth, height: H, faceFront, update, chomp, bounce, wobble, dispose, parts: { body, belly, face, ears, eyes, lids, arms, feet, cavity, fangs, torso } };
}
