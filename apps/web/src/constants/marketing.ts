export const BRAND = "LeakLens";

export const builderBrands = [
  { name: "Lovable", logo: "/brands/lovable.svg" },
  { name: "Bolt", logo: "/brands/bolt.svg" },
  { name: "Cursor", logo: "/brands/cursor.svg" },
  { name: "v0", logo: "/brands/v0.svg" },
];

export const checks = [
  "Exposed API keys",
  "Open Supabase tables",
  "Public storage buckets",
  "Secrets in the client bundle",
  "Missing row-level security",
  "Reachable .env files",
];

export const faqs: [string, string][] = [
  [
    "Will LeakLens change my app?",
    "No. Every check is read-only. LeakLens reports what it can see and gives you a prompt to make the fix yourself.",
  ],
  [
    "How do I prove I own the app?",
    "Add a temporary DNS TXT record or a meta tag. We verify it before any scan begins.",
  ],
  ["Which AI builders do you support?", "LeakLens is designed for apps built with Lovable, Bolt, Cursor and v0."],
  [
    "Do I need to know security?",
    "No. Findings are explained in plain English, with a ready-to-paste prompt for your AI builder.",
  ],
  [
    "What does the scan inspect?",
    "Publicly reachable parts of your app, including frontend bundles, API behavior, databases and storage configuration.",
  ],
  [
    "What does the exposure score cover?",
    "Only the specific public exposure checks listed in our coverage section. It is not a full security audit or penetration test.",
  ],
  [
    "Does it only work on AI-built apps?",
    "No. It's tuned for apps from AI builders, but the checks run on any website you own, because they look at what your site exposes, not at who built it.",
  ],
  [
    "Does a clean scan mean I'm secure?",
    "No. It means we didn't find the specific issues we check for. We list exactly what we do and don't cover so you know where the gaps are.",
  ],
];

export const coverageChecks = [
  "Secret keys and API keys exposed in your public JavaScript",
  "Supabase tables readable without logging in",
  "Missing row-level security on Supabase tables",
  "Public storage buckets",
  "Publicly reachable .env files",
  "Publicly reachable .git repository metadata",
  "Public production source maps",
  "Open Firebase database rules (when Firebase is detected)",
  "Overly permissive CORS settings",
];

export const coverageExclusions = [
  "Server, operating system and network vulnerabilities",
  "WordPress and other CMS plugin or theme vulnerabilities",
  "Malware or hacked-site cleanup",
  "Logic flaws in your app's own code or business rules",
  "Anything behind a login",
  "Private repositories and source code review",
  "Third-party services you connect to",
  "Denial-of-service and performance attacks",
];

import { HOW_IT_WORKS_STEPS } from "../components/marketing/howItWorksContent";

export const steps = HOW_IT_WORKS_STEPS.map((s) => ({
  number: s.number,
  title: s.title,
  body: s.description,
}));

