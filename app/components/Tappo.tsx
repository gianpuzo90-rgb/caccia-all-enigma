"use client";

/* Il tappo dello scarico, con la sua catenella. Lo usano il IV
   appena allagato e il IV rivisitato: è lo stesso oggetto e deve
   avere lo stesso aspetto in tutti e due, o sfilandolo la prima
   volta sembra svanito nel nulla invece che tirato fuori. */

type TappoProps = {
  /** Il tappo è nello scarico (catenella tesa) o è stato sfilato. */
  inserito: boolean;
  /** Assente quando il tappo non si può manovrare (prima volta, a
      gesto già fatto: da lì in poi si guarda e basta). */
  onClick?: () => void;
  etichetta: string;
};

export function Tappo({ inserito, onClick, etichetta }: TappoProps) {
  return (
    <button
      type="button"
      className={"catenella" + (inserito ? "" : " sfilato")}
      onClick={onClick}
      disabled={!onClick}
      aria-label={etichetta}
    >
      {inserito ? (
        <svg viewBox="0 0 40 52" width="26" height="34">
          <line
            x1="20" y1="0" x2="20" y2="38"
            stroke="#8b96a3" strokeWidth="2.4" strokeDasharray="1 6" strokeLinecap="round"
          />
          <rect x="7" y="38" width="26" height="6" rx="3" fill="#241b10" />
        </svg>
      ) : (
        /* fuori dallo scarico: la catenella si affloscia e il tappo si
           corica di lato, appoggiato lì accanto */
        <svg viewBox="0 0 40 52" width="26" height="34">
          <circle cx="20" cy="14" r="5" fill="none" stroke="#8b96a3" strokeWidth="2.4" />
          <path d="M8 30 h24 l-4 16 h-16 Z" fill="#241b10" />
        </svg>
      )}
    </button>
  );
}
