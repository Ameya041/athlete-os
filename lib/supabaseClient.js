import { createClient } from '@supabase/supabase-js';

// Fallback placeholders keep the build from crashing during static prerender;
// real values come from env vars at runtime (set in Vercel project settings).
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-key';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
