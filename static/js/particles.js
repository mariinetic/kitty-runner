// Sistema de partículas simples: poeira ao pular/aterrissar, coraçõezinhos
// ao coletar bônus e faíscas ao tomar dano.

export class ParticleSystem {
  constructor() {
    this.particles = [];
  }

  burstHearts(x, y) {
    for (let i = 0; i < 7; i++) {
      this.particles.push({
        x,
        y,
        vx: (Math.random() - 0.5) * 3.2,
        vy: -Math.random() * 3 - 1,
        life: 42,
        maxLife: 42,
        color: "#FF6B94",
        kind: "heart",
        size: 4 + Math.random() * 3,
      });
    }
  }

  burstDust(x, y) {
    for (let i = 0; i < 5; i++) {
      this.particles.push({
        x,
        y,
        vx: (Math.random() - 0.5) * 1.6,
        vy: -Math.random() * 1.1,
        life: 22,
        maxLife: 22,
        color: "rgba(255,255,255,0.85)",
        kind: "dust",
        size: 2.5 + Math.random() * 2.5,
      });
    }
  }

  burstHit(x, y) {
    for (let i = 0; i < 12; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 2 + Math.random() * 2.4;
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 30,
        maxLife: 30,
        color: "#E85C87",
        kind: "spark",
        size: 3,
      });
    }
  }

  update(dt) {
    this.particles.forEach((p) => {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 0.05 * dt;
      p.life -= dt;
    });
    this.particles = this.particles.filter((p) => p.life > 0);
  }

  draw(ctx) {
    this.particles.forEach((p) => {
      const alpha = Math.max(p.life / p.maxLife, 0);
      ctx.globalAlpha = alpha;
      ctx.fillStyle = p.color;
      if (p.kind === "heart") {
        drawTinyHeart(ctx, p.x, p.y, p.size);
      } else {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      }
    });
    ctx.globalAlpha = 1;
  }
}

function drawTinyHeart(ctx, x, y, s) {
  ctx.beginPath();
  ctx.moveTo(x, y + s * 0.3);
  ctx.bezierCurveTo(x - s, y - s * 0.6, x - s * 0.2, y - s * 1.2, x, y - s * 0.3);
  ctx.bezierCurveTo(x + s * 0.2, y - s * 1.2, x + s, y - s * 0.6, x, y + s * 0.3);
  ctx.fill();
}
