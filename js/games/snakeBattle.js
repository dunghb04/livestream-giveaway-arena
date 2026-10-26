// Mini-Game 3: Đại Chiến Rắn Săn Mồi (Snake Battle Royale - Slither Precision Edition)
class SnakeBattle {
  constructor(canvas, onLeaderboardUpdate, onFinishCallback) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.onLeaderboardUpdate = onLeaderboardUpdate;
    this.onFinishCallback = onFinishCallback;

    this.snakes = [];
    this.foods = [];
    this.largeOrbs = []; // Super orbs dropped by dead rival snakes
    this.particles = [];
    this.eliminatedSnakes = [];
    this.isRunning = false;
    this.isPaused = false;
    this.animId = null;

    this.targetDurationSec = 90; // Default: Strictly 1m30s
    this.initialZone = { x: 20, y: 20, width: 1200, height: 680, cornerRadius: 18 };
    this.currentZone = { ...this.initialZone };
    this.zoneState = 'safe';
    this.zoneHUDText = '🛡️ VÙNG AN TOÀN';
    this.matchTimer = 0;
    this.finishTriggered = false;
  }

  setPace(pace) {
    if (pace === '180s' || pace === '3m') {
      this.targetDurationSec = 180;
    } else if (pace === '90s' || pace === 'slow') {
      this.targetDurationSec = 90;
    } else if (pace === '60s' || pace === 'medium') {
      this.targetDurationSec = 60;
    } else {
      this.targetDurationSec = 45;
    }
  }

  getZoneClearance(px, py) {
    const z = this.currentZone;
    const cr = z.cornerRadius || 18;
    const cx = z.x + z.width / 2;
    const cy = z.y + z.height / 2;
    const hx = z.width / 2;
    const hy = z.height / 2;
    const dx = Math.abs(px - cx);
    const dy = Math.abs(py - cy);

    const qx = dx - (hx - cr);
    const qy = dy - (hy - cr);

    if (qx > 0 && qy > 0) {
      // In rounded corner region
      const distToCornerCenter = Math.hypot(qx, qy);
      return cr - distToCornerCenter;
    } else {
      // In rectangular cross region: true distance to edge is min(hx - dx, hy - dy)
      return Math.min(hx - dx, hy - dy);
    }
  }

  setup(playerNames) {
    this.stop();
    this.snakes = [];
    this.foods = [];
    this.largeOrbs = [];
    this.particles = [];
    this.eliminatedSnakes = [];
    this.isRunning = false;
    this.isPaused = false;
    this.matchTimer = 0;
    this.finishTriggered = false;

    // Full Rectangular Map covering the entire canvas
    const margin = 20;
    const canW = this.canvas.width || 1280;
    const canH = this.canvas.height || 720;
    this.initialZone = {
      x: margin,
      y: margin,
      width: Math.max(480, canW - margin * 2),
      height: Math.max(340, canH - margin * 2),
      cornerRadius: 18
    };
    this.currentZone = { ...this.initialZone };
    this.zoneState = 'safe';
    this.zoneHUDText = '🛡️ VÙNG AN TOÀN';

    const snakePalettes = [
      { body: '#10b981', head: '#34d399', glow: '#059669', spine: '#a7f3d0' },
      { body: '#06b6d4', head: '#38bdf8', glow: '#0284c7', spine: '#bae6fd' },
      { body: '#f59e0b', head: '#fbbf24', glow: '#d97706', spine: '#fef3c7' },
      { body: '#ec4899', head: '#f472b6', glow: '#db2777', spine: '#fbcfe8' },
      { body: '#8b5cf6', head: '#a78bfa', glow: '#7c3aed', spine: '#ede9fe' },
      { body: '#ef4444', head: '#f87171', glow: '#dc2626', spine: '#fee2e2' },
      { body: '#3b82f6', head: '#60a5fa', glow: '#2563eb', spine: '#dbeafe' },
      { body: '#84cc16', head: '#a3e635', glow: '#65a30d', spine: '#ecfccb' },
      { body: '#f97316', head: '#fb923c', glow: '#ea580c', spine: '#ffedd5' },
      { body: '#d946ef', head: '#e879f9', glow: '#c026d3', spine: '#fae8ff' }
    ];

    const centerX = this.canvas.width / 2;
    const centerY = this.canvas.height / 2;
    const count = playerNames.length;

    // Dispersed Grid Spawning across the spacious rectangular map
    const z = this.initialZone;
    const padX = 65;
    const padY = 50;
    const usableW = Math.max(200, z.width - padX * 2);
    const usableH = Math.max(200, z.height - padY * 2);
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
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        spawnSlots.push({
          x: z.x + padX + (c + 0.5) * cellW + (Math.random() - 0.5) * (cellW * 0.45),
          y: z.y + padY + (r + 0.5) * cellH + (Math.random() - 0.5) * (cellH * 0.45)
        });
      }
    }
    for (let i = spawnSlots.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [spawnSlots[i], spawnSlots[j]] = [spawnSlots[j], spawnSlots[i]];
    }

    const segSpacing = count <= 25 ? 9 : (count <= 50 ? 7.5 : 6.2);
    const snakeScale = count <= 25 ? 1.0 : (count <= 50 ? 0.85 : 0.72);

    this.snakes = playerNames.map((name, idx) => {
      const pos = spawnSlots[idx] || {
        x: z.x + padX + Math.random() * usableW,
        y: z.y + padY + Math.random() * usableH
      };

      const angleToCenter = Math.atan2(centerY - pos.y, centerX - pos.x);
      const facing = angleToCenter + (Math.random() - 0.5) * 0.8;

      const segLen = 5;
      const segments = [];
      for (let s = 0; s < segLen; s++) {
        segments.push({
          x: pos.x - Math.cos(facing) * s * segSpacing,
          y: pos.y - Math.sin(facing) * s * segSpacing
        });
      }

      return {
        id: idx,
        name: name,
        x: pos.x,
        y: pos.y,
        scale: snakeScale,
        segSpacing: segSpacing,
        angle: facing,
        targetAngle: facing,
        speed: (1.05 + Math.random() * 0.15) * (count > 50 ? 1.05 : 1.0),
        baseSpeed: (1.05 + Math.random() * 0.15) * (count > 50 ? 1.05 : 1.0),
        palette: snakePalettes[idx % snakePalettes.length],
        segments: segments,
        foodScore: 0,
        alive: true,
        immunityTimer: 300, // 5s grace shield: snakes scatter and eat food safely
        turnTimer: Math.floor(Math.random() * 15),
        tonguePhase: Math.random() * Math.PI,
        outOfZoneFrames: 0
      };
    });

    // Spawn initial small food pellets across arena
    const initialFood = Math.max(240, count * 14);
    for (let i = 0; i < initialFood; i++) {
      this.spawnSmallFood();
    }

    this.render();
  }

  spawnSmallFood(nearX, nearY) {
    const z = this.currentZone;
    let fx, fy;

    if (nearX !== undefined && nearY !== undefined) {
      fx = nearX + (Math.random() - 0.5) * 40;
      fy = nearY + (Math.random() - 0.5) * 40;
    } else {
      const pad = 35;
      fx = z.x + pad + Math.random() * Math.max(20, z.width - pad * 2);
      fy = z.y + pad + Math.random() * Math.max(20, z.height - pad * 2);
    }

    const cr = z.cornerRadius || 18;
    const innerMinX = z.x + cr;
    const innerMaxX = z.x + z.width - cr;
    const innerMinY = z.y + cr;
    const innerMaxY = z.y + z.height - cr;
    const clampX = Math.max(innerMinX, Math.min(innerMaxX, fx));
    const clampY = Math.max(innerMinY, Math.min(innerMaxY, fy));
    const d = Math.hypot(fx - clampX, fy - clampY);
    if (d > cr - 15) {
      const ang = Math.atan2(fy - clampY, fx - clampX);
      fx = clampX + Math.cos(ang) * Math.max(0, cr - 20);
      fy = clampY + Math.sin(ang) * Math.max(0, cr - 20);
    }

    const foodColors = ['#ffb703', '#00f0ff', '#ff007f', '#10b981', '#f59e0b', '#a855f7'];
    this.foods.push({
      x: fx,
      y: fy,
      size: 3.5 + Math.random() * 2,
      color: foodColors[Math.floor(Math.random() * foodColors.length)],
      pulse: Math.random() * Math.PI * 2
    });
  }

  spawnLargeOrb(x, y, color) {
    this.largeOrbs.push({
      x: x + (Math.random() - 0.5) * 16,
      y: y + (Math.random() - 0.5) * 16,
      size: 7 + Math.random() * 3,
      color: color,
      pulse: Math.random() * Math.PI * 2,
      life: 900 // remains on ground for other snakes to feast on
    });
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

  update() {
    if (!this.isRunning || this.isPaused) return;

    this.matchTimer++;
    const now = performance.now();
    const currentSec = (now - this.startTimestamp) / 1000;
    const totalSec = this.targetDurationSec || 90;
    const centerX = this.canvas.width / 2;
    const centerY = this.canvas.height / 2;

    // Safe grace period before bo starts constricting: 15s
    const safeSec = 15;
    let shrinkProgress = 0;
    if (currentSec > safeSec) {
      shrinkProgress = Math.min(1.0, (currentSec - safeSec) / (totalSec - safeSec));
    }

    const initW = this.initialZone.width;
    const initH = this.initialZone.height;
    const targetScale = 1.0 - shrinkProgress * 0.76;
    const finalCircleDiameter = Math.max(180, initH * 0.22);

    const curW = Math.max(finalCircleDiameter, (initW * targetScale) * (1 - shrinkProgress * 0.55) + finalCircleDiameter * (shrinkProgress * 0.55));
    const curH = Math.max(finalCircleDiameter, initH * targetScale);

    let finalW = curW;
    let finalH = curH;
    if (shrinkProgress > 0.82) {
      const circleD = Math.min(curW, curH);
      finalW = circleD;
      finalH = circleD;
    }

    const maxCR = Math.min(finalW, finalH) / 2;
    const curCR = Math.min(maxCR, 18 + (maxCR - 18) * Math.pow(shrinkProgress, 1.25));

    this.currentZone.x = centerX - finalW / 2;
    this.currentZone.y = centerY - finalH / 2;
    this.currentZone.width = finalW;
    this.currentZone.height = finalH;
    this.currentZone.cornerRadius = curCR;

    this.zoneState = shrinkProgress > 0 ? 'shrinking' : 'safe';
    if (shrinkProgress === 0) {
      const rem = Math.max(0, Math.ceil(safeSec - currentSec));
      this.zoneHUDText = `🛡️ VÙNG AN TOÀN (Bo thu sau: ${rem}s)`;
    } else if (shrinkProgress < 0.8) {
      const rem = Math.max(0, Math.ceil(totalSec - currentSec));
      this.zoneHUDText = `⚠️ ĐANG THU BO VÀO (${rem}s)`;
    } else {
      const rem = Math.max(0, Math.ceil(totalSec - currentSec));
      this.zoneHUDText = `🔥 BO TỬ THẦN - QUYẾT ĐẤU (${rem}s)`;
    }

    // Keep base food available
    if (this.foods.length < 70) {
      this.spawnSmallFood();
    }

    const aliveSnakes = this.snakes.filter(s => s.alive);

    // 1. Update Each Snake (Movement & AI)
    for (let s of aliveSnakes) {
      if (s.immunityTimer > 0) s.immunityTimer--;
      s.turnTimer--;
      s.tonguePhase += 0.08;

      // Smart Multi-Raycast Avoidance (5 feelers: -60°, -30°, 0°, +30°, +60°)
      const feelerAngles = [-1.0, -0.5, 0, 0.5, 1.0];
      const feelerDist = 58;
      let bestFeeler = 0;
      let maxClearance = -1;
      let forwardThreat = false;

      for (let fa of feelerAngles) {
        const testAngle = s.angle + fa;
        const testX = s.x + Math.cos(testAngle) * feelerDist;
        const testY = s.y + Math.sin(testAngle) * feelerDist;

        // Clearance from Wall (Morphing safe zone clearance)
        const wallDist = this.getZoneClearance(testX, testY);

        // Clearance from Other Snakes' bodies (AI actively avoids rivals at ALL times!)
        let minBodyDist = 999;
        for (let other of aliveSnakes) {
          const checkStep = other === s ? 6 : 2;
          for (let i = checkStep; i < other.segments.length; i += 2) {
            const seg = other.segments[i];
            const d = Math.hypot(testX - seg.x, testY - seg.y);
            if (d < minBodyDist) minBodyDist = d;
          }
        }

        // Overall clearance score for this angle
        const score = Math.min(wallDist, minBodyDist);
        if (fa === 0 && score < 28) {
          forwardThreat = true;
        }
        if (score > maxClearance) {
          maxClearance = score;
          bestFeeler = fa;
        }
      }

      if (forwardThreat) {
        // Hazard ahead! Steer sharply towards the safest feeler angle
        s.targetAngle = s.angle + bestFeeler * 1.35;
      } else {
        // Active food hunting: seek nearest food pellets or giant orbs
        if (s.turnTimer <= 0) {
          s.turnTimer = 14 + Math.floor(Math.random() * 20);

          let targetItem = null;
          let minDist = 300;

          // Check Giant Orbs first
          for (let orb of this.largeOrbs) {
            const d = Math.hypot(s.x - orb.x, s.y - orb.y);
            if (d < minDist * 1.5) {
              minDist = d;
              targetItem = orb;
            }
          }

          // Otherwise check small foods
          if (!targetItem) {
            for (let f of this.foods) {
              const d = Math.hypot(s.x - f.x, s.y - f.y);
              if (d < minDist) {
                minDist = d;
                targetItem = f;
              }
            }
          }

          if (targetItem) {
            s.targetAngle = Math.atan2(targetItem.y - s.y, targetItem.x - s.x);
          } else {
            // Natural serpentine wander
            s.targetAngle += (Math.random() - 0.5) * 0.45;
          }
        }
      }

      // Smooth turning towards target angle
      let diff = s.targetAngle - s.angle;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      s.angle += diff * 0.12;

      // Move Head
      s.x += Math.cos(s.angle) * s.speed;
      s.y += Math.sin(s.angle) * s.speed;

      // Inverse Kinematics Body Follow
      const segSpacing = 9;
      s.segments[0] = { x: s.x, y: s.y };

      for (let i = 1; i < s.segments.length; i++) {
        const prev = s.segments[i - 1];
        const curr = s.segments[i];
        const dx = prev.x - curr.x;
        const dy = prev.y - curr.y;
        const d = Math.hypot(dx, dy);

        if (d > segSpacing) {
          const factor = (d - segSpacing) / d;
          curr.x += dx * factor;
          curr.y += dy * factor;
        }
      }

      // 2. Eat Small Foods (2 foods = +1 segment)
      for (let i = this.foods.length - 1; i >= 0; i--) {
        const f = this.foods[i];
        if (Math.hypot(s.x - f.x, s.y - f.y) < 14) {
          this.foods.splice(i, 1);
          s.foodScore++;
          if (s.foodScore % 2 === 0) {
            const lastSeg = s.segments[s.segments.length - 1];
            s.segments.push({ x: lastSeg.x, y: lastSeg.y });
          }
          break;
        }
      }

      // 3. Eat Giant Orbs from Dead Rivals (+1 FULL segment per orb!)
      for (let i = this.largeOrbs.length - 1; i >= 0; i--) {
        const orb = this.largeOrbs[i];
        if (Math.hypot(s.x - orb.x, s.y - orb.y) < 18) {
          this.largeOrbs.splice(i, 1);
          // Instant growth from eating rival!
          const lastSeg = s.segments[s.segments.length - 1];
          s.segments.push({ x: lastSeg.x, y: lastSeg.y });
          s.foodScore += 3;
          if (Math.random() < 0.3 && window.soundFX) {
            window.soundFX.playBounce(600);
          }
          break;
        }
      }

      // 4. Wall Collision
      const clearance = this.getZoneClearance(s.x, s.y);
      if (clearance < 0) {
        s.outOfZoneFrames = (s.outOfZoneFrames || 0) + 1;
        const toCenterX = centerX - s.x;
        const toCenterY = centerY - s.y;
        const d = Math.hypot(toCenterX, toCenterY) || 1;
        s.x += (toCenterX / d) * 3.5;
        s.y += (toCenterY / d) * 3.5;
        if (s.outOfZoneFrames > 90) { // 1.5s in danger zone = eliminated
          this.killSnake(s);
          continue;
        }
      } else {
        s.outOfZoneFrames = 0;
      }

      // 5. Rival Collision
      for (let other of aliveSnakes) {
        if (!s.alive) break;
        if (other === s) continue;

        // Head and Body soft repulsion during immunity to prevent clumping/tangling
        if (s.immunityTimer > 0 || other.immunityTimer > 0) {
          const hDist = Math.hypot(s.x - other.x, s.y - other.y);
          if (hDist < 30) {
            const hAng = Math.atan2(s.y - other.y, s.x - other.x);
            s.x += Math.cos(hAng) * 2.2;
            s.y += Math.sin(hAng) * 2.2;
            other.x -= Math.cos(hAng) * 2.2;
            other.y -= Math.sin(hAng) * 2.2;
          }
          for (let i = 0; i < other.segments.length; i += 2) {
            const seg = other.segments[i];
            const segDist = Math.hypot(s.x - seg.x, s.y - seg.y);
            if (segDist < 25) {
              const bAng = Math.atan2(s.y - seg.y, s.x - seg.x);
              s.x += Math.cos(bAng) * 1.5;
              s.y += Math.sin(bAng) * 1.5;
            }
          }
          continue;
        }

        // Fatal collision against rival body
        for (let i = 0; i < other.segments.length; i++) {
          const seg = other.segments[i];
          if (Math.hypot(s.x - seg.x, s.y - seg.y) < 11.5) {
            this.killSnake(s);
            break;
          }
        }
      }
    }

    // Update Large Orbs life
    for (let i = this.largeOrbs.length - 1; i >= 0; i--) {
      this.largeOrbs[i].life--;
      if (this.largeOrbs[i].life <= 0) this.largeOrbs.splice(i, 1);
    }

    // Update Sparks
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.life -= 0.035;
      if (p.life <= 0) this.particles.splice(i, 1);
    }

    // Update Leaderboard
    const sorted = [...this.snakes].sort((a, b) => {
      if (a.alive !== b.alive) return b.alive ? 1 : -1;
      return b.segments.length - a.segments.length;
    });

    if (this.onLeaderboardUpdate) {
      this.onLeaderboardUpdate(
        sorted.map(s => ({
          name: s.name,
          progress: s.alive ? `Dài: ${s.segments.length}m` : 'Đã dừng bước ❌'
        }))
      );
    }

    // Check Match Finish (1 or 0 snake left)
    const remaining = this.snakes.filter(s => s.alive);
    if (remaining.length <= 1 && !this.finishTriggered) {
      this.finishTriggered = true;
      setTimeout(() => {
        this.stop();

        const podium = [];
        if (remaining.length === 1) {
          podium.push(remaining[0]);
        }
        for (let i = this.eliminatedSnakes.length - 1; i >= 0; i--) {
          if (podium.length < 3) {
            podium.push(this.eliminatedSnakes[i]);
          }
        }

        if (this.onFinishCallback) {
          this.onFinishCallback(podium);
        }
      }, 1200);
    }
  }

  killSnake(s) {
    if (!s.alive) return;
    s.alive = false;
    this.eliminatedSnakes.push(s);

    if (window.soundFX) window.soundFX.playBounce(350);

    // Dead snake bursts into Giant Glowing Orbs (Chiến lợi phẩm)
    for (let i = 0; i < s.segments.length; i++) {
      const seg = s.segments[i];
      this.spawnLargeOrb(seg.x, seg.y, s.palette.head);

      // Fireworks burst
      for (let k = 0; k < 2; k++) {
        const ang = Math.random() * Math.PI * 2;
        const spd = 1.5 + Math.random() * 3;
        this.particles.push({
          x: seg.x,
          y: seg.y,
          vx: Math.cos(ang) * spd,
          vy: Math.sin(ang) * spd,
          color: s.palette.head,
          life: 1.0
        });
      }
    }
  }

  render() {
    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;
    const centerX = w / 2;
    const centerY = h / 2;

    ctx.clearRect(0, 0, w, h);

    // 1. Dark Neon Arena Backdrop
    const bgGrad = ctx.createRadialGradient(centerX, centerY, 50, centerX, centerY, Math.max(w, h));
    bgGrad.addColorStop(0, '#090e1a');
    bgGrad.addColorStop(0.7, '#05070e');
    bgGrad.addColorStop(1, '#020306');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, w, h);

    // 2. High-Tech Hexagonal Grid Lines
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.035)';
    ctx.lineWidth = 1;
    const grid = 45;
    for (let x = 0; x < w; x += grid) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
    }
    for (let y = 0; y < h; y += grid) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }

    // 3. Danger Zone Outside Arena (Morphing square/rectangle to circle)
    const z = this.currentZone;
    const cr = z.cornerRadius || 18;
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, w, h);
    ctx.roundRect(z.x, z.y, z.width, z.height, cr);
    ctx.fillStyle = 'rgba(239, 68, 68, 0.25)';
    ctx.fill('evenodd');

    // Laser Boundary Line
    const pulse = 0.5 + Math.sin(this.matchTimer * 0.08) * 0.5;
    ctx.strokeStyle = this.zoneState === 'shrinking' ? '#ef4444' : '#f97316';
    ctx.lineWidth = this.zoneState === 'shrinking' ? 5 + pulse * 2 : 4;
    ctx.shadowColor = this.zoneState === 'shrinking' ? '#dc2626' : '#ea580c';
    ctx.shadowBlur = 16 + pulse * 6;
    ctx.beginPath();
    ctx.roundRect(z.x, z.y, z.width, z.height, cr);
    ctx.stroke();

    // Inner highlight line
    ctx.strokeStyle = 'rgba(254, 215, 170, 0.6)';
    ctx.lineWidth = 1.5;
    ctx.shadowBlur = 0;
    ctx.beginPath();
    ctx.roundRect(z.x + 2, z.y + 2, Math.max(0, z.width - 4), Math.max(0, z.height - 4), Math.max(0, cr - 2));
    ctx.stroke();

    // Corner brackets if rectangular, or circular glow ring if round
    const isRound = cr > z.height * 0.32;
    if (!isRound) {
      const cLen = Math.min(22, z.width * 0.1, z.height * 0.1);
      ctx.strokeStyle = '#fde047';
      ctx.lineWidth = 3;
      // Top-Left
      ctx.beginPath(); ctx.moveTo(z.x, z.y + cLen); ctx.lineTo(z.x, z.y); ctx.lineTo(z.x + cLen, z.y); ctx.stroke();
      // Top-Right
      ctx.beginPath(); ctx.moveTo(z.x + z.width - cLen, z.y); ctx.lineTo(z.x + z.width, z.y); ctx.lineTo(z.x + z.width, z.y + cLen); ctx.stroke();
      // Bottom-Left
      ctx.beginPath(); ctx.moveTo(z.x, z.y + z.height - cLen); ctx.lineTo(z.x, z.y + z.height); ctx.lineTo(z.x + cLen, z.y + z.height); ctx.stroke();
      // Bottom-Right
      ctx.beginPath(); ctx.moveTo(z.x + z.width - cLen, z.y + z.height); ctx.lineTo(z.x + z.width, z.y + z.height); ctx.lineTo(z.x + z.width, z.y + z.height - cLen); ctx.stroke();
    } else {
      const ringPulse = Math.sin(this.matchTimer * 0.12) * 3;
      ctx.strokeStyle = '#ef4444';
      ctx.lineWidth = 2.0;
      ctx.shadowColor = '#dc2626';
      ctx.shadowBlur = 14;
      ctx.beginPath();
      ctx.arc(z.x + z.width / 2, z.y + z.height / 2, Math.min(z.width, z.height) / 2 + 5 + ringPulse, 0, Math.PI * 2);
      ctx.stroke();
      ctx.shadowBlur = 0;
    }
    ctx.restore();

    // 4. Small Glowing Food Pellets
    for (let f of this.foods) {
      f.pulse += 0.05;
      const r = f.size + Math.sin(f.pulse) * 0.8;
      ctx.fillStyle = f.color;
      ctx.shadowColor = f.color;
      ctx.shadowBlur = 6;
      ctx.beginPath();
      ctx.arc(f.x, f.y, r, 0, Math.PI * 2);
      ctx.fill();
    }

    // 5. Giant Glowing Orbs (From Dead Rivals)
    for (let orb of this.largeOrbs) {
      orb.pulse += 0.08;
      const r = orb.size + Math.sin(orb.pulse) * 1.5;
      ctx.fillStyle = orb.color;
      ctx.shadowColor = orb.color;
      ctx.shadowBlur = 16;
      ctx.beginPath();
      ctx.arc(orb.x, orb.y, r, 0, Math.PI * 2);
      ctx.fill();

      // Inner sparkle
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(orb.x - 2, orb.y - 2, r * 0.4, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.shadowBlur = 0;

    // 6. Sparks / Particles
    for (let p of this.particles) {
      ctx.fillStyle = p.color;
      ctx.globalAlpha = p.life;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1.0;

    // 7. Draw Living Snakes
    const aliveSnakes = this.snakes.filter(s => s.alive);
    const leader = aliveSnakes.reduce((max, s) => (s.segments.length > (max?.segments.length || 0) ? s : max), null);

    for (let s of aliveSnakes) {
      this.drawSnake(ctx, s, s === leader && s.segments.length > 8);
    }

    // 8. Status HUD
    this.drawStatusHUD(ctx, w);
  }

  drawSnake(ctx, s, isLeader) {
    const segCount = s.segments.length;

    // Immunity Energy Forcefield Shield
    if (s.immunityTimer > 0) {
      const shieldPulse = Math.sin(s.immunityTimer * 0.15) * 2.5;
      ctx.save();
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.85)';
      ctx.lineWidth = 2.5;
      ctx.fillStyle = 'rgba(56, 189, 248, 0.12)';
      ctx.beginPath();
      ctx.arc(s.x, s.y, 22 + shieldPulse, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }

    // Draw Body Segments (from tail to head)
    for (let i = segCount - 1; i >= 0; i--) {
      const seg = s.segments[i];
      const baseRadius = Math.min(13, 8 + (segCount / 30) * 4) * (s.scale || 1.0);
      const ratio = 1 - (i / segCount) * 0.35;
      const radius = baseRadius * ratio;

      const segGrad = ctx.createRadialGradient(seg.x - 2, seg.y - 2, 1, seg.x, seg.y, radius);
      segGrad.addColorStop(0, '#ffffff');
      segGrad.addColorStop(0.3, s.palette.head);
      segGrad.addColorStop(1, s.palette.body);

      ctx.fillStyle = segGrad;
      ctx.beginPath();
      ctx.arc(seg.x, seg.y, radius, 0, Math.PI * 2);
      ctx.fill();

      // Glowing spine dot
      if (i % 2 === 0) {
        ctx.fillStyle = s.palette.spine;
        ctx.beginPath();
        ctx.arc(seg.x, seg.y, radius * 0.4, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Draw Head
    ctx.save();
    ctx.translate(s.x, s.y);
    ctx.rotate(s.angle);

    const headRadius = Math.min(15, 9.5 + (segCount / 30) * 4) * (s.scale || 1.0);

    // Glowing Head
    ctx.shadowColor = s.palette.glow;
    ctx.shadowBlur = 10;
    const headGrad = ctx.createRadialGradient(-2, -2, 2, 0, 0, headRadius);
    headGrad.addColorStop(0, '#ffffff');
    headGrad.addColorStop(0.4, s.palette.head);
    headGrad.addColorStop(1, s.palette.body);
    ctx.fillStyle = headGrad;
    ctx.beginPath();
    ctx.arc(0, 0, headRadius, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    // Expressive Eyes
    const eyeX = headRadius * 0.4;
    const eyeY = headRadius * 0.55;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(eyeX, -eyeY, headRadius * 0.32, 0, Math.PI * 2);
    ctx.arc(eyeX, eyeY, headRadius * 0.32, 0, Math.PI * 2);
    ctx.fill();

    // Pupils looking ahead
    ctx.fillStyle = '#0f172a';
    ctx.beginPath();
    ctx.arc(eyeX + 1.5, -eyeY, headRadius * 0.17, 0, Math.PI * 2);
    ctx.arc(eyeX + 1.5, eyeY, headRadius * 0.17, 0, Math.PI * 2);
    ctx.fill();

    // Tongue flickering
    if (Math.sin(s.tonguePhase) > 0.75) {
      ctx.strokeStyle = '#f43f5e';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(headRadius, 0);
      ctx.lineTo(headRadius + 5, 0);
      ctx.lineTo(headRadius + 8, -2);
      ctx.moveTo(headRadius + 5, 0);
      ctx.lineTo(headRadius + 8, 2);
      ctx.stroke();
    }

    // Crown for Leader
    if (isLeader) {
      ctx.fillStyle = '#fbbf24';
      ctx.shadowColor = '#f59e0b';
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.moveTo(-6, -headRadius - 3);
      ctx.lineTo(-4, -headRadius - 9);
      ctx.lineTo(0, -headRadius - 5);
      ctx.lineTo(4, -headRadius - 9);
      ctx.lineTo(6, -headRadius - 3);
      ctx.closePath();
      ctx.fill();
      ctx.shadowBlur = 0;
    }

    ctx.restore();

    // Frosted Pill Name Badge
    ctx.save();
    ctx.font = 'bold 12px "Outfit", "Be Vietnam Pro", sans-serif';
    const textW = ctx.measureText(s.name).width;

    ctx.fillStyle = 'rgba(11, 15, 25, 0.9)';
    ctx.beginPath();
    ctx.roundRect(s.x - textW / 2 - 6, s.y - 28, textW + 12, 17, 8);
    ctx.fill();
    ctx.strokeStyle = s.palette.head;
    ctx.lineWidth = 1.3;
    ctx.stroke();

    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.fillText(s.name, s.x, s.y - 15);
    ctx.restore();
  }

  drawStatusHUD(ctx, w) {
    const aliveCount = this.snakes.filter(s => s.alive).length;
    const total = this.snakes.length;

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

    const zoneText = this.zoneHUDText || '🛡️ VÙNG AN TOÀN';
    ctx.fillStyle = '#ffffff';
    ctx.fillText(`🐍 ${aliveCount}/${total} Còn Sống   |   ${zoneText}`, w / 2, hudY + 24);
    ctx.restore();
  }

  loop() {
    if (!this.isRunning) return;
    this.update();
    this.render();
    this.animId = requestAnimationFrame(() => this.loop());
  }
}

window.SnakeBattle = SnakeBattle;
