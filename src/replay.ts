/**
 * Local ghost replay — compact samples for speedrun comparison.
 */
const STORAGE_PREFIX = "gcourier_ghost_v1_";

export interface GhostSample {
  t: number;
  px: number;
  py: number;
  pz: number;
  ux: number;
  uy: number;
  uz: number;
}

export interface GhostRun {
  levelId: string;
  samples: GhostSample[];
  bestTimeSec: number | null;
}

export function loadGhost(levelId: string): GhostRun | null {
  try {
    const raw = localStorage.getItem(STORAGE_PREFIX + levelId);
    if (!raw) return null;
    return JSON.parse(raw) as GhostRun;
  } catch {
    return null;
  }
}

export function saveGhost(levelId: string, samples: GhostSample[], finishTimeSec: number): void {
  const prev = loadGhost(levelId);
  const best =
    prev?.bestTimeSec != null ? Math.min(prev.bestTimeSec, finishTimeSec) : finishTimeSec;
  const run: GhostRun = {
    levelId,
    samples,
    bestTimeSec: best,
  };
  localStorage.setItem(STORAGE_PREFIX + levelId, JSON.stringify(run));
}

export function formatTime(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec - m * 60;
  const pad = s < 10 ? "0" : "";
  return `${m}:${pad}${s.toFixed(2)}`;
}
