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
  if (clients.length === 0) return <div className="p-12 text-center text-neutral-400 bg-white rounded-[2rem] border font-medium text-sm">אין עדיין לקוחות בהיסטוריה.</div>;
  return (
    <div className="space-y-4 text-right" dir="rtl">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {clients.map((c: any) => (
          <div key={c.phone} className="bg-white rounded-[2rem] p-5 shadow-md border border-neutral-100 flex flex-col gap-4">
            <div className="flex justify-between items-start">
              <div><h3 className="font-black text-neutral-900 text-base">{c.name}</h3><span className="text-xs text-neutral-400 font-mono" dir="ltr">{c.phone}</span></div>
              {c.noshow > 0 && <span className="bg-rose-50 text-rose-700 text-[10px] font-black px-2.5 py-1 rounded-lg border border-rose-100">⚠️ {c.noshow} הברזות</span>}
            </div>
            <div className="grid grid-cols-2 gap-2 border-t pt-3 text-center">
              <div className="bg-neutral-50 rounded-xl p-2.5 border"><span className="text-[10px] text-neutral-400 block mb-0.5">סה"כ תורים</span><span className="text-sm font-black">{c.apps}</span></div>
              <div className="bg-emerald-50/30 rounded-xl p-2.5 border border-emerald-100/30"><span className="text-[10px] text-emerald-700 block mb-0.5">סה"כ הכנסה</span><span className="text-sm font-black text-emerald-600">₪{c.revenue}</span></div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
