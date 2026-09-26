import React, { useMemo, useState } from 'react';
import { HelpCircle, Lightbulb, RotateCcw, Star, Trophy, ArrowRight } from 'lucide-react';
import { playCry } from '../utils/cries';
import { sounds } from '../utils/soundEffects';
import { GOLD_REWARDS } from '../utils/gold';
import { GoldReward } from './kidgames/Common';
import { ROUNDS, buildPool, makeQuestion, starsFor } from '../utils/guessGame';

const BEST_KEY = 'pokescan_guess_best';

function readBest() {
  try {
    return Number(localStorage.getItem(BEST_KEY)) || 0;
  } catch {
    return 0;
  }
}

function saveBest(score) {
  try {
    localStorage.setItem(BEST_KEY, String(score));
  } catch {
    // ignore
  }
}
export function GuessGame({ collection = [], onGold, random = Math.random }) {
  const pool = useMemo(() => buildPool(collection), [collection]);
  const [round, setRound] = useState(1);
  const [score, setScore] = useState(0);
  const [asked, setAsked] = useState(() => new Set());
  const [question, setQuestion] = useState(() => makeQuestion(pool, new Set(), random));
  const [picked, setPicked] = useState(null);
  const [showHint, setShowHint] = useState(false);
  const [finished, setFinished] = useState(false);
  const [best, setBest] = useState(readBest);

  const { target, options } = question;
  const revealed = picked !== null;

  const pick = (option) => {
    if (revealed) return;
    setPicked(option.key);
    const correct = option.key === target.key;
    if (correct) {
      setScore((s) => s + 1);
      sounds.playSuccessFanfare();
    } else {
      sounds.playScanBeep();
    }
    playCry(target);
  };

  const next = () => {
    const nextAsked = new Set(asked).add(target.key);
    if (round >= ROUNDS) {
      setFinished(true);
      if (score > 0) onGold?.(score * GOLD_REWARDS.quizCorrect);
      if (score > best) {
        setBest(score);
        saveBest(score);
      }
      return;
    }
    setAsked(nextAsked);
    setRound((r) => r + 1);
    setQuestion(makeQuestion(pool, nextAsked, random));
    setPicked(null);
    setShowHint(false);
  };

  const restart = () => {
    setRound(1);
    setScore(0);
    setAsked(new Set());
    setQuestion(makeQuestion(pool, new Set(), random));
    setPicked(null);
    setShowHint(false);
    setFinished(false);
  };

  if (finished) {
    const stars = starsFor(score);
    return (
      <div className="glass-panel rounded-3xl p-6 text-center flex flex-col items-center gap-3">
        <Trophy className="w-14 h-14 text-amber-400" />
        <h3 className="text-2xl font-black text-slate-50">Hoàn thành!</h3>
        <div className="flex gap-1" aria-label={`${stars} sao`}>
          {[0, 1, 2].map((i) => (
            <Star key={i} className={`w-10 h-10 ${i < stars ? 'fill-amber-400 text-amber-400' : 'text-slate-600'}`} />
          ))}
        </div>
        <p className="text-lg font-bold text-slate-200">
          Bé đoán đúng <strong className="text-amber-400">{score}/{ROUNDS}</strong> Pokémon
        </p>
        <p className="text-sm text-slate-400">Kỷ lục: {Math.max(best, score)}/{ROUNDS}</p>
        {score > 0 && <GoldReward amount={score * GOLD_REWARDS.quizCorrect} dark />}
        <button onClick={restart} className="mt-2 px-6 py-3 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-black text-lg flex items-center gap-2 active:scale-95">
          <RotateCcw className="w-5 h-5" /> Chơi lại
        </button>
      </div>
    );
  }

  const correctPick = picked === target.key;

  return (
    <div className="glass-panel rounded-3xl p-4 sm:p-6 flex flex-col items-center gap-4">
      <div className="w-full flex items-center justify-between text-sm font-bold">
        <span className="text-slate-300">Câu {round}/{ROUNDS}</span>
        <span className="flex items-center gap-1 text-amber-400">
          <Star className="w-4 h-4 fill-amber-400" /> {score}
        </span>
      </div>

      <h3 className="text-xl sm:text-2xl font-black text-slate-50 flex items-center gap-2">
        <HelpCircle className="w-6 h-6 text-cyan-400" /> Ai là Pokémon này?
      </h3>

      <div className="relative w-52 h-52 sm:w-60 sm:h-60 rounded-full bg-gradient-to-b from-sky-300/40 to-amber-200/30 border-4 border-slate-700 flex items-center justify-center">
        <img
          src={target.image}
          alt={revealed ? target.name : 'Pokémon bí ẩn'}
          draggable={false}
          className={`w-44 h-44 sm:w-52 sm:h-52 object-contain ${revealed ? '' : 'silhouette'} ${revealed && correctPick ? 'poke-hop' : ''}`}
        />
      </div>

      {revealed ? (
        <p role="status" className={`text-xl font-black ${correctPick ? 'text-emerald-400' : 'text-rose-400'}`}>
          {correctPick ? `Đúng rồi! Đó là ${target.name}! 🎉` : `Chưa đúng! Đó là ${target.name}.`}
        </p>
      ) : showHint ? (
        <p className="text-lg font-black tracking-[0.3em] text-cyan-400" aria-label="Gợi ý">
          {target.name.charAt(0).toUpperCase()}
          {' _'.repeat(Math.max(0, target.name.replace(/[^A-Za-z]/g, '').length - 1))}
        </p>
      ) : (
        <button onClick={() => setShowHint(true)} className="text-sm font-bold text-cyan-400 hover:underline flex items-center gap-1">
          <Lightbulb className="w-4 h-4" /> Xem gợi ý
        </button>
      )}

      <div className="w-full grid grid-cols-2 gap-3">
        {options.map((option) => {
          const isTarget = option.key === target.key;
          const isPicked = option.key === picked;
          const style = !revealed
            ? 'bg-slate-800 hover:bg-slate-700 text-slate-100 border-slate-700'
            : isTarget
              ? 'bg-emerald-500 text-white border-emerald-300'
              : isPicked
                ? 'bg-rose-500 text-white border-rose-300'
                : 'bg-slate-800 text-slate-500 border-slate-700 opacity-60';
          return (
            <button
              key={option.key}
              onClick={() => pick(option)}
              disabled={revealed}
              className={`py-4 px-3 rounded-2xl border-2 text-base sm:text-lg font-black transition-all active:scale-95 ${style}`}
            >
              {option.name}
            </button>
          );
        })}
      </div>

      {revealed && (
        <button onClick={next} className="w-full py-3 rounded-2xl bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-black text-lg flex items-center justify-center gap-2 active:scale-95">
          {round >= ROUNDS ? 'Xem kết quả' : 'Câu tiếp theo'} <ArrowRight className="w-5 h-5" />
        </button>
      )}
    </div>
  );
}
