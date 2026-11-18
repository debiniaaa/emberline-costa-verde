// EMBERLINE: Costa Verde — all-synthesized WebAudio sound.
// Engine hum, police siren, helicopter rotor, gunshots, thuds, chimes and a
// warm pad loop. No audio files. Everything is guarded: in headless runs
// (no AudioContext) every call is a safe no-op.
(function () {
  'use strict';
  var CV = window.CV;

  var ctx = null, master = null, engineOsc = null, engineGain = null;
  var sirenOsc = null, sirenGain = null, sirenTimer = 0;
  var rotorOsc = null, rotorGain = null, musicTimer = null, musicStep = 0;

  function ensure() {
    if (ctx) return true;
    try {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.35;
      master.connect(ctx.destination);
    } catch (e) { ctx = null; return false; }
    return true;
  }

  function noiseBuffer(dur) {
    var len = Math.floor(ctx.sampleRate * dur);
    var buf = ctx.createBuffer(1, len, ctx.sampleRate);
    var d = buf.getChannelData(0);
    for (var i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    return buf;
  }

  CV.Audio = {
    unlock: function () {
      if (!ensure()) return;
      try { if (ctx.state === 'suspended') ctx.resume(); } catch (e) { /* ignore */ }
      this.startEngine();
      this.startMusic();
    },
    startEngine: function () {
      if (!ctx || engineOsc) return;
      try {
        engineOsc = ctx.createOscillator();
        engineOsc.type = 'sawtooth';
        engineOsc.frequency.value = 55;
        engineGain = ctx.createGain();
        engineGain.gain.value = 0.0;
        engineOsc.connect(engineGain); engineGain.connect(master);
        engineOsc.start();
      } catch (e) { engineOsc = null; }
    },
    setEngine: function (speed, maxSpeed, driving) {
      if (!ctx || !engineOsc) return;
      var t = driving ? CV.clamp(speed / maxSpeed, 0, 1) : 0;
      try {
        engineOsc.frequency.setTargetAtTime(55 + t * 140, ctx.currentTime, 0.08);
        engineGain.gain.setTargetAtTime(driving ? 0.05 + t * 0.06 : 0.0, ctx.currentTime, 0.1);
      } catch (e) { /* ignore */ }
    },
    startSiren: function () {
      if (!ctx || sirenOsc) return;
      try {
        sirenOsc = ctx.createOscillator();
        sirenOsc.type = 'triangle';
        sirenOsc.frequency.value = 700;
        sirenGain = ctx.createGain();
        sirenGain.gain.value = 0.0;
        sirenOsc.connect(sirenGain); sirenGain.connect(master);
        sirenOsc.start();
      } catch (e) { sirenOsc = null; }
    },
    updateSiren: function (dt, on) {
      if (!ctx || !sirenOsc) return;
      sirenTimer += dt;
      var hi = Math.floor(sirenTimer / 0.45) % 2 === 0;
      try {
        sirenOsc.frequency.setTargetAtTime(hi ? 880 : 660, ctx.currentTime, 0.05);
        sirenGain.gain.setTargetAtTime(on ? 0.045 : 0.0, ctx.currentTime, 0.2);
      } catch (e) { /* ignore */ }
    },
    startRotor: function () {
      if (!ctx || rotorOsc) return;
      try {
        rotorOsc = ctx.createOscillator();
        rotorOsc.type = 'square';
        rotorOsc.frequency.value = 14;
        rotorGain = ctx.createGain();
        rotorGain.gain.value = 0.0;
        rotorOsc.connect(rotorGain); rotorGain.connect(master);
        rotorOsc.start();
      } catch (e) { rotorOsc = null; }
    },
    setRotor: function (on) {
      if (!ctx || !rotorOsc) return;
      try { rotorGain.gain.setTargetAtTime(on ? 0.05 : 0.0, ctx.currentTime, 0.3); } catch (e) { /* ignore */ }
    },
    shot: function () {
      if (!ensure()) return;
      try {
        var src = ctx.createBufferSource();
        src.buffer = noiseBuffer(0.12);
        var g = ctx.createGain();
        g.gain.setValueAtTime(0.5, ctx.currentTime);
        g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);
        var f = ctx.createBiquadFilter();
        f.type = 'lowpass'; f.frequency.value = 1800;
        src.connect(f); f.connect(g); g.connect(master);
        src.start();
      } catch (e) { /* ignore */ }
    },
    thud: function () {
      if (!ensure()) return;
      try {
        var o = ctx.createOscillator();
        o.type = 'sine';
        o.frequency.setValueAtTime(140, ctx.currentTime);
        o.frequency.exponentialRampToValueAtTime(50, ctx.currentTime + 0.12);
        var g = ctx.createGain();
        g.gain.setValueAtTime(0.4, ctx.currentTime);
        g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.14);
        o.connect(g); g.connect(master);
        o.start(); o.stop(ctx.currentTime + 0.15);
      } catch (e) { /* ignore */ }
    },
    chime: function (good) {
      if (!ensure()) return;
      try {
        var notes = good ? [523, 784] : [330, 262];
        for (var i = 0; i < notes.length; i++) {
          var o = ctx.createOscillator();
          o.type = 'sine';
          o.frequency.value = notes[i];
          var g = ctx.createGain();
          var t0 = ctx.currentTime + i * 0.12;
          g.gain.setValueAtTime(0.0001, t0);
          g.gain.exponentialRampToValueAtTime(0.25, t0 + 0.02);
          g.gain.exponentialRampToValueAtTime(0.001, t0 + 0.35);
          o.connect(g); g.connect(master);
          o.start(t0); o.stop(t0 + 0.4);
        }
      } catch (e) { /* ignore */ }
    },
    startMusic: function () {
      if (!ctx || musicTimer) return;
      // Warm pad loop: slow chord changes (Am — F — C — G) as soft triangles.
      var chords = [[220, 261, 329], [174, 220, 261], [196, 246, 329], [196, 246, 293]];
      musicTimer = setInterval(function () {
        if (!ctx) return;
        var chord = chords[musicStep % chords.length];
        musicStep++;
        for (var i = 0; i < chord.length; i++) {
          try {
            var o = ctx.createOscillator();
            o.type = 'triangle';
            o.frequency.value = chord[i];
            var g = ctx.createGain();
            var t0 = ctx.currentTime;
            g.gain.setValueAtTime(0.0001, t0);
            g.gain.linearRampToValueAtTime(0.03, t0 + 1.2);
            g.gain.linearRampToValueAtTime(0.0001, t0 + 3.8);
            o.connect(g); g.connect(master);
            o.start(t0); o.stop(t0 + 4);
          } catch (e) { /* ignore */ }
        }
      }, 4000);
    },
  };
})();
