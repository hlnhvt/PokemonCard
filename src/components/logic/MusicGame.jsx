import React, { useEffect, useRef, useState } from 'react';
import confetti from 'canvas-confetti';
import { Music, ArrowLeft } from 'lucide-react';
import { NOTES, SONGS, startSong, pressNote, noteTimes, musicStars } from '../../utils/logic/music';
import { goldForStars } from '../../utils/gold';
import { sounds } from '../../utils/soundEffects';
import { KidGameShell, SessionSummary } from '../kidgames/Common';
import { PokeballIcon } from '../PokeballIcon';
import { useLater } from '../sports/sportsKit';

const SONG_ICONS = { twinkle: '⭐', mary: '🐑', jingle: '🔔', joy: '🎉' };
const LANE_SIZE = 7;

function Xylophone({ onHit, target, lit, hits }) {
  return (
    <div className="relative mx-auto w-full max-w-md px-2 pt-8 pb-4 rounded-3xl bg-gradient-to-b from-amber-800 to-amber-950 shadow-2xl" data-testid="xylophone">
      {/* Frame rails */}
      <span className="absolute left-3 right-3 top-[38%] h-2 rounded-full bg-amber-950/80" />
      <span className="absolute left-3 right-3 top-[72%] h-2 rounded-full bg-amber-950/80" />
      <div className="relative flex items-end justify-between gap-1.5">
        {NOTES.map((n, i) => {
          const isTarget = target === i;
          const isLit = lit === i;
          return (
            <button
              key={n.id}
              onPointerDown={(e) => {
                e.preventDefault();
                onHit(i);
              }}
              aria-label={`Phím ${n.label}`}
              className="relative flex-1 flex flex-col items-center touch-none select-none"
            >
              {isTarget && (
                <span className="guide-bounce absolute left-1/2 -top-8 pointer-events-none" aria-hidden="true">
                  <PokeballIcon className="w-7 h-7 drop-shadow" />
                </span>
              )}
              <span
                key={hits[i] || 0}
                className={`relative w-full rounded-xl border-b-4 border-black/25 shadow-lg ${hits[i] ? 'bar-hit' : ''} ${isTarget ? 'guide-glow' : ''}`}
                style={{
                  height: `${210 - i * 12}px`,
                  background: `linear-gradient(180deg, ${n.color}, ${n.color}cc 60%, ${n.color}99)`,
                  filter: isLit ? 'brightness(1.45) saturate(1.2)' : undefined,
                  '--glow': n.color,
                }}
              >
                <span className="absolute left-1/2 top-3 -translate-x-1/2 w-2.5 h-2.5 rounded-full bg-white/80 shadow-inner" />
                <span className="absolute left-1/2 bottom-3 -translate-x-1/2 w-2.5 h-2.5 rounded-full bg-white/80 shadow-inner" />
                <span className="absolute inset-x-0 top-1/2 -translate-y-1/2 text-center text-sm font-black text-white drop-shadow">{n.label}</span>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/**
 * "Pokémon chơi nhạc": pick a song, then tap the bar that lights up (a bouncing Pokeball
 * shows it, and the next notes scroll above). At the end the whole song plays back and
 * the Pokemon dances. Free play has no guide.
 */
export function MusicGame({ player, onClose, onGold }) {
  const [mode, setMode] = useState('pick'); // pick | play | playback | done | free
  const [play, setPlay] = useState(null);
  const [hits, setHits] = useState({});
  const [floats, setFloats] = useState([]);
  const [lit, setLit] = useState(-1);
  const [dance, setDance] = useState(0);
  const paid = useRef(false);
  const floatId = useRef(0);
  const later = useLater();

  const song = play?.song;

  const ring = (i) => {
    sounds.playNote(NOTES[i].freq);
    setHits((h) => ({ ...h, [i]: (h[i] || 0) + 1 }));
    const id = ++floatId.current;
    setFloats((list) => [...list.slice(-8), { id, bar: i, drift: Math.round((Math.random() - 0.5) * 50) }]);
    later(() => setFloats((list) => list.filter((f) => f.id !== id)), 1000);
  };

  const hit = (i) => {
    ring(i);
    if (mode === 'free') {
      setDance((d) => d + 1);
      return;
    }
    if (mode !== 'play' || !play) return;
    const out = pressNote(play, i);
    setPlay(out.state);
    if (out.correct) setDance((d) => d + 1);
    if (out.state.done) later(() => setMode('playback'), 700);
  };

  // Play the whole song back, lighting the bars in time
  useEffect(() => {
    if (mode !== 'playback' || !song) return undefined;
    const times = noteTimes(song);
    const timers = times.map((n) =>
      setTimeout(() => {
        sounds.playNote(NOTES[n.note].freq, { duration: Math.max(0.5, n.duration) });
        setLit(n.note);
        setHits((h) => ({ ...h, [n.note]: (h[n.note] || 0) + 1 }));
      }, 400 + n.start * 1000)
    );
    const end = times[times.length - 1];
    timers.push(
      setTimeout(() => {
        setLit(-1);
        setMode('done');
        try {
          confetti({ particleCount: 120, spread: 90, origin: { y: 0.45 }, zIndex: 9999 });
        } catch {
          // decoration
        }
      }, 400 + (end.start + end.duration) * 1000 + 500)
    );
    return () => timers.forEach(clearTimeout);
  }, [mode, song]);

  useEffect(() => {
    if (mode !== 'done' || !play || paid.current) return;
    paid.current = true;
    onGold?.(goldForStars(musicStars(play.mistakes, play.song.melody.length)));
    sounds.playSuccessFanfare();
  }, [mode, play, onGold]);

  const choose = (s) => {
    paid.current = false;
    setPlay(startSong(s));
    setMode('play');
  };

  const target = mode === 'play' && play && !play.done ? play.song.melody[play.index].note : null;
  const upcoming = mode === 'play' && play ? play.song.melody.slice(play.index, play.index + LANE_SIZE) : [];
  const stars = play ? musicStars(play.mistakes, play.song.melody.length) : 1;
  const dancing = mode === 'playback' || mode === 'free';

  return (
    <KidGameShell
      title="🎵 Pokémon chơi nhạc"
      label="Pokémon chơi nhạc"
      round={mode === 'pick' || mode === 'free' ? 0 : mode === 'play' ? 1 : 2}
      rounds={3}
      onClose={onClose}
      background="bg-gradient-to-b from-indigo-900 via-purple-800 to-fuchsia-700"
      dataAttrs={{ 'data-mode': mode, 'data-index': play?.index ?? 0, 'data-mistakes': play?.mistakes ?? 0 }}
    >
      {mode === 'pick' && (
        <div className="px-4 py-5 space-y-3">
          <div className="flex items-center gap-3">
            <img src={player.image} alt={player.name} className="w-20 h-20 object-contain drop-shadow-xl sport-bob" />
            <p className="bubble-pop px-4 py-2 rounded-3xl bg-white text-base font-black text-purple-800 shadow">Bé muốn chơi bài nào? 🎶</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {SONGS.map((s, i) => (
              <button key={s.id} onClick={() => choose(s)} className="pop-in p-3 rounded-3xl bg-white/95 shadow-lg text-left active:scale-95 transition-transform" style={{ animationDelay: `${i * 80}ms` }}>
                <span className="text-4xl">{SONG_ICONS[s.id]}</span>
                <p className="mt-1 text-base font-black text-purple-800 leading-tight">{s.title}</p>
                <p className="text-[11px] font-semibold text-slate-500">{s.subtitle}</p>
                <p className="mt-1 text-xs font-bold text-fuchsia-600">{s.melody.length} nốt</p>
              </button>
            ))}
          </div>
          <button onClick={() => setMode('free')} className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-amber-400 to-orange-500 text-white text-lg font-black shadow-lg flex items-center justify-center gap-2 active:scale-95">
            <Music className="w-5 h-5" /> Chơi tự do
          </button>
        </div>
      )}

      {mode === 'done' && play && (
        <div className="bg-white/95 m-3 rounded-3xl">
          <SessionSummary
            title="Hay quá! 👏"
            stars={stars}
            maxStars={3}
            gold={goldForStars(stars)}
            detail={`Bé đã chơi xong bài "${play.song.title}"${play.mistakes ? ` (${play.mistakes} lần gõ nhầm)` : ' không nhầm nốt nào!'}`}
            onReplay={() => setMode('pick')}
            onClose={onClose}
          />
        </div>
      )}

      {(mode === 'play' || mode === 'playback' || mode === 'free') && (
        <div className="relative px-3 pt-3 pb-5 flex flex-col gap-3 min-h-[560px]">
          <div className="flex items-center justify-between gap-2">
            <button onClick={() => setMode('pick')} className="p-2 rounded-full bg-white/20 text-white" aria-label="Chọn bài khác">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <p className="flex-1 text-center text-base font-black text-white truncate">
              {mode === 'free' ? '🎹 Chơi tự do' : mode === 'playback' ? `🎶 Nghe lại: ${song.title}` : song.title}
            </p>
            <span className="w-9" />
          </div>

          {/* Dancing Pokemon with floating notes */}
          <div className="relative h-36 flex items-center justify-center">
            <div className="absolute w-40 h-40 rounded-full bg-[radial-gradient(circle,rgba(255,255,255,0.35),transparent_70%)]" />
            <img
              key={dancing ? 'dance' : `hop-${dance}`}
              src={player.image}
              alt={player.name}
              draggable={false}
              className={`relative w-32 h-32 object-contain drop-shadow-2xl ${dancing ? 'dance-bob' : dance ? 'poke-hop' : 'sport-bob'}`}
            />
            {floats.map((f) => (
              <span
                key={`note-${f.id}`}
                className="note-float absolute bottom-2 text-3xl font-black pointer-events-none"
                style={{ left: `${8 + f.bar * 12}%`, color: NOTES[f.bar].color, '--drift': `${f.drift}px`, textShadow: '0 2px 6px rgba(0,0,0,0.35)' }}
              >
                {f.id % 2 ? '♪' : '♫'}
              </span>
            ))}
          </div>

          {/* Upcoming notes */}
          {mode === 'play' && (
            <div className="space-y-1.5">
              <div className="h-2 rounded-full bg-white/20 overflow-hidden">
                <div className="h-full bg-gradient-to-r from-amber-300 to-pink-400 transition-[width] duration-300" style={{ width: `${(play.index / song.melody.length) * 100}%` }} />
              </div>
              <div className="flex items-center justify-center gap-1.5 h-14" data-testid="note-lane">
                {upcoming.map((n, i) => (
                  <span
                    key={`${play.index + i}`}
                    className={`rounded-full flex items-center justify-center font-black text-white shadow-lg transition-all duration-300 ${i === 0 ? 'w-14 h-14 text-base ring-4 ring-white' : 'w-9 h-9 text-[11px] opacity-80'}`}
                    style={{ background: NOTES[n.note].color }}
                  >
                    {NOTES[n.note].label}
                  </span>
                ))}
              </div>
            </div>
          )}
          {mode === 'free' && <p className="text-center text-sm font-bold text-white/85">Gõ bất kỳ phím nào để tạo giai điệu của bé! 🎼</p>}
          {mode === 'playback' && <p className="text-center text-lg font-black text-amber-200 bubble-pop">Nghe lại cả bài nào! 🎶</p>}

          <div className={mode === 'playback' ? 'pointer-events-none' : ''}>
            <Xylophone onHit={hit} target={target} lit={lit} hits={hits} />
          </div>
        </div>
      )}
    </KidGameShell>
  );
}
