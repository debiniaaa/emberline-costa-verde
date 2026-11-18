// EMBERLINE: Costa Verde — on-foot player, third-person camera, car
// entry/exit, health and the wasted flow.
(function () {
  'use strict';
  var CV = window.CV;
  var THREE = window.THREE;

  var mesh = null, shadow = null;
  var camYaw = 0, camPitch = 0.42, camDist = 11;
  var keys = {};
  var drag = { active: false, lx: 0, ly: 0 };

  function makePlayerMesh() {
    var g = new THREE.Group();
    var body = new THREE.Mesh(new THREE.BoxGeometry(0.75, 1.05, 0.42),
      new THREE.MeshLambertMaterial({ color: 0x1f6f4a }));
    body.position.y = 0.95;
    g.add(body);
    var jacket = new THREE.Mesh(new THREE.BoxGeometry(0.79, 0.4, 0.46),
      new THREE.MeshLambertMaterial({ color: 0xd4a03c }));
    jacket.position.y = 1.25;
    g.add(jacket);
    var head = new THREE.Mesh(new THREE.SphereGeometry(0.27, 10, 8),
      new THREE.MeshLambertMaterial({ color: 0xe8b88a }));
    head.position.y = 1.72;
    g.add(head);
    var cap = new THREE.Mesh(new THREE.CylinderGeometry(0.29, 0.29, 0.12, 10),
      new THREE.MeshLambertMaterial({ color: 0x1a2a5a }));
    cap.position.y = 1.92;
    g.add(cap);
    var legL = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.7, 0.26),
      new THREE.MeshLambertMaterial({ color: 0x2c3e50 }));
    legL.position.set(-0.18, 0.35, 0);
    g.add(legL);
    var legR = legL.clone();
    legR.position.x = 0.18;
    g.add(legR);
    shadow = new THREE.Mesh(new THREE.CircleGeometry(0.55, 12),
      new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.25, depthWrite: false }));
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = 0.02;
    g.add(shadow);
    return g;
  }

  CV.Player = {
    mesh: null,
    keys: keys,
    init: function () {
      mesh = makePlayerMesh();
      this.mesh = mesh;
      CV.World.scene.add(mesh);
      mesh.position.set(CV.G.playerPos.x, 0, CV.G.playerPos.z);
      window.addEventListener('keydown', function (e) {
        keys[e.code] = true;
        if (e.code === 'KeyE') CV.Player.tryEnterExit();
        if (e.code === 'KeyF') CV.Combat.melee();
        if (e.code === 'KeyJ') CV.Missions.tryStartJob();
        if (e.code === 'Escape' || e.code === 'KeyP') CV.HUD.togglePause();
        if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].indexOf(e.code) >= 0) e.preventDefault();
      });
      window.addEventListener('keyup', function (e) { keys[e.code] = false; });
      var canvas = document.getElementById('game-canvas');
      if (canvas) {
        canvas.addEventListener('mousedown', function (e) {
          drag.active = true; drag.lx = e.clientX; drag.ly = e.clientY;
          CV.Audio.unlock();
          if (CV.G.pistol && CV.G.mode === 'playing') CV.Combat.shoot(e.clientX, e.clientY);
        });
        window.addEventListener('mousemove', function (e) {
          if (!drag.active) return;
          camYaw -= (e.clientX - drag.lx) * 0.005;
          camPitch = CV.clamp(camPitch + (e.clientY - drag.ly) * 0.004, 0.12, 1.1);
          drag.lx = e.clientX; drag.ly = e.clientY;
        });
        window.addEventListener('mouseup', function () { drag.active = false; });
        canvas.addEventListener('wheel', function (e) {
          camDist = CV.clamp(camDist + (e.deltaY > 0 ? 1 : -1), 6, 20);
          e.preventDefault();
        }, { passive: false });
      }
    },
    setCamera: function (yaw, pitch, dist) { camYaw = yaw; camPitch = pitch; camDist = dist; },
    getCamYaw: function () { return camYaw; },
    // Returns {up,down,left,right} from WASD/arrows, camera-relative.
    moveInput: function () {
      return {
        up: !!(keys['KeyW'] || keys['ArrowUp']),
        down: !!(keys['KeyS'] || keys['ArrowDown']),
        left: !!(keys['KeyA'] || keys['ArrowLeft']),
        right: !!(keys['KeyD'] || keys['ArrowRight']),
      };
    },
    update: function (dt) {
      if (CV.G.mode !== 'playing') return;
      var input = this.moveInput();
      if (CV.G.driving) {
        var hit = CV.Vehicles.drivePlayer(CV.G.driving, input, dt);
        CV.G.playerPos.x = CV.G.driving.x;
        CV.G.playerPos.z = CV.G.driving.z;
        CV.G.playerHeading = CV.G.driving.heading;
        CV.G.speed = CV.G.driving.speed;
        if (hit && hit.type === 'wall') CV.Police.addHeat(0, '');
        mesh.visible = false;
        CV.Audio.setEngine(CV.G.driving.speed, CV.TUNE.carMaxSpeed, true);
      } else {
        var speed = (keys['ShiftLeft'] || keys['ShiftRight']) ? CV.TUNE.runSpeed : CV.TUNE.walkSpeed;
        var mx = 0, mz = 0;
        if (input.up) { mx += Math.sin(camYaw); mz += Math.cos(camYaw); }
        if (input.down) { mx -= Math.sin(camYaw); mz -= Math.cos(camYaw); }
        if (input.left) { mx += Math.sin(camYaw - Math.PI / 2); mz += Math.cos(camYaw - Math.PI / 2); }
        if (input.right) { mx += Math.sin(camYaw + Math.PI / 2); mz += Math.cos(camYaw + Math.PI / 2); }
        var len = Math.sqrt(mx * mx + mz * mz);
        if (len > 0) {
          mx /= len; mz /= len;
          var nx = CV.G.playerPos.x + mx * speed * dt;
          var nz = CV.G.playerPos.z + mz * speed * dt;
          var col = CV.World.collide(nx, nz, 0.55);
          if (col) { nx = col.x; nz = col.z; }
          if (CV.World.inWater(nx, nz)) { nx = CV.G.playerPos.x; nz = CV.G.playerPos.z; }
          CV.G.playerPos.x = nx; CV.G.playerPos.z = nz;
          CV.G.playerHeading = CV.angleLerp(CV.G.playerHeading, Math.atan2(mx, mz), 1 - Math.pow(0.001, dt));
          CV.G.speed = speed;
        } else {
          CV.G.speed = 0;
        }
        mesh.visible = true;
        mesh.position.set(CV.G.playerPos.x, 0, CV.G.playerPos.z);
        mesh.rotation.y = CV.G.playerHeading;
        CV.Audio.setEngine(0, 1, false);
      }
      // Camera follow.
      var cam = CV.World.camera;
      if (cam) {
        var tx = CV.G.playerPos.x, tz = CV.G.playerPos.z;
        var cx = tx - Math.sin(camYaw) * Math.cos(camPitch) * camDist;
        var cz = tz - Math.cos(camYaw) * Math.cos(camPitch) * camDist;
        var cy = 2.2 + Math.sin(camPitch) * camDist;
        cam.position.set(cx, cy, cz);
        cam.lookAt(tx, 1.6, tz);
      }
    },
    tryEnterExit: function () {
      if (CV.G.mode !== 'playing') return;
      if (CV.G.driving) {
        var car = CV.G.driving;
        CV.G.driving = null;
        CV.G.playerPos.x = car.x + Math.sin(car.heading + Math.PI / 2) * 2.2;
        CV.G.playerPos.z = car.z + Math.cos(car.heading + Math.PI / 2) * 2.2;
        mesh.visible = true;
        mesh.position.set(CV.G.playerPos.x, 0, CV.G.playerPos.z);
        return;
      }
      var car2 = CV.Traffic.nearestStealable(CV.G.playerPos.x, CV.G.playerPos.z, 4);
      if (car2) {
        var wasParked = car2.driver === null;
        car2.driver = 'player';
        CV.G.driving = car2;
        CV.G.speed = 0;
        mesh.visible = false;
        if (wasParked || car2.kind === 'civilian') {
          // Stealing a car in view of peds or police raises heat.
          var seen = false;
          for (var i = 0; i < CV.Pedestrians.list.length; i++) {
            var p = CV.Pedestrians.list[i];
            if (CV.dist2d(p.x, p.z, car2.x, car2.z) < 24) { seen = true; break; }
          }
          if (seen || CV.Police.wantedCount() > 0) CV.Police.addHeat(1, 'car theft');
        }
        CV.Audio.unlock();
      }
    },
    damage: function (amount, cause) {
      if (CV.G.mode !== 'playing') return;
      CV.G.health -= amount;
      if (CV.G.health <= 0) {
        CV.G.health = 0;
        CV.G.mode = 'wasted';
        CV.Audio.chime(false);
        if (CV.HUD) CV.HUD.showWasted(cause || 'wasted');
        CV.Police.clearAll();
      }
    },
    heal: function (amount) {
      CV.G.health = CV.clamp(CV.G.health + amount, 0, CV.TUNE.maxHealth);
    },
    respawnHospital: function () {
      var fine = Math.min(150, Math.round(CV.G.cash * 0.1));
      CV.G.cash -= fine;
      CV.G.health = CV.TUNE.maxHealth;
      CV.G.wanted = 0; CV.G.bust = 0;
      CV.G.driving = null;
      CV.G.playerPos.x = 40; CV.G.playerPos.z = 40; // hospital, downtown plaza edge
      CV.G.playerHeading = 0;
      mesh.visible = true;
      mesh.position.set(40, 0, 40);
      CV.G.mode = 'playing';
      CV.Save.write();
      if (CV.HUD) CV.HUD.toast('Hospital bill: $' + fine);
    },
    respawnPoliceStation: function () {
      CV.G.health = CV.TUNE.maxHealth;
      CV.G.driving = null;
      CV.G.playerPos.x = -40; CV.G.playerPos.z = -40; // PD, downtown
      CV.G.playerHeading = 0;
      mesh.visible = true;
      mesh.position.set(-40, 0, -40);
      CV.G.mode = 'playing';
      CV.Save.write();
    },
  };
})();
