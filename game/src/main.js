// EMBERLINE: Costa Verde — boot and game loop.
(function () {
  'use strict';
  var CV = window.CV;
  var THREE = window.THREE;

  var renderer = null, scene = null, camera = null, clock = null;
  var menuOrbit = 0;

  window.__errors = [];
  window.addEventListener('error', function (e) {
    window.__errors.push(String(e.message || e.error));
  });

  function initThree() {
    var canvas = document.getElementById('game-canvas');
    renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    scene = new THREE.Scene();
    scene.background = new THREE.Color(CV.PALETTE.sky);
    scene.fog = new THREE.Fog(CV.PALETTE.sky, 220, 900);
    camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 2000);
    camera.position.set(0, 30, 80);
    CV.World.camera = camera;

    var hemi = new THREE.HemisphereLight(0xffe9c8, 0x3a5a6a, 0.85);
    scene.add(hemi);
    var sun = new THREE.DirectionalLight(0xffd9a0, 1.1);
    sun.position.set(-120, 180, -80);
    scene.add(sun);

    window.addEventListener('resize', function () {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    });
  }

  function carCollisions(dt) {
    var cars = CV.Vehicles.cars;
    var playerCar = CV.G.driving;
    // Player car vs pedestrians: knockdown + heat.
    if (playerCar && Math.abs(playerCar.speed) > 4) {
      for (var i = 0; i < CV.Pedestrians.list.length; i++) {
        var p = CV.Pedestrians.list[i];
        if (p.state === 'down') continue;
        if (CV.dist2d(p.x, p.z, playerCar.x, playerCar.z) < 2.3) {
          CV.Pedestrians.knockDown(p, 5);
          CV.Police.addHeat(1, 'hit a pedestrian');
          CV.Audio.thud();
          playerCar.speed *= 0.7;
          CV.Missions.onDanger(p.x, p.z, 30);
        }
      }
    }
    // Car vs car: push apart, slow both.
    for (var a = 0; a < cars.length; a++) {
      for (var b = a + 1; b < cars.length; b++) {
        var c1 = cars[a], c2 = cars[b];
        var dx = c2.x - c1.x, dz = c2.z - c1.z;
        var d = Math.sqrt(dx * dx + dz * dz);
        if (d < 3.4 && d > 0.01) {
          var push = (3.4 - d) / 2;
          var nx = dx / d, nz = dz / d;
          c1.x -= nx * push; c1.z -= nz * push;
          c2.x += nx * push; c2.z += nz * push;
          if (c1 === playerCar || c2 === playerCar) {
            if (playerCar) playerCar.speed *= 0.6;
            if (Math.abs(CV.G.speed) > 8) CV.Audio.thud();
          }
          CV.Vehicles.syncMesh(c1);
          CV.Vehicles.syncMesh(c2);
        }
      }
    }
  }

  function loop() {
    requestAnimationFrame(loop);
    var dt = clock ? Math.min(clock.getDelta(), 0.05) : 0.016;
    if (CV.G.mode === 'paused') {
      renderer.render(scene, camera);
      return;
    }
    CV.G.time += dt;
    CV.World.animate(dt, CV.G.time);
    if (CV.G.mode === 'menu') {
      // Slow cinematic orbit over the city behind the start menu.
      menuOrbit += dt * 0.04;
      camera.position.set(Math.sin(menuOrbit) * 190, 85, Math.cos(menuOrbit) * 190);
      camera.lookAt(0, 10, 0);
      CV.Traffic.update(dt);
      CV.Pedestrians.update(dt, 9999, 9999, null);
    } else if (CV.G.mode === 'playing') {
      CV.Player.update(dt);
      CV.Traffic.update(dt);
      CV.Pedestrians.update(dt, CV.G.playerPos.x, CV.G.playerPos.z, CV.Missions.getDanger());
      CV.Police.update(dt);
      CV.Combat.update(dt);
      CV.Missions.update(dt);
      carCollisions(dt);
      CV.HUD.update();
    }
    renderer.render(scene, camera);
  }

  CV.Main = {
    init: function () {
      initThree();
      clock = new THREE.Clock();
      CV.World.init(scene);
      CV.Save.load();
      CV.Vehicles.spawnParked(16);
      CV.Traffic.init();
      CV.Pedestrians.init(24);
      CV.Police.init();
      CV.Player.init();
      CV.Combat.init();
      CV.Missions.init();
      CV.HUD.init();
      var params = new URLSearchParams(window.location.search);
      var shot = params.get('shot');
      if (shot) {
        CV.Shots.apply(shot);
        CV.Audio.unlock();
      } else {
        CV.HUD.showMenu();
      }
      window.__gameReady = true;
      window.__CV__ = CV;
      loop();
    },
    startGame: function (isContinue) {
      if (!isContinue) {
        CV.G.cash = 250; CV.G.missionIndex = 0; CV.G.pistol = false;
        CV.Save.clear();
        CV.G.cash = 250;
      }
      CV.resetRun();
      CV.Police.clearAll();
      CV.Missions.init();
      CV.HUD.showHud();
      CV.HUD.refreshMenu();
      CV.Audio.unlock();
      if (CV.HUD) CV.HUD.toast(isContinue ? 'Welcome back to Costa Verde.' : 'Welcome to Costa Verde.');
    },
    restart: function () {
      CV.G.cash = 250; CV.G.missionIndex = 0; CV.G.pistol = false;
      CV.Save.clear();
      CV.G.cash = 250;
      CV.resetRun();
      CV.Police.clearAll();
      CV.Missions.init();
      CV.HUD.showHud();
      CV.Audio.unlock();
    },
  };

  // Small test hook for headless playtests (start, drive, shoot, read state).
  window.__test = {
    state: function () {
      return {
        mode: CV.G.mode, cash: Math.round(CV.G.cash), health: Math.round(CV.G.health),
        wanted: Math.round(CV.G.wanted * 10) / 10, mission: CV.G.missionIndex,
        pistol: CV.G.pistol, driving: !!CV.G.driving,
        x: Math.round(CV.G.playerPos.x), z: Math.round(CV.G.playerPos.z),
        speed: Math.round(CV.G.speed * 10) / 10,
        heli: CV.G.heliActive, objective: CV.G.objective,
        errors: window.__errors.slice(),
      };
    },
    key: function (code, down) {
      var ev = new KeyboardEvent(down ? 'keydown' : 'keyup', { code: code, bubbles: true });
      window.dispatchEvent(ev);
    },
    start: function () { CV.Main.startGame(false); },
  };

  document.addEventListener('DOMContentLoaded', function () { CV.Main.init(); });
})();
