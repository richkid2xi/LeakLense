import { MaterialIcon } from "../common/MaterialIcon";
import { MicroLabel } from "../common/MicroLabel";

export type LegalDocument = "terms" | "privacy";

export function LegalModal({ document, onClose }: { document: LegalDocument; onClose: () => void }) {
  const isTerms = document === "terms";
  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="legal-title" onMouseDown={onClose}>
      <div className="modal legal-modal" onMouseDown={(event) => event.stopPropagation()}>
        <div className="modal-top">
          <MicroLabel>LEAKLENS / LEGAL</MicroLabel>
          <button className="icon-button" onClick={onClose} aria-label="Close">
            <MaterialIcon>close</MaterialIcon>
          </button>
        </div>
        <h2 id="legal-title">{isTerms ? "Terms of Service" : "Privacy Policy"}</h2>
        <p className="legal-updated">PROTOTYPE COPY / LAST UPDATED 2025</p>
        <div className="legal-copy">
          {isTerms ? (
            <>
              <section>
                <h3>Authorised use only</h3>
                <p>
                  You may scan only websites you own or have explicit permission to test. Each domain and subdomain must
                  pass ownership verification before a scan starts.
                </p>
              </section>
              <section>
                <h3>What the service does</h3>
                <p>
                  LeakLens performs read-only checks against publicly reachable parts of a website. It is not a
                  penetration test, full security audit or guarantee of security.
                </p>
              </section>
              <section>
                <h3>Acceptable use</h3>
                <p>
                  Do not use LeakLens to inspect third-party sites, evade verification, disrupt services, access private
                  data or attempt unauthorised testing.
                </p>
              </section>
              <section>
                <h3>Results and remediation</h3>
                <p>
                  Findings and fix prompts should be reviewed before use. You remain responsible for changes made to
                  your website, infrastructure and connected services.
                </p>
              </section>
              <section>
                <h3>Prototype status</h3>
                <p>
                  This prototype uses sample data and simulated scans. It does not create an account, contact a live
                  target or provide production security services.
                </p>
              </section>
            </>
          ) : (
            <>
              <section>
                <h3>Prototype data</h3>
                <p>
                  This prototype keeps form values only in the current browser session. It does not send credentials,
                  website URLs or scan data to a backend.
                </p>
              </section>
              <section>
                <h3>Ownership verification</h3>
                <p>
                  DNS records, meta tags and verification files shown here are simulated examples and are not checked
                  against a live domain.
                </p>
              </section>
              <section>
                <h3>Sample reports</h3>
                <p>
                  Apps, findings, scores, evidence and account information displayed in this prototype are clearly
                  labelled sample data.
                </p>
              </section>
              <section>
                <h3>A production service</h3>
                <p>
                  A live version would document the data it collects, retention periods, processors, security controls
                  and deletion options before accepting real scans.
                </p>
              </section>
            </>
          )}
        </div>
        <button className="button primary wide" onClick={onClose}>
          Close
        </button>
      </div>
    </div>
  );
}
