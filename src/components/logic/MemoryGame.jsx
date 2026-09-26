import React, { useEffect, useRef, useState } from 'react';
import confetti from 'canvas-confetti';
import { Heart } from 'lucide-react';
import { createMemoryGame, tapCard, nextRound, memoryStars, MAX_LENGTH, START_LENGTH, HEARTS } from '../../utils/logic/memory';
import { NOTES } from '../../utils/logic/music';
import { POPULAR_POKEMON } from '../../utils/guessGame';
import { goldForStars } from '../../utils/gold';
import { sounds } from '../../utils/soundEffects';
import { KidGameShell, SessionSummary } from '../kidgames/Common';
import { useLater } from '../sports/sportsKit';

const SHOW_EACH = 1100; // ms each Pokemon stays in the spotlight
const SLOT_COLORS = ['bg-rose-400', 'bg-amber-400', 'bg-lime-400', 'bg-sky-400', 'bg-violet-400', 'bg-pink-400'];

/**
 * "Pokémon trí nhớ": Pokemon pop up one after another in the spotlight; then the child taps
 * them in the same order. Rounds grow from 2 to 6 Pokemon; 3 hearts.
 */
export function MemoryGame({ player, onClose, onGold, random = Math.random, pool: poolProp }) {
  const pool = poolProp || POPULAR_POKEMON.filter((p) => p.name.toLowerCase() !== String(player.name).toLowerCase());
  const [game, setGame] = useState(() => createMemoryGame(pool, random));
  const [showing, setShowing] = useState(-1); // index of the Pokemon in the spotlight
  const [shake, setShake] = useState(null);
  const [broken, setBroken] = useState(null);
  const [message, setMessage] = useState(null);
  const [summary, setSummary] = useState(false);
  const paid = useRef(false);
  const later = useLater();
  const { round } = game;
  const finished = game.status === 'won' || game.status === 'over';

  // Show the sequence, one Pokemon at a time, each with its own rising note
  useEffect(() => {
    if (game.status !== 'show') return undefined;
    const timers = [];
    round.sequence.forEach((_, i) => {
      timers.push(setTimeout(() => {
        setShowing(i);
        sounds.playNote(NOTES[i % NOTES.length].freq, { duration: 0.6, volume: 0.22 });
      }, 700 + i * SHOW_EACH));
    });
    timers.push(setTimeout(() => {
      setShowing(-1);
      setGame((g) => (g.status === 'show' ? { ...g, status: 'input' } : g));
    }, 700 + round.sequence.length * SHOW_EACH));
    return () => timers.forEach(clearTimeout);
  }, [game.status, round]);

  const finish = (best) => {
    setSummary(true);
    if (paid.current) return;
    paid.current = true;
    onGold?.(goldForStars(memoryStars(best)));
  };

  const tap = (card) => {
    if (game.status !== 'input' || round.sequence.slice(0, round.progress).some((p) => p.key === card.key)) return;
    const next = tapCard(game, card.key);
    setGame(next);
    if (next.status === 'input' || next.status === 'roundWon' || next.status === 'won') {
      sounds.playNote(NOTES[round.progress % NOTES.length].freq, { duration: 0.5, volume: 0.24 });
    }
    if (next.status === 'roundWon' || next.status === 'won') {
      sounds.playSuccessFanfare();
      setMessage(next.status === 'won' ? 'Trí nhớ siêu đỉnh! 🏆' : 'Giỏi lắm! 🎉');
      try {
        confetti({ particleCount: next.status === 'won' ? 140 : 50, spread: 70, origin: { y: 0.4 }, zIndex: 9999 });
      } catch {
        // decoration
      }
      if (next.status === 'won') {
        later(() => finish(next.best), 1500);
        return;
      }
      later(() => {
        setMessage(null);
        setGame((g) => nextRound(g, pool, random));
      }, 1500);
    } else if (next.status === 'wrong' || next.status === 'over') {
      sounds.playOops();
      setShake(card.key);
      setBroken((old) => ({ index: next.hearts, key: (old?.key || 0) + 1 }));
      setMessage(next.status === 'over' ? 'Hết tim rồi!' : 'Ối, chưa đúng! Xem lại nhé 👀');
      later(() => setShake(null), 500);
      if (next.status === 'over') {
        later(() => finish(next.best), 1200);
        return;
      }
      later(() => {
        setMessage(null);
        setGame((g) => nextRound(g, pool, random));
      }, 1600);
    }
  };

  const replay = () => {
    paid.current = false;
    setGame(createMemoryGame(pool, random));
    setMessage(null);
    setSummary(false);
  };

  const stars = memoryStars(game.best);
  const showSummary = finished && summary;

  return (
    <KidGameShell
      title="🧠 Nhớ thứ tự"
      label="Pokémon luyện trí nhớ"
      round={Math.min(game.length - START_LENGTH, MAX_LENGTH - START_LENGTH + 1)}
      rounds={MAX_LENGTH - START_LENGTH + 1}
      onClose={onClose}
      background="bg-gradient-to-b from-violet-300 via-fuchsia-200 to-amber-100"
      dataAttrs={{ 'data-status': game.status, 'data-length': game.length, 'data-hearts': game.hearts }}
    >
      {showSummary ? (
        <SessionSummary
          title={game.status === 'won' ? 'Trí nhớ siêu đỉnh! 🏆' : 'Cố gắng lắm! 💪'}
          stars={stars}
          maxStars={3}
          gold={goldForStars(stars)}
          detail={`Bé nhớ được ${game.best || 0} Pokémon liên tiếp`}
          onReplay={replay}
          onClose={onClose}
        />
      ) : (
        <div className="relative px-4 pt-3 pb-5 min-h-[540px] flex flex-col items-center gap-3">
          <div className="w-full flex items-center justify-between">
            <div className="flex gap-1" aria-label={`Còn ${game.hearts} tim`}>
              {Array.from({ length: HEARTS }).map((_, i) => (
                <span key={i} className="relative w-7 h-7">
                  <Heart className={`w-7 h-7 ${i < game.hearts ? 'fill-rose-500 text-rose-500' : 'text-white/70'}`} />
                  {broken && broken.index === i && <Heart key={broken.key} className="heart-break absolute inset-0 w-7 h-7 fill-rose-500 text-rose-500" />}
                </span>
              ))}
            </div>
            <span className="px-3 py-1 rounded-full bg-white/80 text-sm font-black text-violet-700">Nhớ {game.length} Pokémon</span>
          </div>

          {/* The tray fills in the order the child taps */}
          <div className="flex gap-2 justify-center" data-testid="memory-tray">
            {round.sequence.map((p, i) => (
              <div key={i} className={`relative w-12 h-12 rounded-2xl ${i < round.progress ? SLOT_COLORS[i] : 'bg-white/50 border-2 border-dashed border-white'} flex items-center justify-center shadow-inner`}>
                {i < round.progress ? <img src={p.image} alt={p.name} className="pop-in w-11 h-11 object-contain" /> : <span className="text-lg font-black text-white">{i + 1}</span>}
              </div>
            ))}
          </div>

          {/* Spotlight while showing; the host Pokemon otherwise */}
          <div className="relative w-56 h-56 flex items-center justify-center">
            <div className={`absolute inset-0 rounded-full ${game.status === 'show' ? 'bg-[radial-gradient(circle,rgba(255,255,255,0.95)_0%,rgba(255,255,255,0.35)_55%,transparent_70%)]' : ''}`} />
            {game.status === 'show' && showing >= 0 ? (
              <div key={`${round.sequence[showing].key}-${showing}`} className="spotlight-pop relative flex flex-col items-center" data-testid="memory-spotlight">
                <img src={round.sequence[showing].image} alt={round.sequence[showing].name} className="w-40 h-40 object-contain drop-shadow-2xl" />
                <span className={`absolute -top-1 -right-1 w-10 h-10 rounded-full ${SLOT_COLORS[showing]} text-white text-xl font-black flex items-center justify-center shadow-lg`}>{showing + 1}</span>
              </div>
            ) : (
              <img src={player.image} alt={player.name} className={`relative w-36 h-36 object-contain drop-shadow-xl ${game.status === 'input' ? 'sport-bob' : 'poke-hop'}`} />
            )}
          </div>

          <p key={`${game.status}-${message}`} className="bubble-pop px-4 py-2 rounded-2xl bg-white/90 text-center text-lg font-black text-violet-800 shadow" role="status">
            {message || (game.status === 'show' ? 'Xem kỹ thứ tự nhé! 👀' : game.status === 'input' ? 'Đến lượt bé! Chạm theo đúng thứ tự' : '…')}
          </p>

          {/* Cards to choose from */}
          <div className={`grid gap-3 w-full grid-cols-4 transition-opacity duration-300 ${game.status === 'input' ? 'opacity-100' : 'opacity-40 pointer-events-none'}`} role="group" aria-label="Chọn Pokémon">
            {round.cards.map((p, i) => {
              const usedAt = round.sequence.slice(0, round.progress).findIndex((s) => s.key === p.key);
              return (
                <button
                  key={p.key}
                  onClick={() => tap(p)}
                  aria-label={p.name}
                  className={`relative aspect-square rounded-2xl bg-white shadow-lg flex items-center justify-center active:scale-95 transition-transform pop-in ${shake === p.key ? 'wrong-shake ring-4 ring-rose-400' : ''} ${usedAt >= 0 ? 'ring-4 ring-emerald-400' : ''}`}
                  style={{ animationDelay: shake === p.key ? '0ms' : `${i * 60}ms` }}
                >
                  <img src={p.image} alt="" className={`w-[85%] h-[85%] object-contain ${usedAt >= 0 ? 'opacity-40' : ''}`} draggable={false} />
                  {usedAt >= 0 && <span className={`star-pop absolute -top-2 -right-2 w-7 h-7 rounded-full ${SLOT_COLORS[usedAt]} text-white text-sm font-black flex items-center justify-center shadow`}>{usedAt + 1}</span>}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </KidGameShell>
  );
}
