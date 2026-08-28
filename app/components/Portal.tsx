"use client";

import { ARCH } from "./utils";
import type { PortalRect } from "./types";

type PortalProps = Pick<PortalRect, "lit" | "leafOpen" | "inclinazione" | "buio"> & {
  rect: PortalRect;
  zoom: boolean;
};

/* ---------- Portale: la porta si apre SULLA pagina successiva ---------- */

export function Portal({ rect, lit, leafOpen, zoom, inclinazione, buio }: PortalProps) {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const sx = rect.w / 240;
  const sy = rect.h / 320;
  const cx = rect.x + rect.w * 0.5;
  const cy = rect.y + rect.h * 0.58;

  return (
    <div
      className={"portal" + (zoom ? " zoomed" : "")}
      style={{ transformOrigin: `${cx}px ${cy}px` }}
      aria-hidden="true"
    >
      <svg
        className="portalSvg"
        width="100%"
        height="100%"
        viewBox={`0 0 ${vw} ${vh}`}
        preserveAspectRatio="none"
      >
        <defs>
          <mask id="pmask">
            <rect x={-vw} y={-vh} width={vw * 3} height={vh * 3} fill="white" />
            <path d={ARCH} transform={`translate(${rect.x} ${rect.y}) scale(${sx} ${sy})`} fill="black" />
          </mask>
          <linearGradient id="pwood" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#4b3a27" />
            <stop offset="50%" stopColor="#5d4732" />
            <stop offset="100%" stopColor="#443322" />
          </linearGradient>
          <radialGradient id="plight" cx="50%" cy="42%" r="62%">
            <stop offset="0%" stopColor="#ffe3a6" />
            <stop offset="55%" stopColor="#e8a33d" stopOpacity="0.55" />
            <stop offset="100%" stopColor="#e8a33d" stopOpacity="0" />
          </radialGradient>
        </defs>

        <rect x={-vw} y={-vh} width={vw * 3} height={vh * 3} fill="#12141d" mask="url(#pmask)" />

        <g transform={`translate(${rect.x} ${rect.y}) scale(${sx} ${sy})`}>
          {lit && <path d={ARCH} fill="url(#plight)" className={"pglow" + (leafOpen ? " off" : "")} />}

          {/* Al Buio non si materializza nessuna porta: il legno è nero
              come tutto il resto, e ad aprirsi si vede solo la luce
              allargarsi nell'arco. Era quello a fare uno strano
              effetto — una porta di legno che spuntava dal niente. */}
          <g className={"leaf" + (leafOpen ? " open" : "")}>
            <path
              d={ARCH}
              fill={buio ? "#07080c" : "url(#pwood)"}
              stroke={buio ? "#07080c" : "#241b10"}
              strokeWidth="3"
            />
            {!buio && (
              <>
                <path d="M97 74 L97 300" stroke="#241b10" strokeWidth="1.5" opacity="0.45" />
                <path d="M143 74 L143 300" stroke="#241b10" strokeWidth="1.5" opacity="0.45" />
                <circle cx="62" cy="132" r="2.6" fill="#241b10" opacity="0.7" />
                <circle cx="178" cy="132" r="2.6" fill="#241b10" opacity="0.7" />
                <circle cx="62" cy="288" r="2.6" fill="#241b10" opacity="0.7" />
                <circle cx="178" cy="288" r="2.6" fill="#241b10" opacity="0.7" />
                <circle cx="168" cy="185" r="9" fill="#1b140c" opacity="0.4" />
                <circle cx="168" cy="185" r="7.5" fill="#a87f42" stroke="#4a3820" strokeWidth="1.5" />
              </>
            )}
          </g>

          {/* La soglia di pietra: al Perno è LEI ad arrivare qui girata
              di tre quarti, attorno a una porta rimasta dritta. */}
          {!buio && (
            <g className="soglia" style={{ transform: `rotate(${inclinazione}deg)` }}>
              <path
                d="M40 302 L40 130 Q40 58 120 58 Q200 58 200 130 L200 302"
                fill="none"
                stroke="#2b2418"
                strokeWidth="9"
                strokeLinecap="round"
                opacity="0.9"
              />
              <path d="M32 302 L208 302" stroke="#2b2418" strokeWidth="9" strokeLinecap="round" opacity="0.9" />
            </g>
          )}
        </g>
      </svg>
    </div>
  );
}
