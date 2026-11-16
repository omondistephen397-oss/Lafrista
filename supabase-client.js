const config = window.LAFRISTA_SUPABASE || {};
export const isSupabaseConfigured = Boolean(config.url && config.anonKey);

let client = null;

if (isSupabaseConfigured) {
  try {
    const { createClient } = await import("https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm");
    client = createClient(config.url, config.anonKey);
  } catch (error) {
    console.error("Could not load the Supabase client library.", error);
  }
}

export const supabase = client;
