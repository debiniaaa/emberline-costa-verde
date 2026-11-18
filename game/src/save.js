// EMBERLINE: Costa Verde — localStorage save / load (cash, story, pistol).
(function () {
  'use strict';
  var CV = window.CV;
  var KEY = 'emberline-costa-verde-save-v1';

  CV.Save = {
    data: null,
    load: function () {
      try {
        var raw = window.localStorage.getItem(KEY);
        this.data = raw ? JSON.parse(raw) : null;
      } catch (e) { this.data = null; }
      if (this.data) {
        CV.G.cash = typeof this.data.cash === 'number' ? this.data.cash : 250;
        CV.G.missionIndex = typeof this.data.missionIndex === 'number' ? this.data.missionIndex : 0;
        CV.G.pistol = !!this.data.pistol;
      }
      return this.data;
    },
    write: function () {
      try {
        window.localStorage.setItem(KEY, JSON.stringify({
          cash: Math.round(CV.G.cash),
          missionIndex: CV.G.missionIndex,
          pistol: CV.G.pistol,
        }));
      } catch (e) { /* storage unavailable (private mode, headless) */ }
    },
    clear: function () {
      try { window.localStorage.removeItem(KEY); } catch (e) { /* ignore */ }
      CV.G.cash = 250; CV.G.missionIndex = 0; CV.G.pistol = false;
    },
  };
})();
