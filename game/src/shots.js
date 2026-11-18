// EMBERLINE: Costa Verde — photo mode. ?shot=cover|street|drive|chase
// boots straight into a posed, deterministic scene so screenshots are
// reproducible real renders of the game.
(function () {
  'use strict';
  var CV = window.CV;

  function spawnPoliceAt(x, z, heading) {
    var car = CV.Vehicles.make(0x1a2a5a, x, z, heading, { police: true, kind: 'police' });
    car.driver = 'police';
    CV.Police.cars.push(car);
    return car;
  }

  CV.Shots = {
    apply: function (name) {
      CV.G.shot = name;
      CV.G.mode = 'playing';
      CV.HUD.showHud();
      var title = document.getElementById('title-overlay');
      if (title) title.style.display = name === 'cover' ? 'block' : 'none';
      if (name === 'cover') {
        // Hero view: high over the bay, city + sea + title.
        CV.Player.setCamera(0.5, 0.55, 60);
        CV.G.playerPos.x = 0; CV.G.playerPos.z = 120;
        CV.G.playerHeading = Math.PI;
        CV.G.objective = 'EMBERLINE: Costa Verde';
        CV.G.objectivePos = null;
        CV.World.setBeacon(0, 0, false);
      } else if (name === 'street') {
        // On foot downtown, mission beacon ahead.
        CV.Player.setCamera(-0.4, 0.35, 9);
        CV.G.playerPos.x = 0; CV.G.playerPos.z = 40;
        CV.G.playerHeading = Math.PI;
        CV.G.objective = 'First Errand — pick up the package at the plaza';
        CV.G.objectivePos = { x: 40, z: 20 };
        CV.World.setBeacon(40, 20, true);
      } else if (name === 'drive') {
        // Chase-cam drive down the central boulevard.
        var car = CV.Traffic.nearestStealable(0, 60, 500);
        if (car) {
          car.driver = 'player';
          CV.G.driving = car;
          car.x = 0; car.z = 60; car.heading = 0; car.speed = 28;
          CV.G.playerPos.x = 0; CV.G.playerPos.z = 60;
          CV.G.playerHeading = 0;
          CV.Player.setCamera(0, 0.32, 12);
        }
        CV.G.objective = 'Hot Delivery — cross town in 60 seconds';
        CV.G.objectivePos = { x: 120, z: 120 };
        CV.World.setBeacon(120, 120, true);
      } else if (name === 'chase') {
        // Police chase: player car, two cruisers, helicopter, 4 stars.
        var car2 = CV.Traffic.nearestStealable(0, 0, 500);
        if (car2) {
          car2.driver = 'player';
          CV.G.driving = car2;
          car2.x = 0; car2.z = 0; car2.heading = 0; car2.speed = 30;
          CV.G.playerPos.x = 0; CV.G.playerPos.z = 0;
          CV.G.playerHeading = 0;
          CV.Player.setCamera(0.35, 0.3, 13);
        }
        CV.G.wanted = 4;
        // One cruiser ahead-right (visible in frame) and one behind, closing in.
        spawnPoliceAt(8, 25, Math.PI);
        spawnPoliceAt(-7, -14, 0);
        var heli = CV.Police.heli;
        if (heli) {
          heli.state = 'tracking';
          heli.mesh.visible = true;
          // Ahead of the player car so the helicopter reads in the frame,
          // held there for the whole posed scene (see freezeHeli).
          heli.x = 14; heli.z = 90;
          heli.mesh.position.set(14, CV.TUNE.heliHeight, 90);
          CV.G.freezeHeli = true;
          CV.G.heliActive = true;
          CV.Audio.setRotor(true);
        }
        CV.G.objective = 'The Finale — lose the heat!';
        CV.G.objectivePos = { x: 200, z: -200 };
        CV.World.setBeacon(200, -200, true);
      }
      // Keep the HUD visible but hide the start menu; the loop runs normally.
      if (CV.G.shot) {
        var menu = document.getElementById('menu');
        if (menu) menu.style.display = 'none';
      }
    },
  };
})();
