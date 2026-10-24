import { MaterialIcon } from "../common/MaterialIcon";

export function LayerDiagram() {
  return (
    <div className="terminal-scene" aria-label="Command line scanning a sample codebase">
      <div className="terminal-window">
        <div className="terminal-titlebar">
          <span className="terminal-dots">
            <i />
            <i />
            <i />
          </span>
          <code>leaklens — security scan</code>
          <MaterialIcon>terminal</MaterialIcon>
        </div>
        <div className="terminal-body">
          <div>
            <span className="prompt">leaklens@scan:~$</span> leaklens scan ./acme-notes <i className="cursor" />
          </div>
          <div className="terminal-muted">Ownership verified · read-only mode</div>
          <div className="terminal-line line-1">
            <b>[01]</b> Reading frontend bundle <span>14 files</span>
          </div>
          <div className="terminal-line line-2">
            <b>[02]</b> Checking Supabase policies <span>6 tables</span>
          </div>
          <div className="terminal-line line-3">
            <b>[03]</b> Inspecting storage access <span>2 buckets</span>
          </div>
          <div className="terminal-finding finding-one">
            <i /> CRITICAL <code>/assets/index-a81c.js</code>
            <strong>exposed key</strong>
          </div>
          <div className="terminal-finding finding-two">
            <i /> HIGH <code>public/profiles</code>
            <strong>open table</strong>
          </div>
          <div className="terminal-progress">
            <span />
            <code>SCANNING PUBLIC EDGE · 68%</code>
          </div>
        </div>
      </div>
      <span className="terminal-caption">SAMPLE SCAN / NO CHANGES MADE</span>
    </div>
  );
}
