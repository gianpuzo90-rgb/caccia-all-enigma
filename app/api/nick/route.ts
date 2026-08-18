import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

const FORMATO = /^[A-Za-z0-9_]{3,20}$/;

/**
 * GET /api/nick?n=Lupin_04
 * Controllo di disponibilità prima della registrazione. Risponde solo
 * libero true/false: nessuna lista di nick, nessuna enumerazione.
 */
export async function GET(req: NextRequest) {
  const nick = (req.nextUrl.searchParams.get("n") ?? "").trim();
  if (!FORMATO.test(nick)) {
    return NextResponse.json({ libero: false, motivo: "formato" }, { status: 200 });
  }
  const admin = supabaseAdmin();
  const { data, error } = await admin.rpc("nick_libero", { p_nick: nick });
  if (error) return NextResponse.json({ errore: "controllo fallito" }, { status: 500 });
  return NextResponse.json({ libero: !!data });
}
