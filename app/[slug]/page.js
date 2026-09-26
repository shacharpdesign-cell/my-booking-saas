'use client';
import { useEffect, useState, use } from 'react';
import { getSupabase } from '../../lib/supabase';
import { sendWhatsAppNotification } from '../../lib/notification';

export default function BusinessProfile({ params }) {
  const resolvedParams = use(params); const slug = resolvedParams?.slug;
  const [business, setBusiness] = useState(null); const [services, setServices] = useState([]); const [loading, setLoading] = useState(true);
  const [selectedService, setSelectedService] = useState(null); const [selectedDate, setSelectedDate] = useState('');
  const [availableSlots, setAvailableSlots] = useState([]); const [selectedTime, setSelectedTime] = useState('');
  const [customerName, setCustomerName] = useState(''); const [customerPhone, setCustomerPhone] = useState('');
  const [bookingLoading, setBookingLoading] = useState(false); const [bookingSuccess, setBookingSuccess] = useState(false);

  const [pageError, setPageError] = useState('');
  const [slotError, setSlotError] = useState('');
  const [bookingError, setBookingError] = useState('');
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [slotAttempt, setSlotAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      setPageError('');
      try {
        const supabase = getSupabase();
        const { data: p, error: profileError } = await supabase.from('profiles').select('*').eq('slug', slug.toLowerCase().trim()).maybeSingle();
        if (profileError) throw new Error('לא ניתן לטעון את העסק. נסו לרענן את העמוד.');
        if (!active) return;
        if (!p) { setBusiness(null); return; }
        const { data: s, error: serviceError } = await supabase.from('services').select('*').eq('profile_id', p.id);
        if (serviceError) throw new Error('לא ניתן לטעון את השירותים. נסו לרענן את העמוד.');
        if (active) { setBusiness(p); setServices(s || []); }
      } catch (err) {
        if (active) setPageError(err instanceof Error ? err.message : 'אירעה שגיאה בטעינת העסק.');
      } finally {
        if (active) setLoading(false);
      }
    }
    if (slug) void load();
    return () => { active = false; };
  }, [slug]);

  useEffect(() => {
    if (!selectedDate || !business || !selectedService) return;
    let active = true;
    async function getSlots() {
      setSlotsLoading(true);
      setAvailableSlots([]);
      setSelectedTime('');
      setSlotError('');
      try {
        const d = new Date(selectedDate); const hours = business.weekly_hours || {};
        const conf = hours[d.getUTCDay().toString()] || { is_open: true, start: '09:00', end: '17:00' };
        if (!conf.is_open) return;
        const slots = [];
        for (let h = parseInt(conf.start); h < parseInt(conf.end); h++) {
          slots.push(`${h.toString().padStart(2, '0')}:00`, `${h.toString().padStart(2, '0')}:30`);
        }
        const { data: ex, error } = await getSupabase().from('appointments').select('start_time').eq('profile_id', business.id).gte('start_time', `${selectedDate}T00:00:00Z`).lte('start_time', `${selectedDate}T23:59:59Z`);
        if (error) throw error;
        const taken = (ex || []).map(a => new Date(a.start_time).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' }));
        if (active) setAvailableSlots(slots.filter(t => !taken.includes(t)));
      } catch {
        if (active) setSlotError('לא ניתן לבדוק זמינות כרגע. נסו שוב.');
      } finally {
        if (active) setSlotsLoading(false);
      }
    }
    void getSlots();
    return () => { active = false; };
  }, [selectedDate, business, selectedService, slotAttempt]);

  const handleBook = async (e) => {
    e.preventDefault();
    if (bookingLoading || slotsLoading || slotError || !business || !selectedService || !selectedDate || !selectedTime || !availableSlots.includes(selectedTime) || !customerName.trim() || !customerPhone.trim()) return;
    setBookingLoading(true);
    setBookingError('');
    try {
      const start = new Date(`${selectedDate}T${selectedTime}:00Z`);
      const { error } = await getSupabase().from('appointments').insert([{ profile_id: business.id, service_id: selectedService.id, customer_name: customerName.trim(), customer_phone: customerPhone.trim(), start_time: start.toISOString(), end_time: new Date(start.getTime() + selectedService.duration_minutes * 60000).toISOString() }]);
      if (error) {
        if (error.code === '23505') {
          setSelectedTime('');
          setSlotAttempt(value => value + 1);
          setBookingError('השעה כבר נתפסה. יש לבחור שעה אחרת.');
          return;
        }
        throw error;
      }
      setBookingSuccess(true);
      await sendWhatsAppNotification(customerPhone, `התור נקבע ל-${selectedDate} ב-${selectedTime}! 🎉`);
    } catch {
      setBookingError('לא ניתן להשלים את ההזמנה. נסו שוב.');
    } finally {
      setBookingLoading(false);
    }
  };

  if (loading) return <div className="flex h-screen items-center justify-center text-stone-900 bg-neutral-50 font-sans text-sm font-medium">טוען...</div>;
  if (pageError) return <div role="alert" className="p-8 text-center text-rose-700" dir="rtl">{pageError}</div>;
  if (!business) return <div className="flex h-screen items-center justify-center text-stone-400 font-medium bg-neutral-50">העסק לא נמצא</div>;

  return (
    <div className="min-h-screen bg-neutral-50 py-10 px-4 text-right antialiased font-sans" dir="rtl">
      <div className="max-w-md mx-auto bg-white rounded-[2.5rem] shadow-2xl overflow-hidden border border-neutral-200/60">
        <div className="bg-neutral-900 text-white pt-12 pb-8 text-center px-6 relative">
          <h1 className="text-2xl font-bold text-white mb-1.5">{business.business_name}</h1>
          <p className="text-neutral-400 text-xs">קביעת תור פרימיום מהירה בנייד</p>
        </div>
        {business.gallery_urls && business.gallery_urls.length > 0 && (
          <div className="p-3 border-b border-neutral-100 bg-white px-6">
            <span className="text-[9px] font-bold text-neutral-400 block mb-1.5 tracking-wider">📸 מהסטודיו:</span>
            <div className="grid grid-cols-3 gap-1.5">
              {business.gallery_urls.map((url, i) => (
                <div key={i} className="aspect-[16/7] max-h-[45px] rounded-lg overflow-hidden bg-neutral-50 border border-neutral-200/40 shadow-sm"><img src={url} alt="גלריה" className="w-full h-full object-cover" /></div>
              ))}
            </div>
          </div>
        )}
        <div className="p-4 bg-neutral-50 border-b border-neutral-100 px-6">
          <a href={`https://www.waze.com/ul?q=${encodeURIComponent(business.address || 'דיזנגוף 120, תל אביב')}&navigate=yes`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 text-xs"><div className="w-8 h-8 bg-neutral-900 text-white rounded-xl flex items-center justify-center font-bold">📍</div><div><span className="font-bold text-neutral-900 block">מיקום העסק (לחצי לניווט ב-Waze):</span><span className="text-neutral-500 underline">{business.address || 'דיזנגוף 120, תל אביב'}</span></div></a>
        </div>
        <div className="p-6">
          {bookingError && <p role="alert" className="mb-4 text-sm text-rose-700">{bookingError}</p>}
          {bookingSuccess ? (
            <div className="text-center py-8"><div className="w-14 h-14 bg-neutral-900 text-white text-lg rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg">✓</div><h2 className="text-xl font-bold text-neutral-900 mb-1.5">התור נקבע בהצלחה</h2><button onClick={() => { setBookingSuccess(false); setSelectedService(null); setSelectedDate(''); setSelectedTime(''); setBookingError(''); }} className="w-full bg-neutral-900 text-white text-xs font-bold py-3.5 rounded-xl">שריון תור חדש</button></div>
          ) : !selectedService ? (
            <div className="space-y-3.5"><h2 className="font-bold text-neutral-900 text-sm tracking-wide mb-3">⚡ 1. בחרי טיפול:</h2>
              {services.map(s => (<div key={s.id} onClick={() => setSelectedService(s)} className="border border-neutral-100 rounded-2xl p-4 flex justify-between items-center cursor-pointer bg-neutral-50/50 hover:bg-white hover:border-neutral-900 hover:shadow-xl transition-all duration-300"><div><h3 className="font-bold text-neutral-900 text-sm">{s.name}</h3><p className="text-neutral-400 text-[11px]">⏱️ {s.duration_minutes} דקות</p></div><span className="font-bold text-neutral-950 text-lg">₪{s.price}</span></div>))}
            </div>
          ) : (
            <div><button onClick={() => { setSelectedService(null); setSelectedDate(''); setSelectedTime(''); setBookingError(''); }} className="text-[11px] font-bold text-neutral-500 bg-neutral-100 px-3 py-1.5 rounded-lg mb-5">← חזרה</button>
              <form onSubmit={handleBook} className="space-y-5">
                <div><label className="block text-xs font-bold text-neutral-700 mb-1.5">📅 2. בחר תאריך:</label><input type="date" required min={new Date().toISOString().split('T')[0]} value={selectedDate} onChange={(e) => { setSelectedDate(e.target.value); setSelectedTime(''); setAvailableSlots([]); setBookingError(''); }} className="w-full border border-neutral-200 rounded-xl p-3 bg-neutral-50/50 text-xs font-bold" /></div>
                {slotsLoading && <p role="status" className="text-sm">בודק זמינות...</p>}
                {slotError && <div role="alert" className="text-sm text-rose-700">{slotError} <button type="button" onClick={() => setSlotAttempt(value => value + 1)} className="underline">נסו שוב</button></div>}
                {selectedDate && !slotsLoading && !slotError && availableSlots.length === 0 && <p className="text-xs text-rose-500 font-bold text-center py-4 bg-rose-50 rounded-xl">❌ אופס! אין שעות פנויות ביום זה.</p>}
                {selectedDate && !slotsLoading && !slotError && availableSlots.length > 0 && (<div><label className="block text-xs font-bold text-neutral-700 mb-2">⏰ 3. בחר שעה:</label><div className="grid grid-cols-4 gap-2">{availableSlots.map(t => <button type="button" key={t} onClick={() => setSelectedTime(t)} className={`p-2.5 text-xs font-bold rounded-xl border text-center transition-all ${selectedTime === t ? 'bg-neutral-900 text-white' : 'bg-white text-slate-700'}`}>{t}</button>)}</div></div>)}
                {selectedTime && (<div className="space-y-3.5 pt-4 border-t border-neutral-100"><input type="text" required value={customerName} onChange={e => setCustomerName(e.target.value)} className="w-full border border-neutral-200 rounded-xl p-3 text-xs focus:outline-neutral-900" placeholder="שם מלא" /><input type="tel" required value={customerPhone} onChange={e => setCustomerPhone(e.target.value)} className="w-full border border-neutral-200 rounded-xl p-3 text-xs text-left" dir="ltr" placeholder="מספר נייד" /><button type="submit" disabled={bookingLoading || slotsLoading} className="w-full bg-neutral-900 text-white font-bold py-3.5 rounded-xl text-xs">✓ קבע תור</button></div>)}
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
