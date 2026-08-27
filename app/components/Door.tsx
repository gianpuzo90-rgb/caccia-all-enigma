"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import { ARCH } from "./utils";

type DoorVariant = "ottone" | "biscotto" | "serratura" | "scarico" | "buio" | "perno";

type DoorProps = {
  onComplete: () => void;
  sceneRef: RefObject<HTMLDivElement | null>;
  variant?: DoorVariant;
  inert?: boolean;
  onInert?: () => void;
  inertLabel?: string;
  /** Se c'è, il pomello gira anche in senso antiorario e a giro
      completo dall'altra parte chiama questa invece di onComplete. */
  onCompleteInverso?: () => void;
};

/* --------- Porta: pomello girevole, bloccato o attivo --------- */

export function Door({
  onComplete,
  sceneRef,
  variant = "ottone",
  inert = false,
  onInert,
  inertLabel = "Pomello bloccato",
  onCompleteInverso,
}: DoorProps) {
  const TARGET = 270;
  const knobRef = useRef<HTMLDivElement | null>(null);
  const angleRef = useRef(0);
  const dragRef = useRef({ active: false, last: 0 });
  const doneRef = useRef(false);
  const [angle, setAngle] = useState(0);
  const [stuck, setStuck] = useState(false);
  /* Al Perno l'anta è pesante e torna giù da sola: mollata a metà di
     un accenno di giro, si riporta a zero. Serve a due cose. Toglie il
     cricchetto — girando in tondo sul pomello l'anta si arrampicava a
     scatti e restava storta senza che nessuno l'avesse girata — e fa
     vedere a occhio che il legno ha gioco ma non va da nessuna parte
     finché non lo si spazza per davvero. */
  const [rientro, setRientro] = useState(false);

  /* Il Perno: il pomello è saldato all'anta e non gira per conto suo.
     Gira tutta la porta, e il pomello è il piolo per cui la si prende. */
  const perno = variant === "perno";
  /* Sotto questi gradi il giro non è un giro: è un dito appoggiato. */
  const IMPEGNO = 40;

  /* Quanto dito è passato in questa presa: serve solo al Perno, per
     accorgersi del mulinello stretto sul pomello (tanto movimento,
     nessun giro) e far traballare l'anta invece di restare muta. */
  const gestoRef = useRef({ percorso: 0, partenza: 0, x: 0, y: 0 });

  const pointerAngle = (e: React.PointerEvent) => {
    /* Al Perno l'angolo si misura attorno al centro della PORTA, non
       del pomello. È la geometria a insegnare il gesto: un mulinello
       stretto sul pomello, visto da quel centro, è quasi un
       andirivieni e infatti non porta da nessuna parte — la porta va
       spazzata in un arco largo. */
    const r = (perno ? sceneRef.current! : knobRef.current!).getBoundingClientRect();
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height * (perno ? 0.578 : 0.5);
    return (Math.atan2(e.clientY - cy, e.clientX - cx) * 180) / Math.PI;
  };

  /* Il dito manda molti più eventi di quanti fotogrammi ci siano: si
     accumula l'angolo e si ridisegna una volta per fotogramma, così il
     pomello resta fluido anche sui telefoni lenti. */
  const frameRef = useRef<number | null>(null);
  useEffect(() => () => {
    if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
  }, []);

  const apply = (delta: number) => {
    if (doneRef.current) return;
    // il giro antiorario esiste solo dove serve: altrove il pomello si
    // ferma a zero come ha sempre fatto
    const minimo = onCompleteInverso ? -TARGET : 0;
    angleRef.current = Math.max(minimo, Math.min(TARGET, angleRef.current + delta));
    if (frameRef.current === null) {
      frameRef.current = requestAnimationFrame(() => {
        frameRef.current = null;
        setAngle(angleRef.current);
      });
    }
    if (angleRef.current >= TARGET) {
      doneRef.current = true;
      onComplete?.();
    } else if (angleRef.current <= -TARGET) {
      doneRef.current = true;
      onCompleteInverso?.();
    }
  };

  const onDown = (e: React.PointerEvent) => {
    if (doneRef.current) return;
    if (inert) {
      setStuck(true);
      onInert?.();
      return;
    }
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = { active: true, last: pointerAngle(e) };
    gestoRef.current = { percorso: 0, partenza: angleRef.current, x: e.clientX, y: e.clientY };
  };

  const onMove = (e: React.PointerEvent) => {
    if (!dragRef.current.active || doneRef.current) return;
    const a = pointerAngle(e);
    let d = a - dragRef.current.last;
    if (d > 180) d -= 360;
    if (d < -180) d += 360;
    dragRef.current.last = a;
    const g = gestoRef.current;
    g.percorso += Math.hypot(e.clientX - g.x, e.clientY - g.y);
    g.x = e.clientX;
    g.y = e.clientY;
    apply(d);
  };

  const stop = () => {
    if (!dragRef.current.active) return;
    dragRef.current.active = false;
    if (!perno || doneRef.current) return;
    /* Mano tolta senza aver girato niente: l'anta si rimette dritta. */
    if (angleRef.current > 0 && angleRef.current < IMPEGNO) {
      angleRef.current = 0;
      setRientro(true);
      setAngle(0);
      setTimeout(() => setRientro(false), 460);
    }
    /* Dito mosso parecchio e anta praticamente ferma: è il mulinello
       stretto sul pomello, il gesto che funziona in tutti gli altri
       livelli. Qui il legno traballa e basta. */
    if (gestoRef.current.percorso > 70 && angleRef.current < 2) setStuck(true);
  };

  const progress = Math.abs(angle) / TARGET;

  return (
    <div
      className={
        "doorScene" +
        (perno ? " perno" : "") +
        (perno && stuck ? " scossa" : "") +
        (rientro ? " rientro" : "")
      }
      ref={sceneRef}
      onAnimationEnd={perno ? () => setStuck(false) : undefined}
    >
      <svg className="doorSvg" viewBox="0 0 240 320" aria-hidden="true">
        <defs>
          <radialGradient id="doorlight" cx="50%" cy="42%" r="62%">
            <stop offset="0%" stopColor="#ffe3a6" />
            <stop offset="55%" stopColor="#e8a33d" stopOpacity="0.55" />
            <stop offset="100%" stopColor="#e8a33d" stopOpacity="0" />
          </radialGradient>
          <linearGradient id="wood" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#4b3a27" />
            <stop offset="50%" stopColor="#5d4732" />
            <stop offset="100%" stopColor="#443322" />
          </linearGradient>
        </defs>

        {/* al buio non filtra niente: la stanza resta nera fino in fondo */}
        {variant !== "buio" && <path d={ARCH} fill="url(#doorlight)" opacity={progress} />}

        {variant !== "buio" && (
          <>
            {/* Il vano di pietra non si muove mai: gira l'anta, e solo
                al Perno. Altrove questo strato sta a zero gradi. */}
            <g className="anta" style={{ transform: `rotate(${perno ? angle : 0}deg)` }}>
            <g className="leaf">
              <path d={ARCH} fill="url(#wood)" stroke="#241b10" strokeWidth="3" />
              <path d="M97 74 L97 300" stroke="#241b10" strokeWidth="1.5" opacity="0.45" />
              <path d="M143 74 L143 300" stroke="#241b10" strokeWidth="1.5" opacity="0.45" />
              <circle cx="62" cy="132" r="2.6" fill="#241b10" opacity="0.7" />
              <circle cx="178" cy="132" r="2.6" fill="#241b10" opacity="0.7" />
              <circle cx="62" cy="288" r="2.6" fill="#241b10" opacity="0.7" />
              <circle cx="178" cy="288" r="2.6" fill="#241b10" opacity="0.7" />
            </g>
            </g>

            <path
              d="M40 302 L40 130 Q40 58 120 58 Q200 58 200 130 L200 302"
              fill="none"
              stroke="#2b2418"
              strokeWidth="9"
              strokeLinecap="round"
              opacity="0.9"
            />
            <path d="M32 302 L208 302" stroke="#2b2418" strokeWidth="9" strokeLinecap="round" opacity="0.9" />
          </>
        )}
      </svg>

      {/* Al Perno si può prendere anche il legno, non solo il piolo:
          chi capisce che è la porta a girare non deve poi indovinare
          pure dove metterci le mani. */}
      {perno && (
        <div
          className="doorPresa"
          aria-hidden="true"
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={stop}
          onPointerCancel={stop}
        />
      )}

      <div className={perno ? "doorGira" : "doorFermo"} style={{ transform: `rotate(${perno ? angle : 0}deg)` }}>
      <div
        ref={knobRef}
        className={"doorKnob" + (inert ? " inert" : "") + (stuck && !perno ? " stuck" : "")}
        role="button"
        aria-label={inert ? inertLabel : perno ? "Gira la porta in senso orario" : "Gira il pomello in senso orario"}
        aria-disabled={inert}
        tabIndex={0}
        /* al Perno il pomello non gira su sé stesso: è saldato all'anta
           e va in giro con lei, che ruota lo strato qui sopra */
        style={{ transform: `translate(-50%, -50%) rotate(${perno ? 0 : angle}deg)` }}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={stop}
        onPointerCancel={stop}
        onAnimationEnd={() => setStuck(false)}
        onKeyDown={(e) => {
          const orario = e.key === "ArrowRight" || e.key === "ArrowUp";
          const antiorario = e.key === "ArrowLeft" || e.key === "ArrowDown";
          if (!orario && !antiorario) return;
          e.preventDefault();
          if (inert) {
            setStuck(true);
            onInert?.();
          } else apply(orario ? 24 : -24);
        }}
      >
        {variant === "buio" ? null : variant === "biscotto" ? (
          <svg viewBox="0 0 68 68" width="36" height="36">
            <defs>
              <radialGradient id="pasta" cx="36%" cy="28%" r="82%">
                <stop offset="0%" stopColor="#e7ba7c" />
                <stop offset="58%" stopColor="#c99154" />
                <stop offset="100%" stopColor="#95632f" />
              </radialGradient>
            </defs>
            <circle cx="34" cy="34" r="27" fill="#1b140c" opacity="0.4" />
            <path
              d="M34 10 C44 10 52 15 56 23 C60 31 58 42 51 49 C44 57 32 59 24 55
                 C15 51 10 42 11 33 C12 22 22 10 34 10 Z"
              fill="url(#pasta)"
              stroke="#7d5227"
              strokeWidth="1.6"
            />
            <circle cx="26" cy="23" r="4.3" fill="#432612" />
            <circle cx="44" cy="29" r="3.5" fill="#432612" />
            <circle cx="30" cy="41" r="3.9" fill="#432612" />
            <circle cx="45" cy="45" r="2.9" fill="#432612" />
            <circle cx="20" cy="34" r="2.5" fill="#432612" />
            <circle cx="36" cy="31" r="1.9" fill="#5b3418" opacity="0.7" />
            <circle cx="38" cy="52" r="1.6" fill="#5b3418" opacity="0.55" />
          </svg>
        ) : variant === "serratura" ? (
          <svg viewBox="0 0 68 68" width="34" height="34">
            <defs>
              <radialGradient id="brassLock" cx="38%" cy="32%" r="78%">
                <stop offset="0%" stopColor="#dcbc7c" />
                <stop offset="55%" stopColor="#a87f42" />
                <stop offset="100%" stopColor="#6b4f26" />
              </radialGradient>
            </defs>
            <circle cx="34" cy="34" r="27" fill="#1b140c" opacity="0.4" />
            <circle cx="34" cy="34" r="23" fill="url(#brassLock)" stroke="#4a3820" strokeWidth="2" />
            <g
              transform="translate(34 34) scale(1.55) translate(-12 -12)"
              fill="none"
              stroke="#150f08"
              strokeWidth="1.8"
              strokeLinecap="round"
            >
              <circle cx="12" cy="8.5" r="3.6" />
              <path d="M4.5 20.5 C4.5 15.5 8 13.8 12 13.8 C16 13.8 19.5 15.5 19.5 20.5" />
            </g>
          </svg>
        ) : variant === "perno" ? (
          /* L'incisione è un modello in scala di quello che hai davanti:
             il vano dritto, l'anta già girata dentro, e sull'anta il
             suo pomellino nel punto esatto in cui sta quello vero. Non
             è il disegno di una porta: è il disegno della soluzione. */
          <svg viewBox="0 0 68 68" width="34" height="34">
            <defs>
              <radialGradient id="brassPerno" cx="38%" cy="32%" r="78%">
                <stop offset="0%" stopColor="#dcbc7c" />
                <stop offset="55%" stopColor="#a87f42" />
                <stop offset="100%" stopColor="#6b4f26" />
              </radialGradient>
            </defs>
            <circle cx="34" cy="34" r="27" fill="#1b140c" opacity="0.4" />
            <circle cx="34" cy="34" r="23" fill="url(#brassPerno)" stroke="#4a3820" strokeWidth="2" />
            {/* il vano: stipiti e soglia, dritti e fermi. Niente arco in
                cima, o si impasterebbe con quello dell'anta girata */}
            <g
              transform="translate(19 10.875) scale(0.125)"
              fill="none"
              stroke="#150f08"
              strokeWidth="13"
              strokeLinecap="round"
              opacity="0.42"
            >
              <path d="M50 300 L50 150" />
              <path d="M190 300 L190 150" />
              <path d="M42 300 L198 300" />
            </g>
            {/* l'anta: storta, e col pomello che se n'è andato con lei */}
            <g transform="rotate(28 34 34) translate(19 10.875) scale(0.125)" stroke="#150f08">
              <path d={ARCH} fill="none" strokeWidth="15" strokeLinejoin="round" />
              <circle cx="168" cy="185" r="17" fill="#150f08" stroke="none" />
            </g>
          </svg>
        ) : variant === "scarico" ? (
          <svg viewBox="0 0 68 68" width="34" height="34">
            <defs>
              <radialGradient id="brassScarico" cx="38%" cy="32%" r="78%">
                <stop offset="0%" stopColor="#dcbc7c" />
                <stop offset="55%" stopColor="#a87f42" />
                <stop offset="100%" stopColor="#6b4f26" />
              </radialGradient>
            </defs>
            <circle cx="34" cy="34" r="27" fill="#1b140c" opacity="0.4" />
            <circle cx="34" cy="34" r="23" fill="url(#brassScarico)" stroke="#4a3820" strokeWidth="2" />
            <g
              transform="translate(34 34) scale(1.55) translate(-12 -12)"
              fill="none"
              stroke="#150f08"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M12 3 C12 3 5.5 11.2 5.5 15.5 C5.5 19.4 8.4 22 12 22 C15.6 22 18.5 19.4 18.5 15.5 C18.5 11.2 12 3 12 3 Z" />
              <line x1="4.5" y1="20" x2="19.5" y2="4" />
            </g>
          </svg>
        ) : (
          <svg viewBox="0 0 68 68" width="34" height="34">
            <defs>
              <radialGradient id="brass" cx="38%" cy="32%" r="78%">
                <stop offset="0%" stopColor="#dcbc7c" />
                <stop offset="55%" stopColor="#a87f42" />
                <stop offset="100%" stopColor="#6b4f26" />
              </radialGradient>
            </defs>
            <circle cx="34" cy="34" r="27" fill="#1b140c" opacity="0.4" />
            <circle cx="34" cy="34" r="23" fill="url(#brass)" stroke="#4a3820" strokeWidth="2" />
          </svg>
        )}
      </div>
      </div>
    </div>
  );
}
