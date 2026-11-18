// EMBERLINE: Costa Verde — melee and hitscan pistol combat, with
// tracers, sparks and knockdowns. The pistol unlocks after story mission 1.
(function () {
  'use strict';
  var CV = window.CV;
  var THREE = window.THREE;

  var cooldown = 0;
  var tracers = [];
  var sparks = [];

  function spawnSparks(x, y, z, color) {
    var geo = new THREE.BufferGeometry();
    var n = 14;
    var pos = new Float32Array(n * 3);
    var vels = [];
    for (var i = 0; i < n; i++) {
      pos[i * 3] = x; pos[i * 3 + 1] = y; pos[i * 3 + 2] = z;
      vels.push({ x: CV.rand(-4, 4), y: CV.rand(1, 6), z: CV.rand(-4, 4) });
    }
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    var pts = new THREE.Points(geo, new THREE.PointsMaterial({ color: color, size: 0.35 }));
    CV.World.scene.add(pts);
    sparks.push({ pts: pts, vels: vels, life: 0.5 });
  }

  CV.Combat = {
    init: function () {},
    update: function (dt) {
      if (cooldown > 0) cooldown -= dt;
      for (var i = tracers.length - 1; i >= 0; i--) {
        var t = tracers[i];
        t.life -= dt;
        t.mesh.material.opacity = Math.max(0, t.life / 0.12);
        if (t.life <= 0) {
          CV.World.scene.remove(t.mesh);
          tracers.splice(i, 1);
        }
      }
      for (var j = sparks.length - 1; j >= 0; j--) {
        var s = sparks[j];
        s.life -= dt;
        var arr = s.pts.geometry.attributes.position.array;
        for (var k = 0; k < s.vels.length; k++) {
          arr[k * 3] += s.vels[k].x * dt;
          arr[k * 3 + 1] += s.vels[k].y * dt;
          arr[k * 3 + 2] += s.vels[k].z * dt;
          s.vels[k].y -= 12 * dt;
        }
        s.pts.geometry.attributes.position.needsUpdate = true;
        s.pts.material.opacity = Math.max(0, s.life / 0.5);
        if (s.life <= 0) {
          CV.World.scene.remove(s.pts);
          sparks.splice(j, 1);
        }
      }
    },
    melee: function () {
      if (CV.G.mode !== 'playing' || CV.G.driving) return;
      var px = CV.G.playerPos.x, pz = CV.G.playerPos.z;
      var hx = Math.sin(CV.G.playerHeading), hz = Math.cos(CV.G.playerHeading);
      // Hit the nearest ped in front.
      var ped = CV.Pedestrians.nearest(px + hx * 1.5, pz + hz * 1.5, CV.TUNE.meleeRange);
      if (ped) {
        CV.Pedestrians.knockDown(ped, 5);
        spawnSparks(ped.x, 1.2, ped.z, 0xffd24a);
        CV.Audio.thud();
        CV.Police.addHeat(1, 'assault');
        CV.G.kills++;
        return;
      }
      // Or damage a nearby police car.
      for (var i = 0; i < CV.Police.cars.length; i++) {
        var car = CV.Police.cars[i];
        if (CV.dist2d(px, pz, car.x, car.z) < 3.5) {
          car.health -= CV.TUNE.meleeDamage;
          spawnSparks(car.x, 1, car.z, 0xffd24a);
          CV.Audio.thud();
          if (car.health <= 0) {
            car.health = 100;
            CV.Police.addHeat(1, 'attacked police');
          }
          return;
        }
      }
      CV.Audio.thud();
    },
    shoot: function (clientX, clientY) {
      if (CV.G.mode !== 'playing' || !CV.G.pistol || cooldown > 0) return;
      cooldown = 0.28;
      CV.Audio.shot();
      var cam = CV.World.camera;
      var rect = document.getElementById('game-canvas').getBoundingClientRect();
      var nx = ((clientX - rect.left) / rect.width) * 2 - 1;
      var ny = -((clientY - rect.top) / rect.height) * 2 + 1;
      var dir = new THREE.Vector3(nx, ny, 0.5).unproject(cam).sub(cam.position).normalize();
      var origin = cam.position.clone();
      var best = null, bestD = 120;
      // Test peds.
      for (var i = 0; i < CV.Pedestrians.list.length; i++) {
        var p = CV.Pedestrians.list[i];
        if (p.state === 'down') continue;
        var to = new THREE.Vector3(p.x - origin.x, 1.2 - origin.y, p.z - origin.z);
        var d = to.length();
        if (d > bestD) continue;
        to.normalize();
        var dot = to.dot(dir);
        if (dot > 0.995) { best = { type: 'ped', obj: p, d: d }; bestD = d; }
      }
      // Test police cars.
      for (var j = 0; j < CV.Police.cars.length; j++) {
        var car = CV.Police.cars[j];
        var to2 = new THREE.Vector3(car.x - origin.x, 1 - origin.y, car.z - origin.z);
        var d2 = to2.length();
        if (d2 > bestD) continue;
        to2.normalize();
        if (to2.dot(dir) > 0.992) { best = { type: 'car', obj: car, d: d2 }; bestD = d2; }
      }
      var end = origin.clone().add(dir.clone().multiplyScalar(best ? best.d : 120));
      var tracerGeo = new THREE.BoxGeometry(0.06, 0.06, best ? best.d : 120);
      var tracer = new THREE.Mesh(tracerGeo,
        new THREE.MeshBasicMaterial({ color: 0xffe9a8, transparent: true, opacity: 0.9 }));
      tracer.position.copy(origin.clone().add(end).multiplyScalar(0.5));
      tracer.lookAt(end);
      CV.World.scene.add(tracer);
      tracers.push({ mesh: tracer, life: 0.12 });
      if (best) {
        spawnSparks(end.x, end.y, end.z, 0xff6a3c);
        if (best.type === 'ped') {
          CV.Pedestrians.knockDown(best.obj, 6);
          CV.Police.addHeat(1, 'shooting');
          CV.G.kills++;
        } else {
          best.obj.health -= CV.TUNE.pistolDamage;
          if (best.obj.health <= 0) {
            best.obj.health = 100;
            CV.Police.addHeat(1, 'disabled a cruiser');
          }
        }
      }
      CV.Missions.onDanger(CV.G.playerPos.x, CV.G.playerPos.z, 30);
    },
  };
})();
