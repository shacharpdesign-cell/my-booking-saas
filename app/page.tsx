'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../lib/supabase';

export default function Home() {
  const router = useRouter();
  const [isLoginMode, setIsLoginMode] = useState(true); // מצב התחלתי: התחברות

  // סטייטס משותפים לטפסים
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [slug, setSlug] = useState('');
  
  const [loading, setLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // לוגיקת התחברות (Login)
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;

      if (data?.user) {
        setSuccessMsg('התחברת בהצלחה! מועבר ללוח הבקרה...');
        // העברה אוטומטית ללוח הבקרה לאחר שנייה אחת
        setTimeout(() => {
          router.push('/dashboard');
        }, 1000);
      }
    } catch (error: any) {
      setErrorMsg(error.message || 'פרטי ההתחברות שגויים, אנא נסה שנית.');
    } finally {
      setLoading(false);
    }
  };

  // לוגיקת הרשמה (Sign Up)
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg('');
    setSuccessMsg('');

    const cleanSlug = slug.toLowerCase().trim().replace(/\s+/g, '-');

    try {
      // 1. רישום המשתמש במערכת האותנטיקציה של סופאבייס
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
      });

      if (authError) throw authError;

      const user = authData?.user;
      if (!user) throw new Error('תקלה ברישום המשתמש');

      // 2. יצירת הפרופיל של בעל המקצוע בטבלת profiles
      const { error: profileError } = await supabase
        .from('profiles')
        .insert([
          {
            id: user.id,
            business_name: businessName,
            slug: cleanSlug,
          }
        ]);

      if (profileError) {
        if (profileError.code === '23505') {
          throw new Error('הכתובת (slug) הזו כבר תפוסה על ידי עסק אחר.');
        }
        throw profileError;
      }

      setSuccessMsg(`העסק נרשם בהצלחה! הקישור שלך הוא: localhost:3000/${cleanSlug}`);
      setBusinessName('');
      setSlug('');
      setEmail('');
      setPassword('');
      
      // מעבר אוטומטי למצב התחברות לאחר הרשמה מוצלחת
      setTimeout(() => {
        setIsLoginMode(true);
      }, 3000);

    } catch (error: any) {
      setErrorMsg(error.message || 'אירעה שגיאה בתהליך ההרשמה.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white py-12 px-4 text-right" dir="rtl">
      <div className="max-w-md mx-auto bg-white rounded-2xl shadow-xl p-8 border border-gray-100">
        
        {/* כותרות משתנות לפי המצב */}
        <h1 className="text-3xl font-extrabold text-gray-900 text-center mb-2">
          {isLoginMode ? 'כניסה למערכת' : 'צור אתר תורים משלך'}
        </h1>
        <p className="text-gray-500 text-center mb-8 text-sm">
          {isLoginMode ? 'הזן את פרטי החשבון שלך כדי לנהל את התורים' : 'הצטרף לפלטפורמה והתחל לקבל תורים תוך 2 דקות'}
        </p>

        {/* הודעות מערכת */}
        {successMsg && (
          <div className="mb-6 p-4 bg-green-50 text-green-700 rounded-xl text-sm font-semibold border border-green-200">
            {successMsg}
          </div>
        )}

        {errorMsg && (
          <div className="mb-6 p-4 bg-red-50 text-red-700 rounded-xl text-sm font-semibold border border-red-200">
            {errorMsg}
          </div>
        )}

        {/* טופס התחברות / הרשמה דינמי */}
        <form onSubmit={isLoginMode ? handleLogin : handleRegister} className="space-y-4">
          
          {/* שדות שיופיעו רק בהרשמה */}
          {!isLoginMode && (
            <>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">שם העסק:</label>
                <input type="text" required value={businessName} onChange={(e) => setBusinessName(e.target.value)} className="w-full border border-gray-300 rounded-xl p-3 focus:outline-blue-500 text-gray-800" placeholder="למשל: לק ג'ל מיכל" />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">הקישור המבוקש לאתר (באנגלית בלבד):</label>
                <div className="flex items-center border border-gray-300 rounded-xl overflow-hidden bg-gray-50 px-3 focus-within:border-blue-500" dir="ltr">
                  <span className="text-gray-400 text-sm select-none">localhost:3000/</span>
                  <input type="text" required value={slug} onChange={(e) => setSlug(e.target.value.replace(/[^a-zA-Z0-9-]/g, ''))} className="w-full bg-transparent p-3 text-left focus:outline-none text-gray-800 font-medium" placeholder="michal-nails" />
                </div>
              </div>
            </>
          )}

          {/* שדות משותפים (אימייל וסיסמה) */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">אימייל:</label>
            <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="w-full border border-gray-300 rounded-xl p-3 focus:outline-blue-500 text-gray-800 text-left" dir="ltr" placeholder="name@example.com" />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">סיסמה (לפחות 6 תווים):</label>
            <input type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} className="w-full border border-gray-300 rounded-xl p-3 focus:outline-blue-500 text-gray-800 text-left" dir="ltr" placeholder="******" />
          </div>

          {/* כפתור שליחה משתנה */}
          <button type="submit" disabled={loading} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3.5 rounded-xl transition-all shadow-md mt-4">
            {loading ? (isLoginMode ? 'מתחבר...' : 'מקים את החשבון...') : (isLoginMode ? 'התחברות' : 'הרשמה ופתיחת העסק')}
          </button>
        </form>

        {/* כפתור החלפה בין מצבים */}
        <div className="mt-6 text-center border-t border-gray-100 pt-4">
          <button 
            type="button" 
            onClick={() => { setIsLoginMode(!isLoginMode); setErrorMsg(''); setSuccessMsg(''); }}
            className="text-sm text-blue-600 font-semibold hover:underline"
          >
            {isLoginMode ? 'אין לך חשבון? הרשם כאן בחינם' : 'כבר יש לך חשבון? התחבר כאן'}
          </button>
        </div>

      </div>
    </div>
  );
}
