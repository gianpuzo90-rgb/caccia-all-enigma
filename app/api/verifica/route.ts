import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin, utenteCorrente, livelloRaggiunto } from "@/lib/supabase";
import { hashCandidati, normalizza, PRIMO_LIVELLO_SERVER } from "@/lib/enigmi";

export const dynamic = "force-dynamic";

const TENTATIVI_AL_MINUTO = 10;
const LUNGHEZZA_MAX = 120;

/**
 * POST /api/verifica  { livello, risposta }
 * L'unico giudice della correttezza. Il client riceve true/false e
 * nient'altro: nessun suggerimento, nessuna soluzione, nessun indizio
 * su "quanto ci sei andato vicino".
 */
export async function POST(req: NextRequest) {
  const utente = await utenteCorrente();
  if (!utente) {
    return NextResponse.json({ errore: "serve la registrazione" }, { status: 401 });
  }

  let body: { livello?: unknown; risposta?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ errore: "richiesta malformata" }, { status: 400 });
  }

  const livello = Number(body.livello);
  const risposta = typeof body.risposta === "string" ? body.risposta : "";

  if (!Number.isInteger(livello) || livello < PRIMO_LIVELLO_SERVER) {
    return NextResponse.json({ errore: "livello non valido" }, { status: 400 });
  }
  if (!risposta.trim() || risposta.length > LUNGHEZZA_MAX) {
    return NextResponse.json({ errore: "risposta non valida" }, { status: 400 });
  }

  const admin = supabaseAdmin();

  // 1) non si risponde a enigmi non sbloccati
  const massimo = await livelloRaggiunto(utente.id);
  if (livello > massimo + 1) {
    return NextResponse.json({ errore: "enigma non ancora sbloccato" }, { status: 403 });
  }

  // 2) antibruteforce: dizionari e script si fermano qui
  const finestra = new Date(Date.now() - 60_000).toISOString();
  const { count: recenti } = await admin
    .from("tentativi")
    .select("*", { count: "exact", head: true })
    .eq("utente", utente.id)
    .gte("creato_il", finestra);

  if ((recenti ?? 0) >= TENTATIVI_AL_MINUTO) {
    return NextResponse.json(
      { errore: "troppi tentativi: aspetta un minuto" },
      { status: 429, headers: { "Retry-After": "60" } }
    );
  }

  // 3) confronto per hash: la soluzione in chiaro non esiste da nessuna parte
  const { data: enigma } = await admin
    .from("enigmi")
    .select("soluzioni_hash, attivo")
    .eq("livello", livello)
    .maybeSingle();

  if (!enigma || !enigma.attivo) {
    return NextResponse.json({ errore: "enigma non disponibile" }, { status: 404 });
  }

  const candidati = hashCandidati(livello, risposta);
  const corretto = candidati.some((h) => enigma.soluzioni_hash.includes(h));

  // 4) traccia sempre: serve al rate limit e a capire dove si incagliano
  await admin.from("tentativi").insert({
    utente: utente.id,
    livello,
    risposta_norm: normalizza(risposta).slice(0, LUNGHEZZA_MAX),
    corretto,
  });

  if (!corretto) {
    return NextResponse.json({ corretto: false }, { headers: { "Cache-Control": "no-store" } });
  }

  // 5) avanzamento scritto SOLO qui, mai dal client
  await admin
    .from("progressi")
    .upsert({ utente: utente.id, livello }, { onConflict: "utente,livello", ignoreDuplicates: true });

  const { count: prossimoEsiste } = await admin
    .from("enigmi")
    .select("*", { count: "exact", head: true })
    .eq("livello", livello + 1)
    .eq("attivo", true);

  return NextResponse.json(
    { corretto: true, prossimo: prossimoEsiste ? livello + 1 : null },
    { headers: { "Cache-Control": "no-store" } }
  );
}
