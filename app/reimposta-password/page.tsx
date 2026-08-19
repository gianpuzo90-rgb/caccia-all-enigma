"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabaseBrowser } from "@/lib/supabase-browser";
import { forzaPassword } from "../components/utils";

type Stato = "verificando" | "pronto" | "invalido" | "fatto";

/* Pagina di atterraggio del link "password dimenticata". Supabase, con
   detectSessionInUrl attivo (default lato browser), legge da solo il
   token nell'URL e apre una sessione di recupero: qui si aspetta
   l'evento PASSWORD_RECOVERY prima di mostrare il form, così non si
   accetta una nuova password su una sessione qualunque. */
export default function ReimpostaPassword() {
  const [stato, setStato] = useState<Stato>("verificando");
  const [pass, setPass] = useState("");
  const [pass2, setPass2] = useState("");
  const [errore, setErrore] = useState("");
  const [occupato, setOccupato] = useState(false);

  useEffect(() => {
    const supabase = supabaseBrowser();
    let pronto = false;
    const segnaPronto = () => {
      if (pronto) return;
      pronto = true;
      setStato("pronto");
    };

    // Sul link di recupero l'hash contiene i token direttamente
    // (access_token/refresh_token, non un "code" da scambiare): li
    // leggiamo e apriamo la sessione a mano invece di aspettare il
    // rilevamento automatico, che su questo tipo di link non è
    // affidabile al 100% sull'ordine in cui gira rispetto al mount.
    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    const access_token = hash.get("access_token");
    const refresh_token = hash.get("refresh_token");

    if (access_token && refresh_token && hash.get("type") === "recovery") {
      supabase.auth.setSession({ access_token, refresh_token }).then(({ data, error }) => {
        if (data.session && !error) {
          segnaPronto();
          // Ripulisce l'URL dal token: non deve restare nella cronologia.
          window.history.replaceState(null, "", window.location.pathname);
        }
      });
    } else {
      supabase.auth.getSession().then(({ data }) => {
        if (data.session) segnaPronto();
      });
    }

    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (session && (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN" || event === "TOKEN_REFRESHED")) {
        segnaPronto();
      }
    });

    const scaduto = setTimeout(() => {
      if (!pronto) setStato("invalido");
    }, 5000);
    return () => {
      sub.subscription.unsubscribe();
      clearTimeout(scaduto);
    };
  }, []);

  const salva = async () => {
    setErrore("");
    if (pass.length < 8) return setErrore("La password deve avere almeno 8 caratteri.");
    if (pass !== pass2) return setErrore("Le due password non coincidono.");

    setOccupato(true);
    const { error } = await supabaseBrowser().auth.updateUser({ password: pass });
    setOccupato(false);

    if (error) return setErrore(error.message || "Si è verificato un errore. Riprova.");
    setStato("fatto");
  };

  const onEnter = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") salva();
  };

  return (
    <div className="night">
      <main className="stage">
        <div className="card in">
          <div className="seal">§</div>

          {stato === "verificando" && (
            <>
              <p className="kicker">Reimposta password</p>
              <p className="riddle">Un istante, sto verificando il link…</p>
            </>
          )}

          {stato === "invalido" && (
            <>
              <p className="kicker">Reimposta password</p>
              <p className="riddle">
                Il link non è valido o è scaduto. Torna al gioco e richiedine uno nuovo dalla
                schermata di accesso.
              </p>
              <Link className="btn" href="/" style={{ display: "block", textAlign: "center" }}>
                Torna al gioco
              </Link>
            </>
          )}

          {stato === "pronto" && (
            <>
              <p className="kicker">Reimposta password</p>
              <input
                className="field"
                type="password"
                placeholder="Nuova password (min. 8 caratteri)"
                autoComplete="new-password"
                value={pass}
                onChange={(e) => setPass(e.target.value)}
              />
              {pass && (
                <div className="meter" aria-hidden="true">
                  {[0, 1, 2, 3].map((i) => (
                    <span key={i} className={"bar" + (i < forzaPassword(pass) ? " on" : "")} />
                  ))}
                </div>
              )}
              <input
                className="field"
                type="password"
                placeholder="Ripeti la password"
                autoComplete="new-password"
                value={pass2}
                onChange={(e) => setPass2(e.target.value)}
                onKeyDown={onEnter}
              />
              <button className="btn" onClick={salva} disabled={occupato}>
                {occupato ? "Un istante…" : "Salva la nuova password"}
              </button>
              {errore && <p className="error">{errore}</p>}
            </>
          )}

          {stato === "fatto" && (
            <>
              <p className="kicker">Fatto</p>
              <p className="riddle">Password aggiornata. Ora puoi accedere.</p>
              <Link className="btn" href="/" style={{ display: "block", textAlign: "center" }}>
                Torna al gioco
              </Link>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
