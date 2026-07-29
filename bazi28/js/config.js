import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

export const SUPABASE_URL = "https://hhcubvixldieuwdeqnwc.supabase.co";
export const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_S-fBRRvMYbhAq_FmxgTDbQ_qGeQKmwA";
export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
});

export const APP_TIMEZONE = "Asia/Taipei";

