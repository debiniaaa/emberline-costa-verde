// EMBERLINE: Costa Verde — police.js
// One job: the law. Wanted stars, heat and decay, police cruisers that chase
// and ram, the bust meter, and the police helicopter at three stars and up.

import * as THREE from 'three';
import { WANTED, mulberry32 } from './config.js';
import { buildCarMesh } from './vehicles.js';
import { randomRoadPoint, nearestRoadPoint } from './world.js';

export class PoliceManager {
  constructor(scene, world, state, audio) {
    this.scene = scene;
    this.world = world;
    this.state = state;
    this.audio = audio;
    this.rng = mulberry32(99);
    this.stars = 0;
    this.heat = 0;               // 0..1 within the current star level
    this.timeSinceCrime = 99;
    this.bust = 0;               // 0..1 bust meter
    this.cruisers = [];
    this.heli = null;
    this.heliLight = null;
    this.sirenOn = false;
  }

  get wanted() { return this.stars; }

  addHeat(amount, reason) {
    if (amount <= 0) return;
    this.heat += amount;
    this.timeSinceCrime = 0;
    while (this.heat >= 1 && this.stars < 5) {
      this.heat -= 1;
      this.stars++;
      this.state.hud.showMessage(`WANTED LEVEL ${this.stars} — the Costa Verde police are coming`, 'bad');
      this.audio.phoneRing();
    }
    if (this.stars >= 5) this.heat = 1;
    this.state.hud.setStars(this.stars);
  }

  clearWanted() {
    this.stars = 0;
    this.heat = 0;
    this.bust = 0;
    this.state.hud.setStars(0);
    this.despawnAll();
  }

  buildHelicopter() {
    const heli = new THREE.Group();
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(2.2, 1.4, 4.4),
      new THREE.MeshLambertMaterial({ color: 0x1c2a44 }),
    );
    heli.add(body);
    const glass = new THREE.Mesh(
      new THREE.BoxGeometry(2.0, 0.9, 1.4),
      new THREE.MeshLambertMaterial({ color: 0x9fd8ff }),
    );
    glass.position.set(0, 0.2, 1.6);
    heli.add(glass);
    const tail = new THREE.Mesh(
      new THREE.BoxGeometry(0.5, 0.5, 3.6),
      new THREE.MeshLambertMaterial({ color: 0x1c2a44 }),
    );
    tail.position.set(0, 0.3, -3.6);
    heli.add(tail);
    const rotor = new THREE.Mesh(
      new THREE.BoxGeometry(9, 0.08, 0.5),
      new THREE.MeshLambertMaterial({ color: 0x222226 }),
    );
    rotor.position.y = 1.0;
    heli.add(rotor);
    heli.userData.rotor = rotor;
    const skidL = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.2, 3), new THREE.MeshLambertMaterial({ color: 0x111111 }));
    skidL.position.set(-0.9, -0.9, 0);
    heli.add(skidL);
    const skidR = skidL.clone();
    skidR.position.x = 0.9;
    heli.add(skidR);
    const spot = new THREE.SpotLight(0xfff2b0, 900, 120, 0.35, 0.5, 1.2);
    spot.position.set(0, -0.5, 0);
    heli.add(spot);
    heli.add(spot.target);
    spot.target.position.set(0, -40, 0);
    this.heliLight = spot;
    return heli;
  }

  spawnCruiser(x, z) {
    const mesh = buildCarMesh(0xf2f2f2, 'police');
    mesh.position.set(x, 0, z);
    this.scene.add(mesh);
    const cruiser = {
      mesh, x, z, heading: 0, speed: 0,
      cruise: 26,
      isPlayer: false, isPolice: true, isTarget: false,
      sirenPhase: this.rng() * 6,
    };
    this.cruisers.push(cruiser);
    this.state.traffic.cars.push(cruiser);
    return cruiser;
  }

  despawnAll() {
    for (const c of [...this.cruisers]) {
      this.scene.remove(c.mesh);
      const i = this.state.traffic.cars.indexOf(c);
      if (i >= 0) this.state.traffic.cars.splice(i, 1);
    }
    this.cruisers = [];
    if (this.heli) {
      this.scene.remove(this.heli);
      this.heli = null;
      this.heliLight = null;
    }
    if (this.sirenOn) { this.audio.stopSiren(); this.sirenOn = false; }
  }

  update(dt, playerPos, playerSpeed, playerInCar) {
    this.timeSinceCrime += dt;
    // Wanted decays when the player stays clean and out of sight.
    if (this.stars > 0 && this.timeSinceCrime > WANTED.decayDelay) {
      this.heat -= dt / WANTED.decayStep;
      if (this.heat < 0 && this.stars > 0) {
        this.stars--;
        this.heat = this.stars > 0 ? 0.99 : 0;
        this.state.hud.setStars(this.stars);
        if (this.stars === 0) {
          this.state.hud.showMessage('You lost the cops. Costa Verde forgets — for now.', 'good');
          this.despawnAll();
        }
      }
    }

    const wantCruisers = this.stars === 0 ? 0 : Math.min(2 + this.stars, WANTED.maxPoliceCars);
    while (this.cruisers.length < wantCruisers) {
      const p = randomRoadPoint(this.rng);
      const near = nearestRoadPoint(playerPos.x + (this.rng() - 0.5) * 120, playerPos.z + (this.rng() - 0.5) * 120);
      this.spawnCruiser(near.x, near.z);
    }
    while (this.cruisers.length > wantCruisers) {
      const c = this.cruisers.pop();
      this.scene.remove(c.mesh);
      const i = this.state.traffic.cars.indexOf(c);
      if (i >= 0) this.state.traffic.cars.splice(i, 1);
    }

    // Siren while any cruiser is active.
    if (this.stars > 0 && !this.sirenOn) { this.audio.startSiren(); this.sirenOn = true; }
    if (this.stars === 0 && this.sirenOn) { this.audio.stopSiren(); this.sirenOn = false; }

    // Cruisers chase the player and ram.
    let nearestDist = Infinity;
    for (const c of this.cruisers) {
      const dx = playerPos.x - c.x;
      const dz = playerPos.z - c.z;
      const dist = Math.hypot(dx, dz);
      nearestDist = Math.min(nearestDist, dist);
      const wantHeading = Math.atan2(dx, dz);
      let dh = wantHeading - c.heading;
      while (dh > Math.PI) dh -= Math.PI * 2;
      while (dh < -Math.PI) dh += Math.PI * 2;
      c.heading += THREE.MathUtils.clamp(dh, -2.2 * dt, 2.2 * dt);
      const targetSpeed = dist > 90 ? 30 : 24 + this.stars * 1.5;
      c.speed += THREE.MathUtils.clamp(targetSpeed - c.speed, -20 * dt, 12 * dt);
      c.x += Math.sin(c.heading) * c.speed * dt;
      c.z += Math.cos(c.heading) * c.speed * dt;
      c.mesh.position.set(c.x, 0, c.z);
      c.mesh.rotation.y = c.heading;
      c.sirenPhase += dt * 6;
      if (c.mesh.userData.lightBar) {
        c.mesh.userData.lightBar.material.color.setHex(Math.sin(c.sirenPhase) > 0 ? 0xff2222 : 0x2244ff);
      }
      // Ram the player.
      if (dist < 4.6) {
        if (playerInCar) {
          this.state.shake = Math.min(1, this.state.shake + 0.5);
          this.audio.crash();
          c.speed *= 0.4;
          this.state.playerCar.speed *= 0.7;
        } else {
          this.state.damagePlayer(8 * dt * 10, 'police');
        }
      }
    }

    // Bust: slow and close to a cruiser while on foot, or boxed in while driving.
    if (this.stars > 0 && nearestDist < WANTED.bustRange && playerSpeed < 3) {
      this.bust += dt / WANTED.bustSeconds;
      this.state.hud.setBust(this.bust);
      if (this.bust >= 1) this.state.getBusted();
    } else {
      this.bust = Math.max(0, this.bust - dt * 0.5);
      this.state.hud.setBust(this.bust);
    }

    // Helicopter at three stars and up: hovers over the player, spotlight on.
    if (this.stars >= WANTED.heliAtStars) {
      if (!this.heli) {
        this.heli = this.buildHelicopter();
        this.scene.add(this.heli);
      }
      const t = performance.now() / 1000;
      const hx = playerPos.x + Math.sin(t * 0.35) * 14;
      const hz = playerPos.z + Math.cos(t * 0.27) * 14;
      this.heli.position.set(hx, 42 + Math.sin(t * 0.8) * 2, hz);
      this.heli.rotation.y = Math.atan2(playerPos.x - hx, playerPos.z - hz);
      this.heli.userData.rotor.rotation.y += dt * 22;
      if (this.heliLight) this.heliLight.intensity = 900;
    } else if (this.heli) {
      this.scene.remove(this.heli);
      this.heli = null;
      this.heliLight = null;
    }
  }
}
