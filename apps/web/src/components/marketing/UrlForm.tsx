import { FormEvent, useState } from "react";
import { MaterialIcon } from "../common/MaterialIcon";

export function validateScanUrl(value: string) {
  if (!value.trim()) return "Enter the public URL of the app you want to scan.";
  try {
    const parsed = new URL(value.includes("://") ? value : `https://${value}`);
    if (!["http:", "https:"].includes(parsed.protocol))
      return "Use an HTTP or HTTPS link. File paths and other protocols are not supported.";
    if (!parsed.hostname.includes(".") || ["localhost", "127.0.0.1"].includes(parsed.hostname))
      return "Enter a publicly deployed app. Localhost is keeping its secrets to itself.";
    return "";
  } catch {
    return "That does not look like a complete app URL. Try something like https://your-app.com.";
  }
}

export function UrlForm({
  compact = false,
  onStart,
  onFeedback,
}: {
  compact?: boolean;
  onStart: (url: string) => void;
  onFeedback?: (message: string) => void;
}) {
  const [url, setUrl] = useState("");
  const [error, setError] = useState("");

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const nextError = validateScanUrl(url);
    if (nextError) {
      setError(nextError);
      onFeedback?.(nextError);
      return;
    }
    setError("");
    onStart(url);
  };

  return (
    <form className={`url-form ${compact ? "compact" : ""} ${error ? "has-error" : ""}`} onSubmit={submit} noValidate>
      <label className="sr-only" htmlFor={compact ? "closing-url" : "hero-url"}>
        Your app URL
      </label>
      <input
        id={compact ? "closing-url" : "hero-url"}
        type="url"
        placeholder="https://your-app.com"
        value={url}
        onChange={(e) => {
          setUrl(e.target.value);
          if (error) setError("");
        }}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${compact ? "closing" : "hero"}-url-error` : undefined}
      />
      <button className="button primary" type="submit">
        Start free scan
      </button>
      {error && (
        <p className="url-error" id={`${compact ? "closing" : "hero"}-url-error`}>
          <MaterialIcon>error</MaterialIcon>
          {error}
        </p>
      )}
    </form>
  );
}
