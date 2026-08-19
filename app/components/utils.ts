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

/* La barra dei livelli è tutta in numeri romani, onboarding ed enigmi. */
export function romano(n: number): string {
  const tavola: Array<[number, string]> = [
    [1000, "M"], [900, "CM"], [500, "D"], [400, "CD"], [100, "C"],
    [90, "XC"], [50, "L"], [40, "XL"], [10, "X"], [9, "IX"], [5, "V"], [4, "IV"], [1, "I"],
  ];
  let resto = n;
  let s = "";
  for (const [v, r] of tavola) while (resto >= v) { s += r; resto -= v; }
  return s;
}
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
};
