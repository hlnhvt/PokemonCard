import React from 'react';
import { TEAM_DIFFICULTY } from '../../utils/team/teamBattle';
import { saveTeamDifficulty } from './difficultyChoice';

const HINT = {
  easy: 'Máu nhiều, đối thủ hiền',
  normal: 'Cân sức, đánh lâu hơn',
  hard: 'Đối thủ mạnh, máu trâu',
};

/** Easy / normal / hard for the team battles: how long each Pokemon lasts and how strong the opponents are. */
export function DifficultyPicker({ value, onChange }) {
  return (
    <div className="rounded-2xl bg-black/30 p-3" data-testid="difficulty-picker">
      <p className="text-base font-black text-white">🎚️ Độ khó</p>
      <div className="mt-2 grid grid-cols-3 gap-2" role="radiogroup" aria-label="Độ khó trận đấu">
        {Object.entries(TEAM_DIFFICULTY).map(([id, d]) => {
          const on = id === value;
          return (
            <button
              key={id}
              role="radio"
              aria-checked={on}
              aria-label={d.label}
              onClick={() => {
                onChange(id);
                saveTeamDifficulty(id);
              }}
              className={`flex flex-col items-center py-2 px-1 rounded-2xl border-2 transition-all active:scale-95 ${on ? 'border-amber-300 bg-gradient-to-b from-amber-400 to-orange-500 text-slate-900 scale-105 shadow-lg' : 'border-white/15 bg-white/10 text-white'}`}
            >
              <span className="text-xl leading-none">{d.icon}</span>
              <span className="text-sm font-black">{d.label}</span>
              <span className={`text-[9px] font-bold text-center leading-tight ${on ? 'text-slate-900/75' : 'text-white/60'}`}>{HINT[id]}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
