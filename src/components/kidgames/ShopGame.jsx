import React, { useEffect, useRef, useState } from 'react';
import confetti from 'canvas-confetti';
import {
  PRODUCTS,
  PRODUCT_IDS,
  CUSTOMERS_PER_SESSION,
  addToBasket,
  answerChoices,
  basketMatches,
  describeOrder,
  makeOrder,
  removeFromBasket,
  sessionBerries,
  starsFor,
  totalOf,
} from '../../utils/shopGame';
import { POPULAR_POKEMON } from '../../utils/guessGame';
import { pickCustomers } from '../../utils/kidGamesCommon';
import { sounds } from '../../utils/soundEffects';
import { goldForSession } from '../../utils/gold';
import { playCry } from '../../utils/cries';
import { KidGameShell, Customer, HelperPokemon, FlyingItem, StarRow, SessionSummary } from './Common';

const T = { enter: 900, fly: 600, toPay: 500, paid: 1900, leave: 700 };

// A row of coins, so children can count the price instead of reading numbers
function Coins({ n, size = 'w-4 h-4' }) {
  return (
    <span className="inline-flex flex-wrap gap-0.5 align-middle" aria-label={`${n} xu`}>
      {Array.from({ length: n }).map((_, i) => (
        <span key={i} className={`${size} rounded-full bg-gradient-to-b from-yellow-300 to-amber-500 border border-amber-600 shadow-sm`} />
      ))}
    </span>
  );
}

/**
 * "Cửa hàng Pokémon": customers ask for items; the child fills the basket, then picks the
 * total price (coins drawn next to every item help counting). Difficulty grows per customer.
 */
export function ShopGame({ shopkeeper, onClose, onBerries, onGold, random = Math.random }) {
  const [customers, setCustomers] = useState(() => pickCustomers(POPULAR_POKEMON, CUSTOMERS_PER_SESSION, shopkeeper.name, random));
  const [index, setIndex] = useState(0);
  const [order, setOrder] = useState(() => makeOrder(0, random));
  const [basket, setBasket] = useState({});
  const [stage, setStage] = useState('enter'); // enter | picking | paying | paid | leave | done
  const [choices, setChoices] = useState([]);
  const [mistakes, setMistakes] = useState({ basketMistakes: 0, priceMistakes: 0 });
  const [results, setResults] = useState([]);
  const [flying, setFlying] = useState(null);
  const [wrongChoice, setWrongChoice] = useState(null);
  const [wrongItem, setWrongItem] = useState(null);
  const [hop, setHop] = useState(0);
  const [message, setMessage] = useState('');
  const rewarded = useRef(false);
  const flyId = useRef(0);

  const areaRef = useRef(null);
  const basketRef = useRef(null);
  const tileRefs = useRef({});
  const timers = useRef([]);
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    const pending = timers.current;
    return () => {
      alive.current = false;
      pending.forEach(clearTimeout);
    };
  }, []);
  const later = (fn, ms) => timers.current.push(setTimeout(() => alive.current && fn(), ms));

  const customer = customers[index] || customers[0];
  const total = totalOf(order);

  useEffect(() => {
    if (stage !== 'enter') return undefined;
    playCry({ pokedexNumber: customer.pokedexNumber, types: [] });
    const t = setTimeout(() => {
      if (!alive.current) return;
      setMessage('Chọn đúng món hàng cho vào giỏ nhé! 🧺');
      setStage('picking');
    }, T.enter);
    return () => clearTimeout(t);
  }, [stage, order, customer.pokedexNumber]);

  const centerOf = (el) => {
    const area = areaRef.current?.getBoundingClientRect();
    const r = el?.getBoundingClientRect();
    if (!area || !r) return { x: 0, y: 0 };
    return { x: r.left - area.left + r.width / 2, y: r.top - area.top + r.height / 2 };
  };

  const pick = (id) => {
    if (stage !== 'picking' || flying) return;
    const wanted = order[id] || 0;
    const have = basket[id] || 0;
    if (have >= wanted) {
      // Not asked for, or already enough: gentle nudge, it still counts as a small mistake
      setMistakes((m) => ({ ...m, basketMistakes: m.basketMistakes + 1 }));
      setWrongItem(id);
      sounds.playScanBeep();
      setMessage(wanted === 0 ? `Khách không mua ${PRODUCTS[id].name} đâu!` : `Đủ ${PRODUCTS[id].name} rồi nè!`);
      later(() => setWrongItem(null), 450);
      return;
    }
    sounds.playWhoosh();
    setFlying({ id, key: ++flyId.current, from: centerOf(tileRefs.current[id]), to: centerOf(basketRef.current) });
    later(() => {
      setFlying(null);
      sounds.playPop();
      const next = addToBasket(basket, id);
      setBasket(next);
      if (basketMatches(order, next)) {
        setMessage('Đủ rồi! Tính tiền thôi 🧾');
        later(() => {
          setChoices(answerChoices(total, random));
          setStage('paying');
          setMessage('Tổng cộng bao nhiêu xu? Đếm các đồng xu nhé!');
        }, T.toPay);
      } else {
        setMessage('Tiếp tục nào!');
      }
    }, T.fly);
  };

  const unpick = (id) => {
    if (stage !== 'picking') return;
    setBasket((b) => removeFromBasket(b, id));
  };

  const answer = (value) => {
    if (stage !== 'paying') return;
    if (value !== total) {
      setMistakes((m) => ({ ...m, priceMistakes: m.priceMistakes + 1 }));
      setWrongChoice(value);
      sounds.playScanBeep();
      setMessage('Chưa đúng! Đếm lại các đồng xu vàng nhé 🪙');
      later(() => setWrongChoice(null), 450);
      return;
    }
    const stars = starsFor(mistakes);
    setStage('paid');
    sounds.playCoin();
    setHop((n) => n + 1);
    setMessage(`Đúng rồi, ${total} xu! Cảm ơn bạn nhé! 💕`);
    try {
      confetti({ particleCount: 50, spread: 55, origin: { y: 0.45 }, colors: ['#fde047', '#f59e0b', '#ffffff'] });
    } catch {
      // ignore
    }
    later(() => {
      setStage('leave');
      later(() => {
        const nextResults = [...results, { stars }];
        setResults(nextResults);
        if (index + 1 >= CUSTOMERS_PER_SESSION) {
          setStage('done');
          sounds.playSuccessFanfare();
          if (!rewarded.current) {
            rewarded.current = true;
            const b = sessionBerries(nextResults);
            onBerries?.({ oran: Math.floor(b / 2), razz: Math.ceil(b / 2) });
            onGold?.(goldForSession(nextResults));
          }
          return;
        }
        setIndex(index + 1);
        setOrder(makeOrder(index + 1, random));
        setBasket({});
        setMistakes({ basketMistakes: 0, priceMistakes: 0 });
        setStage('enter');
      }, T.leave);
    }, T.paid);
  };

  const replay = () => {
    setCustomers(pickCustomers(POPULAR_POKEMON, CUSTOMERS_PER_SESSION, shopkeeper.name, random));
    setIndex(0);
    setOrder(makeOrder(0, random));
    setBasket({});
    setMistakes({ basketMistakes: 0, priceMistakes: 0 });
    setResults([]);
    rewarded.current = false;
    setStage('enter');
  };

  const bubble = (
    <span className="flex flex-wrap items-center justify-center gap-1.5 text-2xl">
      {Object.entries(order).map(([id, n]) => (
        <span key={id} className="flex items-center gap-0.5">
          <span className="text-base font-black text-slate-700">{n}×</span>
          {PRODUCTS[id].emoji}
        </span>
      ))}
    </span>
  );

  const totalStars = results.reduce((a, r) => a + r.stars, 0);
  const earned = results.length ? results.length : 0;

  return (
    <KidGameShell
      title="🏪 Cửa hàng Pokémon"
      label="Trò chơi Cửa hàng Pokémon"
      round={stage === 'done' ? CUSTOMERS_PER_SESSION : index}
      rounds={CUSTOMERS_PER_SESSION}
      onClose={onClose}
      background="bg-gradient-to-b from-sky-100 via-white to-emerald-100"
      dataAttrs={{ 'data-stage': stage, 'data-order': JSON.stringify(order), 'data-total': total, 'data-customer': index }}
    >
      {stage === 'done' ? (
        <SessionSummary
          title="Cửa hàng đóng cửa! 🎉"
          stars={totalStars}
          maxStars={results.length * 3}
          berries={sessionBerries(results)}
          gold={goldForSession(results)}
          detail={`${shopkeeper.name} đã bán hàng cho ${earned} vị khách!`}
          onReplay={replay}
          onClose={onClose}
        />
      ) : (
        <div ref={areaRef} className="relative">
          {/* Shop stage with a striped awning */}
          <div className="relative h-72 sm:h-80 overflow-hidden bg-gradient-to-b from-sky-200 to-sky-50">
            <div className="absolute inset-x-0 top-0 h-10 bg-[repeating-linear-gradient(90deg,#ef4444_0_28px,#ffffff_28px_56px)] shadow-md" />
            <div className="absolute inset-x-0 top-10 h-3 bg-[radial-gradient(circle_at_14px_0,#ef4444_12px,transparent_13px)] [background-size:28px_12px]" />
            <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-b from-amber-600 to-amber-800 border-t-4 border-amber-900" />

            <HelperPokemon image={shopkeeper.fallbackImage || shopkeeper.image} name={shopkeeper.name} hat="shop" hop={stage === 'paid' ? hop : 0} />

            {/* Basket on the counter */}
            <div ref={basketRef} data-testid="basket" className="absolute left-1/2 bottom-5 -translate-x-1/2 w-32 min-h-[4.5rem] flex flex-col items-center">
              <div className="flex flex-wrap justify-center gap-0.5 mb-[-6px] z-10 max-w-[8rem]">
                {Object.entries(basket).flatMap(([id, n]) =>
                  Array.from({ length: n }).map((_, i) => (
                    <button key={`${id}-${i}`} onClick={() => unpick(id)} aria-label={`Bỏ ${PRODUCTS[id].name} ra`} className="text-2xl leading-none active:scale-90">
                      {PRODUCTS[id].emoji}
                    </button>
                  ))
                )}
              </div>
              <div className="w-28 h-12 rounded-b-[40%] rounded-t-md bg-[repeating-linear-gradient(45deg,#b45309_0_6px,#d97706_6px_12px)] border-4 border-amber-900" />
            </div>

            {/* Coins fall into the till after paying */}
            {stage === 'paid' && (
              <div className="absolute left-1/2 top-16 -translate-x-1/2 z-20 flex gap-1" data-testid="coin-rain">
                {Array.from({ length: total }).map((_, i) => (
                  <span key={i} className="coin-drop block w-7 h-7 rounded-full bg-gradient-to-b from-yellow-300 to-amber-500 border-2 border-amber-600 shadow" style={{ animationDelay: `${i * 90}ms` }} />
                ))}
              </div>
            )}

            <Customer image={customer.image} name={customer.name} leaving={stage === 'leave'} hop={stage === 'paid' ? hop : 0} bubble={stage !== 'leave' ? bubble : null} />

            {stage === 'paid' && (
              <div className="absolute left-1/2 top-[48%] -translate-x-1/2 z-20 px-3 py-1 rounded-2xl bg-white/90 shadow-lg">
                <StarRow stars={starsFor(mistakes)} animate />
              </div>
            )}
          </div>

          <p className="px-4 pt-3 text-center text-base sm:text-lg font-black text-slate-800 min-h-[3.5rem]" role="status">
            {stage === 'enter' ? `Chào bạn! Mình muốn mua ${describeOrder(order)}.` : message}
          </p>

          {stage === 'paying' || stage === 'paid' ? (
            <div className="px-4 pb-4 space-y-3">
              {/* Receipt with coins to count */}
              <div className="rounded-2xl bg-white shadow p-3 space-y-1.5" aria-label="Hóa đơn">
                {Object.entries(order).map(([id, n]) => (
                  <div key={id} className="flex items-center gap-2 flex-wrap">
                    <span className="text-2xl">{PRODUCTS[id].emoji}</span>
                    <span className="font-black text-slate-700">×{n}</span>
                    {Array.from({ length: n }).map((_, i) => (
                      <Coins key={i} n={PRODUCTS[id].price} />
                    ))}
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-3 gap-3">
                {choices.map((value) => (
                  <button
                    key={value}
                    onClick={() => answer(value)}
                    disabled={stage !== 'paying'}
                    className={`py-4 rounded-2xl text-2xl font-black shadow-lg border-2 active:scale-95 transition-colors ${
                      stage === 'paid' && value === total
                        ? 'bg-emerald-500 text-white border-emerald-300'
                        : wrongChoice === value
                          ? 'wrong-shake bg-rose-100 text-rose-600 border-rose-300'
                          : 'bg-amber-400 text-slate-900 border-amber-200'
                    }`}
                  >
                    {value} xu
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-4 gap-2 p-3" aria-label="Kệ hàng">
              {PRODUCT_IDS.map((id) => (
                <button
                  key={id}
                  ref={(el) => {
                    tileRefs.current[id] = el;
                  }}
                  onClick={() => pick(id)}
                  disabled={stage !== 'picking'}
                  aria-label={`${PRODUCTS[id].name}, ${PRODUCTS[id].price} xu`}
                  className={`flex flex-col items-center gap-0.5 py-2 rounded-2xl bg-white border-2 shadow transition-transform active:scale-90 disabled:opacity-50 ${
                    wrongItem === id ? 'wrong-shake border-rose-400' : 'border-sky-200'
                  }`}
                >
                  <span className="text-3xl sm:text-4xl">{PRODUCTS[id].emoji}</span>
                  <span className="text-[11px] font-bold text-slate-600">{PRODUCTS[id].name}</span>
                  <Coins n={PRODUCTS[id].price} size="w-2.5 h-2.5" />
                </button>
              ))}
            </div>
          )}

          {flying && (
            <FlyingItem key={flying.key} from={flying.from} to={flying.to} testId="flying-product">
              {PRODUCTS[flying.id].emoji}
            </FlyingItem>
          )}
        </div>
      )}
    </KidGameShell>
  );
}
