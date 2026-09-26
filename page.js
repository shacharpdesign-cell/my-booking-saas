'use client';
import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import CrmTab from './CrmTab';
import SettingsTab from './SettingsTab';

export default function Dashboard() {
  const [tab, setTab] = useState('cal'); const [userId, setUserId] = useState(null);
  const [appointments, setAppointments] = useState([]); const [loading, setLoading] = useState(true);
  const [businessName, setBusinessName] = useState('המספרה של דני'); const [weeklyHours, setWeeklyHours] = useState({});
  const [btnLoading, setBtnLoading] = useState(false); const [weekOffset, setWeekOffset] = useState(0);

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
      if (p) { if (p.business_name) setBusinessName(p.business_name); if (p.weekly_hours) setWeeklyHours(p.weekly_hours); }
      if (!p || !p.weekly_hours) {
        setWeeklyHours({"0":{"is_open":true,"start":"09:00","end":"17:00"},"1":{"is_open":true,"start":"09:00","end":"17:00"},"2":{"is_open":true,"start":"09:00","end":"17:00"},"3":{"is_open":true,"start":"09:00","end":"17:00"},"4":{"is_open":true,"start":"09:00","end":"17:00"}});
      }
      const { data: a } = await supabase.from('appointments').select('id, customer_name, customer_phone, start_time, status, services(name, price)').eq('profile_id', userId).order('start_time', { ascending: true });
      if (a) setAppointments(a); setLoading(false);
    }
    loadData();
  }, [userId]);

  const handleStatus = async (id, newStatus) => {
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

  if (loading) return <div className="flex h-screen items-center justify-center font-bold text-neutral-900 bg-neutral-50 text-sm tracking-wide">טוען לוח ניהול פרימיום...</div>;
  const { sun, sat } = getWeekRange();
  const filteredApps = appointments.filter(app => { const d = new Date(app.start_time); return d >= sun && d <= sat; });

  return (
    <div className="min-h-screen bg-neutral-50 p-4 md:p-8 text-right antialiased font-sans" dir="rtl">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-[2rem] shadow-xl p-6 mb-6 flex flex-col md:flex-row justify-between items-center gap-4 border border-neutral-200/60">
          <div className="text-center md:text-right">
            <h1 className="text-xl font-black text-neutral-900">{businessName}</h1>
            <p className="text-neutral-400 text-[11px] font-medium tracking-wide mt-0.5">מערכת ניהול וקשרי לקוחות פרימיום</p>
          </div>
          <div className="flex bg-neutral-100 p-1 rounded-xl w-full md:w-auto text-center">
            <button onClick={() => setTab('cal')} className={`flex-1 md:flex-none px-4 py-2 text-xs font-bold rounded-lg transition-all ${tab === 'cal' ? 'bg-white text-neutral-900 shadow-md' : 'text-neutral-500'}`}>📅 יומן</button>
            <button onClick={() => setTab('crm')} className={`flex-1 md:flex-none px-4 py-2 text-xs font-bold rounded-lg transition-all ${tab === 'crm' ? 'bg-white text-neutral-900 shadow-md' : 'text-neutral-500'}`}>👥 לקוחות</button>
            <button onClick={() => setTab('settings')} className={`flex-1 md:flex-none px-4 py-2 text-xs font-bold rounded-lg transition-all ${tab === 'settings' ? 'bg-white text-neutral-900 shadow-md' : 'text-neutral-500'}`}>⚙️ הגדרות</button>
          </div>
        </div>

        {tab === 'cal' ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between bg-white rounded-2xl p-4 shadow-md border border-neutral-100">
              <button onClick={() => setWeekOffset(weekOffset - 1)} className="text-[11px] bg-neutral-50 border font-bold px-3 py-2 rounded-xl text-neutral-700">הקודם ➔</button>
              <div className="text-center">
                <span className="text-xs font-bold text-neutral-900 block">{weekOffset === 0 ? '📅 השבוע הנוכחי' : `שבוע שנקבע (${weekOffset > 0 ? '+' : ''}${weekOffset})`}</span>
                <span className="text-[10px] text-neutral-400 font-mono mt-0.5 block" dir="ltr">{sun.toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit' })} - {sat.toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit' })}</span>
              </div>
              <button onClick={() => setWeekOffset(weekOffset + 1)} className="text-[11px] bg-neutral-50 border font-bold px-3 py-2 rounded-xl text-neutral-700">⬅ הבא</button>
            </div>
            {filteredApps.length === 0 ? <div className="p-12 text-center text-neutral-400 font-medium bg-white rounded-2xl border">אין תורים רשומים לשבוע זה.</div> : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {filteredApps.map((app) => {
                  const d = new Date(app.start_time); const s = app.services; const isB = app.customer_name.includes('זמן חסום');
                  return (
                    <div key={app.id} className={`bg-white rounded-2xl p-4 shadow-md border border-neutral-100 flex flex-col justify-between gap-3 transition-all ${isB ? 'bg-rose-50/20 border-rose-100' : ''}`}>
                      <div className="flex justify-between items-start">
                        <div>
                          <span className="text-[11px] font-mono font-bold text-neutral-400 block" dir="ltr">{d.toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit' })} | {d.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' })}</span>
                          <h3 className="font-bold text-neutral-900 text-sm mt-0.5">{app.customer_name}</h3>
                          {!isB && <span className="text-[11px] text-neutral-500 block mt-0.5 font-medium" dir="ltr">{app.customer_phone}</span>}
                        </div>
                        <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${app.status === 'completed' ? 'bg-green-50 text-green-700' : app.status === 'noshow' ? 'bg-rose-50 text-rose-700' : 'bg-neutral-100 text-neutral-700'}`}>{isB ? '🔓 חסום' : app.status === 'completed' ? '✓ הושלם' : app.status === 'noshow' ? '❌ הברזה' : '⏳ קבוע'}</span>
                      </div>
                      <div className="flex justify-between items-center border-t border-neutral-50 pt-3">
                        <span className="text-xs font-bold text-neutral-800">{s?.name || 'טיפול כללי'} <span className="text-neutral-400 font-normal">(₪{s?.price || 0})</span></span>
                        <div className="flex gap-2">
                          {app.status === 'scheduled' && !isB && (
                            <><button onClick={() => handleStatus(app.id, 'completed')} className="text-[10px] bg-neutral-900 text-white font-bold px-2.5 py-1.5 rounded-lg">בוצע</button>
                              <button onClick={() => handleStatus(app.id, 'noshow')} className="text-[10px] border border-neutral-200 text-rose-600 font-bold px-2.5 py-1.5 rounded-lg">הבריז</button></>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ) : tab === 'crm' ? ( <CrmTab appointments={appointments} /> ) : ( <SettingsTab weeklyHours={weeklyHours} updateDaySetting={updateDaySetting} handleSaveSettings={handleSaveSettings} btnLoading={btnLoading} /> )}
      </div>
    </div>
  );
}
