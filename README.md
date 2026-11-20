# ⏱️ Good Enough

**A focus timer for perfectionists.** Fixed sessions keep you moving, a small budget of extra time lets you finish that one last step, and your break grows with the work you actually did.

> 🚧 Work in progress. I'm building this step by step to learn TypeScript and frontend development.

## Why I'm building it

I'm a perfectionist. Normal Pomodoro timers interrupt me exactly when I'm one step away from finishing, and without a timer I never stop polishing. So I'm building a timer that is flexible, but only a little, and never forever.

## Features

- [x] Countdown timer that stays accurate even in background tabs
- [x] Pause, resume and reset
- [x] Progress ring that fills up as you work
- [x] Session lengths from 25 to 90 minutes, remembered between visits
- [x] Limited pauses (one per 25 minutes, 3 minutes each) that resume by themselves
- [ ] "Just one more step": +5 / +10 minutes from a limited budget
- [ ] Breaks that grow with the time you worked
- [ ] Today's stats, sound, dark/light mode
- [ ] Tests and live version on GitHub Pages

## The rules

| Session | Extra time | Pauses (3 min each) | Break |
|---|---|---|---|
| 25 min | 10 min | 1 | 5 min |
| 35 min | 15 min | 1 | 7 min |
| 50 min | 25 min | 2 | 10 min |
| 60 min | 30 min | 2 | 12 min |
| 75 min | 15 min | 3 | 15 min |
| 90 min | 0 min | 3 | 18 min |

- **Extra time** is half the session, rounded down to steps of 5, but a session never goes past 90 minutes in total.
- **Pauses**: one per full 25 minutes.
- **Break**: one fifth of the minutes actually worked, at least 5.

## How it works

- **End-time timer:** instead of counting down second by second, the app stores *when* the session ends and calculates the time left on every tick. It stays accurate when the browser slows down background tabs.
- **State machine:** the app is always in one phase (`idle`, `focus`, `paused`, `focus-done`), and `render()` draws the screen from that state.
- **Rules as pure functions** in `src/budget.ts`, separate from the user interface.

## Tech

TypeScript · HTML · CSS. No frameworks.

## Run it locally

```bash
npm install
npm run watch   # compiles TypeScript from src/ to js/
```
Then open `index.html` with VS Code's **Live Server** extension, or run `npx serve .`.