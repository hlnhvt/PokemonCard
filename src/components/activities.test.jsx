import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act, waitFor, within } from '@testing-library/react';
import { makeCard } from '../test/fixtures';

const mocks = vi.hoisted(() => ({ fetchEvolutionChain: vi.fn() }));
vi.mock('../services/pokemonOnlineService', async (importOriginal) => ({
  ...(await importOriginal()),
  fetchEvolutionChain: mocks.fetchEvolutionChain,
}));

import { CatchGame } from './CatchGame';
import { GuessGame } from './GuessGame';
import { EvolutionTree, SCANS_TO_EVOLVE } from './EvolutionTree';
import { PokemonBuddy } from './PokemonBuddy';
import { EvolutionScene, EVOLVE_GLOW_MS } from './EvolutionScene';
import { sounds } from '../utils/soundEffects';
import { ROUNDS } from '../utils/guessGame';

beforeEach(() => {
  for (const s of ['playShutter', 'playScanBeep', 'playSuccessFanfare', 'playPokemonCry', 'playEnergySurge', 'playWhoosh', 'playPop']) {
    vi.spyOn(sounds, s).mockImplementation(() => {});
  }
  mocks.fetchEvolutionChain.mockReset();
});

async function advance(ms) {
  for (let t = 0; t < ms; t += 100) {
    await act(async () => {
      await vi.advanceTimersByTimeAsync(100);
    });
  }
}

describe('CatchGame', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  // Frozen clock: the Pokemon stays at the centre, so every throw is deterministic.
  // A slow Pokemon (capture rate 255) is hit by the NÉM button; a swipe to the far left misses.
  const frozen = () => 0;
  const easy = () => makeCard({ captureRate: 255 });
  const phaseOf = () => screen.getByRole('dialog').dataset.phase;

  it('CA-01 a throw that hits plays the whole catch sequence and catches', async () => {
    const onCaught = vi.fn();
    render(<CatchGame pokemon={easy()} image="x.png" onClose={vi.fn()} onCaught={onCaught} now={frozen} random={() => 0} />);
    fireEvent.click(screen.getByText('NÉM!'));
    expect(phaseOf()).toBe('flying');
    expect(screen.getByTestId('flying-ball')).toBeInTheDocument();
    expect(screen.getByLabelText('Còn 4 quả bóng')).toBeInTheDocument();
    expect(sounds.playWhoosh).toHaveBeenCalled();

    await advance(700);
    expect(phaseOf()).toBe('absorbing');
    expect(document.querySelector('.impact-burst')).not.toBeNull();
    expect(document.querySelector('.ball-lid-open')).not.toBeNull();
    expect(screen.getByAltText('Charizard').className).toContain('poke-absorb');

    await advance(500);
    expect(phaseOf()).toBe('dropping');
    expect(document.querySelector('.ball-drop')).not.toBeNull();
    expect(screen.queryByAltText('Charizard')).toBeNull();

    await advance(500);
    expect(phaseOf()).toBe('shaking');
    expect(document.querySelector('.ball-shake')).not.toBeNull();

    await advance(1800);
    expect(phaseOf()).toBe('caught');
    expect(document.querySelectorAll('.star-ray')).toHaveLength(8);
    expect(document.querySelector('.ball-click')).not.toBeNull();
    expect(onCaught).toHaveBeenCalledTimes(1);
    expect(screen.getByText(/Bé đã bắt được Charizard/)).toBeInTheDocument();
  });

  it('CA-02 an escape bursts the Pokemon back out, costs a ball and lets the child retry', async () => {
    const onCaught = vi.fn();
    render(<CatchGame pokemon={easy()} image="x.png" onClose={vi.fn()} onCaught={onCaught} now={frozen} random={() => 0.999} />);
    fireEvent.click(screen.getByText('NÉM!'));
    await advance(3200);
    expect(phaseOf()).toBe('escaping');
    expect(screen.getByAltText('Charizard').className).toContain('poke-escape');
    await advance(600);
    expect(screen.getByRole('status')).toHaveTextContent('thoát ra');
    await advance(1400);
    expect(phaseOf()).toBe('aim');
    expect(screen.getByText('NÉM!')).not.toBeDisabled();
    expect(screen.getByLabelText('Còn 4 quả bóng')).toBeInTheDocument();
    expect(onCaught).not.toHaveBeenCalled();
  });

  it('CA-03 a swipe aimed far away misses with a fly-past; running out of balls offers a replay', async () => {
    render(<CatchGame pokemon={makeCard()} image="x.png" onClose={vi.fn()} now={frozen} random={() => 0} />);
    const arena = screen.getByTestId('catch-arena');
    arena.getBoundingClientRect = () => ({ left: 0, top: 0, width: 400, height: 320 });
    for (let i = 0; i < 5; i++) {
      fireEvent.pointerDown(arena, { clientX: 5, clientY: 300 });
      fireEvent.pointerUp(arena, { clientX: 5, clientY: 100 });
      await advance(700);
      expect(phaseOf()).toBe('missed');
      expect(document.querySelector('.ball-miss')).not.toBeNull();
      expect(screen.getByRole('status')).toHaveTextContent('Trượt');
      await advance(1400);
    }
    expect(screen.getByText('Chơi lại')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Chơi lại'));
    expect(screen.getByLabelText('Còn 5 quả bóng')).toBeInTheDocument();
  });

  it('CA-05 the flying ball moves along its arc with a trail', async () => {
    const clock = { t: 0 };
    render(<CatchGame pokemon={easy()} image="x.png" onClose={vi.fn()} now={() => clock.t} random={() => 0} />);
    const arena = screen.getByTestId('catch-arena');
    Object.defineProperty(arena, 'clientWidth', { value: 400 });
    Object.defineProperty(arena, 'clientHeight', { value: 320 });
    fireEvent.click(screen.getByText('NÉM!'));
    const ball = screen.getByTestId('flying-ball');
    const positions = [];
    for (const t of [50, 300, 550]) {
      clock.t = t;
      await advance(100);
      positions.push(ball.style.transform);
    }
    expect(new Set(positions).size).toBe(3);
    expect(positions[2]).toMatch(/rotate\((?!0deg)/);
    const visibleTrail = [...document.querySelectorAll('.blur-\\[2px\\].rounded-full')].filter((el) => el.style.opacity !== '0');
    expect(visibleTrail.length).toBeGreaterThan(0);
  });
  it('CA-04 ignores taps and tiny drags that are not upward swipes, and closes', () => {
    const onClose = vi.fn();
    render(<CatchGame pokemon={makeCard()} image="x.png" onClose={onClose} now={frozen} />);
    const arena = screen.getByTestId('catch-arena');
    fireEvent.pointerDown(arena, { clientX: 200, clientY: 300 });
    fireEvent.pointerUp(arena, { clientX: 200, clientY: 290 });
    expect(screen.getByLabelText('Còn 5 quả bóng')).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText('Đóng trò chơi'));
    expect(onClose).toHaveBeenCalled();
  });
});

describe('GuessGame', () => {
  it('GU-01 plays 10 rounds, scores correct answers and shows stars', () => {
    render(<GuessGame collection={[]} random={() => 0} />);
    expect(screen.getByAltText('Pokémon bí ẩn').className).toContain('silhouette');
    for (let round = 1; round <= ROUNDS; round++) {
      expect(screen.getByText(`Câu ${round}/${ROUNDS}`)).toBeInTheDocument();
      expect(screen.getByAltText('Pokémon bí ẩn')).toBeInTheDocument();
      const options = screen.getAllByRole('button').filter((b) => b.className.includes('py-4'));
      expect(options).toHaveLength(4);
      fireEvent.click(options[0]);
      options.forEach((o) => expect(o).toBeDisabled());
      fireEvent.click(screen.getByText(round === ROUNDS ? 'Xem kết quả' : 'Câu tiếp theo'));
    }
    expect(screen.getByText('Hoàn thành!')).toBeInTheDocument();
    expect(screen.getByText(/Kỷ lục/)).toBeInTheDocument();
  });

  it('GU-02 reveals the answer, marks right and wrong, and offers a hint', () => {
    render(<GuessGame collection={[makeCard()]} random={() => 0} />);
    fireEvent.click(screen.getByText('Xem gợi ý'));
    const hint = screen.getByLabelText('Gợi ý').textContent;
    const options = screen.getAllByRole('button').filter((b) => b.className.includes('py-4'));
    const correct = options.find((b) => b.textContent.charAt(0).toUpperCase() === hint.charAt(0) && hint.replace(/[^_]/g, '').length === b.textContent.replace(/[^A-Za-z]/g, '').length - 1);
    fireEvent.click(correct);
    expect(screen.getByRole('status')).toHaveTextContent('Đúng rồi!');
    expect(correct.className).toContain('bg-emerald-500');
    expect(screen.getByAltText(correct.textContent).className).not.toContain('silhouette');
    expect(screen.getByText('1', { selector: 'span' })).toBeInTheDocument();
  });

  it('GU-03 a wrong answer shows the correct name', () => {
    render(<GuessGame collection={[]} random={() => 0} />);
    const options = screen.getAllByRole('button').filter((b) => b.className.includes('py-4'));
    fireEvent.click(options[0]);
    const status = screen.getByRole('status').textContent;
    if (status.startsWith('Chưa đúng')) {
      expect(options[0].className).toContain('bg-rose-500');
      expect(options.some((b) => b.className.includes('bg-emerald-500'))).toBe(true);
    } else {
      expect(status).toContain('Đúng rồi!');
    }
  });
});

const EEVEE_NODES = [
  { name: 'eevee', id: 133, image: 'e.png', stage: 0, from: null, how: null },
  { name: 'vaporeon', id: 134, image: 'v.png', stage: 1, from: 'eevee', how: 'Dùng Đá Nước' },
  { name: 'umbreon', id: 197, image: 'u.png', stage: 1, from: 'eevee', how: 'Rất thân thiết (ban đêm)' },
];

describe('EvolutionTree', () => {
  const eevee = makeCard({ id: 'eevee', name: 'Eevee', speciesName: 'eevee', pokedexNumber: '133' });

  it('EV-01 shows the family with how each form evolves', async () => {
    mocks.fetchEvolutionChain.mockResolvedValue(EEVEE_NODES);
    render(<EvolutionTree pokemon={eevee} scanCount={1} />);
    expect(screen.getByText('Đang tải cây tiến hóa...')).toBeInTheDocument();
    expect(await screen.findByText('Vaporeon')).toBeInTheDocument();
    expect(screen.getByText('Dùng Đá Nước')).toBeInTheDocument();
    expect(screen.getByText('Eevee').closest('button')).toHaveAttribute('aria-current', 'true');
  });

  it('EV-02 asks for more scans before evolving', async () => {
    mocks.fetchEvolutionChain.mockResolvedValue(EEVEE_NODES);
    render(<EvolutionTree pokemon={eevee} scanCount={1} />);
    expect(await screen.findByText(`${SCANS_TO_EVOLVE - 1}`)).toBeInTheDocument();
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '1');
    expect(screen.queryByText(/Tiến hóa thành/)).toBeNull();
  });

  it('EV-03 offers each branch once enough scans are made', async () => {
    mocks.fetchEvolutionChain.mockResolvedValue(EEVEE_NODES);
    const onEvolve = vi.fn();
    render(<EvolutionTree pokemon={eevee} scanCount={SCANS_TO_EVOLVE} onEvolve={onEvolve} />);
    fireEvent.click(await screen.findByText('Tiến hóa thành Umbreon!'));
    expect(screen.getByText('Tiến hóa thành Vaporeon!')).toBeInTheDocument();
    expect(onEvolve).toHaveBeenCalledWith('umbreon');
  });

  it('EV-04 tapping another form explores it; final forms and previews cannot evolve', async () => {
    mocks.fetchEvolutionChain.mockResolvedValue(EEVEE_NODES);
    const onExplore = vi.fn();
    const umbreon = makeCard({ id: 'umbreon', name: 'Umbreon', speciesName: 'umbreon', pokedexNumber: '197' });
    render(<EvolutionTree pokemon={umbreon} scanCount={9} onExplore={onExplore} />);
    expect(await screen.findByText(/dạng tiến hóa cuối cùng/)).toBeInTheDocument();
    fireEvent.click(screen.getByText('Eevee'));
    expect(onExplore).toHaveBeenCalledWith('eevee');
  });

  it('EV-05 single-stage Pokemon and failed loads', async () => {
    mocks.fetchEvolutionChain.mockResolvedValueOnce([{ name: 'tauros', id: 128, image: 't.png', stage: 0, from: null, how: null }]);
    const { unmount } = render(<EvolutionTree pokemon={makeCard({ speciesName: 'tauros' })} />);
    expect(await screen.findByText(/không tiến hóa/)).toBeInTheDocument();
    unmount();
    mocks.fetchEvolutionChain.mockResolvedValueOnce([]);
    const { container } = render(<EvolutionTree pokemon={makeCard({ speciesName: 'x' })} />);
    await waitFor(() => expect(container).toBeEmptyDOMElement());
  });

  it('EV-06 cards of alternate forms without a species name show nothing', () => {
    const { container } = render(<EvolutionTree pokemon={makeCard({ speciesName: undefined, pokedexNumber: '10034' })} />);
    expect(container).toBeEmptyDOMElement();
    expect(mocks.fetchEvolutionChain).not.toHaveBeenCalled();
  });
});

describe('PokemonBuddy', () => {
  it('BU-01 tapping plays the cry and shows hearts', () => {
    render(<PokemonBuddy pokemon={makeCard()} />);
    fireEvent.click(screen.getByLabelText('Chạm vào Charizard'));
    expect(sounds.playPokemonCry).toHaveBeenCalled();
    expect(screen.getAllByText('❤️').length).toBeGreaterThan(0);
  });

  it('BU-02 shiny toggle appears only once a shiny was found', () => {
    const onToggle = vi.fn();
    const { rerender } = render(<PokemonBuddy pokemon={makeCard()} showShiny={false} onToggleShiny={onToggle} />);
    expect(screen.queryByText('Shiny')).toBeNull();
    rerender(<PokemonBuddy pokemon={makeCard()} shinyUnlocked showShiny={false} onToggleShiny={onToggle} />);
    fireEvent.click(screen.getByText('Shiny'));
    expect(onToggle).toHaveBeenCalledWith(true);
    rerender(<PokemonBuddy pokemon={makeCard()} shinyUnlocked showShiny onToggleShiny={onToggle} />);
    expect(screen.getByAltText('Charizard')).toHaveAttribute('src', expect.stringContaining('/shiny/6.png'));
  });

  it('BU-03 shows catches, legacy cry button and one "play" button opening the game picker', () => {
    const onPlay = vi.fn();
    const games = [
      { id: 'catch', title: 'Ném bóng bắt Pokémon', description: 'd', icon: '🎯', gradient: 'from-red-500 to-rose-500', badge: 'Bắt 3 lần', onPlay },
      { id: 'runner', title: 'Chạy nhảy', description: 'd', icon: '🏃', gradient: 'from-emerald-500 to-teal-500', onPlay: vi.fn() },
    ];
    render(<PokemonBuddy pokemon={makeCard({ cryLegacyUrl: 'l.ogg' })} catchCount={3} games={games} />);
    expect(screen.getByText('Đã bắt 3 lần')).toBeInTheDocument();
    expect(screen.getByText('Tiếng kêu cổ điển')).toBeInTheDocument();
    // No long list of game buttons on the page itself
    expect(screen.queryByText('Ném bóng bắt Pokémon')).toBeNull();
    fireEvent.click(screen.getByText(/Chơi cùng Charizard/));
    const picker = screen.getByRole('dialog', { name: 'Chọn trò chơi' });
    expect(within(picker).getByText('Chạy nhảy')).toBeInTheDocument();
    expect(within(picker).getByText('Bắt 3 lần')).toBeInTheDocument();
    fireEvent.click(within(picker).getByText('Ném bóng bắt Pokémon'));
    expect(onPlay).toHaveBeenCalled();
    expect(screen.queryByRole('dialog', { name: 'Chọn trò chơi' })).toBeNull();
  });

  it('BU-08 the game picker closes with the backdrop, the X button or Escape', () => {
    const games = [{ id: 'runner', title: 'Chạy nhảy', description: 'd', icon: '🏃', gradient: 'from-emerald-500 to-teal-500', onPlay: vi.fn() }];
    render(<PokemonBuddy pokemon={makeCard()} games={games} />);
    const open = () => fireEvent.click(screen.getByText(/Chơi cùng Charizard/));
    const picker = () => screen.queryByRole('dialog', { name: 'Chọn trò chơi' });
    open();
    fireEvent.click(screen.getByLabelText('Đóng danh sách trò chơi'));
    expect(picker()).toBeNull();
    open();
    fireEvent.click(screen.getByLabelText('Đóng'));
    expect(picker()).toBeNull();
    open();
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(picker()).toBeNull();
    expect(games[0].onPlay).not.toHaveBeenCalled();
  });
});

describe('EvolutionScene', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('ES-01 glows first, then reveals the evolved Pokemon', async () => {
    const onDone = vi.fn();
    const from = makeCard({ name: 'Eevee' });
    const { rerender } = render(<EvolutionScene from={from} to={null} onDone={onDone} />);
    expect(screen.getByRole('status')).toHaveTextContent('Eevee đang tiến hóa');
    rerender(<EvolutionScene from={from} to={makeCard({ id: 'umbreon', name: 'Umbreon' })} onDone={onDone} />);
    expect(screen.queryByText('Xem Umbreon')).toBeNull();
    await advance(EVOLVE_GLOW_MS + 100);
    fireEvent.click(screen.getByText('Xem Umbreon'));
    expect(onDone).toHaveBeenCalled();
    expect(sounds.playSuccessFanfare).toHaveBeenCalled();
  });

  it('ES-02 shows a friendly error', () => {
    const onDone = vi.fn();
    render(<EvolutionScene from={makeCard()} to={null} error="offline" onDone={onDone} />);
    fireEvent.click(screen.getByText('Quay lại'));
    expect(onDone).toHaveBeenCalled();
  });
});
