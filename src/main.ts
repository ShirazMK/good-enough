// ===== Find elements on the page =====
function $<T extends HTMLElement>(selector: string): T {
  const element = document.querySelector<T>(selector);
  if (!element) throw new Error(`Missing element: ${selector}`);
  return element;
}
const appEl = $<HTMLDivElement>("#app");              
const phaseLabelEl = $<HTMLHeadingElement>("#phase-label");
const timeEl = $<HTMLParagraphElement>("#time");
const messageEl = $<HTMLParagraphElement>("#message");
const primaryButton = $<HTMLButtonElement>("#primary");
const resetButton = $<HTMLButtonElement>("#reset");

// ===== Settings =====
const MINUTE = 60 * 1000; // one minute in milliseconds
const sessionMinutes =25;

// ===== State: everything the app needs to remember =====
type Phase = "idle" | "focus" | "paused" | "focus-done";
let phase: Phase = "idle";
let endTime = 0; // the moment (in ms) when the session ends
let remainingMs =0;

// ===== Helpers =====
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
  phase = "focus";
  endTime = Date.now() + sessionMinutes * MINUTE;
  messageEl.textContent = "Focus. One thing at a time.";
  render();
}

// NEW
function pause(): void {
  if (phase !== "focus") return;
  remainingMs = endTime - Date.now();  // remember what's left
  phase = "paused";
  messageEl.textContent = "Paused. Take a breath.";
  render();
}

// NEW
function resume(): void {
  if (phase !== "paused") return;
  endTime = Date.now() + remainingMs;  // new end time from now
  phase = "focus";
  messageEl.textContent = "Welcome back. Where were we?";
  render();
}

// NEW
function reset(): void {
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
function render(): void {
  appEl.dataset.phase = phase;                         
  phaseLabelEl.textContent = PHASE_LABELS[phase];
  primaryButton.textContent = BUTTON_LABELS[phase];

  if (phase === "idle") {
    timeEl.textContent = formatTime(sessionMinutes * MINUTE);
  } else if (phase === "focus-done") {
    timeEl.textContent = "00:00";
  } else {
    timeEl.textContent = formatTime(remaining());
  }

  const isRunning = phase === "focus" || phase === "paused";
  resetButton.hidden = !isRunning;

  document.title = isRunning
    ? `${formatTime(remaining())} · ${PHASE_LABELS[phase]} | Good Enough`
    : "Good Enough";
}


// ===== The tick: runs 4 times per second =====
function tick(): void {
  if (phase === "focus" && Date.now() >= endTime) {
    finishFocus();
  } else {
    render();
  }
}

// ===== Start everything =====
primaryButton.addEventListener("click", primaryAction);
resetButton.addEventListener("click", reset);
render();
setInterval(tick, 250);