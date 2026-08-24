"use client";

import { useRef, useState } from "react";
import type { PortalRect } from "./types";

/* Coreografia condivisa dell'apertura a portale: misura la porta,
   mostra l'overlay sopra di lei, scambia il contenuto sotto (nascosto
   dall'overlay), poi apre il battente e fa lo zoom. Verso la fine
   dello zoom avvisa chi di dovere (onOscura) di calare il sipario
   nero: da lì in poi la regia è della shell, che rivela la stanza
   solo quando è tutta pronta. */
export function usePortale() {
  const sceneRef = useRef<HTMLDivElement | null>(null);
  const [portale, setPortale] = useState<PortalRect | null>(null);

  const apri = (scambiaContenuto: () => void, lit = true, onOscura?: () => void) => {
    const el = sceneRef.current;
    if (!el) {
      scambiaContenuto();
      onOscura?.();
      return;
    }
    const r = el.getBoundingClientRect();
    setPortale({ x: r.left, y: r.top, w: r.width, h: r.height, lit, leafOpen: false, zoom: false });
    scambiaContenuto();
    /* Il buio cala subito, sotto il portale: così la porta si apre su
       uno schermo tutto nero (con la rotella se c'è da aspettare) e non
       su brandelli di pagina che spuntano man mano che l'arco cresce. */
    onOscura?.();
    setTimeout(() => setPortale((p) => (p ? { ...p, leafOpen: true } : p)), 40);
    setTimeout(() => setPortale((p) => (p ? { ...p, zoom: true } : p)), 560);
    setTimeout(() => setPortale(null), 1400);
  };

  return { sceneRef, portale, apri };
}
