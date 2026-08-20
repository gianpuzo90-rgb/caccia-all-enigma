# Caccia all'Enigma

Gioco di enigmi a livelli in italiano. Ogni enigma risolto sblocca il
successivo, con classifica dei giocatori registrati.

Progetto personale di Gianpaolo, nato dall'esperienza di cacce al tesoro
organizzate dal vivo. Obiettivo: prima costruire il pubblico con il gioco
gratuito, monetizzare dopo (rewarded ads sugli indizi, eventualmente
abbonamento o eventi B2B di team building).

---

## Stato attuale

Fatto:
- Dominio `cacciaallenigma.it` registrato su Aruba (intestatario privato)
- Supabase: progetto `caccia-all-enigma`, regione Francoforte, piano Free
- Schema DB applicato, 5 tabelle, RLS attiva
- Bucket Storage `enigmi`, privato
- Auth email con conferma obbligatoria, password minima 8 caratteri
- Account GitHub (`gianpuzo90-rgb`) e Vercel (piano Hobby) collegati
- API server e script di semina in funzione; enigmi 4 e 5 già seminati

Da fare:
- Integrare il gioco nel progetto Next.js e collegarlo alle API
- Primo push su GitHub e deploy su Vercel
- Collegare il dominio a Vercel
- Vercel Web Analytics (cookieless: non richiede consenso)
- Scrivere gli enigmi dal 6 in poi
- Prima del lancio pubblico: CAPTCHA su Supabase (Cloudflare Turnstile),
  informativa privacy definitiva rivista da un consulente

Rimandato di proposito:
- Email a dominio: serve solo quando ci saranno utenti veri da ricontattare.
  Le email di sistema le manda Supabase.
- Piano Pro Supabase: sbloccherebbe il blocco delle password trapelate.

---

## Architettura

Next.js (App Router) su Vercel + Supabase (Postgres, Auth, Storage).

```
app/
  page.tsx                     il gioco
  api/
    enigma/[livello]/route.ts  serve un enigma, solo se sbloccato
    verifica/route.ts          giudica le risposte
    indizio/route.ts           consegna un indizio alla volta
    classifica/route.ts        top 100
    nick/route.ts              disponibilità nickname
lib/
  enigmi.ts                    normalizzazione risposte + hash
  supabase.ts                  client utente / admin
scripts/
  semina-enigmi.ts             soluzioni in chiaro -> hash nel DB
middleware.ts                  rinfresca la sessione a ogni richiesta
```

Tabelle: `profili`, `enigmi`, `indizi`, `progressi`, `tentativi`.

---

## Le tre regole che non si toccano

**1. Le soluzioni non lasciano mai il server.**
Sono in `enigmi.soluzioni_hash` come SHA-256 con pepper server-side, e il
livello entra nell'hash. `/api/verifica` risponde solo `true`/`false`: mai
un "quasi", mai un suggerimento su quanto ci si è andati vicino. Se il DB
venisse esfiltrato senza `ENIGMI_PEPPER`, gli hash sarebbero inutilizzabili.

**2. Il contenuto di un enigma non sbloccato non si serve.**
`/api/enigma/[livello]` confronta il livello richiesto con i progressi
reali: richiesta di un livello futuro -> 403 con corpo vuoto. Mai `select *`
sulla tabella enigmi: le colonne si elencano a mano, così `soluzioni_hash`
non può finire in una risposta per distrazione.

**3. L'avanzamento lo scrive solo il server.**
`progressi` è in sola lettura anche per il proprietario. Nessuna chiamata
dal browser può dichiarare "ho risolto il livello 9".

Corollari: RLS attiva su tutte le tabelle, e **nessuna policy** su `enigmi`,
`indizi`, `tentativi` (la chiave anon è pubblica per definizione: senza
policy, restituisce zero righe). Rate limit di 10 tentativi al minuto.
Immagini in bucket privato con URL firmate a 5 minuti. Sessioni in cookie
httpOnly. Identità verificata sempre con `getUser()`, mai `getSession()`.

L'unico buco che resta è il passaparola della risposta tra amici: non si
chiude con la tecnica. Si mitiga con soluzioni personalizzate per utente.

---

## Struttura del gioco

I primi tre livelli sono l'onboarding travestito da enigma: la burocrazia
del web diventa gioco. Restano client-side perché non contengono segreti.

- **I — Ingresso**: una porta in stile mistico, nessuna scritta. Si apre
  girando il pomello in senso orario (drag col mouse o col dito). A giro
  completo la porta si spalanca sul buio della stanza successiva e la
  scena zooma attraversandola; la stanza si accende all'arrivo.
- **II — I Biscotti**: stessa porta, pomello a forma di biscotto. È inerte
  finché il giocatore non ha risposto al banner cookie; se lo forza,
  traballa e il banner lampeggia.
- **III — Il Patto**: stessa porta, pomello d'ottone con inciso il simbolo
  del login (lo stesso dell'icona in alto a destra). Inerte finché non sei
  registrato; se lo forzi, l'icona in alto pulsa.
- **IV in poi**: enigmi veri, serviti dal server. Il IV ("Lo
  Scarico") è allagato e si drena tirando la catenella del tappo.
  Il V ("Al Buio") è schermo nero: il pomello è invisibile ma
  funziona al solito posto — la prova è trovarlo a memoria; girandolo
  filtra la luce dall'arco. Non ha risposta: è un *livello di scena*.

  Un livello di scena è semplicemente una riga di `enigmi` **senza
  `soluzioni_hash`**: si supera con il gesto della stanza invece che
  con una risposta. `/api/enigma` lo segnala al client con `scena:
  true`, `/api/verifica` lo accetta con risposta vuota, e l'avanzamento
  resta comunque scritto dal server. Un livello di scena privo di una
  stanza su misura mostra la sola porta da girare: è la forma di un
  livello ancora da scrivere, e diventa un enigma vero nel momento in
  cui gli si seminano le soluzioni, senza toccare il codice. Serve
  quindi la semina **solo** per gli enigmi con una risposta da dare. L'acqua del IV finisce nel VI ("La Pompa"), dove la pompa
  la rimanda su — ma tiene solo se prima si è tornati al IV a
  rimettere il tappo, altrimenti l'acqua cala e ritorna. Rivisitando
  il IV si ritrova la stanza stessa (senza acqua, o riallagata se la
  pompa ha lavorato) col tappo manovrabile: metti e togli, e lo stato
  resta. L'acqua non sparisce mai: o è al IV o è al VI. I due bit
  (tappo inserito, acqua al IV) sono in localStorage sotto
  `cae:idraulica`; quando mancano si deducono dai progressi server,
  quindi il gioco regge al cambio di dispositivo.
- Le scene si presentano senza testi introduttivi: il titolo del
  livello ("Livello 5 — Al Buio") sta **sotto** la carta, come la
  targhetta di un quadro, così resta leggibile anche quando la stanza
  è tutta nera. I numeri di livello sono arabi ovunque, barra compresa.
  La navigazione fra i livelli già raggiunti è libera dalla barra in
  alto. Un livello risolto si può
  anche "ririsolvere" — pomello, catenella, pompa, alle stesse
  condizioni della scena — per riattraversare la porta verso il
  successivo. Dopo ogni passaggio la porta si chiude alle spalle:
  buio pieno e dissolvenza sulla stanza nuova.

Regole di design emerse strada facendo:
- Nessuna istruzione scritta: il gioco si spiega con il comportamento degli
  oggetti. Pomello spento = ti manca qualcosa.
- Il livello II insegna la grammatica, il III la mette alla prova.
- Sistema di indizi progressivi fin da subito: in una catena lineare un
  enigma troppo ostico blocca tutti nello stesso punto.
- Le risposte vanno normalizzate: maiuscole, accenti, spazi e articolo
  iniziale non devono contare.

### Estetica

Notte d'inchiostro (`#12141d`) illuminata da lanterna (`#e8a33d`). Ogni
schermata è una carta di carta invecchiata (`#f2ead8`), leggermente
ruotata. Niente sigillo di ceralacca sull'angolo: è stato rimosso di
proposito, la carta resta pulita (il colore `#a63d2f` sopravvive negli
accenti). Font: IM Fell English per i titoli, Spectral per il testo,
IBM Plex Mono per l'interfaccia.
Niente voce narrante: i testi di servizio sono asciutti e diretti
(il Custode è stato rimosso di proposito, non reintrodurlo). I
caricamenti mostrano una rotellina generica, non frasi d'atmosfera.

---

## Privacy e consenso

Il tema è stato affrontato sul serio, e alcune decisioni sono deliberate.

- **Il banner cookie è vero e separato dal gioco.** "Rifiuta" e "Accetta"
  hanno identico peso visivo (il Garante chiede che rifiutare sia facile
  quanto accettare), nessun toggle pre-attivato, scelta salvata con data e
  versione, revocabile dal footer.
- **Niente cookie wall.** Il pomello-biscotto si sblocca quando il giocatore
  ha *risposto* al banner, accettando o rifiutando. Vincolare il passaggio
  all'accettazione renderebbe il consenso non libero (art. 4 e 7 GDPR,
  linee guida Garante 2021). Questa è una scelta consapevole: non
  reintrodurla per rendere il livello più divertente.
- **Registrazione**: base giuridica contrattuale, quindi niente checkbox di
  consenso per giocare. Serve invece l'informativa privacy (art. 13) e una
  spunta obbligatoria su "ho almeno 14 anni" (soglia italiana per il
  consenso digitale dei minori). Gli avvisi email sono un opt-in separato,
  non pre-spuntato, revocabile dall'area personale.
- **Diritti utente già implementati**: esportazione dati (art. 20) e
  cancellazione account (art. 17, con `on delete cascade` che pulisce tutto).
- **Statistiche**: i dati di gioco (`tentativi`, `progressi`) sono raccolti
  per far funzionare il servizio, nessun consenso richiesto. Analytics
  cookieless (Vercel, Plausible) idem. Google Analytics o pixel pubblicitari
  invece devono stare dietro il toggle "Statistiche" del banner.

---

## Convenzioni

- Tutto in italiano: interfaccia, nomi di tabelle e colonne, commenti.
  I testi dell'interfaccia vanno tenuti separati dal codice, per non
  dover smontare tutto se un giorno servisse l'inglese.
- Niente Tailwind: CSS scritto a mano.
- L'hashing delle password è di Supabase Auth (bcrypt). Non scriverne uno.
- Le soluzioni in chiaro vivono solo in `scripts/semina-enigmi.ts`, sul
  computer di Gianpaolo. Quel file non va committato con soluzioni reali.
- Timestamp in UTC: per le statistiche in ora italiana usare
  `creato_il at time zone 'Europe/Rome'` prima di raggruppare.

## Comandi

```
npm run dev
npx dotenv -e .env.local -- npx tsx scripts/semina-enigmi.ts
```

Variabili in `.env.local` (mai committate, da reinserire a mano su Vercel):
`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
`SUPABASE_SERVICE_ROLE_KEY`, `ENIGMI_PEPPER`.

Cambiare il pepper invalida tutti gli hash esistenti: vanno riseminati.

## Test prima di aprire al pubblico

Con la sessione di un utente fermo al livello 5:

- `GET /api/enigma/6` -> 200 (è il prossimo)
- `GET /api/enigma/7` -> 403, corpo senza testo dell'enigma
- `POST /api/verifica {livello: 9}` -> 403
- 11 POST in un minuto su `/api/verifica` -> l'undicesimo dà 429
- Risposta esatta con maiuscole, accenti, articolo, spazi -> sempre corretta
- Senza cookie di sessione, ogni endpoint -> 401
- Con la sola chiave anon: `select * from enigmi` -> 0 righe
- `grep -ri "soluzion" .next/static/` -> nessun risultato
- URL firmata riusata dopo 6 minuti -> scaduta

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
