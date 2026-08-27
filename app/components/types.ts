export type Consenso = {
  necessari: true;
  statistiche: boolean;
  ts: number;
  versione: 1;
};

export type Sessione = {
  nick: string;
  email: string;
  marketing: boolean;
};

export type View = "game" | "auth" | "account" | "privacy" | "cookie";

export type PortalRect = {
  x: number;
  y: number;
  w: number;
  h: number;
  lit: boolean;
  leafOpen: boolean;
  zoom: boolean;
  /** Gradi di cui l'anta è girata quando si spalanca. Zero ovunque
      tranne che al Perno, dove la porta si apre storta. */
  inclinazione: number;
};

export type EnigmaDTO = {
  livello: number;
  titolo: string;
  corpo: string;
  media: string | null;
  indizi_totali: number;
  indizi_usati: number;
  risolto: boolean;
  /** Livello di scena: nessuna soluzione da indovinare, si supera con
      il gesto della stanza (pomello, catenella, pompa). */
  scena: boolean;
};

export type VerificaOk = { corretto: boolean; prossimo?: number | null };
export type IndizioOk = { testo: string; ordine: number; totali: number };
export type RigaClassifica = {
  nick: string;
  livello: number;
  tempo?: string;
  [k: string]: unknown;
};
