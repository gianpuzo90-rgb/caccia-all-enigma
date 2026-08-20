"use client";

import { useRef, useState } from "react";
import type { PortalRect } from "./types";

/* Coreografia condivisa dell'apertura a portale: misura la porta,
   mostra l'overlay sopra di lei, scambia il contenuto sotto (nascosto
   dall'overlay), poi apre il battente e fa lo zoom. In coda un velo
   nero che si dissolve: la porta che si chiude alle spalle. La usano
   sia i livelli 1-3 (in page.tsx) sia i passaggi fra un enigma e il
   successivo (in EnigmaLevel). */
export function usePortale() {
  const sceneRef = useRef<HTMLDivElement | null>(null);
  const [portale, setPortale] = useState<PortalRect | null>(null);
  const [velo, setVelo] = useState(false);

  const apri = (scambiaContenuto: () => void, lit = true) => {
    const el = sceneRef.current;
    if (!el) {
      scambiaContenuto();
      return;
    }
    const r = el.getBoundingClientRect();
    setPortale({ x: r.left, y: r.top, w: r.width, h: r.height, lit, leafOpen: false, zoom: false });
    scambiaContenuto();
    setTimeout(() => setPortale((p) => (p ? { ...p, leafOpen: true } : p)), 60);
    setTimeout(() => setPortale((p) => (p ? { ...p, zoom: true } : p)), 500);
    setTimeout(() => setVelo(true), 1250);
    setTimeout(() => setPortale(null), 1400);
    setTimeout(() => setVelo(false), 1950);
  };

  return { sceneRef, portale, velo, apri };
}
