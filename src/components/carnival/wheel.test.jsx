import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { WheelGame } from './WheelGame';
import { SEGMENTS } from '../../utils/carnival/wheel';
import { addTickets, getTickets } from '../../utils/carnival/tickets';
import { sounds } from '../../utils/soundEffects';
import { seeded } from '../../test/seeded';

const PLAYER = { name: 'Pikachu', image: 'pikachu.png' };

beforeEach(() => {
  vi.useFakeTimers();
  localStorage.removeItem('pokescan_tickets_v1');
  for (const s of ['playPop', 'playWhoosh', 'playCoin', 'playSuccessFanfare', 'playOops', 'playScanBeep', 'playNote']) vi.spyOn(sounds, s).mockImplementation(() => {});
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  localStorage.removeItem('pokescan_tickets_v1');
});
const advance = async (ms, step = 50) => {
  for (let t = 0; t < ms; t += step) {
    await act(async () => {
      await vi.advanceTimersByTimeAsync(step);
    });
  }
};
const dialog = () => screen.getByRole('dialog', { name: 'Vòng quay may mắn' });

/** Check that the prize on screen was paid through the right callback. */
function expectPaid(seg, { onGold, onBerries }, ticketsBefore) {
  if (seg.kind === 'gold' || seg.kind === 'jackpot') expect(onGold).toHaveBeenLastCalledWith(seg.amount);
  if (seg.kind === 'berry') expect(onBerries).toHaveBeenLastCalledWith({ [seg.berry]: 1 });
  expect(getTickets()).toBe(ticketsBefore - 1 + (seg.kind === 'ticket' ? 1 : 0));
}

describe('WheelGame', () => {
  it('CWU-01 no tickets: a friendly message and the spin button is disabled', () => {
    render(<WheelGame player={PLAYER} onClose={vi.fn()} onGold={vi.fn()} onBerries={vi.fn()} random={seeded(1)} />);
    expect(screen.getByTestId('wheel-empty')).toHaveTextContent('chơi các trò khác');
    expect(screen.getByTestId('wheel-spin')).toBeDisabled();
    expect(screen.getByTestId('wheel-tickets')).toHaveTextContent('0 vé');
  });

  it('CWU-02 a spin costs a ticket, lands on a prize that is paid once; "Quay tiếp" spins again; a swipe spins too', async () => {
    addTickets(3);
    const onGold = vi.fn();
    const onBerries = vi.fn();
    const cbs = { onGold, onBerries };
    render(<WheelGame player={PLAYER} onClose={vi.fn()} onGold={onGold} onBerries={onBerries} random={seeded(7)} />);
    expect(screen.getByTestId('wheel-tickets')).toHaveTextContent('3 vé');
    // 1st spin with the button
    fireEvent.click(screen.getByTestId('wheel-spin'));
    expect(dialog().dataset.spinning).toBe('true');
    expect(getTickets()).toBe(2);
    expect(screen.getByTestId('wheel-tickets')).toHaveTextContent('2 vé');
    expect(screen.getByTestId('wheel-spin')).toBeDisabled();
    await advance(6500);
    expect(dialog().dataset.spinning).toBe('false');
    let seg = SEGMENTS.find((s) => s.id === dialog().dataset.prize);
    expect(screen.getByTestId('wheel-prize').dataset.kind).toBe(seg.kind);
    expectPaid(seg, cbs, 3);
    const paid = onGold.mock.calls.length + onBerries.mock.calls.length;
    await advance(2000); // nothing is paid twice
    expect(onGold.mock.calls.length + onBerries.mock.calls.length).toBe(paid);
    // 2nd spin from the prize card
    let before = getTickets();
    fireEvent.click(screen.getByText(/Quay tiếp/));
    expect(screen.queryByTestId('wheel-prize')).toBeNull();
    expect(getTickets()).toBe(before - 1);
    await advance(6500);
    seg = SEGMENTS.find((s) => s.id === dialog().dataset.prize);
    expectPaid(seg, cbs, before);
    expect(dialog().dataset.spins).toBe('2');
  }, 60000);

  it('CWU-03 swiping the wheel spins it (costs a ticket); the last ticket spent leaves "Quay tiếp" disabled', async () => {
    addTickets(1);
    const onGold = vi.fn();
    const onBerries = vi.fn();
    render(<WheelGame player={PLAYER} onClose={vi.fn()} onGold={onGold} onBerries={onBerries} random={seeded(3)} />);
    const disc = screen.getByTestId('wheel-disc');
    fireEvent.pointerDown(disc, { clientX: 60, clientY: 80, pointerId: 1 });
    fireEvent.pointerUp(disc, { clientX: 45, clientY: 90, pointerId: 1 }); // too short: nothing
    expect(dialog().dataset.spinning).toBe('false');
    fireEvent.pointerDown(disc, { clientX: 60, clientY: 80, pointerId: 1 });
    fireEvent.pointerUp(disc, { clientX: 260, clientY: 140, pointerId: 1 });
    expect(dialog().dataset.spinning).toBe('true');
    expect(getTickets()).toBe(0);
    await advance(7500);
    const seg = SEGMENTS.find((s) => s.id === dialog().dataset.prize);
    expectPaid(seg, { onGold, onBerries }, 1);
    if (seg.kind !== 'ticket') {
      expect(screen.getByText(/Quay tiếp/).closest('button')).toBeDisabled();
      expect(screen.getByTestId('wheel-prize')).toHaveTextContent('Hết vé');
    }
  }, 60000);
});
