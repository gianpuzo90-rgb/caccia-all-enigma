"use client";

import { useEffect, useRef, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase-browser";
import { DEBOLI, EMAIL_RE, NICK_RE, forzaPassword } from "./utils";

type AuthProps = {
  onAuthenticated: () => void;
  onPrivacy: () => void;
  onClose: () => void;
  onFail: (msg: string) => void;
  onClearError: () => void;
  onNota: (msg: string) => void;
};

type NickStatus = "idle" | "controllo" | "libero" | "occupato";

export function Auth({ onAuthenticated, onPrivacy, onClose, onFail, onClearError, onNota }: AuthProps) {
  const [modo, setModo] = useState<"registrati" | "entra">("registrati");
  const [reg, setReg] = useState({
    nick: "",
    email: "",
    pass: "",
    pass2: "",
    eta: false,
    marketing: false,
  });
  const [log, setLog] = useState({ email: "", pass: "" });
  const [occupato, setOccupato] = useState(false);
  const [inviandoRecupero, setInviandoRecupero] = useState(false);
  const [nickStatus, setNickStatus] = useState<NickStatus>("idle");

  const nickRequestId = useRef(0);

  /* controllo disponibilità nick mentre l'utente digita.
     Il formato si valuta al render (è puro, deriva da reg.nick): qui
     serve solo l'effetto per la chiamata di rete, debounced. */
  useEffect(() => {
    const nick = reg.nick.trim();
    if (!nick || !NICK_RE.test(nick)) return;
    const id = ++nickRequestId.current;
    const t = setTimeout(async () => {
      setNickStatus("controllo");
      try {
        const res = await fetch(`/api/nick?n=${encodeURIComponent(nick)}`);
        const data = await res.json();
        if (nickRequestId.current !== id) return;
        setNickStatus(data.libero ? "libero" : "occupato");
      } catch {
        if (nickRequestId.current === id) setNickStatus("idle");
      }
    }, 400);
    return () => clearTimeout(t);
  }, [reg.nick]);

  const onEnter = (e: React.KeyboardEvent, fn: () => void) => {
    if (e.key === "Enter") fn();
  };

  const registra = async () => {
    onClearError();
    const nick = reg.nick.trim();
    const email = reg.email.trim().toLowerCase();

    if (!NICK_RE.test(nick))
      return onFail("Lo username deve avere 3-20 caratteri: lettere, numeri o trattino basso.");
    if (nickStatus === "occupato") return onFail("Username non disponibile.");
    if (nickStatus === "controllo") return onFail("Attendi: verifica dello username in corso.");
    if (!EMAIL_RE.test(email)) return onFail("Email non valida.");
    if (reg.pass.length < 8) return onFail("La password deve avere almeno 8 caratteri.");
    if (DEBOLI.includes(reg.pass.toLowerCase()))
      return onFail("Password troppo comune: scegline una più sicura.");
    if (reg.pass !== reg.pass2) return onFail("Le due password non coincidono.");
    if (!reg.eta) return onFail("Conferma l'età e l'informativa per continuare.");

    setOccupato(true);
    const supabase = supabaseBrowser();
    const { data, error } = await supabase.auth.signUp({
      email,
      password: reg.pass,
      options: { data: { nick, marketing: reg.marketing } },
    });
    setOccupato(false);

    if (error) {
      if (error.code === "user_already_exists" || error.code === "email_exists") {
        return onFail("Questa email è già registrata. Prova ad accedere.");
      }
      return onFail(error.message || "Si è verificato un errore. Riprova.");
    }

    // Per non trasformare la registrazione in un oracolo di email esistenti,
    // Supabase non lancia un errore se l'email è già di un account confermato:
    // risponde "successo" ma con identities vuoto. È l'unico modo per
    // accorgersene lato client.
    if (data.user && data.user.identities && data.user.identities.length === 0) {
      return onFail("Questa email è già registrata. Prova ad accedere.");
    }

    setReg({ nick: "", email: "", pass: "", pass2: "", eta: false, marketing: false });
    if (data.session) {
      onAuthenticated();
    } else {
      onNota("Controlla la tua email per confermare la registrazione, poi accedi.");
      setModo("entra");
    }
  };

  const entra = async () => {
    onClearError();
    const email = log.email.trim().toLowerCase();
    if (!EMAIL_RE.test(email) || !log.pass) return onFail("Credenziali non valide.");

    setOccupato(true);
    const supabase = supabaseBrowser();
    const { error } = await supabase.auth.signInWithPassword({ email, password: log.pass });
    setOccupato(false);

    if (error) {
      if (error.code === "email_not_confirmed") {
        return onFail("Devi prima confermare l'email: controlla la posta.");
      }
      return onFail("Credenziali non valide.");
    }
    setLog({ email: "", pass: "" });
    onAuthenticated();
  };

  const recuperaPassword = async () => {
    onClearError();
    const email = log.email.trim().toLowerCase();
    if (!EMAIL_RE.test(email)) return onFail("Inserisci prima la tua email qui sopra.");

    setInviandoRecupero(true);
    const supabase = supabaseBrowser();
    await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reimposta-password`,
    });
    setInviandoRecupero(false);
    // Stesso principio del controllo email in registrazione: il messaggio
    // resta uguale sia che l'email esista sia che no, altrimenti questo
    // stesso pulsante diventerebbe un oracolo di email registrate.
    onNota("Se l'email è registrata, ti abbiamo mandato un link per reimpostare la password.");
  };

  return (
    <>
      <div className="tabs">
        <button
          className={"tab" + (modo === "registrati" ? " on" : "")}
          onClick={() => {
            setModo("registrati");
            onClearError();
          }}
        >
          Registrati
        </button>
        <button
          className={"tab" + (modo === "entra" ? " on" : "")}
          onClick={() => {
            setModo("entra");
            onClearError();
          }}
        >
          Accedi
        </button>
      </div>

      {modo === "registrati" ? (
        <>
          <input
            className="field"
            placeholder="Username"
            autoComplete="username"
            value={reg.nick}
            onChange={(e) => setReg({ ...reg, nick: e.target.value })}
          />
          {reg.nick && (
            <p className="aside" style={{ marginTop: -8 }}>
              {!NICK_RE.test(reg.nick.trim()) && "3-20 caratteri: lettere, numeri o trattino basso."}
              {NICK_RE.test(reg.nick.trim()) && nickStatus === "controllo" && "Verifica in corso…"}
              {NICK_RE.test(reg.nick.trim()) && nickStatus === "libero" && "Username disponibile."}
              {NICK_RE.test(reg.nick.trim()) && nickStatus === "occupato" && "Username non disponibile."}
            </p>
          )}
          <input
            className="field"
            type="email"
            placeholder="Email"
            autoComplete="email"
            value={reg.email}
            onChange={(e) => setReg({ ...reg, email: e.target.value })}
          />
          <input
            className="field"
            type="password"
            placeholder="Password (min. 8 caratteri)"
            autoComplete="new-password"
            value={reg.pass}
            onChange={(e) => setReg({ ...reg, pass: e.target.value })}
          />
          {reg.pass && (
            <div className="meter" aria-hidden="true">
              {[0, 1, 2, 3].map((i) => (
                <span key={i} className={"bar" + (i < forzaPassword(reg.pass) ? " on" : "")} />
              ))}
            </div>
          )}
          <input
            className="field"
            type="password"
            placeholder="Ripeti la password"
            autoComplete="new-password"
            value={reg.pass2}
            onChange={(e) => setReg({ ...reg, pass2: e.target.value })}
            onKeyDown={(e) => onEnter(e, registra)}
          />

          <label className="check">
            <input
              type="checkbox"
              checked={reg.eta}
              onChange={(e) => setReg({ ...reg, eta: e.target.checked })}
            />
            <span>
              Ho almeno 14 anni e ho letto l&apos;
              <button className="inlineLink" onClick={onPrivacy}>
                informativa privacy
              </button>
              . <em>(obbligatorio)</em>
            </span>
          </label>

          <label className="check">
            <input
              type="checkbox"
              checked={reg.marketing}
              onChange={(e) => setReg({ ...reg, marketing: e.target.checked })}
            />
            <span>
              Avvisatemi via email quando escono nuovi enigmi. <em>(facoltativo)</em>
            </span>
          </label>

          <button className="btn" onClick={registra} disabled={occupato}>
            {occupato ? "Un istante…" : "Registrati"}
          </button>
        </>
      ) : (
        <>
          <input
            className="field"
            type="email"
            placeholder="Email"
            autoComplete="email"
            value={log.email}
            onChange={(e) => setLog({ ...log, email: e.target.value })}
          />
          <input
            className="field"
            type="password"
            placeholder="Password"
            autoComplete="current-password"
            value={log.pass}
            onChange={(e) => setLog({ ...log, pass: e.target.value })}
            onKeyDown={(e) => onEnter(e, entra)}
          />
          <button className="btn" onClick={entra} disabled={occupato}>
            {occupato ? "Un istante…" : "Accedi"}
          </button>
          <button className="linkBtn" onClick={recuperaPassword} disabled={inviandoRecupero}>
            {inviandoRecupero ? "Un istante…" : "Password dimenticata?"}
          </button>
        </>
      )}

      <button className="linkBtn" onClick={onClose}>
        ← torna al gioco
      </button>
    </>
  );
}
