/**
 * Prova del Perno (livello VIII).
 *
 * Qui non gira il pomello e non gira la porta: gira la SOGLIA di
 * pietra, attorno a un'anta che resta ferma. Il livello sta in piedi
 * su due fatti che leggendo il codice non si vedono — la pietra si
 * prende solo sulla pietra, e non la si prende nel raggio di un palmo
 * dal pomello, o sarebbe un pomello come tutti gli altri. Si vedono
 * solo facendo i gesti veri e guardando dove si finisce. È
 * esattamente quello che fa questa prova.
 *
 * Il server è finto: le API sono simulate qui dentro, così la prova
 * non tocca il database e si può lanciare sempre.
 *
 * Come si lancia:
 *   1. npm run dev            (in un terminale, sulla porta 3000)
 *   2. npm i -D playwright && npx playwright install chromium
 *   3. node prove/perno.mjs
 *
 * Con un'altra porta:  INDIRIZZO=http://localhost:3270 node prove/perno.mjs
 */

import { chromium } from "playwright";

const INDIRIZZO = process.env.INDIRIZZO ?? "http://localhost:3000";
const TITOLI = { 8: "Il Perno", 9: "?" };
let frontiera = 8;
const liv = (l) => ({ livello: l, titolo: TITOLI[l] ?? "?", corpo: "", media: null,
  indizi_totali: 0, indizi_usati: 0, risolto: l < frontiera, scena: true });

let passati = 0, falliti = 0;
function verifica(cosa, reale, atteso) {
  const ok = JSON.stringify(reale) === JSON.stringify(atteso);
  console.log(`   ${ok ? "OK  " : "NO  "} ${cosa}: ${reale}${ok ? "" : `  (atteso ${atteso})`}`);
  if (ok) passati++;
  else falliti++;
}

(async () => {
  const browser = await chromium.launch({ ...(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {}) });
  const ctx = await browser.newContext({ viewport: { width: 390, height: 800 }, locale: 'it-IT' });
  const page = await ctx.newPage();
  await page.addInitScript(() => {
    localStorage.setItem('cae:progresso', JSON.stringify({ level: 8 }));
    localStorage.setItem('cae:consenso', JSON.stringify({ necessari: true, statistiche: false, ts: Date.now(), versione: 1 }));
  });
  await page.route('**/api/progresso', (r) => r.fulfill({ status: 200, contentType: 'application/json',
    body: JSON.stringify({ corrente: frontiera, ultimo: 9, enigma: liv(frontiera) }) }));
  await page.route('**/api/enigma/**', (r) => r.fulfill({ status: 200, contentType: 'application/json',
    body: JSON.stringify(liv(Number(r.request().url().split('/').pop()))) }));
  await page.route('**/api/verifica', (r) => {
    const { livello } = JSON.parse(r.request().postData() || "{}");
    if (livello >= frontiera) frontiera = livello + 1;
    r.fulfill({ status: 200, contentType: 'application/json',
      body: JSON.stringify({ corretto: true, prossimo: livello + 1 }) });
  });

  const dove = () => page.locator('.didascalia').textContent().catch(() => '?');
  /* Il centro attorno a cui gira l'anta: metà larghezza, 57.8% di
     altezza — lo stesso punto che usa il codice. */
  const centro = async () => {
    const r = await page.locator('.doorScene').boundingBox();
    return { cx: r.x + r.width / 2, cy: r.y + r.height * 0.578, r: r.width };
  };
  const pomello = async () => {
    const b = await page.locator('.doorKnob').boundingBox();
    return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
  };
  /* Quanto è girata la soglia adesso, letta dal DOM: serve a
     distinguere "non si è mosso niente" da "si è mosso ma non è
     bastato". */
  const giroSoglia = () =>
    page.locator('.doorScene.perno .soglia').evaluate((el) => {
      const m = new DOMMatrix(getComputedStyle(el).transform);
      return Math.round((Math.atan2(m.b, m.a) * 180) / Math.PI);
    }).catch(() => 999);

  await page.goto(INDIRIZZO, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3000);

  console.log("\n1. LA STANZA DEL PERNO");
  verifica("sono al", await dove(), "Livello 8 — Il Perno");
  verifica("c'è la soglia girevole", await page.locator('.doorScene.perno .soglia').count(), 1);
  verifica("la soglia è dritta", await giroSoglia(), 0);

  /* Spazza in un arco largo attorno al centro del vano, partendo da un
     punto qualunque: è il gesto giusto, e serve sia per farlo dove va
     fatto sia per provarlo dove NON deve funzionare. */
  const spazza = async (da, gradi) => {
    const c = await centro();
    const raggio = Math.hypot(da.x - c.cx, da.y - c.cy);
    const inizio = (Math.atan2(da.y - c.cy, da.x - c.cx) * 180) / Math.PI;
    await page.mouse.move(da.x, da.y);
    await page.mouse.down();
    for (let g = 0; g <= gradi; g += 5) {
      const a = ((inizio + g) * Math.PI) / 180;
      await page.mouse.move(c.cx + Math.cos(a) * raggio, c.cy + Math.sin(a) * raggio);
    }
    await page.mouse.up();
    await page.waitForTimeout(1200);
  };

  console.log("2. IL GESTO ABITUALE — mulinello stretto sul pomello");
  /* Quello che funziona in tutti gli altri livelli: si prende il
     pomello e gli si gira attorno. Qui il pomello è saldato e non
     comanda niente. */
  const mulinello = async (giri) => {
    const p = await pomello();
    await page.mouse.move(p.x + 14, p.y);
    await page.mouse.down();
    for (let g = 0; g <= 360 * giri; g += 12) {
      const a = (g * Math.PI) / 180;
      await page.mouse.move(p.x + Math.cos(a) * 14, p.y + Math.sin(a) * 14);
    }
    await page.mouse.up();
    await page.waitForTimeout(900);
  };
  await mulinello(3);
  verifica("NON si è passati di là", await dove(), "Livello 8 — Il Perno");
  verifica("la soglia non si è mossa", await giroSoglia(), 0);

  console.log("3. E INSISTENDO? — il gesto sbagliato non deve arrivarci mai");
  for (let i = 0; i < 6; i++) await mulinello(4);
  verifica("dopo 27 giri di mulinello, ancora al", await dove(), "Livello 8 — Il Perno");
  verifica("la soglia è ancora dritta", await giroSoglia(), 0);

  console.log("4. L'ARCO LARGO MA PARTENDO DAL POMELLO — è la scorciatoia");
  /* Il gesto giusto fatto partire dal punto sbagliato: se la pietra si
     lasciasse prendere anche lì, basterebbe appoggiare il dito dove lo
     si appoggia in tutti gli altri livelli e il resto verrebbe da sé.
     Il livello diventerebbe un pomello con più strada da fare. */
  await spazza(await pomello(), 285);
  verifica("dal pomello NON si gira niente", await giroSoglia(), 0);
  verifica("e non si passa", await dove(), "Livello 8 — Il Perno");

  console.log("5. IL GESTO GIUSTO — la pietra presa per la pietra");
  {
    /* Lo stipite di sinistra: pietra vera, e lontana dal pomello. */
    const b = await page.locator('.doorScene.perno').boundingBox();
    await spazza({ x: b.x + b.width * 0.167, y: b.y + b.height * 0.72 }, 285);
    await page.waitForTimeout(2600);
  }
  verifica("si è passati al IX", await dove(), "Livello 9 — ?");

  console.log(`\n=== ${passati} verifiche passate, ${falliti} fallite ===`);
  await browser.close();
  process.exit(falliti ? 1 : 0);
})().catch((e) => { console.error("ROTTO:", e.message); process.exit(1); });
