"use client";

import { useState } from "react";
import { supabaseBrowser } from "@/lib/supabase-browser";
import type { Sessione } from "./types";

type AccountProps = {
  sessione: Sessione;
  livelloOnboarding: number;
  onClose: () => void;
  onSignedOut: () => void;
};

export function Account({ sessione, livelloOnboarding, onClose, onSignedOut }: AccountProps) {
  const [aggiornando, setAggiornando] = useState(false);

  const esci = async () => {
    await supabaseBrowser().auth.signOut();
    onSignedOut();
  };

  const cambiaMarketing = async (val: boolean) => {
    setAggiornando(true);
    await supabaseBrowser().auth.updateUser({ data: { marketing: val } });
    setAggiornando(false);
  };

  return (
    <>
      <p className="kicker">Il tuo patto</p>
      <p className="riddle">
        Sei <strong>{sessione.nick}</strong>.
      </p>
      <div className="fineprint">
        <p>Email: {sessione.email}</p>
        <p>Ingresso completato: livello {Math.min(livelloOnboarding, 3)} di 3.</p>
        <p>Parola d&apos;ordine: gestita da Supabase Auth, mai in chiaro.</p>
      </div>

      <div className="toggleRow">
        <span>Avvisi email sui nuovi enigmi</span>
        <button
          className={"toggle" + (sessione.marketing ? " on" : "")}
          aria-pressed={sessione.marketing}
          aria-label="Avvisi email sui nuovi enigmi"
          disabled={aggiornando}
          onClick={() => cambiaMarketing(!sessione.marketing)}
        >
          <span className="knob" />
        </button>
      </div>

      <button className="btnGhost" onClick={esci}>
        Esci
      </button>

      <button className="linkBtn" onClick={onClose}>
        ← torna alla caccia
      </button>
    </>
  );
}
