/* ---------------------------- validazione ---------------------------- */

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i;
export const NICK_RE = /^[a-zA-Z0-9_]{3,20}$/;
export const DEBOLI = ["password", "12345678", "qwertyui", "cacciaallenigma", "iloveyou"];

export const forzaPassword = (p: string): number => {
  let s = 0;
  if (p.length >= 8) s++;
  if (p.length >= 12) s++;
  if (/[a-z]/.test(p) && /[A-Z]/.test(p)) s++;
  if (/\d/.test(p)) s++;
  if (/[^a-zA-Z0-9]/.test(p)) s++;
  return Math.min(s, 4);
};

/* ------------------------------ grafica ------------------------------ */

/* I titoli dei tre livelli di onboarding: gli altri arrivano dal server. */
export const TITOLI_ONBOARDING = ["Ingresso", "I Biscotti", "Il Patto"];

/* Livelli con una scena speciale, condivisi fra EnigmaLevel e la shell. */
export const LIVELLO_ALLAGATO = 4;
export const LIVELLO_BUIO = 5;
export const LIVELLO_POMPA = 6;
/* Lo Specchio riflette la stanza del livello II e non si tocca: si
   supera tornando al II e girando quel pomello al contrario. */
export const LIVELLO_SPECCHIO = 7;
export const LIVELLO_RIFLESSO = 2;

/** La didascalia sotto la carta. Numeri arabi, come nella barra. */
export const didascaliaLivello = (livello: number, titolo: string) =>
  `Livello ${livello} — ${titolo}`;
export const ARCH = "M50 300 L50 132 Q50 70 120 70 Q190 70 190 132 L190 300 Z";

/* ------------------------------ storage ------------------------------ */
/* Solo per il consenso cookie, il progresso visivo dei livelli 1-3 e
   lo stato di scena dei livelli IV-V (tappo e pompa): preferenze
   locali, non dati utente. Niente fallback in memoria: se localStorage
   non c'è (SSR), semplicemente non si legge/scrive.                  */

export function leggiLocale<T>(chiave: string): T | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(chiave);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export function scriviLocale<T>(chiave: string, valore: T): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(chiave, JSON.stringify(valore));
  } catch {
    /* storage pieno o negato: pazienza, è solo una preferenza */
  }
}

export function rimuoviLocale(chiave: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(chiave);
  } catch {}
}

export const K = {
  consenso: "cae:consenso",
  progresso: "cae:progresso",
  idraulica: "cae:idraulica",
  // il livello più basso non ancora risolto, per sapere anche dai
  // livelli 1-3 se lo Specchio è già stato raggiunto. È solo un
  // cancello di scena: il server resta l'unico a decidere davvero.
  frontiera: "cae:frontiera",
};
