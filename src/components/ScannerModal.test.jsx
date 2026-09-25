import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
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
    expect(await screen.findByText('Chụp Quét Tên Thẻ')).toBeInTheDocument();
    unmount();
    expect(stream.track.stop).toHaveBeenCalled();
  });

  it('SC-05 refuses to OCR before the first video frame', async () => {
    setMediaDevices(vi.fn(() => Promise.resolve(makeStream())));
    render(<ScannerModal onCardDetected={vi.fn()} />);
    fireEvent.click(await screen.findByText('Chụp Quét Tên Thẻ'));
    expect(screen.getByRole('alert')).toHaveTextContent('Camera chưa sẵn sàng');
    expect(mocks.recognizeCardWithOCR).not.toHaveBeenCalled();
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
    expect(screen.getByText('Gengar')).toBeInTheDocument();
    expect(screen.getByText('Haunter')).toBeInTheDocument();
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
    fireEvent.click(await screen.findByText(/Tải Dữ Liệu Online/));
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
    fireEvent.click(screen.getByText('charizard'));
    expect(screen.getByText('pikachu').closest('button')).toBeDisabled();
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
