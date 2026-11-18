// EMBERLINE: Costa Verde — traffic AI: cars looping the road grid.
(function () {
  'use strict';
  var CV = window.CV;

  var loops = [];   // each: {points:[{x,z}], }
  var trafficCars = [];

  function buildLoops() {
    // Rectangular loops around city blocks, on road centrelines.
    var rects = [
      { x0: -120, z0: -120, x1: 120, z1: 120 },
      { x0: -80, z0: -80, x1: 80, z1: 80 },
      { x0: -160, z0: -40, x1: 160, z1: 40 },
      { x0: -40, z0: -160, x1: 40, z1: 160 },
    ];
    rects.forEach(function (r) {
      loops.push({ points: [
        { x: r.x0, z: r.z0 }, { x: r.x1, z: r.z0 },
        { x: r.x1, z: r.z1 }, { x: r.x0, z: r.z1 },
      ] });
    });
  }

  CV.Traffic = {
    cars: trafficCars,
    init: function () {
      buildLoops();
      for (var i = 0; i < 14; i++) {
        var loop = loops[i % loops.length];
        var p = loop.points[i % 4];
        var car = CV.Vehicles.make(0x9aa0a6, p.x + CV.rand(-3, 3), p.z + CV.rand(-3, 3), 0, {});
        car.driver = 'traffic';
        car.loop = loop;
        car.wp = (i % 4 + 1) % 4;
        car.speed = CV.TUNE.trafficSpeed * CV.rand(0.8, 1.15);
        trafficCars.push(car);
      }
    },
    update: function (dt) {
      for (var i = 0; i < trafficCars.length; i++) {
        var car = trafficCars[i];
        var target = car.loop.points[car.wp];
        var dx = target.x - car.x, dz = target.z - car.z;
        var d = Math.sqrt(dx * dx + dz * dz);
        if (d < 3) { car.wp = (car.wp + 1) % car.loop.points.length; continue; }
        var want = Math.atan2(dx, dz);
        car.heading = CV.angleLerp(car.heading, want, 1 - Math.pow(0.02, dt));
        // Slow down if another car is right ahead.
        var slow = false;
        for (var j = 0; j < CV.Vehicles.cars.length; j++) {
          var o = CV.Vehicles.cars[j];
          if (o === car) continue;
          var odx = o.x - car.x, odz = o.z - car.z;
          var od = Math.sqrt(odx * odx + odz * odz);
          if (od < 7) {
            var dot = (Math.sin(car.heading) * odx + Math.cos(car.heading) * odz) / od;
            if (dot > 0.7) { slow = true; break; }
          }
        }
        var sp = slow ? car.speed * 0.3 : CV.TUNE.trafficSpeed;
        car.x += Math.sin(car.heading) * sp * dt;
        car.z += Math.cos(car.heading) * sp * dt;
        CV.Vehicles.syncMesh(car);
      }
    },
    // A traffic car the player can steal: nearest one within range.
    nearestStealable: function (x, z, range) {
      var best = null, bd = range;
      var all = CV.Vehicles.cars;
      for (var i = 0; i < all.length; i++) {
        var c = all[i];
        if (c.driver === 'police') continue;
        if (c === CV.G.driving) continue;
        var d = CV.dist2d(x, z, c.x, c.z);
        if (d < bd) { bd = d; best = c; }
      }
      return best;
    },
  };
})();
