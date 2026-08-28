"use client";

import { useState, type RefObject } from "react";
import { Door } from "./Door";
import { Tappo } from "./Tappo";

type SottacquaProps = {
  sceneRef: RefObject<HTMLDivElement | null>;
  /** Il tappo era già stato tirato (riapertura dopo un ricaricamento). */
  giaDrenata?: boolean;
  onTappoRimosso?: () => void;
  onSbloccato: () => void;
};

/* Livello IV: la stanza è allagata. Bisogna tirare la catenella del
   tappo di scarico (in basso a sinistra) per far defluire l'acqua
   prima che il pomello si sblocchi. L'acqua non svanisce: scende di
   un piano, al livello V. */
export function Sottacqua({ sceneRef, giaDrenata = false, onTappoRimosso, onSbloccato }: SottacquaProps) {
  const [tirata, setTirata] = useState(giaDrenata);
  const [drenata, setDrenata] = useState(giaDrenata);

  const tiraCatenella = () => {
    if (tirata) return;
    setTirata(true);
    onTappoRimosso?.();
    setTimeout(() => setDrenata(true), 1900);
  };

  return (
    <div className={"sottacqua" + (tirata ? " tirata" : "")}>
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

      {/* Sfilato, il tappo resta lì a vista, coricato accanto allo
          scarico: sparire di colpo lo faceva sembrare mai esistito, e
          poi al VI bisogna ricordarsi di essere stati proprio noi a
          toglierlo. Rimetterlo è roba della stanza rivisitata. */}
      <Tappo
        inserito={!tirata}
        onClick={tirata ? undefined : tiraCatenella}
        etichetta={tirata ? "Il tappo è fuori dallo scarico" : "Tira la catenella per far defluire l'acqua"}
      />
    </div>
  );
}
