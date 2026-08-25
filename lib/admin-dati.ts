import { supabaseAdmin } from "./supabase";
import { PRIMO_LIVELLO_SERVER } from "./enigmi";

/* Le tabelle di gioco sono piccole per natura (un enigma per livello,
   pochi tentativi per giocatore). Si scaricano una volta e si aggrega
   in memoria: più semplice di una vista SQL e abbastanza per la scala
   di questo gioco. Il tetto evita che una tabella impazzita porti giù
   la pagina; i totali in cima restano comunque conteggi esatti. */
const TETTO = 20000;

/** Livello raggiunto quando non c'è nessun progresso: l'onboarding
    (1-3) non è tracciato lato server. */
const LIVELLO_BASE = PRIMO_LIVELLO_SERVER - 1;

export type Utente = {
  id: string;
  nick: string | null;
  email: string | null;
  avvisi_email: boolean;
  admin: boolean;
  creato_il: string | null;
  confermato_il: string | null;
  ultimo_accesso: string | null;
  livelloRaggiunto: number;
  livelliRisolti: number;
  tentativi: number;
  tentativiCorretti: number;
  indiziUsati: number;
  primoTentativo: string | null;
  ultimoTentativo: string | null;
  ultimaSoluzione: string | null;
};

export type Livello = {
  livello: number;
  titolo: string;
  corpo: string;
  media_path: string | null;
  attivo: boolean;
  scena: boolean;
  soluzioni: number;
  indizi: number;
  pubblicato_il: string | null;
  creato_il: string | null;
  risolutori: number;
  tentativi: number;
  tentativiCorretti: number;
  indiziConsegnati: number;
};

export type Tentativo = {
  id: number;
  utente: string;
  nick: string | null;
  livello: number;
  risposta_norm: string;
  corretto: boolean;
  creato_il: string;
};

export type Progresso = {
  utente: string;
  livello: number;
  risolto_il: string | null;
  indizi_usati: number;
};

type Grezzi = {
  profili: { id: string; nick: string | null; avvisi_email: boolean; creato_il: string }[];
  enigmi: {
    livello: number;
    titolo: string;
    corpo: string;
    media_path: string | null;
    attivo: boolean;
    soluzioni_hash: string[] | null;
    pubblicato_il: string | null;
    creato_il: string | null;
  }[];
  indizi: { id: number; livello: number; ordine: number; testo: string }[];
  progressi: Progresso[];
  tentativi: Omit<Tentativo, "nick">[];
  autenticazione: Map<
    string,
    { email: string | null; confermato_il: string | null; ultimo_accesso: string | null; admin: boolean }
  >;
};

/** Una lettura sola di tutto, riusata da ogni pagina del pannello. */
export async function leggiTutto(): Promise<Grezzi> {
  const admin = supabaseAdmin();

  const [profili, enigmi, indizi, progressi, tentativi, utentiAuth] = await Promise.all([
    admin.from("profili").select("id, nick, avvisi_email, creato_il").limit(TETTO),
    admin
      .from("enigmi")
      .select("livello, titolo, corpo, media_path, attivo, soluzioni_hash, pubblicato_il, creato_il")
      .order("livello"),
    admin.from("indizi").select("id, livello, ordine, testo").order("livello").order("ordine"),
    admin.from("progressi").select("utente, livello, risolto_il, indizi_usati").limit(TETTO),
    admin
      .from("tentativi")
      .select("id, utente, livello, risposta_norm, corretto, creato_il")
      .order("creato_il", { ascending: false })
      .limit(TETTO),
    admin.auth.admin.listUsers({ page: 1, perPage: 1000 }),
  ]);

  const autenticazione = new Map<
    string,
    { email: string | null; confermato_il: string | null; ultimo_accesso: string | null; admin: boolean }
  >();
  for (const u of utentiAuth.data?.users ?? []) {
    autenticazione.set(u.id, {
      email: u.email ?? null,
      confermato_il: u.email_confirmed_at ?? null,
      ultimo_accesso: u.last_sign_in_at ?? null,
      admin: (u.app_metadata as { ruolo?: string } | null)?.ruolo === "admin",
    });
  }

  return {
    profili: profili.data ?? [],
    enigmi: enigmi.data ?? [],
    indizi: indizi.data ?? [],
    progressi: progressi.data ?? [],
    tentativi: tentativi.data ?? [],
    autenticazione,
  };
}

/* ------------------------------ utenti ------------------------------ */

export function componiUtenti(g: Grezzi): Utente[] {
  const perUtente = new Map<string, { livelli: Progresso[]; tentativi: Omit<Tentativo, "nick">[] }>();
  for (const p of g.profili) perUtente.set(p.id, { livelli: [], tentativi: [] });
  for (const p of g.progressi) {
    if (!perUtente.has(p.utente)) perUtente.set(p.utente, { livelli: [], tentativi: [] });
    perUtente.get(p.utente)!.livelli.push(p);
  }
  for (const t of g.tentativi) {
    if (!perUtente.has(t.utente)) perUtente.set(t.utente, { livelli: [], tentativi: [] });
    perUtente.get(t.utente)!.tentativi.push(t);
  }

  const utenti: Utente[] = [];
  for (const [id, dati] of perUtente) {
    const profilo = g.profili.find((p) => p.id === id);
    const auth = g.autenticazione.get(id);
    const istanti = dati.tentativi.map((t) => t.creato_il).sort();
    const soluzioni = dati.livelli
      .map((l) => l.risolto_il)
      .filter((x): x is string => !!x)
      .sort();

    utenti.push({
      id,
      nick: profilo?.nick ?? null,
      email: auth?.email ?? null,
      avvisi_email: profilo?.avvisi_email ?? false,
      admin: auth?.admin ?? false,
      creato_il: profilo?.creato_il ?? null,
      confermato_il: auth?.confermato_il ?? null,
      ultimo_accesso: auth?.ultimo_accesso ?? null,
      livelloRaggiunto: dati.livelli.reduce((m, l) => Math.max(m, l.livello), LIVELLO_BASE),
      livelliRisolti: dati.livelli.filter((l) => l.livello >= PRIMO_LIVELLO_SERVER).length,
      tentativi: dati.tentativi.length,
      tentativiCorretti: dati.tentativi.filter((t) => t.corretto).length,
      indiziUsati: dati.livelli.reduce((s, l) => s + (l.indizi_usati ?? 0), 0),
      primoTentativo: istanti[0] ?? null,
      ultimoTentativo: istanti[istanti.length - 1] ?? null,
      ultimaSoluzione: soluzioni[soluzioni.length - 1] ?? null,
    });
  }

  return utenti.sort((a, b) => (b.creato_il ?? "").localeCompare(a.creato_il ?? ""));
}

/* ------------------------------ livelli ------------------------------ */

export function componiLivelli(g: Grezzi): Livello[] {
  return g.enigmi.map((e) => {
    const progressi = g.progressi.filter((p) => p.livello === e.livello);
    const tentativi = g.tentativi.filter((t) => t.livello === e.livello);
    return {
      livello: e.livello,
      titolo: e.titolo,
      corpo: e.corpo,
      media_path: e.media_path,
      attivo: e.attivo,
      scena: (e.soluzioni_hash?.length ?? 0) === 0,
      soluzioni: e.soluzioni_hash?.length ?? 0,
      indizi: g.indizi.filter((i) => i.livello === e.livello).length,
      pubblicato_il: e.pubblicato_il,
      creato_il: e.creato_il,
      risolutori: new Set(progressi.map((p) => p.utente)).size,
      tentativi: tentativi.length,
      tentativiCorretti: tentativi.filter((t) => t.corretto).length,
      indiziConsegnati: progressi.reduce((s, p) => s + (p.indizi_usati ?? 0), 0),
    };
  });
}

/* -------------------------------- KPI -------------------------------- */

export type Kpi = {
  utenti: number;
  utentiConfermati: number;
  nuovi7g: number;
  nuovi30g: number;
  attivi24h: number;
  attivi7g: number;
  inGioco: number;
  arrivatiInFondo: number;
  tentativi: number;
  tentativiCorretti: number;
  indiziConsegnati: number;
  enigmiAttivi: number;
  enigmiDiScena: number;
  ultimoLivello: number;
  perLivello: { livello: number; titolo: string; fermi: number; arrivati: number }[];
  registrazioni: { giorno: string; quanti: number }[];
  attivita: { giorno: string; quanti: number }[];
};

export const giorniFa = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString();

/** Giorno in ora italiana: le statistiche si leggono nel fuso di casa. */
export function giornoRoma(iso: string): string {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Europe/Rome",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(iso));
}

function serieGiornaliera(istanti: string[], giorni: number) {
  const conteggio = new Map<string, number>();
  for (const i of istanti) conteggio.set(giornoRoma(i), (conteggio.get(giornoRoma(i)) ?? 0) + 1);
  const serie: { giorno: string; quanti: number }[] = [];
  for (let d = giorni - 1; d >= 0; d--) {
    const giorno = giornoRoma(new Date(Date.now() - d * 86_400_000).toISOString());
    serie.push({ giorno, quanti: conteggio.get(giorno) ?? 0 });
  }
  return serie;
}

export function componiKpi(g: Grezzi, utenti: Utente[], livelli: Livello[]): Kpi {
  const l7 = giorniFa(7);
  const l30 = giorniFa(30);
  const l1 = giorniFa(1);
  const ultimoLivello = livelli.filter((l) => l.attivo).reduce((m, l) => Math.max(m, l.livello), LIVELLO_BASE);

  // quanti sono fermi a ciascun livello, e quanti ci sono almeno arrivati
  const perLivello = livelli
    .filter((l) => l.attivo)
    .map((l) => ({
      livello: l.livello,
      titolo: l.titolo,
      fermi: utenti.filter((u) => u.livelloRaggiunto + 1 === l.livello).length,
      arrivati: utenti.filter((u) => u.livelloRaggiunto + 1 >= l.livello).length,
    }));

  return {
    utenti: utenti.length,
    utentiConfermati: utenti.filter((u) => u.confermato_il).length,
    nuovi7g: utenti.filter((u) => (u.creato_il ?? "") > l7).length,
    nuovi30g: utenti.filter((u) => (u.creato_il ?? "") > l30).length,
    attivi24h: utenti.filter((u) => (u.ultimoTentativo ?? "") > l1).length,
    attivi7g: utenti.filter((u) => (u.ultimoTentativo ?? "") > l7).length,
    inGioco: utenti.filter((u) => u.livelloRaggiunto >= PRIMO_LIVELLO_SERVER).length,
    arrivatiInFondo: utenti.filter((u) => u.livelloRaggiunto >= ultimoLivello).length,
    tentativi: g.tentativi.length,
    tentativiCorretti: g.tentativi.filter((t) => t.corretto).length,
    indiziConsegnati: g.progressi.reduce((s, p) => s + (p.indizi_usati ?? 0), 0),
    enigmiAttivi: livelli.filter((l) => l.attivo).length,
    enigmiDiScena: livelli.filter((l) => l.attivo && l.scena).length,
    ultimoLivello,
    perLivello,
    registrazioni: serieGiornaliera(
      utenti.map((u) => u.creato_il).filter((x): x is string => !!x),
      30
    ),
    attivita: serieGiornaliera(
      g.tentativi.map((t) => t.creato_il),
      30
    ),
  };
}

/* ------------------------- pezzi per il dettaglio ------------------------- */

export function tentativiConNick(g: Grezzi, filtro?: (t: Omit<Tentativo, "nick">) => boolean): Tentativo[] {
  const nick = new Map(g.profili.map((p) => [p.id, p.nick]));
  return g.tentativi
    .filter((t) => (filtro ? filtro(t) : true))
    .map((t) => ({ ...t, nick: nick.get(t.utente) ?? null }));
}

/** Le risposte sbagliate più gettonate su un livello: dove si incaglia la gente. */
export function sbagliFrequenti(g: Grezzi, livello: number, quanti = 12) {
  const conteggio = new Map<string, number>();
  for (const t of g.tentativi) {
    if (t.livello !== livello || t.corretto) continue;
    const r = t.risposta_norm?.trim();
    if (!r) continue;
    conteggio.set(r, (conteggio.get(r) ?? 0) + 1);
  }
  return [...conteggio.entries()]
    .map(([risposta, quante]) => ({ risposta, quante }))
    .sort((a, b) => b.quante - a.quante)
    .slice(0, quanti);
}

export const indiziDi = (g: Grezzi, livello: number) => g.indizi.filter((i) => i.livello === livello);
export const progressiDi = (g: Grezzi, utente: string) =>
  g.progressi.filter((p) => p.utente === utente).sort((a, b) => a.livello - b.livello);
export const progressiSu = (g: Grezzi, livello: number) =>
  g.progressi.filter((p) => p.livello === livello);
