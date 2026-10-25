import { FormEvent, useEffect, useState } from "react";
import { companionEvents } from "../lib/companion/events";
import { BRAND } from "../constants/marketing";
import { Companion } from "../components/common/Companion";
import { MaterialIcon } from "../components/common/MaterialIcon";
import { MicroLabel } from "../components/common/MicroLabel";
import { supabase } from "../lib/supabase";

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
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [botMessage, setBotMessage] = useState(
    "Welcome to LeakLens. Authenticate to manage your apps and scans."
  );

  useEffect(() => {
    setSent(false);
    setError("");
    companionEvents.emit("route_changed", { route: "auth", screen: mode });
    setBotMessage(
      mode === "forgot"
        ? "Enter your email and we will send a password reset link."
        : mode === "signup"
          ? "Create an account to start scanning your deployed apps."
          : "Welcome back. Log in to view your scan reports."
    );
  }, [mode]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget as HTMLFormElement);
    const name = String(form.get("name") || "").trim();
    const email = String(form.get("email") || "").trim();
    const password = String(form.get("password") || "");

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      const err = "Enter a valid email address.";
      setError(err);
      setBotMessage("Please check the email format.");
      companionEvents.emit("error_shown", { message: err, context: "auth_email" });
      return;
    }
    if (mode !== "forgot" && password.length < 6) {
      const err = "Password must be at least 6 characters.";
      setError(err);
      setBotMessage("Use at least 6 characters for security.");
      companionEvents.emit("error_shown", { message: err, context: "auth_password" });
      return;
    }

    setError("");
    setLoading(true);

    try {
      if (mode === "signup") {
        const { data, error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              full_name: name || undefined,
            },
          },
        });
        if (signUpError) throw signUpError;

        if (!data.session) {
          const { error: signInError } = await supabase.auth.signInWithPassword({
            email,
            password,
          });
          if (signInError) {
            setSent(true);
            setBotMessage("Account created. Please check your email to confirm your account.");
            return;
          }
        }
        onSuccess();
      } else if (mode === "login") {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (signInError) throw signInError;
        onSuccess();
      } else if (mode === "forgot") {
        const { error: resetError } = await supabase.auth.resetPasswordForEmail(email);
        if (resetError) throw resetError;
        setSent(true);
        setBotMessage("Password reset email dispatched successfully.");
      }
    } catch (err: any) {
      const msg = err.message || "An authentication error occurred.";
      setError(msg);
      setBotMessage(msg);
      companionEvents.emit("error_shown", { message: msg, context: "auth_supabase" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="auth-page">
      <header className="auth-top">
        <button className="wordmark" onClick={onBack}>
          {BRAND}
          <sup>®</sup>
        </button>
      </header>
      <section className="auth-card">
        <button className="app-back" onClick={onBack}>
          <MaterialIcon>arrow_back</MaterialIcon> BACK
        </button>
        <MicroLabel>
          {mode === "login" ? "WELCOME BACK" : mode === "signup" ? "CREATE ACCOUNT" : "RESET ACCESS"}
        </MicroLabel>
        <h1>{mode === "login" ? "Log in." : mode === "signup" ? "Start scanning." : "Forgot password?"}</h1>
        <p>
          {mode === "forgot"
            ? "Enter your email address to receive a secure reset link."
            : "Enter your credentials to access your continuous security scans."}
        </p>
        {sent ? (
          <div className="auth-sent">
            <MaterialIcon>mark_email_read</MaterialIcon>
            <h2>Check your email.</h2>
            <p>We've sent a password reset link to your email address. It will expire in 15 minutes.</p>
            <button className="button primary" onClick={() => onMode("login")}>
              Return to login
            </button>
          </div>
        ) : (
          <form onSubmit={submit} noValidate>
            {mode === "signup" && (
              <label>
                NAME
                <input name="name" required minLength={2} placeholder="Your full name" />
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
            <button className="button primary" type="submit" disabled={loading}>
              {loading
                ? "Connecting..."
                : mode === "login"
                  ? "Log in"
                  : mode === "signup"
                    ? "Create account"
                    : "Send reset link"}
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
        <small>Encrypted session · LeakLens Security</small>
      </section>
      <Companion message={botMessage} />
    </main>
  );
}
