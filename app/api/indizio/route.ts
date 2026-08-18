import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin, utenteCorrente, livelloRaggiunto } from "@/lib/supabase";
import { PRIMO_LIVELLO_SERVER } from "@/lib/enigmi";

export const dynamic = "force-dynamic";

/**
 * POST /api/indizio  { livello }
 * Consegna UN indizio alla volta, in ordine, e segna quanti ne hai
 * usati (peserà sulla classifica). Gli altri restano sul server.
 */
export async function POST(req: NextRequest) {
  const utente = await utenteCorrente();
  if (!utente) {
    return NextResponse.json({ errore: "serve la registrazione" }, { status: 401 });
  }

  let body: { livello?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ errore: "richiesta malformata" }, { status: 400 });
  }

  const livello = Number(body.livello);
  if (!Number.isInteger(livello) || livello < PRIMO_LIVELLO_SERVER) {
    return NextResponse.json({ errore: "livello non valido" }, { status: 400 });
  }

  const massimo = await livelloRaggiunto(utente.id);
  if (livello > massimo + 1) {
    return NextResponse.json({ errore: "enigma non ancora sbloccato" }, { status: 403 });
  }

  const admin = supabaseAdmin();

  const { data: riga } = await admin
    .from("progressi")
    .select("indizi_usati")
    .eq("utente", utente.id)
    .eq("livello", livello)
    .maybeSingle();

  const usati = riga?.indizi_usati ?? 0;
  const prossimo = usati + 1;

  const { data: indizio } = await admin
    .from("indizi")
    .select("testo, ordine")
    .eq("livello", livello)
    .eq("ordine", prossimo)
    .maybeSingle();

  if (!indizio) {
    return NextResponse.json({ errore: "nessun altro indizio" }, { status: 404 });
  }

  // riga di progresso "in corso": livello non ancora risolto, ma indizi contati
  await admin.from("progressi").upsert(
    { utente: utente.id, livello: livello - 1, indizi_usati: 0 },
    { onConflict: "utente,livello", ignoreDuplicates: true }
  );
  await admin
    .from("progressi")
    .update({ indizi_usati: prossimo })
    .eq("utente", utente.id)
    .eq("livello", livello);

  const { count: totali } = await admin
    .from("indizi")
    .select("*", { count: "exact", head: true })
    .eq("livello", livello);

  return NextResponse.json(
    { testo: indizio.testo, ordine: indizio.ordine, totali: totali ?? 0 },
    { headers: { "Cache-Control": "no-store" } }
  );
}
