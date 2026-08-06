/* ---------------------------------------------------------------------
   Supabase connection settings.

   1. Create a project at https://supabase.com
   2. Dashboard → Project Settings → API
   3. Paste the Project URL and the "anon / public" key below.

   Leave the placeholders as-is to run the site in DEMO MODE
   (uses built-in sample shipments, no network calls).

   The anon key is safe to expose in the browser — Row Level Security
   in schema.sql restricts it to read-only public tracking lookups.
--------------------------------------------------------------------- */
window.FFL_CONFIG = {
  SUPABASE_URL: "https://tovkewwitmqaunwqmiuf.supabase.co", // e.g. https://abcd1234.supabase.co
  SUPABASE_ANON_KEY: "sb_publishable_xaew-lInTXnCE-qBbCH4AQ_po7oHkjl",
};
