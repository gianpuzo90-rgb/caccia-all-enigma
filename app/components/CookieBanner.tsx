"use client";

import { forwardRef } from "react";

type CookieBannerProps = {
  pulse: boolean;
  pannelloCookie: boolean;
  statistiche: boolean;
  onToggleStatistiche: () => void;
  onTogglePannello: () => void;
  onSalva: (statistiche: boolean) => void;
  onPrivacy: () => void;
};

/* Banner fisso in fondo alla pagina: consenso cookie (GDPR). */

export const CookieBanner = forwardRef<HTMLDivElement, CookieBannerProps>(function CookieBanner(
  { pulse, pannelloCookie, statistiche, onToggleStatistiche, onTogglePannello, onSalva, onPrivacy },
  ref
) {
  return (
    <div ref={ref} className={"cookieBar" + (pulse ? " pulse" : "")} role="dialog" aria-label="Preferenze cookie">
      <p className="cookieText">
        Usiamo cookie tecnici per farti giocare. Solo col tuo consenso raccogliamo statistiche
        anonime su quanti superano ogni livello. Rifiutare non toglie nulla al gioco.{" "}
        <button className="inlineLink light" onClick={onPrivacy}>
          Informativa
        </button>
      </p>

      {pannelloCookie && (
        <div className="cookiePanel">
          <div className="toggleRow dark">
            <span>Necessari (sempre attivi)</span>
            <button className="toggle on locked" disabled aria-label="Necessari, sempre attivi">
              <span className="knob" />
            </button>
          </div>
          <div className="toggleRow dark">
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
          <button className="cookieBtn ghost" onClick={() => onSalva(statistiche)}>
            Salva le scelte
          </button>
        </div>
      )}

      <div className="cookieRow">
        <button className="cookieBtn" onClick={() => onSalva(false)}>
          Rifiuta
        </button>
        <button className="cookieBtn" onClick={() => onSalva(true)}>
          Accetta
        </button>
      </div>
      <button className="inlineLink light" onClick={onTogglePannello}>
        {pannelloCookie ? "Chiudi" : "Personalizza"}
      </button>
    </div>
  );
});
