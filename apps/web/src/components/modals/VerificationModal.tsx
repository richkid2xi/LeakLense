import { useEffect, useState } from "react";
import * as api from "../../lib/api";
import { MaterialIcon } from "../common/MaterialIcon";
import { MicroLabel } from "../common/MicroLabel";

export function VerificationModal({ url, onClose }: { url: string; onClose: () => void }) {
  const [method, setMethod] = useState<"dns" | "meta">("dns");
  const [challenge, setChallenge] = useState<api.VerificationChallenge | null>(null);

  useEffect(() => {
    api.startVerification(url, method).then(setChallenge);
  }, [url, method]);

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="verify-title">
      <div className="modal">
        <div className="modal-top">
          <MicroLabel>OWNERSHIP CHECK / REQUIRED</MicroLabel>
          <button className="icon-button" onClick={onClose} aria-label="Close">
            <MaterialIcon>close</MaterialIcon>
          </button>
        </div>
        <h2 id="verify-title">Verify this app is yours.</h2>
        <p>
          Before scanning <strong>{url}</strong>, add one temporary verification value.
        </p>
        <div className="tabs">
          <button className={method === "dns" ? "active" : ""} onClick={() => setMethod("dns")}>
            DNS TXT record
          </button>
          <button className={method === "meta" ? "active" : ""} onClick={() => setMethod("meta")}>
            Meta tag
          </button>
        </div>
        <div className="code-box">
          {method === "dns" ? (
            <>
              <span>HOST</span>
              <code>{challenge?.dnsHost || "_leaklens"}</code>
              <span>VALUE</span>
              <code>{challenge?.dnsValue || "leaklens-verification=ll_••••••••3a"}</code>
            </>
          ) : (
            <code>{challenge?.metaTagSnippet || '<meta name="leaklens-verification" content="ll_••••••••3a" />'}</code>
          )}
        </div>
        <button className="button primary wide" onClick={onClose}>
          I’ve added it — verify
        </button>
        <small>This prototype does not run a live scan.</small>
      </div>
    </div>
  );
}
