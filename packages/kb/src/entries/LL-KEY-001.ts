import { KbEntry } from "../schema";

export const LL_KEY_001: KbEntry = {
  id: "LL-KEY-001",
  title: "Live secret key exposed in frontend bundle",
  category: "Secrets",
  defaultSeverity: "critical",
  plainEnglishExplanation:
    "A private secret or API key was compiled into the code sent to every visitor's web browser. Anyone opening your website can open developer tools and copy it.",
  realisticConsequence:
    "Anyone with this key can make requests to the connected third-party service under your account. Depending on the service, this can lead to unexpected billing charges, data access, or quota depletion.",
  howItHappensInAiApps:
    "AI builders often implement features quickly by importing third-party SDKs directly in frontend components (e.g., calling OpenAI, Stripe, or Resend directly from React). When asked to connect an API, the agent frequently puts the private secret in client-side code or an environment variable prefixed with VITE_ or NEXT_PUBLIC_.",
  severityLogic:
    "Critical. Secret keys grant authenticated API access without server-side verification. Once exposed to the public internet, they must be considered compromised immediately.",
  fixSteps: [
    "Log into the provider dashboard immediately, revoke the exposed key, and generate a new secret.",
    "Store the new key in server-side environment variables only (never prefix with VITE_ or NEXT_PUBLIC_).",
    "Move all calls to this service into a server-side route or backend function so the key never reaches the browser.",
    "Remove the key completely from git history and redeploy your app.",
  ],
  preventionChecklist: [
    "Never prefix private API keys with client-facing prefixes like VITE_ or NEXT_PUBLIC_.",
    "Use serverless endpoints or backend routes as proxies for third-party API calls.",
    "Set spending and usage limits on third-party provider accounts.",
    "Enable automated secret scanning in your git repository.",
  ],
  fixPromptTemplates: {
    lovable:
      "Update this Lovable project to fix the exposed secret key at {{location}} (masked key: {{maskedKey}}). Instructions: (1) Instruct me to revoke and rotate this key in the provider dashboard first. (2) Move the API call to a secure server function or edge function using server-only environment variables without VITE_ prefix. (3) Remove all references to the secret key from client-side components. (4) Do not modify unrelated components. Show the git diff and explain what changed.",
    bolt: "In this Bolt app, fix the exposed secret key at {{location}} (masked key: {{maskedKey}}). Instructions: (1) Advise rotating the key at the provider immediately. (2) Move the third-party client initialization to a server endpoint. (3) Never expose the secret to client bundles. (4) Make the smallest scoped changes required, preserve unrelated behavior, show the diff, and explain what changed.",
    cursor:
      "Inspect the exposed secret key at {{location}} (masked key: {{maskedKey}}). Implement this fix: (1) Confirm that the key must first be rotated at the provider dashboard. (2) Move the integration to a backend or API route using server-side environment variables. (3) Remove the secret from frontend code. (4) Keep all other application features intact, display the diff, and explain the changes.",
    v0: "In this v0 project, remediate the exposed secret key at {{location}} (masked key: {{maskedKey}}). (1) Note that the key must be rotated at the provider before deploying. (2) Move third-party API requests to Next.js server actions or Route Handlers using private process.env. (3) Do not pass credentials to client components. (4) Show the diff and summarize the files changed.",
    any_agent:
      "Apply this security fix to resolve the exposed secret key at {{location}} (masked key: {{maskedKey}}): (1) Revoke and rotate the compromised key at the provider first. (2) Move the API interaction to a server-side route or function using private environment variables. (3) Ensure the secret is never bundled in frontend JavaScript. (4) Make no unrelated modifications, show the diff, and explain the changes.",
  },
};
