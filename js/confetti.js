// Confetti particle system for winner celebration
class ConfettiEffect {
  constructor(canvasId) {
    this.canvas = document.getElementById(canvasId);
    this.ctx = this.canvas ? this.canvas.getContext('2d') : null;
    this.particles = [];
    this.active = false;
    this.animId = null;

    window.addEventListener('resize', () => this.resize());
    this.resize();
  }

  resize() {
    if (!this.canvas) return;
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
  }

  start() {
    if (!this.canvas || !this.ctx) return;
    this.resize();
    this.particles = [];
    this.active = true;

    const colors = ['#ffb703', '#fb8500', '#00f0ff', '#ff007f', '#10b981', '#ffffff', '#8b5cf6'];

    for (let i = 0; i < 220; i++) {
      this.particles.push({
        x: Math.random() * this.canvas.width,
        y: -20 - Math.random() * 200,
        w: 8 + Math.random() * 10,
        h: 6 + Math.random() * 8,
        color: colors[Math.floor(Math.random() * colors.length)],
        vx: (Math.random() - 0.5) * 6,
        vy: 3 + Math.random() * 7,
        rot: Math.random() * 360,
        vRot: (Math.random() - 0.5) * 12,
        wobble: Math.random() * Math.PI,
        wobbleSpeed: 0.05 + Math.random() * 0.1
      });
    }

    if (!this.animId) {
      this.loop();
    }
  }

  stop() {
    this.active = false;
    if (this.ctx && this.canvas) {
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }
  }

  loop() {
    if (!this.active) {
      this.animId = null;
      return;
    }

    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    for (let p of this.particles) {
      p.x += p.vx + Math.sin(p.wobble) * 2;
      p.y += p.vy;
      p.rot += p.vRot;
      p.wobble += p.wobbleSpeed;

      // Wrap around top if needed or keep falling
      if (p.y > this.canvas.height + 20) {
        p.y = -20;
        p.x = Math.random() * this.canvas.width;
      }

      this.ctx.save();
      this.ctx.translate(p.x, p.y);
      this.ctx.rotate((p.rot * Math.PI) / 180);
      this.ctx.fillStyle = p.color;
      this.ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
      this.ctx.restore();
    }

    this.animId = requestAnimationFrame(() => this.loop());
  }
}

window.ConfettiEffect = ConfettiEffect;
