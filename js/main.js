"use strict";
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
const messageEl = $("#message");
const primaryButton = $("#primary");
const resetButton = $("#reset");
const ringProgressEl = $("#ring-progress");
// The circle's circumference: 2 × π × radius (r = 88 in the HTML)
const RING_LENGTH = 2 * Math.PI * 88;
ringProgressEl.style.strokeDasharray = String(RING_LENGTH);
// ===== Settings =====
const MINUTE = 60 * 1000; // one minute in milliseconds
const sessionMinutes = 25;
let phase = "idle";
let endTime = 0; // the moment (in ms) when the session ends
let remainingMs = 0;
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
    phase = "focus";
    endTime = Date.now() + sessionMinutes * MINUTE;
    messageEl.textContent = "Focus. One thing at a time.";
    render();
}
// NEW
function pause() {
    if (phase !== "focus")
        return;
    remainingMs = endTime - Date.now(); // remember what's left
    phase = "paused";
    messageEl.textContent = "Paused. Take a breath.";
    render();
}
// NEW
function resume() {
    if (phase !== "paused")
        return;
    endTime = Date.now() + remainingMs; // new end time from now
    phase = "focus";
    messageEl.textContent = "Welcome back. Where were we?";
    render();
}
// NEW
function reset() {
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
function render() {
    appEl.dataset.phase = phase;
    phaseLabelEl.textContent = PHASE_LABELS[phase];
    primaryButton.textContent = BUTTON_LABELS[phase];
    if (phase === "idle") {
        timeEl.textContent = formatTime(sessionMinutes * MINUTE);
    }
    else if (phase === "focus-done") {
        timeEl.textContent = "00:00";
    }
    else {
        timeEl.textContent = formatTime(remaining());
    }
    ringProgressEl.style.strokeDashoffset = String(RING_LENGTH * (1 - progress()));
    const isRunning = phase === "focus" || phase === "paused";
    resetButton.hidden = !isRunning;
    document.title = isRunning
        ? `${formatTime(remaining())} · ${PHASE_LABELS[phase]} | Good Enough`
        : "Good Enough";
}
// Turn on the ring animation after the first frame has been drawn
requestAnimationFrame(() => requestAnimationFrame(() => appEl.classList.add("is-ready")));
// ===== The tick: runs 4 times per second =====
function tick() {
    if (phase === "focus" && Date.now() >= endTime) {
        finishFocus();
    }
    else {
        render();
    }
}
// ===== Start everything =====
primaryButton.addEventListener("click", primaryAction);
resetButton.addEventListener("click", reset);
render();
setInterval(tick, 250);
