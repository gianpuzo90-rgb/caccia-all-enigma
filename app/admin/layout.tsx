import Link from "next/link";
import type { ReactNode } from "react";
import { richiediAmministratore } from "@/lib/admin";
import { Navigazione } from "./Navigazione";
import "./admin.css";

export const dynamic = "force-dynamic"; // dati per-utente, mai in cache
export const metadata = { title: "Amministrazione — Caccia all'Enigma" };

export default async function LayoutAdmin({ children }: { children: ReactNode }) {
  // la guardia sta qui: vale per ogni pagina figlia, nessuna esclusa
  const utente = await richiediAmministratore();

  return (
    <div className="pannello">
      <header className="aTesta">
        <div className="aTestaRiga">
          <Link href="/admin" className="aMarchio">
            Caccia all&apos;Enigma <span>· regia</span>
          </Link>
          <Navigazione />
          <Link href="/" className="aFuga">
            {utente.email} · torna al gioco
          </Link>
        </div>
      </header>
      <main className="aCorpo">{children}</main>
    </div>
  );
}
