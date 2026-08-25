import Link from "next/link";
import { componiLivelli, leggiTutto, tentativiConNick } from "@/lib/admin-dati";
import { Riquadro, Stato, Tessera, percento, quando, quantoFa } from "../componenti";

type Filtri = { q?: string; livello?: string; esito?: string; pagina?: string };

const PER_PAGINA = 100;

export default async function RegistroTentativi({
  searchParams,
}: {
  searchParams: Promise<Filtri>;
}) {
  const filtri = await searchParams;
  const grezzi = await leggiTutto();
  const livelli = componiLivelli(grezzi);

  let tentativi = tentativiConNick(grezzi);
  const totale = tentativi.length;

  const q = (filtri.q ?? "").trim().toLowerCase();
  if (q)
    tentativi = tentativi.filter((t) =>
      [t.risposta_norm, t.nick, t.utente].some((c) => (c ?? "").toLowerCase().includes(q))
    );
  const livello = Number(filtri.livello);
  if (Number.isFinite(livello) && livello > 0) tentativi = tentativi.filter((t) => t.livello === livello);
  if (filtri.esito === "giuste") tentativi = tentativi.filter((t) => t.corretto);
  if (filtri.esito === "sbagliate") tentativi = tentativi.filter((t) => !t.corretto);

  const filtrato = tentativi.length !== totale;
  const pagina = Math.max(1, Number(filtri.pagina) || 1);
  const pagine = Math.max(1, Math.ceil(tentativi.length / PER_PAGINA));
  const fetta = tentativi.slice((pagina - 1) * PER_PAGINA, pagina * PER_PAGINA);
  const query = (p: number) =>
    `/admin/tentativi?${new URLSearchParams({
      ...(filtri.q ? { q: filtri.q } : {}),
      ...(filtri.livello ? { livello: filtri.livello } : {}),
      ...(filtri.esito ? { esito: filtri.esito } : {}),
      pagina: String(p),
    })}`;

  return (
    <>
      <h1 className="aTitolo">Tentativi</h1>
      <p className="aSottotitolo">
        Ogni risposta consegnata, giusta o sbagliata · {filtrato ? `${tentativi.length} su ${totale}` : `${totale} in tutto`}
      </p>

      <form className="aFiltri" method="get">
        <input
          className="aCampo"
          type="search"
          name="q"
          placeholder="Risposta o giocatore"
          defaultValue={filtri.q ?? ""}
        />
        <select className="aScelta" name="livello" defaultValue={filtri.livello ?? ""}>
          <option value="">Tutti i livelli</option>
          {livelli.map((l) => (
            <option key={l.livello} value={l.livello}>
              {l.livello}. {l.titolo}
            </option>
          ))}
        </select>
        <select className="aScelta" name="esito" defaultValue={filtri.esito ?? ""}>
          <option value="">Qualsiasi esito</option>
          <option value="giuste">Solo giuste</option>
          <option value="sbagliate">Solo sbagliate</option>
        </select>
        <button className="aInvia" type="submit">
          Filtra
        </button>
        {filtrato && (
          <Link className="aAzzera" href="/admin/tentativi">
            azzera
          </Link>
        )}
      </form>

      <div className="aTessere">
        <Tessera titolo="Mostrati" valore={tentativi.length} />
        <Tessera
          titolo="Andati a segno"
          valore={tentativi.filter((t) => t.corretto).length}
          nota={percento(tentativi.filter((t) => t.corretto).length, tentativi.length)}
        />
        <Tessera titolo="Giocatori coinvolti" valore={new Set(tentativi.map((t) => t.utente)).size} />
        <Tessera titolo="Livelli toccati" valore={new Set(tentativi.map((t) => t.livello)).size} />
      </div>

      <Riquadro titolo="Registro" dida="Dal più recente. Le risposte sono normalizzate come le vede il server.">
        <div className="aScorri">
          <table className="aTabella">
            <thead>
              <tr>
                <th>Quando</th>
                <th>Quanto fa</th>
                <th>Giocatore</th>
                <th className="aNum">Livello</th>
                <th>Risposta</th>
                <th>Esito</th>
              </tr>
            </thead>
            <tbody>
              {fetta.map((t) => (
                <tr key={t.id}>
                  <td>{quando(t.creato_il)}</td>
                  <td>{quantoFa(t.creato_il)}</td>
                  <td className="forte">
                    <Link href={`/admin/utenti/${t.utente}`}>{t.nick ?? t.utente.slice(0, 8)}</Link>
                  </td>
                  <td className="aNum">
                    <Link href={`/admin/livelli/${t.livello}`}>{t.livello}</Link>
                  </td>
                  <td className="forte">{t.risposta_norm || <em>(gesto, nessuna risposta)</em>}</td>
                  <td>
                    {t.corretto ? <Stato tipo="buono">giusta</Stato> : <Stato tipo="critico">sbagliata</Stato>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {fetta.length === 0 && <p className="aVuoto">Nessun tentativo con questi filtri.</p>}
        </div>

        {pagine > 1 && (
          <p className="aFiltri" style={{ marginTop: 16, marginBottom: 0 }}>
            {pagina > 1 && (
              <Link className="aAzzera" href={query(pagina - 1)}>
                ← precedenti
              </Link>
            )}
            <span style={{ color: "var(--testo-3)", fontSize: 12 }}>
              pagina {pagina} di {pagine}
            </span>
            {pagina < pagine && (
              <Link className="aAzzera" href={query(pagina + 1)}>
                successivi →
              </Link>
            )}
          </p>
        )}
      </Riquadro>
    </>
  );
}
