import { useState } from "react";
import { AstralField } from "./components/common/AstralField";
import { MarketingView } from "./views/MarketingView";
import { AuthMode, AuthScreen } from "./views/AuthScreen";
import { LoggedInApp } from "./views/LoggedInApp";

export { VerificationModal } from "./components/modals/VerificationModal";

export default function App() {
  const [view, setView] = useState<"marketing" | "auth" | "app">("marketing");
  const [authMode, setAuthMode] = useState<AuthMode>("signup");
  const [initialUrl, setInitialUrl] = useState("acme-notes.app");

  return (
    <>
      <AstralField fixed />
      {view === "app" && (
        <LoggedInApp initialUrl={initialUrl} onExit={() => setView("marketing")} />
      )}
      {view === "auth" && (
        <AuthScreen
          mode={authMode}
          onMode={setAuthMode}
          onSuccess={() => setView("app")}
          onBack={() => setView("marketing")}
        />
      )}
      {view === "marketing" && (
        <MarketingView
          onLogin={() => {
            setAuthMode("login");
            setView("auth");
            window.scrollTo(0, 0);
          }}
          onEnter={(url) => {
            setInitialUrl(url);
            setAuthMode("signup");
            setView("auth");
            window.scrollTo(0, 0);
          }}
        />
      )}
    </>
  );
}
