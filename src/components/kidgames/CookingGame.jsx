import React, { useEffect, useRef, useState } from 'react';
import confetti from 'canvas-confetti';
import { Check } from 'lucide-react';
import {
  INGREDIENTS,
  STIR_PER_TAP,
  addIngredient,
  angleDelta,
  createKitchen,
  markCooked,
  nextIngredient,
  serve,
  sessionBerries,
  showHint,
  starsForMistakes,
  stir,
  stirFromAngle,
} from '../../utils/cookingGame';
import { POPULAR_POKEMON } from '../../utils/guessGame';
import { pickCustomers } from '../../utils/kidGamesCommon';
import { sounds } from '../../utils/soundEffects';
import { goldForSession } from '../../utils/gold';
import { playCry } from '../../utils/cries';
import { KidGameShell, Customer, HelperPokemon, FlyingItem, Splash, StarRow, SessionSummary } from './Common';

const T = { enter: 900, fly: 600, cook: 1600, dish: 700, eat: 1500, leave: 700 };

/**
 * "Bếp Pokémon": a customer orders a dish, the child adds the ingredients following the
 * recipe card, stirs by drawing circles on the pot (or tapping), and serves it.
 */
export function CookingGame({ chef, onClose, onBerries, onGold, random = Math.random }) {
  const [kitchen, setKitchen] = useState(() => createKitchen({ random }));
  const [customers, setCustomers] = useState(() => pickCustomers(POPULAR_POKEMON, kitchen.plan.length, chef.name, random));
  const [, force] = useState(0);
  const rerender = () => force((n) => n + 1);

  const [stage, setStage] = useState('enter'); // enter | play | cooking | dish | eating | leave | done
  const [flying, setFlying] = useState(null);
  const [splash, setSplash] = useState(null);
  const [wrong, setWrong] = useState(null);
  const [spoonAngle, setSpoonAngle] = useState(0);
  const [customerHop, setCustomerHop] = useState(0);
  const [hearts, setHearts] = useState(false);
  const [message, setMessage] = useState('');
  const rewarded = useRef(false);

  const areaRef = useRef(null);
  const potRef = useRef(null);
  const customerRef = useRef(null);
  const tileRefs = useRef({});
  const stirRef = useRef(null);
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

  const order = kitchen.order;
  const recipe = order.recipe;
  const customer = customers[kitchen.index] || customers[0];

  // A new customer walks in
  useEffect(() => {
    if (stage !== 'enter') return undefined;
    playCry({ pokedexNumber: customer.pokedexNumber, types: [] });
    const t = setTimeout(() => {
      if (!alive.current) return;
      setMessage('Chạm các nguyên liệu theo thẻ công thức nhé! 👩‍🍳');
      setStage('play');
    }, T.enter);
    return () => clearTimeout(t);
  }, [stage, recipe.name, customer.pokedexNumber]);

  const centerOf = (el) => {
    const area = areaRef.current?.getBoundingClientRect();
    const r = el?.getBoundingClientRect();
    if (!area || !r) return { x: 0, y: 0 };
    return { x: r.left - area.left + r.width / 2, y: r.top - area.top + r.height / 2 };
  };

  const tapIngredient = (id) => {
    if (stage !== 'play' || order.phase !== 'adding' || flying) return;
    const result = addIngredient(kitchen, id);
    if (result === 'wrong') {
      setWrong(id);
      sounds.playScanBeep();
      setMessage(`Chưa đúng rồi! Công thức cần ${INGREDIENTS[nextIngredient(order)].name} cơ.`);
      later(() => setWrong(null), 450);
      rerender();
      return;
    }
    if (result !== 'added') return;
    sounds.playWhoosh();
    const from = centerOf(tileRefs.current[id]);
    const pot = centerOf(potRef.current);
    setFlying({ id, key: order.added.length, from, to: { x: pot.x, y: pot.y - 20 } });
    later(() => {
      setFlying(null);
      setSplash({ at: { x: pot.x, y: pot.y - 20 }, key: order.added.length, color: recipe.color });
      sounds.playPop();
      later(() => setSplash(null), 600);
      setMessage(order.phase === 'stirring' ? 'Giờ khuấy đều nào! Vẽ vòng tròn trên nồi 🌀' : 'Giỏi quá! Tiếp tục nào!');
      rerender();
    }, T.fly);
  };

  const finishStir = () => {
    setStage('cooking');
    setMessage('Đang nấu... xèo xèo!');
    later(() => {
      sounds.playScanBeep();
      markCooked(kitchen);
      setStage('dish');
      setMessage(`Ding! ${recipe.name} xong rồi!`);
      try {
        const r = potRef.current?.getBoundingClientRect();
        confetti({
          particleCount: 60,
          spread: 60,
          origin: r ? { x: (r.left + r.width / 2) / window.innerWidth, y: r.top / window.innerHeight } : { y: 0.5 },
        });
      } catch {
        // ignore
      }
      later(() => {
        setStage('eating');
        sounds.playMunch();
        setCustomerHop((n) => n + 1);
        setHearts(true);
        setMessage('Ngon quá! Cảm ơn bạn nhé! ❤️');
        later(() => {
          setHearts(false);
          setStage('leave');
          later(() => {
            const done = serve(kitchen);
            if (done) {
              setStage('done');
              sounds.playSuccessFanfare();
              if (!rewarded.current) {
                rewarded.current = true;
                const b = sessionBerries(kitchen.results);
                onBerries?.({ oran: Math.ceil(b / 2), razz: Math.floor(b / 2) });
                onGold?.(goldForSession(kitchen.results));
              }
            } else {
              setSpoonAngle(0);
              setStage('enter');
            }
            rerender();
          }, T.leave);
        }, T.eat);
      }, T.dish + 400);
    }, T.cook);
  };

  // Stirring: sweep around the pot centre, or tap it
  const onPotDown = (e) => {
    if (order.phase !== 'stirring' || stage !== 'play') return;
    const c = potRef.current.getBoundingClientRect();
    const cx = c.left + c.width / 2;
    const cy = c.top + c.height / 2;
    stirRef.current = { cx, cy, angle: Math.atan2(e.clientY - cy, e.clientX - cx), moved: 0 };
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };
  const onPotMove = (e) => {
    const s = stirRef.current;
    if (!s || order.phase !== 'stirring') return;
    const angle = Math.atan2(e.clientY - s.cy, e.clientX - s.cx);
    const d = angleDelta(s.angle, angle);
    s.angle = angle;
    s.moved += Math.abs(d);
    setSpoonAngle((a) => a + (d * 180) / Math.PI);
    if (stir(kitchen, stirFromAngle(d))) {
      stirRef.current = null;
      finishStir();
    }
    rerender();
  };
  const onPotUp = () => {
    const s = stirRef.current;
    stirRef.current = null;
    if (!s || order.phase !== 'stirring') return;
    if (s.moved < 0.3) {
      // A tap stirs a little too
      setSpoonAngle((a) => a + 40);
      sounds.playPop();
      if (stir(kitchen, STIR_PER_TAP)) finishStir();
      rerender();
    }
  };

  const replay = () => {
    const k = createKitchen({ random });
    setKitchen(k);
    setCustomers(pickCustomers(POPULAR_POKEMON, k.plan.length, chef.name, random));
    rewarded.current = false;
    setSpoonAngle(0);
    setStage('enter');
  };

  const stars = kitchen.results.reduce((a, r) => a + r.stars, 0);
  const potLevel = order.added.length / recipe.ingredients.length;
  const hinting = showHint(order);
  const next = nextIngredient(order);

  return (
    <KidGameShell
      title="🍳 Bếp Pokémon"
      label="Trò chơi Bếp Pokémon"
      round={stage === 'done' ? kitchen.plan.length : kitchen.index}
      rounds={kitchen.plan.length}
      onClose={onClose}
      background="bg-gradient-to-b from-amber-100 via-orange-50 to-rose-100"
      dataAttrs={{ 'data-stage': stage, 'data-phase': order.phase, 'data-next': next || '', 'data-results': kitchen.results.length }}
    >
      {stage === 'done' ? (
        <SessionSummary
          title="Nhà bếp đóng cửa! 🎉"
          stars={stars}
          maxStars={kitchen.results.length * 3}
          berries={sessionBerries(kitchen.results)}
          gold={goldForSession(kitchen.results)}
          detail={`${chef.name} đã nấu ${kitchen.results.length} món thật ngon!`}
          onReplay={replay}
          onClose={onClose}
        />
      ) : (
        <div ref={areaRef} className="relative">
          {/* Kitchen stage */}
          <div className="relative h-72 sm:h-80 overflow-hidden bg-[linear-gradient(180deg,#fde68a_0%,#fed7aa_62%,#b45309_62%,#92400e_100%)]">
            {/* Tiles on the wall */}
            <div className="absolute inset-x-0 top-0 h-[62%] opacity-30 bg-[linear-gradient(90deg,transparent_48%,#fff_48%,#fff_52%,transparent_52%),linear-gradient(0deg,transparent_48%,#fff_48%,#fff_52%,transparent_52%)] [background-size:40px_40px]" />

            {/* Recipe card */}
            <div className="absolute left-2 top-2 z-10 rounded-2xl bg-white/95 shadow-lg px-3 py-2 max-w-[62%]" aria-label="Công thức">
              <p className="text-xs font-black text-slate-500">CÔNG THỨC</p>
              <p className="text-sm sm:text-base font-black text-slate-800">{recipe.dish} {recipe.name}</p>
              <div className="mt-1 flex flex-wrap gap-1">
                {recipe.ingredients.map((id, i) => {
                  const done = i < order.added.length;
                  const current = i === order.added.length && order.phase === 'adding';
                  return (
                    <span
                      key={id}
                      className={`relative flex items-center justify-center w-9 h-9 rounded-xl text-xl border-2 transition-all duration-300 ${
                        done ? 'bg-emerald-100 border-emerald-400' : current ? 'bg-amber-100 border-amber-400 scale-110' : 'bg-slate-100 border-slate-200'
                      }`}
                      title={INGREDIENTS[id].name}
                    >
                      {INGREDIENTS[id].emoji}
                      {done && <Check className="absolute -right-1 -top-1 w-4 h-4 p-0.5 rounded-full bg-emerald-500 text-white" />}
                    </span>
                  );
                })}
              </div>
            </div>

            <HelperPokemon image={chef.fallbackImage || chef.image} name={chef.name} hat="chef" />

            {/* Pot on the stove */}
            <div
              ref={potRef}
              data-testid="pot"
              onPointerDown={onPotDown}
              onPointerMove={onPotMove}
              onPointerUp={onPotUp}
              onPointerCancel={onPotUp}
              className={`absolute z-10 left-1/2 bottom-6 -translate-x-1/2 w-32 h-24 touch-none ${order.phase === 'stirring' && stage === 'play' ? 'cursor-grab' : ''}`}
            >
              <div className={`relative w-full h-full ${stage === 'cooking' ? 'pot-shake' : ''}`}>
                <div className="absolute inset-x-0 bottom-0 h-20 rounded-b-[45%] rounded-t-lg bg-gradient-to-b from-slate-400 to-slate-600 border-4 border-slate-700 overflow-hidden">
                  {/* Soup level rises with each ingredient */}
                  <div className="absolute inset-x-0 bottom-0 transition-all duration-500 ease-out" style={{ height: `${20 + potLevel * 60}%`, backgroundColor: recipe.color }}>
                    {(order.phase === 'stirring' || stage === 'cooking') &&
                      [15, 40, 65, 85].map((left, i) => (
                        <span key={left} className="pot-bubble absolute bottom-1 w-3 h-3 rounded-full bg-white/60" style={{ left: `${left}%`, animationDelay: `${i * 0.3}s` }} />
                      ))}
                  </div>
                </div>
                <div className="absolute -left-3 bottom-10 w-4 h-3 rounded-full bg-slate-700" />
                <div className="absolute -right-3 bottom-10 w-4 h-3 rounded-full bg-slate-700" />
                {/* Spoon follows the stirring motion */}
                <div className="absolute left-1/2 bottom-8 w-1.5 h-20 -ml-0.5 origin-bottom" style={{ transform: `rotate(${spoonAngle}deg)`, transition: 'transform 80ms linear' }}>
                  <div className="w-full h-full rounded-full bg-amber-700" />
                  <div className="absolute -left-2 -bottom-1 w-5 h-4 rounded-full bg-amber-800" />
                </div>
                {stage === 'cooking' &&
                  [30, 55, 75].map((left, i) => (
                    <span key={left} className="steam-puff absolute -top-2 w-8 h-8 rounded-full bg-white/70 blur-[2px]" style={{ left: `${left}%`, animationDelay: `${i * 0.35}s` }} />
                  ))}
              </div>
              {/* Stirring progress ring */}
              {order.phase === 'stirring' && stage === 'play' && (
                <svg className="absolute -inset-4 w-40 h-32 pointer-events-none" viewBox="0 0 160 128" aria-hidden="true">
                  <ellipse cx="80" cy="64" rx="74" ry="58" fill="none" stroke="rgba(255,255,255,0.6)" strokeWidth="6" />
                  <ellipse cx="80" cy="64" rx="74" ry="58" fill="none" stroke="#22c55e" strokeWidth="6" strokeLinecap="round" pathLength="100" strokeDasharray={`${order.stir * 100} 100`} />
                </svg>
              )}
              {(stage === 'dish' || stage === 'eating') && (
                <span className="dish-pop absolute left-1/2 -top-6 text-6xl drop-shadow-xl" data-testid="dish">
                  {recipe.dish}
                  <span className="sparkle-ring absolute left-1/2 top-1/2 w-16 h-16 rounded-full border-4 border-yellow-300" />
                </span>
              )}
            </div>

            <div ref={customerRef}>
              <Customer
                image={customer.image}
                name={customer.name}
                leaving={stage === 'leave'}
                hop={customerHop}
                bubble={stage !== 'leave' ? (stage === 'eating' ? '😋 Ngon quá!' : <span className="text-2xl">{recipe.dish}</span>) : null}
              />
              {hearts && (
                <span className="float-up absolute right-[18%] top-[30%] text-3xl" aria-hidden="true">
                  ❤️❤️
                </span>
              )}
            </div>

            {stage === 'eating' && (
              <div className="absolute left-1/2 top-[38%] -translate-x-1/2 z-20 px-3 py-1 rounded-2xl bg-white/90 shadow-lg">
                <StarRow stars={starsForMistakes(order.mistakes)} animate />
              </div>
            )}
          </div>

          {/* Message */}
          <p className="px-4 pt-3 text-center text-base sm:text-lg font-black text-slate-800 min-h-[3.5rem]" role="status">
            {stage === 'enter' ? `Cho mình một ${recipe.name} nhé!` : message}
          </p>

          {/* Stir helper button (tapping the pot works too) */}
          {order.phase === 'stirring' && stage === 'play' && (
            <div className="px-4 pb-2 flex justify-center">
              <button
                onClick={() => {
                  setSpoonAngle((a) => a + 40);
                  sounds.playPop();
                  if (stir(kitchen, STIR_PER_TAP)) finishStir();
                  rerender();
                }}
                className="px-6 py-3 rounded-2xl bg-emerald-500 text-white text-lg font-black shadow-lg active:scale-95"
              >
                🥄 Khuấy ({Math.round(order.stir * 100)}%)
              </button>
            </div>
          )}

          {/* Ingredient shelf */}
          <div className="grid grid-cols-4 gap-2 p-3" aria-label="Kệ nguyên liệu">
            {order.shelf.map((id) => {
              const used = order.added.includes(id);
              const glowing = hinting && id === next;
              return (
                <button
                  key={id}
                  ref={(el) => {
                    tileRefs.current[id] = el;
                  }}
                  onClick={() => tapIngredient(id)}
                  disabled={used || order.phase !== 'adding' || stage !== 'play'}
                  aria-label={INGREDIENTS[id].name}
                  className={`relative flex flex-col items-center justify-center py-2 rounded-2xl bg-white border-2 shadow transition-all active:scale-90 disabled:opacity-40 ${
                    wrong === id ? 'wrong-shake border-rose-400' : 'border-orange-200'
                  } ${glowing ? 'hint-glow' : ''}`}
                >
                  <span className="text-3xl sm:text-4xl">{INGREDIENTS[id].emoji}</span>
                  <span className="text-[11px] sm:text-xs font-bold text-slate-600">{INGREDIENTS[id].name}</span>
                </button>
              );
            })}
          </div>

          {flying && (
            <FlyingItem key={flying.key} from={flying.from} to={flying.to} testId="flying-ingredient">
              {INGREDIENTS[flying.id].emoji}
            </FlyingItem>
          )}
          {splash && <Splash key={splash.key} at={splash.at} color={splash.color} />}
        </div>
      )}
    </KidGameShell>
  );
}
