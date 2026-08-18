import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin, utenteCorrente, livelloRaggiunto } from "@/lib/supabase";
import { PRIMO_LIVELLO_SERVER } from "@/lib/enigmi";

export const dynamic = "force-dynamic"; // mai in cache: è per-utente

/**
 * GET /api/enigma/7
 * Restituisce il testo dell'enigma SOLO se l'utente lo ha sbloccato.
 * Le soluzioni non compaiono in nessuna risposta: le colonne sono
 * elencate a mano, mai "select *".
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ livello: string }> }
) {
  const { livello: raw } = await params;
  const livello = Number(raw);

  if (!Number.isInteger(livello) || livello < PRIMO_LIVELLO_SERVER) {
    return NextResponse.json({ errore: "livello non valido" }, { status: 400 });
  }

  const utente = await utenteCorrente();
  if (!utente) {
    return NextResponse.json({ errore: "serve la registrazione" }, { status: 401 });
  }

  const massimo = await livelloRaggiunto(utente.id);
  const sbloccato = massimo + 1;

  // il cuore dell'antitrucco: niente contenuto per i livelli futuri
  if (livello > sbloccato) {
    return NextResponse.json({ errore: "enigma non ancora sbloccato" }, { status: 403 });
  }

  const admin = supabaseAdmin();
  const { data: enigma } = await admin
    .from("enigmi")
    .select("livello, titolo, corpo, media_path, attivo")
    .eq("livello", livello)
    .maybeSingle();

  if (!enigma || !enigma.attivo) {
    return NextResponse.json({ errore: "enigma non disponibile" }, { status: 404 });
  }

  // quanti indizi esistono e quanti ne ha già chiesti: i TESTI no
  const [{ count: indiziTotali }, { data: mioProgresso }] = await Promise.all([
    admin.from("indizi").select("*", { count: "exact", head: true }).eq("livello", livello),
    admin
      .from("progressi")
      .select("indizi_usati")
      .eq("utente", utente.id)
      .eq("livello", livello)
      .maybeSingle(),
  ]);

  // eventuale immagine: URL firmata a scadenza breve da bucket privato
  let media: string | null = null;
  if (enigma.media_path) {
    const { data: firmata } = await admin.storage
      .from("enigmi")
      .createSignedUrl(enigma.media_path, 300); // 5 minuti
    media = firmata?.signedUrl ?? null;
  }

  return NextResponse.json(
    {
      livello: enigma.livello,
      titolo: enigma.titolo,
      corpo: enigma.corpo,
      media,
      indizi_totali: indiziTotali ?? 0,
      indizi_usati: mioProgresso?.indizi_usati ?? 0,
      risolto: livello <= massimo,
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
