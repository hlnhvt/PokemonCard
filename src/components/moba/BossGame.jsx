import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import confetti from 'canvas-confetti';
import { X, Swords, RotateCcw, Clock } from 'lucide-react';
import { TYPE_COLORS, TYPE_VI } from '../../utils/battle/typeChart';
import { kitOf } from '../../utils/moba/engine';
import { BOSSES, DIFFICULTY, bossById, bossImage } from '../../utils/moba/boss';
import { goldForBoss } from '../../utils/gold';
import { TeamBuilder } from '../team/TeamBuilder';
import { GoldReward } from '../kidgames/Common';
import { MobaMatch } from './MobaMatch';
import { LandscapeFrame } from './LandscapeFrame';
import { MapPicker } from './MapPicker';
import { readMapId } from './mapChoice';
import { enterLandscape, leaveLandscape } from './landscape';

const MINUTES = [2, 3, 5];
const fmt = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

/** After the raid: did the team win, how much HP the boss had left, who did the most damage. */
export function BossDashboard({ result, gold, onReplay, onClose }) {
  const win = result.winner === 'blue';
  useEffect(() => {
    if (!win) return;
    try {
      confetti({ particleCount: 180, spread: 110, origin: { y: 0.4 }, zIndex: 9999 });
    } catch {
      // decoration
    }
  }, [win]);
  const kids = result.rows.filter((r) => r.team === 'blue');
  const maxDealt = Math.max(1, ...kids.map((r) => r.dealt));
  const b = result.boss;
  const left = b ? b.hp / b.maxHp : 0;
  return (
    <div className="absolute inset-0 z-50 overflow-y-auto bg-gradient-to-b from-slate-950/95 via-rose-950/95 to-slate-950/95 p-3" data-testid="boss-dashboard" data-winner={result.winner}>
      <div className="flex items-center justify-center gap-4">
        <div className="relative">
          <img src={b?.image} alt={b?.name} className={`w-24 h-24 object-contain ${win ? 'grayscale opacity-60 rotate-12' : 'battle-victory'}`} />
          {win && <span className="pop-in absolute inset-0 flex items-center justify-center text-5xl">💥</span>}
        </div>
        <div>
          <p className={`result-rise sport-banner text-4xl font-black italic bg-gradient-to-b ${win ? 'from-amber-200 via-yellow-300 to-orange-500' : 'from-slate-200 to-slate-500'} bg-clip-text text-transparent`}>{win ? 'HẠ BOSS RỒI!' : 'BOSS THẮNG...'}</p>
          <p className="result-rise text-sm font-bold text-white/80" style={{ animationDelay: '100ms' }}>
            {win ? `Hạ ${b?.name} sau ${fmt(b?.time || 0)}` : `${b?.name} còn ${Math.ceil(left * 100)}% máu – thử lại nhé!`} · {DIFFICULTY[result.difficulty]?.label}
          </p>
          <div className="mt-1 h-3 w-56 rounded-full bg-black/60 overflow-hidden border border-white/20">
            <div className="h-full bg-gradient-to-r from-rose-400 to-red-600" style={{ width: `${left * 100}%` }} />
          </div>
        </div>
      </div>
      <div className="mt-3 rounded-2xl bg-sky-950/70 border border-sky-400/40 p-2" data-testid="boss-rows">
        <p className="px-1 pb-1 text-sm font-black text-sky-300">🔵 Đội của bé · sát thương lên Boss</p>
        {kids.map((r, i) => (
          <div key={r.id} className="result-rise grid grid-cols-[1fr_7rem_2.5rem] items-center gap-2 px-1 py-1 border-t border-white/10" style={{ animationDelay: `${150 + i * 70}ms` }} data-testid="boss-row">
            <span className="flex items-center gap-1.5 min-w-0">
              <img src={r.image} alt="" className="w-8 h-8 object-contain shrink-0" />
              <span className="min-w-0">
                <span className="block text-xs font-black text-white truncate">
                  {r.name}
                  {r.id === result.mvp && <span className="ml-1 px-1 rounded bg-amber-400 text-slate-900 text-[9px]">MVP</span>}
                </span>
                <span className="block text-[9px] font-bold" style={{ color: TYPE_COLORS[r.types[0]] }}>{TYPE_VI[r.types[0]]}</span>
              </span>
            </span>
            <span>
              <span className="block h-2 rounded-full bg-black/40 overflow-hidden">
                <span className="block h-full bg-gradient-to-r from-amber-300 to-orange-500" style={{ width: `${(r.dealt / maxDealt) * 100}%` }} />
              </span>
              <span className="block text-[9px] font-bold text-white/70 tabular-nums">{r.dealt}</span>
            </span>
            <span className="text-[10px] font-black text-rose-300 text-center" title="Số lần bị hạ">💫{r.deaths}</span>
          </div>
        ))}
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-center gap-3">
        <GoldReward amount={gold} dark />
        <button onClick={onReplay} className="px-5 py-2.5 rounded-2xl bg-red-500 text-white font-black flex items-center gap-2 active:scale-95">
          <RotateCcw className="w-5 h-5" /> Đánh lại
        </button>
        <button onClick={onClose} className="px-6 py-2.5 rounded-2xl bg-sky-600 text-white font-black active:scale-95">
          Xong
        </button>
      </div>
    </div>
  );
}

/**
 * "Săn Boss": the whole team (scan cards, missing places lent) against one huge Pokemon on the
 * arena map. Pick the boss, how hard, the map and the time; knock the boss out before the time
 * runs out. Red shapes on the ground warn where the boss is about to hit.
 */
export function BossGame({ collection = [], allowScanned = false, onScanned, onGold, onClose, random = Math.random }) {
  const [screen, setScreen] = useState('build'); // build | setup | play | result
  const [team, setTeam] = useState([]);
  const [bossId, setBossId] = useState(BOSSES[0].id);
  const [difficulty, setDifficulty] = useState('normal');
  const [mapId, setMapId] = useState(readMapId);
  const [minutes, setMinutes] = useState(3);
  const [control, setControl] = useState(0);
  const [result, setResult] = useState(null);
  const [round, setRound] = useState(0);

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && screen !== 'play' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, screen]);
  useEffect(() => () => leaveLandscape(), []);

  const toFighter = (m) => ({ name: m.name, image: m.image, types: (m.types?.length ? m.types : ['normal']).map((t) => String(t).toLowerCase()), power: m.power || m.bst || 400 });
  const boss = bossById(bossId);

  const start = () => {
    enterLandscape();
    setRound((r) => r + 1);
    setScreen('play');
  };
  const finish = (sum) => {
    const won = sum.winner === 'blue';
    const dmg = sum.boss ? 1 - sum.boss.hp / sum.boss.maxHp : 0;
    const gold = goldForBoss(won, difficulty, dmg);
    onGold?.(gold);
    setResult({ ...sum, gold });
    setScreen('result');
  };

  if (screen === 'play' || screen === 'result') {
    return createPortal(
      <>
        {screen === 'play' && (
          <MobaMatch
            key={round}
            blue={team.map(toFighter)}
            red={[]}
            boss={{ id: bossId, difficulty }}
            minutes={minutes}
            mapId={mapId}
            control={control}
            random={random}
            onEnd={finish}
            onQuit={() => {
              leaveLandscape();
              setScreen('setup');
            }}
          />
        )}
        {screen === 'result' && result && (
          <div className="fixed inset-0 z-[80] bg-black" role="dialog" aria-label="Kết quả săn Boss">
            <LandscapeFrame>
              <BossDashboard
                result={result}
                gold={result.gold}
                onReplay={() => {
                  leaveLandscape();
                  setResult(null);
                  setScreen('setup');
                }}
                onClose={() => {
                  leaveLandscape();
                  onClose();
                }}
              />
            </LandscapeFrame>
          </div>
        )}
      </>,
      document.body
    );
  }

  return createPortal(
    <div data-theme="dark" className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-0 sm:p-4 select-none" role="dialog" aria-label="Săn Boss" data-screen={screen}>
      <div className="relative flex flex-col w-full h-full sm:h-auto sm:max-h-full max-w-md overflow-y-auto sm:rounded-3xl sm:border-4 border-white/70 shadow-2xl bg-gradient-to-b from-rose-950 via-slate-900 to-slate-950">
        <div className="sticky top-0 z-40 flex items-center gap-2 px-3 py-2 bg-gradient-to-r from-red-700 via-rose-600 to-purple-700 shadow-lg">
          <span className="shrink-0 text-white font-black">👑 Săn Boss</span>
          <span className="px-2 py-0.5 rounded-full bg-white/20 text-white text-xs font-black">5 vs Boss</span>
          <button onClick={onClose} aria-label="Đóng săn Boss" className="ml-auto p-1.5 rounded-full bg-white/20 text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        {screen === 'build' && <TeamBuilder collection={collection} allowScanned={allowScanned} team={team} setTeam={setTeam} onScanned={onScanned} onNext={() => setScreen('setup')} random={random} />}

        {screen === 'setup' && (
          <div className="px-4 pt-3 pb-5 space-y-4" data-testid="boss-setup">
            <div>
              <p className="text-lg font-black text-white">👑 Chọn Boss</p>
              <div className="mt-2 grid grid-cols-3 gap-2" role="radiogroup" aria-label="Boss">
                {BOSSES.map((b) => {
                  const on = b.id === bossId;
                  return (
                    <button key={b.id} role="radio" aria-checked={on} aria-label={b.name} onClick={() => setBossId(b.id)} className={`relative flex flex-col items-center p-1.5 rounded-2xl border-2 transition-all active:scale-95 ${on ? 'border-amber-300 bg-gradient-to-b from-rose-500/40 to-purple-700/40 scale-105 shadow-lg shadow-rose-500/30' : 'border-white/15 bg-white/5'}`}>
                      <img src={bossImage(b)} alt="" className={`w-16 h-16 object-contain ${on ? 'battle-idle drop-shadow-[0_0_12px_rgba(244,63,94,0.8)]' : 'opacity-75'}`} />
                      <span className="text-xs font-black text-white">{b.name}</span>
                      <span className="text-[9px] font-bold text-rose-200 text-center leading-tight">{b.title}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <p className="text-lg font-black text-white">Độ khó</p>
              <div className="mt-2 grid grid-cols-3 gap-2" role="radiogroup" aria-label="Độ khó">
                {Object.entries(DIFFICULTY).map(([id, d]) => (
                  <button key={id} role="radio" aria-checked={difficulty === id} aria-label={d.label} onClick={() => setDifficulty(id)} className={`py-2.5 rounded-2xl font-black transition-all ${difficulty === id ? 'bg-amber-400 text-slate-900 scale-105 shadow-lg' : 'bg-white/10 text-white'}`}>
                    <span className="block text-xl leading-none">{d.icon}</span>
                    {d.label}
                  </button>
                ))}
              </div>
            </div>

            <MapPicker value={mapId} onChange={setMapId} />

            <div>
              <p className="flex items-center gap-2 text-lg font-black text-white">
                <Clock className="w-5 h-5" /> Thời gian
              </p>
              <div className="mt-2 grid grid-cols-3 gap-2" role="radiogroup" aria-label="Thời gian săn Boss">
                {MINUTES.map((m) => (
                  <button key={m} role="radio" aria-checked={minutes === m} onClick={() => setMinutes(m)} className={`py-3 rounded-2xl font-black transition-all ${minutes === m ? 'bg-amber-400 text-slate-900 scale-105 shadow-lg' : 'bg-white/10 text-white'}`}>
                    {m} phút
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="text-lg font-black text-white">Bé điều khiển Pokémon nào?</p>
              <div className="mt-2 grid grid-cols-5 gap-2" role="radiogroup" aria-label="Pokémon điều khiển">
                {team.map((m, i) => (
                  <button key={m.key} role="radio" aria-checked={control === i} aria-label={m.name} onClick={() => setControl(i)} className={`flex flex-col items-center p-1 rounded-2xl border-2 ${control === i ? 'border-amber-300 bg-amber-300/20' : 'border-white/20 bg-white/5'}`}>
                    <img src={m.image} alt="" className="w-12 h-12 object-contain" />
                    <span className="w-full text-center text-[10px] font-black text-white truncate">{m.name}</span>
                    <span className="text-[9px] font-bold text-amber-200 truncate w-full text-center">{kitOf((m.types || ['normal']).map((t) => String(t).toLowerCase()))[3]}</span>
                  </button>
                ))}
              </div>
            </div>

            <ul className="rounded-2xl bg-white/10 p-3 text-xs font-bold text-white/85 space-y-1">
              <li>👑 Cả đội cùng đánh {boss.name}. Hạ Boss trước khi hết giờ là thắng!</li>
              <li>🟥 Vùng đỏ trên mặt đất: Boss sắp đánh vào đó – chạy ra ngoài ngay!</li>
              <li>🔥 Boss còn ít máu sẽ nổi giận: đánh nhanh và mạnh hơn.</li>
              <li>🏠 Về nhà chính để hồi máu, Boss không vào được nhà của bé.</li>
            </ul>

            <div className="flex gap-2">
              <button onClick={() => setScreen('build')} className="px-4 py-3.5 rounded-2xl bg-white/15 text-white font-black">
                Đổi đội
              </button>
              <button onClick={start} className="flex-1 py-3.5 rounded-2xl bg-gradient-to-r from-red-600 via-rose-500 to-purple-600 text-white text-lg font-black shadow-lg flex items-center justify-center gap-2 active:scale-95">
                <Swords className="w-6 h-6" /> Săn Boss!
              </button>
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
