import { describe, it, expect, vi } from 'vitest';
import * as THREE from 'three';
import { createRacerModel, RACER_SPECIES } from './racers';

const STATES = ['idle', 'run', 'air', 'dive', 'stun', 'celebrate', 'out'];

describe('obby3d racer models', () => {
  it('OBY-M01 builds all eight Pokémon and the generic racer within the triangle budget', () => {
    const counts = {};
    for (const species of [...RACER_SPECIES, 'generic']) {
      const m = createRacerModel({ species, type: 'Psychic' });
      expect(m.group).toBeInstanceOf(THREE.Group);
      expect(m.species).toBe(species);
      const n = m.triangles();
      counts[species] = n;
      expect(n).toBeGreaterThan(1200);
      expect(n).toBeLessThan(4500);
      // It stands on the ground and is about a metre tall
      const box = new THREE.Box3().setFromObject(m.group);
      expect(box.min.y).toBeGreaterThan(-0.08);
      expect(box.max.y).toBeGreaterThan(0.85);
      expect(box.max.y).toBeLessThan(1.6);
      m.dispose();
    }
    console.info('[obby3d] racer triangles', JSON.stringify(counts));
  });

  it('OBY-M02 every animation state moves the rig without NaNs; landings squash', () => {
    const m = createRacerModel({ species: 'pikachu' });
    const squash = m.group.children[0];
    const seen = new Set();
    for (const state of STATES) {
      for (let i = 0; i < 30; i++) m.update(1 / 60, { state, speed: 1, vy: state === 'air' ? (i < 15 ? 5 : -5) : 0 });
      const lean = squash.children[0];
      seen.add(lean.rotation.x.toFixed(2));
      m.group.traverse((o) => {
        expect(Number.isFinite(o.rotation.x + o.rotation.z + o.position.y + o.scale.y)).toBe(true);
      });
    }
    expect(seen.size).toBeGreaterThan(3); // dive leans far forward, running a little
    m.update(1 / 60, { state: 'run', land: 1 });
    expect(squash.scale.y).toBeLessThan(0.85);
    m.dispose();
  });

  it('OBY-M03 shiny twins differ in colour; the generic racer takes its type colour', () => {
    const colors = (m) => {
      const set = new Set();
      m.group.traverse((o) => o.isMesh && set.add(o.material.color.getHexString()));
      return set;
    };
    const a = createRacerModel({ species: 'squirtle' });
    const b = createRacerModel({ species: 'squirtle', shiny: true });
    expect([...colors(b)].some((c) => !colors(a).has(c))).toBe(true);
    const g = createRacerModel({ species: 'generic', type: 'Fire' });
    expect(colors(g).has('f5894a')).toBe(true);
    for (const m of [a, b, g]) m.dispose();
  });

  it('OBY-M04 dispose frees every geometry and material', () => {
    const m = createRacerModel({ species: 'charmander' });
    const spies = [];
    m.group.traverse((o) => {
      if (!o.isMesh) return;
      if (o.geometry) spies.push(vi.spyOn(o.geometry, 'dispose'));
      if (o.material) spies.push(vi.spyOn(o.material, 'dispose'));
    });
    m.dispose();
    for (const s of spies) expect(s).toHaveBeenCalled();
  });
});
