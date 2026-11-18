// EMBERLINE: Costa Verde — combat.js
// One job: fighting. Pistol hitscan with tracer and muzzle flash, fists,
// health and damage, and the armed enemies missions spawn (they shoot back).

import * as THREE from 'three';
import { PLAYER, mulberry32 } from './config.js';
import { buildPersonMesh } from './pedestrians.js';

export class CombatSystem {
  constructor(scene, world, state, audio) {
    this.scene = scene;
    this.world = world;
    this.state = state;
    this.audio = audio;
    this.rng = mulberry32(31337);
    this.enemies = [];
    this.tracers = [];
    this.muzzle = new THREE.PointLight(0xffc36b, 0, 18, 1.6);
    this.scene.add(this.muzzle);
    this.muzzleTimer = 0;
    this.raycaster = new THREE.Raycaster();
  }

  spawnEnemy(x, z, hp = 100) {
    const mesh = buildPersonMesh(0x8a1f1f, 0xc98d64);
    // Armed look: dark jacket + a visible pistol block in the right hand.
    const gun = new THREE.Mesh(
      new THREE.BoxGeometry(0.08, 0.1, 0.42),
      new THREE.MeshLambertMaterial({ color: 0x111111 }),
    );
    gun.position.set(0.37, 0.9, 0.25);
    mesh.add(gun);
    mesh.position.set(x, 0, z);
    this.scene.add(mesh);
    const enemy = {
      mesh, x, z, hp, heading: 0,
      shootTimer: 1 + this.rng() * 1.5,
      moveTimer: 0,
      dead: false,
    };
    this.enemies.push(enemy);
    return enemy;
  }

  removeEnemy(enemy) {
    this.scene.remove(enemy.mesh);
    const i = this.enemies.indexOf(enemy);
    if (i >= 0) this.enemies.splice(i, 1);
  }

  // Hitscan shot from `from` along `dir`. Returns what was hit, if anything.
  shoot(from, dir) {
    if (this.state.ammo <= 0) {
      this.audio.denied();
      this.state.hud.showMessage('Out of ammo — buy more at IRONWORKS ARMS', 'bad');
      return null;
    }
    this.state.ammo--;
    this.audio.gunshot();
    this.state.hud.setAmmo(this.state.ammo, this.state.weapon);
    this.muzzle.position.copy(from).addScaledVector(dir, 1.2);
    this.muzzle.intensity = 60;
    this.muzzleTimer = 0.06;
    this.state.addHeat(0.34, 'shooting');
    this.state.peds.scareAllNear(from.x, from.z, 40);

    this.raycaster.set(from, dir);
    this.raycaster.far = PLAYER.shootRange;
    const targets = [];
    for (const e of this.enemies) targets.push({ obj: e.mesh, kind: 'enemy', ref: e });
    for (const p of this.state.peds.peds) targets.push({ obj: p.mesh, kind: 'ped', ref: p });
    const hits = this.raycaster.intersectObjects(targets.map((t) => t.obj), true);
    let end = from.clone().addScaledVector(dir, PLAYER.shootRange);
    let result = null;
    if (hits.length > 0) {
      const hit = hits[0];
      end = hit.point.clone();
      let node = hit.object;
      while (node.parent && node.parent !== this.scene) node = node.parent;
      const found = targets.find((t) => t.obj === node);
      if (found) {
        if (found.kind === 'enemy') {
          found.ref.hp -= PLAYER.pistolDamage;
          this.spawnHitPuff(hit.point, 0xff5040);
          if (found.ref.hp <= 0) {
            found.ref.dead = true;
            this.removeEnemy(found.ref);
            this.state.onEnemyKilled(found.ref);
            this.spawnHitPuff(hit.point, 0xaa2211);
          }
          result = { kind: 'enemy', ref: found.ref };
        } else {
          // Hitting a bystander is a crime, and it costs heat.
          this.state.addHeat(0.5, 'bystander');
          this.spawnHitPuff(hit.point, 0xdd3333);
          this.state.peds.removePed(found.ref);
          result = { kind: 'ped', ref: found.ref };
        }
      }
    }
    this.spawnTracer(from.clone().addScaledVector(dir, 1.0), end);
    return result;
  }

  spawnTracer(from, to) {
    const len = from.distanceTo(to);
    const geo = new THREE.BoxGeometry(0.05, 0.05, len);
    const mat = new THREE.MeshBasicMaterial({ color: 0xffe9a8, transparent: true, opacity: 0.9 });
    const tracer = new THREE.Mesh(geo, mat);
    tracer.position.copy(from).add(to).multiplyScalar(0.5);
    tracer.lookAt(to);
    this.scene.add(tracer);
    this.tracers.push({ mesh: tracer, life: 0.07 });
  }

  spawnHitPuff(point, color) {
    const puff = new THREE.Mesh(
      new THREE.SphereGeometry(0.35, 8, 6),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.85 }),
    );
    puff.position.copy(point);
    this.scene.add(puff);
    this.tracers.push({ mesh: puff, life: 0.25, puff: true });
  }

  punch(from, heading) {
    this.audio.punch();
    const reach = PLAYER.punchRange;
    const fx = Math.sin(heading);
    const fz = Math.cos(heading);
    let hitAnything = false;
    for (const e of [...this.enemies]) {
      const dx = e.x - from.x;
      const dz = e.z - from.z;
      if (Math.hypot(dx, dz) < reach + 0.6 && dx * fx + dz * fz > 0) {
        e.hp -= PLAYER.punchDamage;
        this.spawnHitPuff(new THREE.Vector3(e.x, 1.2, e.z), 0xffcc66);
        if (e.hp <= 0) {
          this.removeEnemy(e);
          this.state.onEnemyKilled(e);
        }
        hitAnything = true;
      }
    }
    for (const p of [...this.state.peds.peds]) {
      const dx = p.x - from.x;
      const dz = p.z - from.z;
      if (Math.hypot(dx, dz) < reach + 0.6 && dx * fx + dz * fz > 0) {
        p.fleeing = 4;
        p.scared = true;
        this.state.addHeat(0.2, 'assault');
        if (this.state.missions) this.state.missions.onIntimidated(p);
        hitAnything = true;
      }
    }
    // Punching near a shopkeeper counts as intimidation too.
    return hitAnything;
  }

  update(dt, playerPos) {
    if (this.muzzleTimer > 0) {
      this.muzzleTimer -= dt;
      if (this.muzzleTimer <= 0) this.muzzle.intensity = 0;
    }
    for (const t of [...this.tracers]) {
      t.life -= dt;
      if (t.life <= 0) {
        this.scene.remove(t.mesh);
        this.tracers.splice(this.tracers.indexOf(t), 1);
      } else if (t.puff) {
        t.mesh.scale.multiplyScalar(1 + dt * 6);
        t.mesh.material.opacity = Math.max(0, t.life / 0.25) * 0.85;
      }
    }
    // Enemies strafe toward the player and shoot back.
    for (const e of [...this.enemies]) {
      const dx = playerPos.x - e.x;
      const dz = playerPos.z - e.z;
      const dist = Math.hypot(dx, dz);
      e.heading = Math.atan2(dx, dz);
      e.mesh.rotation.y = e.heading;
      e.moveTimer -= dt;
      if (dist > 14) {
        e.x += Math.sin(e.heading) * 4.2 * dt;
        e.z += Math.cos(e.heading) * 4.2 * dt;
      } else if (e.moveTimer <= 0) {
        e.moveTimer = 0.8 + this.rng();
        e.strafe = (this.rng() - 0.5) * 2;
      }
      if (e.strafe) {
        e.x += Math.cos(e.heading) * e.strafe * 2.4 * dt;
        e.z -= Math.sin(e.heading) * e.strafe * 2.4 * dt;
      }
      e.mesh.position.set(e.x, 0, e.z);
      e.shootTimer -= dt;
      if (e.shootTimer <= 0 && dist < 42) {
        e.shootTimer = 1.4 + this.rng() * 1.2;
        // Enemy fire: loud, visible, and it hurts.
        const from = new THREE.Vector3(e.x, 1.4, e.z);
        const to = new THREE.Vector3(playerPos.x, 1.2, playerPos.z);
        this.spawnTracer(from, to);
        this.audio.gunshot();
        if (this.rng() < 0.55) this.state.damagePlayer(6 + this.rng() * 6, 'enemy');
      }
    }
  }
}
