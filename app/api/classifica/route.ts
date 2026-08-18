import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export const revalidate = 30; // la classifica può stare 30s in cache

/** GET /api/classifica — nick, livello e tempo. Nient'altro esce. */
export async function GET() {
  const admin = supabaseAdmin();
  const { data, error } = await admin.rpc("classifica", { p_limite: 100 });

  if (error) {
    return NextResponse.json({ errore: "classifica non disponibile" }, { status: 500 });
  }
  return NextResponse.json({ righe: data ?? [] });
}
