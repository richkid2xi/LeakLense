import { Detector } from "./types";

/**
 * Detector Registry (Phase 0 Scaffold)
 *
 * Scaffolds the detector registry.
 * Strictly EMPTY per Phase 0 task 4.g instructions.
 * Real detector implementations (keys, Supabase, storage, sensitive files) will be added in Phase 1 & 2.
 */
const registeredDetectors: Detector[] = [];

export function getDetectors(): readonly Detector[] {
  return registeredDetectors;
}

export function registerDetector(detector: Detector): void {
  const exists = registeredDetectors.some((d) => d.id === detector.id);
  if (exists) {
    throw new Error(`Detector with id '${detector.id}' is already registered.`);
  }
  registeredDetectors.push(detector);
}

export function clearDetectors(): void {
  registeredDetectors.length = 0;
}
