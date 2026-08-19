"use client";

import { useState } from "react";
import { EyeGlyph, EyeOffGlyph } from "./icons";

type CampoPasswordProps = {
  placeholder: string;
  autoComplete: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
};

/* Campo password con occhietto per mostrare/nascondere il testo.
   Ogni campo ha la sua visibilità indipendente dagli altri. */
export function CampoPassword({ placeholder, autoComplete, value, onChange, onKeyDown }: CampoPasswordProps) {
  const [visibile, setVisibile] = useState(false);

  return (
    <div className="fieldPass">
      <input
        className="field"
        type={visibile ? "text" : "password"}
        placeholder={placeholder}
        autoComplete={autoComplete}
        value={value}
        onChange={onChange}
        onKeyDown={onKeyDown}
      />
      <button
        type="button"
        className="fieldPassToggle"
        aria-label={visibile ? "Nascondi la password" : "Mostra la password"}
        onClick={() => setVisibile((v) => !v)}
      >
        {visibile ? <EyeOffGlyph /> : <EyeGlyph />}
      </button>
    </div>
  );
}
