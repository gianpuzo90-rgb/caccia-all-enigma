"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { EnigmaDTO, IndizioOk } from "./types";
import { Classifica } from "./Classifica";
import { Door } from "./Door";
import { Portal } from "./Portal";
import { Sottacqua } from "./Sottacqua";
import { Pompa } from "./Pompa";
import { StanzaScarico } from "./StanzaScarico";
import { usePortale } from "./usePortale";
import { K, leggiLocale, romano, scriviLocale } from "./utils";

/* Il livello IV apre su una stanza allagata: si tira la catenella del
   tappo, l'acqua defluisce, il pomello si sblocca. Quell'acqua però
   non svanisce: scende al livello V, che si apre con lo stesso pomello
   e la stessa regola. La pompa del V la rimanda su, ma tiene solo se
   il tappo del IV è tornato al suo posto — altrimenti rifluisce dallo
   stesso scarico. Rivisitando il IV si ritrova la stanza stessa, di
   norma asciutta, col tappo manovrabile; se la pompa ha lavorato,
   di nuovo allagata. L'acqua o è al IV o è al V, mai altrove. */
const LIVELLO_ALLAGATO = 4;
const LIVELLO_POMPA = 5;

/* Il primo livello governato dal server: deve combaciare con
   PRIMO_LIVELLO_SERVER in lib/enigmi.ts (non importabile qui: usa
   "crypto" di Node e non va bundlato lato client). */
const PRIMO_LIVELLO = 4;
const LIMITE_RICERCA = 200;

/* Lo stato idraulico condiviso fra IV e V, persistito in localStorage:
   due bit veri (dov'è il tappo, dov'è l'acqua). Quando mancano — primo
   avvio o altro dispositivo — si deducono dai progressi server. */
type Idraulica = { tappoInserito: boolean; acquaAlQuarto: boolean };

const leggiIdraulica = (): Idraulica | null => {
  const v = leggiLocale<Partial<Idraulica> & { pompaAzionata?: boolean }>(K.idraulica);
  if (!v) return null;
  // pompaAzionata è il nome della prima versione dello stesso bit.
  return {
    tappoInserito: v.tappoInserito ?? true,
    acquaAlQuarto: v.acquaAlQuarto ?? v.pompaAzionata ?? false,
  };
};

type EnigmaLevelProps = {
  mioNick?: string;
  onFail: (msg: string) => void;
  onClearError: () => void;
  onRestart: () => void;
  /** Livello attualmente mostrato, per la barra cliccabile del genitore. */
  onCambioLivello?: (livello: number) => void;
  /** Il livello più alto che la barra deve offrire, quando non coincide
      con quello mostrato: l'ultimo esistente a caccia completata, o il
      livello appena sbloccato da una soluzione. */
  onLivelloMassimo?: (livello: number) => void;
  /** Il genitore chiede di saltare a un livello già raggiunto (click
      sulla barra). La chiave cresce a ogni click, così anche una
      richiesta per lo stesso livello di prima viene riascoltata. */
  richiesta?: { livello: number; chiave: number } | null;
};

type Stato = "carico" | "pronto" | "risolto" | "completato" | "errore";

/* ------------------- Livello IV+ : enigmi lato server ------------------- */

export function EnigmaLevel({
  mioNick,
  onFail,
  onClearError,
  onRestart,
  onCambioLivello,
  onLivelloMassimo,
  richiesta,
}: EnigmaLevelProps) {
  const [stato, setStato] = useState<Stato>("carico");
  const [enigma, setEnigma] = useState<EnigmaDTO | null>(null);
  const [prossimoLivello, setProssimoLivello] = useState<number | null>(null);
  const [risposta, setRisposta] = useState("");
  const [indizi, setIndizi] = useState<IndizioOk[]>([]);
  const [verificando, setVerificando] = useState(false);
  const [chiedendoIndizio, setChiedendoIndizio] = useState(false);

  /* Scene d'acqua: i due gate superati in questa sessione (transienti,
     il pomello si rigira dopo un ricaricamento) e i bit persistenti. */
  const [acquaDrenata, setAcquaDrenata] = useState(false);
  const [acquaDrenataPompa, setAcquaDrenataPompa] = useState(false);
  const [idraulica, setIdraulica] = useState<Idraulica | null>(() => leggiIdraulica());
  const sottacquaSceneRef = useRef<HTMLDivElement | null>(null);
  const pompaSceneRef = useRef<HTMLDivElement | null>(null);

  /* Il livello più basso non ancora risolto (o il primo oltre l'ultimo
     enigma esistente): serve al "torna all'enigma in corso" e a dedurre
     lo stato idraulico quando i bit locali mancano. */
  const [frontiera, setFrontiera] = useState<number | null>(null);

  /* Finché i bit non sono noti si assume lo stato di partenza. */
  const idr = idraulica ?? { tappoInserito: true, acquaAlQuarto: false };

  const aggiornaIdraulica = (patch: Partial<Idraulica>) => {
    const next = { ...idr, ...patch };
    setIdraulica(next);
    scriviLocale(K.idraulica, next);
  };

  /* Bit assenti (primo avvio o cambio di dispositivo): si deducono dai
     progressi. Oltre il V l'acqua è per forza tornata su, col tappo
     dentro; fermi al V l'acqua è di sotto, tappo fuori com'è rimasto. */
  useEffect(() => {
    if (idraulica !== null || frontiera === null) return;
    const dedotta: Idraulica =
      frontiera > LIVELLO_POMPA
        ? { tappoInserito: true, acquaAlQuarto: true }
        : frontiera > LIVELLO_ALLAGATO
          ? { tappoInserito: false, acquaAlQuarto: false }
          : { tappoInserito: true, acquaAlQuarto: false };
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIdraulica(dedotta);
    scriviLocale(K.idraulica, dedotta);
  }, [frontiera, idraulica]);

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
    let ultimoEsistente: number | null = null;
    for (let l = livello; l < livello + LIMITE_RICERCA; l++) {
      let res: Response;
      try {
        res = await fetch(`/api/enigma/${l}`, { cache: "no-store" });
      } catch {
        setStato("errore");
        return;
      }
      if (res.status === 404) {
        setFrontiera(l);
        if (ultimoEsistente !== null) onLivelloMassimo?.(ultimoEsistente);
        setStato("completato");
        return;
      }
      if (!res.ok) {
        setStato("errore");
        return;
      }
      const data: EnigmaDTO = await res.json();
      ultimoEsistente = data.livello;
      if (!data.risolto) {
        setEnigma(data);
        setFrontiera(data.livello);
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
    if (richiesta == null) return;
    if (richiesta.livello === enigma?.livello) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    mostraLivello(richiesta.livello);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [richiesta?.chiave]);

  const invia = async () => {
    if (!enigma || verificando) return;
    onClearError();
    if (!risposta.trim()) return onFail("Scrivi una risposta.");

    setVerificando(true);
    try {
      const res = await fetch("/api/verifica", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ livello: enigma.livello, risposta }),
      });
      const data = await res.json();
      if (!res.ok) {
        onFail(data.errore || "Qualcosa è andato storto. Riprova.");
        return;
      }
      if (!data.corretto) {
        onFail("Non è quella. Riprova.");
        return;
      }
      if (data.prossimo) {
        setProssimoLivello(data.prossimo);
        setFrontiera(data.prossimo);
        // il prossimo livello è già sbloccato lato server: la barra deve
        // offrirlo subito, anche se si naviga via prima di varcare la porta
        onLivelloMassimo?.(data.prossimo);
        setStato("risolto");
      } else {
        setFrontiera(enigma.livello + 1);
        onLivelloMassimo?.(enigma.livello);
        setStato("completato");
      }
    } catch {
      onFail("Qualcosa è andato storto. Riprova.");
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
            ? "Non ci sono altri indizi."
            : data.errore || "Qualcosa è andato storto. Riprova."
        );
        return;
      }
      setIndizi((prev) => (prev.some((i) => i.ordine === data.ordine) ? prev : [...prev, data]));
    } catch {
      onFail("Qualcosa è andato storto. Riprova.");
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
      <div className="caricamento" role="status" aria-label="Caricamento">
        <div className="rotella" />
      </div>
    );
  }

  if (stato === "errore") {
    return (
      <>
        <p className="riddle">Errore di caricamento. Riprova tra poco.</p>
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
          Livello {romano(enigma!.livello)} — {enigma!.titolo}
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
          Livello {romano(enigma!.livello)} — {enigma!.titolo}
        </p>
        <Sottacqua
          sceneRef={sottacquaSceneRef}
          giaDrenata={!idr.tappoInserito}
          onTappoRimosso={() => aggiornaIdraulica({ tappoInserito: false, acquaAlQuarto: false })}
          onSbloccato={() => setAcquaDrenata(true)}
        />
      </>
    );
  }

  if (enigma!.livello === LIVELLO_POMPA && !enigma!.risolto && !acquaDrenataPompa) {
    return (
      <>
        <p className="kicker">
          Livello {romano(enigma!.livello)} — {enigma!.titolo}
        </p>
        <Pompa
          sceneRef={pompaSceneRef}
          tappoInserito={idr.tappoInserito}
          giaDrenata={idr.acquaAlQuarto}
          onPompata={() => aggiornaIdraulica({ acquaAlQuarto: true })}
          onSbloccato={() => setAcquaDrenataPompa(true)}
        />
      </>
    );
  }

  /* Il IV rivisitato: la stessa stanza, senza testi. Il tappo si
     manovra da qui e lo stato resta salvato per il V. */
  if (enigma!.livello === LIVELLO_ALLAGATO && enigma!.risolto) {
    return (
      <>
        <p className="kicker">
          Livello {romano(enigma!.livello)} — {enigma!.titolo}
        </p>
        <StanzaScarico
          sceneRef={sottacquaSceneRef}
          allagata={idr.acquaAlQuarto}
          tappoInserito={idr.tappoInserito}
          onTiraTappo={() => {
            aggiornaIdraulica({ tappoInserito: false, acquaAlQuarto: false });
            // se l'acqua riscende, il V torna allagato: il suo gate si riarma
            setAcquaDrenataPompa(false);
          }}
          onRimettiTappo={() => aggiornaIdraulica({ tappoInserito: true })}
        />
      </>
    );
  }

  const puoIndizio = enigma!.indizi_usati < enigma!.indizi_totali;

  return (
    <>
      <p className="kicker">
        Livello {romano(enigma!.livello)} — {enigma!.titolo}
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
