import { describe, it, expect, vi } from 'vitest';
import * as THREE from 'three';
import { createSnorlax, SNORLAX_COLORS, MUNCHLAX_COLORS } from './snorlaxModel';
import { kindGeometry, VARIANTS, powerupGeometry, createChibi } from './gulp3dModels';
import { KINDS } from '../../../utils/three3d/gulp3d';

const triangles = (root) => {
  let n = 0;
  root.traverse((o) => {
    if (!o.isMesh) return;
    const g = o.geometry;
    n += (g.index ? g.index.count : g.attributes.position.count) / 3;
  });
  return n;
};
const colors = (root) => {
  const set = new Set();
  root.traverse((o) => o.isMesh && set.add(`#${o.material.color.getHexString()}`));
  return set;
};

describe('createSnorlax', () => {
  it('GULP-M01 builds a real 3D Snorlax: teal body, cream belly and face, ears, eyes, fangs, claws, feet; < 15k triangles', () => {
    const z = createSnorlax();
    expect(z.group).toBeInstanceOf(THREE.Group);
    const c = colors(z.group);
    expect(c.has(SNORLAX_COLORS.body)).toBe(true);
    expect(c.has(SNORLAX_COLORS.cream)).toBe(true);
    expect(c.has(SNORLAX_COLORS.pad)).toBe(true);
    expect(z.parts.ears).toHaveLength(2);
    expect(z.parts.eyes).toHaveLength(2);
    expect(z.parts.fangs).toHaveLength(2);
    expect(z.parts.arms).toHaveLength(2);
    expect(z.parts.feet).toHaveLength(2);
    expect(z.parts.torso.material).toBeInstanceOf(THREE.MeshToonMaterial);
    const tris = triangles(z.group);
    console.info(`[gulp3d] Snorlax triangles: ${tris}`);
    expect(tris).toBeLessThan(15000);
    z.dispose();
  });

  it('GULP-M02 sleepy eyes open wide and the mouth opens on a chomp; walking squashes and stretches', () => {
    const z = createSnorlax();
    z.update(1 / 60, {});
    expect(z.parts.lids[0].visible).toBe(true);
    expect(z.parts.eyes[0].scale.x).toBeLessThan(0.1);
    z.chomp(1);
    for (let i = 0; i < 8; i++) z.update(1 / 60, {});
    expect(z.parts.eyes[0].scale.x).toBeGreaterThan(0.6);
    expect(z.parts.cavity.scale.y).toBeGreaterThan(0.08);
    for (let i = 0; i < 120; i++) z.update(1 / 60, {});
    expect(z.parts.cavity.scale.y).toBeLessThan(0.05);
    const heights = new Set();
    for (let i = 0; i < 60; i++) {
      z.update(1 / 60, { moving: 1 });
      heights.add(z.parts.body.scale.y.toFixed(3));
    }
    expect(heights.size).toBeGreaterThan(10);
    z.bounce(1);
    z.wobble();
    for (let i = 0; i < 30; i++) z.update(1 / 60, { sleeping: i > 10 });
    expect(Number.isFinite(z.parts.belly.scale.x)).toBe(true);
    z.dispose();
  });

  it('GULP-M03 Munchlax variant is smaller-headed, darker and always wide-eyed; dispose frees everything', () => {
    const m = createSnorlax({ variant: 'munchlax' });
    expect(colors(m.group).has(MUNCHLAX_COLORS.body)).toBe(true);
    m.update(1 / 60, {});
    expect(m.parts.eyes[0].scale.x).toBeGreaterThan(0.5);
    const spies = [];
    m.group.traverse((o) => {
      if (o.geometry) spies.push(vi.spyOn(o.geometry, 'dispose'));
      if (o.material) spies.push(vi.spyOn(o.material, 'dispose'));
    });
    m.dispose();
    for (const s of spies) expect(s).toHaveBeenCalled();
  });

  it('GULP-M04 every town kind, powerup and chibi Pokemon builds as low-poly geometry', () => {
    let total = 0;
    for (const k of Object.keys(KINDS)) {
      for (let v = 0; v < (VARIANTS[k] || 1); v++) {
        const g = kindGeometry(k, v);
        expect(g.attributes.color.count).toBe(g.attributes.position.count);
        total += g.attributes.position.count / 3;
        g.dispose();
      }
    }
    expect(total).toBeLessThan(40000);
    for (const t of ['gold', 'speed', 'magnet']) powerupGeometry(t).dispose();
    const cache = { geos: {}, mats: {}, ramp: null };
    for (const sp of ['rattata', 'pidgey', 'wurmple']) expect(triangles(createChibi(sp, cache).group)).toBeLessThan(4000);
  });
});
