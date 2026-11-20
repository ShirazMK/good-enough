// ===== Find elements on the page =====
// Looks up an element by CSS selector. If it's missing, we get a
// clear error instead of a confusing bug later.
function $<T extends HTMLElement>(selector: string): T {
  const element = document.querySelector<T>(selector);
  if (!element) throw new Error(`Missing element: ${selector}`);
  return element;
}

const timeEl = $<HTMLParagraphElement>("#time");
const messageEl = $<HTMLParagraphElement>("#message");
const primaryButton = $<HTMLButtonElement>("#primary");

// ===== Settings =====
const sessionMinutes = 50;

// ===== Turn milliseconds into "mm:ss" =====
function formatTime(ms: number): string {
  const totalSeconds = Math.ceil(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

// ===== Show the time when the page loads =====
timeEl.textContent = formatTime(sessionMinutes * 60 * 1000);

// ===== React to a click =====
primaryButton.addEventListener("click", () => {
  messageEl.textContent = "Focus. One thing at a time.";
  console.log("Start was clicked");
});