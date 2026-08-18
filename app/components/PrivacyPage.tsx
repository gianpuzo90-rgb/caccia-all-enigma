"use client";

export function PrivacyPage({ onClose }: { onClose: () => void }) {
  return (
    <>
      <p className="kicker">Informativa privacy</p>
      <div className="legal">
        <p className="legalNote">
          Bozza da completare con i tuoi dati reali prima della pubblicazione.
        </p>
        <h3>Titolare del trattamento</h3>
        <p>[Nome e cognome / ragione sociale], [indirizzo], contattabile a [email].</p>
        <h3>Quali dati raccogliamo</h3>
        <p>
          Nome da Cercatore, email, parola d&apos;ordine (gestita da Supabase Auth, mai leggibile),
          data di iscrizione e progresso nel gioco.
        </p>
        <h3>Perché</h3>
        <p>
          Per farti giocare, salvare i progressi e mostrare la classifica: la base giuridica è
          l&apos;esecuzione del servizio che hai richiesto (art. 6.1.b GDPR). Gli avvisi email sui nuovi
          enigmi partono solo col tuo consenso facoltativo (art. 6.1.a), revocabile in ogni momento
          dalla tua area personale.
        </p>
        <h3>Per quanto tempo</h3>
        <p>
          Finché tieni l&apos;account. Se lo cancelli, i dati vengono eliminati; l&apos;account resta inattivo
          e viene rimosso dopo [24] mesi senza accessi.
        </p>
        <h3>A chi vengono comunicati</h3>
        <p>
          Solo ai fornitori tecnici necessari (hosting [provider], autenticazione e database
          Supabase, invio email [provider]), nominati responsabili del trattamento. Nessuna vendita
          a terzi.
        </p>
        <h3>I tuoi diritti</h3>
        <p>
          Accesso, rettifica, cancellazione, limitazione, portabilità e opposizione (artt. 15-22
          GDPR). Scrivi a [email]. Puoi reclamare al Garante per la protezione dei dati personali.
        </p>
        <h3>Età minima</h3>
        <p>
          Il servizio è riservato a chi ha almeno 14 anni, soglia fissata in Italia per il consenso
          digitale dei minori.
        </p>
      </div>
      <button className="linkBtn" onClick={onClose}>
        ← torna alla caccia
      </button>
    </>
  );
}
