import Link from "next/link";
import { notFound } from "next/navigation";
import {
  componiLivelli,
  componiUtenti,
  indiziDi,
  leggiTutto,
  progressiSu,
  sbagliFrequenti,
  tentativiConNick,
} from "@/lib/admin-dati";
import { Barre, Riquadro, Ritorno, Stato, Tessera, percento, quando, quantoFa } from "../../componenti";

export default async function DettaglioLivello({
  params,
}: {
  params: Promise<{ livello: string }>;
}) {
  const numero = Number((await params).livello);
  if (!Number.isInteger(numero)) notFound();

  const grezzi = await leggiTutto();
  const livello = componiLivelli(grezzi).find((l) => l.livello === numero);
  if (!livello) notFound();

  const utenti = componiUtenti(grezzi);
  const nick = (id: string) => utenti.find((u) => u.id === id)?.nick ?? id.slice(0, 8);
  const indizi = indiziDi(grezzi, numero);
  const progressi = progressiSu(grezzi, numero).sort((a, b) =>
    (a.risolto_il ?? "").localeCompare(b.risolto_il ?? "")
  );
  const tentativi = tentativiConNick(grezzi, (t) => t.livello === numero);
  const sbagli = sbagliFrequenti(grezzi, numero);
  const fermiQui = utenti.filter((u) => u.livelloRaggiunto + 1 === numero);
  const tentativiPerSoluzione = progressi.length
    ? (tentativi.length / progressi.length).toFixed(1)
    : "—";

  return (
    <>
      <Ritorno href="/admin/livelli">tutti i livelli</Ritorno>
      <h1 className="aTitolo">
        Livello {livello.livello} — {livello.titolo}
      </h1>
      <p className="aSottotitolo">
        {livello.scena ? "Livello di scena: si supera con un gesto" : "Enigma con risposta da indovinare"} ·{" "}
        {livello.attivo ? "attivo" : "spento"}
      </p>

      <div className="aTessere">
        <Tessera
          titolo="Lo hanno superato"
          valore={livello.risolutori}
          nota={`${percento(livello.risolutori, utenti.length)} dei giocatori`}
        />
        <Tessera titolo="Fermi proprio qui" valore={fermiQui.length} />
        <Tessera
          titolo="Tentativi"
          valore={livello.tentativi}
          nota={`${percento(livello.tentativiCorretti, livello.tentativi)} andati a segno`}
        />
        <Tessera titolo="Tentativi per soluzione" valore={tentativiPerSoluzione} />
        <Tessera titolo="Indizi chiesti" valore={livello.indiziConsegnati} nota={`${livello.indizi} disponibili`} />
      </div>

      <div className="aColonne">
        <Riquadro titolo="Scheda">
          <dl className="aChiaveValore">
            <dt>Numero</dt>
            <dd>{livello.livello}</dd>
            <dt>Titolo</dt>
            <dd>{livello.titolo}</dd>
            <dt>Tipo</dt>
            <dd>
              {livello.scena ? <Stato tipo="neutro">di scena</Stato> : <Stato tipo="buono">enigma</Stato>}
            </dd>
            <dt>Stato</dt>
            <dd>
              {livello.attivo ? <Stato tipo="buono">attivo</Stato> : <Stato tipo="critico">spento</Stato>}
            </dd>
            <dt>Soluzioni seminate</dt>
            <dd>
              {livello.soluzioni}{" "}
              <span style={{ color: "var(--testo-3)" }}>
                (le soluzioni restano sul server: qui si vede solo quante sono)
              </span>
            </dd>
            <dt>Immagine</dt>
            <dd>{livello.media_path ?? "nessuna"}</dd>
            <dt>Creato</dt>
            <dd>{quando(livello.creato_il)}</dd>
            <dt>Pubblicato</dt>
            <dd>{quando(livello.pubblicato_il)}</dd>
          </dl>
        </Riquadro>

        <Riquadro titolo="Testo dell'enigma">
          {livello.corpo ? (
            <p className="aCitazione">{livello.corpo}</p>
          ) : (
            <p className="aVuoto">Nessun testo: la stanza parla da sola.</p>
          )}
        </Riquadro>
      </div>

      <p className="aSezione">Indizi</p>
      <Riquadro titolo="In ordine di consegna" dida="Il giocatore li riceve uno alla volta, su richiesta.">
        <div className="aScorri">
          <table className="aTabella" style={{ whiteSpace: "normal" }}>
            <thead>
              <tr>
                <th className="aNum" style={{ width: 70 }}>
                  Ordine
                </th>
                <th>Testo</th>
              </tr>
            </thead>
            <tbody>
              {indizi.map((i) => (
                <tr key={i.id}>
                  <td className="aNum forte">{i.ordine}</td>
                  <td className="forte">{i.testo}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {indizi.length === 0 && <p className="aVuoto">Nessun indizio scritto per questo livello.</p>}
        </div>
      </Riquadro>

      {!livello.scena && (
        <>
          <p className="aSezione">Dove si incaglia la gente</p>
          <Riquadro
            titolo="Risposte sbagliate più frequenti"
            dida="Normalizzate come le vede il server. Utile per capire se una risposta legittima va accettata."
          >
            {sbagli.length ? (
              <Barre voci={sbagli.map((s) => ({ nome: s.risposta, valore: s.quante }))} />
            ) : (
              <p className="aVuoto">Nessuna risposta sbagliata registrata.</p>
            )}
          </Riquadro>
        </>
      )}

      <p className="aSezione">Chi lo ha superato</p>
      <Riquadro titolo="In ordine di tempo">
        <div className="aScorri">
          <table className="aTabella">
            <thead>
              <tr>
                <th>Giocatore</th>
                <th>Risolto il</th>
                <th>Quanto fa</th>
                <th className="aNum">Indizi usati</th>
                <th className="aNum">Tentativi spesi</th>
              </tr>
            </thead>
            <tbody>
              {progressi.map((p) => (
                <tr key={p.utente}>
                  <td className="forte">
                    <Link href={`/admin/utenti/${p.utente}`}>{nick(p.utente)}</Link>
                  </td>
                  <td>{quando(p.risolto_il)}</td>
                  <td>{quantoFa(p.risolto_il)}</td>
                  <td className="aNum">{p.indizi_usati}</td>
                  <td className="aNum">{tentativi.filter((t) => t.utente === p.utente).length}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {progressi.length === 0 && <p className="aVuoto">Ancora nessuno.</p>}
        </div>
      </Riquadro>

      <p className="aSezione">Tentativi su questo livello</p>
      <Riquadro titolo="Cronologia">
        <div className="aScorri">
          <table className="aTabella">
            <thead>
              <tr>
                <th>Quando</th>
                <th>Giocatore</th>
                <th>Risposta</th>
                <th>Esito</th>
              </tr>
            </thead>
            <tbody>
              {tentativi.map((t) => (
                <tr key={t.id}>
                  <td title={quantoFa(t.creato_il)}>{quando(t.creato_il)}</td>
                  <td className="forte">
                    <Link href={`/admin/utenti/${t.utente}`}>{t.nick ?? t.utente.slice(0, 8)}</Link>
                  </td>
                  <td className="forte">{t.risposta_norm || <em>(gesto, nessuna risposta)</em>}</td>
                  <td>
                    {t.corretto ? <Stato tipo="buono">giusta</Stato> : <Stato tipo="critico">sbagliata</Stato>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {tentativi.length === 0 && <p className="aVuoto">Nessun tentativo.</p>}
        </div>
      </Riquadro>
    </>
  );
}
