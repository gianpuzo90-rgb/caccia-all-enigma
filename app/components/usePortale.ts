"use client";

import { useRef, useState } from "react";
import type { PortalRect } from "./types";

/* Coreografia condivisa dell'apertura a portale: misura la porta,
   mostra l'overlay sopra di lei, scambia il contenuto sotto (nascosto
   dall'overlay), poi apre il battente e fa lo zoom. La usano sia i
   livelli 1-3 (in page.tsx) sia i passaggi fra un enigma e il
   successivo (in EnigmaLevel). */
export function usePortale() {
  const sceneRef = useRef<HTMLDivElement | null>(null);
  const [portale, setPortale] = useState<PortalRect | null>(null);

  const apri = (scambiaContenuto: () => void, lit = true) => {
    const el = sceneRef.current;
    if (!el) {
      scambiaContenuto();
      return;
    }
    const r = el.getBoundingClientRect();
    setPortale({ x: r.left, y: r.top, w: r.width, h: r.height, lit, leafOpen: false, zoom: false });
    scambiaContenuto();
    setTimeout(() => setPortale((p) => (p ? { ...p, leafOpen: true } : p)), 80);
    setTimeout(() => setPortale((p) => (p ? { ...p, zoom: true } : p)), 850);
    setTimeout(() => setPortale(null), 2300);
  };

  return { sceneRef, portale, apri };
}
