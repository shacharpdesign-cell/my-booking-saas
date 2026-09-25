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
    return <div className="p-12 text-center text-gray-400 bg-white rounded-2xl border">אין עדיין לקוחות בהיסטוריה.</div>;
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm overflow-hidden border border-gray-100">
      <div className="overflow-x-auto">
        <table className="w-full text-right border-collapse">
          <thead>
            <tr className="bg-gray-50 text-gray-400 text-xs font-bold border-b">
              <th className="p-4">שם הלקוח</th>
              <th className="p-4">מספר נייד</th>
              <th className="p-4 text-center">תורים</th>
              <th className="p-4 text-center">הברזות</th>
              <th className="p-4">סה"כ הכנסה</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 text-sm">
            {clients.map((c: any) => (
              <tr key={c.phone} className="hover:bg-gray-50/40">
                <td className="p-4 font-bold text-slate-900">{c.name}</td>
                <td className="p-4" dir="ltr">{c.phone}</td>
                <td className="p-4 text-center">{c.apps}</td>
                <td className="p-4 text-center font-bold text-rose-600">{c.noshow > 0 ? `${c.noshow} ⚠️` : '0'}</td>
                <td className="p-4 font-black text-emerald-600">₪{c.revenue}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
