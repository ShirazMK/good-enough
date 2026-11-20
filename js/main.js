"use strict";
// ===== Find elements on the page =====
function $(selector) {
    const element = document.querySelector(selector);
    if (!element)
        throw new Error(`Missing element: ${selector}`);
    return element;
}
const phaseLabelEl = $("#phase-label");
const timeEl = $("#time");
const messageEl = $("#message");
const primaryButton = $("#primary");
// ===== Settings =====
const MINUTE = 60 * 1000; // one minute in milliseconds
const sessionMinutes = 25;
let phase = "idle";
let endTime = 0; // the moment (in ms) when the session ends
// ===== Helpers =====
function formatTime(ms) {
    const totalSeconds = Math.ceil(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}
function remaining() {
    return Math.max(0, endTime - Date.now());
}
// ===== Actions: they change the state, then redraw =====
function startFocus() {
    phase = "focus";
    endTime = Date.now() + sessionMinutes * MINUTE;
    messageEl.textContent = "Focus. One thing at a time.";
    render();
}
function finishFocus() {
    phase = "focus-done";
    messageEl.textContent = "Good enough. Ship it.";
    render();
}
// ===== Draw the screen from the state =====
function render() {
    if (phase === "idle") {
        phaseLabelEl.textContent = "Ready when you are";
        timeEl.textContent = formatTime(sessionMinutes * MINUTE);
    }
    else if (phase === "focus") {
        phaseLabelEl.textContent = "Focus";
        timeEl.textContent = formatTime(remaining());
    }
    else {
        phaseLabelEl.textContent = "Session done";
        timeEl.textContent = "00:00";
    }
    // The button can't be pressed while the timer runs (Pause comes in Step 6)
    primaryButton.disabled = phase === "focus";
    // Show the time in the browser tab too
    document.title =
        phase === "focus" ? `${formatTime(remaining())} · Focus | Good Enough` : "Good Enough";
}
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
primaryButton.addEventListener("click", startFocus);
render();
setInterval(tick, 250);
