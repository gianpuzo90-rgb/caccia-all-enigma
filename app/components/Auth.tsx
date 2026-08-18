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
      return onFail("Il nome da Cercatore vuole 3-20 caratteri: lettere, numeri o trattino basso.");
    if (nickStatus === "occupato") return onFail("Quel nome è già di un altro Cercatore.");
    if (nickStatus === "controllo") return onFail("Un istante: sto ancora controllando il nome.");
    if (!EMAIL_RE.test(email)) return onFail("Quell'email non convince il Custode.");
    if (reg.pass.length < 8) return onFail("La parola d'ordine vuole almeno 8 caratteri.");
    if (DEBOLI.includes(reg.pass.toLowerCase()))
      return onFail("Troppo prevedibile: quella la indovinerebbe chiunque.");
    if (reg.pass !== reg.pass2) return onFail("Le due parole d'ordine non coincidono.");
    if (!reg.eta) return onFail("Serve la spunta obbligatoria su età e informativa.");

    setOccupato(true);
    const supabase = supabaseBrowser();
    const { data, error } = await supabase.auth.signUp({
      email,
      password: reg.pass,
      options: { data: { nick, marketing: reg.marketing } },
    });
    setOccupato(false);

    if (error) {
      if (/registered|exists/i.test(error.message)) {
        return onFail("Questa email è già iscritta alla Caccia. Prova a entrare.");
      }
      return onFail(error.message || "Qualcosa è andato storto. Riprova.");
    }

    setReg({ nick: "", email: "", pass: "", pass2: "", eta: false, marketing: false });
    if (data.session) {
      onAuthenticated();
    } else {
      onNota("Controlla la tua email per confermare l'iscrizione, poi entra con le tue credenziali.");
      setModo("entra");
    }
  };

  const entra = async () => {
    onClearError();
    const email = log.email.trim().toLowerCase();
    if (!EMAIL_RE.test(email) || !log.pass) return onFail("Email o parola d'ordine non corrette.");

    setOccupato(true);
    const supabase = supabaseBrowser();
    const { error } = await supabase.auth.signInWithPassword({ email, password: log.pass });
    setOccupato(false);

    if (error) {
      return onFail("Email o parola d'ordine non corrette.");
    }
    setLog({ email: "", pass: "" });
    onAuthenticated();
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
          Entra
        </button>
      </div>

      {modo === "registrati" ? (
        <>
          <p className="riddle">Da qui in poi, la Caccia ricorda chi sei.</p>
          <input
            className="field"
            placeholder="Nome da Cercatore"
            autoComplete="username"
            value={reg.nick}
            onChange={(e) => setReg({ ...reg, nick: e.target.value })}
          />
          {reg.nick && (
            <p className="aside" style={{ marginTop: -8 }}>
              {!NICK_RE.test(reg.nick.trim()) && "3-20 caratteri: lettere, numeri o trattino basso."}
              {NICK_RE.test(reg.nick.trim()) && nickStatus === "controllo" && "Controllo il nome…"}
              {NICK_RE.test(reg.nick.trim()) && nickStatus === "libero" && "Nome disponibile."}
              {NICK_RE.test(reg.nick.trim()) && nickStatus === "occupato" && "Nome già preso."}
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
            placeholder="Parola d'ordine (min. 8 caratteri)"
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
            placeholder="Ripeti la parola d'ordine"
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
            {occupato ? "Un istante…" : "Sigilla il patto"}
          </button>
        </>
      ) : (
        <>
          <p className="riddle">Bentornato, Cercatore.</p>
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
            placeholder="Parola d'ordine"
            autoComplete="current-password"
            value={log.pass}
            onChange={(e) => setLog({ ...log, pass: e.target.value })}
            onKeyDown={(e) => onEnter(e, entra)}
          />
          <button className="btn" onClick={entra} disabled={occupato}>
            {occupato ? "Un istante…" : "Entra"}
          </button>
          <button
            className="linkBtn"
            onClick={() => onNota("Nel sito vero qui parte l'email di recupero: serve il backend.")}
          >
            Parola d&apos;ordine dimenticata?
          </button>
        </>
      )}

      <button className="linkBtn" onClick={onClose}>
        ← torna alla caccia
      </button>
    </>
  );
}
