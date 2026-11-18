// EMBERLINE: Costa Verde — hud.js
// One job: everything the player reads. Health, cash, wanted stars, timer,
// mission tracker, dialogue subtitles, toasts, banners, bust meter, and the
// live minimap drawn on a 2D canvas.

import { WORLD } from './config.js';

export class HUD {
  constructor(state) {
    this.state = state;
    this.el = {
      stars: document.getElementById('wanted-stars'),
      cash: document.getElementById('cash'),
      healthFill: document.getElementById('health-fill'),
      healthText: document.getElementById('health-text'),
      mission: document.getElementById('mission-tracker'),
      timer: document.getElementById('mission-timer'),
      speed: document.getElementById('speed'),
      ammo: document.getElementById('ammo'),
      weapon: document.getElementById('weapon'),
      toast: document.getElementById('toast'),
      banner: document.getElementById('banner'),
      bannerTitle: document.getElementById('banner-title'),
      bannerSub: document.getElementById('banner-sub'),
      dialogue: document.getElementById('dialogue'),
      dialogueSpeaker: document.getElementById('dialogue-speaker'),
      dialogueText: document.getElementById('dialogue-text'),
      vignette: document.getElementById('damage-vignette'),
      bust: document.getElementById('bust-meter'),
      bustFill: document.getElementById('bust-fill'),
      minimap: document.getElementById('minimap'),
      hint: document.getElementById('hint-bar'),
    };
    this.mapCtx = this.el.minimap.getContext('2d');
    this.toastTimer = null;
    this.bannerTimer = null;
    this.dialogueQueue = [];
    this.dialogueTimer = 0;
    this.message('Welcome to Costa Verde', 'info');
  }

  setStars(n) {
    let html = '';
    for (let i = 0; i < 5; i++) html += `<span class="star${i < n ? ' on' : ''}">★</span>`;
    this.el.stars.innerHTML = html;
    this.el.stars.classList.toggle('hot', n > 0);
  }

  setCash(n) { this.el.cash.textContent = `$${n.toLocaleString('en-US')}`; }

  setHealth(hp) {
    const pct = Math.max(0, Math.min(100, hp));
    this.el.healthFill.style.width = `${pct}%`;
    this.el.healthFill.classList.toggle('low', pct < 30);
    this.el.healthText.textContent = `${Math.ceil(pct)}`;
  }

  setAmmo(ammo, weapon) {
    this.el.ammo.textContent = weapon === 'pistol' ? `${ammo} / ∞` : '—';
    this.el.weapon.textContent = weapon === 'pistol' ? 'PISTOL [1]' : 'FISTS [2]';
  }

  setSpeed(kmh, inCar) {
    this.el.speed.textContent = inCar ? `${Math.round(kmh)} km/h` : '';
  }

  setTimer(seconds) {
    if (seconds > 0) {
      this.el.timer.style.display = 'block';
      const m = Math.floor(seconds / 60);
      const s = Math.floor(seconds % 60);
      this.el.timer.textContent = `⏱ ${m}:${s.toString().padStart(2, '0')}`;
      this.el.timer.classList.toggle('urgent', seconds < 20);
    } else {
      this.el.timer.style.display = 'none';
    }
  }

  setBust(v) {
    if (v > 0.02) {
      this.el.bust.style.display = 'block';
      this.el.bustFill.style.width = `${Math.min(100, v * 100)}%`;
    } else {
      this.el.bust.style.display = 'none';
    }
  }

  setMissionText(text) { this.el.mission.textContent = text; }

  setHint(text) { this.el.hint.textContent = text; }

  message(text, kind = 'info') {
    const t = this.el.toast;
    t.textContent = text;
    t.className = `show ${kind}`;
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => { t.className = ''; }, 3600);
  }

  showMessage(text, kind) { this.message(text, kind); }

  showBanner(title, sub) {
    this.el.bannerTitle.textContent = title;
    this.el.bannerSub.textContent = sub || '';
    this.el.banner.classList.add('show');
    clearTimeout(this.bannerTimer);
    this.bannerTimer = setTimeout(() => this.el.banner.classList.remove('show'), 3400);
  }

  showDialogue(lines) {
    this.dialogueQueue = [...lines];
    this.dialogueTimer = 0;
    this.advanceDialogue();
  }

  advanceDialogue() {
    const next = this.dialogueQueue.shift();
    if (!next) {
      this.el.dialogue.classList.remove('show');
      return;
    }
    this.el.dialogueSpeaker.textContent = next[0];
    this.el.dialogueText.textContent = next[1];
    this.el.dialogue.classList.add('show');
    this.dialogueTimer = 4.2;
  }

  flashDamage() {
    this.el.vignette.classList.add('hit');
    setTimeout(() => this.el.vignette.classList.remove('hit'), 180);
  }

  update(dt) {
    if (this.dialogueTimer > 0) {
      this.dialogueTimer -= dt;
      if (this.dialogueTimer <= 0) this.advanceDialogue();
    }
    this.drawMinimap();
  }

  drawMinimap() {
    const ctx = this.mapCtx;
    const S = 180;
    const scale = S / (WORLD.size + 60);
    const toMap = (x, z) => [S / 2 + x * scale, S / 2 + z * scale];
    ctx.clearRect(0, 0, S, S);
    ctx.fillStyle = '#20262e';
    ctx.fillRect(0, 0, S, S);
    // Beach + ocean.
    ctx.fillStyle = '#e8c98f';
    ctx.fillRect(0, S / 2 + 300 * scale, S, 40 * scale);
    ctx.fillStyle = '#1d6f8e';
    ctx.fillRect(0, S / 2 + 340 * scale, S, S);
    // Roads.
    ctx.strokeStyle = '#565660';
    ctx.lineWidth = 3;
    const roads = [-320, -240, -160, -80, 0, 80, 160, 240, 320];
    for (const r of roads) {
      const [x] = toMap(r, 0);
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, S); ctx.stroke();
    }
    for (const r of [-320, -240, -160, -80, 0, 80, 160, 240]) {
      const [, y] = toMap(0, r);
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(S, y); ctx.stroke();
    }
    // Plaza.
    ctx.fillStyle = '#7fa8c7';
    const [px, py] = toMap(0, 0);
    ctx.beginPath(); ctx.arc(px, py, 4, 0, Math.PI * 2); ctx.fill();
    // Mission beacon.
    const st = this.state;
    if (st.missions && st.missions.beacon && st.missions.beacon.visible) {
      const [bx, by] = toMap(st.missions.beacon.position.x, st.missions.beacon.position.z);
      ctx.fillStyle = '#ffd23a';
      ctx.beginPath(); ctx.arc(bx, by, 5, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#ffd23a';
      ctx.beginPath(); ctx.arc(bx, by, 8 + Math.sin(performance.now() / 300) * 2, 0, Math.PI * 2); ctx.stroke();
    }
    // Traffic dots.
    if (st.traffic) {
      ctx.fillStyle = '#cfd6dd';
      for (const c of st.traffic.cars) {
        if (c.isPlayer) continue;
        const [cx, cy] = toMap(c.x, c.z);
        ctx.fillRect(cx - 1, cy - 1, 2, 2);
      }
    }
    // Police blips.
    if (st.police) {
      ctx.fillStyle = '#ff4040';
      for (const c of st.police.cruisers) {
        const [cx, cy] = toMap(c.x, c.z);
        ctx.beginPath(); ctx.arc(cx, cy, 3, 0, Math.PI * 2); ctx.fill();
      }
    }
    // Player arrow.
    const [ux, uy] = toMap(st.player.pos.x, st.player.pos.z);
    ctx.save();
    ctx.translate(ux, uy);
    ctx.rotate(st.player.heading);
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#111111';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, -7); ctx.lineTo(5, 6); ctx.lineTo(-5, 6); ctx.closePath();
    ctx.fill(); ctx.stroke();
    ctx.restore();
    // North label.
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 11px sans-serif';
    ctx.fillText('N', S - 14, 14);
  }
}
