import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { sounds } from '../../utils/soundEffects';

const scene = vi.hoisted(() => ({ fail: false, created: 0, disposed: 0, updates: 0, fx: [], hit: { pokemon: true, bush: -1 }, pickCalls: 0 }));
vi.mock('./PlaygroundScene', () => ({
  createPlaygroundScene: vi.fn(() => {
    if (scene.fail) throw new Error('no WebGL');
    scene.created += 1;
    return {
      canvas: document.createElement('canvas'),
      ready: Promise.resolve(),
      resize: () => {},
      update: () => {
        scene.updates += 1;
      },
      fx: (type) => scene.fx.push(type),
      pick: () => {
        scene.pickCalls += 1;
        return typeof scene.hit === 'function' ? scene.hit() : scene.hit;
      },
      anchors: () => ({ head: { x: 0.5, y: 0.3 }, feet: { x: 0.5, y: 0.8 }, visible: true }),
      capture: () => 'data:image/png;base64,SNAP',
      stats: () => ({ calls: 20, pixelRatio: 1, frameMs: 16 }),
      dispose: () => {
        scene.disposed += 1;
      },
    };
  }),
}));
vi.mock('./photoFrame', () => ({ composePhoto: async (shot) => `${shot}-framed` }));
vi.mock('../../utils/cries', () => ({ playCry: vi.fn(() => Promise.resolve('real')) }));

const { Playground3D } = await import('./Playground3D');
const { playCry } = await import('../../utils/cries');

const POKE = { id: 'lapras', name: 'Lapras', pokedexNumber: '131', types: ['Water'] };
const CARE = { enabled: true, berries: { oran: 3, razz: 2 } };

beforeEach(() => {
  Object.assign(scene, { fail: false, created: 0, disposed: 0, updates: 0, fx: [], hit: { pokemon: true, bush: -1 }, pickCalls: 0 });
  vi.useFakeTimers();
  for (const s of ['playPop', 'playWhoosh', 'playCoin', 'playSuccessFanfare', 'playOops', 'playNote', 'playScanBeep', 'playEnergySurge', 'playMunch', 'playJump']) vi.spyOn(sounds, s).mockImplementation(() => {});
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({ left: 0, top: 0, right: 300, bottom: 340, width: 300, height: 340, x: 0, y: 0, toJSON: () => ({}) });
  playCry.mockClear();
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

async function advance(ms, step = 50) {
  for (let t = 0; t < ms; t += step) {
    await act(async () => {
      await vi.advanceTimersByTimeAsync(step);
    });
  }
}
const root = () => screen.getByTestId('pg3d-root');
const stage = () => screen.getByTestId('pg3d-stage');
const phase = () => root().dataset.phase;
const tap = (x = 150, y = 200) => {
  fireEvent.pointerDown(stage(), { clientX: x, clientY: y, pointerId: 1 });
  fireEvent.pointerUp(stage(), { clientX: x, clientY: y, pointerId: 1 });
};
async function rub(times = 40) {
  fireEvent.pointerDown(stage(), { clientX: 100, clientY: 200, pointerId: 1 });
  for (let i = 0; i < times; i++) {
    fireEvent.pointerMove(stage(), { clientX: i % 2 ? 200 : 100, clientY: 200, pointerId: 1 });
    if (i % 5 === 0) await advance(50);
  }
  fireEvent.pointerUp(stage(), { clientX: 100, clientY: 200, pointerId: 1 });
}
async function untilPhase(p, ms = 40000, step = 100) {
  for (let t = 0; t < ms && phase() !== p; t += step) await advance(step, step);
  expect(phase()).toBe(p);
}
function setup(props = {}) {
  const handlers = {
    onTapPokemon: vi.fn(),
    onPetReward: vi.fn(() => ({ gain: 1, levelUp: null })),
    onFeedBerry: vi.fn(() => ({ result: 'fed', gain: 10, favorite: false })),
    onAte: vi.fn(),
    onFail: vi.fn(),
  };
  const utils = render(<Playground3D pokemon={POKE} image="lapras.png" care={CARE} revealKind="open" {...handlers} {...props} />);
  return { ...handlers, ...utils };
}
async function ready(kind = 'open') {
  await advance(100);
  if (kind !== 'none') await untilPhase('idle', 8000);
}

describe('Playground3D', () => {
  it('PG-UI-01 after a scan: full screen Poké Ball reveal, a tap skips it (cry, hello), then the playground', async () => {
    setup({ revealKind: 'scan' });
    await advance(100);
    expect(scene.created).toBe(1);
    expect(phase()).toBe('reveal');
    expect(screen.getByRole('dialog', { name: 'Sân chơi 3D của Lapras' })).toBeInTheDocument();
    expect(screen.getByText(/Chạm để bỏ qua/)).toBeInTheDocument();
    await advance(1200);
    expect(sounds.playPop).toHaveBeenCalled(); // the ball bounced
    tap();
    expect(phase()).toBe('idle');
    expect(playCry).toHaveBeenCalledTimes(1);
    expect(scene.fx).toContain('burst');
    expect(screen.getByText('Chào bé! Mình là Lapras! 👋')).toBeInTheDocument();
    // all 8 activities are offered
    for (const id of ['pet', 'feed', 'throw', 'dance', 'hide', 'bath', 'sleep', 'photo']) expect(screen.getByTestId(`pg3d-act-${id}`)).toBeInTheDocument();
    // shrink back into the page
    fireEvent.click(screen.getByLabelText('Thu nhỏ sân chơi'));
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('PG-UI-02 the full reveal plays by itself: 3 wobbles, burst, cry, done', async () => {
    setup({ revealKind: 'scan' });
    await advance(100);
    await untilPhase('idle', 8000);
    expect(sounds.playNote.mock.calls.filter(([, o]) => o?.duration === 0.22)).toHaveLength(3);
    expect(sounds.playEnergySurge).toHaveBeenCalledTimes(1);
    expect(playCry).toHaveBeenCalledTimes(1);
  });

  it('PG-UI-03 opening a card: short reveal inline; tapping the Pokémon pets it (hop + hearts)', async () => {
    const h = setup();
    await advance(100);
    expect(screen.queryByRole('dialog')).toBeNull();
    await ready();
    tap();
    expect(h.onTapPokemon).toHaveBeenCalledTimes(1);
    expect(scene.fx).toEqual(expect.arrayContaining(['hop', 'hearts']));
    scene.hit = { pokemon: false, bush: -1 };
    tap();
    expect(h.onTapPokemon).toHaveBeenCalledTimes(1);
  });

  it('PG-UI-04 Vuốt ve: rubbing fills the meter, 3 stars, one onPet reward, back to idle', async () => {
    const h = setup();
    await ready();
    fireEvent.click(screen.getByTestId('pg3d-act-pet'));
    expect(root().dataset.activity).toBe('pet');
    expect(screen.getByTestId('pg3d-hud')).toHaveTextContent('Xoa nhẹ lên Lapras');
    await rub(60);
    await advance(200);
    const res = screen.getByTestId('pg3d-result');
    expect(res.dataset.stars).toBe('3');
    expect(res).toHaveTextContent('+1 ❤️ thân thiết');
    expect(h.onPetReward).toHaveBeenCalledTimes(1);
    expect(sounds.playNote).toHaveBeenCalled(); // purr notes
    await advance(2800);
    expect(phase()).toBe('idle');
  });

  it('PG-UI-05 rubbing off the Pokémon does nothing', async () => {
    const h = setup();
    await ready();
    scene.hit = { pokemon: false, bush: -1 };
    fireEvent.click(screen.getByTestId('pg3d-act-pet'));
    await rub(60);
    expect(screen.queryByTestId('pg3d-result')).toBeNull();
    expect(h.onPetReward).not.toHaveBeenCalled();
  });

  it('PG-UI-06 Cho ăn: a berry dropped on the Pokémon → onFeed, munch ×3, onAte, +10 ❤️ (no extra onPet)', async () => {
    const h = setup();
    await ready();
    fireEvent.click(screen.getByTestId('pg3d-act-feed'));
    fireEvent.click(screen.getByLabelText('Kéo quả Oran cho Lapras ăn (còn 3)'));
    expect(h.onFeedBerry).toHaveBeenCalledWith('oran');
    await advance(1800);
    expect(sounds.playMunch).toHaveBeenCalledTimes(3);
    expect(h.onAte).toHaveBeenCalledWith({ result: 'fed', gain: 10, favorite: false });
    expect(screen.getByTestId('pg3d-result')).toHaveTextContent('+10 ❤️');
    expect(h.onPetReward).not.toHaveBeenCalled();
    expect(scene.fx).toContain('crumbs');
  });

  it('PG-UI-07 Cho ăn: full tummy → friendly message, nothing eaten; empty bag and no care are handled', async () => {
    const h = setup({ onFeedBerry: vi.fn(() => ({ result: 'full' })), care: { enabled: true, berries: { oran: 1, razz: 0 } } });
    await ready();
    fireEvent.click(screen.getByTestId('pg3d-act-feed'));
    fireEvent.click(screen.getByLabelText('Kéo quả Oran cho Lapras ăn (còn 1)'));
    expect(screen.getByText('Lapras no căng bụng rồi! 😊')).toBeInTheDocument();
    await advance(2000);
    expect(h.onAte).not.toHaveBeenCalled();
    expect(screen.queryByTestId('pg3d-result')).toBeNull();
    fireEvent.click(screen.getByLabelText('Kéo quả Razz cho Lapras ăn (còn 0)'));
    expect(screen.getByText(/Hết quả này rồi/)).toBeInTheDocument();
  });

  it('PG-UI-08 Cho ăn needs a scanned card', async () => {
    const h = setup({ care: { enabled: false } });
    await ready();
    fireEvent.click(screen.getByTestId('pg3d-act-feed'));
    expect(screen.getByText('Quét thẻ Lapras để cho bạn ấy ăn nhé!')).toBeInTheDocument();
    expect(root().dataset.activity).toBe('');
    expect(h.onFeedBerry).not.toHaveBeenCalled();
  });

  it('PG-UI-09 Ném bóng: swipe up / Ném! three times → fetch & bring back → 3 stars + onPet', async () => {
    const h = setup();
    await ready();
    fireEvent.click(screen.getByTestId('pg3d-act-throw'));
    sounds.playWhoosh.mockClear();
    // a real swipe first
    fireEvent.pointerDown(stage(), { clientX: 150, clientY: 320, pointerId: 1 });
    fireEvent.pointerMove(stage(), { clientX: 160, clientY: 150, pointerId: 1 });
    fireEvent.pointerUp(stage(), { clientX: 160, clientY: 120, pointerId: 1 });
    expect(sounds.playWhoosh).toHaveBeenCalledTimes(1);
    for (let i = 0; i < 2; i++) {
      for (let t = 0; t < 8000 && !screen.queryByText(/Lần \d\/3/)?.textContent.includes(`${i + 2}/3`); t += 200) await advance(200, 50);
      fireEvent.click(screen.getByLabelText('Ném bóng'));
    }
    for (let t = 0; t < 10000 && !screen.queryByTestId('pg3d-result'); t += 200) await advance(200, 50);
    expect(screen.getByTestId('pg3d-result').dataset.stars).toBe('3');
    expect(sounds.playCoin).toHaveBeenCalledTimes(3);
    expect(h.onPetReward).toHaveBeenCalledTimes(1);
  });

  it('PG-UI-10 Nhảy múa: music plays, taps on the beat score, always at least a star', async () => {
    const h = setup();
    await ready();
    fireEvent.click(screen.getByTestId('pg3d-act-dance'));
    const beat = 60 / 108;
    await advance(Math.round(beat * 2 * 1000) - 25, 25);
    for (let i = 0; i < 12; i++) {
      fireEvent.pointerDown(screen.getByLabelText('Nhún theo nhịp'));
      await advance(Math.round(beat * 1000), 25);
    }
    for (let t = 0; t < 8000 && !screen.queryByTestId('pg3d-result'); t += 100) await advance(100);
    const stars = Number(screen.getByTestId('pg3d-result').dataset.stars);
    expect(stars).toBeGreaterThanOrEqual(2);
    expect(sounds.playNote.mock.calls.length).toBeGreaterThanOrEqual(16);
    expect(h.onPetReward).toHaveBeenCalledTimes(1);
  });

  it('PG-UI-11 Trốn tìm: the Pokémon hides, bushes shuffle, wrong bush is gentle, found 3 rounds', async () => {
    const h = setup();
    await ready();
    fireEvent.click(screen.getByTestId('pg3d-act-hide'));
    playCry.mockClear();
    let n = 0;
    scene.hit = () => ({ pokemon: false, bush: n++ % 3 });
    for (let t = 0; t < 60000 && !screen.queryByTestId('pg3d-result'); t += 300) {
      await advance(300, 50);
      tap();
    }
    expect(screen.getByTestId('pg3d-result')).toBeInTheDocument();
    expect(playCry).toHaveBeenCalledTimes(3); // laughs when found
    expect(h.onPetReward).toHaveBeenCalledTimes(1);
  });

  it('PG-UI-12 Tắm: soap, rinse, sparkle clean → reward', async () => {
    const h = setup();
    await ready();
    fireEvent.click(screen.getByTestId('pg3d-act-bath'));
    await rub(20);
    await advance(300);
    expect(screen.getByTestId('pg3d-hud')).toHaveTextContent('xả nước');
    await rub(50);
    await advance(2000);
    expect(screen.getByTestId('pg3d-result').dataset.stars).toBe('3');
    expect(scene.fx).toEqual(expect.arrayContaining(['bubbles', 'sparkle']));
    expect(h.onPetReward).toHaveBeenCalledTimes(1);
  });

  it('PG-UI-13 Ngủ ngon: lullaby + Zzz, wake up early with Đánh thức, reward', async () => {
    const h = setup();
    await ready();
    fireEvent.click(screen.getByTestId('pg3d-act-sleep'));
    await advance(4000);
    expect(scene.fx).toEqual(expect.arrayContaining(['zzz', 'note']));
    fireEvent.click(screen.getByText('☀️ Đánh thức'));
    await advance(3000);
    expect(screen.getByTestId('pg3d-result')).toBeInTheDocument();
    expect(h.onPetReward).toHaveBeenCalledTimes(1);
  });

  it('PG-UI-14 Chụp ảnh: pick a frame, snap → framed photo with a PNG download link, no reward', async () => {
    const h = setup();
    await ready();
    fireEvent.click(screen.getByTestId('pg3d-act-photo'));
    fireEvent.click(screen.getByLabelText('Khung Trái tim'));
    expect(screen.getByLabelText('Khung Trái tim')).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(screen.getByLabelText('Chụp ảnh'));
    await advance(100);
    const link = screen.getByText('⬇️ Tải ảnh về');
    expect(link).toHaveAttribute('href', 'data:image/png;base64,SNAP-framed');
    expect(link.getAttribute('download')).toMatch(/^pokemon-lapras-\d{8}-\d{6}\.png$/);
    expect(sounds.playScanBeep).toHaveBeenCalled();
    fireEvent.click(screen.getByText('✕ Xong'));
    expect(phase()).toBe('idle');
    expect(h.onPetReward).not.toHaveBeenCalled();
  });

  it('PG-UI-15 no WebGL → onFail (the buddy shows 2D)', async () => {
    scene.fail = true;
    const h = setup();
    await advance(100);
    expect(h.onFail).toHaveBeenCalledTimes(1);
  });

  it('PG-UI-16 paused (a game is open) → no frames; unmount disposes the scene', async () => {
    const h = setup({ paused: true });
    await advance(500);
    expect(scene.updates).toBe(0);
    h.rerender(<Playground3D pokemon={POKE} image="lapras.png" care={CARE} revealKind="open" paused={false} />);
    await advance(300);
    expect(scene.updates).toBeGreaterThan(5);
    h.unmount();
    expect(scene.disposed).toBe(1);
  });
});
