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
import {
  K,
  LIVELLO_ALLAGATO,
  LIVELLO_BUIO,
  LIVELLO_POMPA,
  leggiLocale,
  romano,
  scriviLocale,
} from "./utils";

/* Il livello IV apre su una stanza allagata: si tira la catenella del
   tappo, l'acqua defluisce, il pomello si sblocca. Il V è "Al Buio":
   schermo nero, ma il pomello è al solito posto e funziona — la prova
   è trovarlo a memoria. L'acqua del IV intanto è colata fino al VI,
   dove la pompa la rimanda su, ma tiene solo se il tappo del IV è
   tornato al suo posto — altrimenti rifluisce dallo stesso scarico.
   Rivisitando un livello risolto se ne ritrova la scena: alle stesse
   condizioni (stanza asciutta, buio superabile) si può rigirare il
   pomello e passare al successivo. L'acqua o è al IV o è al VI.
   Le costanti dei livelli-scena vivono in utils.ts. */

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
  /** C'è un fetch in corso: la shell tiene giù il sipario nero e
      mostra la rotellina finché non è tutto pronto. */
  onCaricamento?: (caricando: boolean) => void;
  /** Il livello più basso non ancora risolto: la barra colora "fatti"
      i livelli sotto la frontiera. */
  onFrontiera?: (livello: number) => void;
  /** Cala il sipario nero della shell (chiamato dalla coreografia del
      portale verso la fine dello zoom). */
  chiudiSipario?: () => void;
  /** Il server risponde 401: niente sessione. La shell riporta alla
      porta del Patto invece di lasciare un errore a schermo. */
  onServeAccesso?: () => void;
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
  onCaricamento,
  onFrontiera,
  chiudiSipario,
  onServeAccesso,
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
     enigma esistente): guida la navigazione in avanti, la deduzione
     dello stato idraulico quando i bit locali mancano, e i "fatti"
     della barra del genitore. */
  const [frontiera, setFrontiera] = useState<number | null>(null);
  const segnaFrontiera = (l: number) => {
    setFrontiera(l);
    onFrontiera?.(l);
  };

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
      if (res.status === 401) {
        onServeAccesso?.();
        return;
      }
      if (res.status === 404) {
        segnaFrontiera(l);
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
        segnaFrontiera(data.livello);
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
    if (res.status === 401) {
      onServeAccesso?.();
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
    // Se c'è già una richiesta esplicita (click sulla barra arrivato
    // mentre eravamo smontati, es. dai livelli 1-3 rivisitati), si va
    // dritti lì invece di cercare l'enigma in corso: niente due fetch
    // in corsa l'uno contro l'altro.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (richiesta != null) mostraLivello(richiesta.livello);
    else caricaLivello(PRIMO_LIVELLO, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (richiesta == null) return;
    if (richiesta.livello === enigma?.livello) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    mostraLivello(richiesta.livello);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [richiesta?.chiave]);

  /* La shell tiene giù il sipario finché c'è da caricare. Il cleanup
     evita di lasciarlo bloccato se si smonta a metà (ritorno all'onboarding). */
  const caricando = stato === "carico";
  useEffect(() => {
    onCaricamento?.(caricando);
    return () => onCaricamento?.(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [caricando]);

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
      if (res.status === 401) {
        onServeAccesso?.();
        return;
      }
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
        segnaFrontiera(data.prossimo);
        // il prossimo livello è già sbloccato lato server: la barra deve
        // offrirlo subito, anche se si naviga via prima di varcare la porta
        onLivelloMassimo?.(data.prossimo);
        setStato("risolto");
      } else {
        segnaFrontiera(enigma.livello + 1);
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
    apriPortale(
      () => {
        caricaLivello(prossimoLivello, true);
      },
      true,
      chiudiSipario
    );
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

  /* I livelli di scena non hanno risposta: il completamento è il gesto
     stesso (girare il pomello, azionare la pompa). Il server li accetta
     senza risposta perché non hanno soluzioni seminate; l'avanzamento
     resta comunque scritto da lui. */
  const [tentativoScena, setTentativoScena] = useState(0);
  const completaScena = async () => {
    if (!enigma || verificando) return;
    onClearError();
    setVerificando(true);
    try {
      const res = await fetch("/api/verifica", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ livello: enigma.livello, risposta: "" }),
      });
      if (res.status === 401) {
        onServeAccesso?.();
        return;
      }
      const data = await res.json();
      if (!res.ok || !data.corretto) {
        onFail(data.errore || "Qualcosa è andato storto. Riprova.");
        setTentativoScena((t) => t + 1); // rimonta il pomello: si può rigirare
        return;
      }
      if (data.prossimo) {
        segnaFrontiera(data.prossimo);
        onLivelloMassimo?.(data.prossimo);
        const prossimo = data.prossimo;
        apriPortale(() => caricaLivello(prossimo, true), true, chiudiSipario);
      } else {
        segnaFrontiera(enigma.livello + 1);
        onLivelloMassimo?.(enigma.livello);
        setStato("completato");
      }
    } catch {
      onFail("Qualcosa è andato storto. Riprova.");
      setTentativoScena((t) => t + 1);
    } finally {
      setVerificando(false);
    }
  };

  /* Il portale deve restare montato qualunque vista sia attiva:
     l'overlay copre lo scambio di contenuto. Esce dal .card (che ha
     un transform e farebbe da containing block ai position:fixed) via
     createPortal, come nei livelli 1-3. */
  const overlay =
    portale && typeof document !== "undefined"
      ? createPortal(
          <Portal rect={portale} lit={portale.lit} leafOpen={portale.leafOpen} zoom={portale.zoom} />,
          document.body
        )
      : null;

  const vista = () => {
    if (stato === "carico") {
      /* Nero pieno, non carta vuota: il caricamento è la stanza ancora
         al buio, in continuità col sipario della shell. */
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
            key={tentativoScena}
            sceneRef={doorSceneRef}
            variant="buio"
            onComplete={
              enigma!.risolto
                ? () => apriPortale(() => avanzaDaRivisita(LIVELLO_BUIO), true, chiudiSipario)
                : completaScena
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
            key={tentativoScena}
            sceneRef={doorSceneRef}
            tappoInserito={idr.tappoInserito}
            giaDrenata={idr.acquaAlQuarto}
            onPompata={() => aggiornaIdraulica({ acquaAlQuarto: true })}
            // se il livello non ha una risposta da dare, il pomello lo
            // completa; altrimenti scopre l'enigma di testo sotto
            onSbloccato={enigma!.scena ? completaScena : () => setAcquaDrenataPompa(true)}
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
            onAvanti={() => apriPortale(() => avanzaDaRivisita(LIVELLO_ALLAGATO), true, chiudiSipario)}
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
            onSbloccato={() => apriPortale(() => avanzaDaRivisita(LIVELLO_POMPA), true, chiudiSipario)}
          />
        </>
      );
    }

    /* Livello di scena senza una stanza su misura: una porta e basta.
       È la forma di un livello ancora da scrivere — si attraversa, non
       si risolve — e diventa un enigma vero appena gli si seminano le
       soluzioni, senza toccare il codice. */
    if (enigma!.scena) {
      return (
        <>
          <p className="kicker">
            Livello {romano(enigma!.livello)} — {enigma!.titolo}
          </p>
          {enigma!.corpo && (
            <p className="riddle" style={{ whiteSpace: "pre-line" }}>
              {enigma!.corpo}
            </p>
          )}
          <Door
            key={tentativoScena}
            sceneRef={doorSceneRef}
            onComplete={
              enigma!.risolto
                ? () => apriPortale(() => avanzaDaRivisita(enigma!.livello), true, chiudiSipario)
                : completaScena
            }
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
            <Door
              sceneRef={doorSceneRef}
              onComplete={() => apriPortale(() => avanzaDaRivisita(enigma!.livello), true, chiudiSipario)}
            />
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
      {vista()}
      {portale && <div className="cardBuio" aria-hidden="true" />}
      {overlay}
    </>
  );
}
