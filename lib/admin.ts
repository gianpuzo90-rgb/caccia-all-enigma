import type { User } from "@supabase/supabase-js";
import { notFound } from "next/navigation";
import { utenteCorrente } from "./supabase";

/**
 * Chi è amministratore.
 *
 * Due strade, entrambe valide e verificate SOLO sul server:
 *  1. `app_metadata.ruolo === "admin"` sull'utente Supabase. È il modo
 *     pulito: app_metadata lo scrive solo la chiave di servizio, quindi
 *     un utente non se lo può auto-assegnare (a differenza di
 *     user_metadata, che è modificabile dal client).
 *  2. l'email compare in ADMIN_EMAIL (lista separata da virgole). Comoda
 *     per partire senza toccare gli account. Mai NEXT_PUBLIC_: resta
 *     nelle variabili del server.
 */
const emailAmmesse = (process.env.ADMIN_EMAIL ?? "")
  .split(",")
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

export function eAmministratore(utente: User | null): boolean {
  if (!utente) return false;
  if (utente.app_metadata?.ruolo === "admin") return true;
  const email = utente.email?.toLowerCase();
  return !!email && emailAmmesse.includes(email);
}

/**
 * Guardia delle pagine /admin. A chi non è amministratore la sezione
 * non risponde nemmeno che esiste: 404, non "vietato".
 */
export async function richiediAmministratore(): Promise<User> {
  const utente = await utenteCorrente();
  if (!eAmministratore(utente)) notFound();
  return utente!;
}
