"use client";

import { useEffect, useState } from "react";
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
   tappo, l'acqua defluisce, il pomello si sblocca. Il V è "Al Buio":
   schermo nero, ma il pomello è al solito posto e funziona — la prova
   è trovarlo a memoria. L'acqua del IV intanto è colata fino al VI,
   dove la pompa la rimanda su, ma tiene solo se il tappo del IV è
   tornato al suo posto — altrimenti rifluisce dallo stesso scarico.
   Rivisitando un livello risolto se ne ritrova la scena: alle stesse
   condizioni (stanza asciutta, buio superabile) si può rigirare il
   pomello e passare al successivo. L'acqua o è al IV o è al VI. */
const LIVELLO_ALLAGATO = 4;
const LIVELLO_BUIO = 5;
const LIVELLO_POMPA = 6;

/* Il primo livello governato dal server: deve combaciare con
   PRIMO_LIVELLO_SERVER in lib/enigmi.ts (non importabile qui: usa
   "crypto" di Node e non va bundlato lato client). */
const PRIMO_LIVELLO = 4;
const LIMITE_RICERCA = 200;

/* Lo stato idraulico condiviso fra IV e VI, persistito in localStorage:
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

  /* Il livello più basso non ancora risolto (o il primo oltre l'ultimo
     enigma esistente): guida la navigazione in avanti e la deduzione
     dello stato idraulico quando i bit locali mancano. */
  const [frontiera, setFrontiera] = useState<number | null>(null);

  /* Finché i bit non sono noti si assume lo stato di partenza. */
  const idr = idraulica ?? { tappoInserito: true, acquaAlQuarto: false };

  const aggiornaIdraulica = (patch: Partial<Idraulica>) => {
    const next = { ...idr, ...patch };
    setIdraulica(next);
    scriviLocale(K.idraulica, next);
  };

  /* Bit assenti (primo avvio o cambio di dispositivo): si deducono dai
     progressi. Oltre il VI l'acqua è per forza tornata su, col tappo
     dentro; fermi al V o al VI l'acqua è di sotto, tappo com'è rimasto. */
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

  const { sceneRef: doorSceneRef, portale, velo, apri: apriPortale } = usePortale();

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
     solo fetch, nessuna ricerca. Mostra anche gli enigmi già risolti. */
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

  /* Da un livello risolto si può riattraversare la porta: al successivo
     se è già noto, o dritti all'enigma in corso / al finale. */
  const avanzaDaRivisita = (livello: number) => {
    const succ = livello + 1;
    if (frontiera !== null && succ < frontiera) mostraLivello(succ);
    else caricaLivello(succ);
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

  /* Al Buio non ha risposta: il completamento è il gesto stesso di
     girare il pomello. Il server accetta i livelli di scena (nessuna
     soluzione seminata) senza risposta; l'avanzamento resta suo. */
  const [tentativoBuio, setTentativoBuio] = useState(0);
  const completaBuio = async () => {
    if (!enigma || verificando) return;
    onClearError();
    setVerificando(true);
    try {
      const res = await fetch("/api/verifica", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ livello: enigma.livello, risposta: "" }),
      });
      const data = await res.json();
      if (!res.ok || !data.corretto) {
        onFail(data.errore || "Qualcosa è andato storto. Riprova.");
        setTentativoBuio((t) => t + 1); // rimonta il pomello: si può rigirare
        return;
      }
      if (data.prossimo) {
        setFrontiera(data.prossimo);
        onLivelloMassimo?.(data.prossimo);
        const prossimo = data.prossimo;
        apriPortale(() => caricaLivello(prossimo, true));
      } else {
        setFrontiera(enigma.livello + 1);
        onLivelloMassimo?.(enigma.livello);
        setStato("completato");
      }
    } catch {
      onFail("Qualcosa è andato storto. Riprova.");
      setTentativoBuio((t) => t + 1);
    } finally {
      setVerificando(false);
    }
  };

  /* Portale e velo devono restare montati qualunque vista sia attiva:
     l'overlay copre lo scambio di contenuto. Escono dal .card (che ha
     un transform e farebbe da containing block ai position:fixed) via
     createPortal, come nei livelli 1-3. */
  const overlay =
    (portale || velo) && typeof document !== "undefined"
      ? createPortal(
          <>
            {portale && (
              <Portal rect={portale} lit={portale.lit} leafOpen={portale.leafOpen} zoom={portale.zoom} />
            )}
            {velo && <div className="velo" aria-hidden="true" />}
          </>,
          document.body
        )
      : null;

  const vista = () => {
    if (stato === "carico") {
      /* Nero pieno, non carta vuota: il caricamento è la stanza ancora
         al buio, in continuità col velo della porta che si chiude. */
      return (
        <div className="caricamento nera" role="status" aria-label="Caricamento">
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
            sceneRef={doorSceneRef}
            giaDrenata={!idr.tappoInserito}
            onTappoRimosso={() => aggiornaIdraulica({ tappoInserito: false, acquaAlQuarto: false })}
            onSbloccato={() => setAcquaDrenata(true)}
          />
        </>
      );
    }

    /* Al Buio, sempre: nessun testo, nessuna porta visibile, il pomello
       dove è sempre stato. La prima volta il completamento passa dal
       server; nelle rivisite girare il pomello riapre la porta e basta. */
    if (enigma!.livello === LIVELLO_BUIO) {
      return (
        <div className="buio">
          <Door
            key={tentativoBuio}
            sceneRef={doorSceneRef}
            variant="buio"
            onComplete={
              enigma!.risolto
                ? () => apriPortale(() => avanzaDaRivisita(LIVELLO_BUIO))
                : completaBuio
            }
          />
        </div>
      );
    }

    if (enigma!.livello === LIVELLO_POMPA && !enigma!.risolto && !acquaDrenataPompa) {
      return (
        <>
          <p className="kicker">
            Livello {romano(enigma!.livello)} — {enigma!.titolo}
          </p>
          <Pompa
            sceneRef={doorSceneRef}
            tappoInserito={idr.tappoInserito}
            giaDrenata={idr.acquaAlQuarto}
            onPompata={() => aggiornaIdraulica({ acquaAlQuarto: true })}
            onSbloccato={() => setAcquaDrenataPompa(true)}
          />
        </>
      );
    }

    /* Il IV rivisitato: la stessa stanza. Il tappo si manovra da qui e
       lo stato resta; a stanza asciutta il pomello riporta al V. */
    if (enigma!.livello === LIVELLO_ALLAGATO && enigma!.risolto) {
      return (
        <>
          <p className="kicker">
            Livello {romano(enigma!.livello)} — {enigma!.titolo}
          </p>
          <StanzaScarico
            sceneRef={doorSceneRef}
            allagata={idr.acquaAlQuarto}
            tappoInserito={idr.tappoInserito}
            onTiraTappo={() => {
              aggiornaIdraulica({ tappoInserito: false, acquaAlQuarto: false });
              // se l'acqua riscende, il VI torna allagato: il suo gate si riarma
              setAcquaDrenataPompa(false);
            }}
            onRimettiTappo={() => aggiornaIdraulica({ tappoInserito: true })}
            onAvanti={() => apriPortale(() => avanzaDaRivisita(LIVELLO_ALLAGATO))}
          />
        </>
      );
    }

    /* Il VI rivisitato: la stanza della pompa, alle sue condizioni.
       Con l'acqua su il pomello è libero e riapre la porta; con
       l'acqua giù bisogna rifare il giro di pompa e tappo. */
    if (enigma!.livello === LIVELLO_POMPA && enigma!.risolto) {
      return (
        <>
          <p className="kicker">
            Livello {romano(enigma!.livello)} — {enigma!.titolo}
          </p>
          <Pompa
            key={`rivisita-${idr.acquaAlQuarto}`}
            sceneRef={doorSceneRef}
            tappoInserito={idr.tappoInserito}
            giaDrenata={idr.acquaAlQuarto}
            onPompata={() => aggiornaIdraulica({ acquaAlQuarto: true })}
            onSbloccato={() => apriPortale(() => avanzaDaRivisita(LIVELLO_POMPA))}
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
          <>
            <p className="aside">Hai già risolto questo enigma: la porta è aperta.</p>
            <Door sceneRef={doorSceneRef} onComplete={() => apriPortale(() => avanzaDaRivisita(enigma!.livello))} />
          </>
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
  };

  return (
    <>
      <div
        key={`${stato}-${enigma?.livello ?? 0}`}
        className={stato === "carico" ? undefined : "apparsa"}
      >
        {vista()}
      </div>
      {portale && <div className="cardBuio" aria-hidden="true" />}
      {overlay}
    </>
  );
}
