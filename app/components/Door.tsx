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
  /* Al Buio non si vede niente girare: mezzo giro basta e avanza, o
     si resta a mulinare senza capire se sta succedendo qualcosa. */
  const TARGET = variant === "buio" ? 150 : 270;
  const knobRef = useRef<HTMLDivElement | null>(null);
  const angleRef = useRef(0);
  const dragRef = useRef({ active: false, last: 0 });
  const doneRef = useRef(false);
  const [angle, setAngle] = useState(0);
  const [stuck, setStuck] = useState(false);
  /* Al Perno la soglia è pesante e torna giù da sola: mollata a metà
     di un accenno di giro, si riporta a zero. Serve a due cose. Toglie
     il cricchetto — a furia di piccoli strappi la pietra si
     arrampicava a scatti senza che nessuno l'avesse girata — e fa
     vedere a occhio che ha gioco ma non cede finché non la si spazza
     per davvero. */
  const [rientro, setRientro] = useState(false);

  /* Il Perno: il pomello non gira, e nemmeno la porta. Gira la SOGLIA
     di pietra, presa per la pietra stessa, attorno a un'anta ferma. */
  const perno = variant === "perno";
  /* Sotto questi gradi il giro non è un giro: è un dito appoggiato. */
  const IMPEGNO = 40;
  /* Attorno al pomello la pietra non si prende: lì la mano ci finisce
     da sola, e il livello si risolverebbe senza aver capito niente. */
  const RAGGIO_PROIBITO = 62;

  /* Quanto dito è passato in questa presa: serve solo al Perno, per
     accorgersi del mulinello stretto sul pomello (tanto movimento,
     nessun giro) e far traballare l'anta invece di restare muta. */
  const gestoRef = useRef({ percorso: 0, partenza: 0, x: 0, y: 0 });

  const pointerAngle = (e: React.PointerEvent) => {
    /* Al Perno l'angolo si misura attorno al centro del VANO, non del
       pomello: è la pietra a girare, e la si spazza in un arco largo
       prendendola dov'è, cioè lontano dal pomello. */
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
    /* Mano posata sulla pietra a un palmo dal pomello: è la scorciatoia
       che renderebbe il livello un pomello come tutti gli altri. La
       soglia traballa e resta dov'è. */
    if (perno && knobRef.current) {
      const k = knobRef.current.getBoundingClientRect();
      const d = Math.hypot(e.clientX - (k.left + k.width / 2), e.clientY - (k.top + k.height / 2));
      if (d < RAGGIO_PROIBITO) {
        setStuck(true);
        return;
      }
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
            <g className="leaf">
              <path d={ARCH} fill="url(#wood)" stroke="#241b10" strokeWidth="3" />
              <path d="M97 74 L97 300" stroke="#241b10" strokeWidth="1.5" opacity="0.45" />
              <path d="M143 74 L143 300" stroke="#241b10" strokeWidth="1.5" opacity="0.45" />
              <circle cx="62" cy="132" r="2.6" fill="#241b10" opacity="0.7" />
              <circle cx="178" cy="132" r="2.6" fill="#241b10" opacity="0.7" />
              <circle cx="62" cy="288" r="2.6" fill="#241b10" opacity="0.7" />
              <circle cx="178" cy="288" r="2.6" fill="#241b10" opacity="0.7" />
            </g>

            {/* La soglia di pietra. Ovunque è ferma; al Perno è l'unica
                cosa che si muove, e gira attorno a un'anta immobile. */}
            <g className="soglia" style={{ transform: `rotate(${perno ? angle : 0}deg)` }}>
              <path
                d="M40 302 L40 130 Q40 58 120 58 Q200 58 200 130 L200 302"
                fill="none"
                stroke="#2b2418"
                strokeWidth="9"
                strokeLinecap="round"
                opacity="0.9"
              />
              <path d="M32 302 L208 302" stroke="#2b2418" strokeWidth="9" strokeLinecap="round" opacity="0.9" />
              {/* la presa: la stessa pietra, ingrassata e invisibile, per
                  darle lo spessore di un dito */}
              {perno && (
                <g
                  className="sogliaPresa"
                  role="button"
                  tabIndex={0}
                  aria-label="Gira la soglia di pietra in senso orario"
                  onPointerDown={onDown}
                  onPointerMove={onMove}
                  onPointerUp={stop}
                  onPointerCancel={stop}
                  onKeyDown={(e) => {
                    const orario = e.key === "ArrowRight" || e.key === "ArrowUp";
                    const antiorario = e.key === "ArrowLeft" || e.key === "ArrowDown";
                    if (!orario && !antiorario) return;
                    e.preventDefault();
                    apply(orario ? 24 : -24);
                  }}
                >
                  <path d="M40 302 L40 130 Q40 58 120 58 Q200 58 200 130 L200 302" />
                  <path d="M32 302 L208 302" />
                </g>
              )}
            </g>
          </>
        )}
      </svg>

      <div
        ref={knobRef}
        className={"doorKnob" + (inert ? " inert" : "") + (stuck && !perno ? " stuck" : "")}
        role="button"
        aria-label={
          inert ? inertLabel : perno ? "Pomello saldato: non gira" : "Gira il pomello in senso orario"
        }
        aria-disabled={inert}
        tabIndex={0}
        /* al Perno il pomello non gira: sta lì, saldato a un'anta che
           non si muove, mentre attorno gli gira la pietra */
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
          } else if (perno) {
            /* Il pomello non è il comando, nemmeno da tastiera: se lo
               fosse, chi gioca con le frecce si troverebbe la
               scorciatoia che al dito abbiamo tolto. Chi gira è la
               pietra, e la pietra ha il suo fuoco. */
            setStuck(true);
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
             l'anta dritta col suo pomellino nel punto esatto in cui sta
             quello vero, e attorno la soglia già girata. Non è il
             disegno di una porta: è il disegno della soluzione, e dice
             quale dei due pezzi è quello che si muove. */
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
            {/* l'anta: dritta, ferma, col suo pomello dove sta il vero */}
            <g
              transform="translate(19 10.875) scale(0.125)"
              stroke="#150f08"
              opacity="0.45"
            >
              <path d={ARCH} fill="none" strokeWidth="13" strokeLinejoin="round" />
              <circle cx="168" cy="185" r="15" fill="#150f08" stroke="none" />
            </g>
            {/* la soglia: stipiti e pietra di sotto, e sono LORO storti.
                Niente arco in cima, o si impasterebbe con quello
                dell'anta */}
            <g
              transform="rotate(30 34 34) translate(19 10.875) scale(0.125)"
              fill="none"
              stroke="#150f08"
              strokeWidth="16"
              strokeLinecap="round"
            >
              <path d="M40 302 L40 140" />
              <path d="M200 302 L200 140" />
              <path d="M32 302 L208 302" />
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
  );
}
