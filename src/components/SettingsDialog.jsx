import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Settings } from 'lucide-react';

function Toggle({ checked, onChange, label, description }) {
  return (
    <label className="flex items-start gap-3 p-3 rounded-2xl bg-slate-800/70 border border-slate-700 cursor-pointer">
      <span className="flex-1 min-w-0">
        <span className="block text-base font-black text-slate-50">{label}</span>
        <span className="block mt-0.5 text-xs text-slate-300 leading-snug">{description}</span>
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={() => onChange(!checked)}
        className={`relative shrink-0 w-14 h-8 rounded-full transition-colors duration-300 ${checked ? 'bg-emerald-500' : 'bg-slate-600'}`}
      >
        <span className={`absolute top-1 left-1 w-6 h-6 rounded-full bg-white shadow transition-transform duration-300 ${checked ? 'translate-x-6' : ''}`} />
      </button>
    </label>
  );
}

/** Settings for parents. `settings` from utils/settings.js; onChange(key, value). */
export function SettingsDialog({ settings, onChange, onClose }) {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center" role="dialog" aria-label="Cài đặt">
      <button aria-label="Đóng cài đặt" className="backdrop-fade absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="sheet-up relative w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl bg-slate-900 border-t-4 sm:border-4 border-white/70 shadow-2xl p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Settings className="w-6 h-6 text-cyan-400" />
          <p className="flex-1 text-lg font-black text-slate-50">Cài đặt</p>
          <button onClick={onClose} aria-label="Đóng" className="p-2 rounded-full bg-slate-800 text-slate-200">
            <X className="w-5 h-5" />
          </button>
        </div>
        <p className="text-xs font-black uppercase tracking-wider text-slate-400">⚔️ Đấu đội 5 vs 5</p>
        <Toggle
          checked={!!settings.teamUseScanned}
          onChange={(v) => onChange('teamUseScanned', v)}
          label="Cho phép chọn Pokémon đã quét"
          description={
            settings.teamUseScanned
              ? 'Đang bật: bé có thể chọn Pokémon trong bộ sưu tập để lập đội, hoặc quét thẻ mới.'
              : 'Đang tắt: bé phải quét thẻ bằng camera cho từng Pokémon muốn dùng (thiếu thẻ thì hệ thống cho mượn).'
          }
        />
      </div>
    </div>,
    document.body
  );
}
