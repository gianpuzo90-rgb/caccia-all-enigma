import Link from "next/link";
import { componiLivelli, componiUtenti, leggiTutto } from "@/lib/admin-dati";
import { Barre, Riquadro, Stato, Tessera, percento, quando } from "../componenti";

export default async function TabellaLivelli() {
  const grezzi = await leggiTutto();
  const livelli = componiLivelli(grezzi);
  const utenti = componiUtenti(grezzi);

  return (
    <>
      <h1 className="aTitolo">Livelli</h1>
      <p className="aSottotitolo">
        {livelli.length} enigmi in tabella · i livelli 1-3 sono l&apos;onboarding e vivono nel codice
      </p>

      <div className="aTessere">
        <Tessera titolo="Enigmi" valore={livelli.length} nota={`${livelli.filter((l) => l.attivo).length} attivi`} />
        <Tessera
          titolo="Con una risposta"
          valore={livelli.filter((l) => !l.scena).length}
          nota={`${livelli.filter((l) => l.scena).length} di scena`}
        />
        <Tessera titolo="Indizi scritti" valore={livelli.reduce((s, l) => s + l.indizi, 0)} />
        <Tessera titolo="Soluzioni seminate" valore={livelli.reduce((s, l) => s + l.soluzioni, 0)} />
      </div>

      <Riquadro
        titolo="Chi li ha superati"
        dida="Quanti giocatori distinti hanno una riga di progresso su ciascun livello."
      >
        <Barre
          voci={livelli.map((l) => ({
            nome: (
              <Link href={`/admin/livelli/${l.livello}`}>
                {l.livello}. {l.titolo}
              </Link>
            ),
            valore: l.risolutori,
            etichetta: `${l.risolutori} su ${utenti.length}`,
          }))}
        />
      </Riquadro>

      <Riquadro titolo="Elenco">
        <div className="aScorri">
          <table className="aTabella">
            <thead>
              <tr>
                <th className="aNum">N.</th>
                <th>Titolo</th>
                <th>Tipo</th>
                <th>Stato</th>
                <th className="aNum">Soluzioni</th>
                <th className="aNum">Indizi</th>
                <th className="aNum">Risolutori</th>
                <th className="aNum">Tentativi</th>
                <th className="aNum">A segno</th>
                <th className="aNum">Indizi chiesti</th>
                <th>Creato</th>
              </tr>
            </thead>
            <tbody>
              {livelli.map((l) => (
                <tr key={l.livello}>
                  <td className="aNum forte">
                    <Link href={`/admin/livelli/${l.livello}`}>{l.livello}</Link>
                  </td>
                  <td className="forte">
                    <Link href={`/admin/livelli/${l.livello}`}>{l.titolo}</Link>
                  </td>
                  <td>{l.scena ? <Stato tipo="neutro">di scena</Stato> : <Stato tipo="buono">enigma</Stato>}</td>
                  <td>{l.attivo ? <Stato tipo="buono">attivo</Stato> : <Stato tipo="critico">spento</Stato>}</td>
                  <td className="aNum">{l.soluzioni}</td>
                  <td className="aNum">{l.indizi}</td>
                  <td className="aNum">{l.risolutori}</td>
                  <td className="aNum">{l.tentativi}</td>
                  <td className="aNum">{percento(l.tentativiCorretti, l.tentativi)}</td>
                  <td className="aNum">{l.indiziConsegnati}</td>
                  <td>{quando(l.creato_il, false)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {livelli.length === 0 && <p className="aVuoto">Nessun enigma in tabella.</p>}
        </div>
      </Riquadro>
    </>
  );
}
