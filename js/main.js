import { PAUSE_MAX_MINUTES, extensionBudget, pauseBudget, breakLength, } from "./budget.js";
// ===== Find elements on the page =====
function $(selector) {
    const element = document.querySelector(selector);
    if (!element)
        throw new Error(`Missing element: ${selector}`);
    return element;
}
const appEl = $("#app");
const phaseLabelEl = $("#phase-label");
const timeEl = $("#time");
const presetsEl = $("#presets");
const messageEl = $("#message");
const primaryButton = $("#primary");
const resetButton = $("#reset");
const ringProgressEl = $("#ring-progress");
// The circle's circumference: 2 × π × radius (r = 88 in the HTML)
const RING_LENGTH = 2 * Math.PI * 88;
ringProgressEl.style.strokeDasharray = String(RING_LENGTH);
// ===== Settings =====
const MINUTE = 60 * 1000; // one minute in milliseconds
// The lengths a user can choose. "as const" makes the list read-only.
const SESSION_PRESETS = [25, 35, 50, 60, 75, 90];
const STORAGE_KEY = "good-enough:session";
const subTimeEl = $("#sub-time");
const extraTextEl = $("#extra-text");
const extraBlocksEl = $("#extra-blocks");
const pauseTextEl = $("#pause-text");
const pauseDotsEl = $("#pause-dots");
const planBreakEl = $("#plan-break");
const planExtraEl = $("#plan-extra");
const planPausesEl = $("#plan-pauses");
// Load the saved length, or use 25 if there is none (or it's invalid)
function loadSession() {
    try {
        const saved = Number(localStorage.getItem(STORAGE_KEY));
        return SESSION_PRESETS.includes(saved) ? saved : 25;
    }
    catch {
        return 25; // some browsers block storage (private mode)
    }
}
function saveSession(minutes) {
    try {
        localStorage.setItem(STORAGE_KEY, String(minutes));
    }
    catch {
        // storage blocked: the app still works, it just won't remember
    }
}
let sessionMinutes = loadSession(); // "let" now, because it can change
let phase = "idle";
let endTime = 0; // the moment (in ms) when the session ends
let remainingMs = 0;
let pauseEndsAt = 0; // the moment the current pause ends by itself
let pausesUsed = 0;
let extensionUsed = 0; // extra minutes used (we'll use this in Step 9b)
const pausesLeft = () => pauseBudget(sessionMinutes) - pausesUsed;
const extraLeft = () => extensionBudget(sessionMinutes) - extensionUsed;
// ===== Helpers =====
// How much of the session is done: 0 = nothing, 1 = everything
function progress() {
    if (phase === "idle")
        return 0;
    if (phase === "focus-done")
        return 1;
    const total = sessionMinutes * MINUTE;
    const done = 1 - remaining() / total;
    return Math.min(1, Math.max(0, done)); // keep it between 0 and 1
}
function formatTime(ms) {
    const totalSeconds = Math.ceil(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}
function remaining() {
    if (phase == "paused")
        return remainingMs;
    return Math.max(0, endTime - Date.now());
}
// ===== Actions: they change the state, then redraw =====
function startFocus() {
    pausesUsed = 0;
    extensionUsed = 0;
    phase = "focus";
    endTime = Date.now() + sessionMinutes * MINUTE;
    messageEl.textContent = "Focus. One thing at a time.";
    render();
}
function setSession(minutes) {
    if (phase === "focus" || phase === "paused")
        return; // no switching mid-session
    sessionMinutes = minutes;
    saveSession(minutes);
    phase = "idle";
    messageEl.textContent = `${minutes} minutes it is. Press Start when you're ready.`;
    render();
}
function pause() {
    if (phase !== "focus" || pausesLeft() <= 0)
        return; // no pauses left: do nothing
    const now = Date.now();
    remainingMs = endTime - now;
    pauseEndsAt = now + PAUSE_MAX_MINUTES * MINUTE;
    pausesUsed++;
    phase = "paused";
    messageEl.textContent = `Paused. The timer continues in ${PAUSE_MAX_MINUTES} minutes either way.`;
    render();
}
function resume(auto = false) {
    if (phase !== "paused")
        return;
    endTime = Date.now() + remainingMs;
    phase = "focus";
    messageEl.textContent = auto ? "Pause over. Back to it." : "Welcome back. Where were we?";
    render();
}
// NEW
function reset() {
    pausesUsed = 0;
    extensionUsed = 0;
    phase = "idle";
    messageEl.textContent = "Reset. Start again whenever you're ready.";
    render();
}
function finishFocus() {
    phase = "focus-done";
    messageEl.textContent = "Good enough. Ship it.";
    render();
}
function primaryAction() {
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
const PHASE_LABELS = {
    idle: "Ready when you are",
    focus: "Focus",
    paused: "Paused",
    "focus-done": "Session done",
};
const BUTTON_LABELS = {
    idle: "Start focus",
    focus: "Pause",
    paused: "Resume",
    "focus-done": "Start again",
};
// ===== Draw the screen from the state =====
function buildPresets() {
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
function makeMarks(count, used, className) {
    return Array.from({ length: count }, (_, i) => {
        const mark = document.createElement("span");
        mark.className = i < used ? `${className} is-used` : className;
        return mark;
    });
}
function renderBudget() {
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
function render() {
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
    }
    else if (phase === "focus-done") {
        timeEl.textContent = "00:00";
    }
    else {
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
    presetsEl.querySelectorAll(".preset").forEach((button) => {
        const isSelected = Number(button.dataset.minutes) === sessionMinutes;
        button.setAttribute("aria-pressed", String(isSelected));
        button.disabled = isRunning && !isSelected;
    });
    renderBudget();
}
// Turn on the ring animation after the first frame has been drawn
requestAnimationFrame(() => requestAnimationFrame(() => appEl.classList.add("is-ready")));
// ===== The tick: runs 4 times per second =====
function tick() {
    const now = Date.now();
    if (phase === "focus" && now >= endTime) {
        finishFocus();
    }
    else if (phase === "paused" && now >= pauseEndsAt) {
        resume(true); // the 3 minutes are over
    }
    else {
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
