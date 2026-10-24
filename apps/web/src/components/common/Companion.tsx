import { useState } from "react";
import { MaterialIcon } from "./MaterialIcon";

export function Companion({ message }: { message: string }) {
  const [open, setOpen] = useState(true);

  return (
    <div className={`companion ${open ? "open" : ""}`}>
      {open && (
        <div className="companion-note">
          <button onClick={() => setOpen(false)} aria-label="Dismiss">
            <MaterialIcon>close</MaterialIcon>
          </button>
          <p>{message}</p>
        </div>
      )}
      <button className="companion-bot" onClick={() => setOpen(!open)} aria-label="Toggle LeakLens companion">
        <MaterialIcon>smart_toy</MaterialIcon>
        <i />
      </button>
    </div>
  );
}
