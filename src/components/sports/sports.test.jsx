import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { BowlingGame } from './BowlingGame';
import { PenaltyGame } from './PenaltyGame';
import { BasketballGame } from './BasketballGame';
import { RacingGame } from './RacingGame';
import { GamesHub } from '../GamesHub';
import { perfectLaunch } from '../../utils/sports/basketball';
import { MATCH_REWARDS } from '../../utils/sports/common';
import { sounds } from '../../utils/soundEffects';
import { seeded } from '../../test/seeded';

const PLAYER = { name: 'Charizard', image: 'charizard.png' };

beforeEach(() => {
  vi.useFakeTimers();
  // jsdom has no canvas: the games still run, they just draw nothing
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
  // Canvas at its logical size, so pointer coordinates map 1:1
  vi.spyOn(HTMLCanvasElement.prototype, 'getBoundingClientRect').mockReturnValue({ left: 0, top: 0, width: 360, height: 560, right: 360, bottom: 560, x: 0, y: 0 });
  for (const s of ['playPop', 'playWhoosh', 'playCoin', 'playSuccessFanfare', 'playScanBeep', 'playEnergySurge', 'playPokemonCry']) vi.spyOn(sounds, s).mockImplementation(() => {});
});
afterEach(() => vi.useRealTimers());

async function advance(ms, step = 100) {
  for (let t = 0; t < ms; t += step) {
    await act(async () => {
      await vi.advanceTimersByTimeAsync(step);
    });
  }
}

const dialog = () => screen.getByRole('dialog');

/** Advance until `check()` is true (or the time runs out), doing `each()` between steps. */
async function until(check, { max = 120000, each = () => {}, step = 200 } = {}) {
  for (let t = 0; t < max && !check(); t += step) {
    each();
    await advance(step, step);
  }
  return check();
}

function expectRewardGiven(onBerries) {
  const result = screen.getByTestId('match-result').dataset.result;
  expect(onBerries).toHaveBeenCalledTimes(1);
  expect(onBerries).toHaveBeenCalledWith(MATCH_REWARDS[result]);
}

describe('BowlingGame', () => {
  it('SPT-01 VS intro, then tap to aim and tap for power; the ball rolls', async () => {
    render(<BowlingGame player={PLAYER} onClose={vi.fn()} random={seeded(1)} />);
    expect(screen.getByText('VS', { selector: 'span.vs-pop' })).toBeInTheDocument();
    expect(dialog().dataset.phase).toBe('intro');
    await advance(2400);
    expect(dialog().dataset.phase).toBe('aim');
    expect(screen.getByTestId('sport-hint')).toHaveTextContent('mũi tên');
    fireEvent.pointerDown(screen.getByTestId('bowling-stage'));
    expect(dialog().dataset.phase).toBe('power');
    fireEvent.pointerDown(screen.getByTestId('bowling-stage'));
    expect(dialog().dataset.phase).toBe('rolling');
    expect(sounds.playWhoosh).toHaveBeenCalled();
    // The roll finishes and a banner tells how it went
    expect(await until(() => screen.queryByTestId('sport-banner'), { max: 8000 })).toBeTruthy();
  });

  it('SPT-02 a whole 5-frame match ends with the result and one berry reward', async () => {
    const onBerries = vi.fn();
    render(<BowlingGame player={PLAYER} onClose={vi.fn()} onBerries={onBerries} random={seeded(2)} />);
    const tapIfMyTurn = () => {
      const d = dialog().dataset;
      if (d.turn === 'player' && (d.phase === 'aim' || d.phase === 'power')) fireEvent.pointerDown(screen.getByTestId('bowling-stage'));
    };
    expect(await until(() => screen.queryByTestId('match-result'), { each: tapIfMyTurn, max: 200000, step: 250 })).toBeTruthy();
    expect(screen.getByTestId('frame-strip').textContent).not.toContain('·');
    expectRewardGiven(onBerries);
  }, 60000);
});

/** A swipe on a stage (screen = canvas coordinates in these tests). */
function swipe(stage, from, to) {
  fireEvent.pointerDown(stage, { clientX: from[0], clientY: from[1], pointerId: 1 });
  fireEvent.pointerMove(stage, { clientX: (from[0] + to[0]) / 2, clientY: (from[1] + to[1]) / 2, pointerId: 1 });
  fireEvent.pointerUp(stage, { clientX: to[0], clientY: to[1], pointerId: 1 });
}

describe('PenaltyGame', () => {
  it('SPT-03 the child shoots with a swipe up, then guesses and dives with a sideways swipe (no buttons, no hints)', async () => {
    render(<PenaltyGame player={PLAYER} onClose={vi.fn()} random={seeded(3)} />);
    await advance(2400);
    expect(dialog().dataset.phase).toBe('aim');
    expect(screen.getByTestId('swipe-hint')).toBeInTheDocument();
    const stage = screen.getByTestId('penalty-stage');
    // A tap or a downward swipe does not shoot
    swipe(stage, [180, 470], [182, 472]);
    swipe(stage, [180, 400], [180, 500]);
    expect(dialog().dataset.phase).toBe('aim');
    swipe(stage, [180, 470], [60, 290]);
    expect(dialog().dataset.phase).toBe('kick');
    await advance(3500);
    expect(dialog().dataset.kicker).toBe('opponent');
    expect(dialog().dataset.phase).toBe('read');
    expect(screen.queryByTestId('dive-buttons')).toBeNull();
    expect(screen.getByTestId('dive-hint')).toBeInTheDocument();
    // No hint of where the kicker will shoot: no look bubble, no direction arrows
    expect(screen.queryByTestId('kicker-look')).toBeNull();
    expect(screen.getByTestId('dive-hint').textContent).not.toMatch(/⬅️|➡️|⬆️/);
    expect(screen.getByTestId('sport-hint')).toHaveTextContent('Đoán xem');
    swipe(stage, [200, 300], [90, 310]);
    expect(dialog().dataset.phase).toBe('kick');
  });

  it('SPT-04 after 5 kicks and 5 saves the match ends and rewards once', async () => {
    const onBerries = vi.fn();
    render(<PenaltyGame player={PLAYER} onClose={vi.fn()} onBerries={onBerries} random={seeded(4)} />);
    const stage = () => screen.getByTestId('penalty-stage');
    const act1 = () => {
      const d = dialog().dataset;
      if (d.phase === 'aim') swipe(stage(), [180, 470], [300, 250]);
      else if (d.phase === 'read') swipe(stage(), [180, 400], [182, 300]);
    };
    expect(await until(() => screen.queryByTestId('match-result'), { each: act1, max: 80000 })).toBeTruthy();
    const marks = screen.getByTestId('kick-strip').querySelectorAll('.star-pop');
    expect(marks).toHaveLength(10);
    expectRewardGiven(onBerries);
  }, 30000);
});

describe('BasketballGame', () => {
  const pullFor = (v) => ({ dx: (-v.vx / 3.2) * 36, dy: (v.vy / 3.2) * 36 }); // screen pixels (y down)

  it('SPT-05 a small pull does nothing; a good slingshot pull scores 2 points', async () => {
    render(<BasketballGame player={PLAYER} onClose={vi.fn()} random={seeded(5)} />);
    await advance(2400);
    const stage = screen.getByTestId('basketball-stage');
    expect(dialog().dataset.phase).toBe('aim');
    fireEvent.pointerDown(stage, { clientX: 200, clientY: 300, pointerId: 1 });
    fireEvent.pointerUp(stage, { clientX: 195, clientY: 303, pointerId: 1 });
    expect(dialog().dataset.phase).toBe('aim');

    const pull = pullFor(perfectLaunch(58));
    fireEvent.pointerDown(stage, { clientX: 200, clientY: 300, pointerId: 1 });
    fireEvent.pointerMove(stage, { clientX: 200 + pull.dx / 2, clientY: 300 + pull.dy / 2, pointerId: 1 });
    fireEvent.pointerUp(stage, { clientX: 200 + pull.dx, clientY: 300 + pull.dy, pointerId: 1 });
    expect(dialog().dataset.phase).toBe('flying');
    await until(() => dialog().dataset.turn === 'opponent', { max: 8000, step: 100 });
    expect(screen.getByTestId('score-left')).toHaveTextContent('2');
  });

  it('SPT-06 the opponent shoots by itself and the match ends after 5 shots each', async () => {
    const onBerries = vi.fn();
    render(<BasketballGame player={PLAYER} onClose={vi.fn()} onBerries={onBerries} random={seeded(6)} />);
    const pull = pullFor(perfectLaunch(60));
    const shoot = () => {
      const d = dialog().dataset;
      if (d.phase !== 'aim' || d.turn !== 'player') return;
      const stage = screen.getByTestId('basketball-stage');
      fireEvent.pointerDown(stage, { clientX: 200, clientY: 300, pointerId: 1 });
      fireEvent.pointerUp(stage, { clientX: 200 + pull.dx, clientY: 300 + pull.dy, pointerId: 1 });
    };
    expect(await until(() => screen.queryByTestId('match-result'), { each: shoot, max: 90000 })).toBeTruthy();
    expect(screen.getByTestId('match-result').dataset.result).toBe('win');
    expectRewardGiven(onBerries);
  }, 30000);
});

describe('RacingGame', () => {
  it('SPT-07 counts down 3-2-1, then swipes (and keys) change lane; no buttons', async () => {
    render(<RacingGame player={PLAYER} onClose={vi.fn()} random={seeded(7)} />);
    expect(screen.getByTestId('countdown')).toHaveTextContent('3');
    expect(screen.queryByText('Phải ➡️')).toBeNull();
    const stage = screen.getByTestId('racing-stage');
    // No steering before the start
    fireEvent.keyDown(window, { key: 'ArrowLeft' });
    expect(dialog().dataset.lane).toBe('1');
    await advance(3200);
    expect(screen.queryByTestId('countdown')).toBeNull();
    swipe(stage, [200, 300], [140, 305]);
    expect(dialog().dataset.lane).toBe('0');
    // A tap does nothing; a vertical swipe does nothing
    swipe(stage, [300, 300], [302, 301]);
    swipe(stage, [200, 200], [205, 400]);
    expect(dialog().dataset.lane).toBe('0');
    // One long swipe crosses two lanes
    swipe(stage, [60, 300], [150, 300]);
    expect(dialog().dataset.lane).toBe('2');
    fireEvent.keyDown(window, { key: 'ArrowLeft' });
    expect(dialog().dataset.lane).toBe('1');
    expect(sounds.playWhoosh).toHaveBeenCalledTimes(4);
  });

  it('SPT-08 the race reaches the finish, shows the place and rewards once', async () => {
    const onBerries = vi.fn();
    render(<RacingGame player={PLAYER} onClose={vi.fn()} onBerries={onBerries} random={seeded(8)} />);
    expect(await until(() => screen.queryByTestId('match-result'), { max: 60000 })).toBeTruthy();
    const place = Number(dialog().dataset.place);
    expect(place).toBeGreaterThanOrEqual(1);
    expect(place).toBeLessThanOrEqual(4);
    expect(screen.getByTestId('match-result').textContent).toContain('Charizard');
    expectRewardGiven(onBerries);
  }, 30000);
});

describe('sports in the app', () => {
  it('SPT-09 the Games tab lists the 4 sports and opens one; close works', async () => {
    // Charizard's real stats: rank Vàng, enough for penalty (racing needs Huyền thoại)
    const charizard = { id: 'charizard', name: 'Charizard', pokedexNumber: '006', fallbackImage: 'c.png', baseHp: 78, attack: 84, defense: 78, speed: 100 };
    render(<GamesHub collection={[charizard]} onBerries={vi.fn()} />);
    for (const t of ['Bowling', 'Sút penalty']) expect(screen.getByLabelText(t)).toBeEnabled();
    for (const t of ['Bóng rổ', 'Đua xe máy']) expect(screen.getByLabelText(`${t} (cần hạng Huyền thoại)`)).toBeDisabled();
    fireEvent.click(screen.getByLabelText('Sút penalty'));
    expect(screen.getByRole('dialog', { name: 'Sút penalty Pokémon' })).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText('Đóng trò chơi'));
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('SPT-10 Escape closes a match', () => {
    const onClose = vi.fn();
    render(<BowlingGame player={PLAYER} onClose={onClose} random={seeded(9)} />);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });
});
