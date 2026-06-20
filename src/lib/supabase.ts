import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn("Peringatan: Kredensial Supabase tidak ditemukan di file .env. Fitur sinkronisasi tidak akan berfungsi.");
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);