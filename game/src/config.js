// EMBERLINE: Costa Verde — shared config, seeded RNG and game state.
// One namespace (CV) holds everything the modules share. The world is generated
// from a fixed seed, so every load builds the same city.

(function () {
  'use strict';
  var CV = {};
  window.CV = CV;

  // --- deterministic RNG (mulberry32) -------------------------------------
  CV.SEED = 20261118;
  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  CV.rng = mulberry32(CV.SEED);
  CV.rand = function (a, b) { return a + CV.rng() * (b - a); };
  CV.randInt = function (a, b) { return Math.floor(CV.rand(a, b + 1)); };
  CV.pick = function (arr) { return arr[Math.floor(CV.rng() * arr.length)]; };
  CV.clamp = function (v, a, b) { return v < a ? a : v > b ? b : v; };
  CV.lerp = function (a, b, t) { return a + (b - a) * t; };
  CV.dist2d = function (ax, az, bx, bz) {
    var dx = ax - bx, dz = az - bz;
    return Math.sqrt(dx * dx + dz * dz);
  };
  CV.angleLerp = function (a, b, t) {
    var d = b - a;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    return a + d * t;
  };

  // --- world layout ---------------------------------------------------------
  CV.ROAD_STEP = 40;            // distance between street centrelines
  CV.ROAD_HALF = 4;             // half width of a road
  CV.GRID = [-160, -120, -80, -40, 0, 40, 80, 120, 160];
  CV.CITY_HALF = 180;           // city slab half-size
  CV.ISLAND_HALF = 260;         // sand island half-size
  CV.SEA_SIZE = 2200;

  // Cover zones where the police helicopter loses sight of the player:
  // the causeway underpass and the port warehouse roof area.
  CV.COVER_ZONES = [
    { x0: -20, z0: 168, x1: 20, z1: 196 },     // causeway underpass, south edge
    { x0: 128, z0: -168, x1: 176, z1: -128 },  // port warehouse, east edge
    { x0: -176, z0: 96, x1: -128, z1: 128 },   // parking garage, west edge
  ];
  CV.inCoverZone = function (x, z) {
    for (var i = 0; i < CV.COVER_ZONES.length; i++) {
      var c = CV.COVER_ZONES[i];
      if (x >= c.x0 && x <= c.x1 && z >= c.z0 && z <= c.z1) return true;
    }
    return false;
  };

  // --- tuning ---------------------------------------------------------------
  CV.TUNE = {
    walkSpeed: 9,
    runSpeed: 13,
    carAccel: 26,
    carBrake: 42,
    carMaxSpeed: 46,      // ~103 mph feel
    carReverseMax: 14,
    carSteer: 1.9,
    trafficSpeed: 11,
    policeSpeed: 52,
    heliSpeed: 26,
    heliHeight: 42,
    bustDistance: 7,
    bustRate: 0.55,       // bust meter per second while pinned
    heatDecay: 0.12,      // stars per second while hidden
    maxHealth: 100,
    pistolDamage: 34,
    meleeDamage: 25,
    meleeRange: 2.6,
  };

  // --- palette ---------------------------------------------------------------
  CV.PALETTE = {
    sky: 0xffd9a0,
    sea: 0x2e7f9e,
    sand: 0xe8d29a,
    road: 0x3a3f46,
    sidewalk: 0x9aa0a6,
    building: [0xe8b48c, 0xd9a0a8, 0xa8c4d4, 0xf0d9a0, 0xc4b8d4, 0x9ac4a8],
    tower: [0x7fa8c9, 0xd4a05a, 0x8fb8a0],
    palmTrunk: 0x8a6a42,
    palmLeaf: 0x3f8f4f,
  };

  // --- mutable game state ----------------------------------------------------
  CV.G = {
    mode: 'menu',           // menu | playing | paused | wasted | busted
    time: 0,
    cash: 250,
    health: 100,
    wanted: 0,              // 0..5
    bust: 0,                // 0..1
    missionIndex: 0,        // story progress (0..7); 8 = story done
    pistol: false,
    kills: 0,
    jobsDone: 0,
    driving: null,          // car object or null
    playerPos: { x: 0, z: 8 },
    playerHeading: 0,
    speed: 0,
    objective: '',
    objectivePos: null,     // {x,z} or null
    shot: null,             // photo-mode scene name
    heliActive: false,
    paused: false,
  };

  CV.resetRun = function () {
    CV.G.mode = 'playing';
    CV.G.health = CV.TUNE.maxHealth;
    CV.G.wanted = 0;
    CV.G.bust = 0;
    CV.G.driving = null;
    CV.G.speed = 0;
    CV.G.playerPos.x = 0; CV.G.playerPos.z = 8;
    CV.G.playerHeading = 0;
  };
})();
