// EMBERLINE: Costa Verde — vehicles.js
// One job: cars. Builds car meshes, drives traffic along the road grid, and
// runs the player's arcade car physics (accelerate, steer, drift, collide).

import * as THREE from 'three';
import { CAR, PALETTE, mulberry32 } from './config.js';
import { resolveCircleCollision, clampToWorld, nearestRoadPoint, isOnRoad } from './world.js';

export function buildCarMesh(color, kind = 'sedan') {
  const car = new THREE.Group();
  const paint = new THREE.MeshLambertMaterial({ color });
  const glass = new THREE.MeshLambertMaterial({ color: 0x1c2836 });
  const bodyLen = kind === 'truck' ? 5.6 : 4.2;
  const body = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.62, bodyLen), paint);
  body.position.y = 0.62;
  car.add(body);
  const cabin = new THREE.Mesh(
    new THREE.BoxGeometry(1.8, 0.55, kind === 'truck' ? 1.6 : 2.1),
    kind === 'truck' ? paint : glass,
  );
  cabin.position.set(0, 1.18, kind === 'truck' ? 1.4 : -0.15);
  car.add(cabin);
  if (kind === 'truck') {
    const bed = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.5, 2.6), new THREE.MeshLambertMaterial({ color: 0x5a4632 }));
    bed.position.set(0, 1.05, -1.2);
    car.add(bed);
  }
  const wheelGeo = new THREE.CylinderGeometry(0.36, 0.36, 0.3, 10);
  const wheelMat = new THREE.MeshLambertMaterial({ color: 0x141414 });
  car.userData.wheels = [];
  for (const [wx, wz] of [[-0.95, 1.35], [0.95, 1.35], [-0.95, -1.35], [0.95, -1.35]]) {
    const wheel = new THREE.Mesh(wheelGeo, wheelMat);
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(wx, 0.36, wz);
    car.add(wheel);
    car.userData.wheels.push(wheel);
  }
  const lightMat = new THREE.MeshBasicMaterial({ color: 0xfff2b0 });
  for (const wx of [-0.6, 0.6]) {
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.18, 0.1), lightMat);
    head.position.set(wx, 0.72, bodyLen / 2 + 0.02);
    car.add(head);
    const tail = new THREE.Mesh(
      new THREE.BoxGeometry(0.4, 0.18, 0.1),
      new THREE.MeshBasicMaterial({ color: 0xff2a22 }),
    );
    tail.position.set(wx, 0.72, -bodyLen / 2 - 0.02);
    car.add(tail);
  }
  if (kind === 'police') {
    const bar = new THREE.Mesh(
      new THREE.BoxGeometry(1.2, 0.16, 0.4),
      new THREE.MeshBasicMaterial({ color: 0x2244ff }),
    );
    bar.position.set(0, 1.55, -0.15);
    car.add(bar);
    car.userData.lightBar = bar;
    const star = new THREE.Mesh(
      new THREE.BoxGeometry(0.9, 0.9, 0.02),
      new THREE.MeshBasicMaterial({ color: 0xffffff }),
    );
    star.position.set(-1.01, 0.85, 0);
    star.rotation.y = -Math.PI / 2;
    car.add(star);
  }
  car.userData.kind = kind;
  car.userData.bodyLen = bodyLen;
  return car;
}

export class TrafficManager {
  constructor(scene, world, state) {
    this.scene = scene;
    this.world = world;
    this.state = state;
    this.rng = mulberry32(777);
    this.cars = [];
    this.targetCount = 16;
  }

  spawnCar(x, z, heading, kind = null) {
    if (!Number.isFinite(x) || !Number.isFinite(z) || !Number.isFinite(heading)) {
      console.error(`SPAWN NAN CAR x=${x} z=${z} heading=${heading} // ${new Error('spawn-trace').stack.split('\n').slice(1, 5).join(' // ')}`);
      x = Number.isFinite(x) ? x : 0;
      z = Number.isFinite(z) ? z : 0;
      heading = Number.isFinite(heading) ? heading : 0;
    }
    const color = PALETTE.car[Math.floor(this.rng() * PALETTE.car.length)];
    const mesh = buildCarMesh(color, kind || (this.rng() < 0.12 ? 'truck' : 'sedan'));
    mesh.position.set(x, 0, z);
    mesh.rotation.y = heading;
    this.scene.add(mesh);
    const car = {
      mesh, x, z, heading,
      speed: 7 + this.rng() * 5,
      cruise: 8 + this.rng() * 5,
      lane: this.rng() < 0.5 ? 2.6 : -2.6,
      isPlayer: false, isPolice: false, isTarget: false,
      stopped: 0,
    };
    this.cars.push(car);
    return car;
  }

  seed(count) {
    for (let i = 0; i < count; i++) {
      const rx = [-320, -240, -160, -80, 0, 80, 160, 240, 320][Math.floor(this.rng() * 9)];
      const rz = [-320, -240, -160, -80, 0, 80, 160, 240, 320][Math.floor(this.rng() * 9)];
      const axis = this.rng() < 0.5;
      this.spawnCar(
        axis ? rx + (this.rng() - 0.5) * 6 : (this.rng() - 0.5) * 640,
        axis ? (this.rng() - 0.5) * 640 : rz + (this.rng() - 0.5) * 6,
        axis ? (this.rng() < 0.5 ? 0 : Math.PI) : (this.rng() < 0.5 ? Math.PI / 2 : -Math.PI / 2),
      );
    }
  }

  removeCar(car) {
    this.scene.remove(car.mesh);
    const i = this.cars.indexOf(car);
    if (i >= 0) this.cars.splice(i, 1);
  }

  carAhead(car, dist) {
    const fx = Math.sin(car.heading);
    const fz = Math.cos(car.heading);
    for (const other of this.cars) {
      if (other === car) continue;
      const dx = other.x - car.x;
      const dz = other.z - car.z;
      const along = dx * fx + dz * fz;
      const side = Math.abs(dx * fz - dz * fx);
      if (along > 0 && along < dist && side < 3.2) return other;
    }
    return null;
  }

  update(dt, playerPos) {
    // Keep traffic near the player: respawn far cars closer in.
    for (const car of [...this.cars]) {
      if (car.isPlayer || car.isPolice || car.isTarget) continue;
      const dx = car.x - playerPos.x;
      const dz = car.z - playerPos.z;
      if (dx * dx + dz * dz > 300 * 300) {
        this.removeCar(car);
        const p = nearestRoadPoint(
          playerPos.x + (this.rng() - 0.5) * 320,
          playerPos.z + (this.rng() - 0.5) * 320,
        );
        const axis = p.axis === 'z';
        this.spawnCar(p.x, p.z, axis ? (this.rng() < 0.5 ? 0 : Math.PI) : (this.rng() < 0.5 ? Math.PI / 2 : -Math.PI / 2));
      }
    }
    while (this.cars.filter((c) => !c.isPlayer && !c.isPolice && !c.isTarget).length < this.targetCount) {
      const p = nearestRoadPoint(
        playerPos.x + (this.rng() - 0.5) * 300,
        playerPos.z + (this.rng() - 0.5) * 300,
      );
      const axis = p.axis === 'z';
      this.spawnCar(p.x, p.z, axis ? (this.rng() < 0.5 ? 0 : Math.PI) : (this.rng() < 0.5 ? Math.PI / 2 : -Math.PI / 2));
    }
    for (const car of this.cars) {
      if (car.isPlayer || car.isPolice) continue; // police cruisers are driven by PoliceManager, not traffic
      if (!Number.isFinite(car.x) || !Number.isFinite(car.z) || !Number.isFinite(car.heading) || !Number.isFinite(car.speed)) {
        // Defensive: one bad car must never kill the frame loop. Log it once
        // for diagnosis, then respawn it on a road near the player.
        if (!this._nanLogged) {
          this._nanLogged = true;
          const detail = `NAN CAR x=${car.x} z=${car.z} heading=${car.heading} speed=${car.speed} cruise=${car.cruise} isPolice=${car.isPolice} isTarget=${car.isTarget} playerPos=${playerPos.x},${playerPos.z}`;
          console.error(detail);
          const el = document.getElementById('errors');
          if (el) el.textContent = detail;
        }
        const p = nearestRoadPoint(playerPos.x, playerPos.z);
        car.x = p.x; car.z = p.z; car.heading = 0; car.speed = 0;
      }
      // Follow the road: snap gently onto the nearest road centre line.
      const road = nearestRoadPoint(car.x, car.z);
      const wantHeading = road.axis === 'z'
        ? (Math.sin(car.heading) >= 0 ? 0 : Math.PI)
        : (Math.cos(car.heading) >= 0 ? Math.PI / 2 : -Math.PI / 2);
      let dh = wantHeading - car.heading;
      while (dh > Math.PI) dh -= Math.PI * 2;
      while (dh < -Math.PI) dh += Math.PI * 2;
      car.heading += THREE.MathUtils.clamp(dh, -1.4 * dt, 1.4 * dt);
      const ahead = this.carAhead(car, 11);
      const targetSpeed = ahead ? 0 : car.cruise;
      car.speed += THREE.MathUtils.clamp(targetSpeed - car.speed, -14 * dt, 8 * dt);
      car.x += Math.sin(car.heading) * car.speed * dt;
      car.z += Math.cos(car.heading) * car.speed * dt;
      // Lane offset: keep to the right side of the road.
      const sideX = Math.cos(car.heading) * car.lane;
      const sideZ = -Math.sin(car.heading) * car.lane;
      car.mesh.position.set(car.x + sideX * 0.4, 0, car.z + sideZ * 0.4);
      car.mesh.rotation.y = car.heading;
      for (const w of car.mesh.userData.wheels) w.rotation.x += car.speed * dt * 2.4;
      clampToWorld(car.mesh.position, 12);
      car.x = car.mesh.position.x;
      car.z = car.mesh.position.z;
    }
  }

  nearestCar(x, z, maxDist, excludePlayer = true) {
    let best = null; let bestD = maxDist;
    for (const car of this.cars) {
      if (excludePlayer && car.isPlayer) continue;
      if (car.isPolice) continue;
      const d = Math.hypot(car.x - x, car.z - z);
      if (d < bestD) { bestD = d; best = car; }
    }
    return best;
  }
}

// The player's car: arcade physics with drift, collisions and camera-friendly speed.
export class PlayerCar {
  constructor(scene, world, state, audio) {
    this.scene = scene;
    this.world = world;
    this.state = state;
    this.audio = audio;
    this.car = null; // traffic car record currently driven
    this.speed = 0;
    this.steerAngle = 0;
    this.skid = 0;
  }

  take(car) {
    this.car = car;
    car.isPlayer = true;
    this.speed = 0;
    this.state.player.mesh.visible = false;
    this.audio.ensure();
    this.audio.startEngine();
    return car;
  }

  leave() {
    if (!this.car) return null;
    const car = this.car;
    car.isPlayer = false;
    car.speed = 0;
    this.car = null;
    this.speed = 0;
    this.state.player.mesh.visible = true;
    this.audio.stopEngine();
    return car;
  }

  update(dt, input) {
    if (!this.car) return;
    const car = this.car;
    const fwd = input.forward ? 1 : 0;
    const back = input.back ? 1 : 0;
    if (fwd) this.speed += CAR.accel * dt;
    else if (back) this.speed -= (this.speed > 0.5 ? CAR.brake : CAR.reverseAccel) * dt;
    else this.speed -= Math.sign(this.speed) * CAR.drag * 8 * dt;
    if (input.handbrake) {
      this.speed -= Math.sign(this.speed) * 30 * dt;
      this.skid = Math.min(1, this.skid + dt * 3);
    } else {
      this.skid = Math.max(0, this.skid - dt * 2);
    }
    this.speed = THREE.MathUtils.clamp(this.speed, -CAR.maxReverse, CAR.maxSpeed);
    if (Math.abs(this.speed) < 0.05) this.speed = 0;
    const steerTarget = (input.left ? 1 : 0) - (input.right ? 1 : 0);
    const steerAmount = CAR.steer * (1 + this.skid * 0.7) * Math.min(1, Math.abs(this.speed) / 8);
    this.steerAngle += (steerTarget * steerAmount - this.steerAngle) * Math.min(1, dt * 8);
    if (Math.abs(this.speed) > 0.1) {
      car.heading += this.steerAngle * (this.speed / CAR.maxSpeed) * 2.4 * dt * Math.sign(this.speed);
    }
    const nx = car.x + Math.sin(car.heading) * this.speed * dt;
    const nz = car.z + Math.cos(car.heading) * this.speed * dt;
    const test = { x: nx, z: nz };
    const hitWall = resolveCircleCollision(test, 2.1, this.world.colliders);
    car.x = THREE.MathUtils.clamp(test.x, -348, 348);
    car.z = THREE.MathUtils.clamp(test.z, -348, 348);
    // Keep the player's world position on the car while driving, so police,
    // traffic and missions all target the car, not the spot they got in.
    this.state.player.pos.set(car.x, 0, car.z);
    // Bounce off traffic.
    for (const other of this.state.traffic.cars) {
      if (other === car || other.isPlayer) continue;
      const d = Math.hypot(other.x - car.x, other.z - car.z);
      if (d < 4.4 && d > 0.01) {
        const push = (4.4 - d) / 2;
        const ux = (car.x - other.x) / d;
        const uz = (car.z - other.z) / d;
        car.x += ux * push; car.z += uz * push;
        other.x -= ux * push; other.z -= uz * push;
        if (Math.abs(this.speed) > 6) {
          this.speed *= 0.55;
          this.audio.crash();
          this.state.addHeat(0, 'crash');
          this.state.shake = Math.min(1, this.state.shake + 0.4);
        }
      }
    }
    car.mesh.position.set(car.x, 0, car.z);
    car.mesh.rotation.y = car.heading;
    for (const w of car.mesh.userData.wheels) w.rotation.x += this.speed * dt * 2.4;
    this.audio.setEngine(Math.abs(this.speed) / CAR.maxSpeed);
    this.state.speedKmh = Math.abs(this.speed) * 3.6;
    if (hitWall && Math.abs(this.speed) > 8) {
      this.speed *= 0.5;
      this.audio.crash();
      this.state.shake = Math.min(1, this.state.shake + 0.5);
    }
  }
}

export function isCarOnRoad(car) {
  return isOnRoad(car.x, car.z);
}
