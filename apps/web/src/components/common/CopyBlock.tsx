import { useState } from "react";
import { companionEvents } from "../../lib/companion/events";

export function CopyBlock({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    await navigator.clipboard?.writeText(value);
    setCopied(true);
    companionEvents.emit("fix_prompt_copied", {});
    setTimeout(() => setCopied(false), 1200);
  };

  return (
    <div className="app-code">
      <code>{value}</code>
      <button onClick={copy}>{copied ? "COPIED" : "COPY"}</button>
    </div>
  );
}
