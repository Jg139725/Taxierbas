const SUPABASE_URL = "https://hhuliziurzwqcocuhtiq.supabase.co";

const SUPABASE_PUBLISHABLE_KEY =
  "sb_publishable_mxC8-3tjkSUl1AUi7xrPXQ_QmvptQa4";

const taxiPersistentStorage = {
  getItem(key) {
    try {
      const localValue = window.localStorage.getItem(key);
      if (localValue !== null) return localValue;
    } catch (error) {
      console.warn("localStorage nicht verfügbar:", error);
    }

    try {
      return window.sessionStorage.getItem(key);
    } catch (error) {
      console.warn("sessionStorage nicht verfügbar:", error);
      return null;
    }
  },

  setItem(key, value) {
    let saved = false;

    try {
      window.localStorage.setItem(key, value);
      saved = true;
    } catch (error) {
      console.warn("Session konnte nicht in localStorage gespeichert werden:", error);
    }

    try {
      window.sessionStorage.setItem(key, value);
      saved = true;
    } catch (error) {
      console.warn("Session konnte nicht in sessionStorage gespeichert werden:", error);
    }

    if (!saved) {
      console.error("Der Browser blockiert die lokale Speicherung der Anmeldung.");
    }
  },

  removeItem(key) {
    try { window.localStorage.removeItem(key); } catch (_) {}
    try { window.sessionStorage.removeItem(key); } catch (_) {}
  }
};

window.taxiSupabase = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_PUBLISHABLE_KEY,
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      storage: taxiPersistentStorage,
      storageKey: "taxi-erbas-auth-v1"
    }
  }
);

console.info("Taxi Erbas Supabase 13.9 geladen");
