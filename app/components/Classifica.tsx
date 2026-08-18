"use client";

import { useEffect, useState } from "react";
import type { RigaClassifica } from "./types";

export function Classifica({ mioNick }: { mioNick?: string }) {
  const [righe, setRighe] = useState<RigaClassifica[] | null>(null);
  const [errore, setErrore] = useState(false);

  useEffect(() => {
    let vivo = true;
    fetch("/api/classifica")
      .then((r) => r.json())
      .then((data) => {
        if (vivo) setRighe(Array.isArray(data.righe) ? data.righe : []);
      })
      .catch(() => {
        if (vivo) setErrore(true);
      });
    return () => {
      vivo = false;
    };
  }, []);

  return (
    <div className="board">
      <p className="boardTitle">La Classifica dei Cercatori</p>
      {errore && <p className="aside">La classifica non è disponibile in questo momento.</p>}
      {!errore && righe === null && <p className="aside">Carico la classifica…</p>}
      {!errore && righe && righe.length === 0 && <p className="aside">Nessun Cercatore in classifica, ancora.</p>}
      {righe?.map((r, i) => (
        <div key={`${r.nick}-${i}`} className={"boardRow" + (r.nick === mioNick ? " me" : "")}>
          <span className="boardPos">{i + 1}</span>
          <span className="boardName">
            {r.nick}
            {r.nick === mioNick ? " — sei tu" : ""}
          </span>
          <span className="boardLvl">liv. {r.livello}</span>
        </div>
      ))}
    </div>
  );
}
