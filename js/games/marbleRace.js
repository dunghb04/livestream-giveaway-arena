// Mini-Game 2: Đua Bi Zíc-Zắc (Marble Plinko Race - Multi-Tier Cyber Arcade)
class MarbleRace {
  constructor(canvas, onLeaderboardUpdate, onFinishCallback) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.onLeaderboardUpdate = onLeaderboardUpdate;
    this.onFinishCallback = onFinishCallback;

    this.boardWidth = 1000;
    this.targetDurationSec = 90; // Default: Strictly 1m30s
    this.boardHeight = 9200; // Deep multi-stage tower
    this.cameraY = 0;
    this.subCamY = 0;
    this.densestPackCount = 0;
    this.directorMode = 'leader'; // 'leader' | 'pack'
    this.directorTimer = 0;
    this.marbles = [];
    this.pegs = [];
    this.bumpers = [];
    this.rotators = [];
    this.funnels = [];
    this.particles = [];
    this.finishMarbles = [];
    this.isRunning = false;
    this.isPaused = false;
    this.animId = null;
    this.raceStartTime = 0;
    this.finishTriggered = false;

    this.initBoardElements();
  }

  setPace(pace) {
    if (pace === '180s' || pace === '3m') {
      this.targetDurationSec = 180;
      this.boardHeight = 17500;
    } else if (pace === '90s' || pace === 'slow') {
      this.targetDurationSec = 90;
      this.boardHeight = 9200;
    } else if (pace === '60s' || pace === 'medium') {
      this.targetDurationSec = 60;
      this.boardHeight = 6500;
    } else {
      this.targetDurationSec = 45;
      this.boardHeight = 4800;
    }
    this.initBoardElements();
  }

  initBoardElements() {
    this.pegs = [];
    this.bumpers = [];
    this.rotators = [];
    this.funnels = [];

    const spacingY = 82;
    const spacingX = 60;
    const rows = Math.floor((this.boardHeight - 230) / spacingY);
    const bumperYList = [600, 1200, 2600, 3400, 5000, 5800, 7400, 8200];

    // 1. Grid of Uniform Staggered Neon Pegs (Classic Plinko Lattice)
    // Symmetrical about center x = 500, with at least 60px between ANY two adjacent pegs!
    // Absolutely NO twin pegs, NO tight gaps, ample clearance for all marbles!
    for (let r = 2; r < rows; r++) {
      const y = r * spacingY;
      const isOdd = (r % 2 === 1);

      // Row A (even): x = 140, 200, 260, 320, 380, 440, 500, 560, 620, 680, 740, 800, 860
      // Row B (odd):  x = 110, 170, 230, 290, 350, 410, 470, 530, 590, 650, 710, 770, 830, 890
      const startX = isOdd ? 110 : 140;
      const endX = isOdd ? 890 : 860;

      for (let x = startX; x <= endX + 1; x += spacingX) {
        // Leave clearance for rotating obstacles and center funnels
        if (y > 1800 && y < 2200 && Math.abs(x - 500) < 180) continue;
        if (y > 4200 && y < 4600 && Math.abs(x - 500) < 180) continue;
        if (y > 6600 && y < 7000 && Math.abs(x - 500) < 180) continue;

        // Leave clearance around forcefield bumpers so pegs don't wedge with bumpers
        const nearBumper = bumperYList.some(by => Math.abs(y - by) < 60 && (Math.abs(x - 280) < 55 || Math.abs(x - 720) < 55));
        if (nearBumper) continue;

        this.pegs.push({
          x: Math.round(x),
          y: y,
          radius: 7,
          hitPulse: 0
        });
      }
    }

    // 2. High-Tech Forcefield Bumpers
    for (let by of bumperYList) {
      if (by < this.boardHeight - 500) {
        this.bumpers.push({ x: 280, y: by, radius: 36, pulse: 0, color: '#ff007f' });
        this.bumpers.push({ x: 720, y: by, radius: 36, pulse: 0, color: '#00f0ff' });
      }
    }

    // 3. Central Funnel Chutes (Slow down and reshuffle pack)
    const funnelStages = [2000, 4400, 6800];
    for (let fy of funnelStages) {
      if (fy < this.boardHeight - 600) {
        this.funnels.push({ y: fy, width: 340 });
        this.rotators.push({
          x: 500,
          y: fy + 120,
          length: 160,
          angle: Math.random() * Math.PI,
          speed: 0.025
        });
      }
    }
  }

  setup(playerNames) {
    this.stop();
    this.cameraY = 0;
    this.subCamY = 0;
    this.densestPackCount = 0;
    this.directorMode = 'leader';
    this.directorTimer = 0;
    this.finishMarbles = [];
    this.particles = [];
    this.isRunning = false;
    this.isPaused = false;
    this.finishTriggered = false;

    const marblePalettes = [
      { core: '#ff007f', glow: 'rgba(255, 0, 127, 0.4)' },
      { core: '#00f0ff', glow: 'rgba(0, 240, 255, 0.4)' },
      { core: '#ffb703', glow: 'rgba(255, 183, 3, 0.4)' },
      { core: '#10b981', glow: 'rgba(16, 185, 129, 0.4)' },
      { core: '#8b5cf6', glow: 'rgba(139, 92, 246, 0.4)' },
      { core: '#f43f5e', glow: 'rgba(244, 63, 94, 0.4)' },
      { core: '#38bdf8', glow: 'rgba(56, 189, 248, 0.4)' },
      { core: '#fbbf24', glow: 'rgba(251, 191, 36, 0.4)' },
      { core: '#a855f7', glow: 'rgba(168, 85, 247, 0.4)' },
      { core: '#ec4899', glow: 'rgba(236, 72, 153, 0.4)' }
    ];

    const count = playerNames.length;
    const marbleRadius = count <= 25 ? 13 : (count <= 50 ? 9.5 : 7.2);

    const cols = count <= 15 ? count : Math.min(18, Math.max(8, Math.floor(Math.sqrt(count * 2.6))));
    const startX = 260;
    const endX = 740;
    const stepX = (endX - startX) / Math.max(1, cols - 1);

    this.marbles = playerNames.map((name, idx) => {
      const palette = marblePalettes[idx % marblePalettes.length];
      const col = idx % cols;
      const row = Math.floor(idx / cols);
      return {
        id: idx,
        name: name,
        x: startX + col * stepX + (Math.random() - 0.5) * 6,
        y: 40 + row * (marbleRadius * 2.3),
        vx: (Math.random() - 0.5) * 1.5,
        vy: 0.2 + Math.random() * 0.2,
        radius: marbleRadius,
        palette: palette,
        finished: false,
        finishRank: 0,
        stuckTimer: 0,
        trail: []
      };
    });

    this.render();
  }

  start() {
    if (this.isRunning) return;
    this.isRunning = true;
    this.isPaused = false;
    this.raceStartTime = performance.now();
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

    // Gravity calibrated to finish smoothly at ~targetDurationSec
    const gravity = 0.095;
    const friction = 0.992;
    const bounceFriction = 0.65;
    const finishLineY = this.boardHeight - 200;

    // 1. Update Rotators
    for (let rot of this.rotators) {
      rot.angle += rot.speed;
    }

    // 2. Update Bumpers pulse
    for (let b of this.bumpers) {
      if (b.pulse > 0) b.pulse -= 0.04;
    }

    // 3. Update Pegs hit pulse
    for (let peg of this.pegs) {
      if (peg.hitPulse > 0) peg.hitPulse -= 0.05;
    }

    // 4. Update Marbles
    for (let m of this.marbles) {
      if (m.finished) continue;

      m.vy += gravity;
      m.vx *= friction;
      m.vy *= friction;

      // Terminal descent speed to preserve 90s pacing
      if (m.vy > 4.2) m.vy = 4.2;

      m.x += m.vx;
      m.y += m.vy;

      // Wall boundaries (firm inward rebound push to completely prevent edge sliding)
      const leftBound = 85 + m.radius;
      const rightBound = this.boardWidth - 85 - m.radius;
      if (m.x < leftBound) {
        m.x = leftBound;
        m.vx = Math.abs(m.vx) * bounceFriction + 1.2;
      } else if (m.x > rightBound) {
        m.x = rightBound;
        m.vx = -Math.abs(m.vx) * bounceFriction - 1.2;
      }

      // Anti-stuck detection: monitor actual downward progress over time
      if (!m.anchorY) {
        m.anchorY = m.y;
        m.progressTimer = 0;
      }
      m.progressTimer = (m.progressTimer || 0) + 1;
      if (m.progressTimer >= 45) { // every ~0.75s
        const dyProgress = m.y - m.anchorY;
        if (dyProgress < 15) { // If marble has not advanced at least 15px down
          m.stuckTimer = 55; // Flags for sub-camera if lagging behind
          // Powerful unstick burst away from nearest obstacle
          const kickDir = (m.x > 500) ? -1 : 1;
          m.vx = kickDir * (2.8 + Math.random() * 2.2);
          m.vy = 3.4 + Math.random() * 1.5;
          m.y += 3;
        } else {
          m.stuckTimer = 0;
        }
        m.anchorY = m.y;
        m.progressTimer = 0;
      }

      // Funnel Guides (guide marbles smoothly towards center funnel chutes)
      for (let f of this.funnels) {
        if (m.y >= f.y && m.y <= f.y + 160) {
          const ratio = (m.y - f.y) / 160;
          const funnelRadius = (this.boardWidth - 170) / 2 * (1 - ratio * 0.7);
          const distFromCenter = m.x - 500;
          if (Math.abs(distFromCenter) > funnelRadius) {
            m.x = 500 + Math.sign(distFromCenter) * funnelRadius;
            m.vx = -Math.sign(distFromCenter) * (1.2 + Math.abs(m.vx) * 0.4);
            m.vy = Math.max(m.vy, 2.0); // Never get stuck on funnel slide!
          }
        }
      }

      // Collision with Pegs
      for (let peg of this.pegs) {
        // Fast bounding box check
        if (Math.abs(m.y - peg.y) > 22 || Math.abs(m.x - peg.x) > 22) continue;

        const dx = m.x - peg.x;
        const dy = m.y - peg.y;
        const dist = Math.hypot(dx, dy);
        const minDist = m.radius + peg.radius;

        if (dist < minDist) {
          const nx = dx / (dist || 1);
          const ny = dy / (dist || 1);

          m.x = peg.x + nx * minDist;
          m.y = peg.y + ny * minDist;

          const dot = m.vx * nx + m.vy * ny;
          m.vx = (m.vx - 2 * dot * nx) * bounceFriction + (Math.random() - 0.5) * 1.2;
          m.vy = (m.vy - 2 * dot * ny) * bounceFriction;

          // Immediately deflect off if hitting upper half of peg
          if (ny < -0.5) {
            m.vx += (nx >= 0 ? 1 : -1) * (1.6 + Math.random() * 1.0);
          }

          peg.hitPulse = 1;

          if (Math.random() < 0.15 && window.soundFX) {
            window.soundFX.playBounce(650 + Math.random() * 350);
          }
        }
      }

      // Collision with Bumpers (Mega Ricochet)
      for (let b of this.bumpers) {
        if (Math.abs(m.y - b.y) > 55 || Math.abs(m.x - b.x) > 55) continue;
        const dx = m.x - b.x;
        const dy = m.y - b.y;
        const dist = Math.hypot(dx, dy);
        const minDist = m.radius + b.radius;

        if (dist < minDist) {
          const nx = dx / (dist || 1);
          const ny = dy / (dist || 1);
          m.x = b.x + nx * minDist;
          m.y = b.y + ny * minDist;
          m.vx = nx * 7 + (Math.random() - 0.5) * 2;
          m.vy = ny * 7;
          b.pulse = 1;

          this.createSparks(m.x, m.y, b.color);
          if (window.soundFX) window.soundFX.playBounce(440);
        }
      }

      // Trail
      if (Math.random() < 0.4) {
        m.trail.push({ x: m.x, y: m.y, alpha: 0.5 });
      }

      // Check Finish
      if (m.y >= finishLineY && !m.finished) {
        m.finished = true;
        this.finishMarbles.push(m);
        m.finishRank = this.finishMarbles.length;

        if (this.finishMarbles.length === 1 && window.soundFX) {
          window.soundFX.playBounce(950);
        }
      }
    }

    // Update trails & sparks
    for (let m of this.marbles) {
      for (let i = m.trail.length - 1; i >= 0; i--) {
        m.trail[i].alpha -= 0.03;
        if (m.trail[i].alpha <= 0) m.trail.splice(i, 1);
      }
    }

    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.life -= 0.04;
      if (p.life <= 0) this.particles.splice(i, 1);
    }

    // =========================================================================
    // INTELLIGENT DUAL-CAMERA DIRECTOR SYSTEM
    // 1. Leader Camera: tracks the race leader!
    // 2. Sub-Camera (Camera Phụ): mathematically scans and locks onto the
    //    DENSEST CLUSTER of trailing marbles (nơi có nhiều người nhất).
    // 3. Auto Director Switching: dynamically alternates between Leader & Pack.
    // 4. Final Sprint Lock: when leader reaches > 72% of course, director
    //    STRICTLY LOCKS to Leader & Finish Line for the dramatic Top 1 climax!
    // =========================================================================
    const activeMarbles = this.marbles.filter(m => !m.finished);
    const sortedByY = [...activeMarbles].sort((a, b) => b.y - a.y);

    let leaderY = 0;
    let densestPackY = 0;
    let maxMarblesInWindow = 0;

    if (sortedByY.length === 0) {
      leaderY = Math.max(...this.marbles.map(m => m.y));
      densestPackY = leaderY;
      this.densestPackCount = 0;
    } else {
      leaderY = sortedByY[0].y;

      // Trailing marbles behind the leader
      const trailingMarbles = (sortedByY.length > 2 && (sortedByY[0].y - sortedByY[1].y > 350))
        ? sortedByY.slice(1)
        : sortedByY;

      // Active journey racers: marbles not stuck for > 50 frames (~0.85s)
      const activeJourneyMarbles = trailingMarbles.filter(m => (m.stuckTimer || 0) < 50);

      // If active journey racers exist, focus on them; otherwise fallback to trailingMarbles.
      // This ensures if someone gets stuck, the camera films them for a brief moment (~1s "quay 1 chút")
      // then seamlessly transitions downward to follow the active pack continuing the journey!
      const targetMarbles = (activeJourneyMarbles.length >= 1) ? activeJourneyMarbles : trailingMarbles;

      const windowH = 550;
      if (targetMarbles.length === 1) {
        densestPackY = targetMarbles[0].y;
        maxMarblesInWindow = 1;
        this.densestPackCount = 1;
      } else {
        const minY = targetMarbles[targetMarbles.length - 1].y;
        const maxY = targetMarbles[0].y;

        for (let testY = minY; testY <= maxY; testY += 50) {
          let score = 0;
          let count = 0;
          for (let m of targetMarbles) {
            if (m.y >= testY && m.y <= testY + windowH) {
              count++;
              const isMoving = m.vy > 0.6 || Math.abs(m.vx) > 0.5;
              score += isMoving ? 1.5 : ((m.stuckTimer || 0) > 25 ? 0.4 : 1.0);
            }
          }
          if (score > maxMarblesInWindow) {
            maxMarblesInWindow = score;
            densestPackY = testY + windowH / 2;
            this.densestPackCount = count;
          }
        }
      }
    }

    const isNearFinish = leaderY >= finishLineY * 0.72;

    // =========================================================================
    // DUAL-CAMERA FIXED ROLES (Không hoán đổi lộn xộn để tránh chóng mặt):
    // 1. MÀN HÌNH TO (Cam chính): LUÔN LUÔN bám sát Người Dẫn Đầu!
    // 2. MÀN HÌNH NHỎ (Cam phụ PiP góc dưới phải): Theo dõi đoàn bám đuổi / người đang tiếp tục hành trình!
    // =========================================================================
    const targetMainCamY = Math.max(0, Math.min(this.boardHeight - this.canvas.height, leaderY - this.canvas.height * 0.35));
    this.cameraY += (targetMainCamY - this.cameraY) * 0.08;

    let targetSubCamY = Math.max(0, Math.min(this.boardHeight - 300, densestPackY));
    this.subCamY += (targetSubCamY - this.subCamY) * 0.08;

    // Leaderboard update
    const sorted = [...this.marbles].sort((a, b) => b.y - a.y);
    if (this.onLeaderboardUpdate) {
      this.onLeaderboardUpdate(
        sorted.map(m => ({
          name: m.name,
          progress: Math.min(100, Math.round((m.y / finishLineY) * 100))
        }))
      );
    }

    // Check race finish
    if (this.finishMarbles.length >= Math.min(3, this.marbles.length) && !this.finishTriggered) {
      this.finishTriggered = true;
      setTimeout(() => {
        this.stop();
        if (this.onFinishCallback) {
          this.onFinishCallback(this.finishMarbles);
        }
      }, 1500);
    }
  }

  createSparks(x, y, color) {
    for (let i = 0; i < 8; i++) {
      const angle = Math.random() * Math.PI * 2;
      const spd = 2 + Math.random() * 3;
      this.particles.push({
        x: x,
        y: y,
        vx: Math.cos(angle) * spd,
        vy: Math.sin(angle) * spd,
        color: color,
        life: 1.0
      });
    }
  }

  render() {
    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;

    ctx.clearRect(0, 0, w, h);

    const scale = w / this.boardWidth;

    ctx.save();
    ctx.scale(scale, scale);
    ctx.translate(0, -this.cameraY);

    // 1. Cyberpunk Backdrop
    const boardGrad = ctx.createLinearGradient(0, 0, 0, this.boardHeight);
    boardGrad.addColorStop(0, '#09071c');
    boardGrad.addColorStop(0.35, '#160d3b');
    boardGrad.addColorStop(0.7, '#0d133b');
    boardGrad.addColorStop(1, '#050714');
    ctx.fillStyle = boardGrad;
    ctx.fillRect(0, 0, this.boardWidth, this.boardHeight);

    // Subtle Hex Background Matrix Lines
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.03)';
    ctx.lineWidth = 1;
    for (let y = 0; y < this.boardHeight; y += 120) {
      ctx.beginPath();
      ctx.moveTo(80, y);
      ctx.lineTo(this.boardWidth - 80, y);
      ctx.stroke();
    }

    // 2. Neon Walls with Electric Glow
    ctx.strokeStyle = '#00f0ff';
    ctx.lineWidth = 6;
    ctx.shadowColor = '#00f0ff';
    ctx.shadowBlur = 14;

    ctx.beginPath();
    ctx.moveTo(85, 0);
    ctx.lineTo(85, this.boardHeight - 200);
    ctx.lineTo(380, this.boardHeight);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(this.boardWidth - 85, 0);
    ctx.lineTo(this.boardWidth - 85, this.boardHeight - 200);
    ctx.lineTo(this.boardWidth - 380, this.boardHeight);
    ctx.stroke();
    ctx.shadowBlur = 0;

    // 3. Neon Pegs
    for (let peg of this.pegs) {
      if (peg.hitPulse > 0) {
        ctx.fillStyle = '#00f0ff';
        ctx.shadowColor = '#00f0ff';
        ctx.shadowBlur = 12;
      } else {
        ctx.fillStyle = '#cbd5e1';
        ctx.shadowBlur = 0;
      }

      ctx.beginPath();
      ctx.arc(peg.x, peg.y, peg.radius + peg.hitPulse * 2, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(peg.x - 2, peg.y - 2, peg.radius * 0.4, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.shadowBlur = 0;

    // 4. Forcefield Bumpers
    for (let b of this.bumpers) {
      ctx.save();
      ctx.fillStyle = b.color;
      ctx.shadowColor = b.color;
      ctx.shadowBlur = b.pulse > 0 ? 30 : 12;

      ctx.beginPath();
      ctx.arc(b.x, b.y, b.radius + b.pulse * 5, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.radius * 0.45, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // 5. Funnel Guide Chutes
    for (let f of this.funnels) {
      ctx.strokeStyle = 'rgba(255, 183, 3, 0.4)';
      ctx.lineWidth = 3;
      ctx.setLineDash([8, 8]);
      ctx.beginPath();
      ctx.moveTo(85, f.y);
      ctx.lineTo(500 - f.width / 2, f.y + 160);
      ctx.moveTo(this.boardWidth - 85, f.y);
      ctx.lineTo(500 + f.width / 2, f.y + 160);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // 6. Rotating Obstacles
    for (let rot of this.rotators) {
      ctx.save();
      ctx.translate(rot.x, rot.y);
      ctx.rotate(rot.angle);

      ctx.fillStyle = '#ffb703';
      ctx.shadowColor = '#fb8500';
      ctx.shadowBlur = 12;
      ctx.beginPath();
      ctx.roundRect(-rot.length / 2, -6, rot.length, 12, 6);
      ctx.fill();

      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(0, 0, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // 7. Sparks
    for (let p of this.particles) {
      ctx.fillStyle = p.color;
      ctx.globalAlpha = p.life;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // 8. Marbles (3D Glass Sphere Rendering)
    for (let m of this.marbles) {
      this.drawMarble(ctx, m);
    }

    // 9. Finish Chute
    this.drawFinishZone(ctx);

    ctx.restore();

    // 10. Intelligent Dual-Camera Director HUD & Sub-Camera PiP
    const finishLineY = this.boardHeight - 200;
    const sortedByY = [...this.marbles].filter(m => !m.finished).sort((a, b) => b.y - a.y);
    const leaderY = sortedByY.length > 0 ? sortedByY[0].y : 0;
    const isNearFinish = leaderY >= finishLineY * 0.72;

    this.drawDirectorBadge(ctx, w, isNearFinish);
    this.drawSubCameraPiP(ctx, w, h, isNearFinish);
  }

  drawDirectorBadge(ctx, w, isNearFinish) {
    ctx.save();
    let text = '';
    let dotColor = '#00f0ff';
    let borderColor = 'rgba(0, 240, 255, 0.4)';
    let bgGradColor = 'rgba(0, 240, 255, 0.12)';

    if (isNearFinish) {
      text = '🏁 GIAI ĐOẠN NƯỚC RÚT: KHÓA CAM TOP 1';
      dotColor = '#ffb703';
      borderColor = 'rgba(255, 183, 3, 0.6)';
      bgGradColor = 'rgba(255, 183, 3, 0.18)';
    } else {
      text = '👑 CAM CHÍNH: TỐP DẪN ĐẦU';
      dotColor = '#00f0ff';
      borderColor = 'rgba(0, 240, 255, 0.4)';
      bgGradColor = 'rgba(0, 240, 255, 0.12)';
    }

    ctx.font = 'bold 13px "Outfit", sans-serif';
    const textW = ctx.measureText(text).width;
    const badgeW = textW + 46;
    const badgeH = 30;
    const badgeX = (w - badgeW) / 2;
    const badgeY = 16;

    // Badge capsule
    ctx.fillStyle = 'rgba(9, 12, 22, 0.85)';
    ctx.beginPath();
    ctx.roundRect(badgeX, badgeY, badgeW, badgeH, 15);
    ctx.fill();

    ctx.fillStyle = bgGradColor;
    ctx.beginPath();
    ctx.roundRect(badgeX, badgeY, badgeW, badgeH, 15);
    ctx.fill();

    ctx.strokeStyle = borderColor;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Pulsing live dot
    const pulseAlpha = 0.5 + 0.5 * Math.sin(Date.now() / 200);
    ctx.fillStyle = dotColor;
    ctx.globalAlpha = pulseAlpha;
    ctx.beginPath();
    ctx.arc(badgeX + 18, badgeY + badgeH / 2, 4.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;

    // Text
    ctx.fillStyle = '#f8fafc';
    ctx.textAlign = 'left';
    ctx.fillText(text, badgeX + 30, badgeY + badgeH / 2 + 4.5);

    ctx.restore();
  }

  drawSubCameraPiP(ctx, w, h, isNearFinish) {
    // Only render PiP if race has active marbles
    const activeMarbles = this.marbles.filter(m => !m.finished);
    if (activeMarbles.length === 0) return;

    ctx.save();

    // PiP Dimensions (Bottom Right)
    const pipW = Math.min(270, w * 0.32);
    const pipH = 175;
    const pipX = w - pipW - 18;
    const pipY = h - pipH - 20;

    // Sub-cam title and accent color: focuses on trailing pack & active journey racers
    const hasStuckWait = this.marbles.some(m => !m.finished && (m.stuckTimer || 0) > 15 && (m.stuckTimer || 0) < 50);
    const pipTitle = isNearFinish
      ? `🎥 CAM PHỤ: BÁM ĐUỔI VỀ ĐÍCH (${this.densestPackCount} BI)`
      : (hasStuckWait
          ? `🎥 CAM PHỤ: CHỜ VƯỢT CHƯỚNG NGẠI (${this.densestPackCount} BI)`
          : `🎥 CAM PHỤ: THEO DÕI HÀNH TRÌNH (${this.densestPackCount} BI)`);
    const pipAccent = isNearFinish ? '#ffb703' : '#fb8500';

    // Outer Glow & Shadow
    ctx.shadowColor = pipAccent;
    ctx.shadowBlur = 14;
    ctx.fillStyle = 'rgba(7, 10, 20, 0.95)';
    ctx.beginPath();
    ctx.roundRect(pipX, pipY, pipW, pipH, 12);
    ctx.fill();
    ctx.shadowBlur = 0;

    // Clip internal feed to the rounded frame
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(pipX, pipY, pipW, pipH, 12);
    ctx.clip();

    // Backdrop inside feed
    ctx.fillStyle = '#0b0c1e';
    ctx.fillRect(pipX, pipY, pipW, pipH);

    // Coordinate mapping into the board
    const pipScale = pipW / this.boardWidth;
    const visibleBoardH = pipH / pipScale;
    const pipTopBoardY = Math.max(0, Math.min(this.boardHeight - visibleBoardH, this.subCamY - visibleBoardH * 0.45));

    ctx.save();
    ctx.translate(pipX, pipY);
    ctx.scale(pipScale, pipScale);
    ctx.translate(0, -pipTopBoardY);

    // Draw neon background grid lines in PiP
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.04)';
    ctx.lineWidth = 2;
    for (let y = Math.floor(pipTopBoardY / 100) * 100; y <= pipTopBoardY + visibleBoardH + 100; y += 100) {
      ctx.beginPath();
      ctx.moveTo(85, y);
      ctx.lineTo(this.boardWidth - 85, y);
      ctx.stroke();
    }

    // Draw outer guide walls in PiP
    ctx.strokeStyle = 'rgba(0, 240, 255, 0.35)';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(85, pipTopBoardY - 20);
    ctx.lineTo(85, pipTopBoardY + visibleBoardH + 20);
    ctx.moveTo(this.boardWidth - 85, pipTopBoardY - 20);
    ctx.lineTo(this.boardWidth - 85, pipTopBoardY + visibleBoardH + 20);
    ctx.stroke();

    // Draw pegs in PiP view
    for (let peg of this.pegs) {
      if (peg.y >= pipTopBoardY - 20 && peg.y <= pipTopBoardY + visibleBoardH + 20) {
        ctx.fillStyle = '#94a3b8';
        ctx.beginPath();
        ctx.arc(peg.x, peg.y, peg.radius, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Draw bumpers in PiP view
    for (let b of this.bumpers) {
      if (b.y >= pipTopBoardY - 50 && b.y <= pipTopBoardY + visibleBoardH + 50) {
        ctx.fillStyle = b.color;
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.radius, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Draw marbles in PiP view
    for (let m of this.marbles) {
      if (m.y >= pipTopBoardY - 40 && m.y <= pipTopBoardY + visibleBoardH + 40) {
        this.drawMarble(ctx, m);
      }
    }

    ctx.restore(); // Restore PiP board transform

    // Subtle TV scanlines overlay inside PiP
    ctx.fillStyle = 'rgba(0, 0, 0, 0.18)';
    for (let sy = pipY; sy < pipY + pipH; sy += 4) {
      ctx.fillRect(pipX, sy, pipW, 1.5);
    }

    // Header bar inside PiP
    ctx.fillStyle = 'rgba(9, 12, 22, 0.88)';
    ctx.fillRect(pipX, pipY, pipW, 26);

    // Live dot in PiP header
    const dotBlink = 0.6 + 0.4 * Math.sin(Date.now() / 180);
    ctx.fillStyle = '#ef4444';
    ctx.globalAlpha = dotBlink;
    ctx.beginPath();
    ctx.arc(pipX + 14, pipY + 13, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;

    // Header label
    ctx.font = 'bold 11px "Outfit", sans-serif';
    ctx.fillStyle = '#f1f5f9';
    ctx.textAlign = 'left';
    ctx.fillText(pipTitle, pipX + 24, pipY + 17);

    ctx.restore(); // Restore PiP clipping

    // Outer neon border around PiP
    ctx.strokeStyle = pipAccent;
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.roundRect(pipX, pipY, pipW, pipH, 12);
    ctx.stroke();

    ctx.restore();
  }

  drawMarble(ctx, m) {
    ctx.save();
    ctx.translate(m.x, m.y);

    // Motion Trail
    for (let tr of m.trail) {
      ctx.fillStyle = m.palette.glow;
      ctx.beginPath();
      ctx.arc(tr.x - m.x, tr.y - m.y, m.radius * 0.7, 0, Math.PI * 2);
      ctx.fill();
    }

    // 3D Sphere Radial Gradient
    const sphereGrad = ctx.createRadialGradient(
      -m.radius * 0.35, -m.radius * 0.35, 2,
      0, 0, m.radius
    );
    sphereGrad.addColorStop(0, '#ffffff');
    sphereGrad.addColorStop(0.3, m.palette.core);
    sphereGrad.addColorStop(1, '#0f172a');

    ctx.shadowColor = m.palette.core;
    ctx.shadowBlur = 12;
    ctx.fillStyle = sphereGrad;
    ctx.beginPath();
    ctx.arc(0, 0, m.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    // Specular Highlight
    ctx.fillStyle = 'rgba(255, 255, 255, 0.75)';
    ctx.beginPath();
    ctx.arc(-m.radius * 0.35, -m.radius * 0.35, m.radius * 0.35, 0, Math.PI * 2);
    ctx.fill();

    // Frosted Pill Name Badge
    ctx.font = 'bold 12px "Outfit", sans-serif';
    const textW = ctx.measureText(m.name).width;

    ctx.fillStyle = 'rgba(11, 15, 25, 0.9)';
    ctx.beginPath();
    ctx.roundRect(-textW / 2 - 5, -m.radius - 23, textW + 10, 17, 8);
    ctx.fill();
    ctx.strokeStyle = m.palette.core;
    ctx.lineWidth = 1.3;
    ctx.stroke();

    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.fillText(m.name, 0, -m.radius - 10);

    ctx.restore();
  }

  drawFinishZone(ctx) {
    const finishY = this.boardHeight - 200;

    ctx.fillStyle = 'rgba(255, 183, 3, 0.15)';
    ctx.fillRect(85, finishY, this.boardWidth - 170, 200);

    ctx.fillStyle = '#ffb703';
    ctx.shadowColor = '#fb8500';
    ctx.shadowBlur = 18;
    ctx.font = '900 32px "Outfit", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('🏆 VẠCH ĐÍCH CHIẾN THẮNG 🏆', this.boardWidth / 2, finishY + 45);
    ctx.shadowBlur = 0;
  }

  loop() {
    if (!this.isRunning) return;
    this.update();
    this.render();
    this.animId = requestAnimationFrame(() => this.loop());
  }
}

window.MarbleRace = MarbleRace;
