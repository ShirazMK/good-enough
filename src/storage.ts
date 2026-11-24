// ==========================================================
// storage.ts: today's stats, saved in localStorage.
// ==========================================================

/** The numbers we keep for one day. */
export interface DayStats {
  date: string; // e.g. "2026-11-24"
  sessions: number; // finished focus sessions
  focusMinutes: number; // minutes actually worked
  extensionMinutes: number; // extra minutes used
  pauses: number;
}

const STATS_KEY = "good-enough:stats";

/** Today's date in the user's own time zone, as YYYY-MM-DD. */
export function todayKey(now: Date = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0"); // months start at 0!
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function emptyStats(): DayStats {
  return {
    date: todayKey(),
    sessions: 0,
    focusMinutes: 0,
    extensionMinutes: 0,
    pauses: 0,
  };
}

/** Loads today's stats. A new day starts with fresh numbers. */
export function loadStats(): DayStats {
  try {
    const raw = localStorage.getItem(STATS_KEY);
    if (!raw) return emptyStats();
    const saved = JSON.parse(raw) as DayStats;
    return saved.date === todayKey() ? saved : emptyStats();
  } catch {
    return emptyStats(); // storage blocked or data broken: start fresh
  }
}

export function saveStats(stats: DayStats): void {
  try {
    localStorage.setItem(STATS_KEY, JSON.stringify(stats));
  } catch {
    // storage blocked: the app still works, it just won't remember
  }
}
