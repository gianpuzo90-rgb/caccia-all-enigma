import { NextResponse } from "next/server";
import { supabaseAdmin, utenteCorrente, livelloRaggiunto } from "@/lib/supabase";
import { PRIMO_LIVELLO_SERVER } from "@/lib/enigmi";

export const dynamic = "force-dynamic"; // mai in cache: è per-utente

/**
 * GET /api/progresso
 * Dove sono: il primo livello non ancora risolto (null se non ce ne
 * sono altri) e l'ultimo che esiste. Serve al client per andare dritto
 * al punto invece di risalire la scala un livello alla volta.
 * Non contiene testi di enigmi: solo numeri.
 */
export async function GET() {
  const utente = await utenteCorrente();
  if (!utente) {
    return NextResponse.json({ errore: "serve la registrazione" }, { status: 401 });
  }

  const admin = supabaseAdmin();
  const [massimo, ultimoAttivo] = await Promise.all([
    livelloRaggiunto(utente.id),
    admin
      .from("enigmi")
      .select("livello")
      .eq("attivo", true)
      .order("livello", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const ultimo = ultimoAttivo.data?.livello ?? PRIMO_LIVELLO_SERVER - 1;
  const corrente = massimo + 1;

  return NextResponse.json(
    { corrente: corrente <= ultimo ? corrente : null, ultimo },
    { headers: { "Cache-Control": "no-store" } }
  );
}
