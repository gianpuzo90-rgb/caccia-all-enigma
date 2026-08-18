import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

/**
 * Client legato alla sessione dell'utente (cookie httpOnly).
 * Serve SOLO a sapere chi è: non lo usiamo per leggere gli enigmi.
 */
export async function supabaseUtente() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (list) => {
          try {
            list.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            /* chiamato da un Server Component: rinfresca il middleware */
          }
        },
      },
    }
  );
}

/**
 * Client amministrativo: scavalca la RLS.
 * La chiave sta SOLO nelle env del server. Mai NEXT_PUBLIC_, mai
 * importata da un componente client, mai loggata.
 */
export function supabaseAdmin() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error("SUPABASE_SERVICE_ROLE_KEY mancante");
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/**
 * Identità verificata. getUser() valida il JWT contro il server di
 * Supabase: getSession() da solo si accontenta del cookie e non basta.
 */
export async function utenteCorrente() {
  const sb = await supabaseUtente();
  const { data, error } = await sb.auth.getUser();
  if (error || !data.user) return null;
  return data.user;
}

/** Livello massimo risolto (default 3: l'onboarding non è tracciato). */
export async function livelloRaggiunto(utenteId: string): Promise<number> {
  const admin = supabaseAdmin();
  const { data } = await admin
    .from("progressi")
    .select("livello")
    .eq("utente", utenteId)
    .order("livello", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data?.livello ?? 3;
}
