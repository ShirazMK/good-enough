// ==========================================================
// sound.ts: a soft chime, made with the Web Audio API.
// No sound files needed.
// ==========================================================
let audio = null;
/** Must be called from a click, because browsers block sound before that. */
export function unlockAudio() {
    try {
        if (!audio)
            audio = new AudioContext();
        if (audio.state === "suspended")
            void audio.resume();
    }
    catch {
        audio = null; // no audio support: the app still works silently
    }
}
/** Rising notes when a session ends, falling notes when a break ends. */
export function chime(kind) {
    if (!audio)
        return;
    const notes = kind === "focus-end" ? [659, 784, 988] : [784, 659]; // frequencies in Hz
    const start = audio.currentTime;
    notes.forEach((frequency, i) => {
        if (!audio)
            return;
        const oscillator = audio.createOscillator(); // makes the tone
        const gain = audio.createGain(); // controls the volume
        const t = start + i * 0.18; // each note starts a little later
        oscillator.type = "sine"; // the softest wave shape
        oscillator.frequency.value = frequency;
        // Volume: quickly up, then fade out over almost a second
        gain.gain.setValueAtTime(0, t);
        gain.gain.linearRampToValueAtTime(0.18, t + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.9);
        oscillator.connect(gain).connect(audio.destination); // tone → volume → speakers
        oscillator.start(t);
        oscillator.stop(t + 1);
    });
}
