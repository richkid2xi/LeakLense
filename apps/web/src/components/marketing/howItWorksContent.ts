/**
 * Content for the "How it works" section (dark section with accordion & book flip cards).
 * Single source of truth for both accordion items and card illustrations.
 */

export interface VerificationSnippet {
  id: "dns_txt" | "file" | "meta_tag";
  label: string;
  snippet: string;
  instruction: string;
}

export interface ScanCheckItem {
  id: string;
  title: string;
  category: string;
  implemented: boolean;
  resultStatus: "passed" | "issue";
  resultLabel: string;
}

export interface StepItem {
  id: string;
  stepIndex: number;
  number: string;
  title: string;
  description: string;
}

export const HOW_IT_WORKS_STEPS: StepItem[] = [
  {
    id: "verify",
    stepIndex: 0,
    number: "01",
    title: "Verify",
    description: "Prove the app is yours with a DNS TXT record, a hosted file or a temporary meta tag.",
  },
  {
    id: "scan",
    stepIndex: 1,
    number: "02",
    title: "Scan",
    description: "LeakLens runs read-only checks against the parts of your app that are publicly reachable.",
  },
  {
    id: "fix",
    stepIndex: 2,
    number: "03",
    title: "Fix",
    description: "Read a plain-English explanation and paste the tailored fix prompt into your AI builder.",
  },
];

/**
 * Verification methods mirroring canonical types from @leaklens/shared.
 * (VerificationDetailsSchema in packages/shared/src/verification.ts)
 */
export const VERIFICATION_METHODS: VerificationSnippet[] = [
  {
    id: "dns_txt",
    label: "DNS TXT record",
    snippet: "_leaklens.your-app.com  TXT  leaklens-verification=ll_0a9f8e7d",
    instruction: "Add this TXT record to your DNS provider.",
  },
  {
    id: "file",
    label: "File",
    snippet: "/.well-known/leaklens.txt -> leaklens-verification=ll_0a9f8e7d",
    instruction: "Serve this file from your domain's root.",
  },
  {
    id: "meta_tag",
    label: "Meta tag",
    snippet: '<meta name="leaklens-verification" content="ll_0a9f8e7d" />',
    instruction: "Paste this tag into your HTML <head> section.",
  },
];

/**
 * Scan checks resolving during Step 2 demonstration.
 * Implemented checks matched against packages/detectors registry.
 * Planned checks explicitly tagged with "In development" chip.
 */
export const SCAN_STEP_CHECKS: ScanCheckItem[] = [
  {
    id: "keys",
    title: "Secret and API keys in JavaScript",
    category: "Secrets",
    implemented: true,
    resultStatus: "issue",
    resultLabel: "Issue found",
  },
  {
    id: "files",
    title: "Reachable .env and config files",
    category: "Config",
    implemented: true,
    resultStatus: "passed",
    resultLabel: "Passed",
  },
  {
    id: "tables",
    title: "Open database tables",
    category: "Database",
    implemented: false,
    resultStatus: "issue",
    resultLabel: "Issue found",
  },
  {
    id: "cors",
    title: "Network CORS boundaries",
    category: "Network",
    implemented: true,
    resultStatus: "passed",
    resultLabel: "Passed",
  },
];

export const FIX_STEP_SAMPLE = {
  severityLabel: "CRITICAL",
  title: "Exposed API key in client bundle",
  explanation: "A private API key was found bundled in frontend assets, allowing visitors to extract credentials.",
  maskedEvidence: 'const apiKey = "sk-...•••••8f2a";',
  promptToCopy:
    "Rotate this exposed key in your provider dashboard first. Move it to a server environment variable and remove it from the client build.",
};
