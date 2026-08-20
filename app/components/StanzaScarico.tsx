"use client";

import { type RefObject } from "react";
import { Door } from "./Door";

type StanzaScaricoProps = {
  sceneRef: RefObject<HTMLDivElement | null>;
  /** L'acqua in questo momento è qui al IV (la pompa del V l'ha rimandata su). */
  allagata: boolean;
  tappoInserito: boolean;
  /** Catenella tirata: il tappo esce e, se c'è acqua, defluisce di sotto. */
  onTiraTappo: () => void;
  onRimettiTappo: () => void;
  /** Pomello girato di nuovo (possibile solo a stanza asciutta):
      si riattraversa la porta verso il livello successivo. */
  onAvanti: () => void;
};

/* Il livello IV rivisitato a enigma risolto: la stessa stanza, di norma
   senza acqua. Il tappo resta manovrabile — la catenella lo sfila, un
   click lo rimette — e se la pompa del V ha rimandato su l'acqua la
   stanza è di nuovo allagata: tirare la catenella la fa riscendere. */
export function StanzaScarico({
  sceneRef,
  allagata,
  tappoInserito,
  onTiraTappo,
  onRimettiTappo,
  onAvanti,
}: StanzaScaricoProps) {
  return (
    <div className={"sottacqua" + (allagata ? "" : " tirata")}>
      <Door
        sceneRef={sceneRef}
        variant="scarico"
        inert={allagata}
        inertLabel="Pomello bloccato: l'acqua è ancora alta"
        onComplete={onAvanti}
      />

      <div className="acqua" aria-hidden="true">
        <svg className="acquaOnda" viewBox="0 0 240 16" preserveAspectRatio="none">
          <path d="M0 8 Q 20 0 40 8 T 80 8 T 120 8 T 160 8 T 200 8 T 240 8 V16 H0 Z" />
        </svg>
        <div className="acquaCorpo" />
      </div>

      {tappoInserito ? (
        <button
          type="button"
          className="catenella"
          onClick={onTiraTappo}
          aria-label={
            allagata
              ? "Tira la catenella: sfila il tappo e fai defluire l'acqua"
              : "Tira la catenella: sfila il tappo dallo scarico"
          }
        >
          <svg viewBox="0 0 40 52" width="26" height="34">
            <line
              x1="20" y1="0" x2="20" y2="38"
              stroke="#8b96a3" strokeWidth="2.4" strokeDasharray="1 6" strokeLinecap="round"
            />
            <rect x="7" y="38" width="26" height="6" rx="3" fill="#241b10" />
          </svg>
        </button>
      ) : (
        <button
          type="button"
          className="catenella"
          onClick={onRimettiTappo}
          aria-label="Rimetti il tappo nello scarico"
        >
          <svg viewBox="0 0 40 52" width="26" height="34">
            <circle cx="20" cy="14" r="5" fill="none" stroke="#8b96a3" strokeWidth="2.4" />
            <path d="M8 30 h24 l-4 16 h-16 Z" fill="#241b10" />
          </svg>
        </button>
      )}
    </div>
  );
}
