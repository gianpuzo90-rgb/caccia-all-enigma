"use client";

import { useRef, useState, type RefObject } from "react";
import { ARCH } from "./utils";

type DoorVariant = "ottone" | "biscotto" | "serratura";

type DoorProps = {
  onComplete: () => void;
  sceneRef: RefObject<HTMLDivElement | null>;
  variant?: DoorVariant;
  inert?: boolean;
  onInert?: () => void;
  inertLabel?: string;
};

/* --------- Porta: pomello girevole, bloccato o attivo --------- */

export function Door({
  onComplete,
  sceneRef,
  variant = "ottone",
  inert = false,
  onInert,
  inertLabel = "Pomello bloccato",
}: DoorProps) {
  const TARGET = 270;
  const knobRef = useRef<HTMLDivElement | null>(null);
  const angleRef = useRef(0);
  const dragRef = useRef({ active: false, last: 0 });
  const doneRef = useRef(false);
  const [angle, setAngle] = useState(0);
  const [stuck, setStuck] = useState(false);

  const pointerAngle = (e: React.PointerEvent) => {
    const r = knobRef.current!.getBoundingClientRect();
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    return (Math.atan2(e.clientY - cy, e.clientX - cx) * 180) / Math.PI;
  };

  const apply = (delta: number) => {
    if (doneRef.current) return;
    angleRef.current = Math.max(0, Math.min(TARGET, angleRef.current + delta));
    setAngle(angleRef.current);
    if (angleRef.current >= TARGET) {
      doneRef.current = true;
      onComplete?.();
    }
  };

  const onDown = (e: React.PointerEvent) => {
    if (doneRef.current) return;
    if (inert) {
      setStuck(true);
      onInert?.();
      return;
    }
    knobRef.current!.setPointerCapture(e.pointerId);
    dragRef.current = { active: true, last: pointerAngle(e) };
  };

  const onMove = (e: React.PointerEvent) => {
    if (!dragRef.current.active || doneRef.current) return;
    const a = pointerAngle(e);
    let d = a - dragRef.current.last;
    if (d > 180) d -= 360;
    if (d < -180) d += 360;
    dragRef.current.last = a;
    apply(d);
  };

  const stop = () => {
    dragRef.current.active = false;
  };

  const progress = angle / TARGET;

  return (
    <div className="doorScene" ref={sceneRef}>
      <svg className="doorSvg" viewBox="0 0 240 320" aria-hidden="true">
        <defs>
          <radialGradient id="doorlight" cx="50%" cy="42%" r="62%">
            <stop offset="0%" stopColor="#ffe3a6" />
            <stop offset="55%" stopColor="#e8a33d" stopOpacity="0.55" />
            <stop offset="100%" stopColor="#e8a33d" stopOpacity="0" />
          </radialGradient>
          <linearGradient id="wood" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#4b3a27" />
            <stop offset="50%" stopColor="#5d4732" />
            <stop offset="100%" stopColor="#443322" />
          </linearGradient>
        </defs>

        <path d={ARCH} fill="url(#doorlight)" opacity={progress} />

        <g className="leaf">
          <path d={ARCH} fill="url(#wood)" stroke="#241b10" strokeWidth="3" />
          <path d="M97 74 L97 300" stroke="#241b10" strokeWidth="1.5" opacity="0.45" />
          <path d="M143 74 L143 300" stroke="#241b10" strokeWidth="1.5" opacity="0.45" />
          <circle cx="62" cy="132" r="2.6" fill="#241b10" opacity="0.7" />
          <circle cx="178" cy="132" r="2.6" fill="#241b10" opacity="0.7" />
          <circle cx="62" cy="288" r="2.6" fill="#241b10" opacity="0.7" />
          <circle cx="178" cy="288" r="2.6" fill="#241b10" opacity="0.7" />
        </g>

        <path
          d="M40 302 L40 130 Q40 58 120 58 Q200 58 200 130 L200 302"
          fill="none"
          stroke="#2b2418"
          strokeWidth="9"
          strokeLinecap="round"
          opacity="0.9"
        />
        <path d="M32 302 L208 302" stroke="#2b2418" strokeWidth="9" strokeLinecap="round" opacity="0.9" />
      </svg>

      <div
        ref={knobRef}
        className={"doorKnob" + (inert ? " inert" : "") + (stuck ? " stuck" : "")}
        role="button"
        aria-label={inert ? inertLabel : "Gira il pomello in senso orario"}
        aria-disabled={inert}
        tabIndex={0}
        style={{ transform: `translate(-50%, -50%) rotate(${angle}deg)` }}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={stop}
        onPointerCancel={stop}
        onAnimationEnd={() => setStuck(false)}
        onKeyDown={(e) => {
          if (e.key === "ArrowRight" || e.key === "ArrowUp") {
            e.preventDefault();
            if (inert) {
              setStuck(true);
              onInert?.();
            } else apply(24);
          }
        }}
      >
        {variant === "biscotto" ? (
          <svg viewBox="0 0 68 68" width="36" height="36">
            <defs>
              <radialGradient id="pasta" cx="36%" cy="28%" r="82%">
                <stop offset="0%" stopColor="#e7ba7c" />
                <stop offset="58%" stopColor="#c99154" />
                <stop offset="100%" stopColor="#95632f" />
              </radialGradient>
            </defs>
            <circle cx="34" cy="34" r="27" fill="#1b140c" opacity="0.4" />
            <path
              d="M34 10 C44 10 52 15 56 23 C60 31 58 42 51 49 C44 57 32 59 24 55
                 C15 51 10 42 11 33 C12 22 22 10 34 10 Z"
              fill="url(#pasta)"
              stroke="#7d5227"
              strokeWidth="1.6"
            />
            <circle cx="26" cy="23" r="4.3" fill="#432612" />
            <circle cx="44" cy="29" r="3.5" fill="#432612" />
            <circle cx="30" cy="41" r="3.9" fill="#432612" />
            <circle cx="45" cy="45" r="2.9" fill="#432612" />
            <circle cx="20" cy="34" r="2.5" fill="#432612" />
            <circle cx="36" cy="31" r="1.9" fill="#5b3418" opacity="0.7" />
            <circle cx="38" cy="52" r="1.6" fill="#5b3418" opacity="0.55" />
          </svg>
        ) : variant === "serratura" ? (
          <svg viewBox="0 0 68 68" width="34" height="34">
            <defs>
              <radialGradient id="brassLock" cx="38%" cy="32%" r="78%">
                <stop offset="0%" stopColor="#dcbc7c" />
                <stop offset="55%" stopColor="#a87f42" />
                <stop offset="100%" stopColor="#6b4f26" />
              </radialGradient>
            </defs>
            <circle cx="34" cy="34" r="27" fill="#1b140c" opacity="0.4" />
            <circle cx="34" cy="34" r="23" fill="url(#brassLock)" stroke="#4a3820" strokeWidth="2" />
            <g
              transform="translate(34 34) scale(1.55) translate(-12 -12)"
              fill="none"
              stroke="#150f08"
              strokeWidth="1.8"
              strokeLinecap="round"
            >
              <circle cx="12" cy="8.5" r="3.6" />
              <path d="M4.5 20.5 C4.5 15.5 8 13.8 12 13.8 C16 13.8 19.5 15.5 19.5 20.5" />
            </g>
          </svg>
        ) : (
          <svg viewBox="0 0 68 68" width="34" height="34">
            <defs>
              <radialGradient id="brass" cx="38%" cy="32%" r="78%">
                <stop offset="0%" stopColor="#dcbc7c" />
                <stop offset="55%" stopColor="#a87f42" />
                <stop offset="100%" stopColor="#6b4f26" />
              </radialGradient>
            </defs>
            <circle cx="34" cy="34" r="27" fill="#1b140c" opacity="0.4" />
            <circle cx="34" cy="34" r="23" fill="url(#brass)" stroke="#4a3820" strokeWidth="2" />
          </svg>
        )}
      </div>
    </div>
  );
}
