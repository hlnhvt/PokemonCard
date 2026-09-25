import React, { StrictMode } from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { VideoShowcase } from './VideoShowcase';
import { sounds } from '../utils/soundEffects';
import { makeCard } from '../test/fixtures';

beforeEach(() => {
  vi.useFakeTimers();
  vi.spyOn(sounds, 'playEnergySurge').mockImplementation(() => {});
  vi.spyOn(sounds, 'playPokemonCry').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  vi.useRealTimers();
});

const pokemon = makeCard({ videoShowcase: { ...makeCard().videoShowcase, duration: 2 } });

// Advance in small steps so React commits renders (and schedules effects) between ticks
async function runFor(ms) {
  for (let elapsed = 0; elapsed < ms; elapsed += 100) {
    await act(async () => {
      await vi.advanceTimersByTimeAsync(Math.min(100, ms - elapsed));
    });
  }
  if (ms === 0) {
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
  }
}

describe('VideoShowcase', () => {
  it('VS-01 auto-completes exactly once, even under StrictMode', async () => {
    const onComplete = vi.fn();
    render(
      <StrictMode>
        <VideoShowcase pokemon={pokemon} onComplete={onComplete} isMuted={false} />
      </StrictMode>
    );
    await runFor(5000);
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it('VS-02 skip then timeout still completes once', async () => {
    const onComplete = vi.fn();
    render(<VideoShowcase pokemon={pokemon} onComplete={onComplete} isMuted={false} />);
    fireEvent.click(screen.getByText('Bỏ qua'));
    await runFor(5000);
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it('VS-03 video end, buttons and timer only complete once', async () => {
    const onComplete = vi.fn();
    const { container } = render(<VideoShowcase pokemon={pokemon} onComplete={onComplete} isMuted={false} />);
    fireEvent.ended(container.querySelector('video'));
    fireEvent.click(screen.getByText('Bỏ qua'));
    fireEvent.click(screen.getByText(/Xem Xong Video/));
    await runFor(5000);
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it('VS-04 pausing auto-advance stops the countdown', async () => {
    const onComplete = vi.fn();
    render(<VideoShowcase pokemon={pokemon} onComplete={onComplete} isMuted={false} />);
    fireEvent.click(screen.getByText('Tạm dừng tự động chuyển'));
    await runFor(5000);
    expect(onComplete).not.toHaveBeenCalled();
    expect(screen.getByText('0%')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Tiếp tục tự động chuyển'));
    await runFor(5000);
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it('VS-05 shows the artwork fallback when the video fails', async () => {
    const { container } = render(<VideoShowcase pokemon={pokemon} onComplete={vi.fn()} isMuted={false} />);
    fireEvent.error(container.querySelector('video'));
    expect(container.querySelector('video')).toBeNull();
    expect(screen.getByAltText('Charizard')).toHaveAttribute('src', pokemon.fallbackImage);
  });

  it('VS-06 retries muted when autoplay with sound is blocked', async () => {
    const blocked = Object.assign(new Error('blocked'), { name: 'NotAllowedError' });
    const play = vi.spyOn(HTMLMediaElement.prototype, 'play')
      .mockImplementationOnce(() => Promise.reject(blocked))
      .mockImplementation(() => Promise.resolve());
    const { container } = render(<VideoShowcase pokemon={pokemon} onComplete={vi.fn()} isMuted={false} />);
    await runFor(0);
    const video = container.querySelector('video');
    expect(video).not.toBeNull();
    expect(video.muted).toBe(true);
    expect(play).toHaveBeenCalledTimes(2);
  });

  it('VS-07 links to a YouTube search in a new tab', () => {
    render(<VideoShowcase pokemon={pokemon} onComplete={vi.fn()} isMuted={false} />);
    const link = screen.getByText('Xem trên YouTube').closest('a');
    expect(link).toHaveAttribute('href', pokemon.youtubeSearchUrl);
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noreferrer');
  });
});
