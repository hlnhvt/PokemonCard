import React, { useRef, useState } from 'react';
import confetti from 'canvas-confetti';
import { PAIR_LEVELS, createBoard, flipCard, hideMiss, pairStars } from '../../utils/logic/pairs';
import { TYPE_COLORS, TYPE_VI } from '../../utils/battle/typeChart';
import { artworkUrl } from '../../services/pokemonOnlineService';
import { goldForStars } from '../../utils/gold';
import { sounds } from '../../utils/soundEffects';
import { KidGameShell, SessionSummary, StarRow } from '../kidgames/Common';
import { PokeballIcon } from '../PokeballIcon';
import { useLater } from '../sports/sportsKit';

const MISS_DELAY = 900;

function CardFace({ card }) {
  const { pokemon, face } = card;
  if (face === 'type') {
    const t = pokemon.types[0];
    return (
      <span className="w-full h-full rounded-2xl flex flex-col items-center justify-center text-white font-black shadow-inner" style={{ background: `linear-gradient(145deg, ${TYPE_COLORS[t]}, ${TYPE_COLORS[t]}aa)` }}>
        <span className="text-[10px] uppercase opacity-80">Hệ</span>
        <span className="text-base leading-tight text-center px-1">{TYPE_VI[t]}</span>
      </span>
    );
  }
  return (
    <span className="w-full h-full rounded-2xl bg-gradient-to-b from-white to-sky-100 flex items-center justify-center">
      <img src={artworkUrl(pokemon.id)} alt={face === 'shadow' ? `Bóng của ${pokemon.name}` : pokemon.name} draggable={false} className={`w-[86%] h-[86%] object-contain ${face === 'shadow' ? 'silhouette' : ''}`} />
    </span>
  );
}

/**
 * "Lật thẻ tìm cặp": 3 levels (same picture, picture + silhouette, Pokemon + its type).
 * Cards flip in 3D; a match glows and sparkles, a miss shakes and turns back.
 */
export function PairsGame({ player, onClose, onGold, random = Math.random }) {
  const [board, setBoard] = useState(() => createBoard(0, random));
  const [shake, setShake] = useState([]);
  const [glow, setGlow] = useState([]);
  const [stars, setStars] = useState([]); // stars of the finished levels
  const [between, setBetween] = useState(false);
  const [done, setDone] = useState(false);
  const [hop, setHop] = useState(0);
  const paid = useRef(false);
  const later = useLater();
  const level = PAIR_LEVELS[board.level];

  const tap = (uid) => {
    const { state, result } = flipCard(board, uid);
    if (result === 'ignored') return;
    setBoard(state);
    sounds.playPop();
    if (result === 'match') {
      const ids = board.open.concat(uid);
      setGlow(ids);
      setHop((h) => h + 1);
      sounds.playCoin();
      later(() => setGlow([]), 800);
      if (state.done) {
        const s = pairStars(state.moves, level.pairs);
        const all = [...stars, s];
        setStars(all);
        sounds.playSuccessFanfare();
        try {
          confetti({ particleCount: 90, spread: 80, origin: { y: 0.45 }, zIndex: 9999 });
        } catch {
          // decoration
        }
        later(() => {
          if (board.level + 1 >= PAIR_LEVELS.length) {
            setDone(true);
            if (!paid.current) {
              paid.current = true;
              onGold?.(goldForStars(Math.round(all.reduce((a, b) => a + b, 0) / all.length)));
            }
          } else setBetween(true);
        }, 900);
      }
    } else if (result === 'miss') {
      later(() => {
        setShake(state.open);
        sounds.playOops();
      }, 450);
      later(() => {
        setShake([]);
        setBoard((b) => hideMiss(b));
      }, MISS_DELAY);
    }
  };

  const nextLevel = () => {
    setBetween(false);
    setBoard(createBoard(board.level + 1, random));
  };

  const replay = () => {
    paid.current = false;
    setStars([]);
    setDone(false);
    setBetween(false);
    setBoard(createBoard(0, random));
  };

  const avg = stars.length ? Math.round(stars.reduce((a, b) => a + b, 0) / stars.length) : 1;

  return (
    <KidGameShell
      title="🃏 Lật thẻ tìm cặp"
      label="Lật thẻ tìm cặp"
      round={done ? PAIR_LEVELS.length : board.level}
      rounds={PAIR_LEVELS.length}
      onClose={onClose}
      background="bg-gradient-to-b from-indigo-200 via-sky-100 to-pink-100"
      dataAttrs={{ 'data-level': board.level, 'data-moves': board.moves, 'data-done': done }}
    >
      {done ? (
        <SessionSummary title="Trí nhớ tuyệt vời! 🧠" stars={avg} maxStars={3} gold={goldForStars(avg)} detail="Bé đã tìm hết các cặp ở cả 3 màn" onReplay={replay} onClose={onClose} />
      ) : (
        <div className="relative px-3 pt-3 pb-5 flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <img key={`hop-${hop}`} src={player.image} alt={player.name} className={`w-16 h-16 object-contain scale-x-[-1] drop-shadow ${hop ? 'poke-hop' : 'sport-bob'}`} />
            <div className="flex-1">
              <p className="text-base font-black text-indigo-900">
                Màn {board.level + 1}: {level.title}
              </p>
              <p className="text-xs font-bold text-indigo-700">
                Đã lật {board.moves} lượt · Tìm được {board.matched.length / 2}/{level.pairs} cặp
              </p>
            </div>
          </div>

          <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${level.cols}, minmax(0, 1fr))` }} data-testid="pairs-board">
            {board.cards.map((card, i) => {
              const up = board.open.includes(card.uid) || board.matched.includes(card.uid);
              return (
                <button
                  key={`${board.level}-${card.uid}`}
                  onClick={() => tap(card.uid)}
                  aria-label={up ? `Thẻ ${card.uid + 1}: ${card.face === 'type' ? `hệ ${TYPE_VI[card.pokemon.types[0]]}` : card.pokemon.name}` : `Thẻ ${card.uid + 1} (úp)`}
                  data-pair={card.pair}
                  className={`flip-card pop-in aspect-[3/4] ${shake.includes(card.uid) ? 'wrong-shake' : ''}`}
                  style={{ animationDelay: `${i * 30}ms` }}
                >
                  <span className={`flip-inner block ${up ? 'is-up' : ''}`}>
                    <span className="flip-face absolute inset-0 rounded-2xl bg-gradient-to-br from-red-500 to-rose-700 border-4 border-white shadow-lg flex items-center justify-center">
                      <PokeballIcon className="w-[55%] h-[55%]" />
                    </span>
                    <span className={`flip-face flip-back absolute inset-0 rounded-2xl border-4 ${board.matched.includes(card.uid) ? 'border-amber-300' : 'border-white'} shadow-lg overflow-hidden ${glow.includes(card.uid) ? 'match-glow' : ''}`}>
                      <CardFace card={card} />
                    </span>
                  </span>
                </button>
              );
            })}
          </div>

          {between && (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/30 rounded-3xl" data-testid="pairs-level-done">
              <div className="pop-in mx-6 p-5 rounded-3xl bg-white shadow-2xl flex flex-col items-center gap-3 text-center">
                <p className="text-2xl font-black text-indigo-700">Xong màn {board.level + 1}! 🎉</p>
                <StarRow stars={stars[stars.length - 1]} size="w-10 h-10" animate />
                <p className="text-sm font-bold text-slate-600">Màn tiếp: {PAIR_LEVELS[board.level + 1].title}</p>
                <button onClick={nextLevel} className="px-6 py-3 rounded-2xl bg-gradient-to-r from-indigo-500 to-violet-500 text-white text-lg font-black shadow-lg active:scale-95">
                  Màn tiếp theo ➜
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </KidGameShell>
  );
}
