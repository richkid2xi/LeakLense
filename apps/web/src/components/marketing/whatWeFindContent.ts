/**
 * Content for the "What we find" cards on the deep-blue band.
 *
 * DETECTOR IMPLEMENTATION STATUS:
 * - Keys in your JavaScript: Implemented in packages/detectors (secretsDetector)
 * - Open database tables: Planned in packages/detectors/src/registry.ts (supabaseAnonDetector, supabaseRlsDetector)
 * - Public storage: Planned in packages/detectors/src/registry.ts (storageDetector)
 *
 * TODO: When a unified detector metadata constant is added to packages/shared, source
 * the implementation status directly from it instead of maintaining it here.
 */

export interface CardStateContent {
  evidenceCode: string;
  evidenceCaption: string;
  stateLabel: string;
  stateDotClass: "issue" | "fixed";
}

export interface WhatWeFindItem {
  id: string;
  number: string;
  title: string;
  implemented: boolean;
  statusChip: string;
  description: string;
  before: CardStateContent;
  after: CardStateContent;
}

export const WHAT_WE_FIND_CARDS: WhatWeFindItem[] = [
  {
    id: "keys",
    number: "01",
    title: "Keys in your JavaScript",
    implemented: true,
    statusChip: "Sample",
    description: "Private API keys bundled into client code allow visitors to extract credentials.",
    before: {
      evidenceCode: 'const apiKey = "sk-...•••••8f2a";',
      evidenceCaption: "Visible to anyone who opens your site.",
      stateLabel: "Issue found",
      stateDotClass: "issue",
    },
    after: {
      evidenceCode: "const apiKey = process.env.API_KEY;",
      evidenceCaption: "Key lives on the server, rotated.",
      stateLabel: "Fixed",
      stateDotClass: "fixed",
    },
  },
  {
    id: "tables",
    number: "02",
    title: "Open database tables",
    implemented: false,
    statusChip: "Sample",
    description: "Database tables readable by anonymous visitors because row-level security is not enabled.",
    before: {
      evidenceCode: "GET /rest/v1/profiles -> 200 (id, role, email)",
      evidenceCaption: "Readable without login.",
      stateLabel: "Issue found",
      stateDotClass: "issue",
    },
    after: {
      evidenceCode: "GET /rest/v1/profiles -> 200 (0 rows)",
      evidenceCaption: "Same request returns no rows. Row-level security on.",
      stateLabel: "Fixed",
      stateDotClass: "fixed",
    },
  },
  {
    id: "storage",
    number: "03",
    title: "Public storage",
    implemented: false,
    statusChip: "Sample",
    description: "Cloud storage buckets permit public file listing instead of requiring signed links.",
    before: {
      evidenceCode: "GET /storage/v1/s3/user-data/ -> 200 (uploads/•••••/export.csv)",
      evidenceCaption: "Bucket listing is public.",
      stateLabel: "Issue found",
      stateDotClass: "issue",
    },
    after: {
      evidenceCode: "GET /storage/v1/s3/user-data/ -> 403 Forbidden",
      evidenceCaption: "Listing requires a signed link.",
      stateLabel: "Fixed",
      stateDotClass: "fixed",
    },
  },
];

export const WHAT_WE_FIND_FOOTNOTE = {
  text: "See everything we check and don't check",
  href: "#coverage",
};
