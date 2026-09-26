import { createClient } from '@supabase/supabase-js';

let client;

// Initialize only when used, so missing configuration can be shown in the UI.
export function getSupabase() {
  if (client) return client;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error('החיבור לשירות אינו מוגדר. יש לפנות לבעל האתר.');
  }
  client = createClient(url, anonKey);
  return client;
}
