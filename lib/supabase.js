import { createClient } from '@supabase/supabase-js';

// הכתובת המלאה והמדויקת של הפרויקט שלך בסופאבייס
const supabaseUrl = 'https://pgcfqexwnzbonydtyiey.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBnY2ZxZXh3bnpib255ZHR5aWV5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTAzMTg3NTQsImV4cCI6MjEwNTg5NDc1NH0.TxQfRvkf_qmfpcODU3i3_34BkQNMWV9dMEtQl8KKaq8';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
