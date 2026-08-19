"use client";

type ScaricoProps = {
  tappoInserito: boolean;
  /** L'acqua è tornata qui (pompa del V riuscita): scena ferma, si guarda. */
  allagato: boolean;
  onToggle: () => void;
};

/* Lo scarico del livello IV, rivisitato a enigma risolto: il tappo si
   può sfilare e rimettere cliccandolo. Da com'è messo dipende se la
   pompa del V riesce a svuotare la stanza di sotto. */
export function Scarico({ tappoInserito, allagato, onToggle }: ScaricoProps) {
  const dentro = allagato || tappoInserito;
  return (
    <button
      type="button"
      className={"scarico" + (dentro ? " chiuso" : "") + (allagato ? " allagato" : "")}
      onClick={onToggle}
      disabled={allagato}
      aria-pressed={dentro}
      aria-label={
        allagato
          ? "L'acqua è tornata qui: lo scarico riposa"
          : dentro
            ? "Sfila il tappo dallo scarico"
            : "Rimetti il tappo nello scarico"
      }
    >
      <svg viewBox="0 0 240 110" width="200" height="92" aria-hidden="true">
        {/* pavimento */}
        <line x1="14" y1="84" x2="226" y2="84" stroke="rgba(43,36,24,0.55)" strokeWidth="2.5" strokeLinecap="round" />
        <line x1="30" y1="92" x2="210" y2="92" stroke="rgba(43,36,24,0.22)" strokeWidth="2" strokeLinecap="round" />

        {/* bocca dello scarico con la griglia */}
        <ellipse cx="150" cy="84" rx="24" ry="8" fill="#241b10" />
        <path
          d="M138 84 h24 M141 81 h18 M141 87 h18"
          stroke="rgba(242,234,216,0.28)" strokeWidth="1.4" strokeLinecap="round"
        />

        {/* catenella: segue il tappo */}
        <circle cx="52" cy="7" r="3" fill="none" stroke="#8b96a3" strokeWidth="2" />
        <line
          className="scaricoCatena catFuori"
          x1="52" y1="10" x2="82" y2="64"
          stroke="#8b96a3" strokeWidth="2" strokeDasharray="1 6" strokeLinecap="round"
        />
        <line
          className="scaricoCatena catDentro"
          x1="52" y1="10" x2="148" y2="68"
          stroke="#8b96a3" strokeWidth="2" strokeDasharray="1 6" strokeLinecap="round"
        />

        {/* il tappo */}
        <g
          className="tappoCorpo"
          style={{ transform: dentro ? "translate(150px, 88px)" : "translate(84px, 84px)" }}
        >
          <path d="M-12 -14 h24 l-3 14 h-18 Z" fill="#241b10" />
          <circle cx="0" cy="-17" r="4" fill="none" stroke="#8b96a3" strokeWidth="2" />
        </g>

        {/* l'acqua, se è tornata qui */}
        <g className="scaricoAcqua">
          <path
            d="M0 34 Q 20 26 40 34 T 80 34 T 120 34 T 160 34 T 200 34 T 240 34 V110 H0 Z"
            fill="rgba(94,168,178,0.45)"
          />
          <rect x="0" y="52" width="240" height="58" fill="rgba(37,92,110,0.35)" />
        </g>
      </svg>
    </button>
  );
}
