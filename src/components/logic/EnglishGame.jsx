import React, { useEffect, useRef, useState } from 'react';
import confetti from 'canvas-confetti';
import { Volume2, ArrowRight } from 'lucide-react';
import { makeEnglishLesson, englishStars, sayWord } from '../../utils/logic/english';
import { goldForStars } from '../../utils/gold';
import { sounds } from '../../utils/soundEffects';
import { speak } from '../../utils/speech';
import { KidGameShell, SessionSummary } from '../kidgames/Common';
import { useLater } from '../sports/sportsKit';

const CARD_COLORS = ['from-rose-300 to-pink-400', 'from-sky-300 to-indigo-400', 'from-lime-300 to-emerald-400'];
const PRAISE = ['Great job!', 'Well done!', 'Super!', 'Awesome!', 'You did it!'];

function SpeakerButton({ onClick, big = false, label }) {
  return (
    <button onClick={onClick} aria-label={label} className={`relative shrink-0 rounded-full bg-gradient-to-b from-amber-300 to-orange-500 text-white shadow-lg active:scale-95 flex items-center justify-center ${big ? 'w-24 h-24' : 'w-10 h-10'}`}>
      {big && (
        <>
          <span className="sound-wave absolute inset-0 rounded-full border-4 border-amber-300" />
          <span className="sound-wave absolute inset-0 rounded-full border-4 border-amber-300" style={{ animationDelay: '0.6s' }} />
        </>
      )}
      <Volume2 className={big ? 'w-12 h-12' : 'w-5 h-5'} />
    </button>
  );
}

/**
 * "Pokémon học tiếng Anh": hear a word and pick its picture, or see a picture and pick
 * the word. A right answer flips a card with the word, its Vietnamese meaning and words
 * with the same meaning, each one spoken aloud.
 */
export function EnglishGame({ player, onClose, onGold, random = Math.random }) {
  const [lesson, setLesson] = useState(() => makeEnglishLesson(random));
  const [index, setIndex] = useState(0);
  const [mistakes, setMistakes] = useState(0);
  const [wrong, setWrong] = useState([]); // words tried wrongly in this question
  const [revealed, setRevealed] = useState(false);
  const [done, setDone] = useState(false);
  const [hop, setHop] = useState(0);
  const paid = useRef(false);
  const later = useLater();
  const q = lesson[index];
  const w = q.answer;

  const sayIt = () => speak(w.word, { lang: 'en-US' });
  // In listening questions the word is spoken as soon as the question appears
  useEffect(() => {
    if (!done && q.mode === 'listen') speak(q.answer.word, { lang: 'en-US' });
  }, [q, done]);

  const choose = (choice) => {
    if (revealed || wrong.includes(choice.word)) return;
    if (choice.word === w.word) {
      setRevealed(true);
      setHop((h) => h + 1);
      sounds.playSuccessFanfare();
      // Word and same-meaning words in English, then the meaning in Vietnamese
      later(() => speak(sayWord(w), { lang: 'en-US' }), 450);
      later(() => speak(w.vi, { lang: 'vi-VN', interrupt: false, rate: 0.9 }), 500);
      try {
        confetti({ particleCount: 40, spread: 60, origin: { y: 0.45 }, zIndex: 9999, scalar: 0.8 });
      } catch {
        // decoration
      }
    } else {
      setWrong((list) => [...list, choice.word]);
      setMistakes((m) => m + 1);
      sounds.playOops();
      // Say what they tapped, so the mistake teaches a word too
      speak(choice.word, { lang: 'en-US' });
    }
  };

  const next = () => {
    if (index + 1 >= lesson.length) {
      setDone(true);
      const stars = englishStars(mistakes);
      if (!paid.current) {
        paid.current = true;
        onGold?.(goldForStars(stars));
      }
      speak('Excellent!', { lang: 'en-US' });
      return;
    }
    setIndex((i) => i + 1);
    setWrong([]);
    setRevealed(false);
  };

  const replay = () => {
    paid.current = false;
    setLesson(makeEnglishLesson(random));
    setIndex(0);
    setMistakes(0);
    setWrong([]);
    setRevealed(false);
    setDone(false);
  };

  const stars = englishStars(mistakes);

  return (
    <KidGameShell
      title="🔤 Học tiếng Anh"
      label="Pokémon học tiếng Anh"
      round={done ? lesson.length : index}
      rounds={lesson.length}
      onClose={onClose}
      background="bg-gradient-to-b from-amber-100 via-rose-50 to-sky-100"
      dataAttrs={{ 'data-question': index, 'data-mode': q.mode, 'data-revealed': revealed, 'data-done': done }}
    >
      {done ? (
        <SessionSummary
          title="Excellent! 🌟"
          stars={stars}
          maxStars={3}
          gold={goldForStars(stars)}
          detail={`Bé đã học ${lesson.length} từ tiếng Anh`}
          onReplay={replay}
          onClose={onClose}
        />
      ) : (
        <div className="relative px-4 pt-3 pb-5 min-h-[540px] flex flex-col items-center gap-4">
          {/* Helper Pokemon with the instruction */}
          <div className="w-full flex items-end gap-2">
            <img key={`hop-${hop}`} src={player.image} alt={player.name} draggable={false} className={`w-20 h-20 object-contain drop-shadow-lg scale-x-[-1] ${hop ? 'poke-hop' : 'sport-bob'}`} />
            <div key={`${index}-${revealed}`} className="bubble-pop relative mb-5 px-4 py-2 rounded-3xl bg-white shadow-lg">
              <p className="text-base font-black text-slate-700">
                {revealed ? `${PRAISE[index % PRAISE.length]} 🎉` : q.mode === 'listen' ? 'Nghe và chọn hình đúng nhé!' : 'Hình này tiếng Anh là gì?'}
              </p>
              <span className="absolute -left-2 bottom-3 w-4 h-4 rotate-45 bg-white" />
            </div>
          </div>

          {revealed ? (
            // Flip card: picture on the front, word + meaning + same-meaning words on the back
            <div className="relative w-64 h-80" data-testid="word-card">
              <div className="card-flip absolute inset-0">
                <div className="flip-face absolute inset-0 rounded-3xl bg-gradient-to-br from-amber-200 to-orange-300 shadow-2xl flex items-center justify-center text-[8rem]">{w.emoji}</div>
                <div className="flip-face flip-back absolute inset-0 rounded-3xl bg-white shadow-2xl border-4 border-amber-300 flex flex-col items-center justify-center gap-2 p-4 text-center">
                  <span className="text-6xl">{w.emoji}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-4xl font-black text-indigo-700">{w.word}</span>
                    <SpeakerButton onClick={sayIt} label={`Nghe từ ${w.word}`} />
                  </div>
                  <p className="text-lg font-bold text-rose-600"><span className="text-xs font-black uppercase text-slate-500 mr-1">Nghĩa:</span>{w.vi}</p>
                  {w.same.length > 0 && (
                    <div className="mt-1">
                      <p className="text-xs font-black uppercase tracking-wide text-slate-500">Từ cùng nghĩa</p>
                      <div className="mt-1 flex flex-wrap justify-center gap-1.5">
                        {w.same.map((s) => (
                          <button key={s} onClick={() => speak(s, { lang: 'en-US' })} className="px-3 py-1 rounded-full bg-sky-100 text-sky-700 text-base font-black flex items-center gap-1 active:scale-95">
                            <Volume2 className="w-4 h-4" /> {s}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : q.mode === 'listen' ? (
            <div className="flex flex-col items-center gap-2 py-3">
              <SpeakerButton big onClick={sayIt} label="Nghe lại từ" />
              <p className="text-sm font-bold text-slate-500">Chạm loa để nghe lại</p>
            </div>
          ) : (
            <div key={index} className="spotlight-pop w-44 h-44 rounded-3xl bg-white shadow-xl flex items-center justify-center text-[7rem]" data-testid="look-picture">
              {w.emoji}
            </div>
          )}

          {!revealed && (
            <div className={`w-full grid gap-3 ${q.mode === 'listen' ? 'grid-cols-3' : 'grid-cols-1'}`} role="group" aria-label="Chọn đáp án">
              {q.choices.map((c, i) => {
                const isWrong = wrong.includes(c.word);
                return q.mode === 'listen' ? (
                  <button
                    key={c.word}
                    onClick={() => choose(c)}
                    aria-label={`Hình ${c.vi}`}
                    className={`pop-in aspect-square rounded-3xl bg-gradient-to-br ${CARD_COLORS[i]} shadow-lg flex items-center justify-center text-6xl active:scale-95 ${isWrong ? 'wrong-shake grayscale opacity-50' : ''}`}
                    style={{ animationDelay: isWrong ? '0ms' : `${i * 100}ms` }}
                  >
                    {c.emoji}
                  </button>
                ) : (
                  <button
                    key={c.word}
                    onClick={() => choose(c)}
                    className={`pop-in py-3.5 rounded-2xl bg-gradient-to-r ${CARD_COLORS[i]} text-white text-3xl font-black tracking-wide shadow-lg active:scale-95 ${isWrong ? 'wrong-shake grayscale opacity-50' : ''}`}
                    style={{ animationDelay: isWrong ? '0ms' : `${i * 100}ms` }}
                  >
                    {c.word}
                  </button>
                );
              })}
            </div>
          )}

          {revealed && (
            <button onClick={next} className="pop-in mt-1 px-8 py-3.5 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 text-white text-xl font-black shadow-lg flex items-center gap-2 active:scale-95" style={{ animationDelay: '600ms' }}>
              {index + 1 >= lesson.length ? 'Xong!' : 'Từ tiếp theo'} <ArrowRight className="w-6 h-6" />
            </button>
          )}
        </div>
      )}
    </KidGameShell>
  );
}
