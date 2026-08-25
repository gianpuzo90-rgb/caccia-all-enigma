import Link from "next/link";
import type { ReactNode } from "react";

/* ------------------------------ formati ------------------------------ */

/** Data e ora in italiano, sempre nel fuso di casa. */
export function quando(iso: string | null | undefined, conOra = true): string {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("it-IT", {
    timeZone: "Europe/Rome",
    dateStyle: "medium",
    ...(conOra ? { timeStyle: "short" as const } : {}),
  }).format(new Date(iso));
}

/** "3 giorni fa", per capire a colpo d'occhio se è roba fresca. */
export function quantoFa(iso: string | null | undefined): string {
  if (!iso) return "mai";
  const minuti = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (minuti < 1) return "adesso";
  if (minuti < 60) return `${minuti} min fa`;
  const ore = Math.round(minuti / 60);
  if (ore < 24) return `${ore} ${ore === 1 ? "ora" : "ore"} fa`;
  const giorni = Math.round(ore / 24);
  if (giorni < 30) return `${giorni} ${giorni === 1 ? "giorno" : "giorni"} fa`;
  const mesi = Math.round(giorni / 30);
  return `${mesi} ${mesi === 1 ? "mese" : "mesi"} fa`;
}

export const percento = (parte: number, totale: number) =>
  totale === 0 ? "—" : `${Math.round((parte / totale) * 100)}%`;

/* ------------------------------ tessere ------------------------------ */

export function Tessera({
  titolo,
  valore,
  nota,
}: {
  titolo: string;
  valore: ReactNode;
  nota?: ReactNode;
}) {
  return (
    <div className="aTessera">
      <dl>
        <dt>{titolo}</dt>
        <dd>{valore}</dd>
      </dl>
      {nota ? <p className="aNota">{nota}</p> : null}
    </div>
  );
}

/* ------------------------------ grafici ------------------------------ */

export type VoceBarra = {
  nome: ReactNode;
  valore: number;
  /** secondo segmento, per le barre composte (es. tentativi sbagliati) */
  secondo?: number;
  etichetta?: string;
};

/**
 * Barre orizzontali. Una serie sola non ha legenda: il titolo del
 * riquadro la nomina. Con due segmenti la legenda è obbligatoria, e i
 * numeri sono scritti accanto: il colore non porta mai da solo il senso.
 */
export function Barre({
  voci,
  legenda,
}: {
  voci: VoceBarra[];
  legenda?: [string, string];
}) {
  const massimo = Math.max(1, ...voci.map((v) => v.valore + (v.secondo ?? 0)));
  return (
    <>
      {legenda && (
        <p className="aLegenda">
          <span>
            <b style={{ background: "var(--serie-1)" }} />
            {legenda[0]}
          </span>
          <span>
            <b style={{ background: "var(--serie-2)" }} />
            {legenda[1]}
          </span>
        </p>
      )}
      <div className="aBarre">
        {voci.map((v, i) => {
          const totale = v.valore + (v.secondo ?? 0);
          return (
            <div className="aBarra" key={i}>
              <span className="aBarraNome">{v.nome}</span>
              {v.secondo === undefined ? (
                <span className="aBarraPista">
                  <span
                    className="aBarraPieno"
                    style={{ width: `${Math.max(2, (v.valore / massimo) * 100)}%` }}
                  />
                </span>
              ) : (
                <span className="aImpilata" style={{ width: `${Math.max(3, (totale / massimo) * 100)}%` }}>
                  {v.valore > 0 && (
                    <i className="aSegmento1" style={{ width: `${(v.valore / totale) * 100}%` }} />
                  )}
                  {v.secondo > 0 && (
                    <i className="aSegmento2" style={{ width: `${(v.secondo / totale) * 100}%` }} />
                  )}
                </span>
              )}
              <span className="aBarraValore">{v.etichetta ?? v.valore}</span>
            </div>
          );
        })}
      </div>
    </>
  );
}

/** Colonne per giorno: una serie sola, quindi niente legenda. */
export function Colonnine({ serie }: { serie: { giorno: string; quanti: number }[] }) {
  const massimo = Math.max(1, ...serie.map((s) => s.quanti));
  const giorno = (g: string) => g.slice(8, 10) + "/" + g.slice(5, 7);
  return (
    <>
      <div className="aColonnine">
        {serie.map((s) => (
          <span
            key={s.giorno}
            className={"aColonnina" + (s.quanti === 0 ? " vuota" : "")}
            style={{ height: `${s.quanti === 0 ? 3 : Math.max(6, (s.quanti / massimo) * 100)}%` }}
            title={`${giorno(s.giorno)}: ${s.quanti}`}
          />
        ))}
      </div>
      <p className="aAsse">
        <span>{giorno(serie[0]?.giorno ?? "")}</span>
        <span>massimo in un giorno: {massimo}</span>
        <span>{giorno(serie[serie.length - 1]?.giorno ?? "")}</span>
      </p>
    </>
  );
}

/* ------------------------------ etichette ------------------------------ */

export function Stato({
  tipo,
  children,
}: {
  tipo: "buono" | "critico" | "avviso" | "neutro";
  children: ReactNode;
}) {
  const segno = { buono: "●", critico: "▲", avviso: "◆", neutro: "○" }[tipo];
  return (
    <span className={`aStato ${tipo}`}>
      <span aria-hidden="true">{segno}</span>
      {children}
    </span>
  );
}

export function Ritorno({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link className="aRitorno" href={href}>
      ← {children}
    </Link>
  );
}

export function Riquadro({
  titolo,
  dida,
  children,
}: {
  titolo: string;
  dida?: string;
  children: ReactNode;
}) {
  return (
    <section className="aRiquadro">
      <h2>{titolo}</h2>
      {dida ? <p className="aDida">{dida}</p> : null}
      {children}
    </section>
  );
}
