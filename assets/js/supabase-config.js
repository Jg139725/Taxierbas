const SUPABASE_URL = "https://hhuliziurzwqcocuhtiq.supabase.co";

const SUPABASE_PUBLISHABLE_KEY =
  "sb_publishable_mxC8-3tjkSUl1AUi7xrPXQ_QmvptQa4";

window.taxiSupabase = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_PUBLISHABLE_KEY,
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      storage: window.localStorage
    }
  }
);

console.info("Taxi Erbas Auth 14.1 geladen");

// Web Push 14.3 – dieser öffentliche VAPID-Key darf im Frontend stehen.
window.TAXI_ERBAS_VAPID_PUBLIC_KEY = "BGSzg-_F2MygIHwvOJ9anh7PHeyhXMuMff3yf-nh5PkFzi3K8xmS1kltvLAatGih0zmXHzKMnY8812XFlD4EVaA";
