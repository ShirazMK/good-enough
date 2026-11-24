import {
  PAUSE_MAX_MINUTES,
  SHOW_EXTEND_BEFORE_END_MINUTES,
  extensionBudget,
  pauseBudget,
  breakLength,
  compareBreak,
  BREAK_MIN,
  BREAK_MAX,
} from "./budget.js";
import { loadStats, saveStats, todayKey } from "./storage.js";
// ===== Find elements on the page =====
function $<T extends Element>(selector: string): T {
  const element = document.querySelector<T>(selector);
  if (!element) throw new Error(`Missing element: ${selector}`);
  return element;
}
const appEl = $<HTMLDivElement>("#app");
const phaseLabelEl = $<HTMLHeadingElement>("#phase-label");
const timeEl = $<HTMLParagraphElement>("#time");
const presetsEl = $<HTMLDivElement>("#presets");
const messageEl = $<HTMLParagraphElement>("#message");
const primaryButton = $<HTMLButtonElement>("#primary");
const resetButton = $<HTMLButtonElement>("#reset");
const ringProgressEl = $<SVGCircleElement>("#ring-progress");
const ringExtraEl = $<SVGCircleElement>("#ring-extra");
const extendBoxEl = $<HTMLDivElement>("#extend");
const extendButtons = [
  ...document.querySelectorAll<HTMLButtonElement>("[data-extend]"),
];
const subTimeEl = $<HTMLParagraphElement>("#sub-time");
const extraTextEl = $<HTMLSpanElement>("#extra-text");
const extraBlocksEl = $<HTMLDivElement>("#extra-blocks");
const pauseTextEl = $<HTMLSpanElement>("#pause-text");
const pauseDotsEl = $<HTMLDivElement>("#pause-dots");
const planBreakEl = $<HTMLElement>("#plan-break");
const planExtraEl = $<HTMLElement>("#plan-extra");
const planPausesEl = $<HTMLElement>("#plan-pauses");
const breakPickerEl = $<HTMLDivElement>("#break-picker");
const breakValueEl = $<HTMLOutputElement>("#break-value");
const breakHintEl = $<HTMLParagraphElement>("#break-hint");
const breakLessButton = $<HTMLButtonElement>("#break-less");
const breakMoreButton = $<HTMLButtonElement>("#break-more");
// The circle's circumference: 2 × π × radius (r = 88 in the HTML)
const RING_LENGTH = 2 * Math.PI * 88;
ringProgressEl.style.strokeDasharray = String(RING_LENGTH);
// ===== Settings =====
const MINUTE = 60 * 1000; // one minute in milliseconds

// The lengths a user can choose. "as const" makes the list read-only.
const SESSION_PRESETS = [25, 35, 50, 60, 75, 90] as const;
const STORAGE_KEY = "good-enough:session";

const END_MESSAGES = [
  "Good enough. Ship it.",
  "That pixel can wait. Drink some water.",
  "Done is better than perfect. Break time.",
  "Step away from the keyboard. Slowly.",
];

const EXTEND_MESSAGES = [
  "Okay, finish that thought. ✍️",
  "Last stretch. You said 'one more step' a while ago.",
  "This is really the last one. I'm watching. 👀",
];

const NO_BUDGET_MESSAGE = "Nope. It's good enough. Break time. ☕";

const statSessionsEl = $<HTMLElement>("#stat-sessions");
const statFocusEl = $<HTMLElement>("#stat-focus");
const statExtraEl = $<HTMLElement>("#stat-extra");
const statPausesEl = $<HTMLElement>("#stat-pauses");

// Picks a random item from a list
function pick<T>(list: readonly T[]): T {
  return list[Math.floor(Math.random() * list.length)];
}

// Load the saved length, or use 25 if there is none (or it's invalid)
function loadSession(): number {
  try {
    const saved = Number(localStorage.getItem(STORAGE_KEY));
    return (SESSION_PRESETS as readonly number[]).includes(saved) ? saved : 25;
  } catch {
    return 25; // some browsers block storage (private mode)
  }
}

function saveSession(minutes: number): void {
  try {
    localStorage.setItem(STORAGE_KEY, String(minutes));
  } catch {
    // storage blocked: the app still works, it just won't remember
  }
}

let sessionMinutes = loadSession(); // "let" now, because it can change

// ===== State: everything the app needs to remember =====
type Phase =
  "idle" | "focus" | "paused" | "focus-done" | "break" | "break-done";
let phase: Phase = "idle";
let endTime = 0; // the moment (in ms) when the session ends
let remainingMs = 0;
let pauseEndsAt = 0; // the moment the current pause ends by itself
let pausesUsed = 0;
let extensionUsed = 0; // extra minutes used this session
let extensionsCount = 0; // how often "+" was pressed this session
let breakMinutes = 5; // the break the user will take
let recommendedBreak = 5;

let stats = loadStats(); // today's numbers

type StatKey = "sessions" | "focusMinutes" | "extensionMinutes" | "pauses";

// Adds to one of today's numbers and saves right away
function addToStats(key: StatKey, amount: number): void {
  if (stats.date !== todayKey()) stats = loadStats(); // past midnight: a new day
  stats[key] += amount;
  saveStats(stats);
}

const pausesLeft = (): number => pauseBudget(sessionMinutes) - pausesUsed;
const extraLeft = (): number => extensionBudget(sessionMinutes) - extensionUsed;
const workedMinutes = (): number => sessionMinutes + extensionUsed;

// ===== Helpers =====
// How much of the session is done: 0 = nothing, 1 = everything
function progress(): number {
  if (phase === "idle") return 0;
  if (phase === "focus-done" || phase === "break-done") return 1;
  const minutes = phase === "break" ? breakMinutes : workedMinutes();
  const done = 1 - remaining() / (minutes * MINUTE);
  return Math.min(1, Math.max(0, done));
}

function formatTime(ms: number): string {
  const totalSeconds = Math.ceil(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function remaining(): number {
  if (phase === "paused") return remainingMs;
  return Math.max(0, endTime - Date.now());
}

// ===== Actions: they change the state, then redraw =====
function startFocus(): void {
  pausesUsed = 0;
  extensionUsed = 0;
  extensionsCount = 0;
  phase = "focus";
  endTime = Date.now() + sessionMinutes * MINUTE;
  messageEl.textContent = "Focus. One thing at a time.";
  render();
}

function setSession(minutes: number): void {
  if (phase === "focus" || phase === "paused" || phase === "break") return;
  sessionMinutes = minutes;
  saveSession(minutes);
  phase = "idle";
  messageEl.textContent = `${minutes} minutes it is. Press Start when you're ready.`;
  render();
}

function pause(): void {
  if (phase !== "focus" || pausesLeft() <= 0) return; // no pauses left: do nothing
  const now = Date.now();
  remainingMs = endTime - now;
  pauseEndsAt = now + PAUSE_MAX_MINUTES * MINUTE;
  pausesUsed++;
  addToStats("pauses", 1);
  phase = "paused";
  messageEl.textContent = `Paused. The timer continues in ${PAUSE_MAX_MINUTES} minutes either way.`;
  render();
}

function resume(auto = false): void {
  if (phase !== "paused") return;
  endTime = Date.now() + remainingMs;
  phase = "focus";
  messageEl.textContent = auto
    ? "Pause over. Back to it."
    : "Welcome back. Where were we?";
  render();
}

function extend(minutes: number): void {
  if (minutes > extraLeft()) return; // not enough budget
  if (phase !== "focus" && phase !== "focus-done") return;

  if (phase === "focus-done") {
    endTime = Date.now() + minutes * MINUTE; // already over: start overtime from now
    phase = "focus";
  } else {
    endTime += minutes * MINUTE; // still running: just move the end
  }

  // 1st, 2nd, 3rd+ extension get sassier messages
  messageEl.textContent =
    EXTEND_MESSAGES[Math.min(extensionsCount, EXTEND_MESSAGES.length - 1)];
  extensionUsed += minutes;
  addToStats("extensionMinutes", minutes);
  extensionsCount++;
  render();
}

function reset(): void {
  pausesUsed = 0;
  extensionUsed = 0;
  extensionsCount = 0;
  phase = "idle";
  messageEl.textContent = "Reset. Start again whenever you're ready.";
  render();
}

function finishFocus(): void {
  recommendedBreak = breakLength(workedMinutes());
  breakMinutes = recommendedBreak;
  phase = "focus-done";
  messageEl.textContent =
    extraLeft() > 0 ? pick(END_MESSAGES) : NO_BUDGET_MESSAGE;
  render();
}

function startBreak(): void {
  if (phase !== "focus-done") return;
  addToStats("sessions", 1);
  addToStats("focusMinutes", workedMinutes());
  phase = "break";
  endTime = Date.now() + breakMinutes * MINUTE; // same end-time trick as focus
  messageEl.textContent = "Stand up, stretch, look out of a window.";
  render();
}

function finishBreak(): void {
  phase = "break-done";
  messageEl.textContent = "Break's over. Ready for the next one?";
  render();
}

function changeBreak(delta: number): void {
  if (phase !== "focus-done") return;
  breakMinutes = Math.min(BREAK_MAX, Math.max(BREAK_MIN, breakMinutes + delta));
  render();
}

function primaryAction(): void {
  switch (phase) {
    case "idle":
    case "break-done":
      startFocus();
      break;
    case "focus":
      pause();
      break;
    case "paused":
      resume();
      break;
    case "focus-done":
      startBreak();
      break;
    case "break":
      finishBreak(); // "Skip break"
      break;
  }
}

const PHASE_LABELS: Record<Phase, string> = {
  idle: "Ready when you are",
  focus: "Focus",
  paused: "Paused",
  "focus-done": "Session done",
  break: "Break",
  "break-done": "Break's over",
};

const BUTTON_LABELS: Record<Phase, string> = {
  idle: "Start focus",
  focus: "Pause",
  paused: "Resume",
  "focus-done": "Start again",
  break: "Skip break",
  "break-done": "Start next session",
};

// ===== Draw the screen from the state =====
function buildPresets(): void {
  for (const minutes of SESSION_PRESETS) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "preset";
    button.dataset.minutes = String(minutes); // becomes data-minutes="50"
    button.textContent = String(minutes);
    button.setAttribute("aria-label", `${minutes} minute session`);
    button.addEventListener("click", () => setSession(minutes));
    presetsEl.append(button);
  }
}

// Creates `count` small elements; the first `used` ones are filled in
function makeMarks(
  count: number,
  used: number,
  className: string,
): HTMLSpanElement[] {
  return Array.from({ length: count }, (_, i) => {
    const mark = document.createElement("span");
    mark.className = i < used ? `${className} is-used` : className;
    return mark;
  });
}

function renderBudget(): void {
  // Extra time: one block per 5 minutes
  const extra = extensionBudget(sessionMinutes);
  extraBlocksEl.replaceChildren(
    ...makeMarks(extra / 5, extensionUsed / 5, "block"),
  );
  extraTextEl.textContent =
    extra === 0
      ? "None at 90 min: that's the maximum."
      : `${extraLeft()} of ${extra} min left`;

  // Pauses: one dot each
  const pauses = pauseBudget(sessionMinutes);
  pauseDotsEl.replaceChildren(...makeMarks(pauses, pausesUsed, "dot"));
  pauseTextEl.textContent = `${pausesLeft()} of ${pauses} left, ${PAUSE_MAX_MINUTES} min each`;

  // The plan for the chosen length
  planBreakEl.textContent = `${breakLength(sessionMinutes)} min`;
  planExtraEl.textContent = extra === 0 ? "None" : `Up to ${extra} min`;
  planPausesEl.textContent = `${pauses} × ${PAUSE_MAX_MINUTES} min`;
}

function breakHintText(): string {
  const worked = workedMinutes();
  switch (compareBreak(breakMinutes, recommendedBreak)) {
    case "shorter":
      return `💡 Short on time? That's okay. After ${worked} min of focus, though, about ${recommendedBreak} min usually helps your brain recover better.`;
    case "longer":
      return "💡 A longer break can help after hard work. Just come back when the timer ends. 😉";
    case "recommended":
      return `💡 About 1 minute of rest for every 5 you work is a good rhythm. For ${worked} min, that's ${recommendedBreak} min.`;
  }
}

function renderStats(): void {
  statSessionsEl.textContent = String(stats.sessions);
  statFocusEl.textContent = `${stats.focusMinutes} min`;
  statExtraEl.textContent = `${stats.extensionMinutes} min`;
  statPausesEl.textContent = String(stats.pauses);
}

function render(): void {
  appEl.dataset.phase = phase;
  phaseLabelEl.textContent = PHASE_LABELS[phase];
  primaryButton.textContent = BUTTON_LABELS[phase];
  if (phase === "focus-done") {
    primaryButton.textContent = `Start ${breakMinutes}-min break`;
  }
  // When the pauses are used up, the Pause button says so and can't be clicked
  if (phase === "focus" && pausesLeft() <= 0) {
    primaryButton.textContent = "No pauses left";
  }
  primaryButton.disabled = phase === "focus" && pausesLeft() <= 0;

  if (phase === "idle" || phase === "break-done") {
    timeEl.textContent = formatTime(sessionMinutes * MINUTE);
  } else if (phase === "focus-done") {
    timeEl.textContent = "00:00";
  } else {
    timeEl.textContent = formatTime(remaining());
  }
  if (phase === "paused") {
    subTimeEl.textContent = `Resumes by itself in ${formatTime(Math.max(0, pauseEndsAt - Date.now()))}`;
  } else if (phase === "focus" && extensionUsed > 0) {
    subTimeEl.textContent = `Includes ${extensionUsed} extra min`;
  } else if (phase === "focus-done") {
    subTimeEl.textContent = `You worked ${workedMinutes()} min`;
  } else {
    subTimeEl.textContent = "";
  }
  ringProgressEl.style.strokeDashoffset = String(
    RING_LENGTH * (1 - progress()),
  );
  // The amber zone: the part of the ring that came from extensions
  const isBreakPhase = phase === "break" || phase === "break-done";
  const extraFraction = isBreakPhase ? 0 : extensionUsed / workedMinutes();
  ringExtraEl.style.strokeDasharray = `${RING_LENGTH * extraFraction} ${RING_LENGTH}`;
  ringExtraEl.style.strokeDashoffset = String(
    -RING_LENGTH * (1 - extraFraction),
  );

  // In overtime, everything turns amber
  const inOvertime =
    phase === "focus" && progress() > sessionMinutes / workedMinutes();
  appEl.classList.toggle("in-overtime", inOvertime);

  // The +5 / +10 box: in the last 2 minutes, or when the session has ended
  const showExtend =
    (phase === "focus" &&
      remaining() <= SHOW_EXTEND_BEFORE_END_MINUTES * MINUTE) ||
    phase === "focus-done";
  extendBoxEl.hidden = !showExtend || extensionBudget(sessionMinutes) === 0;
  extendButtons.forEach((button) => {
    button.disabled = Number(button.dataset.extend) > extraLeft();
  });
  // The break picker only appears when a session has ended
  breakPickerEl.hidden = phase !== "focus-done";
  breakValueEl.textContent = `${breakMinutes} min`;
  breakHintEl.textContent = breakHintText();
  breakLessButton.disabled = breakMinutes <= BREAK_MIN;
  breakMoreButton.disabled = breakMinutes >= BREAK_MAX;

  const isRunning =
    phase === "focus" || phase === "paused" || phase === "break";
  resetButton.hidden = !isRunning;

  document.title = isRunning
    ? `${formatTime(remaining())} · ${PHASE_LABELS[phase]} | Good Enough`
    : "Good Enough";
  // Highlight the chosen length; lock the others while a session runs
  presetsEl.querySelectorAll<HTMLButtonElement>(".preset").forEach((button) => {
    const isSelected = Number(button.dataset.minutes) === sessionMinutes;
    button.setAttribute("aria-pressed", String(isSelected));
    button.disabled = isRunning && !isSelected;
  });
  renderBudget();
  renderStats();
}

// ===== The tick: runs 4 times per second =====
function tick(): void {
  const now = Date.now();
  if (phase === "focus" && now >= endTime) {
    finishFocus();
  } else if (phase === "break" && now >= endTime) {
    finishBreak();
  } else if (phase === "paused" && now >= pauseEndsAt) {
    resume(true); // the 3 minutes are over
  } else {
    render();
  }
}

// ===== Start everything =====
primaryButton.addEventListener("click", primaryAction);
resetButton.addEventListener("click", reset);
extendButtons.forEach((button) =>
  button.addEventListener("click", () => extend(Number(button.dataset.extend))),
);
breakLessButton.addEventListener("click", () => changeBreak(-1));
breakMoreButton.addEventListener("click", () => changeBreak(1));
buildPresets();
render();
setInterval(tick, 250);

// Turn on the ring animation after the first frame has been drawn
requestAnimationFrame(() =>
  requestAnimationFrame(() => appEl.classList.add("is-ready")),
);
