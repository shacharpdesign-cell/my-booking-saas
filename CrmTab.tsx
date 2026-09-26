'use client';
import React from 'react';

export default function CrmTab({ appointments }: { appointments: any[] }) {
  const getCRM = () => {
    const map: Record<string, any> = {};
    appointments.forEach(app => {
      const p = app.customer_phone; if (p === '---' || !p) return;
      const price = app.services?.price || 0;
      if (!map[p]) map[p] = { name: app.customer_name, phone: p, apps: 0, revenue: 0, noshow: 0 };
      map[p].apps += 1;
      if (app.status !== 'noshow') map[p].revenue += price;
      if (app.status === 'noshow') map[p].noshow += 1;
    });
    return Object.values(map);
  };

  const clients = getCRM();

  if (clients.length === 0) {
    return <div className="p-12 text-center text-neutral-400 bg-white rounded-[2rem] border border-neutral-200/60 font-medium text-sm">אין עדיין לקוחות רשומים בהיסטוריה.</div>;
  }

  return (
    <div className="space-y-4">
      {/* כותרת קטנה לכמות הלקוחות */}
      <div className="flex justify-between items-center px-2">
        <h2 className="text-sm font-bold text-neutral-800">מאגר לקוחות רשומים</h2>
        <span className="text-[11px] font-bold bg-neutral-900 text-white px-2.5 py-0.5 rounded-full">{clients.length} לקוחות</span>
      </div>

      {/* גריד קארדים רספונסיבי - מתאים למובייל בטור אחד, ולמחשב בשני טורים */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {clients.map((c: any) => (
          <div key={c.phone} className="bg-white rounded-[2rem] p-5 shadow-md border border-neutral-100 flex flex-col justify-between gap-4 transition-all hover:shadow-lg">
            
            {/* פרטי הלקוח העליונים */}
            <div className="flex justify-between items-start">
              <div>
                <h3 className="font-black text-neutral-900 text-base">{c.name}</h3>
                <span className="text-xs text-neutral-400 font-mono font-medium block mt-0.5" dir="ltr">{c.phone}</span>
              </div>
              {c.noshow > 0 && (
                <span className="bg-rose-50 text-rose-700 text-[10px] font-black tracking-wide uppercase px-2.5 py-1 rounded-lg border border-rose-100 animate-pulse">
                  ⚠️ {c.noshow} הברזות
                </span>
              )}
            </div>

            {/* נתונים מספריים מעוצבים לנייד */}
            <div className="grid grid-cols-2 gap-2 border-t border-neutral-50 pt-3 text-center">
              <div className="bg-neutral-50 rounded-xl p-2.5 border border-neutral-100/50">
                <span className="text-[10px] text-neutral-400 font-bold block mb-0.5">סה"כ תורים</span>
                <span className="text-sm font-black text-neutral-800 font-mono">{c.apps}</span>
              </div>
              <div className="bg-emerald-50/30 rounded-xl p-2.5 border border-emerald-100/30">
                <span className="text-[10px] text-emerald-700/70 font-bold block mb-0.5">סה"כ הכנסה</span>
                <span className="text-sm font-black text-emerald-600 font-mono">₪{c.revenue}</span>
              </div>
            </div>

          </div>
        ))}
      </div>
    </div>
  );
}
