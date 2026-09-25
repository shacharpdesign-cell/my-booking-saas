'use client';
import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import CrmTab from './CrmTab';
import SettingsTab from './SettingsTab';

export default function Dashboard() {
  const [tab, setTab] = useState<'cal' | 'crm' | 'settings'>('cal');
  const [userId, setUserId] = useState<string | null>(null);
  const [appointments, setAppointments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [businessName, setBusinessName] = useState('המספרה של דני');
  const [weeklyHours, setWeeklyHours] = useState<Record<string, any>>({});
  const [btnLoading, setBtnLoading] = useState(false);
  const [weekOffset, setWeekOffset] = useState(0);

  useEffect(() => {
    async function checkUser() {
      const { data: { user } } = await supabase.auth.getUser();
      setUserId(user ? user.id : '11111111-1111-1111-1111-111111111111');
    }
    checkUser();
  }, []);

  useEffect(() => {
    if (!userId) return;
    async function loadData() {
      const { data: p } = await supabase.from('profiles').select('business_name, weekly_hours').eq('id', userId).single();
      if (p) {
        if (p.business_name) setBusinessName(p.business_name);
        if (p.weekly_hours) setWeeklyHours(p.weekly_hours);
      }
      //Fallback למקרה ש-RLS חוסם הגדרות שעות בשלב הפיתוח
      if (!p || !p.weekly_hours) {
        setWeeklyHours({"0":{"is_open":true,"start":"09:00","end":"17:00"},"1":{"is_open":true,"start":"09:00","end":"17:00"},"2":{"is_open":true,"start":"09:00","end":"17:00"},"3":{"is_open":true,"start":"09:00","end":"17:00"},"4":{"is_open":true,"start":"09:00","end":"17:00"},"5":{"is_open":false,"start":"09:00","end":"13:00"},"6":{"is_open":false,"start":"09:00","end":"17:00"}});
      }
      const { data: a } = await supabase.from('appointments').select('id, customer_name, customer_phone, start_time, status, services(name, price)').eq('profile_id', userId).order('start_time', { ascending: true });
      if (a) setAppointments(a);
      setLoading(false);
    }
    loadData();
  }, [userId]);

  const updateDaySetting = (dayKey: string, key: string, val: any) => {
    setWeeklyHours({ ...weeklyHours, [dayKey]: { ...weeklyHours[dayKey], [key]: val } });
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault(); if (!userId) return; setBtnLoading(true);
    const { error } = await supabase.from('profiles').update({ weekly_hours: weeklyHours }).eq('id', userId);
    setBtnLoading(false); if (!error) alert('🗓️ ימי ושעות הפעילות עודכנו בהצלחה!');
  };

  const handleStatus = async (id: string, newStatus: string) => {
    const { error } = await supabase.from('appointments').update({ status: newStatus }).eq('id', id);
    if (!error && userId) {
      const { data: a } = await supabase.from('appointments').select('id, customer_name, customer_phone, start_time, status, services(name, price)').eq('profile_id', userId).order('start_time', { ascending: true });
      if (a) setAppointments(a);
    }
  };

  const getWeekRange = () => {
    const current = new Date(); const distance = current.getDay();
    const sun = new Date(current.setDate(current.getDate() - distance + (weekOffset * 7))); sun.setHours(0,0,0,0);
    const sat = new Date(sun); sat.setDate(sun.getDate() + 6); sat.setHours(23,59,59,999);
    return { sun, sat };
  };

  if (loading) return <div className="flex h-screen items-center justify-center font-bold text-gray-700 bg-gray-50 text-lg">טוען את לוח הבקרה...</div>;
  const { sun, sat } = getWeekRange();
  const filteredApps = appointments.filter(app => { const d = new Date(app.start_time); return d >= sun && d <= sat; });

  return (
    <div className="min-h-screen bg-gray-50 p-6 text-right" dir="rtl">
      <div className="max-w-5xl mx-auto">
        <div className="bg-white rounded-2xl shadow-sm p-6 mb-6 flex justify-between items-center border border-gray-100">
          <div><h1 className="text-2xl font-bold text-gray-900">שלום, {businessName}</h1><p className="text-gray-500 text-sm mt-0.5">ניהול יומן תורים, לקוחות ושעות פעילות לעסק</p></div>
          <div className="flex bg-gray-100 p-1 rounded-xl border border-gray-200">
            <button onClick={() => setTab('cal')} className={`px-4 py-2 text-xs font-bold rounded-lg ${tab === 'cal' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500'}`}>📅 יומן</button>
            <button onClick={() => setTab('crm')} className={`px-4 py-2 text-xs font-bold rounded-lg ${tab === 'crm' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500'}`}>👥 לקוחות (CRM)</button>
            <button onClick={() => setTab('settings')} className={`px-4 py-2 text-xs font-bold rounded-lg ${tab === 'settings' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500'}`}>⚙️ ימי ושעות פעילות</button>
          </div>
        </div>

        {tab === 'cal' ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
              <button onClick={() => setWeekOffset(weekOffset - 1)} className="text-xs bg-gray-50 hover:bg-gray-100 border font-bold px-3 py-2 rounded-xl text-gray-700">השבוע הקודם ➔</button>
              <div className="text-center"><span className="text-sm font-bold text-gray-800 block">{weekOffset === 0 ? '📅 השבוע הנוכחי' : weekOffset === 1 ? '🚀 השבוע הבא' : `שבוע קדימה (${weekOffset}+)`}</span><span className="text-xs text-gray-400 font-medium mt-0.5 block" dir="ltr">{sun.toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit' })} - {sat.toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit' })}</span></div>
              <button onClick={() => setWeekOffset(weekOffset + 1)} className="text-xs bg-gray-50 hover:bg-gray-100 border font-bold px-3 py-2 rounded-xl text-gray-700">⬅ השבוע הבא</button>
            </div>
            <div className="bg-white rounded-2xl shadow-sm overflow-hidden border border-gray-100">
              {filteredApps.length === 0 ? <div className="p-12 text-center text-gray-400 font-medium">אין תורים רשומים בטווח השבועי שנבחר.</div> : (
                <div className="overflow-x-auto"><table className="w-full text-right border-collapse">
                    <thead><tr className="bg-gray-50 text-gray-400 text-xs font-bold border-b"><th className="p-4">תאריך ושעה</th><th className="p-4">לקוח</th><th className="p-4">שירות</th><th className="p-4">סטטוס</th><th className="p-4 text-left">פעולות</th></tr></thead>
                    <tbody className="divide-y divide-gray-100 text-sm">{filteredApps.map((app) => {
                        const d = new Date(app.start_time); const s = app.services;
                        return (
                          <tr key={app.id} className="hover:bg-gray-50/40">
                            <td className="p-4 font-semibold text-slate-900">{d.toLocaleDateString('he-IL', { weekday: 'long', day: '2-digit', month: '2-digit' })} ב-{d.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' })}</td>
                            <td className="p-4"><div className="font-semibold">{app.customer_name}</div><div className="text-xs text-gray-400" dir="ltr">{app.customer_phone}</div></td>
                            <td className="p-4">{s?.name || 'טיפול'} (₪{s?.price || 0})</td>
                            <td className="p-4"><span className={`px-2 py-0.5 rounded-full text-xs font-bold ${app.status === 'completed' ? 'bg-green-50 text-green-700' : app.status === 'noshow' ? 'bg-rose-50 text-rose-700' : 'bg-blue-50 text-blue-700'}`}>{app.status === 'completed' ? '✓ הושלם' : app.status === 'noshow' ? '❌ הברזה' : '⏳ נקבע'}</span></td>
                            <td className="p-4 text-left space-x-2 space-x-reverse">{app.status === 'scheduled' && (<><button onClick={() => handleStatus(app.id, 'completed')} className="text-xs bg-green-50 text-green-700 border font-bold px-2 py-1 rounded-lg">בוצע</button><button onClick={() => handleStatus(app.id, 'noshow')} className="text-xs bg-rose-50 text-rose-700 border font-bold px-2 py-1 rounded-lg">הבריז</button></>)}</td>
                          </tr>
                        );
                      })}</tbody>
                  </table></div>
              )}
            </div>
          </div>
        ) : tab === 'crm' ? (
          <CrmTab appointments={appointments} />
        ) : (
          <SettingsTab weeklyHours={weeklyHours} updateDaySetting={updateDaySetting} handleSaveSettings={handleSaveSettings} btnLoading={btnLoading} />
        )}
      </div>
    </div>
  );
}
