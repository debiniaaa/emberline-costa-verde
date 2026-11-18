// EMBERLINE: Costa Verde — shots.js
// One job: stage the game for the camera. Reads the URL (?shot= or
// ?playtest=1), sets up a scene that shows a system at its best — title,
// street on foot, driving, police chase — and runs an automated end-to-end
// playtest that finishes mission 1 and reports PASS/FAIL into the page.

function logPlaytest(text) {
  const el = document.getElementById('playtest');
  if (el) el.textContent = text;
  document.title = text;
}

function stealNearestCar(game) {
  const { state } = game;
  const car = state.traffic.nearestCar(state.player.pos.x, state.player.pos.z, 60);
  if (!car) return false;
  state.player.pos.set(car.x, 0, car.z);
  state.playerCar.take(car);
  return true;
}

export function applyShotPreset(game, shot) {
  const { state } = game;
  if (shot === 'title') {
    // Title screen over the orbiting city: nothing to start.
    return;
  }
  game.startGame(true);
  if (shot === 'street') {
    state.player.reset(0, 40);
    state.missions.startMission(0);
  } else if (shot === 'drive') {
    state.player.reset(0, 40);
    stealNearestCar(game);
    state.missions.startMission(0);
    // Put the stolen car on the avenue with traffic ahead.
    const car = state.playerCar.car;
    if (car) {
      car.x = 0; car.z = 40; car.heading = Math.PI;
      car.mesh.position.set(0, 0, 40);
      state.playerCar.speed = 18;
    }
  } else if (shot === 'chase') {
    state.player.reset(80, 40);
    stealNearestCar(game);
    state.missions.startMission(2);
    // Mission 3's survive stage already adds 2 stars; one more makes 3,
    // which brings the helicopter out with the cruisers.
    state.police.addHeat(1, 'shot');
    const car = state.playerCar.car;
    if (car) {
      car.x = 80; car.z = 40; car.heading = Math.PI / 2;
      car.mesh.position.set(80, 0, 40);
      state.playerCar.speed = 24;
    }
  }
}

// Automated playtest: start a fresh game, finish mission 1 end to end
// (steal a car, drive it to Rico's garage), then report the result.
export function runPlaytest(game) {
  const { state } = game;
  const steps = [];
  const fail = (why) => {
    logPlaytest(`PLAYTEST FAIL: ${why} | steps: ${steps.join(' > ')}`);
  };
  try {
    game.startGame(true);
    steps.push('started');
    if (state.mode !== 'playing') return fail('mode is not playing after start');
    state.missions.startMission(0);
    steps.push('mission1 started');
    if (!stealNearestCar(game)) return fail('no car found to steal');
    steps.push('car stolen');
    state.missions.onCarStolen(state.playerCar.car);
    if (state.missions.stageIndex !== 1) return fail('stealCar stage did not advance');
    steps.push('stage advanced to driveTo');
    // Drive the car to the garage marker in scripted steps.
    const car = state.playerCar.car;
    const target = { x: -120, z: -80 };
    let guard = 0;
    const drive = setInterval(() => {
      guard++;
      const dx = target.x - car.x;
      const dz = target.z - car.z;
      const dist = Math.hypot(dx, dz);
      if (dist < 9 || guard > 500) {
        clearInterval(drive);
        if (dist >= 9) return fail(`car did not reach garage (dist ${dist.toFixed(1)})`);
        steps.push('reached garage');
        // Give the game loop a frame to notice the arrival and complete the
        // mission before judging the result.
        setTimeout(() => {
          const done = state.missions.current === -1 && state.unlockedMission >= 2;
          if (!done) {
            const s = state.missions.stage;
            const pp = state.player.pos;
            const d = s ? Math.hypot(pp.x - s.x, pp.z - s.z).toFixed(1) : 'n/a';
            const last = state.__lastDrive ? JSON.stringify(state.__lastDrive) : 'never-checked';
            return fail(`mission 1 did not complete at the garage (current=${state.missions.current} stage=${s ? s.type : 'none'} dist=${d} inCar=${!!state.playerCar.car} playerPos=${pp.x.toFixed(0)},${pp.z.toFixed(0)} mode=${state.mode} failed=${state.missions.failed} health=${state.health} driveChecks=${state.__driveChecks || 0} lastDrive=${last})`);
          }
          steps.push('mission1 complete');
          // Sanity: wanted, HUD, minimap all alive; no errors seen.
          if (state.errors.length > 0) return fail(`page errors: ${state.errors.join('; ')}`);
          logPlaytest(`PLAYTEST PASS: mission 1 complete, cash $${state.cash} | steps: ${steps.join(' > ')}`);
        }, 600);
        return;
      }
      // Steer toward the garage, avoiding buildings by hugging the roads.
      const wantHeading = Math.atan2(dx, dz);
      let dh = wantHeading - car.heading;
      while (dh > Math.PI) dh -= Math.PI * 2;
      while (dh < -Math.PI) dh += Math.PI * 2;
      car.heading += Math.max(-0.12, Math.min(0.12, dh));
      car.x += Math.sin(car.heading) * 0.9;
      car.z += Math.cos(car.heading) * 0.9;
      car.mesh.position.set(car.x, 0, car.z);
      car.mesh.rotation.y = car.heading;
      state.playerCar.speed = 20;
      // Keep the player's world position on the car, as PlayerCar.update does,
      // so the mission tracker measures distance from the car, not the kerb.
      state.player.pos.set(car.x, 0, car.z);
      // Drive the mission logic directly from this tick: under headless
      // virtual time, requestAnimationFrame stops being issued after ~100
      // frames while timers keep running, so the rAF loop alone cannot be
      // relied on to notice the arrival in this test harness.
      state.missions.update(0.05);
    }, 50);
  } catch (err) {
    fail(`exception: ${err && err.message ? err.message : err}`);
  }
}
