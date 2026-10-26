// Mini-Game 1: Đua Vịt Vượt Thác (Duck River Race - Premium Edition)
class DuckRace {
  constructor(canvas, onLeaderboardUpdate, onFinishCallback) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.onLeaderboardUpdate = onLeaderboardUpdate;
    this.onFinishCallback = onFinishCallback;

    this.targetDurationSec = 90; // Default: Strictly 1 minute 30 seconds
    this.trackLength = 7600;
    this.cameraX = 0;
    this.ducks = [];
    this.isRunning = false;
    this.isPaused = false;
    this.finishedDucks = [];
    this.animId = null;
    this.simTimeMs = 0;
    this.elapsedSec = 0;
    this.finishTriggered = false;
    this.finishTimeout = null;

    // Visual enhancements
    this.waterWaves = [];
    this.decorations = [];
    this.sparkles = [];
    this.initVisualAssets();
  }

  setPace(pace) {
    if (pace === '180s' || pace === '3m') {
      this.targetDurationSec = 180;
      this.trackLength = 14800;
    } else if (pace === '90s' || pace === 'slow') {
      this.targetDurationSec = 90;
      this.trackLength = 7600;
    } else if (pace === '60s' || pace === 'medium') {
      this.targetDurationSec = 60;
      this.trackLength = 5200;
    } else {
      this.targetDurationSec = 45;
      this.trackLength = 3900;
    }
    this.initVisualAssets();
  }

  initVisualAssets() {
    this.waterWaves = [];
    for (let i = 0; i < 110; i++) {
      this.waterWaves.push({
        x: Math.random() * (this.trackLength + 800),
        y: 60 + Math.random() * (this.canvas.height - 120),
        length: 25 + Math.random() * 55,
        speed: 0.6 + Math.random() * 1.8,
        amplitude: 2 + Math.random() * 3,
        phase: Math.random() * Math.PI * 2,
        alpha: 0.15 + Math.random() * 0.3
      });
    }

    this.decorations = [];
    for (let i = 0; i < 45; i++) {
      this.decorations.push({
        type: Math.random() > 0.4 ? 'lily' : 'rock',
        x: 250 + Math.random() * (this.trackLength - 400),
        y: 90 + Math.random() * (this.canvas.height - 180),
        size: 16 + Math.random() * 14,
        rot: Math.random() * Math.PI * 2,
        color: Math.random() > 0.5 ? '#f472b6' : '#fb7185'
      });
    }
  }

  setup(playerNames) {
    this.stop();
    this.cameraX = 0;
    this.finishedDucks = [];
    this.isRunning = false;
    this.isPaused = false;
    this.finishTriggered = false;
    this.elapsedSec = 0;
    resetSimClock(this);
    // Canvas size may have changed since the last round: re-scatter waves & lilies over the new river
    this.initVisualAssets();

    const count = playerNames.length;
    const riverTop = 95;
    const riverBottom = this.canvas.height - 95;
    const riverHeight = Math.max(200, riverBottom - riverTop);

    // Scale dynamically based on player count so 100 ducks fit comfortably
    const duckScale = count <= 25 ? 1.0 : (count <= 50 ? 0.78 : 0.62);

    // Number of swim lanes across river height:
    const numLanes = count <= 15 ? count : Math.max(8, Math.min(18, Math.floor(riverHeight / (36 * duckScale))));
    const laneHeight = riverHeight / numLanes;

    const duckThemes = [
      { body: '#ffd000', shadow: '#eab308', acc: 'crown' },
      { body: '#ffb703', shadow: '#d97706', acc: 'glasses' },
      { body: '#00f0ff', shadow: '#0284c7', acc: 'cap' },
      { body: '#fb8500', shadow: '#c2410c', acc: 'bow' },
      { body: '#ec4899', shadow: '#db2777', acc: 'flower' },
      { body: '#a855f7', shadow: '#7e22ce', acc: 'snorkel' },
      { body: '#10b981', shadow: '#059669', acc: 'strawhat' },
      { body: '#f43f5e', shadow: '#e11d48', acc: 'crown' },
      { body: '#38bdf8', shadow: '#0284c7', acc: 'glasses' },
      { body: '#eab308', shadow: '#ca8a04', acc: 'cap' }
    ];

    const baseSpeed = this.trackLength / (this.targetDurationSec * 60);

    // Staggered rows: the back row starts at the left edge so every duck and name tag is on screen
    const rowGap = 42 * duckScale;
    const backRow = Math.floor(Math.max(0, count - 1) / numLanes);
    this.startLineX = 90 + backRow * rowGap;

    this.ducks = playerNames.map((name, index) => {
      const theme = duckThemes[index % duckThemes.length];
      const lane = index % numLanes;
      const row = Math.floor(index / numLanes);
      const startX = 60 + (backRow - row) * rowGap + (Math.random() - 0.5) * 14;
      const startY = riverTop + lane * laneHeight + laneHeight / 2 + (Math.random() - 0.5) * (6 * duckScale);

      return {
        id: index,
        name: name,
        x: startX,
        y: startY,
        baseY: startY,
        scale: duckScale,
        speed: baseSpeed * (0.95 + Math.random() * 0.1),
        targetSpeed: baseSpeed,
        basePaceSpeed: baseSpeed,
        theme: theme,
        bobble: Math.random() * Math.PI * 2,
        boostCooldown: 120 + Math.floor(Math.random() * 240),
        boostDuration: 0,
        finished: false,
        finishTime: 0,
        trail: []
      };
    });

    this.render();
  }

  start() {
    if (this.isRunning) return;
    this.isRunning = true;
    this.isPaused = false;
    resetSimClock(this);
    this.elapsedSec = 0;
    if (window.soundFX) window.soundFX.playWhistle();
    this.loop();
  }

  pause() {
    this.isPaused = !this.isPaused;
  }

  stop() {
    this.isRunning = false;
    this.isPaused = false;
    clearTimeout(this.finishTimeout);
    if (this.animId) {
      cancelAnimationFrame(this.animId);
      this.animId = null;
    }
  }

  update() {
    if (!this.isRunning || this.isPaused) return;

    this.elapsedSec = this.simTimeMs / 1000;
    const finishLine = this.trackLength;
    const progressRatio = Math.min(1, this.elapsedSec / this.targetDurationSec);

    // 1. Update Ducks
    for (let duck of this.ducks) {
      if (duck.finished) continue;

      duck.boostCooldown--;

      // Dynamic Rubber-banding & Random surges (Tạo kịch tính lật kèo liên tục)
      if (duck.boostCooldown <= 0) {
        duck.boostCooldown = 180 + Math.floor(Math.random() * 300);
        // Underdog assistance: trailing ducks have a high chance of turbo rush!
        const isTrailing = duck.x < finishLine * (progressRatio * 0.85);
        duck.boostDuration = 60 + Math.random() * 90;
        const boostMultiplier = isTrailing ? 1.45 : (1.15 + Math.random() * 0.25);
        duck.targetSpeed = duck.basePaceSpeed * boostMultiplier;

        if (Math.random() < 0.2 && window.soundFX) {
          window.soundFX.playQuack();
        }
      } else if (duck.boostDuration > 0) {
        duck.boostDuration--;
        if (duck.boostDuration <= 0) {
          duck.targetSpeed = duck.basePaceSpeed * (0.9 + Math.random() * 0.2);
        }
      }

      // Smooth acceleration
      duck.speed += (duck.targetSpeed - duck.speed) * 0.04;
      duck.x += duck.speed;

      // Bobble & trail
      duck.bobble += 0.08;
      duck.y = duck.baseY + Math.sin(duck.bobble) * 3.5;

      // Update wake trail
      if (Math.random() < 0.35) {
        duck.trail.push({
          x: duck.x - 16,
          y: duck.y + 4,
          r: 5,
          alpha: 0.6
        });
      }

      // Check finish line
      if (duck.x >= finishLine && !duck.finished) {
        duck.finished = true;
        duck.finishTime = this.simTimeMs;
        this.finishedDucks.push(duck);

        if (this.finishedDucks.length === 1 && window.soundFX) {
          window.soundFX.playSplash();
        }
      }
    }

    // Update trails
    for (let duck of this.ducks) {
      for (let i = duck.trail.length - 1; i >= 0; i--) {
        const tr = duck.trail[i];
        tr.r += 0.35;
        tr.alpha -= 0.02;
        if (tr.alpha <= 0) duck.trail.splice(i, 1);
      }
    }

    // Camera smoothly tracks the race pack leader
    const leaderX = Math.max(...this.ducks.map(d => d.x));
    const targetCamX = Math.max(0, Math.min(this.trackLength - this.canvas.width + 160, leaderX - this.canvas.width * 0.52));
    this.cameraX += (targetCamX - this.cameraX) * 0.08;

    // Update Leaderboard
    const sorted = [...this.ducks].sort((a, b) => b.x - a.x);
    if (this.onLeaderboardUpdate) {
      this.onLeaderboardUpdate(
        sorted.map(d => ({
          name: d.name,
          progress: Math.min(100, Math.round((d.x / finishLine) * 100))
        }))
      );
    }

    // Finish celebration trigger
    if (this.finishedDucks.length >= Math.min(3, this.ducks.length) && !this.finishTriggered) {
      this.finishTriggered = true;
      this.finishTimeout = setTimeout(() => {
        this.stop();
        if (this.onFinishCallback) {
          this.onFinishCallback(this.finishedDucks);
        }
      }, 1400);
    }
  }

  render() {
    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;

    ctx.clearRect(0, 0, w, h);

    ctx.save();
    ctx.translate(-this.cameraX, 0);

    // 1. Water Background with Deep Sun Reflection Gradient
    const waterGrad = ctx.createLinearGradient(0, 0, 0, h);
    waterGrad.addColorStop(0, '#0284c7');
    waterGrad.addColorStop(0.35, '#0ea5e9');
    waterGrad.addColorStop(0.7, '#0284c7');
    waterGrad.addColorStop(1, '#0369a1');
    ctx.fillStyle = waterGrad;
    ctx.fillRect(0, 0, this.trackLength + 500, h);

    // 2. Water Caustics & Flow Waves
    for (let wave of this.waterWaves) {
      wave.x += wave.speed;
      if (wave.x > this.trackLength + 500) wave.x = 0;
      wave.phase += 0.04;

      ctx.save();
      ctx.strokeStyle = `rgba(255, 255, 255, ${wave.alpha})`;
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.moveTo(wave.x, wave.y);
      ctx.quadraticCurveTo(
        wave.x + wave.length / 2,
        wave.y + Math.sin(wave.phase) * wave.amplitude,
        wave.x + wave.length,
        wave.y
      );
      ctx.stroke();
      ctx.restore();
    }

    // 3. River Banks (Lush Layered 3D Grass & Shore Pebbles)
    this.drawRiverBanks(ctx, h);

    // 4. Decorations (Blooming Water Lilies & Rocks)
    for (let d of this.decorations) {
      if (d.type === 'lily') {
        // Lily Pad
        ctx.fillStyle = '#15803d';
        ctx.beginPath();
        ctx.arc(d.x, d.y, d.size, 0, Math.PI * 1.85);
        ctx.fill();
        ctx.strokeStyle = '#166534';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // Blooming Flower
        ctx.fillStyle = d.color;
        for (let p = 0; p < 5; p++) {
          const pAngle = (p / 5) * Math.PI * 2;
          ctx.beginPath();
          ctx.ellipse(d.x + Math.cos(pAngle) * 5, d.y + Math.sin(pAngle) * 5, 5, 2.5, pAngle, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.fillStyle = '#fef08a';
        ctx.beginPath();
        ctx.arc(d.x, d.y, 3, 0, Math.PI * 2);
        ctx.fill();
      } else {
        // River Pebble
        ctx.fillStyle = '#475569';
        ctx.beginPath();
        ctx.ellipse(d.x, d.y, d.size, d.size * 0.65, d.rot, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#64748b';
        ctx.beginPath();
        ctx.ellipse(d.x - 2, d.y - 2, d.size * 0.5, d.size * 0.3, d.rot, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // 5. Start Line & Finish Line
    this.drawStartAndFinish(ctx, h);

    // 6. Draw Ducks (sorted by Y for correct 2.5D depth)
    const sortedDucks = [...this.ducks].sort((a, b) => a.y - b.y);
    for (let duck of sortedDucks) {
      this.drawDuckWake(ctx, duck);
    }
    for (let duck of sortedDucks) {
      this.drawDuck(ctx, duck);
    }

    ctx.restore();

    // 7. Distance Progress Bar on Top
    this.drawProgressBar(ctx, w);
  }

  drawRiverBanks(ctx, h) {
    const bankH = 55;
    const len = this.trackLength + 500;

    // Top Bank
    const topGrad = ctx.createLinearGradient(0, 0, 0, bankH);
    topGrad.addColorStop(0, '#166534');
    topGrad.addColorStop(0.7, '#15803d');
    topGrad.addColorStop(1, '#14532d');
    ctx.fillStyle = topGrad;
    ctx.fillRect(0, 0, len, bankH);

    // Top Bank Edge Shadow
    ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
    ctx.fillRect(0, bankH - 4, len, 6);

    // Bottom Bank
    const botGrad = ctx.createLinearGradient(0, h - bankH, 0, h);
    botGrad.addColorStop(0, '#14532d');
    botGrad.addColorStop(0.3, '#15803d');
    botGrad.addColorStop(1, '#166534');
    ctx.fillStyle = botGrad;
    ctx.fillRect(0, h - bankH, len, bankH);

    // Bottom Bank Edge Shadow
    ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
    ctx.fillRect(0, h - bankH, len, 6);
  }

  drawStartAndFinish(ctx, h) {
    // Start Line
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.lineWidth = 4;
    ctx.setLineDash([8, 8]);
    const startX = this.startLineX || 90;
    ctx.beginPath();
    ctx.moveTo(startX, 55);
    ctx.lineTo(startX, h - 55);
    ctx.stroke();
    ctx.setLineDash([]);

    // Finish Line: Checkered Pattern Banner
    const finishX = this.trackLength;
    const tileH = 22;
    const tiles = Math.floor((h - 110) / tileH);
    for (let i = 0; i < tiles; i++) {
      ctx.fillStyle = (i % 2 === 0) ? '#ffffff' : '#0f172a';
      ctx.fillRect(finishX, 55 + i * tileH, 18, tileH);
      ctx.fillStyle = (i % 2 === 1) ? '#ffffff' : '#0f172a';
      ctx.fillRect(finishX + 18, 55 + i * tileH, 18, tileH);
    }

    // Glowing Finish Banner
    ctx.save();
    ctx.fillStyle = '#ffb703';
    ctx.shadowColor = '#fb8500';
    ctx.shadowBlur = 16;
    ctx.font = '900 24px "Outfit", sans-serif';
    ctx.fillText('🏁 VẠCH ĐÍCH 🏁', finishX - 60, 42);
    ctx.restore();
  }

  drawDuckWake(ctx, duck) {
    for (let tr of duck.trail) {
      ctx.save();
      ctx.strokeStyle = `rgba(255, 255, 255, ${tr.alpha})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(tr.x, tr.y, tr.r * 1.6, tr.r * 0.7, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
  }

  drawDuck(ctx, duck) {
    ctx.save();
    ctx.translate(duck.x, duck.y);
    if (duck.scale && duck.scale !== 1.0) {
      ctx.scale(duck.scale, duck.scale);
    }

    const bobOffset = Math.sin(duck.bobble) * 2;
    ctx.translate(0, bobOffset);

    // Water shadow
    ctx.fillStyle = 'rgba(2, 44, 34, 0.3)';
    ctx.beginPath();
    ctx.ellipse(0, 12, 19, 5, 0, 0, Math.PI * 2);
    ctx.fill();

    // ── TAIL FEATHERS (behind body) ──
    ctx.save();
    ctx.fillStyle = duck.theme.shadow;
    // Upper tail feather
    ctx.beginPath();
    ctx.moveTo(-15, -2);
    ctx.quadraticCurveTo(-28, -18, -22, -22);
    ctx.quadraticCurveTo(-15, -18, -14, -4);
    ctx.fill();
    // Lower tail feather
    ctx.beginPath();
    ctx.moveTo(-15, 2);
    ctx.quadraticCurveTo(-28, 8, -22, 14);
    ctx.quadraticCurveTo(-15, 8, -13, 3);
    ctx.fill();
    ctx.restore();

    // ── BODY (fat oval duck body) ──
    const bodyGrad = ctx.createRadialGradient(-4, -4, 2, -2, 0, 19);
    bodyGrad.addColorStop(0, '#fffde7');
    bodyGrad.addColorStop(0.4, duck.theme.body);
    bodyGrad.addColorStop(1, duck.theme.shadow);
    ctx.fillStyle = bodyGrad;
    ctx.beginPath();
    // Wide oval body sitting on water
    ctx.ellipse(0, 2, 19, 12, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = duck.theme.shadow;
    ctx.lineWidth = 1.2;
    ctx.stroke();

    // ── WING DETAIL on body ──
    ctx.save();
    ctx.strokeStyle = 'rgba(0,0,0,0.2)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.ellipse(-2, 3, 12, 7, -0.15, Math.PI * 0.15, Math.PI * 0.85);
    ctx.stroke();
    ctx.restore();

    // ── NECK ──
    ctx.fillStyle = duck.theme.body;
    ctx.beginPath();
    ctx.moveTo(10, -2);
    ctx.quadraticCurveTo(14, -8, 13, -12);
    ctx.quadraticCurveTo(14, -8, 18, -3);
    ctx.closePath();
    ctx.fill();

    // ── HEAD (round) ──
    const headGrad = ctx.createRadialGradient(13, -17, 2, 14, -16, 10);
    headGrad.addColorStop(0, '#fffde7');
    headGrad.addColorStop(0.35, duck.theme.body);
    headGrad.addColorStop(1, duck.theme.shadow);
    ctx.fillStyle = headGrad;
    ctx.beginPath();
    ctx.arc(13, -16, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = duck.theme.shadow;
    ctx.lineWidth = 1;
    ctx.stroke();

    // ── EYE ──
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(17, -18, 3.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#1a1a2e';
    ctx.beginPath();
    ctx.arc(17.8, -18, 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(18.5, -18.7, 0.8, 0, Math.PI * 2);
    ctx.fill();

    // ── DUCK BILL (wide flat typical duck beak) ──
    // Upper mandible
    const billGrad = ctx.createLinearGradient(21, -17, 32, -13);
    billGrad.addColorStop(0, '#fb923c');
    billGrad.addColorStop(1, '#ea580c');
    ctx.fillStyle = billGrad;
    ctx.beginPath();
    ctx.moveTo(21, -18);
    ctx.lineTo(32, -15);
    ctx.lineTo(32, -12);
    ctx.lineTo(21, -14);
    ctx.closePath();
    ctx.fill();
    // Lower mandible (slightly lower and shorter)
    ctx.fillStyle = '#c2410c';
    ctx.beginPath();
    ctx.moveTo(21, -14);
    ctx.lineTo(30, -12);
    ctx.lineTo(30, -10);
    ctx.lineTo(21, -12);
    ctx.closePath();
    ctx.fill();
    // Bill nostril detail
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.beginPath();
    ctx.ellipse(26, -16, 2, 1, 0.3, 0, Math.PI * 2);
    ctx.fill();

    // ── ACCESSORY ──
    this.drawAccessory(ctx, duck.theme.acc);

    // ── NAME BADGE ──
    ctx.font = 'bold 11px "Outfit", sans-serif';
    const textW = ctx.measureText(duck.name).width;
    ctx.fillStyle = 'rgba(11, 15, 25, 0.9)';
    ctx.beginPath();
    ctx.roundRect(-textW / 2 - 6, -34, textW + 12, 16, 8);
    ctx.fill();
    ctx.strokeStyle = duck.theme.body;
    ctx.lineWidth = 1.2;
    ctx.stroke();
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'center';
    ctx.fillText(duck.name, 0, -22);

    ctx.restore();
  }

  drawAccessory(ctx, acc) {
    if (acc === 'crown') {
      ctx.fillStyle = '#fbbf24';
      ctx.shadowColor = '#f59e0b';
      ctx.shadowBlur = 5;
      ctx.beginPath();
      ctx.moveTo(6, -25);
      ctx.lineTo(8, -32);
      ctx.lineTo(12, -28);
      ctx.lineTo(16, -33);
      ctx.lineTo(19, -25);
      ctx.closePath();
      ctx.fill();
      ctx.shadowBlur = 0;
    } else if (acc === 'glasses') {
      ctx.strokeStyle = '#f97316';
      ctx.lineWidth = 1.5;
      ctx.fillStyle = 'rgba(56, 189, 248, 0.3)';
      ctx.beginPath();
      ctx.roundRect(13, -21, 8, 5, 2);
      ctx.fill();
      ctx.stroke();
    } else if (acc === 'cap') {
      ctx.fillStyle = '#ef4444';
      ctx.beginPath();
      ctx.arc(12, -25, 7, Math.PI, 0);
      ctx.fill();
      ctx.fillRect(5, -25, 15, 2.5);
      // Cap brim extending forward
      ctx.fillRect(16, -25, 7, 2);
    } else if (acc === 'bow') {
      ctx.fillStyle = '#f43f5e';
      ctx.beginPath();
      ctx.ellipse(10, -26, 5, 3, -0.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(16, -26, 5, 3, 0.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(13, -26, 2, 0, Math.PI * 2);
      ctx.fill();
    } else if (acc === 'flower') {
      for (let p = 0; p < 5; p++) {
        const a = (p / 5) * Math.PI * 2;
        ctx.fillStyle = '#f9a8d4';
        ctx.beginPath();
        ctx.arc(12 + Math.cos(a) * 4, -27 + Math.sin(a) * 4, 3, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = '#fef08a';
      ctx.beginPath();
      ctx.arc(12, -27, 2.5, 0, Math.PI * 2);
      ctx.fill();
    } else if (acc === 'snorkel') {
      ctx.strokeStyle = '#22d3ee';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(21, -20);
      ctx.quadraticCurveTo(26, -24, 24, -30);
      ctx.stroke();
      ctx.fillStyle = '#06b6d4';
      ctx.beginPath();
      ctx.arc(24, -31, 3, 0, Math.PI * 2);
      ctx.fill();
    } else if (acc === 'strawhat') {
      ctx.fillStyle = '#fef3c7';
      ctx.beginPath();
      ctx.ellipse(12, -24, 10, 3, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#fde68a';
      ctx.beginPath();
      ctx.moveTo(6, -24);
      ctx.lineTo(8, -33);
      ctx.lineTo(17, -33);
      ctx.lineTo(19, -24);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = '#d97706';
      ctx.lineWidth = 0.8;
      ctx.strokeRect(5, -33, 15, 9);
    }
  }

  drawProgressBar(ctx, w) {
    const barW = Math.min(460, w - 80);
    const barX = (w - barW) / 2;
    const barY = 16;
    const barH = 10;

    ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
    ctx.beginPath();
    ctx.roundRect(barX, barY, barW, barH, 5);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.stroke();

    const leaderX = Math.max(...this.ducks.map(d => d.x), 0);
    const ratio = Math.min(1, Math.max(0, leaderX / this.trackLength));

    const pGrad = ctx.createLinearGradient(barX, 0, barX + barW, 0);
    pGrad.addColorStop(0, '#ffb703');
    pGrad.addColorStop(1, '#fb8500');
    ctx.fillStyle = pGrad;
    ctx.beginPath();
    ctx.roundRect(barX, barY, barW * ratio, barH, 5);
    ctx.fill();

    ctx.font = '13px sans-serif';
    ctx.fillText('🦆', barX + barW * ratio - 8, barY + 9);
    ctx.fillText('🏁', barX + barW - 6, barY + 9);
  }

  loop() {
    if (!this.isRunning) return;
    runFixedSteps(this);
    this.render();
    this.animId = requestAnimationFrame(() => this.loop());
  }
}

window.DuckRace = DuckRace;
