import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { CookingGame } from './CookingGame';
import { ShopGame } from './ShopGame';
import { INGREDIENTS } from '../../utils/cookingGame';
import { PRODUCTS } from '../../utils/shopGame';
import { sounds } from '../../utils/soundEffects';
import { makeCard } from '../../test/fixtures';

beforeEach(() => {
  vi.useFakeTimers();
  for (const s of ['playPop', 'playWhoosh', 'playScanBeep', 'playMunch', 'playSuccessFanfare', 'playCoin', 'playPokemonCry']) {
    vi.spyOn(sounds, s).mockImplementation(() => {});
  }
});
afterEach(() => vi.useRealTimers());

async function advance(ms) {
  for (let t = 0; t < ms; t += 100) {
    await act(async () => {
      await vi.advanceTimersByTimeAsync(100);
    });
  }
}

// Loop guard: a stuck state fails the test instead of hanging the runner
function guard(counter, label) {
  counter.n += 1;
  if (counter.n > 30) throw new Error(`Stuck in loop: ${label} (stage=${screen.getByRole('dialog').dataset.stage}, phase=${screen.getByRole('dialog').dataset.phase})`);
}

const chef = makeCard({ name: 'Pikachu', id: 'pikachu', pokedexNumber: '025' });
const game = () => screen.getByRole('dialog');

async function cookOneOrder() {
  // Add every ingredient the recipe needs, in order
  const c = { n: 0 };
  while (game().dataset.phase === 'adding') {
    guard(c, 'adding');
    fireEvent.click(screen.getByRole('button', { name: INGREDIENTS[game().dataset.next].name }));
    await advance(700);
  }
  // Stir with the helper button
  const d = { n: 0 };
  while (game().dataset.phase === 'stirring') {
    guard(d, 'stirring');
    fireEvent.click(screen.getByRole('button', { name: /Khuấy/ }));
  }
  await advance(1700 + 1100 + 1500 + 800);
}

describe('CookingGame', () => {
  it('CO-01 a customer orders; wrong ingredients shake and after two a hint glows', async () => {
    render(<CookingGame chef={chef} onClose={vi.fn()} random={() => 0.2} />);
    expect(game().dataset.stage).toBe('enter');
    expect(screen.getByRole('status')).toHaveTextContent(/Cho mình một .+ nhé!/);
    expect(screen.getByTestId('customer')).toBeInTheDocument();
    await advance(1000);
    expect(game().dataset.stage).toBe('play');
    expect(screen.getByLabelText('Công thức')).toBeInTheDocument();

    const next = game().dataset.next;
    const wrongs = screen
      .getAllByRole('button')
      .filter((b) => Object.values(INGREDIENTS).some((i) => i.name === b.getAttribute('aria-label')) && b.getAttribute('aria-label') !== INGREDIENTS[next].name);
    fireEvent.click(wrongs[0]);
    expect(wrongs[0].className).toContain('wrong-shake');
    expect(screen.getByRole('status')).toHaveTextContent(`Công thức cần ${INGREDIENTS[next].name}`);
    fireEvent.click(wrongs[1]);
    expect(screen.getByRole('button', { name: INGREDIENTS[next].name }).className).toContain('hint-glow');
  });

  it('CO-02 correct ingredients fly into the pot, stirring, cooking, serving the next customer', async () => {
    render(<CookingGame chef={chef} onClose={vi.fn()} random={() => 0.2} />);
    await advance(1000);
    const first = game().dataset.next;
    fireEvent.click(screen.getByRole('button', { name: INGREDIENTS[first].name }));
    expect(screen.getByTestId('flying-ingredient')).toHaveTextContent(INGREDIENTS[first].emoji);
    await advance(700);
    expect(screen.queryByTestId('flying-ingredient')).toBeNull();
    expect(screen.getByRole('button', { name: INGREDIENTS[first].name })).toBeDisabled();

    const c = { n: 0 };
    while (game().dataset.phase === 'adding') {
      guard(c, 'adding');
      fireEvent.click(screen.getByRole('button', { name: INGREDIENTS[game().dataset.next].name }));
      await advance(700);
    }
    expect(game().dataset.phase).toBe('stirring');
    expect(screen.getByRole('status')).toHaveTextContent('khuấy');
    const d = { n: 0 };
    while (game().dataset.phase === 'stirring') {
      guard(d, 'stirring');
      fireEvent.click(screen.getByRole('button', { name: /Khuấy/ }));
    }
    expect(game().dataset.stage).toBe('cooking');
    await advance(1700);
    expect(screen.getByTestId('dish')).toBeInTheDocument();
    await advance(1200);
    expect(game().dataset.stage).toBe('eating');
    expect(sounds.playMunch).toHaveBeenCalled();
    expect(screen.getByLabelText('3 sao')).toBeInTheDocument();
    await advance(2400);
    expect(game().dataset.results).toBe('1');
    expect(game().dataset.stage).toBe('enter');
  });

  // Regression: in a real browser the customer's box covered half of the pot, so circles
  // drawn on the pot never reached it (jsdom does no hit-testing, hence this class check)
  it('CO-05 characters never block taps on the pot', async () => {
    render(<CookingGame chef={chef} onClose={vi.fn()} random={() => 0.2} />);
    expect(screen.getByTestId('customer').className).toContain('pointer-events-none');
    expect(screen.getByTestId('helper').className).toContain('pointer-events-none');
    expect(screen.getByTestId('pot').className).toContain('z-10');
  });

  it('CO-03 drawing circles on the pot stirs it', async () => {
    render(<CookingGame chef={chef} onClose={vi.fn()} random={() => 0.2} />);
    await advance(1000);
    const c = { n: 0 };
    while (game().dataset.phase === 'adding') {
      guard(c, 'adding');
      fireEvent.click(screen.getByRole('button', { name: INGREDIENTS[game().dataset.next].name }));
      await advance(700);
    }
    const pot = screen.getByTestId('pot');
    pot.getBoundingClientRect = () => ({ left: 0, top: 0, width: 100, height: 100 });
    fireEvent.pointerDown(pot, { pointerId: 1, clientX: 100, clientY: 50 });
    for (let step = 1; step <= 24 * 3 + 2; step++) {
      const a = (step / 24) * Math.PI * 2;
      fireEvent.pointerMove(pot, { pointerId: 1, clientX: 50 + Math.cos(a) * 50, clientY: 50 + Math.sin(a) * 50 });
    }
    expect(game().dataset.stage).toBe('cooking');
  });

  it('CO-04 a full session ends with a summary and berries, once', async () => {
    const onBerries = vi.fn();
    render(<CookingGame chef={chef} onClose={vi.fn()} onBerries={onBerries} random={() => 0.2} />);
    for (let order = 0; order < 5; order++) {
      await advance(1000);
      await cookOneOrder();
    }
    expect(game().dataset.stage).toBe('done');
    expect(screen.getByText('Nhà bếp đóng cửa! 🎉')).toBeInTheDocument();
    expect(onBerries).toHaveBeenCalledTimes(1);
    expect(onBerries).toHaveBeenCalledWith({ oran: 2, razz: 1 });
    fireEvent.click(screen.getByText('Chơi lại'));
    expect(game().dataset.stage).toBe('enter');
  });
});

describe('ShopGame', () => {
  const order = () => JSON.parse(game().dataset.order);

  async function fillBasket() {
    for (const [id, n] of Object.entries(order())) {
      for (let i = 0; i < n; i++) {
        fireEvent.click(screen.getByRole('button', { name: new RegExp(`^${PRODUCTS[id].name},`) }));
        await advance(700);
      }
    }
    await advance(600);
  }

  it('SG-01 unwanted items are refused; the right basket leads to paying; coins rain on the right answer', async () => {
    render(<ShopGame shopkeeper={chef} onClose={vi.fn()} random={() => 0.3} />);
    expect(screen.getByRole('status')).toHaveTextContent('Mình muốn mua');
    await advance(1000);
    expect(game().dataset.stage).toBe('picking');

    const wanted = Object.keys(order());
    const unwanted = Object.keys(PRODUCTS).find((id) => !wanted.includes(id));
    fireEvent.click(screen.getByRole('button', { name: new RegExp(`^${PRODUCTS[unwanted].name},`) }));
    expect(screen.getByRole('status')).toHaveTextContent('không mua');

    await fillBasket();
    expect(game().dataset.stage).toBe('paying');
    expect(screen.getByLabelText('Hóa đơn')).toBeInTheDocument();
    const total = Number(game().dataset.total);
    const answers = screen.getAllByRole('button').filter((b) => /^\d+ xu$/.test(b.textContent));
    expect(answers).toHaveLength(3);
    const wrong = answers.find((b) => b.textContent !== `${total} xu`);
    fireEvent.click(wrong);
    expect(screen.getByRole('status')).toHaveTextContent('Đếm lại');
    fireEvent.click(answers.find((b) => b.textContent === `${total} xu`));
    expect(game().dataset.stage).toBe('paid');
    expect(sounds.playCoin).toHaveBeenCalled();
    expect(screen.getByTestId('coin-rain').children).toHaveLength(total);
    // One wrong item and one wrong price: 1 star
    expect(screen.getByLabelText('1 sao')).toBeInTheDocument();
    await advance(2800);
    expect(game().dataset.customer).toBe('1');
    expect(game().dataset.stage).toBe('enter');
  });

  it('SG-02 items can be taken back out of the basket', async () => {
    render(<ShopGame shopkeeper={chef} onClose={vi.fn()} random={() => 0.3} />);
    await advance(1000);
    const [id, n] = Object.entries(order())[0];
    if (n < 2) return; // the first customer asks for at least one item
    fireEvent.click(screen.getByRole('button', { name: new RegExp(`^${PRODUCTS[id].name},`) }));
    await advance(700);
    fireEvent.click(screen.getByRole('button', { name: `Bỏ ${PRODUCTS[id].name} ra` }));
    expect(screen.queryByRole('button', { name: `Bỏ ${PRODUCTS[id].name} ra` })).toBeNull();
  });

  it('SG-03 six customers end the day with a summary and berries, once', async () => {
    const onBerries = vi.fn();
    render(<ShopGame shopkeeper={chef} onClose={vi.fn()} onBerries={onBerries} random={() => 0.3} />);
    for (let c = 0; c < 6; c++) {
      await advance(1000);
      await fillBasket();
      const total = Number(game().dataset.total);
      fireEvent.click(screen.getAllByRole('button').find((b) => b.textContent === `${total} xu`));
      await advance(2800);
    }
    expect(game().dataset.stage).toBe('done');
    expect(screen.getByText('Cửa hàng đóng cửa! 🎉')).toBeInTheDocument();
    expect(onBerries).toHaveBeenCalledTimes(1);
    expect(onBerries).toHaveBeenCalledWith({ oran: 1, razz: 2 });
  });
});
