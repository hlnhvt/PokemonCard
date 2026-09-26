import React, { useRef, useState } from 'react';
import confetti from 'canvas-confetti';
import { LEVELS, QUESTIONS, PER_LEVEL, createOddGame, answer, nextQuestion, oddStars } from '../../utils/logic/oddone';
import { goldForStars } from '../../utils/gold';
import { sounds } from '../../utils/soundEffects';
import { KidGameShell, SessionSummary } from '../kidgames/Common';
import { useLater } from '../sports/sportsKit';

function Face({ item, big }) {
  if (item.kind === 'emoji') return <span className={`${big ? 'text-7xl' : 'text-6xl'} leading-none drop-shadow`}>{item.emoji}</span>;
  if (item.kind === 'number')
    return <span className="text-6xl font-black bg-gradient-to-b from-sky-400 to-indigo-600 bg-clip-text text-transparent drop-shadow">{item.label}</span>;
  return (
    <span className="flex flex-col items-center">
      <img src={item.image} alt="" className="w-24 h-24 object-contain drop-shadow-lg" draggable={false} />
      <span className="text-xs font-black text-slate-700">{item.label}</span>
    </span>
  );
}

/**
 * "Cái nào khác loại?": four pictures, three belong together; tap the odd one. Four levels:
 * things around the child, Pokemon types, numbers, evolution families. The rule is explained
 * after each answer, with the shared trait shown on every card.
 */
export function OddOneGame({ player, onClose, onGold, random = Math.random }) {
  const [game, setGame] = useState(() => createOddGame(random));
  const [shake, setShake] = useState(null);
  const [levelBanner, setLevelBanner] = useState({ id: 0, level: 0 });
  const paid = useRef(false);
  const later = useLater();
  const q = game.questions[Math.min(game.index, game.questions.length - 1)];
  const level = LEVELS[q.level];
  const revealed = game.status === 'right';

  const tap = (i) => {
    const out = answer(game, i);
    if (out.result === 'ignored') return;
    setGame(out.game);
    if (out.result === 'right') {
      sounds.playCoin();
      try {
        confetti({ particleCount: 45, spread: 60, origin: { y: 0.55 }, zIndex: 9999 });
      } catch {
        // decoration
      }
    } else {
      sounds.playOops();
      setShake(i);
      later(() => setShake(null), 500);
    }
  };

  const next = () => {
    const { game: g, levelUp } = nextQuestion(game);
    setGame(g);
    if (g.status === 'done') {
      sounds.playSuccessFanfare();
      if (!paid.current) {
        paid.current = true;
        onGold?.(goldForStars(oddStars(g.mistakes)));
      }
    } else if (levelUp) {
      sounds.playEnergySurge();
      setLevelBanner((b) => ({ id: b.id + 1, level: g.questions[g.index].level }));
    }
  };

  const replay = () => {
    paid.current = false;
    setGame(createOddGame(random));
    setLevelBanner((b) => ({ id: b.id + 1, level: 0 }));
  };

  const stars = oddStars(game.mistakes);

  return (
    <KidGameShell
      title="🔍 Khác loại"
      label="Cái nào khác loại"
      round={game.index}
      rounds={QUESTIONS}
      onClose={onClose}
      background="bg-gradient-to-b from-cyan-200 via-sky-100 to-amber-100"
      dataAttrs={{ 'data-status': game.status, 'data-index': game.index, 'data-mistakes': game.mistakes }}
    >
      {game.status === 'done' ? (
        <SessionSummary
          title={stars === 3 ? 'Thám tử siêu đỉnh! 🕵️' : 'Giỏi lắm! 🎉'}
          stars={stars}
          maxStars={3}
          gold={goldForStars(stars)}
          detail={`${QUESTIONS} câu, chọn nhầm ${game.mistakes} lần`}
          onReplay={replay}
          onClose={onClose}
        />
      ) : (
        <div className="relative px-4 pt-3 pb-5 min-h-[560px] flex flex-col items-center gap-3">
          <div className="w-full flex items-center justify-between">
            <span className="px-3 py-1 rounded-full bg-white/85 text-sm font-black text-sky-700 shadow">
              {level.icon} Màn {q.level + 1}: {level.title}
            </span>
            <span className="text-xs font-black text-slate-600">
              Câu {(game.index % PER_LEVEL) + 1}/{PER_LEVEL}
            </span>
          </div>

          <div className="flex items-end gap-2 w-full">
            <img src={player.image} alt={player.name} className={`w-20 h-20 object-contain drop-shadow-lg ${revealed ? 'battle-victory' : 'poke-hop'}`} />
            <p key={`${game.index}-${game.status}`} className="bubble-pop flex-1 px-4 py-2 rounded-2xl bg-white/95 text-base font-black text-slate-800 shadow" role="status" data-testid="odd-bubble">
              {revealed ? (
                <>
                  ✅ Đúng rồi! {q.rule}.
                  <span className="block text-sm font-bold text-orange-600">
                    Còn {q.items[q.odd].kind === 'emoji' ? q.items[q.odd].emoji : q.items[q.odd].label} thì là: {q.oddTag}
                  </span>
                </>
              ) : game.wrong.length ? (
                'Chưa đúng rồi! Nhìn xem 3 cái nào giống nhau nhé 🤔'
              ) : (
                'Bạn nào khác với 3 bạn còn lại?'
              )}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 w-full" role="group" aria-label="Chọn cái khác loại">
            {q.items.map((item, i) => {
              const isOdd = i === q.odd;
              const wrong = game.wrong.includes(i);
              return (
                <button
                  key={`${game.index}-${item.key}`}
                  onClick={() => tap(i)}
                  aria-label={item.kind === 'emoji' ? item.emoji : item.label}
                  data-odd={isOdd}
                  className={`pop-in relative aspect-square rounded-3xl shadow-xl flex items-center justify-center transition-all duration-300 active:scale-95
                    ${revealed && isOdd ? 'bg-gradient-to-b from-amber-200 to-orange-300 ring-8 ring-amber-400 scale-105 z-10' : revealed ? 'bg-white ring-4 ring-emerald-400' : 'bg-white'}
                    ${wrong ? 'opacity-50' : ''} ${shake === i ? 'wrong-shake ring-4 ring-rose-400' : ''}`}
                  style={{ animationDelay: `${i * 70}ms` }}
                >
                  <Face item={item} />
                  {wrong && <span className="absolute inset-0 flex items-center justify-center text-7xl font-black text-rose-500/80">✕</span>}
                  {revealed && (
                    <span className="absolute inset-x-0 -bottom-2 flex justify-center">
                      <span className={`star-pop whitespace-nowrap px-2 py-0.5 rounded-full text-[11px] font-black text-white shadow ${isOdd ? 'bg-orange-500' : 'bg-emerald-500'}`}>{item.tag}</span>
                    </span>
                  )}
                  {revealed && isOdd && (
                    <>
                      <span className="star-pop absolute -top-3 -right-2 text-3xl">⭐</span>
                      <span className="star-pop absolute -top-2 -left-2 text-2xl" style={{ animationDelay: '120ms' }}>✨</span>
                      <span className="absolute top-2 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded-full bg-rose-500 text-white text-xs font-black shadow">Khác loại!</span>
                    </>
                  )}
                </button>
              );
            })}
          </div>

          {revealed && (
            <button onClick={next} className="pop-in mt-1 px-8 py-3 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 text-white text-lg font-black shadow-lg active:scale-95">
              {game.index + 1 >= QUESTIONS ? 'Xem kết quả 🏆' : 'Câu tiếp theo ➜'}
            </button>
          )}

          {levelBanner.id > 0 && (
            <div key={levelBanner.id} className="banner-slam absolute left-1/2 top-[40%] z-20 pointer-events-none whitespace-nowrap px-5 py-2 rounded-3xl bg-gradient-to-r from-fuchsia-500 to-orange-400 text-white text-2xl font-black shadow-2xl" data-testid="odd-level">
              {LEVELS[levelBanner.level].icon} Màn {levelBanner.level + 1}: {LEVELS[levelBanner.level].title}
            </div>
          )}
        </div>
      )}
    </KidGameShell>
  );
}
