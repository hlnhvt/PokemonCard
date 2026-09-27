import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Play, Swords } from '../icons/PokeIcons';
import { TeamBuilder } from '../team/TeamBuilder';
import { enterLandscape, leaveLandscape } from '../moba/landscape';
import { loadQuest, clearQuest, describeSave } from '../../utils/quest/save';
import { ACTS } from '../../utils/quest/world';
import { artworkUrl } from '../../services/pokemonOnlineService';
import { QuestWorld } from './QuestWorld';

const TRAINER_SVG = (
  <svg viewBox="0 0 64 64" className="w-20 h-20 drop-shadow-lg" aria-hidden="true">
    <ellipse cx="32" cy="60" rx="14" ry="3.5" fill="rgba(0,0,0,0.3)" />
    <rect x="23" y="46" width="7" height="12" rx="3" fill="#1e3a8a" />
    <rect x="34" y="46" width="7" height="12" rx="3" fill="#1e3a8a" />
    <rect x="17" y="30" width="30" height="20" rx="6" fill="#facc15" />
    <rect x="20" y="28" width="24" height="22" rx="8" fill="#2563eb" />
    <rect x="31" y="29" width="2" height="20" fill="#fff" />
    <circle cx="32" cy="21" r="11" fill="#fcd9b8" />
    <circle cx="28" cy="22" r="1.6" fill="#1f2937" />
    <circle cx="36" cy="22" r="1.6" fill="#1f2937" />
    <path d="M29 26q3 2.5 6 0" stroke="#9a3412" strokeWidth="1.2" fill="none" strokeLinecap="round" />
    <path d="M20 18a12 12 0 0 1 24 0z" fill="#ef4444" />
    <path d="M26 18a6 6 0 0 1 12 0z" fill="#fff" />
    <circle cx="32" cy="15.5" r="2.4" fill="#ef4444" stroke="#1f2937" strokeWidth="0.8" />
    <ellipse cx="32" cy="18.5" rx="13" ry="2.6" fill="#b91c1c" />
  </svg>
);

/**
 * "Hành trình Huấn luyện viên": an action RPG. Build a team of 5 (TeamBuilder), then walk
 * the trainer through 6 acts of wild areas, dungeons and boss lairs; the team fights by
 * itself, levels up and evolves. Progress is saved in localStorage (pokescan_quest_v1).
 */
export function TrainerQuestGame({ collection = [], allowScanned = false, onScanned, onGold, onClose, random = Math.random }) {
  const [saved, setSaved] = useState(() => loadQuest());
  const [screen, setScreen] = useState('menu'); // menu | build | play
  const [team, setTeam] = useState([]);
  const [start, setStart] = useState(null);
  const [confirmNew, setConfirmNew] = useState(false);
  const [round, setRound] = useState(0);

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && screen !== 'play' && onClose?.();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, screen]);
  useEffect(() => () => leaveLandscape(), []);

  const play = (s) => {
    enterLandscape();
    setStart(s);
    setRound((r) => r + 1);
    setScreen('play');
  };
  const info = describeSave(saved);

  if (screen === 'play' && start) {
    return createPortal(
      <QuestWorld
        key={round}
        start={start}
        random={random}
        onGold={onGold}
        onExit={() => {
          leaveLandscape();
          setSaved(loadQuest());
          setScreen('menu');
        }}
      />,
      document.body
    );
  }

  return createPortal(
    <div data-theme="dark" className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-0 sm:p-4 select-none" role="dialog" aria-label="Hành trình Huấn luyện viên" data-screen={screen}>
      <div className="relative flex flex-col w-full h-full sm:h-auto sm:max-h-full max-w-md overflow-y-auto sm:rounded-3xl sm:border-4 border-white/70 shadow-2xl bg-gradient-to-b from-emerald-900 via-slate-900 to-slate-950">
        <div className="sticky top-0 z-40 flex items-center gap-2 px-3 py-2 bg-gradient-to-r from-emerald-600 via-teal-600 to-sky-700 shadow-lg">
          <span className="shrink-0 text-white font-black">🧢 Hành trình Huấn luyện viên</span>
          <button type="button" onClick={onClose} aria-label="Đóng hành trình" className="ml-auto p-1.5 rounded-full bg-white/20 text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        {screen === 'menu' && (
          <div className="px-4 pt-4 pb-6 space-y-4 [@media(max-height:520px)]:pt-2 [@media(max-height:520px)]:space-y-2" data-testid="quest-menu">
            <div className="relative rounded-3xl overflow-hidden border-2 border-white/20 bg-gradient-to-b from-sky-400/40 via-emerald-500/30 to-emerald-800/40 p-4 [@media(max-height:520px)]:p-2 text-center">
              <div className="quest-menu-sun absolute -top-6 -right-6 w-28 h-28 rounded-full bg-amber-300/40 blur-xl" />
              <div className="relative flex items-end justify-center gap-1 [@media(max-height:520px)]:hidden">
                <img src={artworkUrl(25)} alt="" className="w-14 h-14 object-contain quest-menu-hop" style={{ animationDelay: '0.2s' }} />
                {TRAINER_SVG}
                <img src={artworkUrl(4)} alt="" className="w-14 h-14 object-contain quest-menu-hop" style={{ animationDelay: '0.5s' }} />
              </div>
              <p className="relative mt-2 [@media(max-height:520px)]:mt-0 text-2xl [@media(max-height:520px)]:text-lg font-black text-white drop-shadow">Hành trình Huấn luyện viên</p>
              <p className="relative text-xs font-bold text-white/85">Dẫn 5 Pokémon băng qua {ACTS.length} vùng đất, lên cấp, tiến hóa và hạ các Boss huyền thoại!</p>
            </div>

            {info && (
              <button type="button" onClick={() => play({ save: saved })} className="w-full p-3 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-lg active:scale-95 text-left" data-testid="quest-continue">
                <span className="flex items-center gap-2 text-lg font-black">
                  <Play className="w-6 h-6" /> Tiếp tục hành trình
                </span>
                <span className="block text-xs font-bold text-white/85">
                  Màn {info.actNumber}: {info.actName} · {info.areaName} · Đã hạ {info.beaten} Boss
                </span>
                <span className="mt-1.5 flex gap-1">
                  {info.party.map((m) => (
                    <span key={m.name} className="relative w-11 h-11 rounded-xl bg-white/20">
                      <img src={m.image} alt={m.name} className="w-full h-full object-contain" />
                      <span className="absolute -bottom-1 -right-1 px-1 rounded bg-slate-900 text-[9px] font-black text-amber-300">{m.level}</span>
                    </span>
                  ))}
                </span>
              </button>
            )}

            {confirmNew ? (
              <div className="p-3 rounded-2xl bg-rose-500/20 border-2 border-rose-400/60 space-y-2" role="alertdialog" aria-label="Bắt đầu hành trình mới?">
                <p className="text-sm font-black text-white">Bắt đầu lại từ đầu? Hành trình cũ sẽ bị xóa.</p>
                <div className="flex gap-2">
                  <button type="button" onClick={() => setConfirmNew(false)} className="flex-1 py-2.5 rounded-xl bg-white/15 text-white font-black">
                    Thôi
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      clearQuest();
                      setSaved(null);
                      setConfirmNew(false);
                      setTeam([]);
                      setScreen('build');
                    }}
                    className="flex-1 py-2.5 rounded-xl bg-rose-500 text-white font-black"
                  >
                    Bắt đầu lại
                  </button>
                </div>
              </div>
            ) : (
              <button type="button" onClick={() => (info ? setConfirmNew(true) : setScreen('build'))} className={`w-full py-3.5 rounded-2xl text-lg font-black shadow-lg flex items-center justify-center gap-2 active:scale-95 ${info ? 'bg-white/15 text-white' : 'bg-gradient-to-r from-amber-400 to-orange-500 text-slate-900'}`} data-testid="quest-new">
                <Swords className="w-6 h-6" /> Hành trình mới
              </button>
            )}

            <ul className="rounded-2xl bg-white/10 p-3 text-xs font-bold text-white/85 space-y-1">
              <li>🕹️ Kéo bên trái màn hình (hoặc phím WASD) để dẫn đường.</li>
              <li>⚔️ Cả đội tự đánh Pokémon hoang dã. Bấm chiêu 1, 2 và ⚡ của Pokémon dẫn đầu.</li>
              <li>⭐ Hạ Pokémon hoang dã để lên cấp. Đủ cấp là tiến hóa!</li>
              <li>🎁 Đi qua đồ rơi để nhặt. Rương báu mở khi bé đến gần.</li>
              <li>🏥 Về làng để hồi máu ở Trung tâm Pokémon và mua đồ ở Cửa hàng.</li>
              <li>🟥 Vùng đỏ: Boss sắp đánh vào đó – dẫn cả đội chạy ra ngoài!</li>
            </ul>
          </div>
        )}

        {screen === 'build' && (
          <TeamBuilder
            nextLabel="Bắt đầu hành trình"
            collection={collection}
            allowScanned={allowScanned}
            team={team}
            setTeam={setTeam}
            onScanned={onScanned}
            onNext={() => play({ team, seed: Math.floor(random() * 2 ** 31) })}
            random={random}
            size={5}
          />
        )}
      </div>
    </div>,
    document.body
  );
}
