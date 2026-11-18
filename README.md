# EMBERLINE: Costa Verde

An original open-world crime game for the make.fun gta6-01 bounty — built from
scratch in this repository. No Rockstar / GTA names, characters, map, art or
music: the city, people, vehicles, story and sounds are all original.

## The game

Marina Sol returns to **Costa Verde**, a sun-soaked coastal city, to settle a
score with Don Esteban Marlow — the man who burned her brother's garage.
Fixer Rico Vega has the jobs; the city has the rest.

- **Open world on foot and by car** — a grid city of streets, towers, a plaza,
  docks, a marina and a beach, explored in third person with a chase camera.
- **Traffic and pedestrians** — cars cruise the avenues and stop for each
  other; locals stroll the sidewalks and flee from gunfire.
- **Car theft** — walk up to any car, press E, and it's yours. The cops notice.
- **Wanted system, 1–5 stars** — crimes raise heat; police cruisers chase and
  ram; at 3 stars a helicopter joins with a spotlight; get caught slow and
  close and you're **busted**.
- **Combat** — pistol (hitscan, tracers, muzzle flash) and fists, against
  armed enemies who shoot back.
- **Story: 8 missions** — First Wheels, Courier Run, Getaway Driver, The
  Shakedown, Harbor Heist Setup, High-Speed Chase, The Informant, and the
  Emberline Finale — with dialogue, objectives, timers, fail and retry.
- **Side jobs** — taxi fares (T) and courier drops (C) for quick cash.
- **HUD + minimap** — health, cash, wanted stars, mission tracker, timer,
  speed, ammo, live minimap with blips, damage vignette and bust meter.
- **Title screen, pause menu, save** — progress (cash, mission unlocks) saves
  to localStorage; continue where you left off.
- **Sound** — a synthesized sunset synthwave loop and effects (gunshots,
  sirens, engine, crashes, jingles), all generated live with WebAudio.
  No audio files.

## Controls

WASD / arrows move & drive · Shift sprint · mouse drag look · click shoot ·
E steal/enter/exit car · F punch · Space jump / handbrake · 1/2 pistol/fists ·
R buy ammo ($100) or retry mission · N next mission · T taxi · C courier ·
P/Esc pause · M mute.

## Play it

Serve `game/` with any static server and open `index.html` in desktop Chrome:

```
cd game && python3 -m http.server 8080
```

No network requests are made; Three.js is vendored under `game/vendor/`.

## Layout

- `main.ts` — the entry program: copies `game/` + `screenshots/` to the
  output dir and writes `dossier.json` via `vendor/makefun-game.ts`.
- `game/index.html` — page shell, HUD, menus.
- `game/src/config.js` — constants, story, mission definitions.
- `game/src/world.js` — the city: streets, buildings, beach, ocean, plaza.
- `game/src/vehicles.js` — car meshes, traffic AI, player car physics.
- `game/src/pedestrians.js` — the people of Costa Verde.
- `game/src/police.js` — wanted stars, cruisers, helicopter, bust meter.
- `game/src/combat.js` — pistol, fists, armed enemies.
- `game/src/missions.js` — story missions and side jobs.
- `game/src/hud.js` — HUD, dialogue, banners, minimap.
- `game/src/player.js` — Marina on foot.
- `game/src/audio.js` — synthesized music and sound effects.
- `game/src/main.js` — renderer, camera, input, state machine, game loop.
- `game/src/shots.js` — screenshot scene presets and the automated playtest.
- `game/vendor/three.module.min.js` — Three.js r160 (MIT), vendored.

## License

MIT — see `LICENSE`.
