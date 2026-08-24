import type { SupabaseClient } from "@supabase/supabase-js";

/** Quello che il client riceve di un enigma. Mai le soluzioni. */
export type EnigmaPubblico = {
  livello: number;
  titolo: string;
  corpo: string;
  media: string | null;
  indizi_totali: number;
  indizi_usati: number;
  risolto: boolean;
  scena: boolean;
};

/**
 * Costruisce la versione pubblica di un enigma. Le colonne si elencano
 * a mano — mai "select *" — e `soluzioni_hash` serve solo a dedurre se
 * il livello è di scena: non esce mai da qui.
 *
 * Restituisce null se l'enigma non esiste o non è attivo.
 */
export async function enigmaPubblico(
  admin: SupabaseClient,
  livello: number,
  utenteId: string,
  massimoRisolto: number
): Promise<EnigmaPubblico | null> {
  const { data: enigma } = await admin
    .from("enigmi")
    .select("livello, titolo, corpo, media_path, attivo, soluzioni_hash")
    .eq("livello", livello)
    .maybeSingle();

  if (!enigma || !enigma.attivo) return null;

  // quanti indizi esistono e quanti ne ha già chiesti: i TESTI no
  const [{ count: indiziTotali }, { data: mioProgresso }] = await Promise.all([
    admin.from("indizi").select("*", { count: "exact", head: true }).eq("livello", livello),
    admin
      .from("progressi")
      .select("indizi_usati")
      .eq("utente", utenteId)
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

  return {
    livello: enigma.livello,
    titolo: enigma.titolo,
    corpo: enigma.corpo,
    media,
    indizi_totali: indiziTotali ?? 0,
    indizi_usati: mioProgresso?.indizi_usati ?? 0,
    risolto: livello <= massimoRisolto,
    // livello di scena: si supera con un gesto, non con una risposta
    scena: (enigma.soluzioni_hash?.length ?? 0) === 0,
  };
}
