import { PAUSE_MAX_MINUTES, SHOW_EXTEND_BEFORE_END_MINUTES, extensionBudget, pauseBudget, breakLength, } from "./budget.js";
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
const ringExtraEl = $("#ring-extra");
const extendBoxEl = $("#extend");
const extendButtons = [
    ...document.querySelectorAll("[data-extend]"),
];
const subTimeEl = $("#sub-time");
const extraTextEl = $("#extra-text");
const extraBlocksEl = $("#extra-blocks");
const pauseTextEl = $("#pause-text");
const pauseDotsEl = $("#pause-dots");
const planBreakEl = $("#plan-break");
const planExtraEl = $("#plan-extra");
const planPausesEl = $("#plan-pauses");
const breakPickerEl = $("#break-picker");
const breakValueEl = $("#break-value");
const breakHintEl = $("#break-hint");
const breakLessButton = $("#break-less");
const breakMoreButton = $("#break-more");
// The circle's circumference: 2 × π × radius (r = 88 in the HTML)
const RING_LENGTH = 2 * Math.PI * 88;
ringProgressEl.style.strokeDasharray = String(RING_LENGTH);
// ===== Settings =====
const MINUTE = 60 * 1000; // one minute in milliseconds
// The lengths a user can choose. "as const" makes the list read-only.
const SESSION_PRESETS = [25, 35, 50, 60, 75, 90];
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
// Picks a random item from a list
function pick(list) {
    return list[Math.floor(Math.random() * list.length)];
}
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
let extensionUsed = 0; // extra minutes used this session
let extensionsCount = 0; // how often "+" was pressed this session
let breakMinutes = 5; // the break the user will take
const pausesLeft = () => pauseBudget(sessionMinutes) - pausesUsed;
const extraLeft = () => extensionBudget(sessionMinutes) - extensionUsed;
const workedMinutes = () => sessionMinutes + extensionUsed;
// ===== Helpers =====
// How much of the session is done: 0 = nothing, 1 = everything
function progress() {
    if (phase === "idle")
        return 0;
    if (phase === "focus-done" || phase === "break-done")
        return 1;
    const minutes = phase === "break" ? breakMinutes : workedMinutes();
    const done = 1 - remaining() / (minutes * MINUTE);
    return Math.min(1, Math.max(0, done));
}
function formatTime(ms) {
    const totalSeconds = Math.ceil(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}
function remaining() {
    if (phase === "paused")
        return remainingMs;
    return Math.max(0, endTime - Date.now());
}
// ===== Actions: they change the state, then redraw =====
function startFocus() {
    pausesUsed = 0;
    extensionUsed = 0;
    extensionsCount = 0;
    phase = "focus";
    endTime = Date.now() + sessionMinutes * MINUTE;
    messageEl.textContent = "Focus. One thing at a time.";
    render();
}
function setSession(minutes) {
    if (phase === "focus" || phase === "paused" || phase === "break")
        return;
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
    messageEl.textContent = auto
        ? "Pause over. Back to it."
        : "Welcome back. Where were we?";
    render();
}
function extend(minutes) {
    if (minutes > extraLeft())
        return; // not enough budget
    if (phase !== "focus" && phase !== "focus-done")
        return;
    if (phase === "focus-done") {
        endTime = Date.now() + minutes * MINUTE; // already over: start overtime from now
        phase = "focus";
    }
    else {
        endTime += minutes * MINUTE; // still running: just move the end
    }
    // 1st, 2nd, 3rd+ extension get sassier messages
    messageEl.textContent =
        EXTEND_MESSAGES[Math.min(extensionsCount, EXTEND_MESSAGES.length - 1)];
    extensionUsed += minutes;
    extensionsCount++;
    render();
}
function reset() {
    pausesUsed = 0;
    extensionUsed = 0;
    extensionsCount = 0;
    phase = "idle";
    messageEl.textContent = "Reset. Start again whenever you're ready.";
    render();
}
function finishFocus() {
    breakMinutes = breakLength(workedMinutes());
    phase = "focus-done";
    messageEl.textContent =
        extraLeft() > 0 ? pick(END_MESSAGES) : NO_BUDGET_MESSAGE;
    render();
}
function startBreak() {
    if (phase !== "focus-done")
        return;
    phase = "break";
    endTime = Date.now() + breakMinutes * MINUTE; // same end-time trick as focus
    messageEl.textContent = "Stand up, stretch, look out of a window.";
    render();
}
function finishBreak() {
    phase = "break-done";
    messageEl.textContent = "Break's over. Ready for the next one?";
    render();
}
function primaryAction() {
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
const PHASE_LABELS = {
    idle: "Ready when you are",
    focus: "Focus",
    paused: "Paused",
    "focus-done": "Session done",
    break: "Break",
    "break-done": "Break's over",
};
const BUTTON_LABELS = {
    idle: "Start focus",
    focus: "Pause",
    paused: "Resume",
    "focus-done": "Start again",
    break: "Skip break",
    "break-done": "Start next session",
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
function render() {
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
    }
    else if (phase === "focus-done") {
        timeEl.textContent = "00:00";
    }
    else {
        timeEl.textContent = formatTime(remaining());
    }
    if (phase === "paused") {
        subTimeEl.textContent = `Resumes by itself in ${formatTime(Math.max(0, pauseEndsAt - Date.now()))}`;
    }
    else if (phase === "focus" && extensionUsed > 0) {
        subTimeEl.textContent = `Includes ${extensionUsed} extra min`;
    }
    else if (phase === "focus-done") {
        subTimeEl.textContent = `You worked ${workedMinutes()} min`;
    }
    else {
        subTimeEl.textContent = "";
    }
    ringProgressEl.style.strokeDashoffset = String(RING_LENGTH * (1 - progress()));
    // The amber zone: the part of the ring that came from extensions
    const isBreakPhase = phase === "break" || phase === "break-done";
    const extraFraction = isBreakPhase ? 0 : extensionUsed / workedMinutes();
    ringExtraEl.style.strokeDasharray = `${RING_LENGTH * extraFraction} ${RING_LENGTH}`;
    ringExtraEl.style.strokeDashoffset = String(-RING_LENGTH * (1 - extraFraction));
    // In overtime, everything turns amber
    const inOvertime = phase === "focus" && progress() > sessionMinutes / workedMinutes();
    appEl.classList.toggle("in-overtime", inOvertime);
    // The +5 / +10 box: in the last 2 minutes, or when the session has ended
    const showExtend = (phase === "focus" &&
        remaining() <= SHOW_EXTEND_BEFORE_END_MINUTES * MINUTE) ||
        phase === "focus-done";
    extendBoxEl.hidden = !showExtend || extensionBudget(sessionMinutes) === 0;
    extendButtons.forEach((button) => {
        button.disabled = Number(button.dataset.extend) > extraLeft();
    });
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
// ===== The tick: runs 4 times per second =====
function tick() {
    const now = Date.now();
    if (phase === "focus" && now >= endTime) {
        finishFocus();
    }
    else if (phase === "break" && now >= endTime) {
        finishBreak();
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
extendButtons.forEach((button) => button.addEventListener("click", () => extend(Number(button.dataset.extend))));
buildPresets();
render();
setInterval(tick, 250);
// Turn on the ring animation after the first frame has been drawn
requestAnimationFrame(() => requestAnimationFrame(() => appEl.classList.add("is-ready")));
