// EMBERLINE: Costa Verde — HUD, minimap, menus and banners (DOM overlay).
(function () {
  'use strict';
  var CV = window.CV;

  var el = {};
  var toastTimer = null, bannerTimer = null;

  function $(id) { return document.getElementById(id); }

  CV.HUD = {
    init: function () {
      ['health-fill', 'health-text', 'cash-text', 'stars', 'objective', 'objective-dist',
       'speed', 'minimap', 'toast', 'banner', 'banner-title', 'banner-sub',
       'menu', 'pause-menu', 'wasted-screen', 'busted-screen', 'hud',
       'btn-start', 'btn-continue', 'btn-new', 'btn-resume', 'btn-restart',
       'btn-hospital', 'btn-pd', 'menu-save-info', 'crosshair', 'bust-fill', 'bust-wrap',
       'job-hint'].forEach(function (id) { el[id] = $(id); });

      if (el['btn-start']) el['btn-start'].addEventListener('click', function () { CV.Main.startGame(false); });
      if (el['btn-continue']) el['btn-continue'].addEventListener('click', function () { CV.Main.startGame(true); });
      if (el['btn-new']) el['btn-new'].addEventListener('click', function () { CV.Save.clear(); CV.Main.startGame(false); });
      if (el['btn-resume']) el['btn-resume'].addEventListener('click', function () { CV.HUD.togglePause(); });
      if (el['btn-restart']) el['btn-restart'].addEventListener('click', function () { CV.Main.restart(); });
      if (el['btn-hospital']) el['btn-hospital'].addEventListener('click', function () { CV.Player.respawnHospital(); CV.HUD.hideOverlays(); });
      if (el['btn-pd']) el['btn-pd'].addEventListener('click', function () { CV.Player.respawnPoliceStation(); CV.HUD.hideOverlays(); });
      this.refreshMenu();
    },
    refreshMenu: function () {
      if (el['menu-save-info']) {
        var d = CV.Save.data;
        el['menu-save-info'].textContent = d
          ? ('Save found: $' + d.cash + ' · mission ' + (d.missionIndex + 1) + ' of 8' + (d.pistol ? ' · pistol unlocked' : ''))
          : 'No save yet — a fresh start in Costa Verde.';
      }
      if (el['btn-continue']) el['btn-continue'].style.display = CV.Save.data ? 'inline-block' : 'none';
    },
    setObjective: function (text) {
      if (el.objective) el.objective.textContent = text || '';
    },
    toast: function (msg) {
      if (!el.toast) return;
      el.toast.textContent = msg;
      el.toast.style.opacity = '1';
      if (toastTimer) clearTimeout(toastTimer);
      toastTimer = setTimeout(function () { el.toast.style.opacity = '0'; }, 3200);
    },
    showBanner: function (title, sub) {
      if (!el.banner) return;
      el['banner-title'].textContent = title;
      el['banner-sub'].textContent = sub || '';
      el.banner.style.opacity = '1';
      if (bannerTimer) clearTimeout(bannerTimer);
      bannerTimer = setTimeout(function () { el.banner.style.opacity = '0'; }, 2600);
    },
    showWasted: function (cause) {
      this.hideOverlays();
      if (el['wasted-screen']) el['wasted-screen'].style.display = 'flex';
    },
    showBusted: function (fine) {
      this.hideOverlays();
      var sub = document.getElementById('busted-sub');
      if (sub) sub.textContent = 'Fine paid: $' + fine + ' — the heat is off, for now.';
      if (el['busted-screen']) el['busted-screen'].style.display = 'flex';
    },
    hideOverlays: function () {
      ['menu', 'pause-menu', 'wasted-screen', 'busted-screen'].forEach(function (id) {
        var n = $(id);
        if (n) n.style.display = 'none';
      });
    },
    showMenu: function () {
      this.hideOverlays();
      if (el.menu) el.menu.style.display = 'flex';
      if (el.hud) el.hud.style.display = 'none';
    },
    showHud: function () {
      this.hideOverlays();
      if (el.hud) el.hud.style.display = 'block';
    },
    togglePause: function () {
      if (CV.G.mode === 'playing') {
        CV.G.mode = 'paused';
        if (el['pause-menu']) el['pause-menu'].style.display = 'flex';
      } else if (CV.G.mode === 'paused') {
        CV.G.mode = 'playing';
        if (el['pause-menu']) el['pause-menu'].style.display = 'none';
      }
    },
    update: function () {
      if (!el.hud) return;
      var hp = Math.round(CV.G.health);
      if (el['health-fill']) el['health-fill'].style.width = hp + '%';
      if (el['health-text']) el['health-text'].textContent = hp;
      if (el['cash-text']) el['cash-text'].textContent = '$' + Math.round(CV.G.cash);
      if (el.stars) {
        var w = Math.floor(CV.G.wanted);
        var s = '';
        for (var i = 0; i < 5; i++) s += i < w ? '★' : '☆';
        el.stars.textContent = s;
        el.stars.style.color = w >= 3 ? '#ff5a3c' : '#ffd24a';
      }
      if (el['bust-wrap']) {
        el['bust-wrap'].style.display = CV.G.bust > 0.02 ? 'block' : 'none';
        if (el['bust-fill']) el['bust-fill'].style.width = Math.round(CV.G.bust * 100) + '%';
      }
      if (el.speed) {
        el.speed.textContent = CV.G.driving ? Math.round(Math.abs(CV.G.speed) * 2.2) + ' MPH' : '';
      }
      if (el['objective-dist'] && CV.G.objectivePos) {
        var d = Math.round(CV.dist2d(CV.G.playerPos.x, CV.G.playerPos.z, CV.G.objectivePos.x, CV.G.objectivePos.z));
        el['objective-dist'].textContent = d + 'm';
      } else if (el['objective-dist']) {
        el['objective-dist'].textContent = '';
      }
      if (el.crosshair) {
        el.crosshair.style.display = (CV.G.pistol && !CV.G.driving && CV.G.mode === 'playing') ? 'block' : 'none';
      }
      if (el['job-hint']) {
        var near = false;
        for (var i = 0; i < CV.Missions.stands.length; i++) {
          var st = CV.Missions.stands[i];
          if (CV.dist2d(CV.G.playerPos.x, CV.G.playerPos.z, st.x, st.z) < 7) { near = true; break; }
        }
        el['job-hint'].style.display = near ? 'block' : 'none';
      }
      this.drawMinimap();
    },
    drawMinimap: function () {
      var c = el.minimap;
      if (!c) return;
      var g = c.getContext('2d');
      var W = c.width, H = c.height;
      var scale = W / 560;   // world -280..280
      function wx(x) { return (x + 280) * scale; }
      function wz(z) { return (z + 280) * scale; }
      g.clearRect(0, 0, W, H);
      g.fillStyle = '#1d3a4a';
      g.fillRect(0, 0, W, H);
      // Sand island.
      g.fillStyle = '#c9b078';
      g.fillRect(wx(-260), wz(-260), 520 * scale, 520 * scale);
      // City slab.
      g.fillStyle = '#8f959c';
      g.fillRect(wx(-180), wz(-180), 360 * scale, 360 * scale);
      // Roads.
      g.strokeStyle = '#3a3f46';
      g.lineWidth = 8 * scale;
      CV.GRID.forEach(function (v) {
        g.beginPath(); g.moveTo(wx(v), wz(-180)); g.lineTo(wx(v), wz(180)); g.stroke();
        g.beginPath(); g.moveTo(wx(-180), wz(v)); g.lineTo(wx(180), wz(v)); g.stroke();
      });
      // Buildings.
      g.fillStyle = '#5a5f66';
      CV.World.buildings2d.forEach(function (b) {
        g.fillRect(wx(b.x - b.w / 2), wz(b.z - b.d / 2), b.w * scale, b.d * scale);
      });
      // Job stands.
      g.fillStyle = '#ffd24a';
      CV.Missions.stands.forEach(function (s) {
        g.beginPath(); g.arc(wx(s.x), wz(s.z), 3.5, 0, Math.PI * 2); g.fill();
      });
      // Objective.
      if (CV.G.objectivePos) {
        g.fillStyle = '#ffd24a';
        g.beginPath(); g.arc(wx(CV.G.objectivePos.x), wz(CV.G.objectivePos.z), 5, 0, Math.PI * 2); g.fill();
        g.strokeStyle = '#ffffff';
        g.lineWidth = 1.5;
        g.beginPath(); g.arc(wx(CV.G.objectivePos.x), wz(CV.G.objectivePos.z), 8, 0, Math.PI * 2); g.stroke();
      }
      // Police cars (red), helicopter (orange).
      g.fillStyle = '#ff3b30';
      CV.Police.cars.forEach(function (car) {
        g.beginPath(); g.arc(wx(car.x), wz(car.z), 3, 0, Math.PI * 2); g.fill();
      });
      if (CV.G.heliActive && CV.Police.heli && CV.Police.heli.mesh.visible) {
        g.fillStyle = '#ff8c00';
        g.beginPath(); g.arc(wx(CV.Police.heli.x), wz(CV.Police.heli.z), 4, 0, Math.PI * 2); g.fill();
      }
      // Player arrow.
      var px = wx(CV.G.playerPos.x), pz = wz(CV.G.playerPos.z);
      g.save();
      g.translate(px, pz);
      g.rotate(-CV.G.playerHeading + Math.PI);
      g.fillStyle = '#ffffff';
      g.beginPath();
      g.moveTo(0, -6); g.lineTo(4.5, 5); g.lineTo(-4.5, 5); g.closePath();
      g.fill();
      g.restore();
    },
  };
})();
