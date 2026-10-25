import { useEffect, useState } from "react";
import * as api from "../../lib/api";
import { MaterialIcon } from "../common/MaterialIcon";
import { MicroLabel } from "../common/MicroLabel";

export function VerificationModal({ url, onClose }: { url: string; onClose: () => void }) {
  const [method, setMethod] = useState<"dns" | "meta" | "file">("dns");
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
          <button className={method === "file" ? "active" : ""} onClick={() => setMethod("file")}>
            Verification file
          </button>
        </div>
        <div className="code-box">
          {method === "dns" ? (
            <>
              <span>HOST</span>
              <code>{challenge?.dnsHost || `_leaklens.${url}`}</code>
              <span>VALUE</span>
              <code>{challenge?.dnsValue || "Generating challenge..."}</code>
            </>
          ) : method === "meta" ? (
            <code>{challenge?.metaTagSnippet || "Generating challenge..."}</code>
          ) : (
            <>
              <span>PATH</span>
              <code>{challenge?.filePath || "/.well-known/leaklens.txt"}</code>
              <span>CONTENT</span>
              <code>{challenge?.fileContent || "Generating challenge..."}</code>
            </>
          )}
        </div>
        <button className="button primary wide" onClick={onClose}>
          I’ve added it — verify
        </button>
      </div>
    </div>
  );
}
