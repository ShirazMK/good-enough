// ==========================================================
// budget.ts: the rules of the app, as small pure functions.
// ==========================================================

/** A session can never be longer than this, extensions included. */
export const MAX_SESSION_TOTAL = 90;

/** Every pause lasts at most this long (a micro-break). */
export const PAUSE_MAX_MINUTES = 3;

/** One pause is earned for every full block of this many minutes. */
export const MINUTES_PER_PAUSE = 25;

/** The extension buttons appear when this many minutes are left. */
export const SHOW_EXTEND_BEFORE_END_MINUTES = 2;

export const BREAK_MIN = 3;

export const BREAK_MAX = 30;

/**
 * Extra time for one session: half the session, rounded down to
 * steps of 5, but the total may never pass MAX_SESSION_TOTAL.
 *   25 -> 10   35 -> 15   50 -> 25   60 -> 30   75 -> 15   90 -> 0
 */
export function extensionBudget(sessionMinutes: number): number {
  const half = Math.floor(sessionMinutes / 2 / 5) * 5;
  const roomLeft = MAX_SESSION_TOTAL - sessionMinutes;
  return Math.max(0, Math.min(half, roomLeft));
}

/** One pause per full 25 minutes: 25 -> 1, 50 -> 2, 75 -> 3. */
export function pauseBudget(sessionMinutes: number): number {
  return Math.floor(sessionMinutes / MINUTES_PER_PAUSE);
}

/**
 * The break is one fifth of the time actually worked, at least 5 min.
 *   25 -> 5   50 -> 10   65 -> 13   90 -> 18
 */
export function breakLength(workedMinutes: number): number {
  return Math.max(5, Math.round(workedMinutes / 5));
}
export function compareBreak(
  chosen: number,
  recommended: number,
): "shorter" | "recommended" | "longer" {
  if (chosen < recommended) return "shorter";
  if (chosen > recommended) return "longer";
  return "recommended";
}
