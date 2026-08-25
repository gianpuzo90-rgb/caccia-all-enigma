"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const VOCI = [
  { href: "/admin", testo: "Quadro" },
  { href: "/admin/utenti", testo: "Utenti" },
  { href: "/admin/livelli", testo: "Livelli" },
  { href: "/admin/tentativi", testo: "Tentativi" },
];

export function Navigazione() {
  const percorso = usePathname();
  return (
    <nav className="aNav">
      {VOCI.map((v) => {
        const attivo = v.href === "/admin" ? percorso === "/admin" : percorso.startsWith(v.href);
        return (
          <Link key={v.href} href={v.href} className={attivo ? "attivo" : undefined}>
            {v.testo}
          </Link>
        );
      })}
    </nav>
  );
}
