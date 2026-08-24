import { NextResponse } from "next/server";
import { supabaseAdmin, utenteCorrente, livelloRaggiunto } from "@/lib/supabase";
import { enigmaPubblico } from "@/lib/enigma-dto";
import { PRIMO_LIVELLO_SERVER } from "@/lib/enigmi";

export const dynamic = "force-dynamic"; // mai in cache: è per-utente

/**
 * GET /api/progresso
 * Dove sono, in un colpo solo: il livello in corso (null se non ce ne
 * sono altri), l'ultimo che esiste e — per non costringere il client a
 * una seconda richiesta all'avvio — l'enigma in corso già pronto.
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
  const corrente = massimo + 1 <= ultimo ? massimo + 1 : null;
  const enigma =
    corrente === null ? null : await enigmaPubblico(admin, corrente, utente.id, massimo);

  return NextResponse.json(
    { corrente, ultimo, enigma },
    { headers: { "Cache-Control": "no-store" } }
  );
}
