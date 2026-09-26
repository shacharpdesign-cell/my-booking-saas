'use client';
import { useEffect, useState, use } from 'react';
import { supabase } from '../../lib/supabase';
import { sendWhatsAppNotification } from '../../lib/notification';

export default function BusinessProfile({ params }) {
  const resolvedParams = use(params); const slug = resolvedParams?.slug;
  const [business, setBusiness] = useState(null); const [services, setServices] = useState([]); const [loading, setLoading] = useState(true);
  const [selectedService, setSelectedService] = useState(null); const [selectedDate, setSelectedDate] = useState('');
  const [availableSlots, setAvailableSlots] = useState([]); const [selectedTime, setSelectedTime] = useState('');
  const [customerName, setCustomerName] = useState(''); const [customerPhone, setCustomerPhone] = useState('');
  const [bookingLoading, setBookingLoading] = useState(false); const [bookingSuccess, setBookingSuccess] = useState(false);

  useEffect(() => {
    if (!slug) return;
    async function load() {
      const { data: p } = await supabase.from('profiles').select('*').eq('slug', slug.toLowerCase().trim()).single();
      if (!p) return setLoading(false); setBusiness(p);
      const { data: s } = await supabase.from('services').select('*').eq('profile_id', p.id);
      if (s) setServices(s); setLoading(false);
    }
    load();
  }, [slug]);

  useEffect(() => {
    if (!selectedDate || !business || !selectedService) return;
    async function getSlots() {
      const d = new Date(selectedDate); const hours = business.weekly_hours || {};
      const conf = hours[d.getDay().toString()] || { is_open: true, start: '09:00', end: '17:00' };
      if (!conf.is_open) { setAvailableSlots([]); return; }
      const slots = [];
      for (let h = parseInt(conf.start); h < parseInt(conf.end); h++) { slots.push(`${h.toString().padStart(2, '0')}:00`, `${h.toString().padStart(2, '0')}:30`); }
      const { data: ex } = await supabase.from('appointments').select('start_time').eq('profile_id', business.id).gte('start_time', `${selectedDate}T00:00:00Z`).lte('start_time', `${selectedDate}T23:59:59Z`);
      const taken = ex?.map(a => new Date(a.start_time).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' })) || [];
      setAvailableSlots(slots.filter(t => !taken.includes(t)));
    }
    getSlots();
  }, [selectedDate, business, selectedService]);

  const handleBook = async (e) => {
    e.preventDefault(); if (!selectedTime || !customerName || !customerPhone) return; setBookingLoading(true);
    const start = new Date(`${selectedDate}T${selectedTime}:00Z`);
    const { error } = await supabase.from('appointments').insert([{ profile_id: business.id, service_id: selectedService.id, customer_name: customerName, customer_phone: customerPhone, start_time: start.toISOString(), end_time: new Date(start.getTime() + selectedService.duration_minutes * 60000).toISOString() }]);
    setBookingLoading(false);
    if (!error) { setBookingSuccess(true); await sendWhatsAppNotification(customerPhone, `התור שלך ב-${business.business_name} נקבע ל-${selectedDate} ב-${selectedTime}! 🎉`); }
    else if (error.code === '23505') { alert('⚠️ השעה נתפסה.'); setSelectedTime(''); }
  };

  if (loading) return <div className="flex h-screen items-center justify-center text-stone-900 bg-neutral-50 font-sans text-sm font-medium">טוען...</div>;
  if (!business) return <div className="flex h-screen items-center justify-center text-stone-400 font-medium bg-neutral-50">העסק לא נמצא</div>;

  return (
    <div className="min-h-screen bg-neutral-50 py-10 px-4 text-right antialiased font-sans" dir="rtl">
      <div className="max-w-md mx-auto bg-white rounded-[2.5rem] shadow-2xl overflow-hidden border border-neutral-200/60">
        <div className="bg-neutral-900 text-white pt-12 pb-8 text-center px-6 relative">
          <div className="absolute top-4 right-4 bg-white/10 text-white/90 text-[10px] font-bold tracking-widest px-3 py-1 rounded-full backdrop-blur-md">● ONLINE BOOKING</div>
          <div className="w-16 h-16 bg-stone-800 rounded-2xl mx-auto mb-4 flex items-center justify-center border border-white/10 shadow-lg text-white font-mono text-xl font-bold">{business.business_name.substring(0, 2).toUpperCase()}</div>
          <h1 className="text-2xl font-bold text-white mb-1.5">{business.business_name}</h1>
          <p className="text-neutral-400 text-xs font-normal">קביעת תור פרימיום מהירה בנייד</p>
        </div>
        {business.gallery_urls && business.gallery_urls.length > 0 && (
          <div className="p-4 border-b border-neutral-100 bg-white">
            <span className="text-[10px] font-bold text-neutral-400 block mb-2 tracking-wider">📸 גלריית עבודות:</span>
            <div className="grid grid-cols-3 gap-2">{business.gallery_urls.map((url, i) => (<div key={i} className="aspect-square rounded-xl overflow-hidden bg-neutral-100 border shadow-sm"><img src={url} alt="גלריה" className="w-full h-full object-cover" /></div>))}</div>
          </div>
        )}
        <div className="p-4 bg-neutral-50 border-b border-neutral-100 px-6">
          <a href={`https://waze.com{encodeURIComponent(business.address || 'תל אביב')}&navigate=yes`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 group"><div className="w-8 h-8 bg-neutral-900 text-white rounded-xl flex items-center justify-center text-xs shadow-md">📍</div><div className="text-xs"><span className="font-bold text-neutral-900 block mb-0.5">מיקום (לחצי לניווט ב-Waze):</span><span className="text-neutral-500 underline decoration-neutral-300">{business.address || 'דיזנגוף 120, תל אביב'}</span></div></a>
        </div>
        <div className="p-6">
          {bookingSuccess ? (
            <div className="text-center py-8"><div className="w-14 h-14 bg-neutral-900 text-white text-lg rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg">✓</div><h2 className="text-xl font-bold text-neutral-900 mb-1.5">התור נקבע בהצלחה</h2><p className="text-neutral-500 text-xs mb-6">פרטי התור נשלחו אלייך כעת ב-WhatsApp.</p><button onClick={() => { setBookingSuccess(false); setSelectedService(null); }} className="w-full bg-neutral-900 text-white text-xs font-bold py-3.5 rounded-xl">שריון תור חדש</button></div>
          ) : !selectedService ? (
            <div className="space-y-3.5"><h2 className="font-bold text-neutral-900 text-sm tracking-wide mb-3">⚡ 1. בחרי טיפול:</h2>
              {services.map(s => (<div key={s.id} onClick={() => setSelectedService(s)} className="border border-neutral-100 rounded-2xl p-4 flex justify-between items-center cursor-pointer bg-neutral-50/50 hover:bg-white hover:border-neutral-900 hover:shadow-xl transition-all duration-300"><div><h3 className="font-bold text-neutral-900 text-sm">{s.name}</h3><p className="text-neutral-400 text-[11px] mt-0.5">⏱️ {s.duration_minutes} דקות</p></div><span className="font-bold text-neutral-950 text-lg block">₪{s.price}</span></div>))}
            </div>
          ) : (
            <div><button onClick={() => { setSelectedService(null); setSelectedDate(''); }} className="text-[11px] font-bold text-neutral-500 bg-neutral-100 px-3 py-1.5 rounded-lg mb-5">← חזרה</button><div className="bg-neutral-50 rounded-2xl p-4 mb-5 border border-neutral-100"><span className="text-[10px] text-neutral-400 block font-bold">השירות:</span><span className="font-bold text-neutral-800 text-sm">{selectedService.name}</span><span className="text-neutral-900 font-bold text-sm float-left">₪{selectedService.price}</span></div>
              <form onSubmit={handleBook} className="space-y-5">
                <div><label className="block text-xs font-bold text-neutral-700 mb-1.5">📅 2. בחר תאריך:</label><input type="date" required min={new Date().toISOString().split('T')[0]} value={selectedDate} onChange={(e) => { setSelectedDate(e.target.value); setSelectedTime(''); }} className="w-full border border-neutral-200 rounded-xl p-3 bg-neutral-50/50 text-xs font-bold" /></div>
                {selectedDate && availableSlots.length === 0 && <p className="text-xs text-rose-500 font-bold text-center py-4 bg-rose-50 rounded-xl">❌ אופס! העסק סגור או שאין שעות פנויות ביום זה.</p>}
                {selectedDate && availableSlots.length > 0 && (<div><label className="block text-xs font-bold text-neutral-700 mb-2">⏰ 3. בחר שעה:</label><div className="grid grid-cols-4 gap-2">{availableSlots.map(t => <button type="button" key={t} onClick={() => setSelectedTime(t)} className={`p-2.5 text-xs font-bold rounded-xl border text-center transition-all ${selectedTime === t ? 'bg-neutral-900 text-white' : 'bg-white text-slate-700'}`}>{t}</button>)}</div></div>)}
                {selectedTime && (<div className="space-y-3.5 pt-4 border-t border-neutral-100"><input type="text" required value={customerName} onChange={e => setCustomerName(e.target.value)} className="w-full border border-neutral-200 rounded-xl p-3 text-xs focus:outline-neutral-900" placeholder="שם מלא" /><input type="tel" required value={customerPhone} onChange={e => setCustomerPhone(e.target.value)} className="w-full border border-neutral-200 rounded-xl p-3 text-xs text-left" dir="ltr" placeholder="מספר נייד" /><button type="submit" disabled={bookingLoading} className="w-full bg-neutral-900 text-white font-bold py-3.5 rounded-xl text-xs">{bookingLoading ? 'משריין...' : '✓ קבע תור'}</button></div>)}
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
