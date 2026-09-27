import React, { useEffect, useRef, useState } from 'react';
import confetti from 'canvas-confetti';
import { mathStars } from '../../utils/logic/math';
import { MATH_TOPICS, MATH_LEVELS, makeTopicLesson, lessonId, POKE_DEX } from '../../utils/logic/mathTopics';
import { getProgress, recordStars, goldForLevel } from '../../utils/progress';
import { artworkUrl } from '../../services/pokemonOnlineService';
import { sounds } from '../../utils/soundEffects';
import { speak } from '../../utils/speech';
import { KidGameShell, SessionSummary, Splash, StarRow } from '../kidgames/Common';
import { useLater } from '../sports/sportsKit';
import { Ball } from '../icons/PokeIcons';

const GAME = 'math';
const LEVEL_KEY = 'pokescan_math_level';
const BALLOONS = ['from-rose-400 to-pink-600', 'from-sky-400 to-blue-600', 'from-amber-300 to-orange-500', 'from-emerald-400 to-teal-600'];
const COUNT_STEP = 380; // ms between numbers while counting aloud
const COUNTABLE = ['things', 'add', 'sub'];

const readLevel = () => {
  try {
    const id = localStorage.getItem(LEVEL_KEY);
    return MATH_LEVELS.some((l) => l.id === id) ? id : 'easy';
  } catch {
    return 'easy';
  }
};

function Thing({ emoji, index, badge, gone, flyDelay, small }) {
  return (
    <span
      className={`relative inline-flex items-center justify-center ${small ? 'w-8 h-8 text-2xl' : 'w-11 h-11 sm:w-12 sm:h-12 text-4xl sm:text-[2.6rem]'} ${gone ? 'fly-away' : 'pop-in'}`}
      style={gone ? { animationDelay: `${flyDelay}ms`, '--fx': '-90px' } : { animationDelay: `${index * 70}ms` }}
      data-testid="math-thing"
    >
      {emoji}
      {badge != null && <span className="star-pop absolute -top-2 -right-2 w-6 h-6 rounded-full bg-indigo-600 text-white text-sm font-black flex items-center justify-center shadow">{badge}</span>}
    </span>
  );
}

const Tray = ({ children, className = '' }) => <div className={`flex flex-wrap justify-center p-2 rounded-3xl bg-white/70 shadow-inner ${className}`}>{children}</div>;

function ClockFace({ h, m }) {
  const hourAng = ((h % 12) + m / 60) * 30;
  const minAng = m * 6;
  return (
    <svg viewBox="0 0 120 120" className="w-44 h-44 drop-shadow-xl pop-in" aria-hidden="true">
      <circle cx="60" cy="60" r="56" fill="#ffffff" stroke="#ef4444" strokeWidth="6" />
      <path d="M4 60a56 56 0 0 1 112 0" fill="#fee2e2" opacity="0.6" />
      {Array.from({ length: 12 }, (_, i) => {
        const a = ((i + 1) * 30 - 90) * (Math.PI / 180);
        return (
          <text key={i} x={60 + Math.cos(a) * 42} y={60 + Math.sin(a) * 42 + 5} fontSize="13" fontWeight="900" textAnchor="middle" fill="#1e293b">
            {i + 1}
          </text>
        );
      })}
      {Array.from({ length: 60 }, (_, i) => {
        const a = (i * 6 - 90) * (Math.PI / 180);
        const r1 = i % 5 ? 51 : 48;
        return <line key={i} x1={60 + Math.cos(a) * r1} y1={60 + Math.sin(a) * r1} x2={60 + Math.cos(a) * 53} y2={60 + Math.sin(a) * 53} stroke="#94a3b8" strokeWidth={i % 5 ? 1 : 2} />;
      })}
      <line x1="60" y1="60" x2="60" y2="30" stroke="#1e3a8a" strokeWidth="6" strokeLinecap="round" transform={`rotate(${hourAng} 60 60)`} />
      <line x1="60" y1="60" x2="60" y2="16" stroke="#ef4444" strokeWidth="3.5" strokeLinecap="round" transform={`rotate(${minAng} 60 60)`} />
      <Ball x={60} y={60} r={7} />
    </svg>
  );
}

function Coin({ value, i }) {
  const size = { 1: 44, 2: 50, 5: 56, 10: 64 }[value];
  return (
    <span className="pop-in inline-flex items-center justify-center rounded-full font-black text-amber-900 shadow-lg border-4 border-amber-600 bg-gradient-to-br from-yellow-200 via-amber-300 to-amber-500" style={{ width: size, height: size, fontSize: size * 0.38, animationDelay: `${i * 90}ms` }}>
      {value}
    </span>
  );
}

function Polygon({ sides, color, i }) {
  const pts = Array.from({ length: sides }, (_, k) => {
    const a = (k / sides) * Math.PI * 2 - Math.PI / 2;
    return [50 + Math.cos(a) * 40, 52 + Math.sin(a) * 40];
  });
  return (
    <svg viewBox="0 0 100 100" className="w-32 h-32 pop-in drop-shadow-lg" style={{ animationDelay: `${i * 120}ms` }} aria-hidden="true">
      <polygon points={pts.map((p) => p.join(',')).join(' ')} fill={color} stroke="#1e293b" strokeWidth="3" strokeLinejoin="round" />
      {pts.map(([x, y], k) => (
        <circle key={k} cx={x} cy={y} r="4.5" fill="#fde047" stroke="#1e293b" strokeWidth="1.5" />
      ))}
    </svg>
  );
}

/** What each kind of question shows. */
function MathVisual({ q, eaten, counted, player }) {
  const v = q.visual;
  const badge = (i, countable) => (i < countable && i < counted ? i + 1 : null);
  switch (v.type) {
    case 'things': {
      const small = v.total > 12;
      return <Tray className="max-w-[330px]">{Array.from({ length: v.total }, (_, i) => <Thing key={i} emoji={v.thing} index={i} small={small} badge={badge(i, v.total)} />)}</Tray>;
    }
    case 'add':
      return (
        <div className="flex items-center gap-2 flex-wrap justify-center">
          <Tray className="max-w-[160px]">{Array.from({ length: v.a }, (_, i) => <Thing key={i} emoji={v.thing} index={i} small={v.a + v.b > 12} badge={badge(i, v.a + v.b)} />)}</Tray>
          <span className="text-5xl font-black text-rose-500">+</span>
          <Tray className="max-w-[160px]">{Array.from({ length: v.b }, (_, j) => <Thing key={j} emoji={v.thing} index={v.a + j} small={v.a + v.b > 12} badge={badge(v.a + j, v.a + v.b)} />)}</Tray>
        </div>
      );
    case 'sub':
      return (
        <Tray className="max-w-[330px]">
          {Array.from({ length: v.a }, (_, i) => {
            const gone = eaten && i >= v.a - v.b;
            return gone ? (
              <span key={i} className="relative inline-flex w-11 h-11">
                <Thing emoji={v.thing} index={i} gone flyDelay={(i - (v.a - v.b)) * 120} small={v.a > 12} />
                <span className="absolute inset-1 rounded-full border-2 border-dashed border-slate-300" />
              </span>
            ) : (
              <Thing key={i} emoji={v.thing} index={i} small={v.a > 12} badge={badge(i, v.a - v.b)} />
            );
          })}
        </Tray>
      );
    case 'groups':
      return (
        <div className="flex flex-wrap justify-center gap-2">
          {Array.from({ length: v.groups }, (_, g) => (
            <div key={g} className="pop-in relative flex flex-wrap justify-center w-[92px] p-1.5 rounded-2xl bg-white/80 border-2 border-dashed border-fuchsia-300 shadow" style={{ animationDelay: `${g * 120}ms` }}>
              <span className="absolute -top-2 -left-2 w-6 h-6 rounded-full bg-fuchsia-500 text-white text-xs font-black flex items-center justify-center">{g + 1}</span>
              {Array.from({ length: v.each }, (_, i) => <Thing key={i} emoji={v.thing} index={i} small />)}
            </div>
          ))}
        </div>
      );
    case 'share':
      return (
        <div className="flex flex-col items-center gap-2">
          <Tray className="max-w-[330px]">{Array.from({ length: v.total }, (_, i) => <Thing key={i} emoji={v.thing} index={i} small />)}</Tray>
          <div className="flex gap-2">
            {Array.from({ length: v.by }, (_, i) => (
              <span key={i} className="pop-in flex flex-col items-center" style={{ animationDelay: `${300 + i * 100}ms` }}>
                <img src={player.image} alt="" className="w-12 h-12 object-contain sport-bob" />
                <span className="w-12 h-3 rounded-full bg-white/80 shadow" />
              </span>
            ))}
          </div>
        </div>
      );
    case 'compare':
      return (
        <div className="flex items-center gap-3">
          <Tray className="max-w-[130px] min-h-[60px]">{Array.from({ length: v.lv }, (_, i) => <Thing key={i} emoji={v.thing} index={i} small />)}</Tray>
          <span className="w-14 h-14 rounded-2xl bg-white shadow-inner flex items-center justify-center text-3xl font-black text-lime-600">?</span>
          <Tray className="max-w-[130px] min-h-[60px]">{Array.from({ length: v.rv }, (_, i) => <Thing key={i} emoji={v.thing} index={i} small />)}</Tray>
        </div>
      );
    case 'sequence':
      return (
        <div className="flex flex-wrap items-center justify-center gap-1">
          {v.seq.map((n, i) => (
            <React.Fragment key={i}>
              {i > 0 && <span className="text-xl font-black text-teal-500">›</span>}
              <span className={`pop-in w-14 h-14 rounded-full flex items-center justify-center text-xl font-black shadow-lg ${i === v.gap ? 'bg-gradient-to-b from-amber-300 to-orange-500 text-white ring-4 ring-amber-200 hint-pulse' : 'bg-white text-teal-700'}`} style={{ animationDelay: `${i * 100}ms` }}>
                {i === v.gap ? '?' : n}
              </span>
            </React.Fragment>
          ))}
        </div>
      );
    case 'coins':
      return <div className="flex flex-wrap items-center justify-center gap-2 p-3 rounded-3xl bg-white/60 shadow-inner max-w-[330px]">{v.coins.map((c, i) => <Coin key={i} value={c} i={i} />)}</div>;
    case 'shop':
      return (
        <div className="flex items-center gap-4">
          <span className="pop-in relative flex flex-col items-center">
            <span className="text-6xl">🍭</span>
            <span className="px-2 py-0.5 rounded-lg bg-rose-500 text-white text-sm font-black shadow">{v.price} xu</span>
          </span>
          <span className="text-3xl">👉</span>
          <Coin value={10} i={0} />
          {v.paid === 20 && <Coin value={10} i={1} />}
        </div>
      );
    case 'clock':
      return <ClockFace h={v.h} m={v.m} />;
    case 'shapes':
      return <div className="flex gap-3">{v.list.map((s, i) => <Polygon key={i} sides={s} i={i} color={['#60a5fa', '#f472b6', '#34d399'][i % 3]} />)}</div>;
    case 'story':
      return <img src={artworkUrl(POKE_DEX[v.who] || 25)} alt={v.who} className="w-36 h-36 object-contain drop-shadow-xl poke-hop" />;
    default:
      return <div className="pop-in px-6 py-4 rounded-3xl bg-white shadow-xl text-4xl sm:text-5xl font-black text-indigo-700 tracking-wide whitespace-nowrap">{v.text}</div>;
  }
}

/** Kinds of maths and difficulty, with the stars won in each. */
function Menu({ level, setLevel, progress, onPlay, player }) {
  return (
    <div className="px-4 pt-3 pb-5 space-y-3" data-testid="math-menu">
      <div className="flex items-center gap-2">
        <img src={player.image} alt={player.name} className="w-14 h-14 object-contain sport-bob" />
        <p className="bubble-pop flex-1 px-3 py-2 rounded-2xl bg-white/90 text-sm font-black text-indigo-700 shadow">Hôm nay mình học loại toán nào nhỉ? 🧮</p>
      </div>
      <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Độ khó toán">
        {MATH_LEVELS.map((l) => (
          <button
            key={l.id}
            role="radio"
            aria-checked={level === l.id}
            aria-label={l.label}
            onClick={() => setLevel(l.id)}
            className={`py-2 rounded-2xl font-black transition-all active:scale-95 ${level === l.id ? 'bg-gradient-to-b from-amber-300 to-orange-500 text-white scale-105 shadow-lg' : 'bg-white/80 text-slate-600'}`}
          >
            {l.icon} {l.label}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-3 gap-2">
        {MATH_TOPICS.map((t, i) => (
          <button
            key={t.id}
            onClick={() => onPlay(t.id)}
            aria-label={`Toán ${t.title}`}
            className={`pop-in flex flex-col items-center gap-0.5 p-2 rounded-2xl bg-gradient-to-br ${t.color} text-white shadow-lg active:scale-95`}
            style={{ animationDelay: `${i * 40}ms` }}
          >
            <span className="text-3xl leading-none drop-shadow">{t.icon}</span>
            <span className="text-xs font-black leading-tight text-center">{t.title}</span>
            <StarRow stars={Number(progress[lessonId(t.id, level)]) || 0} size="w-3 h-3" />
          </button>
        ))}
      </div>
    </div>
  );
}

/**
 * "Pokémon làm toán": 12 kinds of maths (counting, adding, taking away, comparing, missing
 * numbers, number patterns, times, sharing, coins, clocks, shapes, stories) in three levels.
 * Answers are balloons; a wrong answer counts aloud (pictures) or shows a hint.
 */
export function MathGame({ player, onClose, onGold, random = Math.random }) {
  const [screen, setScreen] = useState('menu'); // menu | play | done
  const [level, setLevelState] = useState(readLevel);
  const [progress, setProgress] = useState(() => getProgress(GAME));
  const [topic, setTopic] = useState(null);
  const [lesson, setLesson] = useState([]);
  const [index, setIndex] = useState(0);
  const [mistakes, setMistakes] = useState(0);
  const [picked, setPicked] = useState(null); // { value, correct }
  const [counted, setCounted] = useState(0);
  const [eaten, setEaten] = useState(false);
  const [hop, setHop] = useState(0);
  const [splash, setSplash] = useState(null);
  const [reward, setReward] = useState(null);
  const paid = useRef(false);
  const later = useLater();
  const q = lesson[index];

  const setLevel = (id) => {
    setLevelState(id);
    try {
      localStorage.setItem(LEVEL_KEY, id);
    } catch {
      // ignore
    }
  };

  const start = (t) => {
    paid.current = false;
    setTopic(t);
    setLesson(makeTopicLesson(t, level, random));
    setIndex(0);
    setMistakes(0);
    setPicked(null);
    setCounted(0);
    setEaten(false);
    setReward(null);
    setScreen('play');
  };

  // Read the question; in a take-away the Pokemon eats some pictures after a moment
  useEffect(() => {
    if (screen !== 'play' || !q) return undefined;
    speak(q.say, { lang: 'vi-VN', rate: 0.9 });
    if (q.visual.type !== 'sub') return undefined;
    const t = setTimeout(() => {
      setEaten(true);
      setHop((h) => h + 1);
      sounds.playMunch();
    }, 1100);
    return () => clearTimeout(t);
  }, [q, screen]);

  const countable = !q ? 0 : q.visual.type === 'sub' ? q.visual.a - q.visual.b : q.visual.type === 'add' ? q.visual.a + q.visual.b : q.visual.type === 'things' ? q.visual.total : 0;
  const canCount = q && COUNTABLE.includes(q.visual.type);

  const countAloud = (then) => {
    for (let i = 1; i <= countable; i++) {
      later(() => {
        setCounted(i);
        sounds.playNote(261.63 * Math.pow(2, ((i - 1) % 12) / 6), { duration: 0.3, volume: 0.16 });
      }, i * COUNT_STEP);
    }
    later(then, countable * COUNT_STEP + 500);
  };

  const finish = (m) => {
    setScreen('done');
    const stars = mathStars(m);
    if (!paid.current) {
      paid.current = true;
      const saved = recordStars(GAME, lessonId(topic, level), stars);
      setProgress(saved.progress);
      const gold = goldForLevel(stars, saved.improved);
      setReward(gold);
      onGold?.(gold);
    }
    try {
      confetti({ particleCount: 110, spread: 80, origin: { y: 0.5 }, zIndex: 9999 });
    } catch {
      // decoration
    }
  };

  const next = () => {
    if (index + 1 >= lesson.length) {
      finish(mistakes);
      return;
    }
    setIndex((i) => i + 1);
    setPicked(null);
    setCounted(0);
    setEaten(false);
  };

  const choose = (value, e) => {
    if (picked?.correct || (q.visual.type === 'sub' && !eaten)) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const stage = e.currentTarget.closest('[data-testid="math-stage"]')?.getBoundingClientRect() || { left: 0, top: 0 };
    if (value === q.answer) {
      setPicked({ value, correct: true });
      setSplash((old) => ({ at: { x: rect.left - stage.left + rect.width / 2, y: rect.top - stage.top + rect.height / 2 }, key: (old?.key || 0) + 1 }));
      setHop((h) => h + 1);
      sounds.playPop();
      sounds.playSuccessFanfare();
      speak(`Đúng rồi! ${q.answer}`, { lang: 'vi-VN' });
      if (canCount) countAloud(next);
      else later(next, 1300);
    } else {
      setPicked({ value, correct: false });
      setMistakes((m) => m + 1);
      sounds.playOops();
      speak(canCount ? 'Mình cùng đếm nhé!' : q.hint, { lang: 'vi-VN' });
      if (canCount) {
        setCounted(0);
        countAloud(() => setPicked((p) => (p && !p.correct ? null : p)));
      } else later(() => setPicked((p) => (p && !p.correct ? null : p)), 1600);
    }
  };

  const stars = mathStars(mistakes);
  const topicInfo = MATH_TOPICS.find((t) => t.id === topic);
  const levelInfo = MATH_LEVELS.find((l) => l.id === level);
  const wide = q && q.choices.some((c) => String(c).length > 3);

  return (
    <KidGameShell
      title="🔢 Làm toán"
      label="Pokémon làm toán"
      round={screen === 'done' ? lesson.length : screen === 'play' ? index : 0}
      rounds={screen === 'menu' ? 1 : lesson.length}
      onClose={onClose}
      background="bg-gradient-to-b from-sky-200 via-indigo-100 to-pink-100"
      dataAttrs={{ 'data-screen': screen, 'data-question': index, 'data-done': screen === 'done', 'data-kind': q?.kind || '' }}
    >
      {screen === 'menu' && <Menu level={level} setLevel={setLevel} progress={progress} onPlay={start} player={player} />}
      {screen === 'done' && (
        <SessionSummary
          title="Giỏi quá! 🎉"
          stars={stars}
          maxStars={3}
          gold={reward ?? 0}
          detail={`${topicInfo?.icon} ${topicInfo?.title} · ${levelInfo?.label} · ${mistakes === 0 ? 'Không sai câu nào!' : `sai ${mistakes} lần`}`}
          onReplay={() => setScreen('menu')}
          onClose={onClose}
        />
      )}
      {screen === 'play' && q && (
        <div className="relative px-4 pt-3 pb-5 min-h-[540px] flex flex-col" data-testid="math-stage">
          <div className="flex items-center justify-between">
            <button onClick={() => setScreen('menu')} className="px-2.5 py-1 rounded-full bg-white/80 text-xs font-black text-slate-600 shadow" aria-label="Về chọn bài">
              ← Bài
            </button>
            <span className="px-3 py-1 rounded-full bg-white/80 text-xs font-black text-indigo-700 shadow">
              {topicInfo.icon} {topicInfo.title} · {levelInfo.icon} {levelInfo.label}
            </span>
          </div>
          {/* The Pokemon asks the question */}
          <div className="mt-1 flex items-end gap-2">
            <img key={`hop-${hop}`} src={player.image} alt={player.name} draggable={false} className={`w-20 h-20 object-contain drop-shadow-lg scale-x-[-1] ${hop ? 'poke-hop' : 'sport-bob'}`} />
            <div key={`q-${index}`} className="bubble-pop relative mb-5 flex-1 px-4 py-2.5 rounded-3xl bg-white shadow-lg">
              <p className={`${q.text.length > 26 ? 'text-base' : 'text-3xl'} font-black text-indigo-700 tracking-wide`} data-testid="math-question">
                {q.text}
              </p>
              <span className="absolute -left-2 bottom-3 w-4 h-4 rotate-45 bg-white" />
            </div>
          </div>

          <div key={`vis-${index}`} className="mt-1 flex-1 flex items-center justify-center min-h-[180px]">
            <MathVisual q={q} eaten={eaten} counted={counted} player={player} />
          </div>
          {q.visual.type === 'sub' && (
            <p className="text-center text-sm font-bold text-slate-600 mb-1">{eaten ? `${player.name} ăn mất ${q.visual.b} rồi! Còn lại mấy?` : `${player.name} đang đói bụng…`}</p>
          )}

          {/* Answers: balloons (wide pills for clock answers) */}
          <div className={`grid gap-3 mt-2 ${wide ? 'grid-cols-1' : q.choices.length === 4 ? 'grid-cols-4' : 'grid-cols-3'}`} role="group" aria-label="Chọn đáp án">
            {q.choices.map((n, i) => {
              const state = picked?.value === n ? (picked.correct ? 'right' : 'wrong') : null;
              return (
                <button
                  key={`${index}-${n}`}
                  onClick={(e) => choose(n, e)}
                  aria-label={`Đáp án ${n}`}
                  className={`relative mx-auto flex flex-col items-center ${wide ? 'w-full' : 'w-20 h-28'} ${state === 'right' ? 'dish-pop' : state === 'wrong' ? 'wrong-shake' : 'balloon-float'}`}
                  style={{ animationDelay: state ? '0ms' : `${i * 300}ms` }}
                >
                  <span
                    className={`${wide ? 'w-full py-3 rounded-full text-2xl' : `${q.choices.length === 4 ? 'w-16 h-20 text-3xl' : 'w-20 h-24 text-5xl'} rounded-[50%]`} bg-gradient-to-br ${BALLOONS[i % BALLOONS.length]} shadow-lg flex items-center justify-center font-black text-white ring-4 ${state === 'right' ? 'ring-emerald-300' : state === 'wrong' ? 'ring-rose-300 opacity-60' : 'ring-white/60'}`}
                  >
                    {n}
                  </span>
                  {!wide && <span className="w-0.5 h-4 bg-slate-400" />}
                </button>
              );
            })}
          </div>
          {picked?.correct && (
            <p role="status" className="bubble-pop mt-2 text-center text-2xl font-black text-emerald-600">
              Đúng rồi! {q.answer} ⭐
            </p>
          )}
          {picked && !picked.correct && (
            <p role="status" className="bubble-pop mt-2 text-center text-lg font-black text-rose-500">
              {canCount ? 'Chưa đúng, mình cùng đếm nhé! 👆' : `Gợi ý: ${q.hint} 💡`}
            </p>
          )}
          {splash && <Splash key={splash.key} at={splash.at} color="#fde047" count={14} />}
        </div>
      )}
    </KidGameShell>
  );
}
