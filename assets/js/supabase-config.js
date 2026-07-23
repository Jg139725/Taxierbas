const SUPABASE_URL = "https://hhuliziurzwqcocuhtiq.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_mxC8-3tjkSUl1AUi7xrPXQ_QmvptQa4";

window.taxiSupabase = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_PUBLISHABLE_KEY,
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true
    }
  }
);
