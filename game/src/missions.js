// EMBERLINE: Costa Verde — missions.js
// One job: the story. Eight story missions plus taxi and courier side jobs:
// stages, markers, dialogue, timers, fail/retry, rewards and progression.

import * as THREE from 'three';
import { MISSIONS, DIALOGUE, SIDE_JOBS, mulberry32 } from './config.js';
import { buildPersonMesh } from './pedestrians.js';
import { nearestRoadPoint } from './world.js';

function makeBeacon() {
  const group = new THREE.Group();
  const beam = new THREE.Mesh(
    new THREE.CylinderGeometry(1.1, 1.1, 60, 12, 1, true),
    new THREE.MeshBasicMaterial({ color: 0xffd23a, transparent: true, opacity: 0.22, side: THREE.DoubleSide, depthWrite: false }),
  );
  beam.position.y = 30;
  group.add(beam);
  const diamond = new THREE.Mesh(
    new THREE.OctahedronGeometry(1.4),
    new THREE.MeshBasicMaterial({ color: 0xffd23a }),
  );
  diamond.position.y = 5;
  group.add(diamond);
  group.userData.diamond = diamond;
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(2.4, 3.0, 24),
    new THREE.MeshBasicMaterial({ color: 0xffd23a, transparent: true, opacity: 0.8, side: THREE.DoubleSide }),
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.12;
  group.add(ring);
  group.visible = false;
  return group;
}

export class MissionManager {
  constructor(scene, world, state, audio) {
    this.scene = scene;
    this.world = world;
    this.state = state;
    this.audio = audio;
    this.rng = mulberry32(2026);
    this.beacon = makeBeacon();
    this.scene.add(this.beacon);
    this.current = -1;          // index into MISSIONS, -1 = free roam
    this.stageIndex = 0;
    this.stageState = {};
    this.timer = 0;
    this.failed = false;
    this.sideJob = null;        // { kind, stage, passenger, dest }
    this.targetCar = null;
    this.pickupMesh = null;
    this.informant = null;
    this.shopkeepers = [];
  }

  get def() { return this.current >= 0 ? MISSIONS[this.current] : null; }
  get stage() { return this.def ? this.def.stages[this.stageIndex] : null; }

  missionTitle() {
    if (this.sideJob) return SIDE_JOBS[this.sideJob.kind].text;
    if (!this.def) return 'Free roam — press M for the next mission';
    return `${this.def.title}: ${this.stageText()}`;
  }

  stageText() {
    const s = this.stage;
    if (!s) return '';
    if (s.type === 'kill') return s.text.replace(/\(\d+\/\d+\)/, `(${this.stageState.kills || 0}/${s.count})`);
    if (s.type === 'intimidate') return s.text.replace(/\(\d+\/\d+\)/, `(${this.stageState.count || 0}/${s.count})`);
    return s.text;
  }

  startMission(index) {
    const def = MISSIONS[index];
    if (!def) return;
    this.current = index;
    this.stageIndex = 0;
    this.stageState = {};
    this.failed = false;
    this.timer = def.timer || 0;
    this.clearStageActors();
    this.state.hud.showBanner(`MISSION ${def.id}: ${def.title}`, def.brief);
    this.state.hud.showDialogue(DIALOGUE[`m${def.id}`] || []);
    this.audio.missionStart();
    this.setupStage();
    this.state.save();
  }

  setupStage() {
    const s = this.stage;
    if (!s) return;
    this.clearStageActors();
    this.stageState = { kills: 0, count: 0, plant: 0, wave: 0 };
    if (s.x !== undefined) this.placeBeacon(s.x, s.z);
    else this.beacon.visible = false;
    if (s.type === 'intimidate') this.spawnShopkeepers();
    if (s.type === 'kill') this.spawnEnemyWave(s);
    if (s.type === 'tail') this.spawnTargetCar();
    if (s.type === 'stealCar' && s.truck) {
      // Mission 5: park a hardware truck at the docks so the player is never
      // stuck hunting for a rare truck in traffic.
      this.state.traffic.spawnCar(240, 150, Math.PI, 'truck');
      this.placeBeacon(240, 150);
    }
    if (s.type === 'goto' && this.current === 2) {
      // Mission 3: Rico waits at the bank.
      this.spawnRico();
    }
    if (s.type === 'goto' && this.current === 6) {
      // Mission 7: the informant waits at the plaza.
      this.spawnInformant();
    }
    if (this.current === 7 && s.type === 'survive') {
      this.state.police.addHeat(5, 'finale');
    }
    if (this.current === 2 && s.type === 'survive') {
      this.state.police.addHeat(2, 'getaway');
    }
  }

  placeBeacon(x, z) {
    this.beacon.position.set(x, 0, z);
    this.beacon.visible = true;
  }

  clearStageActors() {
    for (const sk of this.shopkeepers) this.state.peds.removePed(sk);
    this.shopkeepers = [];
    if (this.targetCar) {
      this.state.traffic.removeCar(this.targetCar);
      this.targetCar = null;
    }
    if (this.pickupMesh) {
      this.scene.remove(this.pickupMesh);
      this.pickupMesh = null;
    }
    if (this.informant) {
      this.state.peds.removePed(this.informant);
      this.informant = null;
    }
  }

  spawnShopkeepers() {
    // Shopkeepers wait on street corners, never inside a building.
    const spots = [[-40, 6], [160, 40], [120, -154]];
    for (const [x, z] of spots) {
      const sk = this.state.peds.spawnPed(x, z, 'shopkeeper');
      sk.name = 'SHOPKEEPER';
      this.shopkeepers.push(sk);
      this.state.hud.showMessage('A shopkeeper waits at the marked shop — lean on them', 'info');
    }
    this.placeBeacon(spots[0][0], spots[0][1]);
  }

  spawnEnemyWave(stage) {
    const waveSize = stage.waves ? Math.ceil(stage.count / stage.waves) : stage.count;
    const base = this.stage && this.stage.x !== undefined
      ? { x: this.stage.x, z: this.stage.z }
      : { x: this.state.player.pos.x + 20, z: this.state.player.pos.z + 20 };
    const spots = this.current === 4
      ? [[228, 148], [240, 160], [220, 168], [236, 140]]
      : this.current === 6
        ? [[-12, 8], [12, -8], [8, 14], [-14, -6], [0, 18], [18, 0]]
        : [[252, 220], [268, 232], [244, 244], [260, 216], [232, 228], [276, 244], [248, 208], [224, 236]];
    for (let i = 0; i < waveSize; i++) {
      const [x, z] = spots[(this.stageState.wave * waveSize + i) % spots.length];
      this.state.combat.spawnEnemy(x, z);
    }
    this.stageState.wave++;
  }

  spawnRico() {
    const rico = this.state.peds.spawnPed(80, 40, 'rico');
    rico.name = 'RICO VEGA';
    this.state.hud.showMessage('Rico is waiting at the bank', 'info');
  }

  spawnInformant() {
    this.informant = this.state.peds.spawnPed(0, 6, 'informant');
    this.informant.name = 'THE INFORMANT';
  }

  spawnTargetCar() {
    const car = this.state.traffic.spawnCar(160, 240, Math.PI / 2);
    car.isTarget = true;
    car.cruise = 20;
    car.hp = 100;
    this.targetCar = car;
    this.state.hud.showMessage('There is the courier — run him off the road!', 'info');
  }

  advanceStage() {
    this.stageIndex++;
    if (this.stageIndex >= this.def.stages.length) {
      this.completeMission();
      return;
    }
    this.audio.pickup();
    this.setupStage();
  }

  completeMission() {
    const def = this.def;
    this.state.cash += def.reward;
    this.state.hud.showBanner(`MISSION COMPLETE — ${def.title}`, `+$${def.reward} — Rico will call with the next job.`);
    this.state.hud.setCash(this.state.cash);
    this.audio.missionComplete();
    this.beacon.visible = false;
    this.clearStageActors();
    this.state.unlockedMission = Math.max(this.state.unlockedMission, this.current + 2);
    this.current = -1;
    this.stageIndex = 0;
    this.state.save();
  }

  failMission(reason) {
    if (this.current < 0 || this.failed) return;
    this.failed = true;
    this.audio.missionFail();
    this.state.hud.showBanner('MISSION FAILED', `${reason} — press R to retry.`);
    this.beacon.visible = false;
    this.clearStageActors();
  }

  retryMission() {
    if (!this.failed || this.current < 0) return;
    const idx = this.current;
    this.failed = false;
    this.startMission(idx);
  }

  onEnemyKilled() {
    const s = this.stage;
    if (!s || s.type !== 'kill' || this.failed) return;
    this.stageState.kills = (this.stageState.kills || 0) + 1;
    if (s.waves && this.stageState.kills < s.count && this.stageState.kills % Math.ceil(s.count / s.waves) === 0) {
      this.spawnEnemyWave(s);
      this.state.hud.showMessage('More hitters incoming!', 'bad');
    }
    if (this.stageState.kills >= s.count) this.advanceStage();
  }

  onIntimidated(ped) {
    const s = this.stage;
    if (!s || s.type !== 'intimidate' || this.failed) return;
    if (ped.role !== 'shopkeeper' || ped.intimidated) return;
    ped.intimidated = true;
    this.stageState.count = (this.stageState.count || 0) + 1;
    this.state.cash += 150;
    this.state.hud.setCash(this.state.cash);
    this.state.hud.showMessage(`Shopkeeper paid up (+$150) — ${this.stageState.count}/${s.count}`, 'good');
    this.audio.pickup();
    const next = this.shopkeepers.find((k) => !k.intimidated);
    if (next) this.placeBeacon(next.x, next.z);
    if (this.stageState.count >= s.count) this.advanceStage();
  }

  onCarStolen(car) {
    const s = this.stage;
    if (!s || this.failed) return;
    if (s.type === 'stealCar') {
      if (s.truck && car.mesh.userData.kind !== 'truck') {
        this.state.hud.showMessage('Rico needs the TRUCK, not that car', 'bad');
        return;
      }
      this.advanceStage();
    }
  }

  onEnterCar() {
    const s = this.stage;
    if (s && s.type === 'enterCar') this.advanceStage();
  }

  dropPickup(x, z) {
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.9, 0.6, 0.3),
      new THREE.MeshLambertMaterial({ color: 0x3a3a22 }),
    );
    mesh.position.set(x, 0.5, z);
    this.scene.add(mesh);
    this.pickupMesh = mesh;
    this.placeBeacon(x, z);
  }

  // ---- side jobs ----
  startSideJob(kind) {
    if (this.sideJob || this.current >= 0) return;
    // Snap the pickup point onto a road so a car can always reach it.
    const p = nearestRoadPoint(this.state.player.pos.x + 40, this.state.player.pos.z + 30);
    if (kind === 'taxi') {
      const passenger = this.state.peds.spawnPed(p.x, p.z, 'fare');
      passenger.name = 'FARE';
      const dest = { x: -160 + Math.floor(this.rng() * 5) * 80, z: -160 + Math.floor(this.rng() * 5) * 80 };
      this.sideJob = { kind, stage: 'pickup', passenger, dest };
      this.placeBeacon(p.x, p.z);
      this.state.hud.showMessage('Taxi fare waiting — pick them up in a car', 'info');
    } else {
      const dest = { x: -160 + Math.floor(this.rng() * 5) * 80, z: -160 + Math.floor(this.rng() * 5) * 80 };
      this.sideJob = { kind, stage: 'pickup', parcel: p, dest };
      this.placeBeacon(p.x, p.z);
      this.state.hud.showMessage('Parcel waiting — grab it (walk or drive)', 'info');
    }
    this.audio.phoneRing();
  }

  finishSideJob() {
    const job = this.sideJob;
    if (!job) return;
    const fare = SIDE_JOBS[job.kind].fare;
    this.state.cash += fare;
    this.state.hud.setCash(this.state.cash);
    this.state.hud.showMessage(`${job.kind === 'taxi' ? 'Fare' : 'Delivery'} complete — +$${fare}`, 'good');
    this.audio.missionComplete();
    if (job.passenger) this.state.peds.removePed(job.passenger);
    this.sideJob = null;
    this.beacon.visible = false;
    this.state.save();
  }

  update(dt) {
    // Beacon spin.
    if (this.beacon.visible) {
      this.beacon.userData.diamond.rotation.y += dt * 2;
      this.beacon.userData.diamond.position.y = 5 + Math.sin(performance.now() / 400) * 0.5;
    }
    if (this.timer > 0 && this.current >= 0 && !this.failed) {
      this.timer -= dt;
      this.state.hud.setTimer(this.timer);
      if (this.timer <= 0) this.failMission('Out of time.');
    }
    // Side job stages.
    if (this.sideJob) {
      const job = this.sideJob;
      const pp = this.state.player.pos;
      if (job.stage === 'pickup') {
        const tx = job.passenger ? job.passenger.x : job.parcel.x;
        const tz = job.passenger ? job.passenger.z : job.parcel.z;
        const inCar = !!this.state.playerCar.car;
        if (Math.hypot(pp.x - tx, pp.z - tz) < 7 && (job.kind === 'courier' || inCar)) {
          job.stage = 'deliver';
          if (job.passenger) {
            this.state.peds.removePed(job.passenger);
            job.passenger = null;
            this.state.hud.showMessage('Passenger aboard — drive to the marker', 'info');
          } else {
            this.state.hud.showMessage('Parcel collected — deliver it to the marker', 'info');
          }
          this.placeBeacon(job.dest.x, job.dest.z);
        }
      } else if (Math.hypot(pp.x - job.dest.x, pp.z - job.dest.z) < 9) {
        this.finishSideJob();
      }
      return;
    }
    if (this.current < 0 || this.failed) return;
    const s = this.stage;
    if (!s) return;
    const pp = this.state.player.pos;
    const inCar = !!this.state.playerCar.car;
    const dist = (x, z) => Math.hypot(pp.x - x, pp.z - z);
    switch (s.type) {
      case 'goto':
        if (dist(s.x, s.z) < s.radius) {
          if (this.current === 2) {
            this.state.hud.showMessage('Rico is in — now lose the cops!', 'good');
            const rico = this.state.peds.peds.find((p) => p.role === 'rico');
            if (rico) this.state.peds.removePed(rico);
          }
          this.advanceStage();
        }
        break;
      case 'driveTo':
        this.state.__driveChecks = (this.state.__driveChecks || 0) + 1;
        this.state.__lastDrive = { inCar, d: dist(s.x, s.z), r: s.radius, mode: this.state.mode, failed: this.failed };
        if (inCar && dist(s.x, s.z) < s.radius) this.advanceStage();
        break;
      case 'deliver':
        if (dist(s.x, s.z) < s.radius) this.advanceStage();
        break;
      case 'survive':
        if (this.state.police.wanted === 0) this.advanceStage();
        break;
      case 'plant':
        if (!inCar && dist(s.x, s.z) < s.radius) {
          this.stageState.plant = (this.stageState.plant || 0) + dt;
          this.state.hud.showMessage(`Planting charges… ${Math.ceil(s.seconds - this.stageState.plant)}s`, 'info');
          if (this.stageState.plant >= s.seconds) this.advanceStage();
        } else {
          this.stageState.plant = 0;
        }
        break;
      case 'tail': {
        const t = this.targetCar;
        if (!t) break;
        // The courier flees along the coast road.
        t.cruise = 22;
        const dx = t.x - pp.x;
        const dz = t.z - pp.z;
        const d = Math.hypot(dx, dz);
        if (inCar && d < 5 && Math.abs(this.state.playerCar.speed) > 8) {
          t.hp -= dt * 60;
          this.state.shake = Math.min(1, this.state.shake + 0.3);
          if (t.hp <= 0) {
            t.cruise = 0;
            t.speed = 0;
            this.dropPickup(t.x + 2, t.z + 2);
            this.state.hud.showMessage('The courier stopped — grab the briefcase on foot', 'good');
            this.audio.crash();
            this.stageIndex++;
            this.setupStagePickup();
          }
        }
        break;
      }
      case 'pickup': {
        if (!this.pickupMesh) break;
        if (!inCar && dist(this.pickupMesh.position.x, this.pickupMesh.position.z) < 3) {
          this.scene.remove(this.pickupMesh);
          this.pickupMesh = null;
          this.audio.pickup();
          this.advanceStage();
        }
        break;
      }
      default:
        break;
    }
  }

  setupStagePickup() {
    // After the tail stage, the next stage is 'pickup'; beacon is on the case.
    const s = this.stage;
    if (s && s.type === 'pickup') {
      this.stageState = { kills: 0, count: 0, plant: 0, wave: 0 };
    }
  }
}
