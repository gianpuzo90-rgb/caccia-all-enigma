import Link from "next/link";
import { componiUtenti, giorniFa, leggiTutto } from "@/lib/admin-dati";
import { Riquadro, Stato, Tessera, percento, quando, quantoFa } from "../componenti";

type Filtri = { q?: string; livello?: string; stato?: string; ordine?: string };

const ORDINI: Record<string, { testo: string; chiave: (u: ReturnType<typeof componiUtenti>[0]) => number | string }> = {
  recenti: { testo: "Registrazione (nuovi prima)", chiave: (u) => u.creato_il ?? "" },
  attivita: { testo: "Ultima attività", chiave: (u) => u.ultimoTentativo ?? "" },
  livello: { testo: "Livello raggiunto", chiave: (u) => u.livelloRaggiunto },
  tentativi: { testo: "Numero di tentativi", chiave: (u) => u.tentativi },
};

export default async function TabellaUtenti({
  searchParams,
}: {
  searchParams: Promise<Filtri>;
}) {
  const filtri = await searchParams;
  const grezzi = await leggiTutto();
  let utenti = componiUtenti(grezzi);
  const totale = utenti.length;

  const q = (filtri.q ?? "").trim().toLowerCase();
  if (q) {
    utenti = utenti.filter((u) =>
      [u.nick, u.email, u.id].some((c) => (c ?? "").toLowerCase().includes(q))
    );
  }
  const livelloMin = Number(filtri.livello);
  if (Number.isFinite(livelloMin) && livelloMin > 0) {
    utenti = utenti.filter((u) => u.livelloRaggiunto >= livelloMin);
  }
  const settegiorni = giorniFa(7);
  if (filtri.stato === "confermati") utenti = utenti.filter((u) => u.confermato_il);
  if (filtri.stato === "nonconfermati") utenti = utenti.filter((u) => !u.confermato_il);
  if (filtri.stato === "attivi") utenti = utenti.filter((u) => (u.ultimoTentativo ?? "") > settegiorni);
  if (filtri.stato === "dormienti") utenti = utenti.filter((u) => (u.ultimoTentativo ?? "") <= settegiorni);

  const ordine = ORDINI[filtri.ordine ?? "recenti"] ? (filtri.ordine ?? "recenti") : "recenti";
  const chiave = ORDINI[ordine].chiave;
  utenti = [...utenti].sort((a, b) => {
    const x = chiave(a);
    const y = chiave(b);
    return typeof x === "number" ? (y as number) - x : String(y).localeCompare(String(x));
  });

  const filtrato = utenti.length !== totale;

  return (
    <>
      <h1 className="aTitolo">Giocatori</h1>
      <p className="aSottotitolo">
        {filtrato ? `${utenti.length} su ${totale}` : `${totale} in tutto`} · clicca una riga per il dettaglio
      </p>

      <form className="aFiltri" method="get">
        <input
          className="aCampo"
          type="search"
          name="q"
          placeholder="Nickname, email o identificativo"
          defaultValue={filtri.q ?? ""}
        />
        <select className="aScelta" name="livello" defaultValue={filtri.livello ?? ""}>
          <option value="">Qualsiasi livello</option>
          {[3, 4, 5, 6, 7, 8].map((n) => (
            <option key={n} value={n}>
              Almeno il livello {n}
            </option>
          ))}
        </select>
        <select className="aScelta" name="stato" defaultValue={filtri.stato ?? ""}>
          <option value="">Chiunque</option>
          <option value="confermati">Email confermata</option>
          <option value="nonconfermati">Email da confermare</option>
          <option value="attivi">Attivi negli ultimi 7 giorni</option>
          <option value="dormienti">Fermi da più di 7 giorni</option>
        </select>
        <select className="aScelta" name="ordine" defaultValue={ordine}>
          {Object.entries(ORDINI).map(([k, v]) => (
            <option key={k} value={k}>
              {v.testo}
            </option>
          ))}
        </select>
        <button className="aInvia" type="submit">
          Filtra
        </button>
        {filtrato && (
          <Link className="aAzzera" href="/admin/utenti">
            azzera
          </Link>
        )}
      </form>

      <div className="aTessere">
        <Tessera titolo="Mostrati" valore={utenti.length} />
        <Tessera
          titolo="Livello medio"
          valore={
            utenti.length
              ? (utenti.reduce((s, u) => s + u.livelloRaggiunto, 0) / utenti.length).toFixed(1)
              : "—"
          }
        />
        <Tessera titolo="Tentativi in totale" valore={utenti.reduce((s, u) => s + u.tentativi, 0)} />
        <Tessera titolo="Indizi usati" valore={utenti.reduce((s, u) => s + u.indiziUsati, 0)} />
      </div>

      <Riquadro titolo="Elenco">
        <div className="aScorri">
          <table className="aTabella">
            <thead>
              <tr>
                <th>Nickname</th>
                <th>Email</th>
                <th>Stato</th>
                <th className="aNum">Livello</th>
                <th className="aNum">Risolti</th>
                <th className="aNum">Tentativi</th>
                <th className="aNum">A segno</th>
                <th className="aNum">Indizi</th>
                <th>Registrato</th>
                <th>Ultimo accesso</th>
                <th>Ultima mossa</th>
              </tr>
            </thead>
            <tbody>
              {utenti.map((u) => (
                <tr key={u.id}>
                  <td className="forte">
                    <Link href={`/admin/utenti/${u.id}`}>{u.nick ?? "(senza nick)"}</Link>
                    {u.admin && " ★"}
                  </td>
                  <td>{u.email ?? "—"}</td>
                  <td>
                    {u.confermato_il ? (
                      <Stato tipo="buono">confermata</Stato>
                    ) : (
                      <Stato tipo="avviso">da confermare</Stato>
                    )}
                  </td>
                  <td className="aNum forte">{u.livelloRaggiunto}</td>
                  <td className="aNum">{u.livelliRisolti}</td>
                  <td className="aNum">{u.tentativi}</td>
                  <td className="aNum">{percento(u.tentativiCorretti, u.tentativi)}</td>
                  <td className="aNum">{u.indiziUsati}</td>
                  <td title={quando(u.creato_il)}>{quantoFa(u.creato_il)}</td>
                  <td title={quando(u.ultimo_accesso)}>{quantoFa(u.ultimo_accesso)}</td>
                  <td title={quando(u.ultimoTentativo)}>{quantoFa(u.ultimoTentativo)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {utenti.length === 0 && <p className="aVuoto">Nessun giocatore con questi filtri.</p>}
        </div>
      </Riquadro>
    </>
  );
}
