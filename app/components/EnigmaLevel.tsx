"use client";

import { useEffect, useState } from "react";
import type { EnigmaDTO, IndizioOk } from "./types";
import { Classifica } from "./Classifica";

/* Il primo livello governato dal server: deve combaciare con
   PRIMO_LIVELLO_SERVER in lib/enigmi.ts (non importabile qui: usa
   "crypto" di Node e non va bundlato lato client). */
const PRIMO_LIVELLO = 4;
const LIMITE_RICERCA = 200;

type EnigmaLevelProps = {
  mioNick?: string;
  onFail: (msg: string) => void;
  onClearError: () => void;
  onRestart: () => void;
};

type Stato = "carico" | "pronto" | "completato" | "errore";

/* ------------------- Livello IV+ : enigmi lato server ------------------- */

export function EnigmaLevel({ mioNick, onFail, onClearError, onRestart }: EnigmaLevelProps) {
  const [stato, setStato] = useState<Stato>("carico");
  const [enigma, setEnigma] = useState<EnigmaDTO | null>(null);
  const [risposta, setRisposta] = useState("");
  const [indizi, setIndizi] = useState<IndizioOk[]>([]);
  const [verificando, setVerificando] = useState(false);
  const [chiedendoIndizio, setChiedendoIndizio] = useState(false);

  /* Il server sa qual è il livello sbloccato: si parte dal primo e si
     avanza finché non se ne trova uno non ancora risolto, o si scopre
     che non ce ne sono altri.
     resetView=false al primo mount: lo stato iniziale dei tre useState
     qui sopra è già quello di "sto caricando", non serve riscriverlo
     (ed evita un setState sincrono dentro l'effetto di mount). */
  const caricaLivello = async (livello: number, resetView = true) => {
    if (resetView) {
      setStato("carico");
      setIndizi([]);
      setRisposta("");
    }
    for (let l = livello; l < livello + LIMITE_RICERCA; l++) {
      let res: Response;
      try {
        res = await fetch(`/api/enigma/${l}`, { cache: "no-store" });
      } catch {
        setStato("errore");
        return;
      }
      if (res.status === 404) {
        setStato("completato");
        return;
      }
      if (!res.ok) {
        setStato("errore");
        return;
      }
      const data: EnigmaDTO = await res.json();
      if (!data.risolto) {
        setEnigma(data);
        setStato("pronto");
        return;
      }
    }
    setStato("errore");
  };

  useEffect(() => {
    // Fetch al mount: il setState effettivo avviene solo dopo l'await
    // dentro caricaLivello (fetch di rete), mai in modo sincrono qui.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    caricaLivello(PRIMO_LIVELLO, false);
  }, []);

  const invia = async () => {
    if (!enigma || verificando) return;
    onClearError();
    if (!risposta.trim()) return onFail("Il Custode aspetta una risposta.");

    setVerificando(true);
    try {
      const res = await fetch("/api/verifica", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ livello: enigma.livello, risposta }),
      });
      const data = await res.json();
      if (!res.ok) {
        onFail(data.errore || "Il Custode non sa dirti cos'è andato storto. Riprova.");
        return;
      }
      if (!data.corretto) {
        onFail("Non è quella. Riprova.");
        return;
      }
      if (data.prossimo) {
        await caricaLivello(data.prossimo);
      } else {
        setStato("completato");
      }
    } catch {
      onFail("Il Custode non sa dirti cos'è andato storto. Riprova.");
    } finally {
      setVerificando(false);
    }
  };

  const chiediIndizio = async () => {
    if (!enigma || chiedendoIndizio) return;
    onClearError();
    setChiedendoIndizio(true);
    try {
      const res = await fetch("/api/indizio", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ livello: enigma.livello }),
      });
      const data = await res.json();
      if (!res.ok) {
        onFail(
          data.errore === "nessun altro indizio"
            ? "Il Custode non ha altro da suggerire."
            : data.errore || "Il Custode non sa dirti cos'è andato storto."
        );
        return;
      }
      setIndizi((prev) => (prev.some((i) => i.ordine === data.ordine) ? prev : [...prev, data]));
    } catch {
      onFail("Il Custode non sa dirti cos'è andato storto. Riprova.");
    } finally {
      setChiedendoIndizio(false);
    }
  };

  const onEnter = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") invia();
  };

  if (stato === "carico") {
    return (
      <>
        <p className="kicker">Livello IV — L&apos;Enigma</p>
        <p className="riddle">Il Custode sta preparando la prova…</p>
      </>
    );
  }

  if (stato === "errore") {
    return (
      <>
        <p className="kicker">Livello IV — L&apos;Enigma</p>
        <p className="riddle">L&apos;enigma tace, per ora. Riprova tra poco.</p>
        <button className="btn" onClick={() => caricaLivello(PRIMO_LIVELLO)}>
          Riprova
        </button>
      </>
    );
  }

  if (stato === "completato") {
    return (
      <>
        <p className="kicker">Il Patto è sigillato</p>
        <p className="riddle">
          Benvenuto tra i Cercatori, <strong>{mioNick || "Tu"}</strong>. Hai risolto tutti gli
          enigmi disponibili: la Caccia, da qui, è appena cominciata.
        </p>
        <Classifica mioNick={mioNick} />
        <p className="aside">I prossimi enigmi sono in scrittura.</p>
        <button className="btn" onClick={onRestart}>
          Ricomincia la caccia
        </button>
      </>
    );
  }

  const puoIndizio = enigma!.indizi_usati < enigma!.indizi_totali;

  return (
    <>
      <p className="kicker">
        Livello {enigma!.livello} — {enigma!.titolo}
      </p>
      <p className="riddle" style={{ whiteSpace: "pre-line" }}>
        {enigma!.corpo}
      </p>
      {enigma!.media && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={enigma!.media} alt="" style={{ width: "100%", borderRadius: 4, marginBottom: 16 }} />
      )}

      {indizi.length > 0 && (
        <div className="fineprint">
          {[...indizi]
            .sort((a, b) => a.ordine - b.ordine)
            .map((i) => (
              <p key={i.ordine}>
                <strong>Indizio {i.ordine}.</strong> {i.testo}
              </p>
            ))}
        </div>
      )}

      <input
        className="field"
        placeholder="La tua risposta"
        value={risposta}
        onChange={(e) => setRisposta(e.target.value)}
        onKeyDown={onEnter}
      />

      <button className="btn" onClick={invia} disabled={verificando}>
        {verificando ? "Un istante…" : "Consegna la risposta"}
      </button>
      <button className="btnGhost" onClick={chiediIndizio} disabled={chiedendoIndizio || !puoIndizio}>
        {chiedendoIndizio ? "Un istante…" : puoIndizio ? "Chiedi un indizio" : "Nessun altro indizio"}
      </button>
    </>
  );
}
