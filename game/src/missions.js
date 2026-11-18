// EMBERLINE: Costa Verde — 8-mission story chain plus repeatable
// taxi and courier side jobs. One clear job per mission step; objective
// text, a gold beacon and the minimap all point at the same target.
(function () {
  'use strict';
  var CV = window.CV;

  var MISSIONS = [
    { id: 1, title: 'First Errand', giver: 'Sol Vega (fixer)',
      brief: 'Pick up the package at the plaza, deliver it to the marina. Sol is watching.',
      reward: 400,
      steps: [
        { type: 'goto', x: 40, z: 20, r: 5, label: 'Pick up the package at the plaza' },
        { type: 'goto', x: -120, z: 200, r: 6, label: 'Deliver the package to the marina' },
      ] },
    { id: 2, title: 'The Coupe', giver: 'Marisol Reyes (smuggler)',
      brief: 'A gold coupe is parked uptown. Take it — quietly — and bring it to the port warehouse.',
      reward: 600,
      steps: [
        { type: 'steal', x: 120, z: -80, label: 'Steal the gold coupe uptown' },
        { type: 'goto', x: 120, z: -148, r: 7, label: 'Deliver the coupe to the port warehouse' },
      ] },
    { id: 3, title: 'Hot Delivery', giver: 'Sol Vega (fixer)',
      brief: 'Sixty seconds, cross-town, no excuses. The client pays double for speed.',
      reward: 500,
      steps: [
        { type: 'goto', x: -80, z: 120, r: 5, label: 'Grab the parcel at the west garage' },
        { type: 'goto', x: 120, z: 120, r: 6, label: 'Deliver across town — 60s!', timer: 60 },
      ] },
    { id: 4, title: 'Three Stops', giver: 'Marisol Reyes (smuggler)',
      brief: 'Three drops, one route. Keep the engine warm and the cops cold.',
      reward: 700,
      steps: [
        { type: 'goto', x: 0, z: -120, r: 5, label: 'Drop 1: north avenue' },
        { type: 'goto', x: -120, z: 0, r: 5, label: 'Drop 2: west boulevard' },
        { type: 'goto', x: 80, z: 160, r: 5, label: 'Drop 3: south marina road' },
      ] },
    { id: 5, title: 'Getaway Driver', giver: 'Sol Vega (fixer)',
      brief: 'The meet went loud. Lose the heat and get to the causeway — alive.',
      reward: 900,
      steps: [
        { type: 'goto', x: 40, z: -40, r: 5, label: 'Reach the meet point', heat: 3 },
        { type: 'goto', x: 0, z: 196, r: 7, label: 'Escape to the causeway underpass' },
      ] },
    { id: 6, title: 'The Rival', giver: 'Marisol Reyes (smuggler)',
      brief: 'Rook\'s crew wants a sit-down. Show up, hear them out, then vanish.',
      reward: 1000,
      steps: [
        { type: 'goto', x: -160, z: 80, r: 5, label: 'Meet Rook\'s crew at the west docks' },
        { type: 'wait', t: 5, label: 'Hear them out — stay put' },
        { type: 'goto', x: 160, z: -160, r: 7, label: 'Leave — fast. Heat is coming.', heat: 2 },
      ] },
    { id: 7, title: 'Port Run', giver: 'Sol Vega (fixer)',
      brief: 'A truckload of "spare parts" needs to be at the causeway in 75 seconds.',
      reward: 1200,
      steps: [
        { type: 'steal', x: 160, z: -120, label: 'Take the marked truck at the port' },
        { type: 'goto', x: 0, z: 196, r: 7, label: 'Deliver to the causeway — 75s!', timer: 75 },
      ] },
    { id: 8, title: 'The Finale', giver: 'Sol Vega (fixer)',
      brief: 'One last job. Downtown, four stars, thirty seconds of thunder — then the lighthouse road.',
      reward: 2000,
      steps: [
        { type: 'goto', x: 0, z: 0, r: 6, label: 'Reach downtown — heat is coming', heat: 4 },
        { type: 'survive', t: 30, label: 'Survive the heat — 30s!' },
        { type: 'goto', x: 200, z: -200, r: 8, label: 'Vanish down the lighthouse road' },
      ] },
  ];

  var JOB_STANDS = [
    { x: -40, z: -40, kind: 'taxi', label: 'Taxi stand' },
    { x: 80, z: 40, kind: 'taxi', label: 'Taxi stand' },
    { x: 152, z: -120, kind: 'courier', label: 'Courier depot' },
  ];

  var current = null;    // {mission, step, timer, markedCar}
  var job = null;        // {kind, phase, x, z, timer, pay, passenger}
  var danger = null;

  function missionDef(i) { return MISSIONS[i] || null; }

  function setObjective(text, x, z) {
    CV.G.objective = text;
    CV.G.objectivePos = (x !== undefined && x !== null) ? { x: x, z: z } : null;
    CV.World.setBeacon(x || 0, z || 0, x !== undefined && x !== null);
    if (CV.HUD) CV.HUD.setObjective(text);
  }

  function startStep() {
    var step = current.mission.steps[current.step];
    current.timer = step.timer || 0;
    current.waitLeft = step.t || 0;
    if (step.heat) CV.G.wanted = Math.max(CV.G.wanted, step.heat);
    if (step.type === 'steal') {
      current.markedCar = CV.Vehicles.make(0xffd24a, step.x, step.z, 0, { kind: 'marked' });
      current.markedCar.driver = null;
      CV.Vehicles.parked.push(current.markedCar);
      setObjective(step.label, step.x, step.z);
    } else if (step.type === 'goto') {
      setObjective(step.label, step.x, step.z);
    } else if (step.type === 'wait' || step.type === 'survive') {
      setObjective(step.label, null, null);
    }
  }

  function completeStep() {
    var step = current.mission.steps[current.step];
    if (step.type === 'steal' && current.markedCar) {
      current.markedCar.kind = 'civilian';
    }
    current.step++;
    if (current.step >= current.mission.steps.length) {
      completeMission();
    } else {
      startStep();
    }
  }

  function completeMission() {
    var m = current.mission;
    CV.G.cash += m.reward;
    CV.G.missionIndex++;
    CV.Save.write();
    if (CV.HUD) CV.HUD.showBanner('Mission complete: ' + m.title, '+$' + m.reward);
    CV.Audio.chime(true);
    if (m.id === 1 && !CV.G.pistol) {
      CV.G.pistol = true;
      CV.Save.write();
      if (CV.HUD) CV.HUD.toast('Pistol unlocked — click to shoot!');
    }
    current = null;
    if (CV.G.missionIndex >= MISSIONS.length) {
      setObjective('Story complete — free roam! Take jobs at the gold markers.', null, null);
      if (CV.HUD) CV.HUD.showBanner('STORY COMPLETE', 'Costa Verde is yours.');
    } else {
      startMission(CV.G.missionIndex);
    }
  }

  function failMission(reason) {
    if (CV.HUD) CV.HUD.showBanner('Mission failed', reason);
    CV.Audio.chime(false);
    if (current && current.markedCar) {
      CV.Vehicles.remove(current.markedCar);
      current.markedCar = null;
    }
    current = null;
    startMission(CV.G.missionIndex);
  }

  function startMission(i) {
    var def = missionDef(i);
    if (!def) return;
    current = { mission: def, step: 0, timer: 0, waitLeft: 0, markedCar: null };
    if (CV.HUD) CV.HUD.toast('New mission: ' + def.title + ' — ' + def.giver);
    startStep();
  }

  CV.Missions = {
    list: MISSIONS,
    stands: JOB_STANDS,
    init: function () {
      if (CV.G.missionIndex < MISSIONS.length) startMission(CV.G.missionIndex);
      else setObjective('Story complete — free roam! Take jobs at the gold markers.', null, null);
    },
    onDanger: function (x, z, radius) {
      danger = { x: x, z: z, radius: radius, until: CV.G.time + 3 };
    },
    getDanger: function () {
      if (danger && CV.G.time < danger.until) return danger;
      return null;
    },
    update: function (dt) {
      var px = CV.G.playerPos.x, pz = CV.G.playerPos.z;
      // Story mission.
      if (current) {
        var step = current.mission.steps[current.step];
        if (step.timer) {
          current.timer -= dt;
          if (current.timer <= 0) { failMission('Out of time!'); return; }
        }
        if (step.type === 'goto') {
          if (CV.dist2d(px, pz, step.x, step.z) < step.r) completeStep();
        } else if (step.type === 'steal') {
          if (CV.G.driving === current.markedCar) completeStep();
        } else if (step.type === 'wait') {
          current.waitLeft -= dt;
          if (current.waitLeft <= 0) completeStep();
        } else if (step.type === 'survive') {
          current.waitLeft -= dt;
          if (CV.G.wanted < 1) CV.G.wanted = 1;
          if (current.waitLeft <= 0) completeStep();
        }
      }
      // Side job.
      if (job) {
        if (job.timer > 0) {
          job.timer -= dt;
          if (job.timer <= 0) {
            if (CV.HUD) CV.HUD.toast('Job failed — too slow.');
            CV.Missions.endJob(false);
            return;
          }
        }
        if (job.phase === 'pickup') {
          if (CV.dist2d(px, pz, job.x, job.z) < 5) {
            job.phase = 'deliver';
            var dest = CV.World.randomRoadPoint();
            job.x = dest.x; job.z = dest.z;
            setObjective(job.kind === 'taxi' ? 'Drive the passenger to the marker' : 'Deliver the package to the marker', job.x, job.z);
            if (CV.HUD) CV.HUD.toast(job.kind === 'taxi' ? 'Passenger aboard!' : 'Package collected!');
          }
        } else if (job.phase === 'deliver') {
          if (CV.dist2d(px, pz, job.x, job.z) < 6) {
            CV.G.cash += job.pay;
            CV.G.jobsDone++;
            CV.Save.write();
            if (CV.HUD) CV.HUD.showBanner('Job done', '+$' + job.pay);
            CV.Audio.chime(true);
            CV.Missions.endJob(true);
            if (!current) setObjective('Free roam — take jobs at the gold markers.', null, null);
          }
        }
      }
      // Job stand proximity hint.
      if (!job) {
        for (var i = 0; i < JOB_STANDS.length; i++) {
          var s = JOB_STANDS[i];
          if (CV.dist2d(px, pz, s.x, s.z) < 6) {
            CV.Missions.startJob(s.kind);
            break;
          }
        }
      }
    },
    startJob: function (kind) {
      if (job) return;
      var start = CV.World.randomRoadPoint();
      job = {
        kind: kind, phase: 'pickup',
        x: start.x, z: start.z,
        timer: kind === 'taxi' ? 50 : 70,
        pay: kind === 'taxi' ? 150 : 120,
      };
      setObjective(kind === 'taxi' ? 'Pick up the passenger at the marker' : 'Pick up the package at the marker', job.x, job.z);
      if (CV.HUD) CV.HUD.toast(kind === 'taxi' ? 'Taxi job started!' : 'Courier job started!');
    },
    endJob: function (done) {
      job = null;
      if (current) startStep();
      else setObjective('Free roam — take jobs at the gold markers.', null, null);
    },
    tryStartJob: function () {
      if (job) {
        if (CV.HUD) CV.HUD.toast('Job already running — follow the gold marker.');
        return;
      }
      var px = CV.G.playerPos.x, pz = CV.G.playerPos.z;
      for (var i = 0; i < JOB_STANDS.length; i++) {
        var s = JOB_STANDS[i];
        if (CV.dist2d(px, pz, s.x, s.z) < 12) { this.startJob(s.kind); return; }
      }
      if (CV.HUD) CV.HUD.toast('No job here — find a gold marker (taxi stands, courier depot).');
    },
    resetOnDeath: function () {
      // Wasted / busted during a mission: restart the current mission.
      if (current) {
        if (current.markedCar) { CV.Vehicles.remove(current.markedCar); current.markedCar = null; }
        current = null;
        startMission(CV.G.missionIndex);
      }
      if (job) { job = null; }
    },
  };
})();
