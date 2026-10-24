export interface CompanionStorageData {
  firstVisit: boolean;
  scanCount: number;
  seenLines: string[];
  isMuted: boolean;
}

const STORAGE_KEY = "leaklens_companion_session_v1";

const memoryFallback: CompanionStorageData = {
  firstVisit: true,
  scanCount: 0,
  seenLines: [],
  isMuted: false,
};

export const companionStorage = {
  load(): CompanionStorageData {
    if (typeof window === "undefined") return { ...memoryFallback };
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return { ...memoryFallback };
      const parsed = JSON.parse(raw);
      return {
        firstVisit: typeof parsed.firstVisit === "boolean" ? parsed.firstVisit : true,
        scanCount: typeof parsed.scanCount === "number" ? parsed.scanCount : 0,
        seenLines: Array.isArray(parsed.seenLines) ? parsed.seenLines.slice(-50) : [],
        isMuted: typeof parsed.isMuted === "boolean" ? parsed.isMuted : false,
      };
    } catch {
      return { ...memoryFallback };
    }
  },

  save(data: Partial<CompanionStorageData>): void {
    if (typeof window === "undefined") {
      Object.assign(memoryFallback, data);
      return;
    }
    try {
      const current = this.load();
      const updated: CompanionStorageData = {
        ...current,
        ...data,
      };
      // Keep seen lines bounded to last 50
      if (updated.seenLines && updated.seenLines.length > 50) {
        updated.seenLines = updated.seenLines.slice(-50);
      }
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    } catch {
      Object.assign(memoryFallback, data);
    }
  },

  markVisited(): void {
    this.save({ firstVisit: false });
  },

  incrementScanCount(): number {
    const current = this.load();
    const newCount = current.scanCount + 1;
    this.save({ scanCount: newCount });
    return newCount;
  },

  addSeenLine(lineId: string): void {
    const current = this.load();
    const set = new Set(current.seenLines);
    set.add(lineId);
    this.save({ seenLines: Array.from(set) });
  },

  hasSeenLine(lineId: string): boolean {
    const current = this.load();
    return current.seenLines.includes(lineId);
  },

  setMuted(muted: boolean): void {
    this.save({ isMuted: muted });
  },

  isMuted(): boolean {
    return this.load().isMuted;
  },

  resetForTests(): void {
    Object.assign(memoryFallback, {
      firstVisit: true,
      scanCount: 0,
      seenLines: [],
      isMuted: false,
    });
    if (typeof window !== "undefined") {
      try {
        window.localStorage.removeItem(STORAGE_KEY);
      } catch {
        // ignore
      }
    }
  },
};
