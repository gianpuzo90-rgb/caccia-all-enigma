"use client";

import { type RefObject } from "react";
import { Door } from "./Door";

type SpecchioProps = {
  sceneRef: RefObject<HTMLDivElement | null>;
  onInerte?: () => void;
};

/* Lo Specchio: la stanza dei Biscotti riflessa — stessa porta, stesso
   pomello, tutto rovesciato. Qui dentro non si muove niente: il gesto
   va fatto davanti all'originale, girando il pomello dall'altra parte. */
export function Specchio({ sceneRef, onInerte }: SpecchioProps) {
  return (
    <div className="specchio">
      <Door
        sceneRef={sceneRef}
        variant="biscotto"
        inert
        inertLabel="È un riflesso: qui il pomello non gira"
        onInert={onInerte}
        onComplete={() => {}}
      />
    </div>
  );
}
