import { FormEvent, useEffect, useState } from "react";
import { BRAND } from "../constants/marketing";
import { AstralField } from "../components/common/AstralField";
import { Companion } from "../components/common/Companion";
import { MaterialIcon } from "../components/common/MaterialIcon";
import { MicroLabel } from "../components/common/MicroLabel";

export type AuthMode = "login" | "signup" | "forgot";

export function AuthScreen({
  mode,
  onMode,
  onSuccess,
  onBack,
}: {
  mode: AuthMode;
  onMode: (mode: AuthMode) => void;
  onSuccess: () => void;
  onBack: () => void;
}) {
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const [botMessage, setBotMessage] = useState(
    "Any properly formatted sample credentials work. Security theatre, but useful security theatre."
  );

  useEffect(() => {
    setSent(false);
    setError("");
    setBotMessage(
      mode === "forgot"
        ? "Forgotten passwords happen. Usually five seconds after creating them."
        : mode === "signup"
          ? "A sample account for a sample app. Very tidy."
          : "Welcome back. Assuming the password agrees."
    );
  }, [mode]);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget as HTMLFormElement);
    const email = String(form.get("email") || "");
    const password = String(form.get("password") || "");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError("Enter a complete email address, including the part after the dot.");
      setBotMessage("That email is missing a few structural components. I checked twice.");
      return;
    }
    if (mode !== "forgot" && password.length < 6) {
      setError("Use at least 6 characters for this simulated password.");
      setBotMessage("Six characters. A low bar, yet here we are.");
      return;
    }
    if (mode === "login" && password.toLowerCase() === "wrong") {
      setError("That sample password was rejected. Try anything except “wrong”.");
      setBotMessage("You entered “wrong” as the password. Admirably honest, technically ineffective.");
      return;
    }
    setError("");
    if (mode === "forgot") {
      setSent(true);
      setBotMessage("Reset link dispatched to the imaginary inbox. Delivery is spectacularly fast there.");
    } else onSuccess();
  };

  return (
    <main className="auth-page">
      <AstralField />
      <header className="auth-top">
        <button className="wordmark" onClick={onBack}>
          {BRAND}
          <sup>®</sup>
        </button>
        <MicroLabel>SIMULATED AUTHENTICATION</MicroLabel>
      </header>
      <section className="auth-card">
        <button className="app-back" onClick={onBack}>
          <MaterialIcon>arrow_back</MaterialIcon> BACK
        </button>
        <MicroLabel>
          {mode === "login" ? "WELCOME BACK" : mode === "signup" ? "CREATE SAMPLE ACCOUNT" : "RESET ACCESS"}
        </MicroLabel>
        <h1>{mode === "login" ? "Log in." : mode === "signup" ? "Start scanning." : "Forgot your password?"}</h1>
        <p>
          {mode === "forgot"
            ? "Enter any valid email to simulate receiving a reset link."
            : "This prototype accepts any correctly formatted sample credentials."}
        </p>
        {sent ? (
          <div className="auth-sent">
            <MaterialIcon>mark_email_read</MaterialIcon>
            <h2>Check your pretend inbox.</h2>
            <p>A simulated reset link is on its entirely fictional way.</p>
            <button className="button primary" onClick={() => onMode("login")}>
              Return to login
            </button>
          </div>
        ) : (
          <form onSubmit={submit} noValidate>
            {mode === "signup" && (
              <label>
                NAME
                <input name="name" required minLength={2} placeholder="Alex Morgan" />
              </label>
            )}
            <label>
              EMAIL
              <input name="email" required type="email" placeholder="you@example.com" onChange={() => setError("")} />
            </label>
            {mode !== "forgot" && (
              <label>
                PASSWORD
                <input
                  name="password"
                  required
                  type="password"
                  minLength={6}
                  placeholder="At least 6 characters"
                  onChange={() => setError("")}
                />
              </label>
            )}
            {error && (
              <p className="field-error">
                <MaterialIcon>error</MaterialIcon>
                {error}
              </p>
            )}
            <button className="button primary" type="submit">
              {mode === "login" ? "Log in" : mode === "signup" ? "Create sample account" : "Send reset link"}
            </button>
          </form>
        )}
        {!sent && (
          <div className="auth-switch">
            {mode === "login" && (
              <>
                <button onClick={() => onMode("forgot")}>Forgot password?</button>
                <button onClick={() => onMode("signup")}>Create an account</button>
              </>
            )}
            {mode === "signup" && <button onClick={() => onMode("login")}>Already have an account? Log in</button>}
            {mode === "forgot" && <button onClick={() => onMode("login")}>Remembered it? Log in</button>}
          </div>
        )}
        <small>No account is created and no credentials are stored in this prototype.</small>
      </section>
      <Companion message={botMessage} />
    </main>
  );
}
