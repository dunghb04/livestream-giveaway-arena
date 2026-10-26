// Mini-Game 3: Đảo Băng Sinh Tồn (Survival Floe Arena)
class SurvivalGame {
  constructor(canvas, onLeaderboardUpdate, onFinishCallback) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.onLeaderboardUpdate = onLeaderboardUpdate;
    this.onFinishCallback = onFinishCallback;

    this.tiles = [];
    this.players = [];
    this.eliminatedPlayers = [];
    this.isRunning = false;
    this.isPaused = false;
    this.animId = null;
    this.roundTimer = 0;
    this.pace = 'slow';
    this.shrinkInterval = 320; // ~5.3s between tile breaks for slow dramatic rounds
    this.warningFrames = 160;  // ~2.7s warning
  }

  setPace(pace) {
    this.pace = pace;
    if (pace === 'slow') {
      this.shrinkInterval = 320;
      this.warningFrames = 160;
    } else if (pace === 'medium') {
      this.shrinkInterval = 220;
      this.warningFrames = 120;
    } else {
      this.shrinkInterval = 140;
      this.warningFrames = 90;
    }
  }

  setup(playerNames) {
    this.stop();
    this.eliminatedPlayers = [];
    this.isRunning = false;
    this.isPaused = false;
    this.roundTimer = 0;
    this.finishTriggered = false;

    // Generate Grid of Ice Floe Tiles (9x7 for expansive arena)
    this.tiles = [];
    const cols = 9;
    const rows = 7;
    const tileSize = 66;
    const arenaW = cols * tileSize;
    const arenaH = rows * tileSize;
    const startX = (this.canvas.width - arenaW) / 2;
    const startY = (this.canvas.height - arenaH) / 2;

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        this.tiles.push({
          id: `${r}-${c}`,
          x: startX + c * tileSize + tileSize / 2,
          y: startY + r * tileSize + tileSize / 2,
          size: tileSize - 6,
          state: 'safe', // safe, warning, broken
          warningTimer: 0,
          fallProgress: 0
        });
      }
    }

    const playerColors = [
      '#f59e0b', '#10b981', '#3b82f6', '#ec4899', '#8b5cf6',
      '#06b6d4', '#f43f5e', '#84cc16', '#eab308', '#d946ef'
    ];

    // Place players randomly on safe tiles
    this.players = playerNames.map((name, idx) => {
      const randomTile = this.tiles[Math.floor(Math.random() * this.tiles.length)];
      return {
        id: idx,
        name: name,
        x: randomTile.x + (Math.random() - 0.5) * 20,
        y: randomTile.y + (Math.random() - 0.5) * 20,
        targetX: randomTile.x,
        targetY: randomTile.y,
        vx: 0,
        vy: 0,
        color: playerColors[idx % playerColors.length],
        alive: true,
        jumpPhase: Math.random() * Math.PI,
        fallProgress: 0
      };
    });

    this.render();
  }

  start() {
    if (this.isRunning) return;
    this.isRunning = true;
    this.isPaused = false;
    if (window.soundFX) window.soundFX.playWhistle();
    this.loop();
  }

  pause() {
    this.isPaused = !this.isPaused;
  }

  stop() {
    this.isRunning = false;
    this.isPaused = false;
    if (this.animId) {
      cancelAnimationFrame(this.animId);
      this.animId = null;
    }
  }

  update() {
    if (!this.isRunning || this.isPaused) return;

    this.roundTimer++;

    // 1. Pick random tiles to crack and fall
    if (this.roundTimer % this.shrinkInterval === 0) {
      const safeTiles = this.tiles.filter(t => t.state === 'safe');
      if (safeTiles.length > 3) {
        // Break 1 to 3 tiles
        const breakCount = Math.min(safeTiles.length - 3, Math.floor(1 + Math.random() * 2));
        for (let i = 0; i < breakCount; i++) {
          const t = safeTiles[Math.floor(Math.random() * safeTiles.length)];
          if (t) {
            t.state = 'warning';
            t.warningTimer = this.warningFrames || 160; // 2.5s warning
            if (window.soundFX) window.soundFX.playCrack();
          }
        }
      }
    }

    // 2. Update Tiles warning and crumbling
    for (let t of this.tiles) {
      if (t.state === 'warning') {
        t.warningTimer--;
        if (t.warningTimer <= 0) {
          t.state = 'broken';
          if (window.soundFX) window.soundFX.playSplash();
        }
      } else if (t.state === 'broken') {
        if (t.fallProgress < 1) t.fallProgress += 0.05;
      }
    }

    // 3. Update Players behavior and survival
    const alivePlayers = this.players.filter(p => p.alive);

    for (let p of this.players) {
      if (!p.alive) {
        if (p.fallProgress < 1) p.fallProgress += 0.06;
        continue;
      }

      p.jumpPhase += 0.15;

      // Random wander AI to nearby safe tiles
      if (Math.random() < 0.03 || this.isCurrentTileDangerous(p)) {
        const safeTiles = this.tiles.filter(t => t.state === 'safe');
        if (safeTiles.length > 0) {
          const nearest = safeTiles[Math.floor(Math.random() * safeTiles.length)];
          p.targetX = nearest.x + (Math.random() - 0.5) * 20;
          p.targetY = nearest.y + (Math.random() - 0.5) * 20;
        }
      }

      // Move smoothly to target
      p.x += (p.targetX - p.x) * 0.08;
      p.y += (p.targetY - p.y) * 0.08;

      // Check if player's tile collapsed
      const currentTile = this.getTileAt(p.x, p.y);
      if (!currentTile || currentTile.state === 'broken') {
        // Player falls into water!
        p.alive = false;
        this.eliminatedPlayers.push(p);

        if (window.soundFX) window.soundFX.playSplash();
      }
    }

    // Leaderboard update
    const activeLeft = this.players.filter(p => p.alive);
    if (this.onLeaderboardUpdate) {
      this.onLeaderboardUpdate(
        activeLeft.map(p => ({
          name: p.name,
          progress: 'Sống sót 🛡️'
        }))
      );
    }

    // Check game over (Only 1 or 0 player left)
    if (activeLeft.length <= 1 && !this.finishTriggered) {
      this.finishTriggered = true;
      setTimeout(() => {
        this.stop();

        // Calculate final rankings:
        // Top 1: the last survivor
        // Top 2: last eliminated
        // Top 3: second to last eliminated
        const podium = [];
        if (activeLeft.length === 1) {
          podium.push(activeLeft[0]);
        }
        for (let i = this.eliminatedPlayers.length - 1; i >= 0; i--) {
          if (podium.length < 3) {
            podium.push(this.eliminatedPlayers[i]);
          }
        }

        if (this.onFinishCallback) {
          this.onFinishCallback(podium);
        }
      }, 1000);
    }
  }

  isCurrentTileDangerous(p) {
    const tile = this.getTileAt(p.x, p.y);
    return tile && tile.state === 'warning';
  }

  getTileAt(x, y) {
    for (let t of this.tiles) {
      const half = t.size / 2;
      if (x >= t.x - half && x <= t.x + half && y >= t.y - half && y <= t.y + half) {
        return t;
      }
    }
    return null;
  }

  render() {
    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;

    ctx.clearRect(0, 0, w, h);

    // Deep Icy Ocean Background
    const oceanGrad = ctx.createRadialGradient(w / 2, h / 2, 50, w / 2, h / 2, Math.max(w, h));
    oceanGrad.addColorStop(0, '#0284c7');
    oceanGrad.addColorStop(0.6, '#034a75');
    oceanGrad.addColorStop(1, '#051b2c');
    ctx.fillStyle = oceanGrad;
    ctx.fillRect(0, 0, w, h);

    // Subtle water ripples
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
    ctx.lineWidth = 1.5;
    for (let i = 0; i < 15; i++) {
      const rx = (i * 97) % w;
      const ry = (i * 61) % h;
      ctx.beginPath();
      ctx.ellipse(rx, ry, 25, 8, 0, 0, Math.PI * 2);
      ctx.stroke();
    }

    // 1. Draw Ice Tiles
    for (let t of this.tiles) {
      if (t.fallProgress >= 1) continue; // Completely sunk

      ctx.save();
      ctx.translate(t.x, t.y);

      if (t.state === 'broken') {
        ctx.scale(1 - t.fallProgress, 1 - t.fallProgress);
        ctx.globalAlpha = 1 - t.fallProgress;
      }

      const half = t.size / 2;

      // Base Ice Tile
      if (t.state === 'warning') {
        // Flashing Warning Color
        const flash = Math.sin(t.warningTimer * 0.3) > 0;
        ctx.fillStyle = flash ? '#ef4444' : '#f97316';
        ctx.shadowColor = '#ef4444';
        ctx.shadowBlur = 15;
      } else {
        ctx.fillStyle = '#e0f2fe';
        ctx.shadowColor = '#38bdf8';
        ctx.shadowBlur = 6;
      }

      ctx.beginPath();
      ctx.roundRect(-half, -half, t.size, t.size, 8);
      ctx.fill();

      // Top Glaze
      ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
      ctx.beginPath();
      ctx.roundRect(-half + 4, -half + 4, t.size - 8, t.size * 0.3, 4);
      ctx.fill();

      // Warning text / Danger Cracks
      if (t.state === 'warning') {
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 16px Outfit, sans-serif';
        ctx.textAlign = 'center';
        ctx.shadowBlur = 0;
        ctx.fillText('⚠️', 0, 6);
      }

      ctx.restore();
    }

    // 2. Draw Players
    for (let p of this.players) {
      this.drawPlayer(ctx, p);
    }

    // 3. Alive counter on top
    this.drawAliveHeader(ctx, w);
  }

  drawPlayer(ctx, p) {
    if (p.fallProgress >= 1) return;

    ctx.save();
    ctx.translate(p.x, p.y);

    if (!p.alive) {
      ctx.scale(1 - p.fallProgress, 1 - p.fallProgress);
      ctx.globalAlpha = 1 - p.fallProgress;
    }

    const jumpY = p.alive ? Math.sin(p.jumpPhase) * 4 : 0;

    // Shadow
    ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
    ctx.beginPath();
    ctx.ellipse(0, 4, 12, 5, 0, 0, Math.PI * 2);
    ctx.fill();

    // Body Capsule (Cute bean character)
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.roundRect(-10, -22 + jumpY, 20, 24, 10);
    ctx.fill();
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Eyes
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(-3, -15 + jumpY, 3, 0, Math.PI * 2);
    ctx.arc(3, -15 + jumpY, 3, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#0f172a';
    ctx.beginPath();
    ctx.arc(-2, -15 + jumpY, 1.5, 0, Math.PI * 2);
    ctx.arc(4, -15 + jumpY, 1.5, 0, Math.PI * 2);
    ctx.fill();

    // Name badge
    ctx.font = 'bold 12px Outfit, sans-serif';
    const textW = ctx.measureText(p.name).width;

    ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
    ctx.beginPath();
    ctx.roundRect(-textW / 2 - 4, -40 + jumpY, textW + 8, 16, 4);
    ctx.fill();
    ctx.strokeStyle = p.color;
    ctx.lineWidth = 1.2;
    ctx.stroke();

    ctx.fillStyle = '#fff';
    ctx.textAlign = 'center';
    ctx.fillText(p.name, 0, -28 + jumpY);

    ctx.restore();
  }

  drawAliveHeader(ctx, w) {
    const aliveCount = this.players.filter(p => p.alive).length;
    ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
    ctx.beginPath();
    ctx.roundRect(w / 2 - 100, 16, 200, 36, 18);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.stroke();

    ctx.font = 'bold 15px Outfit, sans-serif';
    ctx.fillStyle = '#38bdf8';
    ctx.textAlign = 'center';
    ctx.fillText(`🛡️ Còn sống: ${aliveCount} / ${this.players.length}`, w / 2, 40);
  }

  loop() {
    if (!this.isRunning) return;
    this.update();
    this.render();
    this.animId = requestAnimationFrame(() => this.loop());
  }
}

window.SurvivalGame = SurvivalGame;
