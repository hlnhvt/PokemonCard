import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act, within } from '@testing-library/react';
import { TrainerQuestGame } from './TrainerQuestGame';
import { BoardPanel } from './QuestPanels';
import { sounds } from '../../utils/soundEffects';
import { SAVE_KEY } from '../../utils/quest/save';
import { questMember } from '../../utils/quest/engine';
import { speciesByName } from '../../utils/quest/species';
import { seeded } from '../../test/seeded';
import { fallbackMoves } from '../../utils/battle/moves';
import { generateArea } from '../../utils/quest/world';

// No network in tests: the evolution chains come from the built-in table, battle data is made up
vi.mock('../../services/pokemonOnlineService', async (importOriginal) => ({
  ...(await importOriginal()),
  fetchEvolutionChain: vi.fn(async () => []),
}));
const mocks = vi.hoisted(() => ({ fetchBattlePokemon: vi.fn() }));
vi.mock('../../services/battleData', async (importOriginal) => ({ ...(await importOriginal()), fetchBattlePokemon: mocks.fetchBattlePokemon }));
function battleData(query) {
  const q = Array.isArray(query) ? query.find((x) => typeof x === 'string') || query[0] : query;
  const name = String(q).toLowerCase();
  const types = ['normal'];
  return Promise.resolve({ key: name, name: name.charAt(0).toUpperCase() + name.slice(1), id: 1, types, stats: { hp: 50, attack: 50, defense: 50, spAttack: 50, spDefense: 50, speed: 50 }, moves: fallbackMoves(types), image: `${name}.png` });
}

const card = (id, name, num, types) => ({ id, name, speciesName: id, pokedexNumber: String(num), types, fallbackImage: `${id}.png`, baseHp: 45, attack: 50, defense: 45, speed: 60 });
const COLLECTION = [card('charmander', 'Charmander', 4, ['Fire']), card('bulbasaur', 'Bulbasaur', 1, ['Grass', 'Poison']), card('squirtle', 'Squirtle', 7, ['Water'])];

beforeEach(() => {
  vi.useFakeTimers();
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
  mocks.fetchBattlePokemon.mockReset();
  mocks.fetchBattlePokemon.mockImplementation(battleData);
  for (const s of ['playPop', 'playWhoosh', 'playCoin', 'playSuccessFanfare', 'playEnergySurge', 'playNote', 'playScanBeep', 'playOops', 'playMunch']) vi.spyOn(sounds, s).mockImplementation(() => {});
});
afterEach(() => vi.useRealTimers());

async function advance(ms, stepMs = 100) {
  for (let t = 0; t < ms; t += stepMs) {
    await act(async () => {
      await vi.advanceTimersByTimeAsync(stepMs);
    });
  }
}
async function hold(code, ms) {
  fireEvent.keyDown(window, { code });
  await advance(ms, 50);
  fireEvent.keyUp(window, { code });
}

/** A saved journey (as the game writes it) to start somewhere precise. */
function presave({ act: a = 0, area = 0, level = 5, names = ['Charmander', 'Bulbasaur', 'Squirtle', 'Pikachu', 'Eevee'], inventory = { berry: 3, potion: 2, revive: 1 }, gold = 0, pos = null } = {}) {
  const party = names.map((n, i) => {
    const sp = speciesByName(n);
    return { ...questMember({ key: `m${i}`, name: sp.name, dex: sp.dex, types: sp.types, power: sp.bst, image: `${sp.dex}.png` }, i), level };
  });
  localStorage.setItem(SAVE_KEY, JSON.stringify({ v: 1, seed: 4242, act: a, area, lead: 0, unlocked: a, beaten: [], gold, inventory, charms: {}, reward: { earned: 0, paid: 0, playSeconds: 0 }, party, pos }));
}
const world = () => screen.getByTestId('quest-world');
const member = (i) => screen.getByTestId(`quest-member-${i}`);

describe('TrainerQuestGame', () => {
  it('QUI-01 new journey: build the team of 5, enter Làng Pallet, walk with the keyboard', async () => {
    render(<TrainerQuestGame collection={COLLECTION} allowScanned onClose={vi.fn()} random={seeded(3)} />);
    expect(screen.queryByTestId('quest-continue')).toBeNull();
    fireEvent.click(screen.getByTestId('quest-new'));
    for (const c of COLLECTION) fireEvent.click(screen.getByLabelText(`Thêm ${c.name} vào đội`));
    fireEvent.click(screen.getByText(/Cho mượn ngẫu nhiên 2 Pokémon/));
    await advance(5000);
    fireEvent.click(screen.getByRole('button', { name: /Bắt đầu hành trình/ }));
    expect(world()).toBeInTheDocument();
    expect(screen.getByTestId('quest-banner')).toHaveTextContent('Làng Pallet');
    expect(within(screen.getByTestId('quest-party')).getAllByRole('button')).toHaveLength(5);
    expect(member(0)).toHaveAttribute('data-level', '5');
    expect(member(0)).toHaveAttribute('aria-label', 'Charmander dẫn đầu');
    // Only the lead and one companion are out; the other three rest in their balls
    expect(screen.getAllByTestId(/quest-member-/).filter((b) => b.dataset.out === 'true')).toHaveLength(2);
    expect(member(2)).toHaveAttribute('aria-label', 'Thả Squirtle ra');
    // In town there are no skill buttons, only items
    expect(screen.queryByTestId('quest-s1')).toBeNull();
    const x0 = Number(world().dataset.x);
    await hold('KeyA', 800);
    expect(Number(world().dataset.x)).toBeLessThan(x0 - 80);
    // Saved at once
    expect(JSON.parse(localStorage.getItem(SAVE_KEY)).party).toHaveLength(5);
  });

  it('QUI-02 the team fights by itself: experience goes up, the lead uses its skills, the lead can be switched', async () => {
    presave({ area: 1 });
    render(<TrainerQuestGame collection={[]} onClose={vi.fn()} random={seeded(4)} />);
    expect(screen.getByTestId('quest-continue')).toHaveTextContent('Đồng cỏ Tuyến 1');
    fireEvent.click(screen.getByTestId('quest-continue'));
    expect(world().dataset.area).toBe('0-1');
    const xp0 = Number(member(0).dataset.xp);
    fireEvent.pointerDown(screen.getByTestId('quest-s2'));
    await advance(200);
    expect(screen.getByTestId('quest-s2').dataset.ready).toBe('false');
    await advance(8000);
    const lvl = Number(member(0).dataset.level);
    expect(lvl > 5 || Number(member(0).dataset.xp) > xp0).toBe(true);
    // Tap a Pokemon resting in its ball: it is sent out as the lead, the companion goes back
    expect(member(1).dataset.out).toBe('true');
    fireEvent.pointerDown(member(2));
    await advance(200);
    expect(member(2)).toHaveAttribute('aria-pressed', 'true');
    expect(member(2).dataset.out).toBe('true');
    expect(member(0).dataset.out).toBe('true');
    expect(member(1).dataset.out).toBe('false');
    expect(screen.getByTestId('quest-s1')).toHaveAccessibleName('Súng nước');
  });

  it('QUI-03 Rare Candy from the bag: level up with the "LÊN CẤP!" burst', async () => {
    presave({ area: 1, inventory: { berry: 1, candy: 1 } });
    render(<TrainerQuestGame collection={[]} onClose={vi.fn()} random={seeded(5)} />);
    fireEvent.click(screen.getByTestId('quest-continue'));
    fireEvent.pointerDown(screen.getByTestId('quest-bag-btn'));
    const bag = screen.getByTestId('quest-bag');
    fireEvent.click(within(bag).getByLabelText('Dùng Kẹo hiếm'));
    await advance(200);
    expect(member(0)).toHaveAttribute('data-level', '6');
    expect(screen.getByTestId('quest-levelup')).toHaveTextContent('Charmander LÊN CẤP 6!');
  });

  it('QUI-04 evolution sequence: silhouettes, flash, then the new Pokemon; the team shows it', async () => {
    presave({ area: 1, level: 15, inventory: { stone: 1 } });
    render(<TrainerQuestGame collection={[]} onClose={vi.fn()} random={seeded(6)} />);
    fireEvent.click(screen.getByTestId('quest-continue'));
    fireEvent.pointerDown(screen.getByTestId('quest-bag-btn'));
    fireEvent.click(within(screen.getByTestId('quest-bag')).getByLabelText('Dùng Đá tiến hóa'));
    await advance(200);
    const evo = screen.getByTestId('quest-evolution');
    expect(evo).toHaveAttribute('data-phase', 'glow');
    expect(evo).toHaveTextContent('Charmander đang tiến hóa');
    await advance(2000);
    expect(evo).toHaveAttribute('data-phase', 'morph');
    await advance(3500);
    expect(evo).toHaveAttribute('data-phase', 'reveal');
    expect(evo).toHaveTextContent('Tiến hóa!');
    expect(evo).toHaveTextContent('Charmander đã tiến hóa thành Charmeleon!');
    fireEvent.click(within(evo).getByText('Tuyệt vời!'));
    await advance(200);
    expect(screen.queryByTestId('quest-evolution')).toBeNull();
    expect(member(0)).toHaveAttribute('aria-label', 'Charmeleon dẫn đầu');
    expect(JSON.parse(localStorage.getItem(SAVE_KEY)).party[0]).toMatchObject({ name: 'Charmeleon', dex: 5, stage: 1 });
  });

  it('QUI-05 town: the shop opens at its door and sells with the journey gold', async () => {
    presave({ gold: 40 });
    render(<TrainerQuestGame collection={[]} onClose={vi.fn()} random={seeded(7)} />);
    fireEvent.click(screen.getByTestId('quest-continue'));
    await hold('KeyD', 2000);
    await advance(300);
    const shop = screen.getByTestId('quest-shop');
    expect(within(shop).getByTestId('shop-gold')).toHaveTextContent('40');
    fireEvent.click(within(shop).getByLabelText('Mua Thuốc hồi máu'));
    await advance(200);
    expect(within(screen.getByTestId('quest-shop')).getByTestId('shop-gold')).toHaveTextContent('15');
    expect(screen.getByTestId('quest-gold')).toHaveTextContent('15');
    expect(within(screen.getByTestId('quest-shop')).getByLabelText('Mua Siêu thuốc')).toBeDisabled();
  });

  it('QUI-06 save every few seconds, exit, then "Tiếp tục hành trình" brings the same journey back', async () => {
    const onGold = vi.fn();
    presave({ area: 1 });
    const { unmount } = render(<TrainerQuestGame collection={[]} onGold={onGold} onClose={vi.fn()} random={seeded(8)} />);
    fireEvent.click(screen.getByTestId('quest-continue'));
    await advance(16000);
    const saved = JSON.parse(localStorage.getItem(SAVE_KEY));
    expect(saved.reward.playSeconds).toBeGreaterThanOrEqual(14);
    const levels = saved.party.map((m) => m.level);
    fireEvent.pointerDown(screen.getByTestId('quest-exit'));
    await advance(100);
    expect(screen.queryByTestId('quest-world')).toBeNull();
    const cont = screen.getByTestId('quest-continue');
    expect(cont).toHaveTextContent('Màn 1: Rừng Viridian');
    unmount();
    render(<TrainerQuestGame collection={[]} onGold={onGold} onClose={vi.fn()} random={seeded(9)} />);
    fireEvent.click(screen.getByTestId('quest-continue'));
    expect(world().dataset.area).toBe('0-1');
    expect(Number(member(0).dataset.level)).toBeGreaterThanOrEqual(levels[0]);
    // App gold is only ever paid in small amounts
    for (const [g] of onGold.mock.calls) expect(g).toBeLessThanOrEqual(10);
  });

  it('QUI-07 starting again asks first, then clears the old journey', async () => {
    presave({ area: 2 });
    render(<TrainerQuestGame collection={COLLECTION} allowScanned onClose={vi.fn()} random={seeded(10)} />);
    fireEvent.click(screen.getByTestId('quest-new'));
    const ask = screen.getByRole('alertdialog', { name: 'Bắt đầu hành trình mới?' });
    fireEvent.click(within(ask).getByText('Thôi'));
    expect(localStorage.getItem(SAVE_KEY)).not.toBeNull();
    fireEvent.click(screen.getByTestId('quest-new'));
    fireEvent.click(screen.getByText('Bắt đầu lại'));
    expect(localStorage.getItem(SAVE_KEY)).toBeNull();
    expect(screen.getByTestId('team-builder')).toBeInTheDocument();
  });

  it('QUI-08 an expert trainer: the dialog with the team, then the real-time arena starts; losing changes nothing', async () => {
    const e = generateArea(4242, 0, 1).experts[0];
    presave({ area: 1, pos: { x: Math.round(e.x - 110), y: Math.round(e.y) } });
    render(<TrainerQuestGame collection={[]} onClose={vi.fn()} random={seeded(11)} />);
    fireEvent.click(screen.getByTestId('quest-continue'));
    await hold('KeyD', 600);
    const dlg = screen.getByTestId('quest-expert');
    expect(dlg).toHaveTextContent('Thợ bắt bọ Tuấn');
    expect(within(screen.getByTestId('expert-team')).getAllByRole('img').length).toBeGreaterThanOrEqual(3);
    const levels = screen.getAllByTestId(/quest-member-/).map((b) => b.dataset.level);
    fireEvent.click(screen.getByTestId('expert-arena'));
    expect(screen.getByTestId('expert-arena-match')).toBeInTheDocument();
    expect(screen.getByRole('dialog', { name: 'Đấu trường Pokémon' })).toBeInTheDocument();
    await advance(3500);
    fireEvent.pointerDown(screen.getByLabelText('Thoát trận'));
    await advance(200);
    expect(screen.queryByTestId('expert-arena-match')).toBeNull();
    expect(screen.getByTestId('expert-line').textContent.length).toBeGreaterThan(5);
    expect(screen.queryByTestId('expert-reward')).toBeNull();
    fireEvent.click(screen.getByText('Tiếp tục'));
    await advance(200);
    expect(screen.queryByTestId('quest-expert')).toBeNull();
    expect(screen.getAllByTestId(/quest-member-/).map((b) => b.dataset.level)).toEqual(levels);
  });

  it('QUI-09 an expert trainer: the turn-based 5 vs 5 loads both teams and starts', async () => {
    const e = generateArea(4242, 0, 1).experts[0];
    presave({ area: 1, pos: { x: Math.round(e.x - 110), y: Math.round(e.y) } });
    render(<TrainerQuestGame collection={[]} onClose={vi.fn()} random={seeded(12)} />);
    fireEvent.click(screen.getByTestId('quest-continue'));
    await hold('KeyD', 600);
    fireEvent.click(screen.getByTestId('expert-team-battle'));
    await advance(500);
    const match = screen.getByTestId('expert-team-match');
    // The child's 5 (by Pokedex number and name) and the expert's team were loaded
    expect(mocks.fetchBattlePokemon.mock.calls.length).toBeGreaterThanOrEqual(8);
    expect(mocks.fetchBattlePokemon).toHaveBeenCalledWith('caterpie');
    expect(screen.getByTestId('team-intro')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('team-intro'));
    await advance(300);
    expect(match).toHaveAttribute('data-phase', 'battle');
    fireEvent.click(screen.getByLabelText('Bỏ trận đấu'));
    await advance(100);
    expect(screen.getByTestId('quest-expert')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('expert-later'));
    await advance(100);
    expect(screen.queryByTestId('quest-expert')).toBeNull();
  });

  it('QUI-10 the journey board shows the experts beaten per act and the badges', () => {
    const hud = { act: 1, unlocked: 1, beaten: [0], badges: [0], expertsDone: [5, 2, 0, 0, 0, 0] };
    render(<BoardPanel hud={hud} onTravel={vi.fn()} onClose={vi.fn()} />);
    expect(screen.getByTestId('board-badges')).toHaveTextContent('Huy hiệu Rừng Xanh');
    expect(screen.getByTestId('board-experts-0')).toHaveTextContent('5/5');
    expect(screen.getByTestId('board-experts-1')).toHaveTextContent('2/5');
    expect(screen.queryByTestId('board-experts-2')).toBeNull();
  });
});
