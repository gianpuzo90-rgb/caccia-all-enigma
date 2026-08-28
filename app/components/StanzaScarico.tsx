"use client";

import { type RefObject } from "react";
import { Door } from "./Door";
import { Tappo } from "./Tappo";

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

      <Tappo
        inserito={tappoInserito}
        onClick={tappoInserito ? onTiraTappo : onRimettiTappo}
        etichetta={
          !tappoInserito
            ? "Rimetti il tappo nello scarico"
            : allagata
              ? "Tira la catenella: sfila il tappo e fai defluire l'acqua"
              : "Tira la catenella: sfila il tappo dallo scarico"
        }
      />
    </div>
  );
}
