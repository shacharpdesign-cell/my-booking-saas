'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../lib/supabase';

export default function Home() {
  const router = useRouter(); const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState(''); const [password, setPassword] = useState('');
  const [businessName, setBusinessName] = useState(''); const [slug, setSlug] = useState('');
  const [loading, setLoading] = useState(false); const [msg, setMsg] = useState({ type: '', text: '' });

  const handleAuth = async (e) => {
    e.preventDefault(); setLoading(true); setMsg({ type: '', text: '' });
    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        setMsg({ type: 's', text: 'התחברת בהצלחה! מועבר ללוח הניהול...' });
        setTimeout(() => router.push('/panel'), 1200);
      } else {
        const { data, error: authError } = await supabase.auth.signUp({ email, password });
        if (authError) throw authError; if (!data?.user) throw new Error('תקלה ברישום');
        const cleanSlug = slug.toLowerCase().trim().replace(/\s+/g, '-');
        const { error: pError } = await supabase.from('profiles').insert([{ id: data.user.id, business_name: businessName, slug: cleanSlug }]);
        if (pError) throw pError;
        setMsg({ type: 's', text: 'הסטודיו נרשם בהצלחה! מעביר אותך להתחברות...' });
        setTimeout(() => { setIsLogin(true); setBusinessName(''); setSlug(''); }, 2000);
      }
    } catch (err) { setMsg({ type: 'e', text: err.message || 'אופס! משהו השתבש.' }); } finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen bg-[#fff8f8] flex flex-col justify-center py-12 px-4 relative overflow-hidden text-right antialiased font-sans" dir="rtl">
      <div className="absolute -top-10 -right-8 w-56 h-56 rounded-full bg-[#fdc9af]/45 blur-3xl pointer-events-none -z-10"></div>
      <div className="absolute top-1/3 -left-10 w-60 h-60 rounded-full bg-[#eddfe2]/60 blur-3xl pointer-events-none -z-10"></div>
      <div className="absolute bottom-10 right-1/4 w-48 h-48 rounded-full bg-[#ffd9e1]/40 blur-3xl pointer-events-none -z-10"></div>
      
      <div className="w-full max-w-md mx-auto relative select-none">
      <header className="flex flex-col items-center text-center mt-2 mb-5">
          <div className="relative flex items-center justify-center mb-2">
            {/* קופסת לוגו מיקרוסקופית יוקרתית וחסינת גודל */}
            <div className="w-10 h-10 rounded-full bg-white shadow-sm ring-1 ring-[#d7c1c5]/20 flex items-center justify-center overflow-hidden">
              <img 
                alt="LUMIERA Logo" 
                className="max-w-[40px] max-h-[40px] object-contain" 
                src="/logo.png" 
              />
            </div>
          </div>
          <div className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-[#fef0f3] text-[#7c5641] border border-[#d7c1c5]/50 mb-2 shadow-sm">
            <span className="w-1 h-1 rounded-full bg-[#8f485d]"></span>
            <span className="text-[10px] font-bold tracking-wide">סטודיו בוטיק לשיער ועיצוב ציפורניים</span>
          </div>
          <h1 className="text-[22px] font-black text-[#3f081d] mb-0.5">{isLogin ? 'התחברות לאזור האישי' : 'רישום סטוジオ חדש'}</h1>
          <p className="text-[11.5px] text-[#524346] max-w-xs px-2">{isLogin ? 'צפייה בתורים עתידיים, היסטוריית טיפולים וניהול ה-CRM' : 'הקימי אתר תורים יוקרתי ומערכת ניהול מותאמת בתוך 2 דקות'}</p>
        </header>

        <div className="w-full bg-[#fef0f3] p-1 rounded-full flex items-center mb-5 border border-[#d7c1c5]/40 shadow-inner">
          <button type="button" onClick={() => { setIsLogin(true); setMsg({ type: '', text: '' }); }} className={`flex-1 py-2 px-3 rounded-full text-center text-[12px] font-bold transition-all ${isLogin ? 'bg-white text-[#3f081d] shadow-md' : 'text-[#524346]'}`}>🔑 כניסה לעסק</button>
          <button type="button" onClick={() => { setIsLogin(false); setMsg({ type: '', text: '' }); }} className={`flex-1 py-2 px-3 rounded-full text-center text-[12px] font-bold transition-all ${!isLogin ? 'bg-white text-[#3f081d] shadow-md' : 'text-[#524346]'}`}>✨ פתיחת סטודיו</button>
        </div>

        <div className="w-full bg-white rounded-3xl p-6 shadow-[0_10px_30px_rgba(90,30,50,0.06)] border border-[#d7c1c5]/40 relative overflow-hidden">
          <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-l from-[#7c5641] via-[#eebca2] to-[#3f081d]"></div>
          {msg.text && <div className={`mb-4 p-3 rounded-2xl text-xs font-bold text-center border ${msg.type === 's' ? 'bg-[#3f081d] text-white' : 'bg-rose-50 text-rose-700 border-rose-100'}`}>{msg.text}</div>}
          <form onSubmit={handleAuth} className="flex flex-col gap-4">
            {!isLogin && (
              <>
                <div><label className="text-[12px] text-[#201a1c] font-bold block mb-1">שם הסטודיו:</label><input type="text" required value={businessName} onChange={e => setBusinessName(e.target.value)} className="w-full border border-[#d7c1c5]/60 rounded-xl p-3 text-xs text-neutral-800" placeholder="למשל: לומיירה סלון" /></div>
                <div><label className="text-[12px] text-[#201a1c] font-bold block mb-1">כתובת האתר (Slug):</label><input type="text" required value={slug} onChange={e => setSlug(e.target.value.replace(/[^a-zA-Z0-9-]/g, ''))} className="w-full border border-[#d7c1c5]/60 rounded-xl p-3 text-xs text-left font-mono font-bold text-neutral-800" dir="ltr" placeholder="lumiera-salon" /></div>
              </>
            )}
            <div><label className="text-[12px] text-[#201a1c] font-bold block mb-1">כתובת אימייל:</label><input type="email" required value={email} onChange={e => setEmail(e.target.value)} className="w-full border border-[#d7c1c5]/60 rounded-xl p-3 text-xs text-left text-neutral-800" dir="ltr" placeholder="your-email@example.com" /></div>
            <div><label className="text-[12px] text-[#201a1c] font-bold block mb-1">סיסמה אישית:</label><input type="password" required minLength={6} value={password} onChange={e => setPassword(e.target.value)} className="w-full border border-[#d7c1c5]/60 rounded-xl p-3 text-xs text-left text-neutral-800" dir="ltr" placeholder="••••••" /></div>
            <button type="submit" disabled={loading} className="w-full bg-[#3f081d] hover:bg-[#5a1e32] text-white font-bold py-3.5 rounded-2xl text-xs tracking-widest transition-all mt-3 shadow-lg uppercase">{loading ? 'מעבד נתונים...' : isLogin ? 'התחברות למערכת' : 'הרשמה ופתיחת הסטודיו'}</button>
          </form>
        </div>
      </div>
    </div>
  );
}
