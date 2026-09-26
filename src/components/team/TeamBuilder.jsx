import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import confetti from 'canvas-confetti';
import { X, Camera, Dice5, ArrowRight } from 'lucide-react';
import { TEAM_SIZE, borrowPokemon } from '../../utils/team/teamBattle';
import { getSavedTeams, saveTeam, deleteSavedTeam, teamFromSaved, savableCards } from '../../utils/savedTeams';
import { OPPONENT_POOL } from '../../utils/battle/opponentPool';
import { artworkUrl } from '../../services/pokemonOnlineService';
import { SOURCE_BADGE, memberFromCard, memberFromPool } from '../../utils/team/members';
import { sounds } from '../../utils/soundEffects';
import { PokeballIcon } from '../PokeballIcon';
import { ScannerModal } from '../ScannerModal';

/** One slot spinning through Pokemon like a slot machine, then landing on the lent one. */
function RouletteSlot({ target, delay, onLanded }) {
  const [shown, setShown] = useState(null);
  const [landed, setLanded] = useState(false);
  const done = useRef(onLanded);
  useEffect(() => {
    done.current = onLanded;
  });
  useEffect(() => {
    // Fast at first, then slowing down before it stops
    const steps = [...Array(12).fill(60), 80, 100, 130, 170, 220, 290, 380];
    const timers = [];
    let t = delay;
    steps.forEach((ms, i) => {
      t += ms;
      timers.push(setTimeout(() => {
        const p = OPPONENT_POOL[(i * 7 + target.name.length * 3) % OPPONENT_POOL.length];
        setShown(artworkUrl(p.id));
        sounds.playNote(880 + (i % 4) * 110, { duration: 0.07, volume: 0.07 });
      }, t));
    });
    timers.push(setTimeout(() => {
      setLanded(true);
      sounds.playPop();
      done.current?.();
    }, t + 420));
    return () => timers.forEach(clearTimeout);
  }, [delay, target]);

  return (
    <div className="relative w-full h-full rounded-full bg-gradient-to-b from-amber-200 to-orange-400 overflow-hidden flex items-center justify-center" data-testid="roulette-slot">
      {landed ? (
        <>
          <span className="ball-burst absolute left-1/2 top-1/2 w-10 h-10 rounded-full bg-white" />
          <img src={target.image} alt={target.name} className="roulette-land w-[88%] h-[88%] object-contain drop-shadow" />
        </>
      ) : (
        shown ? <img src={shown} alt="" className="roulette-spin w-[80%] h-[80%] object-contain opacity-90" /> : <Dice5 className="w-7 h-7 text-white animate-spin" />
      )}
    </div>
  );
}

/** Full-screen celebration after a card was scanned: the card flips in, shines, then joins the team. */
function ScanSuccess({ member, onDone }) {
  const done = useRef(onDone);
  useEffect(() => {
    done.current = onDone;
  });
  useEffect(() => {
    sounds.playSuccessFanfare();
    try {
      confetti({ particleCount: 90, spread: 80, origin: { y: 0.45 }, zIndex: 9999 });
    } catch {
      // decoration
    }
    const t = setTimeout(() => done.current(), 1900);
    return () => clearTimeout(t);
  }, []);
  return createPortal(
    <button type="button" onClick={() => done.current()} className="fixed inset-0 z-[70] flex flex-col items-center justify-center gap-4 bg-slate-950/85" data-testid="scan-success" aria-label="Tiếp tục">
      <div className="vs-rays absolute inset-0 opacity-30" />
      <div className="card-reveal relative w-52 h-72 p-1.5 rounded-3xl rainbow-border shadow-[0_0_60px_rgba(250,204,21,0.6)]">
        <div className="relative w-full h-full rounded-[1.25rem] bg-gradient-to-b from-amber-100 via-white to-sky-100 overflow-hidden flex flex-col items-center justify-center">
          <img src={member.image} alt={member.name} className="w-40 h-40 object-contain drop-shadow-xl" />
          <span className="mt-1 text-xl font-black text-slate-800">{member.name}</span>
          <span className="holo-sweep absolute inset-0 pointer-events-none" />
        </div>
      </div>
      <p className="bubble-pop relative text-2xl font-black text-white text-center px-6">
        ✨ Quét thành công! ✨<br />
        <span className="text-amber-300">{member.name}</span> gia nhập đội!
      </p>
    </button>,
    document.body
  );
}

/**
 * Building the 5 vs 5 team: scan cards (or pick Pokemon already scanned); empty places can
 * be filled with Pokemon lent at random, shown with a slot-machine spin.
 */
/**
 * allowScanned (a parent setting): Pokemon scanned before may be picked. When off, every
 * Pokemon must be scanned with the camera now (the scanner's shortcuts to saved cards are refused).
 */
export function TeamBuilder({ collection = [], allowScanned = false, team, setTeam, onScanned, onNext, random = Math.random, size = TEAM_SIZE }) {
  const [scanning, setScanning] = useState(false);
  const [success, setSuccess] = useState(null);
  const [rolling, setRolling] = useState([]); // lent Pokemon still spinning
  const [message, setMessage] = useState(null);
  const [lineUps, setLineUps] = useState(getSavedTeams);
  const [justSaved, setJustSaved] = useState(null);
  const landedCount = useRef(0);
  const has = (m) => team.some((t) => t.species === m.species);
  const busy = rolling.length > 0 || !!success;
  const free = size - team.length;

  const say = (text) => {
    setMessage({ text, id: (message?.id || 0) + 1 });
  };

  const add = (member) => {
    if (busy) return false;
    if (team.length >= size) {
      say(`Đội đã đủ ${size} Pokémon rồi!`);
      return false;
    }
    if (has(member)) {
      say(`${member.name} đã ở trong đội rồi!`);
      return false;
    }
    setTeam((list) => [...list, member]);
    sounds.playPop();
    return true;
  };

  const scanned = (pokemon) => {
    setScanning(false);
    const saved = onScanned?.(pokemon) || pokemon;
    const member = memberFromCard(saved, 'scan');
    if (has(member)) {
      say(`${member.name} đã ở trong đội rồi!`);
      return;
    }
    if (team.length >= size) {
      say(`Đội đã đủ ${size} Pokémon rồi!`);
      return;
    }
    setSuccess(member);
  };

  const borrow = () => {
    if (busy || free <= 0) return;
    landedCount.current = 0;
    const lent = borrowPokemon(team, free, OPPONENT_POOL, random).map(memberFromPool);
    sounds.playEnergySurge();
    setRolling(lent);
  };

  const landed = (total) => {
    landedCount.current += 1;
    if (landedCount.current < total) return;
    setTimeout(() => {
      setTeam((list) => [...list, ...rolling.filter((m) => !list.some((t) => t.species === m.species))].slice(0, size));
      setRolling([]);
      try {
        confetti({ particleCount: 50, spread: 70, origin: { y: 0.3 }, zIndex: 9999 });
      } catch {
        // decoration
      }
    }, 500);
  };

  const remove = (i) => {
    if (busy) return;
    setTeam((list) => list.filter((_, j) => j !== i));
  };

  const choices = allowScanned ? collection.map((c) => memberFromCard(c, 'owned')) : [];

  // Saved line-ups (only when the parent allows Pokemon already scanned)
  const canSave = allowScanned && savableCards(team).length > 0 && !busy;
  const saveLineUp = () => {
    const out = saveTeam(team);
    setLineUps(out.list);
    if (out.reason === 'same') say('Đội hình này đã được lưu rồi!');
    else if (out.saved) {
      setJustSaved(out.saved.id);
      sounds.playCoin();
      say(`Đã lưu "${out.saved.name}"! Lần sau chọn lại ngay nhé 💾`);
    }
  };
  const pickLineUp = (t) => {
    if (busy) return;
    const members = teamFromSaved(t, collection, size);
    if (!members.length) {
      say('Các Pokémon của đội này không còn trong bộ sưu tập.');
      return;
    }
    setTeam(members);
    sounds.playEnergySurge();
    say(members.length < t.cards.length ? `Đã chọn ${t.name} (thiếu ${t.cards.length - members.length} Pokémon)` : `Đã chọn ${t.name}!`);
    try {
      confetti({ particleCount: 40, spread: 60, origin: { y: 0.3 }, zIndex: 9999 });
    } catch {
      // decoration
    }
  };
  const removeLineUp = (id) => setLineUps(deleteSavedTeam(id));
  const cardImage = (id) => {
    const card = collection.find((c) => String(c.id) === String(id));
    return card ? memberFromCard(card, 'owned') : null;
  };

  return (
    <div className="px-4 pt-3 pb-5 space-y-4" data-testid="team-builder">
      <div className="text-center">
        <p className="text-2xl font-black text-white drop-shadow">Lập đội hình {size} Pokémon</p>
        <p className="text-sm font-bold text-white/80">Quét thẻ để chọn Pokémon bé muốn. Thiếu thẻ thì hệ thống cho mượn!</p>
        {!allowScanned && collection.length > 0 && (
          <p className="mt-1 text-xs font-bold text-amber-200" data-testid="scan-required">📷 Mỗi Pokémon cần được quét thẻ lại (phụ huynh có thể đổi trong ⚙️ Cài đặt)</p>
        )}
      </div>

      {/* The five places */}
      <div className="grid gap-2 mx-auto" style={{ gridTemplateColumns: `repeat(${size}, minmax(0, 1fr))`, maxWidth: `${Math.max(28, size * 20)}%` }} data-testid="team-slots">
        {Array.from({ length: size }).map((_, i) => {
          const m = team[i];
          const spin = !m ? rolling[i - team.length] : null;
          return (
            <div key={m ? m.key : `empty-${i}`} className="flex flex-col items-center gap-1">
              <div className={`relative w-full aspect-square rounded-full border-4 ${m ? 'border-white bg-white/90 shadow-lg' : 'border-dashed border-white/50 bg-black/20'}`}>
                {m ? (
                  <>
                    <img src={m.image} alt={m.name} className="slot-pop w-full h-full object-contain p-1" />
                    <button onClick={() => remove(i)} aria-label={`Bỏ ${m.name} khỏi đội`} className="absolute -top-1.5 -right-1.5 w-6 h-6 rounded-full bg-slate-800 text-white flex items-center justify-center shadow">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </>
                ) : spin ? (
                  <RouletteSlot target={spin} delay={(i - team.length) * 450} onLanded={() => landed(rolling.length)} />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <PokeballIcon className="w-[60%] h-[60%] opacity-40" />
                  </div>
                )}
              </div>
              <span className="w-full text-center text-[10px] font-black text-white truncate">{m ? m.name : spin ? '???' : `Ô ${i + 1}`}</span>
              {m && <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-black text-white ${SOURCE_BADGE[m.source].cls}`}>{SOURCE_BADGE[m.source].text}</span>}
            </div>
          );
        })}
      </div>

      {message && (
        <p key={message.id} role="alert" className="bubble-pop text-center text-sm font-black text-amber-200">
          {message.text}
        </p>
      )}

      {allowScanned && lineUps.length > 0 && (
        <div className="rounded-2xl bg-gradient-to-br from-indigo-500/30 to-fuchsia-500/20 border border-white/15 p-3 space-y-2" data-testid="saved-teams">
          <p className="text-sm font-black text-white">📋 Đội hình đã lưu</p>
          {lineUps.map((t) => (
            <div key={t.id} className={`flex items-center gap-2 p-2 rounded-2xl bg-black/25 ${justSaved === t.id ? 'pop-in ring-2 ring-amber-300' : ''}`} data-testid="saved-team">
              <div className="flex -space-x-2 shrink-0">
                {t.cards.slice(0, 5).map((id) => {
                  const m = cardImage(id);
                  return m ? <img key={id} src={m.image} alt={m.name} className="w-9 h-9 rounded-full bg-white/90 border-2 border-indigo-300 object-contain" /> : <span key={id} className="w-9 h-9 rounded-full bg-white/10 border-2 border-white/20" />;
                })}
              </div>
              <span className="flex-1 min-w-0 text-xs font-black text-white truncate">{t.name}</span>
              <button onClick={() => pickLineUp(t)} disabled={busy} aria-label={`Dùng ${t.name}`} className="shrink-0 px-3 py-1.5 rounded-xl bg-amber-400 text-slate-900 text-xs font-black shadow active:scale-95 disabled:opacity-50">
                Dùng
              </button>
              <button onClick={() => removeLineUp(t.id)} aria-label={`Xóa ${t.name}`} className="shrink-0 w-7 h-7 rounded-full bg-white/15 text-white flex items-center justify-center">
                <X className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      {canSave && (
        <button onClick={saveLineUp} className="w-full py-2.5 rounded-2xl bg-white/15 border-2 border-dashed border-white/40 text-white text-sm font-black flex items-center justify-center gap-2 active:scale-95" data-testid="save-team">
          💾 Lưu đội hình này
        </button>
      )}

      <button
        onClick={() => setScanning(true)}
        disabled={busy || free <= 0}
        className="w-full py-4 rounded-2xl bg-gradient-to-r from-red-500 via-rose-500 to-pink-500 text-white text-lg font-black shadow-lg flex items-center justify-center gap-2 active:scale-95 disabled:opacity-50"
      >
        <Camera className="w-6 h-6" /> Quét thẻ thêm Pokémon
      </button>

      {choices.length > 0 && (
        <div className="rounded-2xl bg-black/25 p-3 space-y-2">
          <p className="text-sm font-black text-white">⭐ Pokémon bé đã quét</p>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {choices.map((m) => {
              const inTeam = has(m);
              return (
                <button
                  key={m.key}
                  onClick={() => add(m)}
                  disabled={inTeam || busy}
                  aria-label={`Thêm ${m.name} vào đội`}
                  className={`shrink-0 w-20 p-1.5 rounded-2xl border-2 flex flex-col items-center active:scale-95 transition-transform ${inTeam ? 'border-emerald-400 bg-emerald-400/20 opacity-60' : 'border-white/30 bg-white/10'}`}
                >
                  <img src={m.image} alt="" className="w-14 h-14 object-contain" />
                  <span className="text-[11px] font-bold text-white truncate w-full text-center">{m.name}</span>
                  {inTeam && <span className="text-[10px] font-black text-emerald-300">Trong đội</span>}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {free > 0 ? (
        <button
          onClick={borrow}
          disabled={busy}
          className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-amber-400 to-orange-500 text-slate-900 text-lg font-black shadow-lg flex items-center justify-center gap-2 active:scale-95 disabled:opacity-60"
        >
          <Dice5 className="w-6 h-6" /> Cho mượn ngẫu nhiên {free} Pokémon
        </button>
      ) : (
        <button onClick={onNext} disabled={busy} className="pop-in w-full py-4 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 text-white text-xl font-black shadow-lg flex items-center justify-center gap-2 active:scale-95">
          Chọn sàn đấu <ArrowRight className="w-6 h-6" />
        </button>
      )}

      {scanning &&
        createPortal(
          <div className="fixed inset-0 z-[60] overflow-y-auto app-bg" role="dialog" aria-label="Quét thẻ thêm vào đội">
            <div className="sticky top-0 z-10 flex items-center justify-between px-4 py-3 bg-slate-950/90 backdrop-blur">
              <span className="text-lg font-black text-white">📷 Quét thẻ để thêm vào đội</span>
              <button onClick={() => setScanning(false)} aria-label="Đóng quét thẻ" className="p-2 rounded-full bg-white/15 text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <ScannerModal onCardDetected={scanned} recentCards={collection} onOpenCard={(card) => {
                if (!allowScanned) {
                  setScanning(false);
                  say(`Hãy chụp thẻ ${card.name} bằng camera để thêm vào đội nhé! 📷`);
                  return;
                }
                setScanning(false);
                add(memberFromCard(card, 'owned'));
              }} />
          </div>,
          document.body
        )}
      {success && (
        <ScanSuccess
          member={success}
          onDone={() => {
            const m = success;
            setSuccess(null);
            setTeam((list) => (list.length < size && !list.some((t) => t.species === m.species) ? [...list, m] : list));
          }}
        />
      )}
    </div>
  );
}
