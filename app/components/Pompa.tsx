"use client";

import { useState, type RefObject } from "react";
import { Door } from "./Door";

type PompaProps = {
  sceneRef: RefObject<HTMLDivElement | null>;
  /** Il tappo dello scarico del livello IV: finché resta fuori, l'acqua
      pompata su rifluisce subito da lì e il livello non si svuota. */
  tappoInserito: boolean;
  /** La pompa ha già svuotato la stanza (riapertura dopo un ricaricamento). */
  giaDrenata: boolean;
  onPompata: () => void;
  onSbloccato: () => void;
};

/* Livello V: l'acqua drenata al IV è colata fin qui. La pompa la
   rimanda su, ma tiene solo se lassù il tappo è tornato al suo posto:
   altrimenti l'acqua ondeggia, ricade dallo stesso scarico e la stanza
   resta allagata. Nessun messaggio: lo dice il comportamento. */
export function Pompa({ sceneRef, tappoInserito, giaDrenata, onPompata, onSbloccato }: PompaProps) {
  const [pompando, setPompando] = useState(false);
  const [vana, setVana] = useState(false);
  const [svuotata, setSvuotata] = useState(giaDrenata);
  const [drenata, setDrenata] = useState(giaDrenata);

  const aziona = () => {
    if (pompando || drenata) return;
    setPompando(true);
    if (!tappoInserito) {
      setVana(true);
      setTimeout(() => {
        setVana(false);
        setPompando(false);
      }, 1600);
      return;
    }
    setSvuotata(true);
    setTimeout(() => {
      setPompando(false);
      setDrenata(true);
      onPompata();
    }, 1900);
  };

  return (
    <div className={"sottacqua" + (svuotata ? " tirata" : "") + (vana ? " vana" : "")}>
      <Door
        sceneRef={sceneRef}
        variant="scarico"
        inert={!drenata}
        inertLabel="Pomello bloccato: l'acqua è ancora alta"
        onComplete={onSbloccato}
      />

      <div className="acqua" aria-hidden="true">
        <svg className="acquaOnda" viewBox="0 0 240 16" preserveAspectRatio="none">
          <path d="M0 8 Q 20 0 40 8 T 80 8 T 120 8 T 160 8 T 200 8 T 240 8 V16 H0 Z" />
        </svg>
        <div className="acquaCorpo" />
      </div>

      <button
        type="button"
        className={"pompaLeva" + (pompando ? " attiva" : "") + (drenata ? " ritirata" : "")}
        onClick={aziona}
        disabled={pompando || drenata}
        aria-label="Aziona la pompa"
      >
        <svg viewBox="0 0 44 54" width="30" height="37">
          <rect x="18" y="28" width="8" height="26" rx="2" fill="#241b10" />
          <circle cx="22" cy="19" r="13" fill="#241b10" opacity="0.85" />
          <g className="ruota" fill="none" stroke="#8b96a3" strokeWidth="2.2" strokeLinecap="round">
            <circle cx="22" cy="19" r="8" />
            <path d="M22 11.5 V26.5 M14.5 19 H29.5" />
          </g>
        </svg>
      </button>
    </div>
  );
}
