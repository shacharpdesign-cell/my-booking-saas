/**
 * פונקציה לשליחת הודעת וואטסאפ או SMS אוטומטית
 * @param {string} phone - מספר הטלפון של הלקוח (למשל: 0501234567)
 * @param {string} message - תוכן ההודעה שנרצה לשלוח
 */
export async function sendWhatsAppNotification(phone, message) {
  try {
    // שלב פיתוח: נדפיס קודם כל את ההודעה ל-Console כדי לראות שהיא עובדת פנטסטי
    console.log(`--- [שליחת הודעת וואטסאפ אוטומטית] ---`);
    console.log(`אל מספר: ${phone}`);
    console.log(`תוכן: ${message}`);
    console.log(`-------------------------------------`);

    // כאן בעתיד נחליף את ה-fetch לקישור של ספק הוואטסאפ האמיתי שלך:
    /*
    const response = await fetch('https://whatsapp-provider.com', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer YOUR_TOKEN' },
      body: JSON.stringify({ number: phone, text: message })
    });
    return response.ok;
    */

    return true; // החזרת תשובה חיובית שהתהליך עבר בהצלחה
  } catch (error) {
    console.error('שגיאה בשליחת הודעת הוואטסאפ:', error);
    return false;
  }
}
