import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, ChevronRight, Lock } from 'lucide-react';
import { rankFor } from '../utils/pokemonRank';

const GROUP_TITLES = { play: '🎮 Vui chơi', sport: '🏆 Thi đấu thể thao', logic: '🧠 Trò chơi trí tuệ' };

/** Games in groups, in the order the groups first appear (games without a group form one list). */
function groupsOf(games) {
  const groups = [];
  games.forEach((game) => {
    const key = game.group || null;
    let g = groups.find((x) => x.group === key);
    if (!g) groups.push((g = { group: key, list: [] }));
    g.list.push(game);
  });
  let offset = 0;
  return groups.map((g) => {
    const result = { ...g, offset };
    offset += g.list.length;
    return result;
  });
}

/**
 * Bottom sheet listing the games a child can play with one Pokemon.
 * games = [{ id, title, description, icon, gradient, badge?, group?, needRank?, onPlay }]
 * rank (from utils/pokemonRank): games needing a higher rank are shown locked.
 */
export function GamePicker({ pokemonName, image, games, onClose, rank }) {
  const [lockMsg, setLockMsg] = useState(null);
  const open = rank ? games.filter((g) => !(g.needRank > rank.level)).length : games.length;
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose?.();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center" role="dialog" aria-label="Chọn trò chơi">
      <button aria-label="Đóng danh sách trò chơi" className="backdrop-fade absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="sheet-up relative w-full sm:max-w-lg max-h-[85vh] overflow-y-auto rounded-t-3xl sm:rounded-3xl bg-slate-900 border-t-4 sm:border-4 border-white/70 shadow-2xl">
        <div className="sticky top-0 z-10 bg-slate-900/95 backdrop-blur px-4 pt-2 pb-3">
          <div className="mx-auto mb-2 h-1.5 w-12 rounded-full bg-slate-600 sm:hidden" aria-hidden="true" />
          <div className="flex items-center gap-3">
            {image && <img src={image} alt="" className="w-12 h-12 object-contain" />}
            <div className="flex-1 min-w-0">
              <p className="text-lg font-black text-slate-50 truncate">Chơi cùng {pokemonName}</p>
              {rank ? (
                <p className="text-xs text-slate-300" data-testid="picker-rank">
                  Hạng <span className="font-black text-amber-300">{rank.icon} {rank.name}</span> · mở {open}/{games.length} trò
                </p>
              ) : (
                <p className="text-xs text-slate-400">Chọn một trò chơi nhé!</p>
              )}
            </div>
            <button onClick={onClose} aria-label="Đóng" className="p-2 rounded-full bg-slate-800 text-slate-200 hover:bg-slate-700">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {lockMsg && (
          <p key={lockMsg.id} role="alert" className="bubble-pop mx-4 mt-1 p-3 rounded-2xl bg-amber-400/15 border border-amber-400/50 text-sm font-bold text-amber-100">
            {lockMsg.text}
          </p>
        )}
        {groupsOf(games).map(({ group, list, offset }) => (
          <section key={group || 'all'} aria-label={GROUP_TITLES[group]}>
            {group && <h4 className="px-4 pt-2 text-sm font-black uppercase tracking-wider text-slate-300">{GROUP_TITLES[group] || group}</h4>}
            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-4 pt-2">
              {list.map((game, j) => (
                <li key={game.id} className="sheet-item" style={{ animationDelay: `${60 + Math.min(offset + j, 8) * 50}ms` }}>
                  <button
                    onClick={() => {
                      if (rank && game.needRank > rank.level) {
                        const need = rankFor(game.needRank);
                        setLockMsg((m) => ({
                          id: (m?.id || 0) + 1,
                          text: `🔒 ${game.title} cần Pokémon hạng ${need.icon} ${need.name}. Cho ${pokemonName} ăn và chơi cùng tới mức "Tri kỷ" để lên hạng, hoặc quét thẻ Pokémon mạnh hơn nhé!`,
                        }));
                        return;
                      }
                      onClose?.();
                      game.onPlay();
                    }}
                    aria-label={rank && game.needRank > rank.level ? `${game.title} (cần hạng ${rankFor(game.needRank).name})` : game.title}
                    data-locked={!!rank && game.needRank > rank.level}
                    className={`relative w-full flex items-center gap-3 p-3 rounded-2xl text-left text-white shadow-lg bg-gradient-to-r ${game.gradient} active:scale-[0.97] transition-transform ${rank && game.needRank > rank.level ? 'grayscale opacity-60' : ''}`}
                  >
                    <span className="flex items-center justify-center w-14 h-14 rounded-2xl bg-white/20 text-3xl shrink-0" aria-hidden="true">
                      {game.icon}
                    </span>
                    <span className="flex-1 min-w-0">
                      <span className="flex items-center gap-2">
                        <span className="text-base font-black">{game.title}</span>
                        {game.badge && <span className="px-1.5 py-0.5 rounded-full bg-white/25 text-[10px] font-black">{game.badge}</span>}
                      </span>
                      <span className="block text-xs text-white/85 leading-snug">{game.description}</span>
                    </span>
                    {rank && game.needRank > rank.level ? (
                      <span className="shrink-0 flex flex-col items-center text-[10px] font-black">
                        <Lock className="w-5 h-5" />
                        {rankFor(game.needRank).icon} {rankFor(game.needRank).name}
                      </span>
                    ) : (
                      <ChevronRight className="w-5 h-5 shrink-0 opacity-80" />
                    )}
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>,
    document.body
  );
}
