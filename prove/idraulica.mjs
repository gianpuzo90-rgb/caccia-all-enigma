/**
 * Prova della catena idraulica: livelli IV, V, VI.
 *
 * Lo stato del tappo del IV è il meccanismo che risolve il VI, quindi
 * i due livelli non si possono provare separatamente: o è coerente
 * tutta la catena, o il gioco è rotto in un modo che non si vede a
 * occhio. Questa prova la percorre per intero, dal primo allagamento
 * al ritorno dell'acqua, e controlla anche che il ricaricamento non
 * perda nulla.
 *
 * Il server è finto: le risposte delle API sono simulate qui dentro,
 * così la prova non tocca il database e si può lanciare sempre.
 *
 * Come si lancia:
 *   1. npm run dev            (in un terminale, sulla porta 3000)
 *   2. npm i -D playwright && npx playwright install chromium
 *   3. node prove/idraulica.mjs
 *
 * Con un'altra porta:  INDIRIZZO=http://localhost:3270 node prove/idraulica.mjs
 */

import { chromium } from "playwright";

const INDIRIZZO = process.env.INDIRIZZO ?? "http://localhost:3000";

const TITOLI = { 4: "Lo Scarico", 5: "Al Buio", 6: "La Pompa", 7: "Lo Specchio", 8: "La Soglia" };
let frontiera = 4;                               // il server finge di ricordare
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
    localStorage.setItem('cae:progresso', JSON.stringify({ level: 4 }));
    localStorage.setItem('cae:consenso', JSON.stringify({ necessari: true, statistiche: false, ts: Date.now(), versione: 1 }));
  });
  await page.route('**/api/progresso', (r) => r.fulfill({ status: 200, contentType: 'application/json',
    body: JSON.stringify({ corrente: frontiera, ultimo: 8, enigma: liv(frontiera) }) }));
  await page.route('**/api/enigma/**', (r) => r.fulfill({ status: 200, contentType: 'application/json',
    body: JSON.stringify(liv(Number(r.request().url().split('/').pop()))) }));
  await page.route('**/api/verifica', async (r) => {
    const { livello } = JSON.parse(r.request().postData() || "{}");
    if (livello >= frontiera) frontiera = livello + 1;
    r.fulfill({ status: 200, contentType: 'application/json',
      body: JSON.stringify({ corretto: true, prossimo: livello + 1 }) });
  });

  const dove = () => page.locator('.didascalia').textContent().catch(() => '?');
  const stato = async () => JSON.parse(await page.evaluate(() => localStorage.getItem('cae:idraulica')) || 'null');
  const acquaPiena = async () => {
    const c = await page.locator('.acqua').evaluate(el => getComputedStyle(el).clipPath).catch(() => 'assente');
    return c.includes('inset(0px') || c === 'none';
  };
  /* Non basta guardare la classe "inert": si prova a girarlo davvero e
     si controlla di non essere finiti da nessuna parte. */
  const nonGira = async () => {
    const prima = await dove();
    const k = page.locator('.doorKnob'); await k.focus();
    for (let i = 0; i < 14; i++) { await page.keyboard.press('ArrowRight'); await page.waitForTimeout(20); }
    await page.waitForTimeout(1800);
    return (await dove()) === prima;
  };
  const gira = async () => { const k = page.locator('.doorKnob'); await k.focus();
    for (let i = 0; i < 12; i++) { await page.keyboard.press('ArrowRight'); await page.waitForTimeout(22); }
    await page.waitForTimeout(3400); };
  const vaiAl = async (n) => { await page.locator('.progress .step', { hasText: String(n) }).first().click(); await page.waitForTimeout(2200); };

  await page.goto(INDIRIZZO, { waitUntil: 'domcontentloaded', timeout: 90000 });
  await page.waitForTimeout(2600);

  console.log("1. IL IV, MAI VISTO — dev'essere allagato e da risolvere");
  verifica("sono al", await dove(), "Livello 4 — Lo Scarico");
  verifica("acqua piena", await acquaPiena(), true);
  verifica("pomello bloccato", (await page.locator('.doorKnob.inert').count()) === 1, true);
  verifica("girandolo NON si passa", await nonGira(), true);

  console.log("2. TIRO LA CATENELLA — l'acqua se ne va di sotto");
  await page.locator('.catenella').click();
  await page.waitForTimeout(2300);
  verifica("stato salvato", JSON.stringify(await stato()), JSON.stringify({ tappoInserito: false, acquaAlQuarto: false }));
  verifica("pomello ora libero", (await page.locator('.doorKnob.inert').count()) === 0, true);

  console.log("3. GIRO IL POMELLO — passo al V, poi lo supero");
  await gira();
  verifica("sono al", await dove(), "Livello 5 — Al Buio");
  await gira();
  verifica("sono al", await dove(), "Livello 6 — La Pompa");

  console.log("4. IL VI: l'acqua è arrivata qui, e il tappo di sopra è FUORI");
  verifica("acqua piena", await acquaPiena(), true);
  verifica("pomello bloccato", (await page.locator('.doorKnob.inert').count()) === 1, true);
  verifica("girandolo NON si passa", await nonGira(), true);

  console.log("5. POMPO COL TAPPO FUORI — deve essere fatica sprecata");
  await page.locator('.pompaLeva').click();
  await page.waitForTimeout(2600);
  verifica("acqua ancora lì", await acquaPiena(), true);
  verifica("pomello ancora bloccato", (await page.locator('.doorKnob.inert').count()) === 1, true);
  verifica("girandolo NON si passa", await nonGira(), true);
  verifica("stato invariato", JSON.stringify(await stato()), JSON.stringify({ tappoInserito: false, acquaAlQuarto: false }));

  console.log("6. TORNO AL IV E RIMETTO IL TAPPO");
  await vaiAl(4);
  verifica("sono al", await dove(), "Livello 4 — Lo Scarico");
  verifica("acqua nella stanza", await acquaPiena(), false);
  await page.locator('.catenella').click();
  await page.waitForTimeout(700);
  verifica("tappo rimesso", JSON.stringify(await stato()), JSON.stringify({ tappoInserito: true, acquaAlQuarto: false }));

  console.log("7. TORNO AL VI E POMPO — adesso deve funzionare");
  await vaiAl(6);
  verifica("acqua piena all'arrivo", await acquaPiena(), true);
  await page.locator('.pompaLeva').click();
  await page.waitForTimeout(2600);
  verifica("acqua nella stanza", await acquaPiena(), false);
  verifica("acqua risalita al IV", JSON.stringify(await stato()), JSON.stringify({ tappoInserito: true, acquaAlQuarto: true }));
  verifica("pomello sbloccato", (await page.locator('.doorKnob.inert').count()) === 0, true);

  console.log("8. GIRO E PASSO AL VII");
  await gira();
  verifica("sono al", await dove(), "Livello 7 — Lo Specchio");

  console.log("9. TORNO AL IV — l'acqua dev'essere risalita davvero");
  await vaiAl(4);
  verifica("stanza riallagata", await acquaPiena(), true);

  verifica("pomello di nuovo bloccato", (await page.locator('.doorKnob.inert').count()) === 1, true);
  verifica("girandolo NON si passa", await nonGira(), true);

  console.log("10. DRENO DI NUOVO — con l'acqua via il pomello deve tornare girabile");
  await page.locator('.catenella').click();
  await page.waitForTimeout(1400);
  verifica("acqua nella stanza", await acquaPiena(), false);
  verifica("pomello libero", (await page.locator('.doorKnob.inert').count()) === 0, true);
  verifica("acqua di nuovo giù", JSON.stringify(await stato()), JSON.stringify({ tappoInserito: false, acquaAlQuarto: false }));
  await gira();
  verifica("girandolo si passa al V", await dove(), "Livello 5 — Al Buio");

  console.log("11. RICARICO LA PAGINA — lo stato non si perde");
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2800);
  await vaiAl(4);
  verifica("stato conservato", JSON.stringify(await stato()), JSON.stringify({ tappoInserito: false, acquaAlQuarto: false }));
  verifica("acqua nella stanza", await acquaPiena(), false);
  verifica("pomello ancora libero", (await page.locator('.doorKnob.inert').count()) === 0, true);

  console.log(`\n=== ${passati} verifiche passate, ${falliti} fallite ===`);
  await browser.close();
  process.exit(falliti ? 1 : 0);
})().catch(e => { console.error('ROTTO:', e.message.split('\n')[0]); process.exit(1); });
