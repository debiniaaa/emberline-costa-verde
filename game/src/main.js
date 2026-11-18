// EMBERLINE: Costa Verde — main.js
// One job: wire everything together. Renderer and camera, input, the title /
// playing / paused / busted / dead state machine, the game loop, saving to
// localStorage, entering and leaving cars, and the window.__emberline hooks
// the screenshot and playtest presets use.

import * as THREE from 'three';
import { SAVE_KEY, PLAYER, STORY, MISSIONS, SHOPS } from './config.js';
import { buildCity } from './world.js';
import { AudioEngine } from './audio.js';
import { TrafficManager, PlayerCar } from './vehicles.js';
import { PedestrianManager } from './pedestrians.js';
import { PoliceManager } from './police.js';
import { CombatSystem } from './combat.js';
import { MissionManager } from './missions.js';
import { HUD } from './hud.js';
import { PlayerController } from './player.js';
import { applyShotPreset, runPlaytest } from './shots.js';

const params = new URLSearchParams(window.location.search);
const errors = [];
window.addEventListener('error', (e) => {
  const detail = e.error && e.error.stack
    ? e.error.stack.split('\n').slice(0, 4).join(' // ')
    : String(e.message || e.error);
  errors.push(detail);
  const el = document.getElementById('errors');
  if (el) el.textContent = errors.join(' | ');
});

export const state = {
  mode: 'title',
  cash: 250,
  health: PLAYER.health,
  ammo: PLAYER.pistolAmmo,
  weapon: 'pistol',
  unlockedMission: 1,
  speedKmh: 0,
  shake: 0,
  errors,
};

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
renderer.shadowMap.enabled = false;
document.getElementById('game-canvas').appendChild(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 1200);

const audio = new AudioEngine();
state.audio = audio;

const world = buildCity(scene);
state.world = world;

const hud = new HUD(state);
state.hud = hud;

const traffic = new TrafficManager(scene, world, state);
state.traffic = traffic;
traffic.seed(16);

const peds = new PedestrianManager(scene, world, state);
state.peds = peds;
peds.seed(22);

const player = new PlayerController(scene, world, state, audio);
state.player = player;
player.reset(0, 60);

const playerCar = new PlayerCar(scene, world, state, audio);
state.playerCar = playerCar;

const police = new PoliceManager(scene, world, state, audio);
state.police = police;

const combat = new CombatSystem(scene, world, state, audio);
state.combat = combat;

const missions = new MissionManager(scene, world, state, audio);
state.missions = missions;

// ---- state methods (defined after the managers exist) ----
state.addHeat = (amount, reason) => police.addHeat(amount, reason);
state.onEnemyKilled = () => missions.onEnemyKilled();
state.damagePlayer = (amount, source) => {
  if (state.mode !== 'playing') return;
  state.health -= amount;
  hud.setHealth(state.health);
  hud.flashDamage();
  if (state.health <= 0) die();
};
state.getBusted = () => {
  if (state.mode !== 'playing') return;
  state.mode = 'busted';
  police.clearWanted();
  const fine = Math.min(state.cash, 200);
  state.cash -= fine;
  hud.setCash(state.cash);
  audio.stopEngine();
  audio.stopSiren();
  document.getElementById('busted-screen').classList.add('show');
  document.getElementById('busted-text').textContent = `Busted by the Costa Verde police. Fine: $${fine}.`;
  save();
};
state.save = () => save();
state.load = () => load();

function save() {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify({
      cash: state.cash,
      health: state.health,
      ammo: state.ammo,
      unlockedMission: state.unlockedMission,
    }));
  } catch (e) { /* private mode: progress just does not persist */ }
}

function load() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return false;
    const data = JSON.parse(raw);
    state.cash = data.cash ?? 250;
    state.health = data.health ?? PLAYER.health;
    state.ammo = data.ammo ?? PLAYER.pistolAmmo;
    state.unlockedMission = data.unlockedMission ?? 1;
    return true;
  } catch (e) {
    return false;
  }
}

function die() {
  state.mode = 'dead';
  audio.stopEngine();
  audio.stopSiren();
  if (missions.current >= 0) missions.failMission('Marina went down.');
  document.getElementById('gameover-screen').classList.add('show');
  save();
}

function respawn() {
  state.health = PLAYER.health;
  state.ammo = PLAYER.pistolAmmo;
  playerCar.leave();
  player.reset(0, 200);
  police.clearWanted();
  hud.setHealth(state.health);
  hud.setAmmo(state.ammo, state.weapon);
  document.getElementById('gameover-screen').classList.remove('show');
  document.getElementById('busted-screen').classList.remove('show');
  state.mode = 'playing';
  save();
}

// ---- input ----
const input = {
  forward: false, back: false, left: false, right: false,
  sprint: false, jump: false, handbrake: false,
};
let cameraYaw = Math.PI;
let cameraPitch = 0.32;
let dragging = false;
let lastMouse = { x: 0, y: 0 };

const KEYMAP = {
  KeyW: 'forward', ArrowUp: 'forward',
  KeyS: 'back', ArrowDown: 'back',
  KeyA: 'left', ArrowLeft: 'left',
  KeyD: 'right', ArrowRight: 'right',
  ShiftLeft: 'sprint', ShiftRight: 'sprint',
  Space: 'jump',
};
window.addEventListener('keydown', (e) => {
  if (e.repeat) return;
  const mapped = KEYMAP[e.code];
  if (mapped) {
    input[mapped] = true;
    if (e.code === 'Space') { input.jump = true; input.handbrake = true; }
    e.preventDefault();
    return;
  }
  if (e.code === 'KeyE') interact();
  if (e.code === 'KeyF') doPunch();
  if (e.code === 'KeyR') reloadOrRetry();
  if (e.code === 'Digit1') setWeapon('pistol');
  if (e.code === 'Digit2') setWeapon('fists');
  if (e.code === 'KeyM') audio.toggleMute();
  if (e.code === 'KeyT') missions.startSideJob('taxi');
  if (e.code === 'KeyC') missions.startSideJob('courier');
  if (e.code === 'KeyN') nextMission();
  if (e.code === 'Escape' || e.code === 'KeyP') togglePause();
});
window.addEventListener('keyup', (e) => {
  const mapped = KEYMAP[e.code];
  if (mapped) {
    input[mapped] = false;
    if (e.code === 'Space') { input.jump = false; input.handbrake = false; }
  }
});
renderer.domElement.addEventListener('mousedown', (e) => {
  audio.ensure();
  if (e.button === 0) {
    if (state.mode === 'playing' && state.weapon === 'pistol' && !playerCar.car) {
      const dir = player.aimDirection(camera);
      const from = camera.position.clone();
      combat.shoot(from, dir);
    } else {
      dragging = true;
      lastMouse = { x: e.clientX, y: e.clientY };
    }
  }
});
window.addEventListener('mouseup', () => { dragging = false; });
window.addEventListener('mousemove', (e) => {
  if (!dragging) return;
  cameraYaw -= (e.clientX - lastMouse.x) * 0.005;
  cameraPitch = THREE.MathUtils.clamp(cameraPitch + (e.clientY - lastMouse.y) * 0.004, 0.08, 1.1);
  lastMouse = { x: e.clientX, y: e.clientY };
});
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

function setWeapon(w) {
  state.weapon = w;
  hud.setAmmo(state.ammo, w);
  hud.message(w === 'pistol' ? 'Pistol ready — click to shoot' : 'Fists ready — press F to punch', 'info');
  audio.click();
}

function reloadOrRetry() {
  if (state.mode === 'playing' && missions.failed) { missions.retryMission(); return; }
  if (state.weapon === 'pistol') {
    if (state.cash >= 100) {
      state.cash -= 100;
      state.ammo = PLAYER.pistolAmmo;
      hud.setCash(state.cash);
      hud.setAmmo(state.ammo, state.weapon);
      hud.message('Ammo restocked (−$100)', 'good');
      audio.pickup();
    } else {
      hud.message('Not enough cash for ammo — earn some first', 'bad');
      audio.denied();
    }
  }
}

function interact() {
  if (state.mode !== 'playing') return;
  audio.ensure();
  if (playerCar.car) {
    // Get out of the car.
    const car = playerCar.leave();
    const side = car.heading + Math.PI / 2;
    player.reset(car.x + Math.sin(side) * 2.6, car.z + Math.cos(side) * 2.6);
    hud.setHint('On foot — E near a car to steal it');
    return;
  }
  // Shop interaction.
  for (const shop of SHOPS) {
    if (Math.hypot(player.pos.x - shop.x, player.pos.z - shop.z) < 6) {
      if (state.cash < 100) { hud.message('Not enough cash ($100)', 'bad'); audio.denied(); return; }
      state.cash -= 100;
      if (shop.kind === 'ammo') { state.ammo = PLAYER.pistolAmmo; hud.setAmmo(state.ammo, state.weapon); }
      else { state.health = PLAYER.health; hud.setHealth(state.health); }
      hud.setCash(state.cash);
      hud.message(shop.kind === 'ammo' ? 'Ammo bought (−$100)' : 'Patched up (−$100)', 'good');
      audio.pickup();
      return;
    }
  }
  // Steal the nearest car.
  const car = traffic.nearestCar(player.pos.x, player.pos.z, 4.5);
  if (car) {
    playerCar.take(car);
    police.addHeat(0.5, 'theft');
    missions.onCarStolen(car);
    missions.onEnterCar();
    hud.setHint('Driving — W/S drive, A/D steer, Space handbrake, E to get out');
    hud.message('Car stolen — the cops noticed', 'bad');
    audio.crash();
  }
}

function doPunch() {
  if (state.mode !== 'playing' || playerCar.car) return;
  combat.punch(player.pos, player.heading);
}

function nextMission() {
  if (state.mode !== 'playing') return;
  if (missions.current >= 0) { hud.message('Finish the current mission first', 'info'); return; }
  if (missions.failed) { missions.retryMission(); return; }
  const next = Math.min(state.unlockedMission, MISSIONS.length);
  if (next > MISSIONS.length) { hud.message('Story complete — free roam, or take side jobs with T / C', 'good'); return; }
  missions.startMission(next - 1);
}

function togglePause() {
  if (state.mode === 'playing') {
    state.mode = 'paused';
    document.getElementById('pause-menu').classList.add('show');
  } else if (state.mode === 'paused') {
    state.mode = 'playing';
    document.getElementById('pause-menu').classList.remove('show');
  }
}

function startGame(fresh) {
  audio.ensure();
  if (fresh) {
    state.cash = 250;
    state.health = PLAYER.health;
    state.ammo = PLAYER.pistolAmmo;
    state.unlockedMission = 1;
    player.reset(0, 60);
    police.clearWanted();
  } else {
    load();
  }
  hud.setCash(state.cash);
  hud.setHealth(state.health);
  hud.setAmmo(state.ammo, state.weapon);
  hud.setStars(police.wanted);
  document.getElementById('title-screen').classList.add('hidden');
  document.getElementById('hud').classList.remove('hidden');
  document.getElementById('howto-panel').classList.add('hidden');
  state.mode = 'playing';
  hud.showBanner('COSTA VERDE', STORY.intro);
  hud.setHint('WASD move · E steal car · Click shoot · F punch · N next mission · T taxi · C courier');
  save();
}

// ---- title / menu wiring ----
document.getElementById('btn-new').addEventListener('click', () => startGame(true));
document.getElementById('btn-continue').addEventListener('click', () => startGame(false));
document.getElementById('btn-howto').addEventListener('click', () => {
  document.getElementById('howto-panel').classList.toggle('hidden');
  audio.ensure();
  audio.click();
});
document.getElementById('btn-resume').addEventListener('click', togglePause);
document.getElementById('btn-restart-mission').addEventListener('click', () => {
  document.getElementById('pause-menu').classList.remove('show');
  state.mode = 'playing';
  if (missions.current >= 0) missions.startMission(missions.current);
});
document.getElementById('btn-quit-title').addEventListener('click', () => {
  document.getElementById('pause-menu').classList.remove('show');
  document.getElementById('hud').classList.add('hidden');
  document.getElementById('title-screen').classList.remove('hidden');
  state.mode = 'title';
  save();
});
document.getElementById('btn-respawn').addEventListener('click', respawn);
document.getElementById('btn-busted-ok').addEventListener('click', respawn);
if (load()) {
  document.getElementById('btn-continue').style.display = 'inline-block';
  document.getElementById('save-note').textContent = `Save found: $${state.cash}, mission ${state.unlockedMission} unlocked.`;
}

// ---- camera ----
const camTarget = new THREE.Vector3();
function updateCamera(dt) {
  const focus = playerCar.car ? playerCar.car.mesh.position : player.pos;
  if (playerCar.car) {
    const car = playerCar.car;
    const behind = car.heading + Math.PI;
    const wantYaw = dragging ? cameraYaw : behind;
    cameraYaw += (wantYaw - cameraYaw) * Math.min(1, dt * 2.5);
    const dist = 11;
    const cx = focus.x + Math.sin(cameraYaw) * dist;
    const cz = focus.z + Math.cos(cameraYaw) * dist;
    camTarget.set(focus.x, 1.4, focus.z);
    const driveTarget = new THREE.Vector3(cx, 5.2, cz);
    // Snap when far (first frames, teleports, or a stalled frame loop) so the
    // chase camera is never left lagging far behind the car.
    if (camera.position.distanceTo(driveTarget) > 25) camera.position.copy(driveTarget);
    else camera.position.lerp(driveTarget, Math.min(1, dt * 6));
    camera.lookAt(camTarget);
  } else {
    const dist = 9.5;
    const cx = focus.x + Math.sin(cameraYaw) * Math.cos(cameraPitch) * dist;
    const cz = focus.z + Math.cos(cameraYaw) * Math.cos(cameraPitch) * dist;
    const cy = focus.y + 2 + Math.sin(cameraPitch) * dist;
    const footTarget = new THREE.Vector3(cx, cy, cz);
    if (camera.position.distanceTo(footTarget) > 25) camera.position.copy(footTarget);
    else camera.position.lerp(footTarget, Math.min(1, dt * 8));
    camTarget.set(focus.x, focus.y + 1.6, focus.z);
    camera.lookAt(camTarget);
  }
  if (state.shake > 0.01) {
    camera.position.x += (Math.random() - 0.5) * state.shake * 0.5;
    camera.position.y += (Math.random() - 0.5) * state.shake * 0.4;
    state.shake = Math.max(0, state.shake - dt * 1.8);
  }
}

// ---- main loop ----
const clock = new THREE.Clock();
let titleOrbit = 0;
function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.05);
  if (state.mode === 'title') {
    titleOrbit += dt * 0.05;
    camera.position.set(Math.sin(titleOrbit) * 190, 70, Math.cos(titleOrbit) * 190);
    camera.lookAt(0, 10, 0);
    traffic.update(dt, player.pos);
    peds.update(dt, player.pos);
    for (const cloud of world.clouds) {
      cloud.position.x += dt * 1.2;
      if (cloud.position.x > 400) cloud.position.x = -400;
    }
    renderer.render(scene, camera);
    return;
  }
  if (state.mode === 'paused') {
    renderer.render(scene, camera);
    return;
  }
  if (state.mode === 'playing') {
    if (playerCar.car) playerCar.update(dt, input);
    else player.update(dt, input, cameraYaw);
    traffic.update(dt, player.pos);
    peds.update(dt, player.pos);
    police.update(dt, player.pos, playerCar.car ? Math.abs(playerCar.speed) : player.speed, !!playerCar.car);
    combat.update(dt, player.pos);
    missions.update(dt);
    hud.update(dt);
    hud.setMissionText(missions.missionTitle());
    hud.setSpeed(state.speedKmh, !!playerCar.car);
    for (const cloud of world.clouds) {
      cloud.position.x += dt * 1.2;
      if (cloud.position.x > 400) cloud.position.x = -400;
    }
    updateCamera(dt);
  }
  renderer.render(scene, camera);
}
animate();

// Screenshot presets (?shot=title|street|drive|chase) and the automated
// playtest (?playtest=1) run after boot, driven by shots.js.
window.__emberline = { state, startGame, version: 'emberline-1.0.0' };
if (params.get('playtest') === '1') {
  runPlaytest(window.__emberline);
} else if (params.get('shot')) {
  applyShotPreset(window.__emberline, params.get('shot'));
}
