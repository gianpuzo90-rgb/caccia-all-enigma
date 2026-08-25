import Link from "next/link";
import { notFound } from "next/navigation";
import {
  componiLivelli,
  componiUtenti,
  leggiTutto,
  progressiDi,
  tentativiConNick,
} from "@/lib/admin-dati";
import { Riquadro, Ritorno, Stato, Tessera, percento, quando, quantoFa } from "../../componenti";

/** Quanto è passato fra due soluzioni: dà il ritmo di una partita. */
function intervallo(da: string | null, a: string | null): string {
  if (!da || !a) return "—";
  const ore = (new Date(a).getTime() - new Date(da).getTime()) / 3_600_000;
  if (ore < 1) return `${Math.max(1, Math.round(ore * 60))} min`;
  if (ore < 48) return `${ore.toFixed(1)} ore`;
  return `${Math.round(ore / 24)} giorni`;
}

export default async function DettaglioUtente({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const grezzi = await leggiTutto();
  const utente = componiUtenti(grezzi).find((u) => u.id === id);
  if (!utente) notFound();

  const livelli = componiLivelli(grezzi);
  const titolo = (n: number) => livelli.find((l) => l.livello === n)?.titolo ?? "—";
  const progressi = progressiDi(grezzi, id);
  const tentativi = tentativiConNick(grezzi, (t) => t.utente === id);

  return (
    <>
      <Ritorno href="/admin/utenti">tutti i giocatori</Ritorno>
      <h1 className="aTitolo">
        {utente.nick ?? "(senza nick)"} {utente.admin && "★"}
      </h1>
      <p className="aSottotitolo">{utente.email ?? "email sconosciuta"}</p>

      <div className="aTessere">
        <Tessera titolo="Livello raggiunto" valore={utente.livelloRaggiunto} nota={titolo(utente.livelloRaggiunto)} />
        <Tessera titolo="Enigmi risolti" valore={utente.livelliRisolti} />
        <Tessera
          titolo="Tentativi"
          valore={utente.tentativi}
          nota={`${percento(utente.tentativiCorretti, utente.tentativi)} andati a segno`}
        />
        <Tessera titolo="Indizi usati" valore={utente.indiziUsati} />
        <Tessera titolo="In gioco da" valore={intervallo(utente.creato_il, new Date().toISOString())} />
      </div>

      <div className="aColonne">
        <Riquadro titolo="Anagrafica">
          <dl className="aChiaveValore">
            <dt>Identificativo</dt>
            <dd style={{ fontSize: 12 }}>{utente.id}</dd>
            <dt>Nickname</dt>
            <dd>{utente.nick ?? "—"}</dd>
            <dt>Email</dt>
            <dd>{utente.email ?? "—"}</dd>
            <dt>Email confermata</dt>
            <dd>
              {utente.confermato_il ? (
                <Stato tipo="buono">sì, {quando(utente.confermato_il)}</Stato>
              ) : (
                <Stato tipo="avviso">non ancora</Stato>
              )}
            </dd>
            <dt>Avvisi via email</dt>
            <dd>{utente.avvisi_email ? "accettati" : "rifiutati"}</dd>
            <dt>Amministratore</dt>
            <dd>{utente.admin ? <Stato tipo="buono">sì</Stato> : "no"}</dd>
          </dl>
        </Riquadro>

        <Riquadro titolo="Tempi">
          <dl className="aChiaveValore">
            <dt>Registrato</dt>
            <dd>
              {quando(utente.creato_il)} <span style={{ color: "var(--testo-3)" }}>· {quantoFa(utente.creato_il)}</span>
            </dd>
            <dt>Ultimo accesso</dt>
            <dd>
              {quando(utente.ultimo_accesso)}{" "}
              <span style={{ color: "var(--testo-3)" }}>· {quantoFa(utente.ultimo_accesso)}</span>
            </dd>
            <dt>Primo tentativo</dt>
            <dd>{quando(utente.primoTentativo)}</dd>
            <dt>Ultimo tentativo</dt>
            <dd>
              {quando(utente.ultimoTentativo)}{" "}
              <span style={{ color: "var(--testo-3)" }}>· {quantoFa(utente.ultimoTentativo)}</span>
            </dd>
            <dt>Ultima soluzione</dt>
            <dd>{quando(utente.ultimaSoluzione)}</dd>
            <dt>Dal primo all&apos;ultimo</dt>
            <dd>{intervallo(utente.primoTentativo, utente.ultimoTentativo)}</dd>
          </dl>
        </Riquadro>
      </div>

      <p className="aSezione">Livelli superati</p>
      <Riquadro titolo="Progressi" dida="Scritti solo dal server, in ordine di livello.">
        <div className="aScorri">
          <table className="aTabella">
            <thead>
              <tr>
                <th className="aNum">Livello</th>
                <th>Titolo</th>
                <th>Risolto il</th>
                <th>Dal precedente</th>
                <th className="aNum">Indizi usati</th>
                <th className="aNum">Tentativi spesi</th>
              </tr>
            </thead>
            <tbody>
              {progressi.map((p, i) => (
                <tr key={p.livello}>
                  <td className="aNum forte">
                    <Link href={`/admin/livelli/${p.livello}`}>{p.livello}</Link>
                  </td>
                  <td>
                    <Link href={`/admin/livelli/${p.livello}`}>{titolo(p.livello)}</Link>
                  </td>
                  <td title={quantoFa(p.risolto_il)}>{quando(p.risolto_il)}</td>
                  <td>{i === 0 ? "—" : intervallo(progressi[i - 1].risolto_il, p.risolto_il)}</td>
                  <td className="aNum">{p.indizi_usati}</td>
                  <td className="aNum">{tentativi.filter((t) => t.livello === p.livello).length}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {progressi.length === 0 && (
            <p className="aVuoto">Nessun livello superato: è ancora nell&apos;onboarding.</p>
          )}
        </div>
      </Riquadro>

      <p className="aSezione">Tutti i tentativi</p>
      <Riquadro titolo="Cronologia" dida="Cosa ha scritto, e quando. Le righe vuote sono i livelli di scena.">
        <div className="aScorri">
          <table className="aTabella">
            <thead>
              <tr>
                <th>Quando</th>
                <th className="aNum">Livello</th>
                <th>Risposta</th>
                <th>Esito</th>
              </tr>
            </thead>
            <tbody>
              {tentativi.map((t) => (
                <tr key={t.id}>
                  <td title={quantoFa(t.creato_il)}>{quando(t.creato_il)}</td>
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
          {tentativi.length === 0 && <p className="aVuoto">Non ha ancora provato nulla.</p>}
        </div>
      </Riquadro>
    </>
  );
}
