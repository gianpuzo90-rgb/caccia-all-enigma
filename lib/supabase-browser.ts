"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Client lato browser: unica istanza condivisa. I cookie di sessione
 * li scrive/legge @supabase/ssr, e il middleware li rinfresca a ogni
 * richiesta: qui serve solo per signUp/signInWithPassword/signOut e
 * per ascoltare i cambi di sessione con onAuthStateChange.
 */
let client: SupabaseClient | undefined;

export function supabaseBrowser(): SupabaseClient {
  if (!client) {
    client = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
  }
  return client;
}
