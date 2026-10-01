import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { sounds } from '../../utils/soundEffects';
import { setWebGLSupport } from '../../utils/playground3d/webgl';

const scene = vi.hoisted(() => ({ fail: false, fx: [] }));
vi.mock('./PlaygroundScene', () => ({
  createPlaygroundScene: vi.fn(() => {
    if (scene.fail) throw new Error('no WebGL');
    return {
      canvas: document.createElement('canvas'),
      ready: Promise.resolve(),
      resize: () => {},
      update: () => {},
      fx: (type) => scene.fx.push(type),
      pick: () => ({ pokemon: true, bush: -1 }),
      anchors: () => ({ head: { x: 0.5, y: 0.3 }, feet: { x: 0.5, y: 0.8 }, visible: true }),
      capture: () => null,
      stats: () => ({ calls: 1, pixelRatio: 1, frameMs: 16 }),
      dispose: () => {},
    };
  }),
}));
vi.mock('../../utils/cries', () => ({ playCry: vi.fn(() => Promise.resolve('real')) }));

const { PokemonBuddy } = await import('../PokemonBuddy');

const POKE = { id: 'lapras', name: 'Lapras', pokedexNumber: '131', types: ['Water'], fallbackImage: 'lapras.png' };
const careOn = { enabled: true, friendship: 30, fedToday: 0, favoriteFound: false, berries: { oran: 2, razz: 1 } };

beforeEach(() => {
  scene.fail = false;
  scene.fx = [];
  setWebGLSupport(true);
  for (const s of ['playPop', 'playWhoosh', 'playCoin', 'playSuccessFanfare', 'playNote', 'playScanBeep', 'playEnergySurge', 'playMunch', 'playJump']) vi.spyOn(sounds, s).mockImplementation(() => {});
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({ left: 0, top: 0, right: 300, bottom: 340, width: 300, height: 340, x: 0, y: 0, toJSON: () => ({}) });
});
afterEach(() => {
  setWebGLSupport(null);
  vi.restoreAllMocks();
});

const stage = () => screen.getByTestId('pg3d-stage');
const tap = () => {
  fireEvent.pointerDown(stage(), { clientX: 150, clientY: 200, pointerId: 1 });
  fireEvent.pointerUp(stage(), { clientX: 150, clientY: 200, pointerId: 1 });
};
async function openIdle() {
  await screen.findByTestId('pg3d-root');
  await waitFor(() => expect(screen.getByTestId('pg3d-root').dataset.phase).not.toBe('loading'));
  if (screen.getByTestId('pg3d-root').dataset.phase === 'reveal') tap(); // skip
  expect(screen.getByTestId('pg3d-root').dataset.phase).toBe('idle');
}

describe('PokemonBuddy with the 3D playground', () => {
  it('BUD-3D-01 WebGL → 3D playground replaces the 2D picture; a tap pets through onPet', async () => {
    const onPet = vi.fn(() => ({ gain: 1, levelUp: null }));
    render(<PokemonBuddy pokemon={POKE} care={careOn} onPet={onPet} onFeed={vi.fn()} />);
    expect(screen.getByText('Đang mở sân chơi 3D…')).toBeInTheDocument();
    await openIdle();
    expect(screen.queryByLabelText('Chạm vào Lapras')).toBeNull();
    tap();
    expect(onPet).toHaveBeenCalledTimes(1);
    // care panel, cries and gifts stay below
    expect(screen.getByLabelText('Chăm sóc Pokémon')).toBeInTheDocument();
    expect(screen.getByText('Nghe tiếng kêu')).toBeInTheDocument();
  });

  it('BUD-3D-02 3D feeding goes through onFeed and shows the gain', async () => {
    const onFeed = vi.fn(() => ({ result: 'fed', gain: 10, favorite: false, levelUp: null }));
    render(<PokemonBuddy pokemon={POKE} care={careOn} onPet={vi.fn()} onFeed={onFeed} />);
    await openIdle();
    fireEvent.click(screen.getByTestId('pg3d-act-feed'));
    fireEvent.click(screen.getByLabelText('Kéo quả Oran cho Lapras ăn (còn 2)'));
    expect(onFeed).toHaveBeenCalledWith('oran');
    expect(await screen.findByText('+10', {}, { timeout: 4000 })).toBeInTheDocument();
  });

  it('BUD-3D-03 the care panel berry buttons still feed and the 3D Pokémon eats', async () => {
    const onFeed = vi.fn(() => ({ result: 'fed', gain: 10, favorite: false, levelUp: null }));
    render(<PokemonBuddy pokemon={POKE} care={careOn} onPet={vi.fn()} onFeed={onFeed} />);
    await openIdle();
    fireEvent.click(screen.getByLabelText('Cho ăn quả Oran (còn 2)'));
    expect(onFeed).toHaveBeenCalledWith('oran');
    await waitFor(() => expect(scene.fx).toContain('crumbs'));
  });

  it('BUD-3D-04 the scene cannot start → back to the 2D buddy', async () => {
    scene.fail = true;
    const onPet = vi.fn(() => ({ gain: 1 }));
    render(<PokemonBuddy pokemon={POKE} care={careOn} onPet={onPet} onFeed={vi.fn()} />);
    const btn = await screen.findByLabelText('Chạm vào Lapras');
    fireEvent.click(btn);
    expect(onPet).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId('pg3d-root')).toBeNull();
  });

  it('BUD-3D-05 no WebGL at all → 2D buddy straight away (no 3D download)', () => {
    setWebGLSupport(false);
    render(<PokemonBuddy pokemon={POKE} care={careOn} onPet={vi.fn()} onFeed={vi.fn()} />);
    expect(screen.getByLabelText('Chạm vào Lapras')).toBeInTheDocument();
    expect(screen.queryByText('Đang mở sân chơi 3D…')).toBeNull();
  });
});
