'use client';
import React from 'react';

const DAYS_NAMES = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];
const HOURS_LIST = ['07:00', '08:00', '09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00', '19:00', '20:00', '21:00'];

interface SettingsProps { weeklyHours: Record<string, any>; updateDaySetting: (dayKey: string, key: string, val: any) => void; handleSaveSettings: (e: React.FormEvent) => void; btnLoading: boolean; }

export default function SettingsTab({ weeklyHours, updateDaySetting, handleSaveSettings, btnLoading }: SettingsProps) {
  return (
    <div className="bg-white rounded-[2rem] shadow-xl p-6 border border-neutral-200/60 max-w-xl mx-auto">
      <h2 className="text-lg font-bold text-neutral-900 mb-1">🗓️ הגדרת שעות פעילות שבועיות</h2>
      <p className="text-neutral-400 text-xs mb-5">הגדר שעות פתיחה וסגירה מותאמות אישית לכל יום בשבוע בנפרד.</p>
      <form onSubmit={handleSaveSettings} className="space-y-3">
        {DAYS_NAMES.map((dayName, index) => {
          const dayKey = index.toString(); const dayConfig = weeklyHours[dayKey] || { is_open: false, start: '09:00', end: '17:00' };
          return (
            <div key={index} className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 bg-neutral-50 rounded-2xl border border-neutral-100 gap-3">
              <label className="flex items-center gap-3 cursor-pointer min-w-[100px]">
                <input type="checkbox" checked={dayConfig.is_open} onChange={(e) => updateDaySetting(dayKey, 'is_open', e.target.checked)} className="w-4 h-4 accent-neutral-900 rounded" />
                <span className={`text-sm font-bold ${dayConfig.is_open ? 'text-neutral-900' : 'text-neutral-400 line-through'}`}>{dayName}</span>
              </label>
              {dayConfig.is_open ? (
                <div className="flex items-center gap-2 text-xs font-semibold w-full sm:w-auto justify-end">
                  <span className="text-neutral-400">מ-:</span><select value={dayConfig.start} onChange={(e) => updateDaySetting(dayKey, 'start', e.target.value)} className="border border-neutral-200 rounded-xl p-2 bg-white text-neutral-800 font-bold focus:outline-neutral-900">{HOURS_LIST.map(h => <option key={h} value={h}>{h}</option>)}</select>
                  <span className="text-neutral-400">עד:</span><select value={dayConfig.end} onChange={(e) => updateDaySetting(dayKey, 'end', e.target.value)} className="border border-neutral-200 rounded-xl p-2 bg-white text-neutral-800 font-bold focus:outline-neutral-900">{HOURS_LIST.map(h => <option key={h} value={h}>{h}</option>)}</select>
                </div>
              ) : <span className="text-[10px] text-neutral-400 font-bold bg-neutral-200/50 px-2.5 py-1 rounded-md uppercase tracking-wider self-end sm:self-auto">🔒 סגור קבוע</span>}
            </div>
          );
        })}
        <button type="submit" disabled={btnLoading} className="w-full bg-neutral-900 text-white font-bold py-3.5 rounded-2xl text-xs tracking-widest hover:bg-neutral-800 mt-4 uppercase shadow-lg">{btnLoading ? 'שומר שינויים...' : 'שמור שעות שבועיות'}</button>
      </form>
    </div>
  );
}
