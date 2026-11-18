// EMBERLINE: Costa Verde — wanted system, ground pursuit, bust meter
// and the police helicopter (3+ stars). The helicopter tracks the player
// from above and keeps the heat locked while it has sight; the player
// breaks sight by hiding in a cover zone (causeway underpass, port
// warehouse, parking garage) or by getting far away for 8 seconds.
(function () {
  'use strict';
  var CV = window.CV;
  var THREE = window.THREE;

  var policeCars = [];
  var heli = null;       // {mesh, rotor, light, state, lostTimer}
  var heatLock = false;
  var spawnTimer = 0;

  function makeHeli() {
    var g = new THREE.Group();
    var body = new THREE.Mesh(new THREE.BoxGeometry(3.2, 1.6, 6.5),
      new THREE.MeshLambertMaterial({ color: 0x1a2a5a }));
    body.position.y = 0;
    g.add(body);
    var tail = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.8, 5),
      new THREE.MeshLambertMaterial({ color: 0x1a2a5a }));
    tail.position.set(0, 0.3, -5.2);
    g.add(tail);
    var glass = new THREE.Mesh(new THREE.BoxGeometry(2.6, 1.0, 1.8),
      new THREE.MeshLambertMaterial({ color: 0x9fd4e8 }));
    glass.position.set(0, 0.4, 2.2);
    g.add(glass);
    var rotor = new THREE.Mesh(new THREE.BoxGeometry(9, 0.12, 0.5),
      new THREE.MeshLambertMaterial({ color: 0x222222 }));
    rotor.position.y = 1.1;
    g.add(rotor);
    var tailRotor = new THREE.Mesh(new THREE.BoxGeometry(0.12, 2.2, 0.5),
      new THREE.MeshLambertMaterial({ color: 0x222222 }));
    tailRotor.position.set(0.5, 0.5, -7.4);
    g.add(tailRotor);
    // Searchlight cone.
    var cone = new THREE.Mesh(
      new THREE.ConeGeometry(7, 40, 16, 1, true),
      new THREE.MeshBasicMaterial({ color: 0xfff2b0, transparent: true, opacity: 0.16, side: THREE.DoubleSide, depthWrite: false }));
    cone.position.y = -20;
    cone.rotation.x = Math.PI;
    g.add(cone);
    g.visible = false;
    CV.World.scene.add(g);
    return { mesh: g, rotor: rotor, cone: cone, state: 'off', lostTimer: 0, x: 0, z: 0 };
  }

  CV.Police = {
    cars: policeCars,
    heli: null,
    init: function () {
      heli = makeHeli();
      this.heli = heli;
    },
    addHeat: function (n, reason) {
      if (CV.G.mode !== 'playing') return;
      var before = CV.G.wanted;
      CV.G.wanted = CV.clamp(CV.G.wanted + n, 0, 5);
      if (CV.G.wanted > before && CV.HUD) CV.HUD.toast('Wanted level up — ' + reason);
      CV.G.bust = 0;
    },
    wantedCount: function () { return Math.floor(CV.G.wanted); },
    spawnPoliceCar: function () {
      var p = CV.World.randomRoadPoint();
      var tries = 0;
      while (CV.dist2d(p.x, p.z, CV.G.playerPos.x, CV.G.playerPos.z) < 60 && tries < 8) {
        p = CV.World.randomRoadPoint(); tries++;
      }
      var car = CV.Vehicles.make(0x1a2a5a, p.x, p.z, 0, { police: true, kind: 'police' });
      car.driver = 'police';
      car.health = 100;
      policeCars.push(car);
      return car;
    },
    update: function (dt) {
      var wanted = this.wantedCount();
      // Spawn / despawn ground units to match wanted level.
      var wantCars = wanted === 0 ? 0 : Math.min(1 + wanted, 5);
      spawnTimer -= dt;
      if (policeCars.length < wantCars && spawnTimer <= 0) {
        this.spawnPoliceCar();
        spawnTimer = 2.5;
      }
      if (wanted === 0) {
        for (var i = policeCars.length - 1; i >= 0; i--) {
          var pc = policeCars[i];
          var d = CV.dist2d(pc.x, pc.z, CV.G.playerPos.x, CV.G.playerPos.z);
          if (d > 220) { CV.Vehicles.remove(pc); policeCars.splice(i, 1); }
        }
      }
      // Ground pursuit.
      var px = CV.G.playerPos.x, pz = CV.G.playerPos.z;
      var nearest = 9999;
      for (var j = 0; j < policeCars.length; j++) {
        var car = policeCars[j];
        var dx = px - car.x, dz = pz - car.z;
        var d = Math.sqrt(dx * dx + dz * dz);
        if (d < nearest) nearest = d;
        var want = Math.atan2(dx, dz);
        car.heading = CV.angleLerp(car.heading, want, 1 - Math.pow(0.05, dt));
        var sp = Math.min(CV.TUNE.policeSpeed, CV.TUNE.policeSpeed * (d / 40 + 0.4));
        var nx = car.x + Math.sin(car.heading) * sp * dt;
        var nz = car.z + Math.cos(car.heading) * sp * dt;
        var col = CV.World.collide(nx, nz, 1.6);
        if (col) {
          // Slide along the wall instead of sticking.
          var nx2 = car.x + Math.sin(car.heading) * sp * dt;
          var nz2 = car.z;
          var col2 = CV.World.collide(nx2, nz2, 1.6);
          if (!col2) { nx = nx2; nz = nz2; }
          else { car.heading += 0.6 * dt * 4; nx = car.x; nz = car.z; }
        }
        car.x = nx; car.z = nz;
        CV.Vehicles.syncMesh(car);
        // Ram the player.
        if (d < 3.2) {
          if (CV.G.driving) {
            CV.G.driving.speed *= 0.55;
            if (Math.abs(CV.G.speed) > 10) CV.Audio.thud();
          } else {
            CV.Player.damage(6 * dt * 10, 'rammed');
          }
        }
      }
      // Bust meter: fills when a cop is close and the player is slow/on foot.
      if (wanted > 0 && nearest < CV.TUNE.bustDistance) {
        var playerSlow = CV.G.driving ? Math.abs(CV.G.speed) < 4 : true;
        if (playerSlow) {
          CV.G.bust += CV.TUNE.bustRate * dt;
          if (CV.G.bust >= 1) this.busted();
        }
      } else {
        CV.G.bust = Math.max(0, CV.G.bust - 0.3 * dt);
      }
      // Helicopter at 3+ stars. Heat is a float that decays continuously,
      // so the heli uses the 2.5 boundary ("around 3 stars") instead of the
      // integer count — otherwise a 3.0 wanted level decays to 2.98 within
      // a fraction of a second and the helicopter would never stay up.
      heatLock = false;
      if (CV.G.wanted >= 2.5) {
        if (heli.state === 'off') {
          heli.state = 'inbound';
          heli.mesh.visible = true;
          heli.x = px + 120; heli.z = pz - 120;
          heli.mesh.position.set(heli.x, CV.TUNE.heliHeight, heli.z);
          if (CV.HUD) CV.HUD.toast('Police helicopter overhead!');
        }
        heli.state = 'tracking';
        var tx = px, tz = pz;
        var hdx = tx - heli.x, hdz = tz - heli.z;
        var hd = Math.sqrt(hdx * hdx + hdz * hdz);
        if (hd > 4) {
          var hs = Math.min(CV.TUNE.heliSpeed, hd * 1.5);
          heli.x += (hdx / hd) * hs * dt;
          heli.z += (hdz / hd) * hs * dt;
        }
        heli.mesh.position.set(heli.x, CV.TUNE.heliHeight + Math.sin(CV.G.time * 1.5) * 1.5, heli.z);
        heli.mesh.rotation.y = Math.atan2(hdx, hdz);
        heli.rotor.rotation.y += dt * 22;
        // Sight: lost inside a cover zone, or far away for 8 seconds.
        var inCover = CV.inCoverZone(px, pz);
        if (inCover || hd > 130) {
          heli.lostTimer += dt;
          if (heli.lostTimer > 3) {
            heli.state = 'off';
            heli.mesh.visible = false;
            CV.G.wanted = Math.max(0, CV.G.wanted - 2);
            if (CV.HUD) CV.HUD.toast(inCover ? 'Lost the helicopter in cover!' : 'Lost the helicopter!');
            CV.Audio.setRotor(false);
          }
        } else {
          heli.lostTimer = 0;
          heatLock = true;   // helicopter keeps the heat on
        }
        CV.Audio.setRotor(true);
        CV.G.heliActive = heli.state !== 'off';
      } else if (heli.state !== 'off') {
        heli.state = 'off';
        heli.mesh.visible = false;
        CV.Audio.setRotor(false);
        CV.G.heliActive = false;
      }
      // Heat decay when no police can see the player.
      if (wanted > 0 && !heatLock && nearest > 60) {
        CV.G.wanted = Math.max(0, CV.G.wanted - CV.TUNE.heatDecay * dt);
      }
      CV.Audio.updateSiren(dt, wanted > 0);
    },
    busted: function () {
      if (CV.G.mode !== 'playing') return;
      var fine = Math.min(Math.round(CV.G.cash * 0.25), 500);
      CV.G.cash -= fine;
      CV.G.wanted = 0; CV.G.bust = 0;
      CV.G.mode = 'busted';
      CV.Audio.chime(false);
      if (CV.HUD) CV.HUD.showBusted(fine);
      CV.Save.write();
    },
    clearAll: function () {
      for (var i = policeCars.length - 1; i >= 0; i--) CV.Vehicles.remove(policeCars[i]);
      policeCars.length = 0;
      if (heli) { heli.state = 'off'; heli.mesh.visible = false; }
      CV.G.wanted = 0; CV.G.bust = 0; CV.G.heliActive = false;
    },
  };
})();
