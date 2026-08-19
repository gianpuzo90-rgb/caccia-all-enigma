"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { EnigmaDTO, IndizioOk } from "./types";
import { Classifica } from "./Classifica";
import { Door } from "./Door";
import { Portal } from "./Portal";
import { Sottacqua } from "./Sottacqua";
import { usePortale } from "./usePortale";

/* Il livello IV apre su una stanza allagata: bisogna drenare l'acqua
   (tirando la catenella in basso a sinistra) prima che il pomello si
   sblocchi e faccia comparire l'indovinello vero e proprio. È una
   scena su misura solo per questo livello, non un pattern generico. */
const LIVELLO_ALLAGATO = 4;

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
  /** Livello attualmente mostrato, per la barra cliccabile del genitore. */
  onCambioLivello?: (livello: number) => void;
  /** Il genitore chiede di saltare a un livello già raggiunto (click sulla barra). */
  livelloRichiesto?: number | null;
};

type Stato = "carico" | "pronto" | "risolto" | "completato" | "errore";

/* ------------------- Livello IV+ : enigmi lato server ------------------- */

export function EnigmaLevel({
  mioNick,
  onFail,
  onClearError,
  onRestart,
  onCambioLivello,
  livelloRichiesto,
}: EnigmaLevelProps) {
  const [stato, setStato] = useState<Stato>("carico");
  const [enigma, setEnigma] = useState<EnigmaDTO | null>(null);
  const [prossimoLivello, setProssimoLivello] = useState<number | null>(null);
  const [risposta, setRisposta] = useState("");
  const [indizi, setIndizi] = useState<IndizioOk[]>([]);
  const [verificando, setVerificando] = useState(false);
  const [chiedendoIndizio, setChiedendoIndizio] = useState(false);
  const [acquaDrenata, setAcquaDrenata] = useState(false);
  const sottacquaSceneRef = useRef<HTMLDivElement | null>(null);

  const { sceneRef: doorSceneRef, portale, apri: apriPortale } = usePortale();

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
        onCambioLivello?.(data.livello);
        return;
      }
    }
    setStato("errore");
  };

  /* Salto diretto a un livello già raggiunto (click sulla barra): un
     solo fetch, nessuna ricerca. Mostra anche gli enigmi già risolti,
     in sola lettura. */
  const mostraLivello = async (livello: number) => {
    setStato("carico");
    setIndizi([]);
    setRisposta("");
    let res: Response;
    try {
      res = await fetch(`/api/enigma/${livello}`, { cache: "no-store" });
    } catch {
      setStato("errore");
      return;
    }
    if (!res.ok) {
      setStato("errore");
      return;
    }
    const data: EnigmaDTO = await res.json();
    setEnigma(data);
    setStato("pronto");
    onCambioLivello?.(data.livello);
  };

  useEffect(() => {
    // Fetch al mount: il setState effettivo avviene solo dopo l'await
    // dentro caricaLivello (fetch di rete), mai in modo sincrono qui.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    caricaLivello(PRIMO_LIVELLO, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (livelloRichiesto == null) return;
    if (livelloRichiesto === enigma?.livello) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    mostraLivello(livelloRichiesto);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [livelloRichiesto]);

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
        setProssimoLivello(data.prossimo);
        setStato("risolto");
      } else {
        setStato("completato");
      }
    } catch {
      onFail("Il Custode non sa dirti cos'è andato storto. Riprova.");
    } finally {
      setVerificando(false);
    }
  };

  const avanza = () => {
    if (prossimoLivello == null) return;
    apriPortale(() => {
      caricaLivello(prossimoLivello, true);
    });
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

  /* Il portale deve uscire dal .card (che ha un transform: rotate,
     quindi crea un containing block per gli elementi position:fixed)
     per coprire davvero tutto lo schermo, come nei livelli 1-3. */
  const portaleOverlay =
    portale && typeof document !== "undefined"
      ? createPortal(
          <Portal rect={portale} lit={portale.lit} leafOpen={portale.leafOpen} zoom={portale.zoom} />,
          document.body
        )
      : null;

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

  if (stato === "risolto") {
    return (
      <>
        <p className="kicker">
          Livello {enigma!.livello} — {enigma!.titolo}
        </p>
        <p className="riddle">Esatto.</p>
        <Door sceneRef={doorSceneRef} onComplete={avanza} />
        {portaleOverlay}
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

  if (enigma!.livello === LIVELLO_ALLAGATO && !enigma!.risolto && !acquaDrenata) {
    return (
      <>
        <p className="kicker">
          Livello {enigma!.livello} — {enigma!.titolo}
        </p>
        <p className="riddle">L&apos;acqua ti arriva al collo.</p>
        <Sottacqua sceneRef={sottacquaSceneRef} onSbloccato={() => setAcquaDrenata(true)} />
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

      {enigma!.risolto ? (
        <p className="aside">Hai già risolto questo enigma.</p>
      ) : (
        <>
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
      )}
    </>
  );
}
