// EMBERLINE: Costa Verde — player.js
// One job: Marina Sol on foot. WASD movement relative to the camera, sprint,
// jump with gravity, entering and leaving cars, and the animated walker mesh.

import * as THREE from 'three';
import { PLAYER } from './config.js';
import { buildPersonMesh } from './pedestrians.js';
import { resolveCircleCollision, clampToWorld } from './world.js';

export class PlayerController {
  constructor(scene, world, state, audio) {
    this.scene = scene;
    this.world = world;
    this.state = state;
    this.audio = audio;
    this.mesh = buildPersonMesh(0xe85d3d, 0xc98d64);
    // Marina's look: red jacket, dark jeans, hair tied back.
    this.mesh.userData.legL.material = new THREE.MeshLambertMaterial({ color: 0x2e3440 });
    this.mesh.userData.legR.material = new THREE.MeshLambertMaterial({ color: 0x2e3440 });
    this.scene.add(this.mesh);
    this.pos = new THREE.Vector3(0, 0, 60);
    this.vel = new THREE.Vector3();
    this.heading = Math.PI;
    this.verticalVel = 0;
    this.onGround = true;
    this.walkPhase = 0;
    this.moving = false;
    this.speed = 0;
  }

  reset(x, z) {
    this.pos.set(x, 0, z);
    this.vel.set(0, 0, 0);
    this.verticalVel = 0;
    this.heading = Math.PI;
    this.mesh.position.copy(this.pos);
  }

  update(dt, input, cameraHeading) {
    if (this.state.playerCar.car) {
      // Hidden while driving; the mesh rides with the car.
      this.mesh.visible = false;
      this.pos.copy(this.state.playerCar.car.mesh.position);
      return;
    }
    this.mesh.visible = true;
    let mx = 0; let mz = 0;
    if (input.forward) { mx += Math.sin(cameraHeading); mz += Math.cos(cameraHeading); }
    if (input.back) { mx -= Math.sin(cameraHeading); mz -= Math.cos(cameraHeading); }
    if (input.left) { mx += Math.sin(cameraHeading - Math.PI / 2); mz += Math.cos(cameraHeading - Math.PI / 2); }
    if (input.right) { mx += Math.sin(cameraHeading + Math.PI / 2); mz += Math.cos(cameraHeading + Math.PI / 2); }
    const len = Math.hypot(mx, mz);
    this.moving = len > 0;
    const speed = input.sprint ? PLAYER.sprintSpeed : PLAYER.walkSpeed;
    if (this.moving) {
      mx /= len; mz /= len;
      const targetHeading = Math.atan2(mx, mz);
      let dh = targetHeading - this.heading;
      while (dh > Math.PI) dh -= Math.PI * 2;
      while (dh < -Math.PI) dh += Math.PI * 2;
      this.heading += THREE.MathUtils.clamp(dh, -10 * dt, 10 * dt);
      this.pos.x += mx * speed * dt;
      this.pos.z += mz * speed * dt;
      this.speed = speed;
      this.walkPhase += dt * speed * 1.6;
    } else {
      this.speed = 0;
      this.walkPhase += dt * 2;
    }
    // Jump + gravity.
    if (input.jump && this.onGround) {
      this.verticalVel = PLAYER.jumpSpeed;
      this.onGround = false;
    }
    if (!this.onGround) {
      this.verticalVel -= PLAYER.gravity * dt;
      this.pos.y += this.verticalVel * dt;
      if (this.pos.y <= 0) {
        this.pos.y = 0;
        this.verticalVel = 0;
        this.onGround = true;
      }
    }
    resolveCircleCollision(this.pos, 0.7, this.world.colliders);
    clampToWorld(this.pos, 6);
    const swing = this.moving ? Math.sin(this.walkPhase) * 0.55 : Math.sin(this.walkPhase) * 0.05;
    this.mesh.userData.legL.rotation.x = swing;
    this.mesh.userData.legR.rotation.x = -swing;
    this.mesh.userData.armL.rotation.x = -swing * 0.8;
    this.mesh.userData.armR.rotation.x = swing * 0.8;
    this.mesh.position.copy(this.pos);
    this.mesh.rotation.y = this.heading;
  }

  // Aim direction for shooting: from the camera through the crosshair.
  aimDirection(camera) {
    const dir = new THREE.Vector3();
    camera.getWorldDirection(dir);
    return dir;
  }
}
