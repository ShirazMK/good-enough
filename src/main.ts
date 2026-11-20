import {
  PAUSE_MAX_MINUTES,
  extensionBudget,
  pauseBudget,
  breakLength,
} from "./budget.js";
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
// The circle's circumference: 2 × π × radius (r = 88 in the HTML)
const RING_LENGTH = 2 * Math.PI * 88;
ringProgressEl.style.strokeDasharray = String(RING_LENGTH);
// ===== Settings =====
const MINUTE = 60 * 1000; // one minute in milliseconds
// The lengths a user can choose. "as const" makes the list read-only.
const SESSION_PRESETS = [25, 35, 50, 60, 75, 90] as const;
const STORAGE_KEY = "good-enough:session";
const subTimeEl = $<HTMLParagraphElement>("#sub-time");
const extraTextEl = $<HTMLSpanElement>("#extra-text");
const extraBlocksEl = $<HTMLDivElement>("#extra-blocks");
const pauseTextEl = $<HTMLSpanElement>("#pause-text");
const pauseDotsEl = $<HTMLDivElement>("#pause-dots");
const planBreakEl = $<HTMLElement>("#plan-break");
const planExtraEl = $<HTMLElement>("#plan-extra");
const planPausesEl = $<HTMLElement>("#plan-pauses");

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
type Phase = "idle" | "focus" | "paused" | "focus-done";
let phase: Phase = "idle";
let endTime = 0; // the moment (in ms) when the session ends
let remainingMs =0;
let pauseEndsAt = 0;    // the moment the current pause ends by itself
let pausesUsed = 0;
let extensionUsed = 0;  // extra minutes used (we'll use this in Step 9b)

const pausesLeft = (): number => pauseBudget(sessionMinutes) - pausesUsed;
const extraLeft = (): number => extensionBudget(sessionMinutes) - extensionUsed;

// ===== Helpers =====
// How much of the session is done: 0 = nothing, 1 = everything
function progress(): number {
  if (phase === "idle") return 0;
  if (phase === "focus-done") return 1;
  const total = sessionMinutes * MINUTE;
  const done = 1 - remaining() / total;
  return Math.min(1, Math.max(0, done)); // keep it between 0 and 1
}

function formatTime(ms: number): string {
  const totalSeconds = Math.ceil(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function remaining(): number {
  if(phase =="paused") return remainingMs;
  return Math.max(0, endTime - Date.now());
}

// ===== Actions: they change the state, then redraw =====
function startFocus(): void {
    pausesUsed = 0;
  extensionUsed = 0;
  phase = "focus";
  endTime = Date.now() + sessionMinutes * MINUTE;
  messageEl.textContent = "Focus. One thing at a time.";
  render();
}

function setSession(minutes: number): void {
  if (phase === "focus" || phase === "paused") return; // no switching mid-session
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
  phase = "paused";
  messageEl.textContent = `Paused. The timer continues in ${PAUSE_MAX_MINUTES} minutes either way.`;
  render();
}

function resume(auto = false): void {
  if (phase !== "paused") return;
  endTime = Date.now() + remainingMs;
  phase = "focus";
  messageEl.textContent = auto ? "Pause over. Back to it." : "Welcome back. Where were we?";
  render();
}

// NEW
function reset(): void {
    pausesUsed = 0;
  extensionUsed = 0;
  phase = "idle";
  messageEl.textContent = "Reset. Start again whenever you're ready.";
  render();
}

function finishFocus(): void {
  phase = "focus-done";
  messageEl.textContent = "Good enough. Ship it.";
  render();
}

function primaryAction(): void {
  switch (phase) {
    case "idle":
    case "focus-done":
      startFocus();
      break;
    case "focus":
      pause();
      break;
    case "paused":
      resume();
      break;
  }
}

const PHASE_LABELS: Record<Phase, string> = {
  idle: "Ready when you are",
  focus: "Focus",
  paused: "Paused",
  "focus-done": "Session done",
};

const BUTTON_LABELS: Record<Phase, string> = {
  idle: "Start focus",
  focus: "Pause",
  paused: "Resume",
  "focus-done": "Start again",
};

// ===== Draw the screen from the state =====
function buildPresets(): void {
  for (const minutes of SESSION_PRESETS) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "preset";
    button.dataset.minutes = String(minutes);          // becomes data-minutes="50"
    button.textContent = String(minutes);
    button.setAttribute("aria-label", `${minutes} minute session`);
    button.addEventListener("click", () => setSession(minutes));
    presetsEl.append(button);
  }
}

// Creates `count` small elements; the first `used` ones are filled in
function makeMarks(count: number, used: number, className: string): HTMLSpanElement[] {
  return Array.from({ length: count }, (_, i) => {
    const mark = document.createElement("span");
    mark.className = i < used ? `${className} is-used` : className;
    return mark;
  });
}

function renderBudget(): void {
  // Extra time: one block per 5 minutes
  const extra = extensionBudget(sessionMinutes);
  extraBlocksEl.replaceChildren(...makeMarks(extra / 5, extensionUsed / 5, "block"));
  extraTextEl.textContent = extra === 0 ? "None at 90 min: that's the maximum." : `${extraLeft()} of ${extra} min left`;

  // Pauses: one dot each
  const pauses = pauseBudget(sessionMinutes);
  pauseDotsEl.replaceChildren(...makeMarks(pauses, pausesUsed, "dot"));
  pauseTextEl.textContent = `${pausesLeft()} of ${pauses} left, ${PAUSE_MAX_MINUTES} min each`;

  // The plan for the chosen length
  planBreakEl.textContent = `${breakLength(sessionMinutes)} min`;
  planExtraEl.textContent = extra === 0 ? "None" : `Up to ${extra} min`;
  planPausesEl.textContent = `${pauses} × ${PAUSE_MAX_MINUTES} min`;
}

function render(): void {
  appEl.dataset.phase = phase;                         
  phaseLabelEl.textContent = PHASE_LABELS[phase];
  primaryButton.textContent = BUTTON_LABELS[phase];
  // When the pauses are used up, the Pause button says so and can't be clicked
  if (phase === "focus" && pausesLeft() <= 0) {
    primaryButton.textContent = "No pauses left";
  }
  primaryButton.disabled = phase === "focus" && pausesLeft() <= 0;

  if (phase === "idle") {
    timeEl.textContent = formatTime(sessionMinutes * MINUTE);
  } else if (phase === "focus-done") {
    timeEl.textContent = "00:00";
  } else {
    timeEl.textContent = formatTime(remaining());
  }
    subTimeEl.textContent =
    phase === "paused"
      ? `Resumes by itself in ${formatTime(Math.max(0, pauseEndsAt - Date.now()))}`
      : "";
    ringProgressEl.style.strokeDashoffset = String(RING_LENGTH * (1 - progress()));

  const isRunning = phase === "focus" || phase === "paused";
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
  }

// Turn on the ring animation after the first frame has been drawn
requestAnimationFrame(() => requestAnimationFrame(() => appEl.classList.add("is-ready")));

// ===== The tick: runs 4 times per second =====
function tick(): void {
  const now = Date.now();
  if (phase === "focus" && now >= endTime) {
    finishFocus();
  } else if (phase === "paused" && now >= pauseEndsAt) {
    resume(true); // the 3 minutes are over
  } else {
    render();
  }
}

// ===== Start everything =====
primaryButton.addEventListener("click", primaryAction);
resetButton.addEventListener("click", reset);
primaryButton.addEventListener("click", primaryAction);
resetButton.addEventListener("click", reset);
buildPresets();
render();
setInterval(tick, 250);