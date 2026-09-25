'use client';
import { useEffect, useState, use } from 'react';
import { supabase } from '../../lib/supabase';
import { sendWhatsAppNotification } from '../../lib/notification';

export default function BusinessProfile({ params }) {
  const resolvedParams = use(params);
  const slug = resolvedParams?.slug;
  const [business, setBusiness] = useState(null);
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedService, setSelectedService] = useState(null);
  const [selectedDate, setSelectedDate] = useState('');
  const [availableSlots, setAvailableSlots] = useState([]);
  const [selectedTime, setSelectedTime] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [bookingLoading, setBookingLoading] = useState(false);
  const [bookingSuccess, setBookingSuccess] = useState(false);

  useEffect(() => {
    async function fetchBusinessData() {
      if (!slug) return;
      const { data: p } = await supabase.from('profiles').select('*').eq('slug', slug.toLowerCase().trim()).single();
      if (!p) return setLoading(false);
      setBusiness(p);
      const { data: s } = await supabase.from('services').select('*').eq('profile_id', p.id);
      if (s) setServices(s);
      setLoading(false);
    }
    fetchBusinessData();
  }, [slug]);

  useEffect(() => {
    if (!selectedDate || !business || !selectedService) return;
    async function generateAvailableSlots() {
      const dObj = new Date(selectedDate);
      const dayOfWeek = dObj.getDay().toString();
      const weeklyHours = business.weekly_hours || {};
      const dayConfig = weeklyHours[dayOfWeek] || { is_open: true, start: '09:00', end: '17:00' };
      if (!dayConfig.is_open) { setAvailableSlots([]); return; }
      const start = parseInt(dayConfig.start); const end = parseInt(dayConfig.end); const slots = [];
      for (let hour = start; hour < end; hour++) { const hStr = hour.toString().padStart(2, '0'); slots.push(`${hStr}:00`, `${hStr}:30`); }
      const { data: existing } = await supabase.from('appointments').select('start_time').eq('profile_id', business.id).gte('start_time', `${selectedDate}T00:00:00Z`).lte('start_time', `${selectedDate}T23:59:59Z`);
      const taken = existing?.map(app => new Date(app.start_time).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' })) || [];
      setAvailableSlots(slots.filter(time => !taken.includes(time)));
    }
    generateAvailableSlots();
  }, [selectedDate, business, selectedService]);

  const generateCalendarLink = () => {
    if (!selectedDate || !selectedTime || !selectedService || !business) return '';
    const startStr = `${selectedDate.replace(/-/g, '')}T${selectedTime.replace(/:/g, '')}00Z`;
    const endStr = new Date(new Date(`${selectedDate}T${selectedTime}:00Z`).getTime() + selectedService.duration_minutes * 60000).toISOString().replace(/-|:|\.\d\d\d/g, '');
    const tParam = encodeURIComponent('תור ל-' + selectedService.name + ' - ' + business.business_name);
    return `https://google.com{tParam}&dates=${startStr}/${endStr}&details=${encodeURIComponent('קבעת תור מושלם!')}&location=${encodeURIComponent(business.address || 'תל אביב')}`;
  };

  const handleBookAppointment = async (e) => {
    e.preventDefault(); if (!selectedTime || !customerName || !customerPhone) return; setBookingLoading(true);
    const start = new Date(`${selectedDate}T${selectedTime}:00Z`);
    const { error } = await supabase.from('appointments').insert([{ profile_id: business.id, service_id: selectedService.id, customer_name: customerName, customer_phone: customerPhone, start_time: start.toISOString(), end_time: new Date(start.getTime() + selectedService.duration_minutes * 60000).toISOString() }]);
    setBookingLoading(false);
    if (!error) { setBookingSuccess(true); await sendWhatsAppNotification(customerPhone, `היי ${customerName}, התור שלך ב*${business.business_name}* נקבע ל-${selectedDate} בשעה ${selectedTime}! 🎉`); }
    else if (error.code === '23505') { alert('⚠️ השעה נתפסה כרגע.'); setSelectedTime(''); }
  };

  if (loading) return <div className="flex h-screen items-center justify-center text-amber-700 bg-stone-50 font-serif italic text-xl">Loading...</div>;
  if (!business) return <div className="flex h-screen items-center justify-center text-stone-500 font-bold bg-stone-50">העסק לא נמצא</div>;

  return (
    <div className="min-h-screen bg-stone-50 py-8 px-4 text-right" dir="rtl">
      <div className="max-w-md mx-auto bg-white rounded-3xl shadow-2xl overflow-hidden border border-stone-100">
        <div className="bg-white pt-10 pb-6 text-center border-b border-stone-100 px-6">
          <div className="w-20 h-20 bg-stone-900 rounded-full mx-auto mb-4 flex items-center justify-center border-2 border-amber-400/30 shadow-xl"><span className="text-amber-400 font-serif text-2xl font-bold uppercase">{business.business_name.substring(0, 2)}</span></div>
          <h1 className="text-2xl font-serif font-semibold text-stone-950 mb-1">{business.business_name}</h1>
          <div className="inline-block bg-amber-50 text-amber-800 text-[10px] uppercase font-bold tracking-wider px-3 py-1 rounded-full border border-amber-200/50">מערכת תורים פרימיום</div>
        </div>
        <div className="p-4 bg-stone-50/50 border-b border-stone-100 text-xs text-stone-600 px-6">
          <a href={`https://waze.com{encodeURIComponent(business.address || 'תל אביב')}&navigate=yes`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 group hover:text-amber-700">💎 <div><span className="font-bold text-stone-900 block">כתובת העסק (לחצי לניווט ב-Waze):</span> <span className="underline decoration-amber-400/50">{business.address || 'דיזנגוף 120, תל אביב'}</span></div></a>
        </div>
        <div className="p-6">
          {bookingSuccess ? (
            <div className="text-center py-8"><div className="w-14 h-14 bg-stone-950 text-amber-400 text-xl rounded-full flex items-center justify-center mx-auto mb-4">✓</div><h2 className="text-xl font-serif font-medium mb-1">התור נקבע בהצלחה</h2><a href={generateCalendarLink()} target="_blank" rel="noopener noreferrer" className="inline-flex items-center justify-center w-full bg-amber-50 text-amber-900 font-bold py-3 rounded-xl text-xs mb-3 border">📅 הוספה ליומן (Google / Apple)</a><button onClick={() => { setBookingSuccess(false); setSelectedService(null); }} className="w-full bg-stone-950 text-white text-xs font-bold py-3 rounded-xl">שריון תור חדש</button></div>
          ) : !selectedService ? (
            <div className="space-y-3.5"><h2 className="font-serif font-medium text-stone-900 text-sm mb-2">I. בחרי טיפול מבוקש:</h2>
              {services.map(s => (<div key={s.id} onClick={() => setSelectedService(s)} className="border border-stone-100 rounded-2xl p-4 flex justify-between items-center cursor-pointer bg-stone-50/30 hover:bg-white hover:border-amber-400/50 hover:shadow-xl transition-all duration-300"><div><h3 className="font-semibold text-stone-900 text-sm">{s.name}</h3><p className="text-stone-400 text-[11px] mt-0.5">⏱️ {s.duration_minutes} דקות</p></div><span className="font-serif font-bold text-stone-950 text-lg">₪{s.price}</span></div>))}
            </div>
          ) : (
            <div><button onClick={() => { setSelectedService(null); setSelectedDate(''); }} className="text-[11px] font-bold text-amber-700 bg-amber-50 px-3 py-1.5 rounded-lg mb-5">← חזרה לקטלוג</button>
              <form onSubmit={handleBookAppointment} className="space-y-5">
                <div><label className="block text-xs font-bold text-stone-700 mb-1.5">II. תאריך הגעה:</label><input type="date" required min={new Date().toISOString().split('T')} value={selectedDate} onChange={(e) => { setSelectedDate(e.target.value); setSelectedTime(''); }} className="w-full border rounded-xl p-3 bg-stone-50/50 text-xs font-semibold focus:outline-amber-500 text-right" /></div>
                {selectedDate && availableSlots.length === 0 && <p className="text-xs text-rose-500 font-bold text-center py-4">❌ אופס! העסק סגור או שאין שעות פנויות ביום זה.</p>}
                {selectedDate && availableSlots.length > 0 && (<div><label className="block text-xs font-bold text-stone-700 mb-2">III. שעה פנויה:</label><div className="grid grid-cols-4 gap-2">{availableSlots.map(t => <button type="button" key={t} onClick={() => setSelectedTime(t)} className={`p-2.5 text-xs font-bold rounded-xl border text-center transition-all ${selectedTime === t ? 'bg-stone-950 text-amber-400 border-stone-950' : 'bg-white text-stone-700'}`}>{t}</button>)}</div></div>)}
                {selectedTime && (<div className="space-y-3.5 pt-4 border-t border-stone-100"><input type="text" required value={customerName} onChange={e => setCustomerName(e.target.value)} className="w-full border rounded-xl p-3 text-xs focus:outline-amber-500" placeholder="שם מלא שלך" /><input type="tel" required value={customerPhone} onChange={e => setCustomerPhone(e.target.value)} className="w-full border rounded-xl p-3 text-xs text-left" dir="ltr" placeholder="מספר נייד" /><button type="submit" disabled={bookingLoading} className="w-full bg-stone-950 text-amber-400 font-bold py-3.5 rounded-xl text-xs">{bookingLoading ? 'משריין...' : '✓ אשרי וקבעי תור'}</button></div>)}
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
