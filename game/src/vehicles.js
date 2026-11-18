// EMBERLINE: Costa Verde — car factory and arcade driving physics.
(function () {
  'use strict';
  var CV = window.CV;
  var THREE = window.THREE;

  var CAR_COLORS = [0xc0392b, 0x2e86c1, 0xf1c40f, 0x27ae60, 0x8e44ad, 0xe67e22, 0xecf0f1, 0x1a1a1a, 0x7f8c8d, 0x16a085];

  function makeCarMesh(color, opts) {
    var group = new THREE.Group();
    var bodyMat = new THREE.MeshLambertMaterial({ color: color });
    var glassMat = new THREE.MeshLambertMaterial({ color: 0x1a2a3a });
    var body = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.65, 4.4), bodyMat);
    body.position.y = 0.55;
    group.add(body);
    var cabin = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.6, 2.2), glassMat);
    cabin.position.set(0, 1.15, -0.2);
    group.add(cabin);
    if (opts && opts.police) {
      var bar = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.22, 0.5),
        new THREE.MeshLambertMaterial({ color: 0xffffff, emissive: 0x2233ff }));
      bar.position.set(0, 1.55, -0.2);
      group.add(bar);
      var stripe = new THREE.Mesh(new THREE.BoxGeometry(2.12, 0.2, 4.42),
        new THREE.MeshLambertMaterial({ color: 0x111111 }));
      stripe.position.y = 0.85;
      group.add(stripe);
    }
    // Headlights / taillights.
    var hl = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.16, 0.1),
      new THREE.MeshBasicMaterial({ color: 0xfff2b0 }));
    hl.position.set(0, 0.62, 2.21);
    group.add(hl);
    var tl = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.16, 0.1),
      new THREE.MeshBasicMaterial({ color: 0xff2222 }));
    tl.position.set(0, 0.62, -2.21);
    group.add(tl);
    // Wheels.
    var wheelGeo = new THREE.CylinderGeometry(0.38, 0.38, 0.3, 10);
    var wheelMat = new THREE.MeshLambertMaterial({ color: 0x111111 });
    var wheels = [];
    [[-1.0, 1.4], [1.0, 1.4], [-1.0, -1.4], [1.0, -1.4]].forEach(function (p) {
      var w = new THREE.Mesh(wheelGeo, wheelMat);
      w.rotation.z = Math.PI / 2;
      w.position.set(p[0], 0.38, p[1]);
      group.add(w);
      wheels.push(w);
    });
    // Fake blob shadow.
    var shadow = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 5),
      new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.25, depthWrite: false }));
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = 0.02;
    group.add(shadow);
    group.userData.wheels = wheels;
    return group;
  }

  // A car: {mesh, x, z, heading, speed, color, kind, health, ai}
  CV.Vehicles = {
    cars: [],       // all cars in the world (player + traffic + police + parked)
    parked: [],
    make: function (color, x, z, heading, opts) {
      var mesh = makeCarMesh(color, opts || {});
      mesh.position.set(x, 0, z);
      mesh.rotation.y = heading;
      CV.World.scene.add(mesh);
      var car = {
        mesh: mesh, x: x, z: z, heading: heading, speed: 0,
        color: color, kind: (opts && opts.kind) || 'civilian',
        health: 100, steer: 0, wheels: mesh.userData.wheels,
        driver: null, // 'player' | 'traffic' | 'police' | null (parked)
      };
      this.cars.push(car);
      return car;
    },
    spawnParked: function (n) {
      for (var i = 0; i < n; i++) {
        var gx = CV.pick(CV.GRID), gz = CV.pick(CV.GRID);
        var alongRoad = CV.rng() < 0.5;
        var x, z, heading;
        if (alongRoad) { x = gx + 5.2; z = gz + CV.rand(-16, 16); heading = CV.rng() < 0.5 ? 0 : Math.PI; }
        else { x = gx + CV.rand(-16, 16); z = gz + 5.2; heading = CV.rng() < 0.5 ? Math.PI / 2 : -Math.PI / 2; }
        var car = this.make(CV.pick(CAR_COLORS), x, z, heading, {});
        car.driver = null;
        this.parked.push(car);
      }
    },
    remove: function (car) {
      var idx = this.cars.indexOf(car);
      if (idx >= 0) this.cars.splice(idx, 1);
      var pi = this.parked.indexOf(car);
      if (pi >= 0) this.parked.splice(pi, 1);
      if (car.mesh && car.mesh.parent) car.mesh.parent.remove(car.mesh);
    },
    // Arcade player driving. input: {up, down, left, right}. Returns hit info.
    drivePlayer: function (car, input, dt) {
      var T = CV.TUNE;
      var accel = 0;
      if (input.up) accel = T.carAccel;
      if (input.down) accel = car.speed > 0.5 ? -T.carBrake : -T.carAccel * 0.6;
      car.speed += accel * dt;
      // Drag + rolling resistance.
      car.speed -= car.speed * 0.55 * dt;
      if (!input.up && !input.down) car.speed -= Math.sign(car.speed) * 6 * dt;
      if (Math.abs(car.speed) < 0.15 && !input.up && !input.down) car.speed = 0;
      car.speed = CV.clamp(car.speed, -T.carReverseMax, T.carMaxSpeed);
      // Steering (stronger at low speed, none when stopped).
      var steerTarget = 0;
      if (input.left) steerTarget = 1;
      if (input.right) steerTarget = -1;
      car.steer = CV.lerp(car.steer, steerTarget, 1 - Math.pow(0.001, dt));
      var spd = Math.abs(car.speed);
      if (spd > 0.2) {
        car.heading += car.steer * T.carSteer * (spd / T.carMaxSpeed + 0.25) * dt * Math.sign(car.speed);
      }
      var nx = car.x + Math.sin(car.heading) * car.speed * dt;
      var nz = car.z + Math.cos(car.heading) * car.speed * dt;
      var hit = null;
      var col = CV.World.collide(nx, nz, 1.6);
      if (col) {
        nx = col.x; nz = col.z;
        if (Math.abs(car.speed) > 8) {
          hit = { type: 'wall', speed: Math.abs(car.speed) };
          CV.Audio.thud();
        }
        car.speed *= 0.45;
      }
      if (CV.World.inWater(nx, nz)) { nx = car.x; nz = car.z; car.speed *= 0.3; }
      car.x = nx; car.z = nz;
      car.mesh.position.set(car.x, 0, car.z);
      car.mesh.rotation.y = car.heading;
      // Wheel spin + front steer visual.
      var spin = car.speed * dt * 2.4;
      for (var i = 0; i < car.wheels.length; i++) {
        car.wheels[i].rotation.x += spin;
      }
      if (car.wheels[0]) car.wheels[0].rotation.y = car.steer * 0.4;
      if (car.wheels[1]) car.wheels[1].rotation.y = car.steer * 0.4;
      return hit;
    },
    syncMesh: function (car) {
      car.mesh.position.set(car.x, 0, car.z);
      car.mesh.rotation.y = car.heading;
    },
  };
})();
