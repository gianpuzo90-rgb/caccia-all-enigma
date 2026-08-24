import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin, utenteCorrente, livelloRaggiunto } from "@/lib/supabase";
import { enigmaPubblico } from "@/lib/enigma-dto";
import { PRIMO_LIVELLO_SERVER } from "@/lib/enigmi";

export const dynamic = "force-dynamic"; // mai in cache: è per-utente

/**
 * GET /api/enigma/7
 * Restituisce il testo dell'enigma SOLO se l'utente lo ha sbloccato.
 * Le soluzioni non compaiono in nessuna risposta.
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

  const enigma = await enigmaPubblico(supabaseAdmin(), livello, utente.id, massimo);
  if (!enigma) {
    return NextResponse.json({ errore: "enigma non disponibile" }, { status: 404 });
  }

  return NextResponse.json(enigma, { headers: { "Cache-Control": "no-store" } });
}
