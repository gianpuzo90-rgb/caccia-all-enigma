"use client";

import { useEffect, useRef, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { supabaseBrowser } from "@/lib/supabase-browser";
import { Door } from "./components/Door";
import { Portal } from "./components/Portal";
import { CookieBanner } from "./components/CookieBanner";
import { Auth } from "./components/Auth";
import { Account } from "./components/Account";
import { PrivacyPage } from "./components/PrivacyPage";
import { CookiePreferencesPage } from "./components/CookiePreferencesPage";
import { EnigmaLevel } from "./components/EnigmaLevel";
import { UserGlyph } from "./components/icons";
import { usePortale } from "./components/usePortale";
import { K, ROMANS, leggiLocale, rimuoviLocale, romano, scriviLocale } from "./components/utils";
import type { Consenso, Sessione, View } from "./components/types";

/* ==================================================================
   CACCIA ALL'ENIGMA
   Livelli I-III: onboarding client-side (porta, biscotti, patto).
   Livello IV+: enigmi reali, governati dal server via /api/enigma,
   /api/verifica, /api/indizio. Classifica da /api/classifica.
   ================================================================== */

/* Deve combaciare con PRIMO_LIVELLO in EnigmaLevel.tsx e con
   PRIMO_LIVELLO_SERVER in lib/enigmi.ts (non importabile qui, vedi
   nota in EnigmaLevel.tsx). Serve solo per numerare la barra. */
const PRIMO_LIVELLO_ENIGMA = 4;

function sessioneDaUtente(u: User): Sessione {
  return {
    nick: typeof u.user_metadata?.nick === "string" ? u.user_metadata.nick : "Cercatore",
    email: u.email ?? "",
    marketing: !!u.user_metadata?.marketing,
  };
}

export default function CacciaAllEnigma() {
  const [pronto, setPronto] = useState(false);
  // Il rendering resta dietro il gate "pronto" finché la sessione non è
  // nota: leggere localStorage nell'inizializzatore lazy è quindi sicuro,
  // niente hydration mismatch (il primo render, server e client, mostra
  // solo il placeholder "night").
  const [level, setLevel] = useState(() => leggiLocale<{ level: number }>(K.progresso)?.level || 1);
  const [shake, setShake] = useState(false);
  const [error, setError] = useState("");
  const [nota, setNota] = useState("");

  // consenso cookie: null = non ancora scelto (preferenza locale, non dato utente)
  const [consenso, setConsenso] = useState<Consenso | null>(() => leggiLocale<Consenso>(K.consenso));
  const [pannelloCookie, setPannelloCookie] = useState(false);
  const [sceltaCookie, setSceltaCookie] = useState(() => {
    const c = leggiLocale<Consenso>(K.consenso);
    return { necessari: true as const, statistiche: !!c?.statistiche };
  });

  // livello II: richiamo visivo quando il biscotto è ancora bloccato
  const [pulse, setPulse] = useState(false);
  const [pulseAuth, setPulseAuth] = useState(false);

  // account (Supabase Auth)
  const [sessione, setSessione] = useState<Sessione | null>(null);

  // la carta di EnigmaLevel è tutta nera (caricamento o Al Buio):
  // il sigillo si spegne per non galleggiare sul nero
  const [cartaScura, setCartaScura] = useState(false);

  const [view, setView] = useState<View>("game");
  const { sceneRef: doorSceneRef, portale: portal, velo, apri: apriPortale } = usePortale();
  const barRef = useRef<HTMLDivElement | null>(null);
  const [barH, setBarH] = useState(0);

  // livello IV+: quale enigma sta mostrando EnigmaLevel e il più alto
  // mai raggiunto in questa sessione (per la barra cliccabile in alto).
  // richiestaEnigma è il canale per chiederle di saltare a un livello:
  // la chiave cresce a ogni click, così ricliccare lo stesso livello
  // dopo un avanzamento genera comunque una richiesta nuova.
  const [livelloEnigma, setLivelloEnigma] = useState<number | null>(null);
  const [livelloEnigmaMax, setLivelloEnigmaMax] = useState<number | null>(null);
  const [richiestaEnigma, setRichiestaEnigma] = useState<{ livello: number; chiave: number } | null>(null);
  // Paginazione della barra: null = segui automaticamente il livello
  // attuale (mostra la finestra che finisce su di lui). Un valore
  // esplicito resta finché non si avanza di nuovo: sfogliare indietro
  // per rivedere un enigma vecchio non deve saltare via da solo.
  const [finestraEnigmi, setFinestraEnigmi] = useState<number | null>(null);
  const FINESTRA = 5;

  /* ------------------------- avvio ------------------------- */

  useEffect(() => {
    const supabase = supabaseBrowser();
    supabase.auth.getSession().then(({ data }) => {
      setSessione(data.session ? sessioneDaUtente(data.session.user) : null);
      setPronto(true);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setSessione(session ? sessioneDaUtente(session.user) : null);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    // Si salva solo il punto più avanzato: rivisitare i livelli 1-3
    // dalla barra non deve far ripartire da lì al prossimo accesso.
    if (!pronto) return;
    const salvato = leggiLocale<{ level: number }>(K.progresso)?.level || 1;
    scriviLocale(K.progresso, { level: Math.max(level, salvato) });
  }, [level, pronto]);

  // il banner è fisso in fondo: teniamo libero lo spazio che occupa.
  // Quando è chiuso non c'è nulla da misurare: barH resta quel che era,
  // ma non viene più usato (vedi il calcolo di paddingBottom più sotto).
  useEffect(() => {
    if (consenso !== null) return;
    const misura = () => setBarH(barRef.current ? barRef.current.offsetHeight : 0);
    misura();
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(misura) : null;
    if (ro && barRef.current) ro.observe(barRef.current);
    window.addEventListener("resize", misura);
    return () => {
      if (ro) ro.disconnect();
      window.removeEventListener("resize", misura);
    };
  }, [consenso, pannelloCookie, view, level, pronto]);

  /* Qui va caricato lo script di statistiche SOLO con consenso.
     In produzione è il punto in cui si inserisce Plausible/Matomo/GA. */
  useEffect(() => {
    if (consenso?.statistiche) {
      // es. caricaScriptStatistiche();
    }
  }, [consenso]);

  /* --------------------- transizioni --------------------- */

  const fail = (msg: string) => {
    setError(msg);
    setShake(true);
  };

  const clearError = () => setError("");

  const openPortal = (next: number, lit: boolean) => {
    setError("");
    apriPortale(() => setLevel(next), lit);
  };

  // click sulla barra in alto: livelli 1-3 fra quelli già raggiunti
  // (superato l'onboarding sono tutti rivisitabili, e le loro porte si
  // possono rigirare per tornare avanti); livelli 4+ fra quelli già
  // raggiunti, li gestisce EnigmaLevel.
  const vaiALivelloOnboarding = (n: number) => {
    if (n <= 3 && (n <= level || level > 3)) {
      setError("");
      // una richiesta pendente non deve scattare quando EnigmaLevel
      // verrà rimontato attraversando di nuovo la porta del III
      setRichiestaEnigma(null);
      setLevel(n);
    }
  };
  const vaiALivelloEnigma = (n: number) => {
    if (livelloEnigmaMax !== null && n <= livelloEnigmaMax) {
      setError("");
      setRichiestaEnigma((prev) => ({ livello: n, chiave: (prev?.chiave ?? 0) + 1 }));
      // dai livelli 1-3 rivisitati si può saltare direttamente a un
      // enigma: EnigmaLevel al mount vedrà la richiesta e andrà lì
      if (level <= 3) setLevel(4);
    }
  };

  // Inizio della finestra visibile sulla barra: se non è stata spostata
  // a mano, segue il livello attuale (o il più alto raggiunto, prima
  // che EnigmaLevel abbia riportato quale sta mostrando).
  const inizioFinestra = (() => {
    if (livelloEnigmaMax === null) return PRIMO_LIVELLO_ENIGMA;
    const riferimento = livelloEnigma ?? livelloEnigmaMax;
    const auto = Math.max(PRIMO_LIVELLO_ENIGMA, riferimento - FINESTRA + 1);
    return finestraEnigmi ?? auto;
  })();
  const inizioFinestraMax =
    livelloEnigmaMax === null ? PRIMO_LIVELLO_ENIGMA : Math.max(PRIMO_LIVELLO_ENIGMA, livelloEnigmaMax - FINESTRA + 1);
  const puoScorrereIndietro = inizioFinestra > PRIMO_LIVELLO_ENIGMA;
  const puoScorrereAvanti = inizioFinestra < inizioFinestraMax;

  /* --------------------- cookie (reale, in localStorage) --------------------- */

  const salvaConsenso = (statistiche: boolean) => {
    const c: Consenso = { necessari: true, statistiche, ts: Date.now(), versione: 1 };
    setConsenso(c);
    setSceltaCookie({ necessari: true, statistiche });
    setPannelloCookie(false);
    scriviLocale(K.consenso, c);
  };

  const revocaConsenso = () => {
    setConsenso(null);
    setPannelloCookie(false);
    rimuoviLocale(K.consenso);
    setNota("Preferenze azzerate: ti verranno richieste di nuovo.");
  };

  const resetAll = () => {
    setLevel(1);
    setError("");
    setView("game");
    setLivelloEnigma(null);
    setLivelloEnigmaMax(null);
    setRichiestaEnigma(null);
    setFinestraEnigmi(null);
    scriviLocale(K.progresso, { level: 1 });
  };

  /* --------------------------- livelli --------------------------- */

  const renderLevel = () => {
    switch (level) {
      case 1:
        return (
          <>
            <p className="kicker">Livello I — Ingresso</p>
            <Door sceneRef={doorSceneRef} onComplete={() => openPortal(2, true)} />
          </>
        );

      case 2:
        return (
          <>
            <p className="kicker">Livello II — I Biscotti</p>
            <Door
              sceneRef={doorSceneRef}
              variant="biscotto"
              inert={consenso === null}
              inertLabel="Pomello bloccato: rispondi prima al banner dei cookie"
              onInert={() => {
                setPulse(true);
                setTimeout(() => setPulse(false), 900);
              }}
              onComplete={() => openPortal(3, true)}
            />
          </>
        );

      case 3:
        return (
          <>
            <p className="kicker">Livello III — Il Patto</p>
            <Door
              sceneRef={doorSceneRef}
              variant="serratura"
              inert={!sessione}
              inertLabel="Pomello bloccato: registrati per aprire la porta"
              onInert={() => {
                setPulseAuth(true);
                setTimeout(() => setPulseAuth(false), 900);
              }}
              onComplete={() => openPortal(4, true)}
            />
          </>
        );

      default:
        return (
          <EnigmaLevel
            mioNick={sessione?.nick}
            onFail={fail}
            onClearError={clearError}
            onRestart={resetAll}
            onCambioLivello={(l) => {
              setLivelloEnigma(l);
              // Solo un avanzamento vero (non una rivisita all'indietro
              // tramite la barra) riporta la finestra a seguire il livello
              // attuale in automatico.
              if (livelloEnigmaMax === null || l > livelloEnigmaMax) {
                setLivelloEnigmaMax(l);
                setFinestraEnigmi(null);
              }
            }}
            onLivelloMassimo={(l) => {
              // Caccia completata: nessun livello "in corso", ma la barra
              // deve comunque offrire i livelli risolti da rivisitare.
              setLivelloEnigmaMax((prev) => (prev === null || l > prev ? l : prev));
            }}
            richiesta={richiestaEnigma}
            onCartaScura={setCartaScura}
          />
        );
    }
  };

  /* ---------------------------- shell ---------------------------- */

  const contenuto = () => {
    if (view === "auth")
      return (
        <Auth
          onAuthenticated={() => setView("game")}
          onPrivacy={() => setView("privacy")}
          onClose={() => setView("game")}
          onFail={fail}
          onClearError={clearError}
          onNota={setNota}
        />
      );
    if (view === "account" && sessione)
      return (
        <Account
          sessione={sessione}
          livelloOnboarding={level}
          onClose={() => setView("game")}
          onSignedOut={() => {
            setView("game");
            setNota("Sei uscito. La Caccia ti aspetta.");
          }}
        />
      );
    if (view === "privacy") return <PrivacyPage onClose={() => setView("game")} />;
    if (view === "cookie")
      return (
        <CookiePreferencesPage
          consenso={consenso}
          statistiche={sceltaCookie.statistiche}
          onToggleStatistiche={() =>
            setSceltaCookie((s) => ({ ...s, statistiche: !s.statistiche }))
          }
          onSalva={salvaConsenso}
          onRevoca={revocaConsenso}
          onClose={() => setView("game")}
        />
      );
    return renderLevel();
  };

  const sigillo = () => {
    if (view === "auth" || view === "account") return <UserGlyph size={20} />;
    if (view === "privacy" || view === "cookie") return "§";
    if (level <= 3) return ROMANS[level - 1];
    return livelloEnigma !== null ? romano(livelloEnigma) : "✓";
  };

  if (!pronto) return <div className="night" />;

  return (
    <div className="night" style={{ paddingBottom: 28 + (consenso === null ? barH : 0) }}>
      <button
        className={"authIcon" + (pulseAuth ? " pulse" : "")}
        aria-label={sessione ? "Il tuo patto" : "Accedi o registrati"}
        onClick={() => {
          setError("");
          setNota("");
          if (view === "auth" || view === "account") setView("game");
          else setView(sessione ? "account" : "auth");
        }}
      >
        {view === "auth" || view === "account" ? "✕" : <UserGlyph />}
      </button>

      <header className="top">
        <h1 className="wordmark">Caccia all&apos;Enigma</h1>
        <div className="progress" aria-label="Livelli">
          {ROMANS.map((_, i) => {
            const n = i + 1;
            const cliccabile = n <= level || level > 3;
            return (
              <button
                key={n}
                type="button"
                className={"step" + (n < level ? " done" : "") + (n === level ? " now" : "")}
                disabled={!cliccabile}
                onClick={() => vaiALivelloOnboarding(n)}
              >
                {n}
              </button>
            );
          })}
          {livelloEnigmaMax !== null && puoScorrereIndietro && (
            <button
              type="button"
              className="pager"
              aria-label="Enigmi precedenti"
              onClick={() => setFinestraEnigmi(Math.max(PRIMO_LIVELLO_ENIGMA, inizioFinestra - FINESTRA))}
            >
              ‹
            </button>
          )}
          {livelloEnigmaMax !== null &&
            Array.from({ length: Math.min(FINESTRA, livelloEnigmaMax - inizioFinestra + 1) }, (_, i) => inizioFinestra + i).map(
              (n) => (
                <button
                  key={n}
                  type="button"
                  // livelloEnigma null con la barra visibile = caccia
                  // completata: tutti i livelli sono risolti, quindi "done".
                  className={
                    "step" +
                    (n < (livelloEnigma ?? livelloEnigmaMax + 1) ? " done" : "") +
                    (n === livelloEnigma ? " now" : "")
                  }
                  aria-current={n === livelloEnigma ? "step" : undefined}
                  onClick={() => vaiALivelloEnigma(n)}
                >
                  {n}
                </button>
              )
            )}
          {livelloEnigmaMax !== null && puoScorrereAvanti && (
            <button
              type="button"
              className="pager"
              aria-label="Enigmi successivi"
              onClick={() => setFinestraEnigmi(Math.min(inizioFinestraMax, inizioFinestra + FINESTRA))}
            >
              ›
            </button>
          )}
        </div>
        {level > 1 && view === "game" && (
          <button className="resetBtn" onClick={resetAll}>
            ↺ ricomincia
          </button>
        )}
      </header>

      <main className="stage">
        <div
          key={view === "game" ? level : view}
          className={"card in" + (shake ? " shake" : "")}
          onAnimationEnd={() => setShake(false)}
        >
          {!(view === "game" && level > 3 && cartaScura) && <div className="seal">{sigillo()}</div>}
          {contenuto()}
          {error && <p className="error">{error}</p>}
          {nota && <p className="nota">{nota}</p>}
          {portal && view === "game" && <div className="cardBuio" aria-hidden="true" />}
        </div>
      </main>

      <footer className="foot">
        <button className="footLink" onClick={() => setView("privacy")}>
          Informativa privacy
        </button>
        <span className="footSep">·</span>
        <button className="footLink" onClick={() => setView("cookie")}>
          Preferenze cookie
        </button>
        <p className="footNote">i tuoi progressi sono legati al tuo account</p>
      </footer>

      {portal && <Portal rect={portal} lit={portal.lit} leafOpen={portal.leafOpen} zoom={portal.zoom} />}
      {velo && <div className="velo" aria-hidden="true" />}

      {consenso === null && (
        <CookieBanner
          ref={barRef}
          pulse={pulse}
          pannelloCookie={pannelloCookie}
          statistiche={sceltaCookie.statistiche}
          onToggleStatistiche={() =>
            setSceltaCookie((s) => ({ ...s, statistiche: !s.statistiche }))
          }
          onTogglePannello={() => setPannelloCookie((v) => !v)}
          onSalva={salvaConsenso}
          onPrivacy={() => setView("privacy")}
        />
      )}
    </div>
  );
}
