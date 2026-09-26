import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import confetti from 'canvas-confetti';
import { X, Swords, RotateCcw, Clock } from 'lucide-react';
import { OPPONENT_POOL } from '../../utils/battle/opponentPool';
import { TYPE_COLORS, TYPE_VI } from '../../utils/battle/typeChart';
import { pickOpponentTeam } from '../../utils/team/teamBattle';
import { memberFromPool } from '../../utils/team/members';
import { kitOf } from '../../utils/moba/engine';
import { goldForMoba } from '../../utils/gold';
import { TeamBuilder } from '../team/TeamBuilder';
import { GoldReward } from '../kidgames/Common';
import { MobaMatch } from './MobaMatch';
import { LandscapeFrame } from './LandscapeFrame';

const MINUTES = [1, 2, 3, 5];
const MINUTES_KEY = 'pokescan_moba_minutes';
const readMinutes = () => {
  try {
    const m = Number(localStorage.getItem(MINUTES_KEY));
    return MINUTES.includes(m) ? m : 3;
  } catch {
    return 3;
  }
};

// Team size: a duel, three a side or the full five
const MODES = [
  { size: 1, label: '1 vs 1', hint: 'Đấu tay đôi', icon: '🥊' },
  { size: 3, label: '3 vs 3', hint: 'Đội nhỏ', icon: '⚔️' },
  { size: 5, label: '5 vs 5', hint: 'Đội đầy đủ', icon: '🏟️' },
];
const MODE_KEY = 'pokescan_moba_mode';
const readMode = () => {
  try {
    const n = Number(localStorage.getItem(MODE_KEY));
    return MODES.some((m) => m.size === n) ? n : 5;
  } catch {
    return 5;
  }
};

function ModePicker({ size, onChange }) {
  return (
    <div className="px-4 pt-3" data-testid="moba-mode">
      <p className="text-sm font-black text-white/90">Chọn chế độ</p>
      <div className="mt-1.5 grid grid-cols-3 gap-2" role="radiogroup" aria-label="Chế độ đấu">
        {MODES.map((m) => {
          const on = m.size === size;
          return (
            <button
              key={m.size}
              role="radio"
              aria-checked={on}
              aria-label={m.label}
              onClick={() => onChange(m.size)}
              className={`relative overflow-hidden flex flex-col items-center py-2 rounded-2xl border-2 transition-all active:scale-95 ${on ? 'border-amber-300 bg-gradient-to-b from-amber-400 to-orange-500 text-slate-900 scale-105 shadow-lg shadow-amber-500/30' : 'border-white/20 bg-white/10 text-white'}`}
            >
              <span className="text-2xl leading-none" aria-hidden="true">{m.icon}</span>
              <span className="mt-1 text-base font-black leading-none">{m.label}</span>
              <span className={`text-[10px] font-bold ${on ? 'text-slate-900/75' : 'text-white/60'}`}>{m.hint}</span>
              <span className="mt-1 flex gap-0.5" aria-hidden="true">
                {Array.from({ length: m.size }).map((_, i) => (
                  <span key={i} className={`w-1.5 h-1.5 rounded-full ${on ? 'bg-slate-900/70' : 'bg-sky-300'}`} />
                ))}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

async function enterLandscape() {
  try {
    await document.documentElement.requestFullscreen?.();
    await window.screen?.orientation?.lock?.('landscape');
  } catch {
    // Not supported (iPhone, desktop): the game turns itself when the phone is upright
  }
}
function leaveLandscape() {
  try {
    window.screen?.orientation?.unlock?.();
    if (document.fullscreenElement) document.exitFullscreen?.();
  } catch {
    // ignore
  }
}

function DashTeam({ team, result, maxDealt }) {
  const rows = result.rows.filter((r) => r.team === team);
  const kills = rows.reduce((a, r) => a + r.kills, 0);
  return (
    <div className={`flex-1 min-w-0 rounded-2xl p-2 ${team === 'blue' ? 'bg-sky-950/70 border border-sky-400/40' : 'bg-rose-950/70 border border-rose-400/40'}`} data-testid={`dash-${team}`}>
      <p className={`px-1 pb-1 text-sm font-black ${team === 'blue' ? 'text-sky-300' : 'text-rose-300'}`}>
        {team === 'blue' ? '🔵 Đội của bé' : '🔴 Đội đối thủ'} · {kills} hạ gục
      </p>
      <div className="grid grid-cols-[1fr_auto_4.5rem] gap-x-2 px-1 text-[10px] font-black text-white/60">
        <span>Pokémon</span>
        <span className="text-center">H / C / HT</span>
        <span>Sát thương</span>
      </div>
      {rows.map((r, i) => (
        <div key={r.id} className="result-rise grid grid-cols-[1fr_auto_4.5rem] items-center gap-x-2 px-1 py-1 border-t border-white/10" style={{ animationDelay: `${150 + i * 70}ms` }} data-testid="dash-row">
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
          <span className="text-xs font-black text-white tabular-nums text-center">
            <span className="text-emerald-300">{r.kills}</span> / <span className="text-rose-300">{r.deaths}</span> / <span className="text-sky-300">{r.assists}</span>
          </span>
          <span>
            <span className="block h-2 rounded-full bg-black/40 overflow-hidden">
              <span className={`block h-full ${team === 'blue' ? 'bg-sky-400' : 'bg-rose-400'}`} style={{ width: `${(r.dealt / maxDealt) * 100}%` }} />
            </span>
            <span className="block text-[9px] font-bold text-white/70 tabular-nums">
              {r.dealt} · nhận {r.taken}
              {r.healed > 50 ? ` · hồi ${r.healed}` : ''}
            </span>
          </span>
        </div>
      ))}
    </div>
  );
}

/** Dashboard after the match (like the big online games): result, score and every Pokemon's stats. */
export function MobaDashboard({ result, gold, onReplay, onClose }) {
  const win = result.winner === 'blue';
  const draw = result.winner === 'draw';
  useEffect(() => {
    if (!win) return;
    try {
      confetti({ particleCount: 150, spread: 100, origin: { y: 0.4 }, zIndex: 9999 });
    } catch {
      // decoration
    }
  }, [win]);
  const maxDealt = Math.max(1, ...result.rows.map((r) => r.dealt));
  return (
    <div className="absolute inset-0 z-50 overflow-y-auto bg-gradient-to-b from-slate-950/95 via-indigo-950/95 to-slate-950/95 p-3" data-testid="moba-dashboard" data-winner={result.winner} data-blue={result.score.blue} data-red={result.score.red}>
      <div className="flex items-center justify-center gap-4">
        <p className={`result-rise sport-banner text-4xl font-black italic bg-gradient-to-b ${win ? 'from-amber-200 via-yellow-300 to-orange-500' : draw ? 'from-sky-200 to-indigo-400' : 'from-slate-200 to-slate-500'} bg-clip-text text-transparent`}>
          {win ? 'CHIẾN THẮNG!' : draw ? 'HÒA!' : 'THẤT BẠI'}
        </p>
        <p className="result-rise text-3xl font-black tabular-nums" style={{ animationDelay: '100ms' }}>
          <span className="text-sky-300">{result.score.blue}</span>
          <span className="text-white/50"> : </span>
          <span className="text-rose-400">{result.score.red}</span>
        </p>
        <span className="result-rise text-xs font-bold text-white/60" style={{ animationDelay: '150ms' }}>
          {Math.round(result.duration / 60)} phút
        </span>
      </div>
      <div className="mt-2 flex gap-2">
        <DashTeam team="blue" result={result} maxDealt={maxDealt} />
        <DashTeam team="red" result={result} maxDealt={maxDealt} />
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-center gap-3">
        <GoldReward amount={gold} dark />
        <button onClick={onReplay} className="px-5 py-2.5 rounded-2xl bg-red-500 text-white font-black flex items-center gap-2 active:scale-95">
          <RotateCcw className="w-5 h-5" /> Đấu lại
        </button>
        <button onClick={onClose} className="px-6 py-2.5 rounded-2xl bg-sky-600 text-white font-black active:scale-95">
          Xong
        </button>
      </div>
    </div>
  );
}

/**
 * "Đấu trường Pokémon": 1 vs 1, 3 vs 3 or 5 vs 5 in real time on a landscape map. Build a team (scan cards,
 * missing places lent), pick the match length and who to control, then fight. When the
 * time is up the team with more knock-outs wins; a dashboard shows everyone's stats.
 */
export function MobaGame({ collection = [], allowScanned = false, onScanned, onGold, onClose, random = Math.random }) {
  const [screen, setScreen] = useState('build'); // build | setup | play | result
  const [team, setTeam] = useState([]);
  const [size, setSize] = useState(readMode);
  const [minutes, setMinutes] = useState(readMinutes);
  const [control, setControl] = useState(0);
  const [foes, setFoes] = useState([]);
  const [result, setResult] = useState(null);
  const [round, setRound] = useState(0);

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && screen !== 'play' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, screen]);
  useEffect(() => () => leaveLandscape(), []);

  const changeMode = (n) => {
    setSize(n);
    setTeam((list) => list.slice(0, n));
    setControl((c) => Math.min(c, n - 1));
    try {
      localStorage.setItem(MODE_KEY, String(n));
    } catch {
      // ignore
    }
  };

  const toSetup = () => {
    const players = team.map((m) => ({ ...m, bst: m.power, types: m.types?.length ? m.types : ['normal'] }));
    setFoes(pickOpponentTeam(players, OPPONENT_POOL, random).map(memberFromPool));
    setScreen('setup');
  };

  const start = () => {
    try {
      localStorage.setItem(MINUTES_KEY, String(minutes));
    } catch {
      // ignore
    }
    enterLandscape();
    setRound((r) => r + 1);
    setScreen('play');
  };

  const finish = (sum) => {
    const kills = sum.score.blue;
    const gold = goldForMoba(sum.winner === 'blue' ? 'win' : sum.winner === 'draw' ? 'draw' : 'lose', kills);
    onGold?.(gold);
    setResult({ ...sum, gold });
    setScreen('result');
  };

  const toFighter = (m) => ({ name: m.name, image: m.image, types: (m.types?.length ? m.types : ['normal']).map((t) => String(t).toLowerCase()), power: m.power || m.bst || 400 });

  if (screen === 'play' || screen === 'result') {
    return createPortal(
      <>
        {screen === 'play' && (
          <MobaMatch
            key={round}
            blue={team.map(toFighter)}
            red={foes.map(toFighter)}
            minutes={minutes}
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
          <div className="fixed inset-0 z-[80] bg-black" role="dialog" aria-label="Kết quả đấu trường">
            <LandscapeFrame>
            <MobaDashboard
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
    <div data-theme="dark" className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-0 sm:p-4 select-none" role="dialog" aria-label="Đấu trường Pokémon" data-screen={screen}>
      <div className="relative flex flex-col w-full h-full sm:h-auto sm:max-h-full max-w-md overflow-y-auto sm:rounded-3xl sm:border-4 border-white/70 shadow-2xl bg-gradient-to-b from-emerald-900 via-teal-900 to-slate-950">
        <div className="sticky top-0 z-40 flex items-center gap-2 px-3 py-2 bg-gradient-to-r from-emerald-600 via-teal-600 to-sky-700 shadow-lg">
          <span className="shrink-0 text-white font-black">🗺️ Đấu trường Pokémon</span>
          <span className="px-2 py-0.5 rounded-full bg-white/20 text-white text-xs font-black" data-testid="moba-mode-chip">{size} vs {size}</span>
          <button onClick={onClose} aria-label="Đóng đấu trường" className="ml-auto p-1.5 rounded-full bg-white/20 text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        {screen === 'build' && <ModePicker size={size} onChange={changeMode} />}
        {screen === 'build' && <TeamBuilder collection={collection} allowScanned={allowScanned} team={team} setTeam={setTeam} onScanned={onScanned} onNext={toSetup} random={random} size={size} />}

        {screen === 'setup' && (
          <div className="px-4 pt-3 pb-5 space-y-4" data-testid="moba-setup">
            <div>
              <p className="flex items-center gap-2 text-lg font-black text-white">
                <Clock className="w-5 h-5" /> Thời gian trận đấu
              </p>
              <div className="mt-2 grid grid-cols-4 gap-2" role="radiogroup" aria-label="Thời gian trận đấu">
                {MINUTES.map((m) => (
                  <button key={m} role="radio" aria-checked={minutes === m} onClick={() => setMinutes(m)} className={`py-3 rounded-2xl font-black transition-all ${minutes === m ? 'bg-amber-400 text-slate-900 scale-105 shadow-lg' : 'bg-white/10 text-white'}`}>
                    {m} phút
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="text-lg font-black text-white">Bé điều khiển Pokémon nào?</p>
              {team.length > 1 && <p className="text-xs font-bold text-white/70">Trong trận có thể đổi bất cứ lúc nào bằng cách chạm ảnh đồng đội.</p>}
              <div className="mt-2 grid gap-2 mx-auto" style={{ gridTemplateColumns: `repeat(${team.length}, minmax(0, 1fr))`, maxWidth: `${Math.max(28, team.length * 20)}%` }} role="radiogroup" aria-label="Pokémon điều khiển">
                {team.map((m, i) => (
                  <button key={m.key} role="radio" aria-checked={control === i} aria-label={m.name} onClick={() => setControl(i)} className={`flex flex-col items-center p-1 rounded-2xl border-2 ${control === i ? 'border-amber-300 bg-amber-300/20' : 'border-white/20 bg-white/5'}`}>
                    <img src={m.image} alt="" className="w-12 h-12 object-contain" />
                    <span className="w-full text-center text-[10px] font-black text-white truncate">{m.name}</span>
                    <span className="text-[9px] font-bold text-amber-200 truncate w-full text-center">{kitOf((m.types || ['normal']).map((t) => String(t).toLowerCase()))[3]}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="rounded-2xl bg-black/30 p-3">
              <p className="text-sm font-black text-rose-300">🔴 Đội đối thủ</p>
              <div className={`mt-1 flex ${foes.length > 1 ? 'justify-between' : 'justify-center'}`}>
                {foes.map((f) => (
                  <span key={f.key} className="flex flex-col items-center w-14">
                    <img src={f.image} alt={f.name} className="w-12 h-12 object-contain" />
                    <span className="text-[10px] font-black text-white truncate w-full text-center">{f.name}</span>
                  </span>
                ))}
              </div>
            </div>

            <ul className="rounded-2xl bg-white/10 p-3 text-xs font-bold text-white/85 space-y-1">
              <li>🕹️ Kéo ngón tay ở nửa trái màn hình để di chuyển. Pokémon tự đánh thường khi đối thủ ở gần.</li>
              <li>1️⃣ 2️⃣ Hai chiêu thức hồi rất nhanh (0,5 giây), ⚡ Tuyệt kỹ liên hoàn khi đầy năng lượng.</li>
              <li>💨 Tốc biến: dịch chuyển nhanh theo hướng đang đi, dùng lại sau 10 giây.</li>
              <li>🏠 Về nhà chính để hồi máu. Pokémon bị hạ gục sẽ hồi sinh ở nhà chính sau 5 giây.</li>
              <li>🏆 Hết giờ, đội hạ gục được nhiều hơn sẽ thắng. Game chơi màn hình ngang.</li>
            </ul>

            <div className="flex gap-2">
              <button onClick={() => setScreen('build')} className="px-4 py-3.5 rounded-2xl bg-white/15 text-white font-black">
                Đổi đội
              </button>
              <button onClick={start} className="flex-1 py-3.5 rounded-2xl bg-gradient-to-r from-orange-500 via-red-500 to-purple-600 text-white text-lg font-black shadow-lg flex items-center justify-center gap-2 active:scale-95">
                <Swords className="w-6 h-6" /> Vào trận!
              </button>
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}

