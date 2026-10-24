import { BRAND, coverageChecks, coverageExclusions } from "../../constants/marketing";
import { MaterialIcon } from "../common/MaterialIcon";
import { MicroLabel } from "../common/MicroLabel";

export function CoverageContent() {
  return (
    <section className="coverage grid-section" id="coverage">
      <div className="coverage-title">
        <MicroLabel>WHAT {BRAND.toUpperCase()} CHECKS (AND WHAT IT DOESN'T)</MicroLabel>
        <h2>
          Clear scope.
          <br />
          No false assurance.
        </h2>
      </div>
      <div className="coverage-columns">
        <article>
          <MicroLabel>WE CHECK</MicroLabel>
          {coverageChecks.map((item) => (
            <div key={item}>
              <MaterialIcon>check</MaterialIcon>
              <span>{item}</span>
            </div>
          ))}
        </article>
        <article className="coverage-muted">
          <MicroLabel>WE DON'T CHECK</MicroLabel>
          {coverageExclusions.map((item) => (
            <div key={item}>
              <span className="coverage-x">×</span>
              <span>{item}</span>
            </div>
          ))}
        </article>
      </div>
      <div className="coverage-callout">
        A clean {BRAND} scan means we didn't find these specific issues. It does not mean your app is secure. {BRAND} is
        not a full security audit or a penetration test.
      </div>
    </section>
  );
}
