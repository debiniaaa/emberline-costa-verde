// EMBERLINE: Costa Verde — pedestrians.js
// One job: the people of Costa Verde. Walkers stroll the sidewalks, cross at
// intersections, flee from gunfire, and can be intimidated for missions.

import * as THREE from 'three';
import { PALETTE, mulberry32 } from './config.js';
import { randomRoadPoint, nearestRoadPoint } from './world.js';

export function buildPersonMesh(shirtColor, skinColor = 0xd9a077) {
  const person = new THREE.Group();
  const shirt = new THREE.MeshLambertMaterial({ color: shirtColor });
  const pants = new THREE.MeshLambertMaterial({ color: 0x2e3440 });
  const skin = new THREE.MeshLambertMaterial({ color: skinColor });
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.75, 0.32), shirt);
  body.position.y = 1.05;
  person.add(body);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.34, 0.34), skin);
  head.position.y = 1.62;
  person.add(head);
  const hair = new THREE.Mesh(
    new THREE.BoxGeometry(0.36, 0.14, 0.36),
    new THREE.MeshLambertMaterial({ color: 0x1a1210 }),
  );
  hair.position.y = 1.82;
  person.add(hair);
  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.7, 0.22), pants);
  legL.position.set(-0.14, 0.35, 0);
  person.add(legL);
  const legR = legL.clone();
  legR.position.x = 0.14;
  person.add(legR);
  const armL = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.62, 0.18), shirt);
  armL.position.set(-0.37, 1.05, 0);
  person.add(armL);
  const armR = armL.clone();
  armR.position.x = 0.37;
  person.add(armR);
  person.userData.legL = legL;
  person.userData.legR = legR;
  person.userData.armL = armL;
  person.userData.armR = armR;
  return person;
}

export class PedestrianManager {
  constructor(scene, world, state) {
    this.scene = scene;
    this.world = world;
    this.state = state;
    this.rng = mulberry32(4242);
    this.peds = [];
    this.targetCount = 22;
  }

  spawnPed(x, z, role = 'walker') {
    const shirt = PALETTE.pedShirt[Math.floor(this.rng() * PALETTE.pedShirt.length)];
    const mesh = buildPersonMesh(shirt);
    mesh.position.set(x, 0, z);
    this.scene.add(mesh);
    const ped = {
      mesh, x, z, role,
      heading: this.rng() * Math.PI * 2,
      speed: 1.2 + this.rng() * 1.4,
      walkPhase: this.rng() * 6,
      fleeing: 0,
      scared: false,
      intimidated: false,
      target: null,
      name: role === 'shopkeeper' ? 'SHOPKEEPER' : 'LOCAL',
    };
    this.peds.push(ped);
    return ped;
  }

  seed(count) {
    for (let i = 0; i < count; i++) {
      const p = randomRoadPoint(this.rng);
      const road = nearestRoadPoint(p.x, p.z);
      const off = 8 + this.rng() * 4;
      this.spawnPed(
        road.axis === 'z' ? road.x + off : p.x,
        road.axis === 'z' ? p.z : road.z + off,
      );
    }
  }

  removePed(ped) {
    this.scene.remove(ped.mesh);
    const i = this.peds.indexOf(ped);
    if (i >= 0) this.peds.splice(i, 1);
  }

  scareAllNear(x, z, radius) {
    for (const ped of this.peds) {
      if (Math.hypot(ped.x - x, ped.z - z) < radius) {
        ped.fleeing = 3 + this.rng() * 2;
        ped.scared = true;
      }
    }
  }

  update(dt, playerPos) {
    // Keep the crowd near the player.
    for (const ped of [...this.peds]) {
      if (ped.role !== 'walker') continue;
      const dx = ped.x - playerPos.x;
      const dz = ped.z - playerPos.z;
      if (dx * dx + dz * dz > 260 * 260) {
        this.removePed(ped);
        const p = randomRoadPoint(this.rng);
        const road = nearestRoadPoint(playerPos.x + (this.rng() - 0.5) * 260, playerPos.z + (this.rng() - 0.5) * 260);
        this.spawnPed(road.axis === 'z' ? road.x + 9 : p.x, road.axis === 'z' ? p.z : road.z + 9);
      }
    }
    while (this.peds.filter((p) => p.role === 'walker').length < this.targetCount) {
      const road = nearestRoadPoint(playerPos.x + (this.rng() - 0.5) * 220, playerPos.z + (this.rng() - 0.5) * 220);
      this.spawnPed(road.axis === 'z' ? road.x + 9 : road.x, road.axis === 'z' ? road.z : road.z + 9);
    }
    for (const ped of this.peds) {
      if (ped.fleeing > 0) {
        ped.fleeing -= dt;
        const away = Math.atan2(ped.x - playerPos.x, ped.z - playerPos.z);
        ped.heading = away;
        const sp = 5.5;
        ped.x += Math.sin(ped.heading) * sp * dt;
        ped.z += Math.cos(ped.heading) * sp * dt;
      } else if (ped.role === 'walker') {
        if (this.rng() < dt * 0.05) ped.heading += (this.rng() - 0.5) * 1.6;
        ped.x += Math.sin(ped.heading) * ped.speed * dt;
        ped.z += Math.cos(ped.heading) * ped.speed * dt;
        // Stay roughly on the sidewalk grid: drift back toward a road line.
        const road = nearestRoadPoint(ped.x, ped.z);
        const d = road.axis === 'z' ? Math.abs(ped.x - road.x) : Math.abs(ped.z - road.z);
        if (d > 26) ped.heading += Math.PI * dt * 0.8;
      }
      ped.walkPhase += dt * (ped.fleeing > 0 ? 11 : 6);
      const swing = Math.sin(ped.walkPhase) * 0.45;
      ped.mesh.userData.legL.rotation.x = swing;
      ped.mesh.userData.legR.rotation.x = -swing;
      ped.mesh.userData.armL.rotation.x = -swing * 0.7;
      ped.mesh.userData.armR.rotation.x = swing * 0.7;
      ped.mesh.position.set(ped.x, 0, ped.z);
      ped.mesh.rotation.y = ped.heading;
    }
  }

  nearestPed(x, z, maxDist) {
    let best = null; let bestD = maxDist;
    for (const ped of this.peds) {
      const d = Math.hypot(ped.x - x, ped.z - z);
      if (d < bestD) { bestD = d; best = ped; }
    }
    return best;
  }
}
