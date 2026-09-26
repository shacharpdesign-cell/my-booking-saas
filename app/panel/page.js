'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { getSupabase } from '../../lib/supabase';

export default function OwnerPanel() {
  const router = useRouter();
  const [business, setBusiness] = useState(null);
  const [appointments, setAppointments] = useState([]);
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [logoutLoading, setLogoutLoading] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    let request = 0;
    let ownerId = null;
    let subscription;
    let refreshTimer;

    function clearData() {
      setBusiness(null);
      setAppointments([]);
      setServices([]);
    }

    async function load() {
      const current = ++request;
      const isCurrent = () => active && current === request;
      setLoading(true);
      setError('');
      clearData();
      try {
        const supabase = getSupabase();
        // Validate identity with Auth; never take the business ID from the URL.
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (!isCurrent()) return;
        if (authError || !user) {
          if (!user && (!authError || authError.name === 'AuthSessionMissingError')) {
            router.replace('/');
            return;
          }
          throw new Error('לא ניתן לאמת את ההתחברות. נסו שוב או התחברו מחדש.');
        }
        ownerId = user.id;
        const { data: profile, error: profileError } = await supabase
          .from('profiles').select('id, business_name, slug, address')
          .eq('id', user.id).maybeSingle();
        if (!isCurrent()) return;
        if (profileError) throw new Error('לא ניתן לטעון את פרטי העסק. נסו שוב.');
        if (!profile) throw new Error('לא נמצא עסק המקושר לחשבון זה. יש לפנות לתמיכה.');
        if (profile.id !== user.id) throw new Error('אין הרשאה לצפות בעסק זה.');

        // These filters scope the UI. Supabase RLS must also enforce ownership.
        const [appointmentResult, serviceResult] = await Promise.all([
          supabase.from('appointments')
            .select('profile_id, service_id, customer_name, customer_phone, start_time, end_time')
            .eq('profile_id', user.id).order('start_time', { ascending: true }),
          supabase.from('services')
            .select('id, profile_id, name, duration_minutes, price')
            .eq('profile_id', user.id).order('name'),
        ]);
        if (!isCurrent()) return;
        if (appointmentResult.error || serviceResult.error) {
          throw new Error('לא ניתן לטעון את התורים והשירותים. נסו שוב.');
        }
        const ownAppointments = appointmentResult.data || [];
        const ownServices = serviceResult.data || [];
        if ([...ownAppointments, ...ownServices].some(row => row.profile_id !== user.id)) {
          throw new Error('אין הרשאה לצפות בנתונים אלה.');
        }
        setBusiness(profile);
        setAppointments(ownAppointments);
        setServices(ownServices);
      } catch (err) {
        if (isCurrent()) setError(err instanceof Error ? err.message : 'אירעה שגיאה בטעינת העסק.');
      } finally {
        if (isCurrent()) setLoading(false);
      }
    }

    try {
      const supabase = getSupabase();
      subscription = supabase.auth.onAuthStateChange((event, session) => {
        if (!active) return;
        if (event === 'SIGNED_OUT' || (event !== 'INITIAL_SESSION' && !session)) {
          ++request;
          ownerId = null;
          clearData();
          setLoading(false);
          router.replace('/');
        } else if (event === 'SIGNED_IN' && ownerId && session.user.id !== ownerId) {
          ++request;
          ownerId = null;
          clearData();
          setLoading(true);
          // Run outside the auth callback to avoid holding the SDK auth lock.
          refreshTimer = setTimeout(() => { if (active) void load(); }, 0);
        }
      }).data.subscription;
    } catch {
      // load() reports configuration failures through the normal error state.
    }
    void load();
    return () => {
      active = false;
      ++request;
      clearTimeout(refreshTimer);
      subscription?.unsubscribe();
    };
  }, [router, attempt]);

  async function logout() {
    setLogoutLoading(true);
    setError('');
    try {
      const { error: logoutError } = await getSupabase().auth.signOut();
      if (logoutError) throw logoutError;
      setBusiness(null);
      setAppointments([]);
      setServices([]);
      router.replace('/');
    } catch {
      setError('ההתנתקות נכשלה. נסו שוב.');
    } finally {
      setLogoutLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-neutral-50 px-4 py-8 text-right text-neutral-900" dir="rtl">
      <div className="mx-auto max-w-4xl space-y-6">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">{business?.business_name || 'ניהול העסק'}</h1>
            <p className="text-sm text-neutral-500">LUMIERA · לוח הבקרה</p>
          </div>
          <button type="button" onClick={logout} disabled={logoutLoading} className="rounded-xl bg-neutral-900 px-4 py-2 text-sm text-white disabled:opacity-50">
            {logoutLoading ? 'מתנתק...' : 'התנתקות'}
          </button>
        </header>
        {error && (
          <div role="alert" className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-rose-800">
            <p>{error}</p>
            <button type="button" onClick={() => setAttempt(value => value + 1)} className="mt-2 underline">נסו שוב</button>
            <Link href="/" className="mr-4 underline">לעמוד ההתחברות</Link>
          </div>
        )}
        {loading && <p role="status">טוען את נתוני העסק...</p>}
        {!loading && business && (
          <>
            <div className="flex flex-wrap gap-4 text-sm">
              <Link href={`/${encodeURIComponent(business.slug)}`} className="underline">לעמוד הזמנת התורים</Link>
              {business.address && <a href={`https://www.waze.com/ul?q=${encodeURIComponent(business.address)}&navigate=yes`} target="_blank" rel="noopener noreferrer" className="underline">ניווט לעסק</a>}
            </div>
            <section className="rounded-3xl border border-neutral-200 bg-white p-6">
              <h2 className="mb-4 text-lg font-bold">תורים</h2>
              {appointments.length === 0 ? <p className="text-sm text-neutral-500">עדיין אין תורים לעסק.</p> : (
                <ul className="divide-y divide-neutral-100">
                  {appointments.map((appointment, index) => (
                    <li key={`${appointment.start_time}-${index}`} className="space-y-1 py-3 text-sm">
                      <p className="font-bold">{appointment.customer_name}</p>
                      <p><bdi>{appointment.customer_phone}</bdi></p>
                      <p>{services.find(service => service.id === appointment.service_id)?.name || 'שירות'}</p>
                      {/* Match the UTC convention used by the existing booking form. */}
                      <p>{new Date(appointment.start_time).toLocaleString('he-IL', { timeZone: 'UTC', dateStyle: 'short', timeStyle: 'short' })}</p>
                    </li>
                  ))}
                </ul>
              )}
            </section>
            <section className="rounded-3xl border border-neutral-200 bg-white p-6">
              <h2 className="mb-4 text-lg font-bold">שירותים</h2>
              {services.length === 0 ? <p className="text-sm text-neutral-500">עדיין אין שירותים לעסק.</p> : (
                <ul className="divide-y divide-neutral-100">
                  {services.map(service => <li key={service.id} className="py-3 text-sm">{service.name} · {service.duration_minutes} דקות · ₪{service.price}</li>)}
                </ul>
              )}
            </section>
          </>
        )}
      </div>
    </main>
  );
}
