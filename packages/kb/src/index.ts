import { KbEntry, KbEntrySchema } from "./schema";
import { LL_KEY_001 } from "./entries/LL-KEY-001";
import { LL_SUPA_001 } from "./entries/LL-SUPA-001";

export * from "./schema";
export * from "./generator";
export * from "./entries/LL-KEY-001";
export * from "./entries/LL-SUPA-001";

// Curated entries catalog
export const KB_ENTRIES: Record<string, KbEntry> = {
  [LL_KEY_001.id]: KbEntrySchema.parse(LL_KEY_001),
  [LL_SUPA_001.id]: KbEntrySchema.parse(LL_SUPA_001),
};

export function getKbEntry(id: string): KbEntry | undefined {
  return KB_ENTRIES[id];
}

export function listKbEntries(): KbEntry[] {
  return Object.values(KB_ENTRIES);
}
