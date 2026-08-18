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

export const ROMANS = ["I", "II", "III"];
export const ARCH = "M50 300 L50 132 Q50 70 120 70 Q190 70 190 132 L190 300 Z";

/* ------------------------------ storage ------------------------------ */
/* Solo per il consenso cookie e il progresso visivo dei livelli 1-3:
   preferenze locali, non dati utente. Niente fallback in memoria: se
   localStorage non c'è (SSR), semplicemente non si legge/scrive.     */

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
};
