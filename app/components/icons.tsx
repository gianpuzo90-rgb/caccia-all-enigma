export function UserGlyph({ size = 22 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="8.5" r="3.6" />
      <path d="M4.5 20.5 C4.5 15.5 8 13.8 12 13.8 C16 13.8 19.5 15.5 19.5 20.5" />
    </svg>
  );
}
