import { useEffect, useState } from "react";
import { companionEvents } from "./lib/companion/events";
import { NodeNetwork } from "./components/common/NodeNetwork";
import { MarketingView } from "./views/MarketingView";
import { AuthMode, AuthScreen } from "./views/AuthScreen";
import { LoggedInApp } from "./views/LoggedInApp";
import { supabase } from "./lib/supabase";

export { VerificationModal } from "./components/modals/VerificationModal";

export default function App() {
  const [view, setView] = useState<"marketing" | "auth" | "app">("marketing");
  const [authMode, setAuthMode] = useState<AuthMode>("signup");
  const [initialUrl, setInitialUrl] = useState("");
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [user, setUser] = useState<{ email: string; name: string } | null>(null);

  const extractUser = (session: any) => {
    if (!session?.user) return null;
    const u = session.user;
    const name =
      u.user_metadata?.full_name ||
      u.user_metadata?.name ||
      (u.email ? u.email.split("@")[0] : "User");
    return { email: u.email || "", name };
  };

  useEffect(() => {
    // Check initial active session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setIsLoggedIn(true);
        setUser(extractUser(session));
        setView("app");
      } else {
        setIsLoggedIn(false);
        setUser(null);
      }
    });

    // Listen to auth state transitions
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (session) {
        setIsLoggedIn(true);
        setUser(extractUser(session));
        if (event === "SIGNED_IN") {
          setView("app");
        }
      } else {
        setIsLoggedIn(false);
        setUser(null);
        if (event === "SIGNED_OUT") {
          setView("marketing");
        }
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    companionEvents.emit("route_changed", { route: view });
  }, [view]);

  return (
    <>
      <NodeNetwork />
      {view === "app" && (
        <LoggedInApp
          initialUrl={initialUrl}
          onLogout={async () => {
            await supabase.auth.signOut().catch(() => {});
            setIsLoggedIn(false);
            setView("marketing");
          }}
          onViewHome={() => {
            setView("marketing");
            window.scrollTo(0, 0);
          }}
        />
      )}
      {view === "auth" && (
        <AuthScreen
          mode={authMode}
          onMode={setAuthMode}
          onSuccess={() => {
            setIsLoggedIn(true);
            setView("app");
          }}
          onBack={() => setView("marketing")}
        />
      )}
      {view === "marketing" && (
        <MarketingView
          isLoggedIn={isLoggedIn}
          user={user}
          onGoToApp={() => {
            setView("app");
            window.scrollTo(0, 0);
          }}
          onLogin={() => {
            setAuthMode("login");
            setView("auth");
            window.scrollTo(0, 0);
          }}
          onEnter={(url) => {
            setInitialUrl(url);
            if (isLoggedIn) {
              setView("app");
            } else {
              setAuthMode("signup");
              setView("auth");
            }
            window.scrollTo(0, 0);
          }}
        />
      )}
    </>
  );
}
