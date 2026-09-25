'use client';
import React from 'react';

const DAYS_NAMES = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];
const HOURS_LIST = ['07:00', '08:00', '09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00', '19:00', '20:00', '21:00'];

interface SettingsProps {
  weeklyHours: Record<string, any>;
  updateDaySetting: (dayKey: string, key: string, val: any) => void;
  handleSaveSettings: (e: React.FormEvent) => void;
  btnLoading: boolean;
}

export default function SettingsTab({ weeklyHours, updateDaySetting, handleSaveSettings, btnLoading }: SettingsProps) {
  return (
    <div className="bg-white rounded-2xl shadow-sm p-6 border border-gray-100 max-w-xl mx-auto">
      <h2 className="text-lg font-bold text-gray-800 mb-1">🗓️ הגדרת שעות פעילות שבועיות</h2>
      <p className="text-gray-400 text-xs mb-6">הגדר שעות פתיחה וסגירה מותאמות אישית לכל יום בשבוע בנפרד.</p>
      <form onSubmit={handleSaveSettings} className="space-y-3.5">
        {DAYS_NAMES.map((dayName, index) => {
          const dayKey = index.toString();
          const dayConfig = weeklyHours[dayKey] || { is_open: false, start: '09:00', end: '17:00' };

          return (
            <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl border border-gray-100 gap-4">
              <label className="flex items-center gap-2.5 min-w-[100px] cursor-pointer">
                <input type="checkbox" checked={dayConfig.is_open} onChange={(e) => updateDaySetting(dayKey, 'is_open', e.target.checked)} className="w-4 h-4 accent-blue-600" />
                <span className={`text-sm font-bold ${dayConfig.is_open ? 'text-gray-900' : 'text-gray-400 line-through'}`}>{dayName}</span>
              </label>
              
              {dayConfig.is_open ? (
                <div className="flex items-center gap-2 text-xs">
                  <span>מ-:</span>
                  <select value={dayConfig.start} onChange={(e) => updateDaySetting(dayKey, 'start', e.target.value)} className="border rounded-lg p-1 bg-white">
                    {HOURS_LIST.map(h => <option key={h} value={h}>{h}</option>)}
                  </select>
                  <span>עד:</span>
                  <select value={dayConfig.end} onChange={(e) => updateDaySetting(dayKey, 'end', e.target.value)} className="border rounded-lg p-1 bg-white">
                    {HOURS_LIST.map(h => <option key={h} value={h}>{h}</option>)}
                  </select>
                </div>
              ) : (
                <span className="text-xs text-rose-500 font-bold bg-rose-50 px-3 py-1 rounded-lg">🔒 סגור</span>
              )}
            </div>
          );
        })}
        <button type="submit" disabled={btnLoading} className="w-full bg-blue-600 text-white font-bold py-3 rounded-xl text-sm mt-4">
          {btnLoading ? 'שומר...' : 'שמור שעות שבועיות'}
        </button>
      </form>
    </div>
  );
}
