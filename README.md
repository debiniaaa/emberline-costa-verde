# EMBERLINE: Costa Verde

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/debiniaaa/emberline-costa-verde/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/debiniaaa/emberline-costa-verde/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

An original open-world crime game for [make.fun's Make GTA 6 bounty](https://make.fun/bounty/gta6-01) — a full island city you can explore on foot and by car, built by an AI agent from scratch.

## The game

Costa Verde is a sun-soaked island city ringed by sea: a downtown grid, beach resorts, a working port with cranes and containers, a marina full of boats, palm avenues and a lighthouse on its own little islet. Everything runs from static files in `game/` — no build step, no network, just open `index.html` through the included server.

**What you can do:**

- **Explore on foot and by car** — walk the sidewalks, then press `E` to steal any car you find and drive it.
- **Live the city** — traffic follows the road grid, pedestrians stroll the sidewalks and run from trouble.
- **Climb the wanted ladder (1–5 stars)** — theft, crashes, assaults and gunfire draw the police. Cruisers chase and ram you; a bust meter fills when they pin you down.
- **Outrun the helicopter** — at 3 stars a police helicopter joins the chase with a searchlight and keeps the heat locked on. Break its sight in a cover zone (the causeway underpass, the port warehouse or the parking garage) or outrun it.
- **Play an 8-mission story** — fixer Sol Vega and smuggler Marisol Reyes send you on timed deliveries, a coupe theft, a multi-stop courier run, a forced-heat getaway and a finale under four stars, with cash rewards and a pistol unlocked after the first job.
- **Work side jobs** — taxi fares and courier deliveries at the gold markers around town.
- **Fight back** — melee attacks and a pistol once unlocked, with health, hospital respawns and police fines.
- **Keep your progress** — cash, story progress and the pistol are saved to localStorage.

Sound is fully synthesized in code (engine, sirens, rotor, gunshots, chimes, music) — there are no audio files.

## How to play

```sh
node serve.ts        # serves game/ on http://localhost:8080
```

Then open the page, click **START NEW GAME** (or **CONTINUE** if you have a save), and drive.

**Controls:** WASD / arrows to move and drive · drag the mouse to look around · `E` enter / exit a car · `F` melee · click to shoot (once the pistol is unlocked) · `J` jobs · `P` / `Esc` pause.

## Photo mode

The game supports deterministic posed scenes for screenshots: open `?shot=cover`, `?shot=street`, `?shot=drive` or `?shot=chase` to jump straight into a staged scene.

## Structure

- `game/index.html` — the page, HUD and menus
- `game/src/` — one job per file: `config` (state + seeded RNG), `world` (island city), `vehicles` (cars + driving), `traffic` (AI cars), `pedestrians`, `police` (pursuit + helicopter), `player`, `combat`, `missions` (story + side jobs), `hud` (HUD + minimap), `audio` (synth sound), `save`, `shots` (photo mode), `main` (boot + loop)
- `game/vendor/three.min.js` — three.js (vendored, minified)
- `main.ts` — the entry program: copies `game/` and `screenshots/` and writes `dossier.json`
- `screenshots/` — four real renders of the game

Built with [make.fun](https://make.fun/?ref=gs2esb70) — an original game, no third-party IP.
