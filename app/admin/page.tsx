import Link from "next/link";
import {
  componiKpi,
  componiLivelli,
  componiUtenti,
  leggiTutto,
  tentativiConNick,
} from "@/lib/admin-dati";
import { Barre, Colonnine, Riquadro, Stato, Tessera, percento, quando, quantoFa } from "./componenti";

export default async function Quadro() {
  const grezzi = await leggiTutto();
  const utenti = componiUtenti(grezzi);
  const livelli = componiLivelli(grezzi);
  const kpi = componiKpi(grezzi, utenti, livelli);
  const ultimi = tentativiConNick(grezzi).slice(0, 12);

  /* Controlli di coerenza: le cose che di solito si scoprono tardi.
     Un livello di scena con indizi appesi, per esempio, è quasi sempre
     un resto di una vecchia numerazione. */
  const avvisi: { testo: string; dove: string }[] = [];
  for (const l of livelli) {
    if (l.attivo && l.scena && l.indizi > 0)
      avvisi.push({
        testo: `Livello ${l.livello} (${l.titolo}) è di scena ma ha ${l.indizi} indizi appesi: probabile resto di una vecchia numerazione.`,
        dove: `/admin/livelli/${l.livello}`,
      });
    if (l.attivo && !l.scena && l.indizi === 0)
      avvisi.push({
        testo: `Livello ${l.livello} (${l.titolo}) ha una risposta da indovinare ma nessun indizio: chi si incaglia resta fermo lì.`,
        dove: `/admin/livelli/${l.livello}`,
      });
    if (!l.attivo)
      avvisi.push({
        testo: `Livello ${l.livello} (${l.titolo}) non è attivo: il gioco si ferma prima.`,
        dove: `/admin/livelli/${l.livello}`,
      });
  }
  const buchi = [];
  for (let n = 4; n <= kpi.ultimoLivello; n++)
    if (!livelli.some((l) => l.livello === n && l.attivo)) buchi.push(n);
  if (buchi.length)
    avvisi.push({ testo: `Manca un enigma attivo ai livelli ${buchi.join(", ")}.`, dove: "/admin/livelli" });

  return (
    <>
      <h1 className="aTitolo">Quadro generale</h1>
      <p className="aSottotitolo">
        Tutto in ora italiana · aggiornato {quando(new Date().toISOString())}
      </p>

      <div className="aTessere">
        <Tessera
          titolo="Giocatori"
          valore={kpi.utenti}
          nota={`${kpi.utentiConfermati} con email confermata`}
        />
        <Tessera titolo="Nuovi · 7 giorni" valore={kpi.nuovi7g} nota={`${kpi.nuovi30g} negli ultimi 30`} />
        <Tessera titolo="Attivi · 7 giorni" valore={kpi.attivi7g} nota={`${kpi.attivi24h} nelle ultime 24 ore`} />
        <Tessera
          titolo="Oltre l'onboarding"
          valore={kpi.inGioco}
          nota={`${percento(kpi.inGioco, kpi.utenti)} dei registrati`}
        />
        <Tessera
          titolo="In fondo alla caccia"
          valore={kpi.arrivatiInFondo}
          nota={`hanno superato il livello ${kpi.ultimoLivello}`}
        />
        <Tessera
          titolo="Tentativi"
          valore={kpi.tentativi}
          nota={`${percento(kpi.tentativiCorretti, kpi.tentativi)} andati a segno`}
        />
        <Tessera titolo="Indizi consegnati" valore={kpi.indiziConsegnati} />
        <Tessera
          titolo="Enigmi attivi"
          valore={kpi.enigmiAttivi}
          nota={`di cui ${kpi.enigmiDiScena} di scena`}
        />
      </div>

      {avvisi.length > 0 && (
        <Riquadro titolo="Da guardare" dida="Incoerenze fra enigmi, indizi e numerazione.">
          <table className="aTabella" style={{ whiteSpace: "normal" }}>
            <tbody>
              {avvisi.map((a, i) => (
                <tr key={i}>
                  <td style={{ width: 110 }}>
                    <Stato tipo="avviso">da vedere</Stato>
                  </td>
                  <td className="forte">{a.testo}</td>
                  <td style={{ width: 70 }}>
                    <Link href={a.dove}>apri</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Riquadro>
      )}

      <p className="aSezione">Percorso dei giocatori</p>
      <div className="aColonne">
        <Riquadro
          titolo="Quanti arrivano a ogni livello"
          dida="Ogni barra conta i giocatori che hanno raggiunto quel livello o l'hanno superato."
        >
          <Barre
            voci={kpi.perLivello.map((l) => ({
              nome: (
                <Link href={`/admin/livelli/${l.livello}`}>
                  {l.livello}. {l.titolo}
                </Link>
              ),
              valore: l.arrivati,
              etichetta: `${l.arrivati}${l.fermi ? ` · ${l.fermi} fermi` : ""}`,
            }))}
          />
        </Riquadro>

        <Riquadro
          titolo="Tentativi per livello"
          dida="Dove si consuma il fiato: barre più lunghe, più fatica."
        >
          <Barre
            legenda={["andati a segno", "sbagliati"]}
            voci={livelli
              .filter((l) => l.tentativi > 0)
              .map((l) => ({
                nome: (
                  <Link href={`/admin/livelli/${l.livello}`}>
                    {l.livello}. {l.titolo}
                  </Link>
                ),
                valore: l.tentativiCorretti,
                secondo: l.tentativi - l.tentativiCorretti,
                etichetta: `${l.tentativiCorretti}/${l.tentativi}`,
              }))}
          />
          {livelli.every((l) => l.tentativi === 0) && <p className="aVuoto">Nessun tentativo, per ora.</p>}
        </Riquadro>
      </div>

      <p className="aSezione">Ultimi 30 giorni</p>
      <div className="aColonne">
        <Riquadro titolo="Registrazioni al giorno">
          <Colonnine serie={kpi.registrazioni} />
        </Riquadro>
        <Riquadro titolo="Tentativi al giorno">
          <Colonnine serie={kpi.attivita} />
        </Riquadro>
      </div>

      <p className="aSezione">Ultimi tentativi</p>
      <Riquadro titolo="In tempo reale" dida="Le risposte più recenti, di chiunque.">
        <div className="aScorri">
          <table className="aTabella">
            <thead>
              <tr>
                <th>Quando</th>
                <th>Giocatore</th>
                <th>Livello</th>
                <th>Risposta</th>
                <th>Esito</th>
              </tr>
            </thead>
            <tbody>
              {ultimi.map((t) => (
                <tr key={t.id}>
                  <td title={quando(t.creato_il)}>{quantoFa(t.creato_il)}</td>
                  <td className="forte">
                    <Link href={`/admin/utenti/${t.utente}`}>{t.nick ?? t.utente.slice(0, 8)}</Link>
                  </td>
                  <td>
                    <Link href={`/admin/livelli/${t.livello}`}>{t.livello}</Link>
                  </td>
                  <td className="forte">{t.risposta_norm || <em>(gesto, nessuna risposta)</em>}</td>
                  <td>
                    {t.corretto ? (
                      <Stato tipo="buono">giusta</Stato>
                    ) : (
                      <Stato tipo="critico">sbagliata</Stato>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {ultimi.length === 0 && <p className="aVuoto">Ancora nessun tentativo.</p>}
        </div>
      </Riquadro>
    </>
  );
}
