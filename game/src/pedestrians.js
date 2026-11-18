// EMBERLINE: Costa Verde — pedestrians: sidewalk wanderers who flee
// danger and witness crimes (which raises the wanted level).
(function () {
  'use strict';
  var CV = window.CV;
  var THREE = window.THREE;

  var peds = [];
  var SHIRT = [0xd45a5a, 0x5a8fd4, 0x5aa03c, 0xe8d25a, 0x8e44ad, 0xecf0f1, 0x2e86c1];

  function makePedMesh(shirt) {
    var g = new THREE.Group();
    var body = new THREE.Mesh(new THREE.BoxGeometry(0.7, 1.1, 0.4),
      new THREE.MeshLambertMaterial({ color: shirt }));
    body.position.y = 0.95;
    g.add(body);
    var head = new THREE.Mesh(new THREE.SphereGeometry(0.28, 10, 8),
      new THREE.MeshLambertMaterial({ color: 0xe8b88a }));
    head.position.y = 1.75;
    g.add(head);
    var legL = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.7, 0.26),
      new THREE.MeshLambertMaterial({ color: 0x2c3e50 }));
    legL.position.set(-0.18, 0.35, 0);
    g.add(legL);
    var legR = legL.clone();
    legR.position.x = 0.18;
    g.add(legR);
    var shadow = new THREE.Mesh(new THREE.CircleGeometry(0.5, 12),
      new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.22, depthWrite: false }));
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = 0.02;
    g.add(shadow);
    return g;
  }

  CV.Pedestrians = {
    list: peds,
    init: function (n) {
      for (var i = 0; i < n; i++) {
        var p = CV.World.randomSidewalkPoint();
        var mesh = makePedMesh(SHIRT[i % SHIRT.length]);
        mesh.position.set(p.x, 0, p.z);
        CV.World.scene.add(mesh);
        peds.push({
          mesh: mesh, x: p.x, z: p.z, heading: CV.rand(0, Math.PI * 2),
          speed: CV.rand(1.2, 2.4), state: 'walk', // walk | flee | down
          downTimer: 0, fleeTimer: 0, target: CV.World.randomSidewalkPoint(),
          witnessCooldown: 0, isPassenger: false,
        });
      }
    },
    update: function (dt, playerX, playerZ, danger) {
      // danger: {x, z, radius} of a recent crime (gunshot / car hit), or null.
      for (var i = 0; i < peds.length; i++) {
        var p = peds[i];
        if (p.state === 'down') {
          p.downTimer -= dt;
          p.mesh.rotation.x = -Math.PI / 2 * 0.9;
          if (p.downTimer <= 0) { p.state = 'walk'; p.mesh.rotation.x = 0; }
          continue;
        }
        var dPlayer = CV.dist2d(p.x, p.z, playerX, playerZ);
        var flee = false;
        if (danger && CV.dist2d(p.x, p.z, danger.x, danger.z) < danger.radius) flee = true;
        if (dPlayer < 3.5 && CV.G.driving && Math.abs(CV.G.speed) > 6) flee = true;
        if (flee) { p.state = 'flee'; p.fleeTimer = 2.5; }
        if (p.state === 'flee') {
          p.fleeTimer -= dt;
          var away = Math.atan2(p.x - playerX, p.z - playerZ);
          p.heading = CV.angleLerp(p.heading, away, 1 - Math.pow(0.01, dt));
          p.x += Math.sin(p.heading) * 5.5 * dt;
          p.z += Math.cos(p.heading) * 5.5 * dt;
          if (p.fleeTimer <= 0) p.state = 'walk';
        } else {
          var tx = p.target.x - p.x, tz = p.target.z - p.z;
          var td = Math.sqrt(tx * tx + tz * tz);
          if (td < 1.5) { p.target = CV.World.randomSidewalkPoint(); }
          else {
            var want = Math.atan2(tx, tz);
            p.heading = CV.angleLerp(p.heading, want, 1 - Math.pow(0.02, dt));
            p.x += Math.sin(p.heading) * p.speed * dt;
            p.z += Math.cos(p.heading) * p.speed * dt;
          }
        }
        var col = CV.World.collide(p.x, p.z, 0.5);
        if (col) { p.x = col.x; p.z = col.z; }
        if (CV.World.inWater(p.x, p.z)) { p.x = CV.clamp(p.x, -250, 250); p.z = CV.clamp(p.z, -250, 250); }
        p.mesh.position.set(p.x, 0, p.z);
        p.mesh.rotation.y = p.heading;
        // Witness: a ped close to a crime the player committed tells the cops.
        if (p.witnessCooldown > 0) p.witnessCooldown -= dt;
        if (danger && p.witnessCooldown <= 0 && CV.dist2d(p.x, p.z, danger.x, danger.z) < 26) {
          p.witnessCooldown = 8;
          CV.Police.addHeat(1, 'witnessed');
        }
      }
    },
    knockDown: function (p, seconds) {
      if (p.state === 'down') return;
      p.state = 'down';
      p.downTimer = seconds || 4;
    },
    nearest: function (x, z, range) {
      var best = null, bd = range;
      for (var i = 0; i < peds.length; i++) {
        var p = peds[i];
        if (p.state === 'down') continue;
        var d = CV.dist2d(x, z, p.x, p.z);
        if (d < bd) { bd = d; best = p; }
      }
      return best;
    },
  };
})();
