import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act, within } from '@testing-library/react';
import { speciesNames, jsonResponse, makeCard } from '../test/fixtures';

const mocks = vi.hoisted(() => ({
  recognizeCardWithOCR: vi.fn(),
  fetchPokemonOnline: vi.fn(),
}));

vi.mock('../utils/cardRecognizer', () => ({ recognizeCardWithOCR: mocks.recognizeCardWithOCR }));
vi.mock('../services/pokemonOnlineService', async (importOriginal) => ({
  ...(await importOriginal()),
  fetchPokemonOnline: mocks.fetchPokemonOnline,
}));

import { ScannerModal } from './ScannerModal';
import { sounds } from '../utils/soundEffects';
import { resetPokemonNamesCache } from '../services/pokemonOnlineService';

function makeTrack() {
  return { stop: vi.fn() };
}
function makeStream() {
  const track = makeTrack();
  return { track, getTracks: () => [track] };
}

function setMediaDevices(getUserMedia) {
  Object.defineProperty(navigator, 'mediaDevices', {
    configurable: true,
    value: getUserMedia ? { getUserMedia } : undefined,
  });
}

// jsdom never loads images: simulate decode success/failure from the data URL content
class FakeImage {
  constructor() {
    this.naturalWidth = 630;
    this.naturalHeight = 880;
  }
  set src(value) {
    this._src = value;
    setTimeout(() => {
      if (value.includes('YnJva2Vu')) this.onerror?.(); // base64 of "broken"
      else this.onload?.();
    }, 0);
  }
  get src() {
    return this._src;
  }
}

function imageFile(name, content = 'fake-image', type = 'image/png') {
  return new File([content], name, { type });
}

function upload(file) {
  const input = document.querySelectorAll('input[type="file"]')[1];
  fireEvent.change(input, { target: { files: [file] } });
  return input;
}

beforeEach(() => {
  resetPokemonNamesCache();
  mocks.recognizeCardWithOCR.mockReset();
  mocks.fetchPokemonOnline.mockReset();
  vi.stubGlobal('fetch', vi.fn(async () => jsonResponse({ results: speciesNames.map((name) => ({ name })) })));
  vi.stubGlobal('Image', FakeImage);
  for (const s of ['playShutter', 'playScanBeep']) vi.spyOn(sounds, s).mockImplementation(() => {});
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
  setMediaDevices(undefined);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('ScannerModal — camera', () => {
  it('SC-01 shows the real reason when getUserMedia is unsupported', async () => {
    render(<ScannerModal onCardDetected={vi.fn()} />);
    expect(await screen.findByText(/không hỗ trợ mở Camera trực tiếp/)).toBeInTheDocument();
    expect(screen.getByText('Chưa mở được Camera')).toBeInTheDocument();
  });

  it('SC-02 explains a denied permission', async () => {
    const denied = Object.assign(new Error('denied'), { name: 'NotAllowedError' });
    const gum = vi.fn(() => Promise.reject(denied));
    setMediaDevices(gum);
    render(<ScannerModal onCardDetected={vi.fn()} />);
    expect(await screen.findByText(/QUYỀN TRUY CẬP/)).toBeInTheDocument();
    // permission errors are not retried with looser constraints
    expect(gum).toHaveBeenCalledTimes(1);
  });

  it('SC-03 stops a stream that arrives after unmount', async () => {
    let resolve;
    const stream = makeStream();
    setMediaDevices(vi.fn(() => new Promise((r) => { resolve = r; })));
    const { unmount } = render(<ScannerModal onCardDetected={vi.fn()} />);
    unmount();
    await act(async () => resolve(stream));
    expect(stream.track.stop).toHaveBeenCalled();
  });

  it('SC-04 stops the camera on unmount', async () => {
    const stream = makeStream();
    setMediaDevices(vi.fn(() => Promise.resolve(stream)));
    const { unmount } = render(<ScannerModal onCardDetected={vi.fn()} />);
    expect(await screen.findByRole('button', { name: 'Chụp quét tên thẻ' })).toBeInTheDocument();
    unmount();
    expect(stream.track.stop).toHaveBeenCalled();
  });

  it('SC-05 refuses to OCR before the first video frame', async () => {
    setMediaDevices(vi.fn(() => Promise.resolve(makeStream())));
    render(<ScannerModal onCardDetected={vi.fn()} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Chụp quét tên thẻ' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Camera chưa sẵn sàng');
    expect(mocks.recognizeCardWithOCR).not.toHaveBeenCalled();
  });
});

describe('ScannerModal — camera capture crop', () => {
  it('SC-21 sends only the reticle area of the frame to OCR', async () => {
    setMediaDevices(vi.fn(() => Promise.resolve(makeStream())));
    mocks.recognizeCardWithOCR.mockResolvedValue({ success: false, rawText: '', bestMatch: '', confidence: 0, candidates: [] });
    const drawImage = vi.fn();
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({ drawImage });
    const { container } = render(<ScannerModal onCardDetected={vi.fn()} />);
    const button = await screen.findByRole('button', { name: 'Chụp quét tên thẻ' });

    const video = container.querySelector('video');
    Object.defineProperty(video, 'videoWidth', { value: 720 });
    Object.defineProperty(video, 'videoHeight', { value: 1280 });
    // Portrait 720x1280 stream shown 1:1; reticle 400x560 at (160, 360)
    video.getBoundingClientRect = () => ({ left: 0, top: 0, width: 720, height: 1280 });
    const reticle = container.querySelector('[class*="aspect-[63/88]"]');
    reticle.getBoundingClientRect = () => ({ left: 160, top: 360, width: 400, height: 560 });

    fireEvent.click(button);
    await waitFor(() => expect(mocks.recognizeCardWithOCR).toHaveBeenCalled());
    const canvas = mocks.recognizeCardWithOCR.mock.calls[0][0];
    // 6% margin on each side
    expect(canvas.width).toBe(Math.round(400 * 1.12));
    expect(canvas.height).toBe(Math.round(560 * 1.12));
    const [, sx, sy, sw, sh] = drawImage.mock.calls[0];
    expect(sx).toBeCloseTo(160 - 24, 5);
    expect(sy).toBeCloseTo(360 - 33.6, 5);
    expect(sw).toBeCloseTo(448, 5);
    expect(sh).toBeCloseTo(627.2, 5);
  });
});

describe('ScannerModal — image upload & OCR', () => {
  it('SC-06 uses an exact file name hint', async () => {
    render(<ScannerModal onCardDetected={vi.fn()} />);
    upload(imageFile('pikachu.png'));
    expect(await screen.findByLabelText('Tên Pokémon cần xác nhận')).toHaveValue('pikachu');
    expect(mocks.recognizeCardWithOCR).not.toHaveBeenCalled();
  });

  it('SC-07 runs OCR when the file name is unrelated', async () => {
    mocks.recognizeCardWithOCR.mockResolvedValue({
      success: true, rawText: 'Gengar', bestMatch: 'gengar', confidence: 100,
      candidates: [{ name: 'gengar', displayName: 'Gengar', score: 100 }, { name: 'haunter', displayName: 'Haunter', score: 50 }],
    });
    render(<ScannerModal onCardDetected={vi.fn()} />);
    upload(imageFile('anh the bai.png'));
    expect(await screen.findByLabelText('Tên Pokémon cần xác nhận')).toHaveValue('gengar');
    expect(mocks.recognizeCardWithOCR).toHaveBeenCalledTimes(1);
    const group = screen.getByRole('radiogroup', { name: 'Gợi ý từ ảnh' });
    expect(within(group).getByText('Gengar')).toBeInTheDocument();
    expect(within(group).getByText('Haunter')).toBeInTheDocument();
  });

  it('SC-08 resets the input so the same file can be chosen again', async () => {
    render(<ScannerModal onCardDetected={vi.fn()} />);
    const input = upload(imageFile('pikachu.png'));
    expect(input.value).toBe('');
  });

  it('SC-09 reports non-image and broken files', async () => {
    render(<ScannerModal onCardDetected={vi.fn()} />);
    upload(imageFile('notes.txt', 'hello', 'text/plain'));
    expect(screen.getByRole('alert')).toHaveTextContent('không phải là ảnh');
    upload(imageFile('card.png', 'broken'));
    expect(await screen.findByText(/Không đọc được ảnh/)).toBeInTheDocument();
    expect(mocks.recognizeCardWithOCR).not.toHaveBeenCalled();
  });

  it('SC-10 asks for manual input instead of inventing a Pokemon', async () => {
    mocks.recognizeCardWithOCR.mockResolvedValue({ success: false, rawText: '', bestMatch: '', confidence: 0, candidates: [] });
    render(<ScannerModal onCardDetected={vi.fn()} />);
    upload(imageFile('photo.png'));
    expect(await screen.findByText('NHẬP TÊN POKÉMON')).toBeInTheDocument();
    expect(screen.getByLabelText('Tên Pokémon cần xác nhận')).toHaveValue('');
    expect(screen.getByText(/Không đọc được tên Pokémon/)).toBeInTheDocument();
  });

  it('SC-10b OCR exceptions also fall back to manual input', async () => {
    mocks.recognizeCardWithOCR.mockRejectedValue(new Error('boom'));
    render(<ScannerModal onCardDetected={vi.fn()} />);
    upload(imageFile('photo.png'));
    expect(await screen.findByText(/Nhận diện ảnh thất bại/)).toBeInTheDocument();
    expect(screen.getByLabelText('Tên Pokémon cần xác nhận')).not.toHaveValue('pikachu');
  });

  it('SC-11 / SC-17 / SC-18 confirmation panel editing, chips and cancel', async () => {
    mocks.recognizeCardWithOCR.mockResolvedValue({
      success: true, rawText: 'x', bestMatch: 'gengar', confidence: 90,
      candidates: [{ name: 'gengar', displayName: 'Gengar', score: 90 }, { name: 'haunter', displayName: 'Haunter', score: 60 }],
    });
    render(<ScannerModal onCardDetected={vi.fn()} />);
    upload(imageFile('photo.png'));
    const input = await screen.findByLabelText('Tên Pokémon cần xác nhận');
    fireEvent.change(input, { target: { value: '' } });
    expect(screen.getByLabelText('Tên Pokémon cần xác nhận')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Haunter'));
    expect(input).toHaveValue('haunter');
    expect(screen.getByText('Haunter').closest('button').className).toContain('bg-cyan-500');
    fireEvent.click(screen.getByText('Hủy'));
    expect(screen.queryByLabelText('Tên Pokémon cần xác nhận')).toBeNull();
  });
});

describe('ScannerModal — online fetch', () => {
  it('SC-12 fetches and reports the card once', async () => {
    const card = makeCard();
    mocks.fetchPokemonOnline.mockResolvedValue(card);
    const onCardDetected = vi.fn();
    render(<ScannerModal onCardDetected={onCardDetected} />);
    upload(imageFile('charizard.png'));
    fireEvent.click(await screen.findByText('Đúng rồi! Tải Pokémon'));
    await waitFor(() => expect(onCardDetected).toHaveBeenCalledWith(card));
    expect(mocks.fetchPokemonOnline).toHaveBeenCalledWith('charizard');
    expect(screen.queryByLabelText('Tên Pokémon cần xác nhận')).toBeNull();
  });

  it('SC-13 shows the error and re-enables the button', async () => {
    mocks.fetchPokemonOnline.mockRejectedValue(new Error('Không tìm thấy dữ liệu online cho Pokémon "xyz".'));
    render(<ScannerModal onCardDetected={vi.fn()} />);
    fireEvent.change(screen.getByLabelText('Tìm Pokémon theo tên'), { target: { value: 'xyz' } });
    fireEvent.click(screen.getByText('Tải'));
    expect(await screen.findByRole('alert')).toHaveTextContent('Không tìm thấy dữ liệu online');
    expect(screen.getByText('Tải').closest('button')).not.toBeDisabled();
  });

  it('SC-14 ignores extra submits while loading', async () => {
    let resolve;
    mocks.fetchPokemonOnline.mockImplementation(() => new Promise((r) => { resolve = r; }));
    const onCardDetected = vi.fn();
    render(<ScannerModal onCardDetected={onCardDetected} />);
    const input = screen.getByLabelText('Tìm Pokémon theo tên');
    fireEvent.change(input, { target: { value: 'mew' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    fireEvent.keyDown(input, { key: 'Enter' });
    fireEvent.click(screen.getByText('Charizard'));
    expect(screen.getByText('Pikachu').closest('button')).toBeDisabled();
    expect(mocks.fetchPokemonOnline).toHaveBeenCalledTimes(1);
    await act(async () => resolve(makeCard({ id: 'mew', name: 'Mew' })));
    expect(onCardDetected).toHaveBeenCalledTimes(1);
  });

  it('SC-15 / SC-16 manual search via Enter; empty input disables the button', async () => {
    mocks.fetchPokemonOnline.mockResolvedValue(makeCard());
    render(<ScannerModal onCardDetected={vi.fn()} />);
    expect(screen.getByText('Tải').closest('button')).toBeDisabled();
    const input = screen.getByLabelText('Tìm Pokémon theo tên');
    fireEvent.change(input, { target: { value: '   ' } });
    expect(screen.getByText('Tải').closest('button')).toBeDisabled();
    fireEvent.change(input, { target: { value: 'Rayquaza' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    await waitFor(() => expect(mocks.fetchPokemonOnline).toHaveBeenCalledWith('Rayquaza'));
  });
});

describe('ScannerModal — faster access & wrong names', () => {
  it('SC-22 typing shows name suggestions with pictures; tapping one loads it', async () => {
    mocks.fetchPokemonOnline.mockResolvedValue(makeCard({ id: 'pikachu', name: 'Pikachu' }));
    render(<ScannerModal onCardDetected={vi.fn()} />);
    const input = screen.getByLabelText('Tìm Pokémon theo tên');
    await act(async () => {}); // names list loaded
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: 'pika' } });
    const list = await screen.findByRole('listbox', { name: 'Gợi ý tên' });
    const options = within(list).getAllByRole('option');
    expect(options[0]).toHaveTextContent('Pikachu');
    expect(options[0]).toHaveTextContent('#025');
    expect(options[0].querySelector('img').getAttribute('src')).toContain('/25.png');
    fireEvent.click(options[0]);
    await waitFor(() => expect(mocks.fetchPokemonOnline).toHaveBeenCalledWith('pikachu'));
  });

  it('SC-23 recently scanned cards open directly without downloading', () => {
    const onOpenCard = vi.fn();
    const older = makeCard({ id: 'mew', name: 'Mew', lastScannedAt: '2026-09-01T00:00:00Z' });
    const newer = makeCard({ id: 'eevee', name: 'Eevee', lastScannedAt: '2026-09-20T00:00:00Z' });
    render(<ScannerModal onCardDetected={vi.fn()} recentCards={[older, newer]} onOpenCard={onOpenCard} />);
    const section = screen.getByRole('region', { name: 'Pokémon gần đây' });
    const buttons = within(section).getAllByRole('button');
    expect(buttons.map((b) => b.getAttribute('aria-label'))).toEqual(['Mở Eevee', 'Mở Mew']);
    fireEvent.click(buttons[0]);
    expect(onOpenCard).toHaveBeenCalledWith(expect.objectContaining({ id: 'eevee' }));
    expect(mocks.fetchPokemonOnline).not.toHaveBeenCalled();
  });

  it('SC-24 a download can be cancelled and its late result is ignored', async () => {
    let resolve;
    mocks.fetchPokemonOnline.mockImplementation(() => new Promise((r) => { resolve = r; }));
    const onCardDetected = vi.fn();
    render(<ScannerModal onCardDetected={onCardDetected} />);
    upload(imageFile('charizard.png'));
    fireEvent.click(await screen.findByText('Đúng rồi! Tải Pokémon'));
    expect(await screen.findByText(/Đang tải Charizard/)).toBeInTheDocument();
    fireEvent.click(screen.getByText('Hủy tải'));
    expect(screen.getByText('Đúng rồi! Tải Pokémon')).toBeInTheDocument();
    await act(async () => resolve(makeCard()));
    expect(onCardDetected).not.toHaveBeenCalled();
  });

  it('SC-25 "Quét lại" closes a wrong guess and reopens the camera picker', async () => {
    render(<ScannerModal onCardDetected={vi.fn()} />);
    upload(imageFile('pikachu.png'));
    await screen.findByTestId('confirm-panel');
    const picker = document.querySelectorAll('input[type="file"]')[0];
    const click = vi.spyOn(picker, 'click');
    fireEvent.click(screen.getByText('Quét lại'));
    expect(screen.queryByTestId('confirm-panel')).toBeNull();
    expect(click).toHaveBeenCalled();
  });

  it('SC-26 OCR candidates are picture cards the child can choose from', async () => {
    mocks.recognizeCardWithOCR.mockResolvedValue({
      success: true, rawText: 'x', bestMatch: 'gengar', confidence: 90,
      candidates: [{ name: 'gengar', displayName: 'Gengar', score: 90 }, { name: 'haunter', displayName: 'Haunter', score: 60 }],
    });
    render(<ScannerModal onCardDetected={vi.fn()} />);
    await act(async () => {});
    upload(imageFile('photo.png'));
    const group = await screen.findByRole('radiogroup', { name: 'Gợi ý từ ảnh' });
    const [gengar, haunter] = within(group).getAllByRole('radio');
    expect(gengar).toHaveAttribute('aria-checked', 'true');
    expect(gengar.querySelector('img').getAttribute('src')).toContain('/94.png');
    fireEvent.click(haunter);
    expect(haunter).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByText('CÓ PHẢI POKÉMON NÀY KHÔNG?')).toBeInTheDocument();
  });
});