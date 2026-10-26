// Mini-Game 4: Đấu Trường Tiến Hóa (EvoWars.io Exact Clone - 3 Minutes Match & Smart Roaming AI)
class AxeBattle {
  constructor(canvas, onLeaderboardUpdate, onFinishCallback) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.onLeaderboardUpdate = onLeaderboardUpdate;
    this.onFinishCallback = onFinishCallback;

    this.warriors = [];
    this.xpOrbs = [];
    this.slashEffects = [];
    this.particles = [];
    this.clashSparks = [];
    this.eliminatedWarriors = [];
    this.isRunning = false;
    this.isPaused = false;
    this.animId = null;

    this.targetDurationSec = 180; // 3 Minutes (180s)
    this.initialRect = { x: 16, y: 16, width: 1200, height: 680, cornerRadius: 14 };
    this.currentRect = { x: 16, y: 16, width: 1200, height: 680, cornerRadius: 14 };
    this.minRectWidth = 160;
    this.minRectHeight = 100;

    this.zoneState = 'safe'; // 'safe' | 'shrinking'
    this.zoneHUDText = '🛡️ VÙNG AN TOÀN';
    this.matchTimer = 0;
    this.finishTriggered = false;

    // High-performance spatial grid for 100 players silky-smooth 60 FPS
    this.gridCellSize = 110;
    this.gridCols = 12;
    this.gridRows = 7;
    this.warriorGrid = [];
    this.orbGrid = [];
    this.hexGridCanvas = null;

    // 5 Authentic EvoWars.io Character Tiers Matching Exact Game Sprites
    // Well-balanced XP thresholds for gradual 3-minute progression
    this.evolutionTiers = [
      {
        level: 1,
        title: 'Người Tiền Sử (Caveman)',
        bodyRadius: 18,
        weaponLength: 38,
        weaponWidth: 14,
        bladeColor: '#854d0e',
        glowColor: '#eab308',
        xpNeeded: 45 // 10-20s: First proactive players evolve to Hunters quickly!
      },
      {
        level: 2,
        title: 'Quái Vật Gai (Green Monster)',
        bodyRadius: 23,
        weaponLength: 52,
        weaponWidth: 18,
        bladeColor: '#22c55e',
        glowColor: '#10b981',
        xpNeeded: 130 // 20-70s
      },
      {
        level: 3,
        title: 'Hiệp Sĩ Thánh Chiến (Knight)',
        bodyRadius: 29,
        weaponLength: 68,
        weaponWidth: 22,
        bladeColor: '#cbd5e1',
        glowColor: '#38bdf8',
        xpNeeded: 270 // 70-120s
      },
      {
        level: 4,
        title: 'Ma Vương Cuồng Nộ (Demon Berserker)',
        bodyRadius: 36,
        weaponLength: 86,
        weaponWidth: 28,
        bladeColor: '#dc2626',
        glowColor: '#ef4444',
        xpNeeded: 550 // 120-160s
      },
      {
        level: 5,
        title: 'Chiến Thần Đôi Cánh (Winged Titan)',
        bodyRadius: 45,
        weaponLength: 108,
        weaponWidth: 34,
        bladeColor: '#67e8f9',
        glowColor: '#ffd700',
        xpNeeded: 9999
      }
    ];
  }

  setPace(pace) {
    if (pace === '180s' || pace === '3m' || pace === 'slow') {
      this.targetDurationSec = 180;
    } else if (pace === '90s') {
      this.targetDurationSec = 90;
    } else if (pace === '60s') {
      this.targetDurationSec = 60;
    } else {
      this.targetDurationSec = 45;
    }
  }

  setup(playerNames) {
    this.stop();
    this.warriors = [];
    this.xpOrbs = [];
    this.slashEffects = [];
    this.particles = [];
    this.clashSparks = [];
    this.eliminatedWarriors = [];
    this.isRunning = false;
    this.isPaused = false;
    this.matchTimer = 0;
    this.finishTriggered = false;

    // Full Rectangular Map covering the entire canvas (khu vực màu cam full)
    const margin = 16;
    const canW = this.canvas.width || 1280;
    const canH = this.canvas.height || 720;
    this.initialRect = {
      x: margin,
      y: margin,
      width: Math.max(480, canW - margin * 2),
      height: Math.max(340, canH - margin * 2),
      cornerRadius: 14
    };
    this.currentRect = { ...this.initialRect };
    this.minRectWidth = Math.max(160, this.initialRect.width * 0.16);
    this.minRectHeight = Math.max(100, this.initialRect.height * 0.16);

    this.zoneState = 'safe';
    this.zoneHUDText = '🛡️ VÙNG AN TOÀN';

    const r = this.currentRect;
    const count = playerNames.length;

    // =========================================================================
    // DISPERSED GRID SPAWNING: Spreads 20, 50, or 100 warriors evenly across
    // the vast rectangular arena so NOBODY is crowded or grouped together at start!
    // =========================================================================
    const innerPadX = 55;
    const innerPadY = 50;
    const usableW = Math.max(200, r.width - innerPadX * 2);
    const usableH = Math.max(200, r.height - innerPadY * 2);

    const aspect = usableW / usableH;
    let cols = Math.max(3, Math.ceil(Math.sqrt(count * aspect)));
    let rows = Math.max(2, Math.ceil(count / cols));
    while (cols * rows < count) {
      if (cols / rows < aspect) cols++;
      else rows++;
    }

    const cellW = usableW / cols;
    const cellH = usableH / rows;

    const spawnSlots = [];
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        spawnSlots.push({
          x: r.x + innerPadX + (col + 0.5) * cellW + (Math.random() - 0.5) * (cellW * 0.20),
          y: r.y + innerPadY + (row + 0.5) * cellH + (Math.random() - 0.5) * (cellH * 0.20)
        });
      }
    }

    // Physical spacing relaxation: guarantees strict minimum distance between ANY two warriors!
    const minSpawnDist = count <= 25 ? 175 : (count <= 50 ? 115 : 78);
    for (let iter = 0; iter < 18; iter++) {
      for (let i = 0; i < spawnSlots.length; i++) {
        for (let j = i + 1; j < spawnSlots.length; j++) {
          const dx = spawnSlots[j].x - spawnSlots[i].x;
          const dy = spawnSlots[j].y - spawnSlots[i].y;
          const dist = Math.hypot(dx, dy);
          if (dist < minSpawnDist && dist > 0) {
            const push = (minSpawnDist - dist) * 0.5;
            const nx = dx / dist;
            const ny = dy / dist;
            spawnSlots[i].x -= nx * push;
            spawnSlots[i].y -= ny * push;
            spawnSlots[j].x += nx * push;
            spawnSlots[j].y += ny * push;
          }
        }
        spawnSlots[i].x = Math.max(r.x + innerPadX, Math.min(r.x + r.width - innerPadX, spawnSlots[i].x));
        spawnSlots[i].y = Math.max(r.y + innerPadY, Math.min(r.y + r.height - innerPadY, spawnSlots[i].y));
      }
    }

    // Cryptographic Fisher-Yates shuffle for slot assignment
    for (let i = spawnSlots.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [spawnSlots[i], spawnSlots[j]] = [spawnSlots[j], spawnSlots[i]];
    }

    const warriorScale = count <= 25 ? 1.0 : (count <= 50 ? 0.86 : 0.74);

    this.warriors = playerNames.map((name, idx) => {
      const pos = spawnSlots[idx] || {
        x: r.x + innerPadX + Math.random() * usableW,
        y: r.y + innerPadY + Math.random() * usableH
      };

      const facing = Math.random() * Math.PI * 2;

      // Distant initial patrol waypoint in another part of the wide arena
      const wpX = r.x + innerPadX + Math.random() * usableW;
      const wpY = r.y + innerPadY + Math.random() * usableH;

      return {
        id: idx,
        name: name,
        x: pos.x,
        y: pos.y,
        vx: 0,
        vy: 0,
        scale: warriorScale,
        facingAngle: facing,
        targetAngle: facing,
        idleBob: Math.random() * Math.PI * 2,
        level: 1,
        xp: 0,
        kills: 0,
        alive: true,
        invulnTimer: 300, // 5s energy grace shield: players disperse and forage gems smoothly
        patrolX: wpX,
        patrolY: wpY,
        wanderTimer: 25 + Math.floor(Math.random() * 35),
        isSwinging: false,
        swingProgress: 0,
        hasHitOpponent: false,
        swingCooldown: 60 + Math.floor(Math.random() * 40),
        attackIntentTimer: 30 + Math.floor(Math.random() * 40),
        swingDirection: 1,
        outOfZoneFrames: 0,
        isHunter: false
      };
    });

    // ALL PLAYERS START EQUALLY AT LEVEL 1! (No pre-match level buffs, 100% fair play)
    // Only players who eat gems or score kills will advance to Level 2 and become Hunters!

    // Pre-render honeycomb arena background to offscreen canvas for 60 FPS performance
    this.buildHexGridCache();

    // Spawn 220 scattered sparkling gems (optimal visual density and zero lag)
    const orbCount = 220;
    for (let i = 0; i < orbCount; i++) {
      this.spawnXPOrb();
    }

    this.render();
  }

  spawnXPOrb(nearX, nearY, isLarge = false) {
    const r = this.currentRect || this.initialRect || { x: 16, y: 16, width: 1200, height: 680 };
    let ox, oy;

    if (nearX !== undefined && nearY !== undefined) {
      ox = nearX + (Math.random() - 0.5) * 60;
      oy = nearY + (Math.random() - 0.5) * 60;
    } else {
      const pad = 35;
      ox = r.x + pad + Math.random() * Math.max(20, r.width - pad * 2);
      oy = r.y + pad + Math.random() * Math.max(20, r.height - pad * 2);
    }

    // Clamp inside current rect
    ox = Math.max(r.x + 15, Math.min(r.x + r.width - 15, ox));
    oy = Math.max(r.y + 15, Math.min(r.y + r.height - 15, oy));

    const gemPalettes = [
      { base: '#10b981', dark: '#047857', light: '#6ee7b7' }, // Emerald
      { base: '#ef4444', dark: '#b91c1c', light: '#fca5a5' }, // Ruby
      { base: '#3b82f6', dark: '#1d4ed8', light: '#93c5fd' }, // Sapphire
      { base: '#f59e0b', dark: '#b45309', light: '#fde68a' }, // Topaz
      { base: '#a855f7', dark: '#7e22ce', light: '#d8b4fe' }, // Amethyst
      { base: '#06b6d4', dark: '#0e7490', light: '#a5f3fc' }  // Cyan Diamond
    ];

    const chosenPal = gemPalettes[Math.floor(Math.random() * gemPalettes.length)];
    const types = ['diamond', 'hex', 'crystal'];
    const chosenType = isLarge ? 'hex' : types[Math.floor(Math.random() * types.length)];

    this.xpOrbs.push({
      x: ox,
      y: oy,
      size: isLarge ? 8.5 : (4.2 + Math.random() * 2.0),
      gemType: chosenType,
      color: chosenPal.base,
      darkColor: chosenPal.dark,
      lightColor: chosenPal.light,
      rot: Math.random() * Math.PI * 2,
      rotSpeed: (Math.random() - 0.5) * 0.03,
      pulse: Math.random() * Math.PI * 2,
      value: isLarge ? 4 : 1
    });
  }

  // Pre-render honeycomb arena pattern once to offscreen canvas for 60 FPS
  buildHexGridCache() {
    const w = this.canvas.width || 1280;
    const h = this.canvas.height || 720;
    if (!this.hexGridCanvas || this.hexGridCanvas.width !== w || this.hexGridCanvas.height !== h) {
      this.hexGridCanvas = document.createElement('canvas');
      this.hexGridCanvas.width = w;
      this.hexGridCanvas.height = h;
    }
    const hctx = this.hexGridCanvas.getContext('2d');
    hctx.clearRect(0, 0, w, h);
    hctx.strokeStyle = '#181d27';
    hctx.lineWidth = 1.6;

    const hexRadius = 26;
    const hexWidth = hexRadius * Math.sqrt(3);
    const hexHeight = hexRadius * 1.5;

    hctx.beginPath();
    let row = 0;
    for (let y = -hexHeight; y < h + hexHeight; y += hexHeight) {
      const offsetX = (row % 2 === 0) ? 0 : hexWidth / 2;
      for (let x = -hexWidth + offsetX; x < w + hexWidth; x += hexWidth) {
        for (let i = 0; i < 6; i++) {
          const angle = (Math.PI / 180) * (60 * i - 30);
          const hx = x + hexRadius * Math.cos(angle);
          const hy = y + hexRadius * Math.sin(angle);
          if (i === 0) hctx.moveTo(hx, hy);
          else hctx.lineTo(hx, hy);
        }
        hctx.closePath();
      }
      row++;
    }
    hctx.stroke();
  }

  // Critical sparks effect when a giant is backstabbed from behind
  createBackstabSparks(x, y) {
    if (window.soundFX) window.soundFX.playBounce(950);
    for (let i = 0; i < 18; i++) {
      const ang = Math.random() * Math.PI * 2;
      const spd = 3.2 + Math.random() * 4.5;
      this.clashSparks.push({
        x: x,
        y: y,
        vx: Math.cos(ang) * spd,
        vy: Math.sin(ang) * spd,
        color: i % 2 === 0 ? '#facc15' : '#ef4444',
        size: 3.8 + Math.random() * 2.5,
        life: 1.0
      });
    }
  }

  start() {
    if (this.isRunning) return;
    this.isRunning = true;
    this.isPaused = false;
    this.startTimestamp = performance.now();
    this.matchTimer = 0;
    this.finishTriggered = false;
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

  getTier(level) {
    return this.evolutionTiers[Math.min(this.evolutionTiers.length - 1, level - 1)];
  }

  update() {
    if (!this.isRunning || this.isPaused) return;

    this.matchTimer++;
    const now = performance.now();
    const currentSec = (now - this.startTimestamp) / 1000;
    const totalSec = this.targetDurationSec || 180;
    const phaseDur = totalSec / 6; // 30s per phase for 180s total

    const centerX = this.canvas.width / 2;
    const centerY = this.canvas.height / 2;

    // =========================================================================
    // 30-SECOND ZONE CYCLE: 30s Safe -> 30s Shrink -> 30s Safe -> 30s Shrink...
    // Dynamic Fast Shrink down to a tight scale of 0.16 for dramatic final arena!
    // =========================================================================
    let targetScale = 1.0;
    let zoneState = 'safe';
    let hudText = '';

    if (currentSec < phaseDur) {
      // Phase 0: 0s - 30s -> Full Rectangular Arena (Safe)
      targetScale = 1.0;
      zoneState = 'safe';
      const rem = Math.max(0, Math.ceil(phaseDur - currentSec));
      hudText = `🛡️ VÙNG AN TOÀN (Bo thu sau: ${rem}s)`;
    } else if (currentSec < phaseDur * 2) {
      // Phase 1: 30s - 60s -> Zone Shrink 1 (1.0 -> 0.65)
      const p = (currentSec - phaseDur) / phaseDur;
      targetScale = 1.0 - p * 0.35;
      zoneState = 'shrinking';
      const rem = Math.max(0, Math.ceil(phaseDur * 2 - currentSec));
      hudText = `⚠️ ĐANG THU BO ĐỢT 1 (${rem}s)`;
    } else if (currentSec < phaseDur * 3) {
      // Phase 2: 60s - 90s -> Safe Rest (0.65)
      targetScale = 0.65;
      zoneState = 'safe';
      const rem = Math.max(0, Math.ceil(phaseDur * 3 - currentSec));
      hudText = `🛡️ VÙNG AN TOÀN (Bo thu sau: ${rem}s)`;
    } else if (currentSec < phaseDur * 4) {
      // Phase 3: 90s - 120s -> Zone Shrink 2 (0.65 -> 0.38)
      const p = (currentSec - phaseDur * 3) / phaseDur;
      targetScale = 0.65 - p * 0.27;
      zoneState = 'shrinking';
      const rem = Math.max(0, Math.ceil(phaseDur * 4 - currentSec));
      hudText = `⚠️ ĐANG THU BO ĐỢT 2 (${rem}s)`;
    } else if (currentSec < phaseDur * 5) {
      // Phase 4: 120s - 145s -> Safe Rest (0.38)
      targetScale = 0.38;
      zoneState = 'safe';
      const rem = Math.max(0, Math.ceil(phaseDur * 5 - currentSec));
      hudText = `🛡️ VÙNG AN TOÀN (Bo thu sau: ${rem}s)`;
    } else {
      // Phase 5: 145s - 180s -> Final Showdown Shrink (0.38 -> 0.16)
      const p = Math.min(1.0, (currentSec - phaseDur * 5) / (totalSec - phaseDur * 5));
      targetScale = 0.38 - p * 0.22;
      zoneState = 'shrinking';
      const rem = Math.max(0, Math.ceil(totalSec - currentSec));
      hudText = `🔥 BO TỬ THẦN - QUYẾT ĐẤU (${rem}s)`;
    }

    this.zoneState = zoneState;
    this.zoneHUDText = hudText;

    // =========================================================================
    // MORPHING SAFE ZONE: Starts as full rectangle, smoothly morphs into circle!
    // As targetScale drops, aspect ratio converges to 1:1 and cornerRadius increases
    // until cornerRadius = diameter / 2, which is mathematically a TRUE CIRCLE!
    // =========================================================================
    const morphProgress = Math.min(1.0, Math.max(0, (1.0 - targetScale) / (1.0 - 0.16)));
    const initW = this.initialRect.width;
    const initH = this.initialRect.height;

    const scaledW = initW * targetScale;
    const scaledH = initH * targetScale;
    const finalCircleDiameter = Math.max(this.minRectHeight, initH * 0.20);
    const curW = Math.max(finalCircleDiameter, scaledW * (1 - morphProgress * 0.55) + finalCircleDiameter * (morphProgress * 0.55));
    const curH = Math.max(finalCircleDiameter, scaledH);

    let finalW = curW;
    let finalH = curH;
    if (morphProgress > 0.82) {
      const circleD = Math.min(curW, curH);
      finalW = circleD;
      finalH = circleD;
    }

    const maxCR = Math.min(finalW, finalH) / 2;
    const curCR = Math.min(maxCR, 14 + (maxCR - 14) * Math.pow(morphProgress, 1.25));

    this.currentRect.x = centerX - finalW / 2;
    this.currentRect.y = centerY - finalH / 2;
    this.currentRect.width = finalW;
    this.currentRect.height = finalH;
    this.currentRect.cornerRadius = curCR;

    // Replenish XP gems (capped at 180 for optimal performance and sparkling density)
    if (this.xpOrbs.length < 180) {
      this.spawnXPOrb();
    }

    const aliveWarriors = this.warriors.filter(w => w.alive);

    // =========================================================================
    // 3-MINUTE SURVIVAL PACING GOVERNOR
    // Ensures gradual, suspenseful elimination curve across full 180 seconds:
    // ~86% at 30s, ~70% at 60s (1m), ~52% at 90s, ~35% at 120s (2m), ~18% at 150s, Top 2-3 at 180s!
    // =========================================================================
    const matchProgress = Math.min(1.0, currentSec / totalSec);
    const targetAliveRatio = Math.max(0.04, Math.pow(1 - matchProgress, 0.88));
    const targetAliveCount = Math.max(2, Math.round(this.warriors.length * targetAliveRatio));
    const isDroppingTooFast = aliveWarriors.length <= targetAliveCount;

    // =========================================================================
    // SPATIAL GRID BINNING (O(N) Complexity: Silky Smooth 60 FPS with 100 Players!)
    // =========================================================================
    const cs = this.gridCellSize;
    const gCols = this.gridCols;
    const gRows = this.gridRows;
    const totalCells = gCols * gRows;

    if (!this.warriorGrid || this.warriorGrid.length !== totalCells) {
      this.warriorGrid = Array.from({ length: totalCells }, () => []);
      this.orbGrid = Array.from({ length: totalCells }, () => []);
    } else {
      for (let i = 0; i < totalCells; i++) {
        this.warriorGrid[i].length = 0;
        this.orbGrid[i].length = 0;
      }
    }

    // Bin alive warriors into 2D grid
    for (let w of aliveWarriors) {
      const cx = Math.max(0, Math.min(gCols - 1, (w.x / cs) | 0));
      const cy = Math.max(0, Math.min(gRows - 1, (w.y / cs) | 0));
      w.cellX = cx;
      w.cellY = cy;
      this.warriorGrid[cy * gCols + cx].push(w);
    }

    // Bin XP gems into 2D grid
    for (let orb of this.xpOrbs) {
      const cx = Math.max(0, Math.min(gCols - 1, (orb.x / cs) | 0));
      const cy = Math.max(0, Math.min(gRows - 1, (orb.y / cs) | 0));
      orb.cellX = cx;
      orb.cellY = cy;
      this.orbGrid[cy * gCols + cx].push(orb);
    }

    // Ultra-fast helper: returns nearby warriors in the 3x3 cell neighborhood (approx 330x330px)
    const getNearbyWarriors = (w) => {
      const near = [];
      const minCy = Math.max(0, w.cellY - 1);
      const maxCy = Math.min(gRows - 1, w.cellY + 1);
      const minCx = Math.max(0, w.cellX - 1);
      const maxCx = Math.min(gCols - 1, w.cellX + 1);

      for (let cy = minCy; cy <= maxCy; cy++) {
        const rowOff = cy * gCols;
        for (let cx = minCx; cx <= maxCx; cx++) {
          const bucket = this.warriorGrid[rowOff + cx];
          for (let k = 0; k < bucket.length; k++) {
            const other = bucket[k];
            if (other !== w && other.alive) {
              near.push(other);
            }
          }
        }
      }
      return near;
    };

    // =========================================================================
    // 1. UPDATE EACH WARRIOR (AI, STEERING, BACKSTAB ASSASSINATIONS, EVOLUTION)
    // =========================================================================
    for (let w of aliveWarriors) {
      if (!w.alive) continue;

      if (w.invulnTimer > 0) w.invulnTimer--;
      w.wanderTimer--;
      w.swingCooldown--;
      if (w.attackIntentTimer > 0) w.attackIntentTimer--;
      w.idleBob += 0.05;

      // Knockback velocity inertia damping
      w.x += w.vx;
      w.y += w.vy;
      w.vx *= 0.82;
      w.vy *= 0.82;

      const tier = this.getTier(w.level);

      // 1. Query nearby warriors via spatial grid
      const nearbyWarriors = getNearbyWarriors(w);

      let majorThreat = null;
      let minThreatDistSq = 270 * 270;

      let backstabTarget = null;
      let minBackstabDistSq = 190 * 190;

      let peer = null;
      let minPeerDistSq = 180 * 180;

      let prey = null;
      let minPreyDistSq = 380 * 380;

      for (let other of nearbyWarriors) {
        const dx = other.x - w.x;
        const dy = other.y - w.y;
        const dSq = dx * dx + dy * dy;

        if (other.level > w.level || (other.isSwinging && dSq < 160 * 160)) {
          // Giant is higher level! Check if facing towards w or facing away
          const angleFromGiantToW = Math.atan2(w.y - other.y, w.x - other.x);
          let facingDiff = Math.abs(other.facingAngle - angleFromGiantToW);
          while (facingDiff > Math.PI) facingDiff = Math.abs(facingDiff - Math.PI * 2);

          if (facingDiff < 1.45) {
            // Giant is facing in my general direction -> THREAT! Must flee!
            if (dSq < minThreatDistSq) {
              minThreatDistSq = dSq;
              majorThreat = other;
            }
          } else if (facingDiff > 2.20) {
            // Giant is facing AWAY from me (> 126 deg)! Back is exposed!
            // Lower-level players can opportunistically backstab & slay the giant!
            if (dSq < minBackstabDistSq) {
              minBackstabDistSq = dSq;
              backstabTarget = other;
            }
          }
        } else if (other.level === w.level) {
          if (dSq < minPeerDistSq) {
            minPeerDistSq = dSq;
            peer = other;
          }
        } else if (w.level > other.level) {
          // I am a Hunter / higher level -> hunt down lower-level prey!
          if (dSq < minPreyDistSq) {
            minPreyDistSq = dSq;
            prey = other;
          }
        }
      }

      // 2. Find nearest gem in local 3x3 cells (Active Gem Foraging)
      let nearestOrb = null;
      let minOrbDistSq = 250 * 250;
      const minCy = Math.max(0, w.cellY - 1);
      const maxCy = Math.min(gRows - 1, w.cellY + 1);
      const minCx = Math.max(0, w.cellX - 1);
      const maxCx = Math.min(gCols - 1, w.cellX + 1);

      for (let cy = minCy; cy <= maxCy; cy++) {
        const rowOff = cy * gCols;
        for (let cx = minCx; cx <= maxCx; cx++) {
          const bucket = this.orbGrid[rowOff + cx];
          for (let k = 0; k < bucket.length; k++) {
            const orb = bucket[k];
            const dSq = (orb.x - w.x) * (orb.x - w.x) + (orb.y - w.y) * (orb.y - w.y);
            if (dSq < minOrbDistSq) {
              minOrbDistSq = dSq;
              nearestOrb = orb;
            }
          }
        }
      }

      // Check distance to safe zone borders EVERY FRAME (Zero wall-collision guarantee)
      const r = this.currentRect;
      const wallMargin = 85;
      const distL = w.x - r.x;
      const distR = (r.x + r.width) - w.x;
      const distT = w.y - r.y;
      const distB = (r.y + r.height) - w.y;
      const minWallDist = Math.min(distL, distR, distT, distB);
      const isNearWall = minWallDist < wallMargin;

      const isFleeing = !!majorThreat && !backstabTarget;
      const isHunterChasing = w.level > 1 && !!prey;

      // Base movement speed
      const baseSpeed = Math.max(0.48, 0.60 - (w.level - 1) * 0.025);
      let currentSpeed = baseSpeed;
      if (isHunterChasing) currentSpeed *= 1.15; // Hunter sprint when chasing prey
      if (isFleeing) currentSpeed *= 1.20; // Preys sprint when fleeing from hunter
      if (w.isSwinging) currentSpeed *= 0.35; // Stance deceleration during weapon swing

      // =========================================================================
      // EVOWARS.IO STRATEGIC AI DECISION TREE:
      // =========================================================================
      if (isNearWall) {
        // TOP PRIORITY: Avoid borders of safe rectangular/circular zone! Never crash into walls!
        const toCenter = Math.atan2(centerY - w.y, centerX - w.x);
        w.targetAngle = toCenter;
        w.facingAngle += (toCenter - w.facingAngle) * 0.28;
      } else if (isHunterChasing) {
        // PRIORITY 1: HUNTER CHASES WEAKER PREY! (Ai lên level cao hơn sẽ đi săn chém người còn lại)
        w.targetAngle = Math.atan2(prey.y - w.y, prey.x - w.x);
      } else if (isFleeing) {
        // PRIORITY 2: FLEE IN TERROR FROM FACING GIANTS! (Nhân vật thấp hơn phải biết chạy)
        const fleeAngle = Math.atan2(w.y - majorThreat.y, w.x - majorThreat.x);
        w.targetAngle = fleeAngle + (Math.random() - 0.5) * 0.25;
      } else if (backstabTarget) {
        // PRIORITY 3: DAVID VS GOLIATH BACKSTAB! Giant's back is turned -> rush in and assassinate!
        w.targetAngle = Math.atan2(backstabTarget.y - w.y, backstabTarget.x - w.x);
      } else if (nearestOrb) {
        // PRIORITY 4: ACTIVE GEM VACUUM! (Mọi nhân vật phải đi nhặt bóng để lên level)
        w.targetAngle = Math.atan2(nearestOrb.y - w.y, nearestOrb.x - w.x);
      } else if (peer) {
        // PRIORITY 5: EQUAL PEER IN PROXIMITY -> TACTICAL CIRCLING
        const angleToPeer = Math.atan2(peer.y - w.y, peer.x - w.x);
        w.targetAngle = angleToPeer + (w.id % 2 === 0 ? 0.65 : -0.65);
      } else {
        // Fallback: Patrol
        if (w.wanderTimer <= 0) {
          w.wanderTimer = 35 + ((Math.random() * 30) | 0);
          const distToWp = Math.hypot(w.patrolX - w.x, w.patrolY - w.y);
          if (distToWp < 60) {
            w.patrolX = r.x + 50 + Math.random() * (r.width - 100);
            w.patrolY = r.y + 50 + Math.random() * (r.height - 100);
          }
          w.targetAngle = Math.atan2(w.patrolY - w.y, w.patrolX - w.x);
        }
      }

      // Smooth steering
      let diff = w.targetAngle - w.facingAngle;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      w.facingAngle += diff * 0.12;

      // Move forward
      w.x += Math.cos(w.facingAngle) * currentSpeed;
      w.y += Math.sin(w.facingAngle) * currentSpeed;

      // =========================================================================
      // STRICT GEOMETRIC CLAMP INSIDE CURRENT BO RECTANGLE & CORNERS
      // (Guarantees zero wall collisions & seamless automatic bo constricting!)
      // =========================================================================
      const pad = tier.bodyRadius + 4;
      const minX = r.x + pad;
      const maxX = r.x + r.width - pad;
      const minY = r.y + pad;
      const maxY = r.y + r.height - pad;

      if (w.x < minX) {
        w.x = minX;
        if (Math.cos(w.facingAngle) < 0) w.facingAngle = Math.PI - w.facingAngle;
      } else if (w.x > maxX) {
        w.x = maxX;
        if (Math.cos(w.facingAngle) > 0) w.facingAngle = Math.PI - w.facingAngle;
      }

      if (w.y < minY) {
        w.y = minY;
        if (Math.sin(w.facingAngle) < 0) w.facingAngle = -w.facingAngle;
      } else if (w.y > maxY) {
        w.y = maxY;
        if (Math.sin(w.facingAngle) > 0) w.facingAngle = -w.facingAngle;
      }

      // Corner arc clamping
      const cr = Math.min(r.cornerRadius || 14, Math.min(r.width, r.height) / 2);
      if (cr > pad) {
        const maxCornerDist = cr - pad;
        const corners = [
          { cx: r.x + cr, cy: r.y + cr, left: true, top: true },
          { cx: r.x + r.width - cr, cy: r.y + cr, left: false, top: true },
          { cx: r.x + cr, cy: r.y + r.height - cr, left: true, top: false },
          { cx: r.x + r.width - cr, cy: r.y + r.height - cr, left: false, top: false }
        ];
        for (let c of corners) {
          const inX = c.left ? w.x < c.cx : w.x > c.cx;
          const inY = c.top ? w.y < c.cy : w.y > c.cy;
          if (inX && inY) {
            const cdx = w.x - c.cx;
            const cdy = w.y - c.cy;
            const d = Math.hypot(cdx, cdy);
            if (d > maxCornerDist && d > 0) {
              w.x = c.cx + (cdx / d) * maxCornerDist;
              w.y = c.cy + (cdy / d) * maxCornerDist;
              w.facingAngle = Math.atan2(cdy, cdx) + Math.PI;
            }
          }
        }
      }

      // Collect XP Gems from warrior's local cell bucket
      const bucketIdx = w.cellY * gCols + w.cellX;
      const myBucket = this.orbGrid[bucketIdx];
      const pickupDist = tier.bodyRadius + 12;
      const pickupDistSq = pickupDist * pickupDist;

      if (myBucket) {
        for (let k = myBucket.length - 1; k >= 0; k--) {
          const orb = myBucket[k];
          const dSq = (w.x - orb.x) * (w.x - orb.x) + (w.y - orb.y) * (orb.y - w.y);
          if (dSq < pickupDistSq) {
            w.xp += orb.value;
            const idx = this.xpOrbs.indexOf(orb);
            if (idx !== -1) this.xpOrbs.splice(idx, 1);
            myBucket.splice(k, 1);

            // Evolution check: Level up increases size and weapon reach!
            if (w.level < 5 && w.xp >= tier.xpNeeded) {
              w.level++;
              w.isHunter = true; // Earned Hunter status upon reaching Level 2+!
              const newTier = this.getTier(w.level);
              this.triggerEvolutionEffect(w, newTier);
              if (window.soundFX) window.soundFX.playBounce(750);
            }
            break;
          }
        }
      }
    }

    // =========================================================================
    // 2. ELASTIC BODY-TO-BODY COLLISION RESOLUTION (NEVER WALK THROUGH EACH OTHER!)
    // O(N) Spatial Grid lookup: zero frame drops with 100 players
    // =========================================================================
    for (let i = 0; i < aliveWarriors.length; i++) {
      const w1 = aliveWarriors[i];
      if (!w1.alive) continue;
      const t1 = this.getTier(w1.level);
      const r1 = t1.bodyRadius * (w1.scale || 1.0);

      const near = getNearbyWarriors(w1);
      for (let j = 0; j < near.length; j++) {
        const w2 = near[j];
        if (w1.id >= w2.id || !w2.alive) continue; // Check each pair once!

        const t2 = this.getTier(w2.level);
        const r2 = t2.bodyRadius * (w2.scale || 1.0);
        const dx = w2.x - w1.x;
        const dy = w2.y - w1.y;
        const minDist = (r1 + r2) * 1.35;
        const dSq = dx * dx + dy * dy;

        if (dSq < minDist * minDist) {
          const dist = Math.sqrt(dSq) || 0.001;
          const overlap = minDist - dist;
          const nx = dx / dist;
          const ny = dy / dist;

          const m1 = t1.bodyRadius;
          const m2 = t2.bodyRadius;
          const totalM = m1 + m2;
          const p1 = overlap * (m2 / totalM);
          const p2 = overlap * (m1 / totalM);

          w1.x -= nx * p1;
          w1.y -= ny * p1;
          w2.x += nx * p2;
          w2.y += ny * p2;

          // Elastic bounce impulse
          w1.vx -= nx * 0.5;
          w1.vy -= ny * 0.5;
          w2.vx += nx * 0.5;
          w2.vy += ny * 0.5;
        }
      }
    }

    // =========================================================================
    // 3. IMMEDIATE MELEE ATTACK TRIGGER & SWING RESOLUTION
    // =========================================================================
    for (let w of aliveWarriors) {
      if (!w.alive) continue;
      const tier = this.getTier(w.level);
      const near = getNearbyWarriors(w);

      // Trigger swing when cooldown is ready, not currently swinging, no grace shield, and attack intent timer elapsed
      if (w.swingCooldown <= 0 && !w.isSwinging && w.invulnTimer <= 0) {
        if (w.attackIntentTimer <= 0) {
          const totalReach = tier.bodyRadius + tier.weaponLength + 10;
          const reachSq = totalReach * totalReach;

          let targetFound = null;
          let isTrueBackstab = false;
          let isHunterTarget = false;

          for (let other of near) {
            if (!other.alive || other.invulnTimer > 0) continue;
            const dx = other.x - w.x;
            const dy = other.y - w.y;
            const dSq = dx * dx + dy * dy;

            if (dSq <= reachSq) {
              const angleFromOtherToW = Math.atan2(w.y - other.y, w.x - other.x);
              let otherFacingDiff = Math.abs(other.facingAngle - angleFromOtherToW);
              while (otherFacingDiff > Math.PI) otherFacingDiff = Math.abs(otherFacingDiff - Math.PI * 2);

              if (otherFacingDiff > 2.10) {
                targetFound = other;
                isTrueBackstab = true;
                break;
              } else if (w.level > other.level) {
                targetFound = other;
                isHunterTarget = true;
                break;
              } else if (!targetFound) {
                targetFound = other;
              }
            }
          }

          if (targetFound) {
            let strikeChance = 0.65;
            if (isTrueBackstab) {
              strikeChance = 0.90;
            } else if (isHunterTarget) {
              strikeChance = 0.85;
            } else {
              strikeChance = 0.60;
            }

            if (Math.random() < strikeChance) {
              const targetAngle = Math.atan2(targetFound.y - w.y, targetFound.x - w.x);
              w.facingAngle = targetAngle;
              w.isSwinging = true;
              w.swingProgress = 0;
              w.hasHitOpponent = false;
              w.swingDirection = Math.random() > 0.5 ? 1 : -1;
              w.swingCooldown = 65 + ((Math.random() * 35) | 0); // 1.1s to 1.65s active combat rhythm
              if (Math.random() < 0.35 && window.soundFX) window.soundFX.playBounce(550);
            } else {
              w.attackIntentTimer = 18 + ((Math.random() * 20) | 0);
            }
          }
        }
      }

      // Process ongoing swing (~45 frames = 0.75s deliberate weapon swing arc)
      if (w.isSwinging) {
        w.swingProgress += 0.024; // Dynamic, majestic swing arc

        const arcSpread = 2.4;
        const currentSwingOffset = (0.5 - w.swingProgress) * arcSpread * w.swingDirection;
        const currentBladeAngle = w.facingAngle + currentSwingOffset;

        const totalReach = tier.bodyRadius + tier.weaponLength;
        const bladeTipX = w.x + Math.cos(currentBladeAngle) * totalReach;
        const bladeTipY = w.y + Math.sin(currentBladeAngle) * totalReach;

        // Visual Slash Wave Arc
        if (w.swingProgress >= 0.20 && w.swingProgress <= 0.80) {
          this.slashEffects.push({
            x: w.x,
            y: w.y,
            startAngle: currentBladeAngle - 0.25 * w.swingDirection,
            endAngle: currentBladeAngle + 0.35 * w.swingDirection,
            innerRadius: tier.bodyRadius + 6,
            outerRadius: totalReach + 10,
            color: tier.bladeColor,
            glowColor: tier.glowColor,
            alpha: 0.85
          });
        }

        // Active hit window (only at strike apex 0.28 to 0.68) and only if hasn't connected yet!
        if (w.alive && !w.hasHitOpponent && w.swingProgress >= 0.28 && w.swingProgress <= 0.68 && w.invulnTimer <= 0) {
          for (let other of near) {
            if (!other.alive || other.invulnTimer > 0) continue;
            const otherTier = this.getTier(other.level);

            const hit = this.checkBladeHit(w.x, w.y, bladeTipX, bladeTipY, other.x, other.y, otherTier.bodyRadius);

            if (hit) {
              w.hasHitOpponent = true;

              const angleFromOtherToW = Math.atan2(w.y - other.y, w.x - other.x);
              let facingDiff = Math.abs(other.facingAngle - angleFromOtherToW);
              while (facingDiff > Math.PI) facingDiff = Math.abs(facingDiff - Math.PI * 2);

              const isDeepBackstab = facingDiff > 2.50; // > 143 deg: behind their back!
              const isFrontal = facingDiff < 1.35; // < 77 deg: front-facing!

              // 1. DAVID VS GOLIATH BACKSTAB:
              // Lower level player ambushes higher level Hunter from behind!
              if (isDeepBackstab && w.level < other.level) {
                this.createBackstabSparks(other.x, other.y);
                this.killWarrior(other, w);
                break;
              }

              // 2. HUNTER SLAYS LOWER-LEVEL PREY:
              // Higher level player strikes lower level player!
              if (w.level > other.level) {
                if (other.isSwinging) {
                  // Both swung at apex: defensive blade clash pushback
                  this.clashBlades(w, other, bladeTipX, bladeTipY);
                } else {
                  // Hunter executes lower-level prey!
                  this.killWarrior(other, w);
                }
                break;
              }

              // 3. PEER VS PEER DUEL (Equal levels):
              if (w.level === other.level) {
                if (isDeepBackstab) {
                  // Backstab between peers is fatal
                  this.createBackstabSparks(other.x, other.y);
                  this.killWarrior(other, w);
                  break;
                }

                let shouldClash = false;
                if (other.isSwinging) {
                  shouldClash = true; // Both swung -> blade clash
                } else if (isFrontal) {
                  shouldClash = Math.random() < 0.65; // Frontal parry chance
                } else {
                  shouldClash = Math.random() < 0.35; // Flank hit
                }

                if (shouldClash) {
                  this.clashBlades(w, other, bladeTipX, bladeTipY);
                } else {
                  this.killWarrior(other, w);
                }
                break;
              }

              // 4. Fallback hit:
              this.killWarrior(other, w);
              break;
            }
          }
        }

        if (w.swingProgress >= 1) {
          w.isSwinging = false;
          w.hasHitOpponent = false;
        }
      }
    }

    // 5. Update Slash Waves
    for (let i = this.slashEffects.length - 1; i >= 0; i--) {
      this.slashEffects[i].alpha -= 0.045;
      if (this.slashEffects[i].alpha <= 0) this.slashEffects.splice(i, 1);
    }
    if (this.slashEffects.length > 40) this.slashEffects.splice(0, this.slashEffects.length - 40);

    // 6. Update Gem Rotations & Pulses
    for (let orb of this.xpOrbs) {
      orb.rot += orb.rotSpeed;
      orb.pulse += 0.05;
    }

    // 7. Update Particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.life -= 0.04;
      if (p.life <= 0) this.particles.splice(i, 1);
    }
    if (this.particles.length > 80) this.particles.splice(0, this.particles.length - 80);

    // 8. Update Clash Sparks
    for (let i = this.clashSparks.length - 1; i >= 0; i--) {
      const s = this.clashSparks[i];
      s.x += s.vx;
      s.y += s.vy;
      s.life -= 0.07;
      if (s.life <= 0) this.clashSparks.splice(i, 1);
    }
    if (this.clashSparks.length > 60) this.clashSparks.splice(0, this.clashSparks.length - 60);

    // 9. Leaderboard Update
    const sorted = [...this.warriors].sort((a, b) => {
      if (a.alive !== b.alive) return b.alive ? 1 : -1;
      if (a.level !== b.level) return b.level - a.level;
      if (a.kills !== b.kills) return b.kills - a.kills;
      return b.xp - a.xp;
    });

    if (this.onLeaderboardUpdate) {
      this.onLeaderboardUpdate(
        sorted.map(w => {
          const tier = this.getTier(w.level);
          return {
            name: w.name,
            progress: w.alive ? `Lv.${w.level} ${tier.title} (${w.kills} 🗡️)` : 'Đã dừng bước ❌'
          };
        })
      );
    }

    // 10. Check Match Finish: 1 Survivor Left OR 3-Minute Time Limit Reached
    const remaining = this.warriors.filter(w => w.alive);
    const timeLimitReached = currentSec >= totalSec;

    if ((remaining.length <= 1 || timeLimitReached) && !this.finishTriggered) {
      this.finishTriggered = true;
      setTimeout(() => {
        this.stop();

        const podium = [];
        // Sort remaining survivors by Level then Kills then XP
        const finalSurvivors = [...remaining].sort((a, b) => {
          if (b.level !== a.level) return b.level - a.level;
          if (b.kills !== a.kills) return b.kills - a.kills;
          return b.xp - a.xp;
        });

        for (let s of finalSurvivors) {
          if (podium.length < 3) podium.push(s);
        }

        // Fill remaining podium spots from most recently eliminated
        for (let i = this.eliminatedWarriors.length - 1; i >= 0; i--) {
          if (podium.length < 3) {
            podium.push(this.eliminatedWarriors[i]);
          }
        }

        if (this.onFinishCallback) {
          this.onFinishCallback(podium);
        }
      }, 1200);
    }
  }

  // Blade Clash / Parry (Đỡ đòn, tóe lửa, không ai chết)
  clashBlades(w1, w2, cx, cy) {
    w1.isSwinging = false;
    w2.isSwinging = false;
    w1.hasHitOpponent = false;
    w2.hasHitOpponent = false;
    w1.swingCooldown = 65 + ((Math.random() * 30) | 0); // 1.1s - 1.6s recovery cooldown
    w2.swingCooldown = 65 + ((Math.random() * 30) | 0);
    w1.attackIntentTimer = 40 + ((Math.random() * 30) | 0);
    w2.attackIntentTimer = 40 + ((Math.random() * 30) | 0);

    // Push back each other
    const ang = Math.atan2(w1.y - w2.y, w1.x - w2.x);
    w1.vx += Math.cos(ang) * 7.5;
    w1.vy += Math.sin(ang) * 7.5;
    w2.vx -= Math.cos(ang) * 7.5;
    w2.vy -= Math.sin(ang) * 7.5;

    if (window.soundFX) window.soundFX.playBounce(900);

    // Clash spark burst
    const sparkX = cx || (w1.x + w2.x) / 2;
    const sparkY = cy || (w1.y + w2.y) / 2;
    for (let i = 0; i < 14; i++) {
      const spd = 2 + Math.random() * 4;
      const sa = Math.random() * Math.PI * 2;
      this.clashSparks.push({
        x: sparkX,
        y: sparkY,
        vx: Math.cos(sa) * spd,
        vy: Math.sin(sa) * spd,
        color: '#fef08a',
        size: 2.5 + Math.random() * 2.5,
        life: 1.0
      });
    }
  }

  checkBladeHit(x1, y1, x2, y2, cx, cy, r) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const lenSq = dx * dx + dy * dy;
    if (lenSq === 0) return Math.hypot(cx - x1, cy - y1) < r;

    let t = ((cx - x1) * dx + (cy - y1) * dy) / lenSq;
    t = Math.max(0, Math.min(1, t));
    const nearX = x1 + t * dx;
    const nearY = y1 + t * dy;
    return Math.hypot(cx - nearX, cy - nearY) < r + 4;
  }

  killWarrior(victim, killer) {
    if (!victim.alive) return;

    // Immediately cancel victim state so they cannot kill anyone else
    victim.alive = false;
    victim.isSwinging = false;
    victim.swingProgress = 0;
    victim.hasHitOpponent = false;
    this.eliminatedWarriors.push(victim);

    if (killer && killer.alive) {
      killer.kills++;
      killer.xp += 35; // Controlled XP for kill to prevent runaway giant early on

      if (killer.level < 5 && killer.xp >= this.getTier(killer.level).xpNeeded) {
        killer.level++;
        const newTier = this.getTier(killer.level);
        this.triggerEvolutionEffect(killer, newTier);
      }
    }

    if (window.soundFX) window.soundFX.playBounce(320);

    // Victim drops shower of sparkling gems (EvoWars style: feast of gems!)
    const dropCount = 10 + victim.level * 4;
    for (let i = 0; i < dropCount; i++) {
      this.spawnXPOrb(victim.x, victim.y, true);
    }

    // Slice debris sparks
    for (let i = 0; i < 20; i++) {
      const ang = Math.random() * Math.PI * 2;
      const spd = 2.5 + Math.random() * 4.5;
      this.particles.push({
        x: victim.x,
        y: victim.y,
        vx: Math.cos(ang) * spd,
        vy: Math.sin(ang) * spd,
        color: i % 2 === 0 ? '#ef4444' : '#fbbf24',
        size: 3.5 + Math.random() * 3,
        life: 1.0
      });
    }
  }

  // Evolution Effect: Clean visual shockwave ring (NO NOISY FLOATING TEXT!)
  triggerEvolutionEffect(w, newTier) {
    for (let i = 0; i < 32; i++) {
      const ang = (i * Math.PI * 2) / 32;
      const spd = 3.2 + Math.random() * 1.5;
      this.particles.push({
        x: w.x,
        y: w.y,
        vx: Math.cos(ang) * spd,
        vy: Math.sin(ang) * spd,
        color: newTier.glowColor,
        size: 4 + Math.random() * 3,
        life: 1.2
      });
    }
  }

  render() {
    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;
    const r = this.currentRect;

    ctx.clearRect(0, 0, w, h);

    // 1. Dark Honeycomb Hexagonal Arena Floor
    ctx.fillStyle = '#0a0d13';
    ctx.fillRect(0, 0, w, h);

    this.drawHexGrid(ctx, w, h, r);

    // 2. Burning Perimeter Flame Zone (Outside morphing safe zone)
    const cr = r.cornerRadius || 14;
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, w, h);
    ctx.roundRect(r.x, r.y, r.width, r.height, cr);
    ctx.fillStyle = 'rgba(234, 88, 12, 0.35)'; // Smoky hazardous orange
    ctx.fill('evenodd');

    // Pulsing Glowing Border for Safe Zone
    const pulse = 0.5 + Math.sin(this.matchTimer * 0.08) * 0.5;
    ctx.strokeStyle = this.zoneState === 'shrinking' ? '#ef4444' : '#f97316';
    ctx.lineWidth = this.zoneState === 'shrinking' ? 5 + pulse * 2 : 4;
    ctx.shadowColor = this.zoneState === 'shrinking' ? '#dc2626' : '#ea580c';
    ctx.shadowBlur = 18 + pulse * 8;
    ctx.beginPath();
    ctx.roundRect(r.x, r.y, r.width, r.height, cr);
    ctx.stroke();

    // Inner neon highlight line
    ctx.strokeStyle = 'rgba(254, 215, 170, 0.7)';
    ctx.lineWidth = 1.5;
    ctx.shadowBlur = 0;
    ctx.beginPath();
    const innerCR = Math.max(0, cr - 2);
    ctx.roundRect(r.x + 2, r.y + 2, Math.max(0, r.width - 4), Math.max(0, r.height - 4), innerCR);
    ctx.stroke();

    // Sci-Fi Corner Brackets (Only visible when zone is still largely rectangular)
    const isRound = cr > r.height * 0.32;
    if (!isRound) {
      const cLen = Math.min(22, r.width * 0.1, r.height * 0.1);
      ctx.strokeStyle = '#fde047';
      ctx.lineWidth = 3;

      // Top-Left
      ctx.beginPath();
      ctx.moveTo(r.x, r.y + cLen);
      ctx.lineTo(r.x, r.y);
      ctx.lineTo(r.x + cLen, r.y);
      ctx.stroke();

      // Top-Right
      ctx.beginPath();
      ctx.moveTo(r.x + r.width - cLen, r.y);
      ctx.lineTo(r.x + r.width, r.y);
      ctx.lineTo(r.x + r.width, r.y + cLen);
      ctx.stroke();

      // Bottom-Left
      ctx.beginPath();
      ctx.moveTo(r.x, r.y + r.height - cLen);
      ctx.lineTo(r.x, r.y + r.height);
      ctx.lineTo(r.x + cLen, r.y + r.height);
      ctx.stroke();

      // Bottom-Right
      ctx.beginPath();
      ctx.moveTo(r.x + r.width - cLen, r.y + r.height);
      ctx.lineTo(r.x + r.width, r.y + r.height);
      ctx.lineTo(r.x + r.width, r.y + r.height - cLen);
      ctx.stroke();
    } else {
      // Glowing circular death ring when bo has turned circular!
      const ringPulse = Math.sin(this.matchTimer * 0.12) * 3;
      ctx.strokeStyle = '#ef4444';
      ctx.lineWidth = 2.0;
      ctx.shadowColor = '#dc2626';
      ctx.shadowBlur = 14;
      ctx.beginPath();
      ctx.arc(r.x + r.width / 2, r.y + r.height / 2, Math.min(r.width, r.height) / 2 + 5 + ringPulse, 0, Math.PI * 2);
      ctx.stroke();
      ctx.shadowBlur = 0;
    }

    ctx.restore();

    // 3. Draw Sparkling Faceted XP Gems
    for (let orb of this.xpOrbs) {
      this.drawGem(ctx, orb);
    }

    // 4. Draw Slash Wave Effects
    for (let s of this.slashEffects) {
      this.drawSlashEffect(ctx, s);
    }

    // 5. Draw Particles
    for (let p of this.particles) {
      ctx.fillStyle = p.color;
      ctx.globalAlpha = p.life;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    }

    // 6. Draw Clash Sparks
    for (let s of this.clashSparks) {
      ctx.fillStyle = s.color;
      ctx.globalAlpha = s.life;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1.0;

    // 7. Draw Living Warriors (Sorted by size and Y)
    const alive = this.warriors.filter(wr => wr.alive);
    alive.sort((a, b) => a.level !== b.level ? a.level - b.level : a.y - b.y);

    for (let wr of alive) {
      this.drawEvoWarrior(ctx, wr);
    }

    // 8. Status HUD
    this.drawStatusHUD(ctx, w);
  }

  // Draw Authentic EvoWars Hexagon Honeycomb Background using fast cached offscreen canvas
  drawHexGrid(ctx, w, h, r) {
    if (!this.hexGridCanvas) this.buildHexGridCache();
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(r.x, r.y, r.width, r.height, r.cornerRadius || 14);
    ctx.clip(); // Clip inside safe morphing zone
    ctx.drawImage(this.hexGridCanvas, 0, 0);
    ctx.restore();
  }

  // Draw Faceted Diamond & Hexagon Gems (Zero shadowBlur for solid 60 FPS)
  drawGem(ctx, orb) {
    ctx.save();
    ctx.translate(orb.x, orb.y);
    ctx.rotate(orb.rot);

    const s = orb.size + Math.sin(orb.pulse) * 0.5;
    ctx.lineWidth = 1.0;
    ctx.strokeStyle = '#090a0f';

    if (orb.gemType === 'diamond') {
      ctx.fillStyle = orb.darkColor;
      ctx.beginPath();
      ctx.moveTo(0, -s * 1.3);
      ctx.lineTo(-s, 0);
      ctx.lineTo(0, s * 1.3);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = orb.color;
      ctx.beginPath();
      ctx.moveTo(0, -s * 1.3);
      ctx.lineTo(s, 0);
      ctx.lineTo(0, s * 1.3);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = orb.lightColor;
      ctx.beginPath();
      ctx.moveTo(0, -s * 1.3);
      ctx.lineTo(-s * 0.45, -s * 0.35);
      ctx.lineTo(s * 0.45, -s * 0.35);
      ctx.closePath();
      ctx.fill();

    } else if (orb.gemType === 'hex') {
      ctx.fillStyle = orb.color;
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const a = (i * Math.PI) / 3;
        const hx = Math.cos(a) * s;
        const hy = Math.sin(a) * s;
        if (i === 0) ctx.moveTo(hx, hy);
        else ctx.lineTo(hx, hy);
      }
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = orb.lightColor;
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const a = (i * Math.PI) / 3;
        const hx = Math.cos(a) * (s * 0.52);
        const hy = Math.sin(a) * (s * 0.52);
        if (i === 0) ctx.moveTo(hx, hy);
        else ctx.lineTo(hx, hy);
      }
      ctx.closePath();
      ctx.fill();

    } else {
      ctx.fillStyle = orb.darkColor;
      ctx.beginPath();
      ctx.moveTo(0, -s * 1.25);
      ctx.lineTo(-s * 0.95, s * 0.85);
      ctx.lineTo(0, s * 0.45);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = orb.color;
      ctx.beginPath();
      ctx.moveTo(0, -s * 1.25);
      ctx.lineTo(s * 0.95, s * 0.85);
      ctx.lineTo(0, s * 0.45);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = orb.lightColor;
      ctx.beginPath();
      ctx.moveTo(0, -s * 1.25);
      ctx.lineTo(-s * 0.3, -s * 0.4);
      ctx.lineTo(s * 0.3, -s * 0.4);
      ctx.closePath();
      ctx.fill();
    }

    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(-s * 0.28, -s * 0.35, Math.max(1, s * 0.22), 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  // Draw Crescent Slash Wave Arc
  drawSlashEffect(ctx, s) {
    ctx.save();
    ctx.globalAlpha = s.alpha;

    const grad = ctx.createRadialGradient(s.x, s.y, s.innerRadius, s.x, s.y, s.outerRadius);
    grad.addColorStop(0, 'rgba(255, 255, 255, 0)');
    grad.addColorStop(0.7, s.glowColor);
    grad.addColorStop(1, '#ffffff');

    ctx.strokeStyle = grad;
    ctx.lineWidth = (s.outerRadius - s.innerRadius) * 0.65;
    ctx.shadowColor = s.color;
    ctx.shadowBlur = 16;
    ctx.beginPath();
    ctx.arc(s.x, s.y, (s.innerRadius + s.outerRadius) / 2, s.startAngle, s.endAngle);
    ctx.stroke();

    ctx.restore();
  }

  // Main EvoWars Character Drawing Dispatcher
  drawEvoWarrior(ctx, wr) {
    const tier = this.getTier(wr.level);

    ctx.save();
    ctx.translate(wr.x, wr.y);
    if (wr.scale && wr.scale !== 1.0) {
      ctx.scale(wr.scale, wr.scale);
    }

    // Immunity Grace Shield (Visual Pulsing Energy Sphere during spawn grace)
    if (wr.invulnTimer > 0) {
      const shieldPulse = Math.sin(wr.invulnTimer * 0.15) * 2.5;
      ctx.save();
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.85)';
      ctx.lineWidth = 2.5;
      ctx.fillStyle = 'rgba(56, 189, 248, 0.12)';
      ctx.beginPath();
      ctx.arc(0, 0, tier.bodyRadius + 12 + shieldPulse, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }

    // Soft Ground Shadow
    ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
    ctx.beginPath();
    ctx.ellipse(0, tier.bodyRadius * 0.35, tier.bodyRadius * 1.25, tier.bodyRadius * 0.65, 0, 0, Math.PI * 2);
    ctx.fill();

    // Rotate to Facing Direction
    ctx.save();
    ctx.rotate(wr.facingAngle);

    // 1. Draw Specific EvoWars Hero Body & Left Hand/Shield
    if (wr.level === 1) {
      this.drawCaveman(ctx, wr, tier.bodyRadius);
    } else if (wr.level === 2) {
      this.drawGreenMonster(ctx, wr, tier.bodyRadius);
    } else if (wr.level === 3) {
      this.drawKnight(ctx, wr, tier.bodyRadius);
    } else if (wr.level === 4) {
      this.drawDemonBerserker(ctx, wr, tier.bodyRadius);
    } else {
      this.drawWingedTitan(ctx, wr, tier.bodyRadius);
    }

    // 2. Draw Weapon Held in Right Hand (+Y)
    this.drawWarriorWeapon(ctx, wr, tier);

    ctx.restore(); // Restore facing rotation

    ctx.restore(); // Restore world translation

    // 3. Name Tag (World Space)
    this.drawWarriorNameTag(ctx, wr, tier);
  }

  // LEVEL 1: CAVEMAN (NGƯỜI TIỀN SỬ)
  drawCaveman(ctx, wr, r) {
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = '#111318';

    ctx.fillStyle = '#b45309';
    ctx.beginPath();
    ctx.ellipse(-r * 0.15, 0, r * 0.85, r * 1.15, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#451a03';
    ctx.beginPath();
    ctx.arc(-r * 0.3, -r * 0.45, r * 0.18, 0, Math.PI * 2);
    ctx.arc(-r * 0.1, r * 0.45, r * 0.16, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#d99b6e';
    ctx.beginPath();
    ctx.arc(r * 0.3, -r * 0.85, r * 0.32, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    const headR = r * 0.72;
    ctx.fillStyle = '#d99b6e';
    ctx.beginPath();
    ctx.arc(r * 0.05, 0, headR, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#543825';
    ctx.beginPath();
    ctx.arc(r * 0.05, 0, headR * 0.82, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.strokeStyle = '#382315';
    ctx.lineWidth = 2.0;
    for (let i = 0; i < 8; i++) {
      const a = (i * Math.PI) / 4;
      ctx.beginPath();
      ctx.moveTo(r * 0.05, 0);
      ctx.lineTo(r * 0.05 + Math.cos(a) * headR * 0.82, Math.sin(a) * headR * 0.82);
      ctx.stroke();
    }

    ctx.fillStyle = '#382315';
    ctx.beginPath();
    ctx.arc(r * 0.05, 0, headR * 0.24, 0, Math.PI * 2);
    ctx.fill();
  }

  // LEVEL 2: GREEN MONSTER (QUÁI VẬT GAI XANH)
  drawGreenMonster(ctx, wr, r) {
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = '#111318';

    ctx.fillStyle = '#6b21a8';
    ctx.beginPath();
    ctx.ellipse(-r * 0.2, -r * 0.9, r * 0.45, r * 0.65, -0.3, 0, Math.PI * 2);
    ctx.ellipse(-r * 0.2, r * 0.9, r * 0.45, r * 0.65, 0.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.strokeStyle = '#3b0764';
    ctx.lineWidth = 1.8;
    for (let dy of [-r * 0.9, r * 0.9]) {
      ctx.beginPath();
      ctx.moveTo(-r * 0.35, dy - r * 0.25);
      ctx.lineTo(-r * 0.05, dy + r * 0.25);
      ctx.moveTo(-r * 0.35, dy + r * 0.25);
      ctx.lineTo(-r * 0.05, dy - r * 0.25);
      ctx.stroke();
    }

    ctx.strokeStyle = '#111318';
    ctx.lineWidth = 2.5;

    const headR = r * 0.85;
    ctx.fillStyle = '#16a34a';
    ctx.beginPath();
    ctx.arc(0, 0, headR, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#14532d';
    ctx.beginPath();
    ctx.arc(0, 0, headR * 0.65, -Math.PI * 0.8, Math.PI * 0.8, true);
    ctx.fill();

    const hornPositions = [
      { a: -0.4, len: r * 0.45 },
      { a: 0, len: r * 0.55 },
      { a: 0.4, len: r * 0.45 }
    ];
    for (let h of hornPositions) {
      const baseDist = headR * 0.78;
      const bx = Math.cos(h.a) * baseDist;
      const by = Math.sin(h.a) * baseDist;
      const tx = Math.cos(h.a) * (baseDist + h.len);
      const ty = Math.sin(h.a) * (baseDist + h.len);

      ctx.fillStyle = '#eab308';
      ctx.beginPath();
      ctx.moveTo(bx - Math.sin(h.a) * (r * 0.18), by + Math.cos(h.a) * (r * 0.18));
      ctx.lineTo(tx, ty);
      ctx.lineTo(bx + Math.sin(h.a) * (r * 0.18), by - Math.cos(h.a) * (r * 0.18));
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }

    const eyeX = headR * 0.42;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(eyeX, 0, headR * 0.28, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#0f172a';
    ctx.beginPath();
    ctx.arc(eyeX + 1.5, 0, headR * 0.14, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#15803d';
    ctx.beginPath();
    ctx.arc(r * 0.35, -r * 0.88, r * 0.32, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }

  // LEVEL 3: ROYAL KNIGHT (HIỆP SĨ THÁNH CHIẾN)
  drawKnight(ctx, wr, r) {
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = '#111318';

    const sX = r * 0.25;
    const sY = -r * 0.95;
    ctx.fillStyle = '#cbd5e1';
    ctx.beginPath();
    ctx.roundRect(sX - r * 0.35, sY - r * 0.2, r * 0.85, r * 0.4, 4);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#fbbf24';
    ctx.fillRect(sX - r * 0.3, sY - r * 0.08, r * 0.75, r * 0.16);

    const headR = r * 0.78;
    ctx.fillStyle = '#cbd5e1';
    ctx.beginPath();
    ctx.arc(r * 0.05, 0, headR, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#94a3b8';
    ctx.beginPath();
    ctx.arc(r * 0.05, 0, headR * 0.95, -Math.PI * 0.4, Math.PI * 0.4);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#0f172a';
    for (let dy of [-headR * 0.25, -headR * 0.08, headR * 0.08, headR * 0.25]) {
      ctx.fillRect(headR * 0.35, dy - 1.5, headR * 0.45, 3.2);
    }

    ctx.fillStyle = '#f59e0b';
    ctx.fillRect(-headR * 0.1, -headR * 0.35, headR * 0.2, headR * 0.7);
    ctx.fillRect(-headR * 0.35, -headR * 0.1, headR * 0.7, headR * 0.2);
  }

  // LEVEL 4: DEMON BERSERKER (MA VƯƠNG CUỒNG NỘ)
  drawDemonBerserker(ctx, wr, r) {
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = '#050608';

    for (let side of [-1, 1]) {
      const py = side * r * 0.95;
      ctx.fillStyle = '#7f1d1d';
      ctx.beginPath();
      ctx.arc(-r * 0.15, py, r * 0.42, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#f8fafc';
      ctx.beginPath();
      ctx.moveTo(-r * 0.15, py - r * 0.2);
      ctx.lineTo(-r * 0.15 - r * 0.45, py);
      ctx.lineTo(-r * 0.15, py + r * 0.2);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }

    const headR = r * 0.76;
    ctx.fillStyle = '#18181b';
    ctx.beginPath();
    ctx.arc(r * 0.05, 0, headR, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    for (let side of [-1, 1]) {
      const hy = side * headR * 0.65;
      ctx.fillStyle = '#dc2626';
      ctx.beginPath();
      ctx.moveTo(-headR * 0.15, hy);
      ctx.quadraticCurveTo(headR * 0.45, hy + side * headR * 0.9, headR * 0.9, hy + side * headR * 0.75);
      ctx.quadraticCurveTo(headR * 0.15, hy + side * headR * 0.4, -headR * 0.35, hy - side * headR * 0.1);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }

    const eyeX = headR * 0.32;
    const eyeSpread = headR * 0.35;
    ctx.fillStyle = '#ef4444';
    ctx.shadowColor = '#ef4444';
    ctx.shadowBlur = 10;
    for (let side of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(eyeX - headR * 0.15, side * (eyeSpread + headR * 0.15));
      ctx.lineTo(eyeX + headR * 0.35, side * eyeSpread);
      ctx.lineTo(eyeX - headR * 0.15, side * (eyeSpread - headR * 0.15));
      ctx.closePath();
      ctx.fill();
    }
    ctx.shadowBlur = 0;
  }

  // LEVEL 5: WINGED TITAN (CHIẾN THẦN ĐÔI CÁNH THIÊN THẦN)
  drawWingedTitan(ctx, wr, r) {
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = '#050608';

    for (let side of [-1, 1]) {
      const wy = side * r * 0.85;

      ctx.save();
      ctx.translate(-r * 0.2, wy);
      ctx.rotate(side * 0.35);

      ctx.fillStyle = '#ffffff';

      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.quadraticCurveTo(-r * 0.8, side * r * 0.6, -r * 1.5, side * r * 0.8);
      ctx.quadraticCurveTo(-r * 1.0, side * r * 0.2, -r * 0.5, 0);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      for (let f = 1; f <= 3; f++) {
        ctx.beginPath();
        ctx.moveTo(-r * 0.3 * f, 0);
        ctx.lineTo(-r * 0.5 * f - r * 0.5, side * (r * 0.3 * f + r * 0.3));
        ctx.lineTo(-r * 0.3 * f - r * 0.2, 0);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      }

      ctx.restore();
    }

    const headR = r * 0.78;
    ctx.fillStyle = '#334155';
    ctx.beginPath();
    ctx.arc(r * 0.05, 0, headR, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#1e293b';
    ctx.beginPath();
    ctx.arc(r * 0.05, 0, headR * 0.95, -Math.PI * 0.42, Math.PI * 0.42);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    const eyeX = headR * 0.38;
    ctx.fillStyle = '#f97316';
    ctx.shadowColor = '#ef4444';
    ctx.shadowBlur = 12;
    for (let side of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(eyeX - headR * 0.12, side * (headR * 0.38));
      ctx.lineTo(eyeX + headR * 0.32, side * (headR * 0.22));
      ctx.lineTo(eyeX - headR * 0.12, side * (headR * 0.12));
      ctx.closePath();
      ctx.fill();
    }
    ctx.shadowBlur = 0;

    ctx.fillStyle = '#fbbf24';
    ctx.fillRect(-headR * 0.25, -headR * 0.95, headR * 0.5, headR * 0.2);
    ctx.fillRect(-headR * 0.25, headR * 0.75, headR * 0.5, headR * 0.2);
  }

  // Draw Weapon Held in Right Hand
  drawWarriorWeapon(ctx, wr, tier) {
    const r = tier.bodyRadius;
    const handX = r * 0.45;
    const handY = r * 0.85;
    const handRadius = r * 0.32;

    ctx.save();
    ctx.translate(handX, handY);

    let weaponRelAngle = 0.45 + Math.sin(wr.idleBob) * 0.04;
    if (wr.isSwinging) {
      const arcSpread = 2.4;
      weaponRelAngle = (0.5 - wr.swingProgress) * arcSpread * wr.swingDirection;
    }

    ctx.rotate(weaponRelAngle);

    if (wr.level === 1) {
      this.drawCavemanClub(ctx, tier.weaponLength, tier.weaponWidth);
    } else if (wr.level === 2) {
      this.drawMonsterMace(ctx, tier.weaponLength, tier.weaponWidth);
    } else if (wr.level === 3) {
      this.drawKnightSword(ctx, tier.weaponLength, tier.weaponWidth);
    } else if (wr.level === 4) {
      this.drawDemonSword(ctx, tier.weaponLength, tier.weaponWidth);
    } else {
      this.drawWingedTitanSword(ctx, tier.weaponLength, tier.weaponWidth);
    }

    ctx.lineWidth = 2.0;
    ctx.strokeStyle = '#111318';
    ctx.fillStyle = wr.level === 1 ? '#d99b6e' : (wr.level === 2 ? '#15803d' : (wr.level === 3 ? '#cbd5e1' : (wr.level === 4 ? '#18181b' : '#334155')));
    ctx.beginPath();
    ctx.arc(0, 0, handRadius, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.restore();
  }

  drawCavemanClub(ctx, len, w) {
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = '#111318';

    ctx.fillStyle = '#78350f';
    ctx.beginPath();
    ctx.moveTo(-5, -w * 0.25);
    ctx.lineTo(len * 0.45, -w * 0.35);
    ctx.lineTo(len * 0.85, -w * 0.75);
    ctx.arc(len * 0.85, 0, w * 0.75, -Math.PI * 0.5, Math.PI * 0.5);
    ctx.lineTo(len * 0.45, w * 0.35);
    ctx.lineTo(-5, w * 0.25);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#5c2b09';
    const bumps = [
      { x: len * 0.55, y: -w * 0.45, r: w * 0.22 },
      { x: len * 0.75, y: -w * 0.6, r: w * 0.24 },
      { x: len * 0.65, y: w * 0.45, r: w * 0.22 },
      { x: len * 0.85, y: w * 0.55, r: w * 0.24 },
      { x: len * 0.72, y: 0, r: w * 0.2 }
    ];
    for (let b of bumps) {
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
  }

  drawMonsterMace(ctx, len, w) {
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = '#111318';

    ctx.fillStyle = '#44403c';
    ctx.fillRect(-6, -w * 0.2, len * 0.65, w * 0.4);
    ctx.strokeRect(-6, -w * 0.2, len * 0.65, w * 0.4);

    ctx.fillStyle = '#94a3b8';
    for (let side of [-1, 0, 1]) {
      const my = side * w * 0.8;
      ctx.beginPath();
      ctx.moveTo(len * 0.55, 0);
      ctx.quadraticCurveTo(len * 0.8, my * 1.5, len * 1.05, my);
      ctx.lineTo(len * 0.75, 0);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }

    ctx.fillStyle = '#f8fafc';
    const skulls = [
      { x: len * 0.75, y: -w * 0.55 },
      { x: len * 0.85, y: 0 },
      { x: len * 0.75, y: w * 0.55 }
    ];
    for (let s of skulls) {
      ctx.beginPath();
      ctx.arc(s.x, s.y, w * 0.35, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#0f172a';
      ctx.beginPath();
      ctx.arc(s.x + 1.5, s.y - 2.5, 2.2, 0, Math.PI * 2);
      ctx.arc(s.x + 1.5, s.y + 2.5, 2.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#f8fafc';
    }
  }

  drawKnightSword(ctx, len, w) {
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = '#111318';

    ctx.fillStyle = '#fbbf24';
    ctx.beginPath();
    ctx.arc(-7, 0, w * 0.28, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#78350f';
    ctx.fillRect(-5, -w * 0.16, len * 0.25, w * 0.32);

    ctx.fillStyle = '#fbbf24';
    ctx.beginPath();
    ctx.roundRect(len * 0.2, -w * 0.9, w * 0.32, w * 1.8, 4);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#ef4444';
    ctx.fillRect(len * 0.22, -w * 0.2, w * 0.28, w * 0.4);

    ctx.fillStyle = '#cbd5e1';
    ctx.beginPath();
    ctx.moveTo(len * 0.23, -w * 0.42);
    ctx.lineTo(len, 0);
    ctx.lineTo(len * 0.23, w * 0.42);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#60a5fa';
    ctx.fillRect(len * 0.26, -1.5, len * 0.6, 3);
  }

  drawDemonSword(ctx, len, w) {
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = '#050608';

    ctx.fillStyle = '#7f1d1d';
    ctx.fillRect(len * 0.15, -w * 0.85, w * 0.32, w * 1.7);
    ctx.strokeRect(len * 0.15, -w * 0.85, w * 0.32, w * 1.7);

    ctx.fillStyle = '#b91c1c';
    ctx.beginPath();
    ctx.moveTo(len * 0.18, 0);

    ctx.lineTo(len * 0.25, -w * 0.55);
    ctx.lineTo(len * 0.45, -w * 0.4);
    ctx.lineTo(len * 0.55, -w * 0.65);
    ctx.lineTo(len * 0.75, -w * 0.45);
    ctx.lineTo(len * 0.85, -w * 0.7);
    ctx.lineTo(len, 0);

    ctx.lineTo(len * 0.85, w * 0.7);
    ctx.lineTo(len * 0.75, w * 0.45);
    ctx.lineTo(len * 0.55, w * 0.65);
    ctx.lineTo(len * 0.45, w * 0.4);
    ctx.lineTo(len * 0.25, w * 0.55);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#18181b';
    ctx.fillRect(len * 0.2, -2.5, len * 0.7, 5);
  }

  drawWingedTitanSword(ctx, len, w) {
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = '#050608';

    ctx.fillStyle = '#fbbf24';
    ctx.beginPath();
    ctx.arc(-8, 0, w * 0.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#fbbf24';
    ctx.beginPath();
    ctx.moveTo(len * 0.18, 0);
    ctx.lineTo(len * 0.15, -w * 1.25);
    ctx.lineTo(len * 0.28, -w * 0.95);
    ctx.lineTo(len * 0.25, w * 0.95);
    ctx.lineTo(len * 0.15, w * 1.25);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#ef4444';
    ctx.beginPath();
    ctx.moveTo(len * 0.22, -w * 0.3);
    ctx.lineTo(len * 0.32, 0);
    ctx.lineTo(len * 0.22, w * 0.3);
    ctx.lineTo(len * 0.14, 0);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#e2e8f0';
    ctx.beginPath();
    ctx.moveTo(len * 0.25, -w * 0.55);

    ctx.lineTo(len * 0.5, -w * 0.55);
    ctx.lineTo(len * 0.55, -w * 0.3);
    ctx.lineTo(len * 0.6, -w * 0.55);

    ctx.lineTo(len * 0.8, -w * 0.55);
    ctx.lineTo(len * 0.85, -w * 0.35);
    ctx.lineTo(len * 0.9, -w * 0.55);

    ctx.lineTo(len, 0);

    ctx.lineTo(len * 0.9, w * 0.55);
    ctx.lineTo(len * 0.85, w * 0.35);
    ctx.lineTo(len * 0.8, w * 0.55);

    ctx.lineTo(len * 0.6, w * 0.55);
    ctx.lineTo(len * 0.55, w * 0.3);
    ctx.lineTo(len * 0.5, w * 0.55);

    ctx.lineTo(len * 0.25, w * 0.55);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = 'rgba(103, 232, 249, 0.4)';
    ctx.fillRect(len * 0.28, -w * 0.15, len * 0.6, w * 0.3);
  }

  // Draw Clean Streamer Player Name Tag & Mini HP Bar
  drawWarriorNameTag(ctx, wr, tier) {
    ctx.save();
    ctx.font = 'bold 12px "Outfit", "Be Vietnam Pro", sans-serif';
    ctx.textAlign = 'center';

    const tagY = wr.y + tier.bodyRadius + 20;

    // Name with sharp contrast outline
    ctx.fillStyle = '#050608';
    ctx.fillText(wr.name, wr.x + 1.2, tagY + 1.2);
    ctx.fillText(wr.name, wr.x - 1.2, tagY - 1.2);
    ctx.fillText(wr.name, wr.x + 1.2, tagY - 1.2);
    ctx.fillText(wr.name, wr.x - 1.2, tagY + 1.2);

    ctx.fillStyle = '#ffffff';
    ctx.fillText(wr.name, wr.x, tagY);

    ctx.restore();
  }

  // Draw Top Arena Status HUD (Living Count & Zone Status)
  drawStatusHUD(ctx, w) {
    const aliveCount = this.warriors.filter(wr => wr.alive).length;
    const total = this.warriors.length;

    const hudW = 420;
    const hudH = 38;
    const hudX = w / 2 - hudW / 2;
    const hudY = 16;

    ctx.save();
    ctx.fillStyle = 'rgba(10, 14, 23, 0.92)';
    ctx.beginPath();
    ctx.roundRect(hudX, hudY, hudW, hudH, 19);
    ctx.fill();

    const isShrinking = this.zoneState === 'shrinking';
    ctx.strokeStyle = isShrinking ? '#ef4444' : 'rgba(249, 115, 22, 0.5)';
    ctx.lineWidth = isShrinking ? 2.5 : 1.5;
    if (isShrinking) {
      ctx.shadowColor = '#dc2626';
      ctx.shadowBlur = 12;
    }
    ctx.stroke();

    ctx.font = 'bold 13.5px "Outfit", "Be Vietnam Pro", sans-serif';
    ctx.textAlign = 'center';

    // Alive Count & Zone Phase
    const zoneText = this.zoneHUDText || '🛡️ VÙNG AN TOÀN';
    ctx.fillStyle = '#ffffff';
    ctx.fillText(`⚔️ ${aliveCount}/${total} Sống Sót   |   ${zoneText}`, w / 2, hudY + 24);
    ctx.restore();
  }

  loop() {
    if (!this.isRunning) return;
    this.update();
    this.render();
    this.animId = requestAnimationFrame(() => this.loop());
  }
}

window.AxeBattle = AxeBattle;
