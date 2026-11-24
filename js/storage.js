// ==========================================================
// storage.ts: today's stats, saved in localStorage.
// ==========================================================
const STATS_KEY = "good-enough:stats";
/** Today's date in the user's own time zone, as YYYY-MM-DD. */
export function todayKey(now = new Date()) {
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, "0"); // months start at 0!
    const d = String(now.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
}
function emptyStats() {
    return {
        date: todayKey(),
        sessions: 0,
        focusMinutes: 0,
        extensionMinutes: 0,
        pauses: 0,
    };
}
/** Loads today's stats. A new day starts with fresh numbers. */
export function loadStats() {
    try {
        const raw = localStorage.getItem(STATS_KEY);
        if (!raw)
            return emptyStats();
        const saved = JSON.parse(raw);
        return saved.date === todayKey() ? saved : emptyStats();
    }
    catch {
        return emptyStats(); // storage blocked or data broken: start fresh
    }
}
export function saveStats(stats) {
    try {
        localStorage.setItem(STATS_KEY, JSON.stringify(stats));
    }
    catch {
        // storage blocked: the app still works, it just won't remember
    }
}
