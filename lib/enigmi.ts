import { createHash } from "crypto";

/** Livelli 1-3 = onboarding lato client. Il server governa dal 4. */
export const PRIMO_LIVELLO_SERVER = 4;

/**
 * Normalizzazione delle risposte: DEVE essere identica in semina e in
 * verifica, altrimenti gli hash non combaciano mai.
 * "Città!" · "CITTA" · "  citta  " → "citta"
 */
export function normalizza(risposta: string): string {
  return risposta
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")   // via gli accenti
    .replace(/[^a-z0-9 ]/g, " ")        // via punteggiatura e simboli
    .replace(/\s+/g, " ")
    .trim();
}

/** Articoli iniziali ignorati: "il buco" vale "buco". */
const ARTICOLI = ["il ", "lo ", "la ", "i ", "gli ", "le ", "un ", "uno ", "una ", "l "];

export function normalizzaProfondo(risposta: string): string {
  const n = normalizza(risposta);
  for (const a of ARTICOLI) if (n.startsWith(a)) return n.slice(a.length).trim();
  return n;
}

/**
 * Hash della risposta con pepper server-side.
 * Il livello entra nell'hash: la stessa parola su due enigmi diversi
 * produce hash diversi, quindi non si riciclano soluzioni.
 * Se il DB viene esfiltrato senza il pepper, gli hash sono inutili.
 */
export function hashRisposta(livello: number, rispostaNormalizzata: string): string {
  const pepper = process.env.ENIGMI_PEPPER;
  if (!pepper) throw new Error("ENIGMI_PEPPER mancante: rifiuto di calcolare hash");
  return createHash("sha256")
    .update(`${pepper}:${livello}:${rispostaNormalizzata}`)
    .digest("hex");
}

/** Tutte le varianti di hash da confrontare per una risposta utente. */
export function hashCandidati(livello: number, rispostaGrezza: string): string[] {
  const varianti = new Set([
    normalizza(rispostaGrezza),
    normalizzaProfondo(rispostaGrezza),
  ]);
  return [...varianti].filter(Boolean).map((v) => hashRisposta(livello, v));
}
