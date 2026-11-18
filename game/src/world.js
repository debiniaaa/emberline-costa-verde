// EMBERLINE: Costa Verde — island city generation (seeded, deterministic).
// Grid streets, buildings with canvas window textures, beach, animated sea,
// marina, port cranes, hotel towers, causeway, lighthouse islet and the
// cover zones the police helicopter cannot see into. Also owns collision.
(function () {
  'use strict';
  var CV = window.CV;
  var THREE = window.THREE;

  var scene = null, seaMesh = null, foamRing = null, beacon = null, beaconRing = null;
  var colliders = [];
  var buildings2d = [];   // {x,z,w,d} for the minimap
  var sunDisc = null;

  function windowTexture(base, lit) {
    var c = document.createElement('canvas');
    c.width = 128; c.height = 256;
    var g = c.getContext('2d');
    g.fillStyle = base; g.fillRect(0, 0, 128, 256);
    for (var y = 8; y < 248; y += 22) {
      for (var x = 8; x < 120; x += 20) {
        g.fillStyle = CV.rng() < 0.28 ? lit : '#2c3440';
        g.fillRect(x, y, 12, 14);
      }
    }
    var tex = new THREE.CanvasTexture(c);
    return tex;
  }

  function roadTexture() {
    var c = document.createElement('canvas');
    c.width = 64; c.height = 64;
    var g = c.getContext('2d');
    g.fillStyle = '#3a3f46'; g.fillRect(0, 0, 64, 64);
    g.fillStyle = '#c8c8a8'; g.fillRect(30, 6, 4, 20);
    g.fillStyle = '#565c66'; g.fillRect(0, 0, 64, 2); g.fillRect(0, 62, 64, 2);
    var tex = new THREE.CanvasTexture(c);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    return tex;
  }

  function box(w, h, d, color, x, y, z, opts) {
    var mat = new THREE.MeshLambertMaterial({ color: color });
    if (opts && opts.map) mat.map = opts.map;
    if (opts && opts.emissive) mat.emissive = new THREE.Color(opts.emissive);
    var m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y, z);
    if (opts && opts.ry) m.rotation.y = opts.ry;
    scene.add(m);
    return m;
  }

  function addCollider(x, z, hw, hd) {
    colliders.push({ x0: x - hw, z0: z - hd, x1: x + hw, z1: z + hd });
  }

  function buildGround() {
    // Sea (animated), sand island, city slab.
    var seaMat = new THREE.MeshLambertMaterial({ color: CV.PALETTE.sea });
    seaMesh = new THREE.Mesh(new THREE.PlaneGeometry(CV.SEA_SIZE, CV.SEA_SIZE), seaMat);
    seaMesh.rotation.x = -Math.PI / 2;
    seaMesh.position.y = -0.8;
    scene.add(seaMesh);

    var sand = new THREE.Mesh(
      new THREE.PlaneGeometry(CV.ISLAND_HALF * 2, CV.ISLAND_HALF * 2),
      new THREE.MeshLambertMaterial({ color: CV.PALETTE.sand }));
    sand.rotation.x = -Math.PI / 2;
    sand.position.y = -0.2;
    scene.add(sand);

    var city = new THREE.Mesh(
      new THREE.PlaneGeometry(CV.CITY_HALF * 2, CV.CITY_HALF * 2),
      new THREE.MeshLambertMaterial({ color: 0x8f959c }));
    city.rotation.x = -Math.PI / 2;
    city.position.y = 0;
    scene.add(city);

    // Foam ring where the sand meets the sea.
    foamRing = new THREE.Mesh(
      new THREE.RingGeometry(CV.ISLAND_HALF - 6, CV.ISLAND_HALF + 2, 64),
      new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.35, side: THREE.DoubleSide }));
    foamRing.rotation.x = -Math.PI / 2;
    foamRing.position.y = -0.4;
    scene.add(foamRing);

    // Sun disc + a few flat clouds for the golden-hour sky.
    sunDisc = new THREE.Mesh(
      new THREE.CircleGeometry(26, 32),
      new THREE.MeshBasicMaterial({ color: 0xffe9a8, fog: false }));
    sunDisc.position.set(-420, 190, -620);
    sunDisc.lookAt(0, 60, 0);
    scene.add(sunDisc);
    for (var i = 0; i < 7; i++) {
      var cl = new THREE.Mesh(
        new THREE.SphereGeometry(CV.rand(18, 34), 8, 6),
        new THREE.MeshBasicMaterial({ color: 0xfff2d8, transparent: true, opacity: 0.75, fog: false }));
      cl.scale.y = 0.35;
      cl.position.set(CV.rand(-500, 500), CV.rand(140, 220), CV.rand(-600, -200));
      scene.add(cl);
    }
  }

  function buildRoads() {
    var tex = roadTexture();
    var mat = new THREE.MeshLambertMaterial({ map: tex });
    CV.GRID.forEach(function (c) {
      // north-south road
      var ns = new THREE.Mesh(new THREE.PlaneGeometry(CV.ROAD_HALF * 2, CV.CITY_HALF * 2), mat);
      ns.rotation.x = -Math.PI / 2;
      ns.position.set(c, 0.05, 0);
      scene.add(ns);
      // east-west road
      var ew = new THREE.Mesh(new THREE.PlaneGeometry(CV.CITY_HALF * 2, CV.ROAD_HALF * 2), mat);
      ew.rotation.x = -Math.PI / 2;
      ew.position.set(0, 0.05, c);
      scene.add(ew);
    });
  }

  function buildBuildings() {
    var texA = windowTexture('#e8b48c', '#ffe9a8');
    var texB = windowTexture('#a8c4d4', '#fff2c8');
    var texC = windowTexture('#d9a0a8', '#ffe9a8');
    var texs = [texA, texB, texC];
    var geo = new THREE.BoxGeometry(1, 1, 1);

    // City blocks: between road centrelines, blocks run from -180..180 in
    // 40-unit steps. Skip blocks reserved for plaza, park, port, marina.
    var skip = { '0,0': 1, '-1,0': 1, '1,2': 1, '-2,-2': 1, '4,0': 1, '4,1': 1, '0,4': 1, '-4,3': 1 };
    for (var bx = -4; bx <= 3; bx++) {
      for (var bz = -4; bz <= 3; bz++) {
        if (skip[bx + ',' + bz]) continue;
        var cx = bx * 40 + 20, cz = bz * 40 + 20;
        var n = CV.randInt(1, 3);
        for (var k = 0; k < n; k++) {
          var w = CV.rand(10, 18), d = CV.rand(10, 18);
          var h = CV.rand(8, 26);
          if (Math.abs(cx) < 60 && Math.abs(cz) < 60) h = CV.rand(18, 34); // downtown taller
          var ox = CV.rand(-7, 7), oz = CV.rand(-7, 7);
          var x = cx + ox, z = cz + oz;
          var mat = new THREE.MeshLambertMaterial({ map: texs[CV.randInt(0, 2)] });
          var m = new THREE.Mesh(geo, mat);
          m.scale.set(w, h, d);
          m.position.set(x, h / 2, z);
          scene.add(m);
          addCollider(x, z, w / 2 + 0.4, d / 2 + 0.4);
          buildings2d.push({ x: x, z: z, w: w, d: d });
        }
      }
    }

    // Downtown towers (tall, distinct).
    var towerTex = windowTexture('#7fa8c9', '#fff2c8');
    [[-14, -14, 46], [14, -14, 58], [-14, 14, 40], [16, 16, 66]].forEach(function (t) {
      var mat = new THREE.MeshLambertMaterial({ map: towerTex });
      var m = new THREE.Mesh(geo, mat);
      m.scale.set(16, t[2], 16);
      m.position.set(t[0], t[2] / 2, t[1]);
      scene.add(m);
      addCollider(t[0], t[1], 8.4, 8.4);
      buildings2d.push({ x: t[0], z: t[1], w: 16, d: 16 });
    });

    // Hotel towers along the west beach.
    var hotelTex = windowTexture('#f0d9a0', '#ffe9a8');
    [[-196, -60, 44], [-196, 10, 52], [-196, 80, 38]].forEach(function (t) {
      var mat = new THREE.MeshLambertMaterial({ map: hotelTex });
      var m = new THREE.Mesh(geo, mat);
      m.scale.set(18, t[2], 14);
      m.position.set(t[0], t[2] / 2, t[1]);
      scene.add(m);
      addCollider(t[0], t[1], 9.4, 7.4);
      buildings2d.push({ x: t[0], z: t[1], w: 18, d: 14 });
    });

    // Central plaza: fountain + benches (block 0,0).
    var fountain = new THREE.Mesh(
      new THREE.CylinderGeometry(6, 7, 1.2, 20),
      new THREE.MeshLambertMaterial({ color: 0x6fb7d4 }));
    fountain.position.set(20, 0.6, 20);
    scene.add(fountain);
    addCollider(20, 20, 7, 7);

    // Port warehouse (cover zone) + containers, east edge.
    box(44, 12, 36, 0x9a8f80, 152, 6, -148);
    addCollider(152, -148, 22, 18);
    buildings2d.push({ x: 152, z: -148, w: 44, d: 36 });
    var contCols = [0xc45a3c, 0x3c7ac4, 0x5aa03c, 0xd4a03c];
    for (var i = 0; i < 10; i++) {
      var cx2 = 128 + (i % 5) * 10, cz2 = -120 + Math.floor(i / 5) * 8;
      box(8, 3.4, 3.4, contCols[i % 4], cx2, 1.7, cz2, { ry: 0 });
      addCollider(cx2, cz2, 4.2, 1.9);
    }

    // Port cranes.
    for (var c = 0; c < 3; c++) {
      var px = 186, pz = -160 + c * 22;
      box(3, 34, 3, 0xd4a03c, px, 17, pz);
      box(3, 3, 26, 0xd4a03c, px, 32, pz + 8);
      box(2, 6, 2, 0x3a3f46, px, 26, pz + 18);
      addCollider(px, pz, 2, 2);
    }

    // Parking garage (cover zone), west edge.
    box(44, 14, 28, 0x7a7f86, -152, 7, 112);
    addCollider(-152, 112, 22, 14);
    buildings2d.push({ x: -152, z: 112, w: 44, d: 28 });

    // Marina docks, south shore.
    for (var d = 0; d < 4; d++) {
      var dx = -120 + d * 80;
      box(4, 0.8, 46, 0x8a6a42, dx, 0.4, 218);
      for (var b = 0; b < 3; b++) {
        var bx2 = dx + (b % 2 === 0 ? -6 : 6), bz2 = 200 + b * 12;
        box(4, 2, 10, 0xf0f0e8, bx2, 0.6, bz2);
      }
    }

    // Causeway underpass (cover zone): bridge deck over the south road.
    box(40, 2, 10, 0x8f959c, 0, 7, 182);
    box(2, 7, 8, 0x6a6f76, -18, 3.5, 182);
    box(2, 7, 8, 0x6a6f76, 18, 3.5, 182);
    addCollider(-18, 182, 1.4, 4.4);
    addCollider(18, 182, 1.4, 4.4);

    // Lighthouse on a small islet, north-east.
    var lh = new THREE.Mesh(
      new THREE.CylinderGeometry(3, 4, 22, 12),
      new THREE.MeshLambertMaterial({ color: 0xf0e8d8 }));
    lh.position.set(220, 11, -220);
    scene.add(lh);
    var lhTop = new THREE.Mesh(
      new THREE.SphereGeometry(2.6, 12, 8),
      new THREE.MeshBasicMaterial({ color: 0xffe9a8 }));
    lhTop.position.set(220, 23, -220);
    scene.add(lhTop);
    var islet = new THREE.Mesh(
      new THREE.CylinderGeometry(16, 18, 2, 20),
      new THREE.MeshLambertMaterial({ color: CV.PALETTE.sand }));
    islet.position.set(220, -0.2, -220);
    scene.add(islet);

    // Palm trees along the beach ring and the avenues.
    var trunkGeo = new THREE.CylinderGeometry(0.35, 0.55, 7, 6);
    var trunkMat = new THREE.MeshLambertMaterial({ color: CV.PALETTE.palmTrunk });
    var leafGeo = new THREE.ConeGeometry(3.2, 4.5, 7);
    var leafMat = new THREE.MeshLambertMaterial({ color: CV.PALETTE.palmLeaf });
    for (var p = 0; p < 64; p++) {
      var ang = CV.rand(0, Math.PI * 2);
      var rad = CV.rand(CV.CITY_HALF + 8, CV.ISLAND_HALF - 12);
      var px2 = Math.cos(ang) * rad, pz2 = Math.sin(ang) * rad;
      if (Math.abs(px2) < CV.CITY_HALF + 2 && Math.abs(pz2) < CV.CITY_HALF + 2) continue;
      var trunk = new THREE.Mesh(trunkGeo, trunkMat);
      trunk.position.set(px2, 3.5, pz2);
      trunk.rotation.z = CV.rand(-0.12, 0.12);
      scene.add(trunk);
      var leaf = new THREE.Mesh(leafGeo, leafMat);
      leaf.position.set(px2, 8.4, pz2);
      scene.add(leaf);
    }
    // Avenue palms along the central boulevard.
    for (var a = -160; a <= 160; a += 40) {
      if (a === 0) continue;
      [a, -a].forEach(function (v) {
        var trunk2 = new THREE.Mesh(trunkGeo, trunkMat);
        trunk2.position.set(v + 7, 3.5, 0);
        scene.add(trunk2);
        var leaf2 = new THREE.Mesh(leafGeo, leafMat);
        leaf2.position.set(v + 7, 8.4, 0);
        scene.add(leaf2);
      });
    }

    // Street lamps at intersections.
    var lampGeo = new THREE.CylinderGeometry(0.18, 0.18, 6, 6);
    var lampMat = new THREE.MeshLambertMaterial({ color: 0x3a3f46 });
    var bulbGeo = new THREE.SphereGeometry(0.7, 8, 6);
    var bulbMat = new THREE.MeshBasicMaterial({ color: 0xffe9a8 });
    CV.GRID.forEach(function (gx) {
      CV.GRID.forEach(function (gz) {
        if ((gx + gz) % 80 !== 0) return;
        var pole = new THREE.Mesh(lampGeo, lampMat);
        pole.position.set(gx + 5.5, 3, gz + 5.5);
        scene.add(pole);
        var bulb = new THREE.Mesh(bulbGeo, bulbMat);
        bulb.position.set(gx + 5.5, 6.2, gz + 5.5);
        scene.add(bulb);
      });
    });

    // Beach umbrellas on the west beach.
    for (var u = 0; u < 10; u++) {
      var ux = CV.rand(-240, -200), uz = CV.rand(-160, 160);
      var umb = new THREE.Mesh(
        new THREE.ConeGeometry(3, 1.6, 8),
        new THREE.MeshLambertMaterial({ color: [0xd45a5a, 0x5a8fd4, 0xe8d25a][u % 3] }));
      umb.position.set(ux, 3.4, uz);
      scene.add(umb);
      var upole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 3, 6), lampMat);
      upole.position.set(ux, 1.5, uz);
      scene.add(upole);
    }
  }

  function buildBeacon() {
    beacon = new THREE.Mesh(
      new THREE.CylinderGeometry(1.4, 1.4, 34, 12, 1, true),
      new THREE.MeshBasicMaterial({ color: 0xffd24a, transparent: true, opacity: 0.5, side: THREE.DoubleSide, depthWrite: false }));
    beacon.position.set(0, 17, 0);
    beacon.visible = false;
    scene.add(beacon);
    beaconRing = new THREE.Mesh(
      new THREE.RingGeometry(2.2, 3.2, 24),
      new THREE.MeshBasicMaterial({ color: 0xffd24a, transparent: true, opacity: 0.8, side: THREE.DoubleSide }));
    beaconRing.rotation.x = -Math.PI / 2;
    beaconRing.position.set(0, 0.15, 0);
    beaconRing.visible = false;
    scene.add(beaconRing);
  }

  CV.World = {
    scene: null,
    colliders: colliders,
    buildings2d: buildings2d,
    init: function (sc) {
      scene = sc;
      CV.World.scene = sc;
      buildGround();
      buildRoads();
      buildBuildings();
      buildBeacon();
    },
    animate: function (dt, t) {
      if (seaMesh) seaMesh.position.y = -0.8 + Math.sin(t * 0.5) * 0.15;
      if (foamRing) foamRing.material.opacity = 0.25 + Math.sin(t * 0.8) * 0.12;
      if (beacon && beacon.visible) {
        beacon.material.opacity = 0.35 + Math.sin(t * 4) * 0.15;
        var s = 1 + Math.sin(t * 4) * 0.15;
        beaconRing.scale.set(s, s, 1);
      }
    },
    setBeacon: function (x, z, visible) {
      if (!beacon) return;
      beacon.visible = !!visible;
      beaconRing.visible = !!visible;
      if (visible) {
        beacon.position.x = x; beacon.position.z = z;
        beaconRing.position.x = x; beaconRing.position.z = z;
      }
    },
    // Circle-vs-AABB collision: returns corrected {x,z} (pushed out) or null.
    collide: function (x, z, r) {
      for (var i = 0; i < colliders.length; i++) {
        var c = colliders[i];
        var nx = CV.clamp(x, c.x0, c.x1);
        var nz = CV.clamp(z, c.z0, c.z1);
        var dx = x - nx, dz = z - nz;
        var d2 = dx * dx + dz * dz;
        if (d2 < r * r) {
          if (d2 > 0.0001) {
            var d = Math.sqrt(d2);
            return { x: nx + (dx / d) * r, z: nz + (dz / d) * r, hit: true };
          }
          // Centre inside the box: push out along the smallest axis.
          var pl = x - c.x0, pr = c.x1 - x, pt = z - c.z0, pb = c.z1 - z;
          var m = Math.min(pl, pr, pt, pb);
          if (m === pl) return { x: c.x0 - r, z: z, hit: true };
          if (m === pr) return { x: c.x1 + r, z: z, hit: true };
          if (m === pt) return { x: x, z: c.z0 - r, hit: true };
          return { x: x, z: c.z1 + r, hit: true };
        }
      }
      return null;
    },
    onRoad: function (x, z) {
      for (var i = 0; i < CV.GRID.length; i++) {
        if (Math.abs(x - CV.GRID[i]) < CV.ROAD_HALF + 0.5) return true;
        if (Math.abs(z - CV.GRID[i]) < CV.ROAD_HALF + 0.5) return true;
      }
      return false;
    },
    inWater: function (x, z) {
      return Math.abs(x) > CV.ISLAND_HALF || Math.abs(z) > CV.ISLAND_HALF;
    },
    randomRoadPoint: function () {
      var gx = CV.pick(CV.GRID), gz = CV.pick(CV.GRID);
      return { x: gx + CV.rand(-2, 2), z: gz + CV.rand(-2, 2) };
    },
    randomSidewalkPoint: function () {
      var gx = CV.pick(CV.GRID), gz = CV.pick(CV.GRID);
      return { x: gx + CV.rand(6, 12) * (CV.rng() < 0.5 ? -1 : 1), z: gz + CV.rand(-14, 14) };
    },
  };
})();
