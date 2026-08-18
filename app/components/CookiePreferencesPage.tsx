"use client";

import type { Consenso } from "./types";

type CookiePreferencesPageProps = {
  consenso: Consenso | null;
  statistiche: boolean;
  onToggleStatistiche: () => void;
  onSalva: (statistiche: boolean) => void;
  onRevoca: () => void;
  onClose: () => void;
};

export function CookiePreferencesPage({
  consenso,
  statistiche,
  onToggleStatistiche,
  onSalva,
  onRevoca,
  onClose,
}: CookiePreferencesPageProps) {
  return (
    <>
      <p className="kicker">Preferenze cookie</p>
      <div className="legal">
        <h3>Cookie necessari</h3>
        <p>
          Servono a tenerti collegato e a ricordare i progressi. Senza, il gioco non funziona: per
          questi la legge non chiede consenso.
        </p>
        <h3>Statistiche</h3>
        <p>
          Numeri anonimi su quanti arrivano a quale livello. Facoltativi: puoi rifiutarli e giocare
          lo stesso.
        </p>
      </div>

      <div className="toggleRow">
        <span>Necessari (sempre attivi)</span>
        <button className="toggle on locked" disabled aria-label="Necessari, sempre attivi">
          <span className="knob" />
        </button>
      </div>
      <div className="toggleRow">
        <span>Statistiche</span>
        <button
          className={"toggle" + (statistiche ? " on" : "")}
          aria-pressed={statistiche}
          aria-label="Statistiche"
          onClick={onToggleStatistiche}
        >
          <span className="knob" />
        </button>
      </div>

      <button className="btn" onClick={() => onSalva(statistiche)}>
        Salva le preferenze
      </button>
      <button className="btnGhost" onClick={onRevoca}>
        Revoca ogni consenso
      </button>
      {consenso && (
        <p className="disclaimer">
          Ultima scelta registrata il{" "}
          {new Date(consenso.ts).toLocaleDateString("it-IT", {
            day: "numeric",
            month: "long",
            year: "numeric",
          })}
          .
        </p>
      )}
      <button className="linkBtn" onClick={onClose}>
        ← torna alla caccia
      </button>
    </>
  );
}
