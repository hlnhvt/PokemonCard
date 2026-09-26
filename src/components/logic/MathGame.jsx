import React, { useEffect, useRef, useState } from 'react';
import confetti from 'canvas-confetti';
import { makeMathLesson, mathStars } from '../../utils/logic/math';
import { goldForStars } from '../../utils/gold';
import { sounds } from '../../utils/soundEffects';
import { speak } from '../../utils/speech';
import { KidGameShell, SessionSummary, Splash } from '../kidgames/Common';
import { useLater } from '../sports/sportsKit';

const NUMBER_WORDS = ['không', 'một', 'hai', 'ba', 'bốn', 'năm', 'sáu', 'bảy', 'tám', 'chín', 'mười', 'mười một', 'mười hai'];
const BALLOONS = ['from-rose-400 to-pink-600', 'from-sky-400 to-blue-600', 'from-amber-300 to-orange-500'];
const COUNT_STEP = 380; // ms between numbers while counting aloud

function Thing({ emoji, index, badge, gone, flyDelay }) {
  return (
    <span
      className={`relative inline-flex items-center justify-center w-11 h-11 sm:w-12 sm:h-12 text-4xl sm:text-[2.6rem] ${gone ? 'fly-away' : 'pop-in'}`}
      style={gone ? { animationDelay: `${flyDelay}ms`, '--fx': '-90px' } : { animationDelay: `${index * 90}ms` }}
      data-testid="math-thing"
    >
      {emoji}
      {badge != null && (
        <span className="star-pop absolute -top-2 -right-2 w-6 h-6 rounded-full bg-indigo-600 text-white text-sm font-black flex items-center justify-center shadow">
          {badge}
        </span>
      )}
    </span>
  );
}

/**
 * "Pokémon làm toán": count pictures, then add and take away (numbers up to 10).
 * Answers are balloons; a wrong one makes the Pokemon count the pictures aloud as a hint.
 */
export function MathGame({ player, onClose, onGold, random = Math.random }) {
  const [lesson, setLesson] = useState(() => makeMathLesson(random));
  const [index, setIndex] = useState(0);
  const [mistakes, setMistakes] = useState(0);
  const [picked, setPicked] = useState(null); // { value, correct }
  const [counted, setCounted] = useState(0); // numbers shown on the pictures so far
  const [eaten, setEaten] = useState(false); // take-away pictures have flown to the Pokemon
  const [hop, setHop] = useState(0);
  const [splash, setSplash] = useState(null);
  const [done, setDone] = useState(false);
  const paid = useRef(false);
  const later = useLater();
  const q = lesson[index];

  // Read the question; in a take-away the Pokemon eats some pictures after a moment
  useEffect(() => {
    if (done) return undefined;
    speak(q.kind === 'count' ? 'Có bao nhiêu hình?' : q.kind === 'add' ? `${NUMBER_WORDS[q.a]} cộng ${NUMBER_WORDS[q.b]} bằng mấy?` : `${NUMBER_WORDS[q.a]} bớt ${NUMBER_WORDS[q.b]} còn mấy?`, { lang: 'vi-VN', rate: 0.9 });
    if (q.kind !== 'sub') return undefined;
    const t = setTimeout(() => {
      setEaten(true);
      setHop((h) => h + 1);
      sounds.playMunch();
    }, 1100);
    return () => clearTimeout(t);
  }, [q, done]);

  // Pictures still there (what the answer counts)
  const total = q.kind === 'add' ? q.a + q.b : q.a;
  const countable = q.kind === 'sub' ? q.a - q.b : total;

  const countAloud = (then) => {
    for (let i = 1; i <= countable; i++) {
      later(() => {
        setCounted(i);
        sounds.playNote(261.63 * Math.pow(2, (i - 1) / 12 * 2), { duration: 0.35, volume: 0.18 });
      }, i * COUNT_STEP);
    }
    later(then, countable * COUNT_STEP + 500);
  };

  const choose = (value, e) => {
    if (picked?.correct || (q.kind === 'sub' && !eaten)) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const stage = e.currentTarget.closest('[data-testid="math-stage"]')?.getBoundingClientRect() || { left: 0, top: 0 };
    if (value === q.answer) {
      setPicked({ value, correct: true });
      setSplash((old) => ({ at: { x: rect.left - stage.left + rect.width / 2, y: rect.top - stage.top + rect.height / 2 }, key: (old?.key || 0) + 1 }));
      setHop((h) => h + 1);
      sounds.playPop();
      sounds.playSuccessFanfare();
      speak(`Đúng rồi! ${NUMBER_WORDS[q.answer]}`, { lang: 'vi-VN' });
      countAloud(() => {
        if (index + 1 >= lesson.length) {
          finish();
          return;
        }
        setIndex((i) => i + 1);
        setPicked(null);
        setCounted(0);
        setEaten(false);
      });
    } else {
      setPicked({ value, correct: false });
      setMistakes((m) => m + 1);
      sounds.playOops();
      speak('Mình cùng đếm nhé!', { lang: 'vi-VN' });
      setCounted(0);
      countAloud(() => setPicked((p) => (p && !p.correct ? null : p)));
    }
  };

  const finish = () => {
    setDone(true);
    const stars = mathStars(mistakes);
    if (!paid.current) {
      paid.current = true;
      onGold?.(goldForStars(stars));
    }
    try {
      confetti({ particleCount: 110, spread: 80, origin: { y: 0.5 }, zIndex: 9999 });
    } catch {
      // decoration
    }
  };

  const replay = () => {
    paid.current = false;
    setLesson(makeMathLesson(random));
    setIndex(0);
    setMistakes(0);
    setPicked(null);
    setCounted(0);
    setEaten(false);
    setDone(false);
  };

  // Numbers shown on pictures while counting: only on the ones still there
  const badgeFor = (i) => (i < countable && i < counted ? i + 1 : null);
  const things = Array.from({ length: total }, (_, i) => i);
  const stars = mathStars(mistakes);

  return (
    <KidGameShell
      title="🔢 Pokémon làm toán"
      label="Pokémon làm toán"
      round={done ? lesson.length : index}
      rounds={lesson.length}
      onClose={onClose}
      background="bg-gradient-to-b from-sky-200 via-indigo-100 to-pink-100"
      dataAttrs={{ 'data-question': index, 'data-done': done }}
    >
      {done ? (
        <SessionSummary
          title="Giỏi quá! 🎉"
          stars={stars}
          maxStars={3}
          gold={goldForStars(stars)}
          detail={mistakes === 0 ? 'Không sai câu nào!' : `Bé làm xong ${lesson.length} bài toán`}
          onReplay={replay}
          onClose={onClose}
        />
      ) : (
        <div className="relative px-4 pt-3 pb-5 min-h-[520px] flex flex-col" data-testid="math-stage">
          {/* The Pokemon asks the question */}
          <div className="flex items-end gap-2">
            <img key={`hop-${hop}`} src={player.image} alt={player.name} draggable={false} className={`w-24 h-24 object-contain drop-shadow-lg scale-x-[-1] ${hop ? 'poke-hop' : 'sport-bob'}`} />
            <div key={`q-${index}`} className="bubble-pop relative mb-6 px-4 py-2.5 rounded-3xl bg-white shadow-lg">
              <p className="text-3xl font-black text-indigo-700 tracking-wide" data-testid="math-question">
                {q.text}
              </p>
              <span className="absolute -left-2 bottom-3 w-4 h-4 rotate-45 bg-white" />
            </div>
          </div>

          {/* The pictures */}
          <div key={`things-${index}`} className="mt-2 flex-1 flex items-center justify-center">
            {q.kind === 'add' ? (
              <div className="flex items-center gap-2 flex-wrap justify-center">
                <div className="flex flex-wrap justify-center max-w-[150px] p-2 rounded-3xl bg-white/70 shadow-inner">
                  {things.slice(0, q.a).map((i) => <Thing key={i} emoji={q.thing} index={i} badge={badgeFor(i)} />)}
                </div>
                <span className="text-5xl font-black text-rose-500">+</span>
                <div className="flex flex-wrap justify-center max-w-[150px] p-2 rounded-3xl bg-white/70 shadow-inner">
                  {things.slice(q.a).map((i) => <Thing key={i} emoji={q.thing} index={i} badge={badgeFor(i)} />)}
                </div>
              </div>
            ) : (
              <div className="flex flex-wrap justify-center max-w-[320px] p-3 rounded-3xl bg-white/70 shadow-inner">
                {things.map((i) => {
                  const gone = q.kind === 'sub' && eaten && i >= q.a - q.b;
                  return gone ? (
                    <span key={i} className="relative inline-flex w-11 h-11 sm:w-12 sm:h-12">
                      <Thing emoji={q.thing} index={i} gone flyDelay={(i - (q.a - q.b)) * 120} />
                      <span className="absolute inset-1 rounded-full border-2 border-dashed border-slate-300" />
                    </span>
                  ) : (
                    <Thing key={i} emoji={q.thing} index={i} badge={badgeFor(i)} />
                  );
                })}
              </div>
            )}
          </div>
          {q.kind === 'sub' && (
            <p className="text-center text-sm font-bold text-slate-600 mb-1">
              {eaten ? `${player.name} ăn mất ${q.b} rồi! Còn lại mấy?` : `${player.name} đang đói bụng…`}
            </p>
          )}

          {/* Answers: balloons */}
          <div className="grid grid-cols-3 gap-3 mt-2" role="group" aria-label="Chọn đáp án">
            {q.choices.map((n, i) => {
              const state = picked?.value === n ? (picked.correct ? 'right' : 'wrong') : null;
              return (
                <button
                  key={`${index}-${n}`}
                  onClick={(e) => choose(n, e)}
                  aria-label={`Đáp án ${n}`}
                  className={`relative mx-auto w-24 h-28 flex flex-col items-center ${state === 'right' ? 'dish-pop' : state === 'wrong' ? 'wrong-shake' : 'balloon-float'}`}
                  style={{ animationDelay: state ? '0ms' : `${i * 300}ms` }}
                >
                  <span
                    className={`w-20 h-24 rounded-[50%] bg-gradient-to-br ${BALLOONS[i]} shadow-lg flex items-center justify-center text-5xl font-black text-white ring-4 ${state === 'right' ? 'ring-emerald-300' : state === 'wrong' ? 'ring-rose-300 opacity-60' : 'ring-white/60'}`}
                  >
                    {n}
                  </span>
                  <span className="w-0.5 h-4 bg-slate-400" />
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
            <p role="status" className="mt-2 text-center text-lg font-black text-rose-500">
              Chưa đúng, mình cùng đếm nhé! 👆
            </p>
          )}
          {splash && <Splash key={splash.key} at={splash.at} color="#fde047" count={14} />}
        </div>
      )}
    </KidGameShell>
  );
}
