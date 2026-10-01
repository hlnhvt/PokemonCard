import { describe, it, expect, vi } from 'vitest';
import * as THREE from 'three';
import { createCharizard } from './charizardModel';

const triangles = (root) => {
  let n = 0;
  root.traverse((o) => {
    if (!o.isMesh) return;
    const g = o.geometry;
    n += (g.index ? g.index.count : g.attributes.position.count) / 3;
  });
  return n;
};

describe('createCharizard', () => {
  it('builds a 3D Charizard with two wings, a tail flame and a saddle', () => {
    const z = createCharizard();
    expect(z.group).toBeInstanceOf(THREE.Group);
    expect(z.wings).toHaveLength(2);
    expect(z.tail.isSkinnedMesh).toBe(true);
    let flameLayers = 0;
    let glowing = 0;
    z.flame.traverse((o) => {
      if (o.isMesh) flameLayers += 1;
      if ((o.isMesh || o.isSprite) && o.material.blending === THREE.AdditiveBlending) glowing += 1;
    });
    expect(flameLayers).toBeGreaterThanOrEqual(3);
    expect(glowing).toBeGreaterThanOrEqual(2);
    expect(z.fx.isPoints).toBe(true);
    expect(z.saddle.parent).toBeTruthy();
    // Teal membrane under the wings, orange on top
    const colors = new Set();
    z.group.traverse((o) => o.isMesh && colors.add(o.material.color.getHexString()));
    expect(colors.has('2a8a8a')).toBe(true);
    expect(colors.has('f08030')).toBe(true);
    expect(triangles(z.group)).toBeLessThan(15000);
    z.dispose();
  });

  it('animates without throwing: flaps, glides, banks and boosts', () => {
    const parent = new THREE.Group();
    const z = createCharizard({ scale: 1.2 });
    parent.add(z.group);
    const root = z.wings[0].root;
    const angles = new Set();
    for (let i = 0; i < 120; i++) {
      parent.rotation.y += 0.01;
      z.update(1 / 60, { bank: Math.sin(i / 10), pitch: 0.3, speed: 40, boosting: i > 60 });
      angles.add(root.rotation.z.toFixed(2));
    }
    expect(angles.size).toBeGreaterThan(10); // the wings really flap
    z.update(1 / 60, { flap: 0, wingPhase: 0 });
    expect(Number.isFinite(z.group.children[0].children[0].rotation.z)).toBe(true);
    z.dispose();
  });

  it('disposes every geometry and material', () => {
    const z = createCharizard();
    const spies = [];
    z.group.traverse((o) => {
      if (o.geometry) spies.push(vi.spyOn(o.geometry, 'dispose'));
      if (o.material) spies.push(vi.spyOn(o.material, 'dispose'));
    });
    spies.push(vi.spyOn(z.fx.geometry, 'dispose'));
    z.dispose();
    for (const s of spies) expect(s).toHaveBeenCalled();
  });
});
