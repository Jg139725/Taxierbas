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
window.TAXI_ERBAS_VAPID_PUBLIC_KEY = "BBQCFiQTgEsvMyLkVgT-B-yPQYGAcZ-Iaea5P460fqP2rXwVgI4DdB6Tql0ZznwYCUP2U-S3BorNrmeJ6tudVRU";
