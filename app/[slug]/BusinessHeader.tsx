'use client';
import React from 'react';

interface HeaderProps {
  business: {
    business_name: string;
    address?: string;
    start_hour?: string;
    end_hour?: string;
  };
}

export default function BusinessHeader({ business }: HeaderProps) {
  const wazeUrl = `https://waze.com{encodeURIComponent(business.address || 'דיזנגוף 120 תל אביב')}&navigate=yes`;

  return (
    <div>
      {/* באנר עליון יוקרתי מינימליסטי */}
      <div className="bg-white pt-10 pb-6 text-center border-b border-stone-100 px-6">
        <div className="w-20 h-20 bg-stone-900 rounded-full mx-auto mb-4 flex items-center justify-center shadow-xl border-2 border-amber-400/30">
          <span className="text-amber-400 font-serif text-2xl font-bold tracking-widest uppercase">
            {business.business_name.substring(0, 2)}
          </span>
        </div>
        <h1 className="text-2xl font-serif font-semibold text-stone-950 tracking-wide mb-1">{business.business_name}</h1>
        <div className="inline-block bg-amber-50 text-amber-800 text-[10px] uppercase font-bold tracking-wider px-3 py-1 rounded-full border border-amber-200/50">מערכת תורים פרימיום</div>
      </div>

      {/* פרטי העסק וה-Waze */}
      <div className="p-4 bg-stone-50/50 border-b border-stone-100 grid grid-cols-1 gap-2.5 text-xs text-stone-600 px-6">
        <a href={wazeUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 group hover:text-amber-700 transition-colors">
          <span className="text-base group-hover:scale-110 transition-transform">💎</span>
          <div>
            <span className="font-bold text-stone-900 block">כתובת העסק (לחצי לניווט ב-Waze):</span>
            <span className="underline decoration-amber-400/50 underline-offset-2">{business.address || 'דיזנגוף 120, תל אביב'}</span>
          </div>
        </a>
        <div className="flex items-center gap-2">
          <span className="text-base">🕒</span>
          <div><span className="font-bold text-stone-900 block">שעות פעילות קבועות:</span> א׳ - ה׳ | {business.start_hour} - {business.end_hour}</div>
        </div>
      </div>
    </div>
  );
}
