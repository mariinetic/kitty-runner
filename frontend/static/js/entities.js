// Entidades do jogo, desenhadas no canvas.
// A protagonista e a "Mel", uma gatinha mascote 100% original desenhada em
// vetor (nenhum sprite/imagem externa) -- corpo, orelhas, rabo, bandana e
// expressao facial sao todos formas de canvas para poder animar tudo (piscar,
// correr, agachar, pular) com fluidez de jogo indie.

const GRAVITY = 0.62;
const JUMP_FORCE = -12.6;
const JUMP_CUT_MULTIPLIER = 0.45; // solta o botao cedo = pulo mais baixo

// paleta da Mel
const FUR_LIGHT = "#FFF3E6";
const FUR_BASE = "#FFD1A6";
const FUR_SHADE = "#F2B182";
const BELLY = "#FFF8EE";
const OUTLINE = "#4A2E3D";
const EAR_INNER = "#FF9FB8";
const SCARF_MAIN = "#FF7A45";
const SCARF_DARK = "#E85C2B";
const EYE_COLOR = "#3A2A34";
const KITTY_SPRITE = new Image();
KITTY_SPRITE.src = new URL("../../Images/1553283_powpink_hello-kitty-walk.gif", import.meta.url).href;

export class Cat {
  constructor(x, groundY, options = {}) {
    this.x = x;
    this.groundY = groundY;
    this.standHeight = 74;
    this.duckHeight = 46;
    this.width = 58;
    this.y = groundY; // pes da gatinha
    this.vy = 0;
    this.onGround = true;
    this.jumpsUsed = 0;
    this.maxJumps = 2;
    this.isDucking = false;
    this.runPhase = 0;
    this.squash = 0;
    this.tailPhase = 0;
    this.tailAngle = 0;
    this.blinkTimer = 90 + Math.random() * 120;
    this.blinking = false;
    this.trail = []; // rastro de movimento durante o pulo
    this.witchSkin = Boolean(options.witchSkin);
  }

  setWitchSkin(enabled) {
    this.witchSkin = Boolean(enabled);
  }

  get height() {
    return this.isDucking ? this.duckHeight : this.standHeight;
  }

  jump(sound, particles) {
    if (this.jumpsUsed >= this.maxJumps || this.isDucking) return;
    this.vy = JUMP_FORCE * (this.jumpsUsed === 0 ? 1 : 0.82);
    this.onGround = false;
    this.jumpsUsed += 1;
    sound?.jump();
    particles?.burstDust(this.x + this.width / 2, this.y);
  }

  cancelJump() {
    if (this.vy < 0) this.vy *= JUMP_CUT_MULTIPLIER;
  }

  startDuck(sound) {
    if (!this.onGround || this.isDucking) return;
    this.isDucking = true;
    sound?.duck();
  }

  endDuck() {
    this.isDucking = false;
  }

  getHitbox() {
    const h = this.height;
    return {
      x: this.x + 9,
      y: this.y - h + 8,
      w: this.width - 22,
      h: h - 8,
    };
  }

  update(dt, particles) {
    this.vy += GRAVITY * dt;
    this.y += this.vy * dt;

    if (this.y >= this.groundY) {
      const wasFalling = this.vy > 3;
      this.y = this.groundY;
      this.vy = 0;
      if (!this.onGround && wasFalling) {
        particles?.burstDust(this.x + this.width / 2, this.y);
        this.squash = 6;
      }
      this.onGround = true;
      this.jumpsUsed = 0;
    }

    this.squash = Math.max(0, this.squash - dt * 0.8);

    if (this.onGround) this.runPhase += dt * (this.isDucking ? 0.32 : 0.55);
    this.tailPhase += dt * 0.14;
    // o rabo reage com um pequeno atraso ao movimento vertical (fisica simples de mola)
    const targetTailAngle = this.onGround ? Math.sin(this.tailPhase) * 0.35 : -0.5 - this.vy * 0.02;
    this.tailAngle += (targetTailAngle - this.tailAngle) * Math.min(dt * 0.2, 1);

    this.blinkTimer -= dt;
    if (this.blinkTimer <= 0) {
      this.blinking = true;
      if (this.blinkTimer < -8) {
        this.blinking = false;
        this.blinkTimer = 90 + Math.random() * 150;
      }
    }

    // rastro de movimento (so acumula enquanto esta no ar, pra reforcar velocidade do pulo)
    if (!this.onGround) {
      this.trail.push({ y: this.y, ducking: this.isDucking, life: 10 });
    }
    this.trail.forEach((t) => (t.life -= dt));
    this.trail = this.trail.filter((t) => t.life > 0);
  }

  drawTrail(ctx) {
    this.trail.forEach((t, i) => {
      const alpha = (t.life / 10) * 0.18;
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.translate(this.x - 6 - i * 1.5, 0);
      this._drawSilhouette(ctx, t.y, t.ducking);
      ctx.restore();
    });
  }

  _drawSilhouette(ctx, y, ducking) {
    const h = ducking ? this.duckHeight : this.standHeight;
    ctx.fillStyle = FUR_BASE;
    roundRect(ctx, 4, y - h, this.width - 8, h * 0.66, 15);
    ctx.fill();
  }

  draw(ctx) {
    const h = this.height;
    const bodyY = this.y - h + this.squash;
    const duck = this.isDucking;

    ctx.save();
    ctx.translate(this.x, 0);

    // sombra de contato (suave, com blur)
    ctx.save();
    ctx.shadowColor = "rgba(74,46,61,0.35)";
    ctx.shadowBlur = 8;
    ctx.fillStyle = "rgba(74,46,61,0.22)";
    ctx.beginPath();
    ctx.ellipse(this.width / 2, this.groundY + 6, this.width * 0.3, 5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    ctx.save();
    ctx.translate(0, bodyY);
    if (KITTY_SPRITE.complete && KITTY_SPRITE.naturalWidth > 0) {
      ctx.drawImage(KITTY_SPRITE, 0, 0, this.width, h);
    } else {
      this._drawTail(ctx, h, duck);
      this._drawLegs(ctx, h, duck);
      this._drawBody(ctx, h, duck);
      this._drawHead(ctx, h, duck);
    }
    ctx.restore();

    ctx.restore();
  }

  _drawLegs(ctx, h, duck) {
    const w = this.width;
    const phase = duck ? 0 : Math.sin(this.runPhase);
    const airborne = !this.onGround;
    const lift = airborne ? 0.5 : 0;

    ctx.fillStyle = FUR_SHADE;
    const legY = h - (duck ? 6 : 8);
    const legH = duck ? 8 : 12;

    const frontX = w * 0.32 + (airborne ? -2 : phase * 5);
    const backX = w * 0.66 - (airborne ? -2 : phase * 5);
    const frontLift = airborne ? lift * 4 : Math.max(0, phase) * 2;
    const backLift = airborne ? lift * 4 : Math.max(0, -phase) * 2;

    ctx.beginPath();
    ctx.ellipse(frontX, legY - frontLift, 6.5, legH * 0.55, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(backX, legY - backLift, 6.5, legH * 0.55, 0, 0, Math.PI * 2);
    ctx.fill();

    // patinhas (tom mais claro na ponta)
    ctx.fillStyle = FUR_LIGHT;
    ctx.beginPath();
    ctx.ellipse(frontX, legY - frontLift + legH * 0.32, 5, 3.2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(backX, legY - backLift + legH * 0.32, 5, 3.2, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  _drawBody(ctx, h, duck) {
    const w = this.width;
    const top = duck ? h * 0.45 : h * 0.36;

    const g = ctx.createLinearGradient(0, top, 0, h);
    g.addColorStop(0, FUR_LIGHT);
    g.addColorStop(1, FUR_BASE);
    ctx.fillStyle = g;
    roundRect(ctx, w * 0.08, top, w * 0.84, h - top, duck ? 14 : 17);
    ctx.fill();
    ctx.strokeStyle = "rgba(74,46,61,0.18)";
    ctx.lineWidth = 1.4;
    roundRect(ctx, w * 0.08, top, w * 0.84, h - top, duck ? 14 : 17);
    ctx.stroke();

    // barriguinha clara
    ctx.fillStyle = BELLY;
    ctx.beginPath();
    ctx.ellipse(w * 0.52, top + (h - top) * 0.62, w * 0.28, (h - top) * 0.34, 0, 0, Math.PI * 2);
    ctx.fill();

    // bandana no pescoco (o toque de estilo da Mel -- nada de laco!)
    const scarfY = top + 2;
    ctx.fillStyle = SCARF_DARK;
    ctx.beginPath();
    ctx.moveTo(w * 0.24, scarfY);
    ctx.lineTo(w * 0.4, scarfY + 14);
    ctx.lineTo(w * 0.5, scarfY);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = SCARF_MAIN;
    ctx.beginPath();
    ctx.ellipse(w * 0.5, scarfY, w * 0.3, 6, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  _drawHead(ctx, h, duck) {
    const w = this.width;
    const cx = w * 0.42;
    const cy = duck ? h * 0.38 : h * 0.24;
    const r = w * (duck ? 0.34 : 0.4);

    if (this.witchSkin) {
      this._drawWitchHat(ctx, cx, cy, r);
    }

    // orelha esquerda (arrebitada)
    drawEar(ctx, cx - r * 0.55, cy - r * 0.7, -1, false);
    // orelha direita (dobrada -- marca registrada da Mel)
    drawEar(ctx, cx + r * 0.6, cy - r * 0.65, 1, true);

    // cabeca
    const g = ctx.createRadialGradient(cx - r * 0.3, cy - r * 0.3, r * 0.1, cx, cy, r * 1.1);
    g.addColorStop(0, FUR_LIGHT);
    g.addColorStop(1, FUR_BASE);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "rgba(74,46,61,0.18)";
    ctx.lineWidth = 1.2;
    ctx.stroke();

    // marquinha em forma de estrela na testa
    drawStar(ctx, cx + r * 0.12, cy - r * 0.5, r * 0.13, "#FFB6C8");

    // bochechas rosadas
    ctx.fillStyle = "rgba(255,150,175,0.45)";
    ctx.beginPath();
    ctx.ellipse(cx - r * 0.55, cy + r * 0.18, r * 0.22, r * 0.14, 0, 0, Math.PI * 2);
    ctx.ellipse(cx + r * 0.55, cy + r * 0.18, r * 0.22, r * 0.14, 0, 0, Math.PI * 2);
    ctx.fill();

    // olhos
    const eyeY = cy - r * 0.02;
    const eyeDX = r * 0.4;
    if (this.blinking) {
      ctx.strokeStyle = OUTLINE;
      ctx.lineWidth = 2.4;
      ctx.lineCap = "round";
      [-1, 1].forEach((dir) => {
        ctx.beginPath();
        ctx.moveTo(cx + dir * eyeDX - 4, eyeY);
        ctx.lineTo(cx + dir * eyeDX + 4, eyeY);
        ctx.stroke();
      });
    } else {
      [-1, 1].forEach((dir) => {
        ctx.fillStyle = EYE_COLOR;
        ctx.beginPath();
        ctx.ellipse(cx + dir * eyeDX, eyeY, r * 0.13, r * 0.17, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#FFFFFF";
        ctx.beginPath();
        ctx.arc(cx + dir * eyeDX - r * 0.05, eyeY - r * 0.06, r * 0.05, 0, Math.PI * 2);
        ctx.fill();
      });
    }

    // nariz (pequeno triangulo rosado -- a Mel TEM nariz e sorriso, ao contrario
    // de mascotes brancos de laco que voces conhecem por ai)
    const noseY = eyeY + r * 0.32;
    ctx.fillStyle = "#FF6B94";
    ctx.beginPath();
    ctx.moveTo(cx - 3, noseY);
    ctx.lineTo(cx + 3, noseY);
    ctx.lineTo(cx, noseY + 3.4);
    ctx.closePath();
    ctx.fill();

    // sorriso
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 1.6;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(cx, noseY + 3.4);
    ctx.quadraticCurveTo(cx - 5, noseY + 8, cx - 9, noseY + 5);
    ctx.moveTo(cx, noseY + 3.4);
    ctx.quadraticCurveTo(cx + 5, noseY + 8, cx + 9, noseY + 5);
    ctx.stroke();

    // bigodinhos
    ctx.strokeStyle = "rgba(74,46,61,0.55)";
    ctx.lineWidth = 1;
    [-1, 1].forEach((dir) => {
      for (let i = 0; i < 3; i++) {
        const wy = noseY - 2 + i * 3;
        ctx.beginPath();
        ctx.moveTo(cx + dir * r * 0.3, wy);
        ctx.lineTo(cx + dir * r * 0.75, wy - 2 + i);
        ctx.stroke();
      }
    });
  }

  _drawTail(ctx, h, duck) {
    const baseX = duck ? 6 : 9;
    const baseY = duck ? h * 0.75 : h * 0.62;
    const angle = this.tailAngle;
    const midX = baseX - 16 + Math.sin(angle) * 10;
    const midY = baseY - 6 + Math.cos(angle) * 6;
    const tipX = baseX - 27 + Math.sin(angle) * 18;
    const tipY = baseY - 22 + Math.cos(angle) * 4;

    ctx.strokeStyle = FUR_SHADE;
    ctx.lineWidth = 8;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(baseX, baseY);
    ctx.quadraticCurveTo(midX, midY, tipX, tipY);
    ctx.stroke();

    ctx.strokeStyle = FUR_LIGHT;
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(baseX, baseY);
    ctx.quadraticCurveTo(midX, midY, tipX, tipY);
    ctx.stroke();
  }
}

function drawEar(ctx, x, y, dir, folded) {
  ctx.save();
  if (folded) {
    // orelha direita dobrada -- ponta cai pro lado em vez de ficar em pe
    ctx.beginPath();
    ctx.moveTo(x, y + 4);
    ctx.quadraticCurveTo(x + 12 * dir, y - 10, x + 6 * dir, y + 6);
    ctx.quadraticCurveTo(x + 2 * dir, y + 10, x - 2 * dir, y + 6);
    ctx.closePath();
  } else {
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x - 7 * dir, y - 15);
    ctx.lineTo(x + 9 * dir, y - 6);
    ctx.closePath();
  }
  const g = ctx.createLinearGradient(x, y - 14, x, y);
  g.addColorStop(0, FUR_LIGHT);
  g.addColorStop(1, FUR_BASE);
  ctx.fillStyle = g;
  ctx.fill();
  ctx.strokeStyle = "rgba(74,46,61,0.25)";
  ctx.lineWidth = 1.4;
  ctx.stroke();

  ctx.fillStyle = EAR_INNER;
  if (folded) {
    ctx.beginPath();
    ctx.ellipse(x + 3 * dir, y, 3, 4.5, 0, 0, Math.PI * 2);
    ctx.fill();
  } else {
    ctx.beginPath();
    ctx.moveTo(x + 1 * dir, y - 3);
    ctx.lineTo(x - 2 * dir, y - 10);
    ctx.lineTo(x + 4 * dir, y - 7);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

function drawStar(ctx, cx, cy, r, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  for (let i = 0; i < 5; i++) {
    const angle = -Math.PI / 2 + (i * Math.PI * 2) / 5;
    const angleIn = angle + Math.PI / 5;
    const ox = cx + Math.cos(angle) * r;
    const oy = cy + Math.sin(angle) * r;
    const ix = cx + Math.cos(angleIn) * r * 0.45;
    const iy = cy + Math.sin(angleIn) * r * 0.45;
    if (i === 0) ctx.moveTo(ox, oy);
    else ctx.lineTo(ox, oy);
    ctx.lineTo(ix, iy);
  }
  ctx.closePath();
  ctx.fill();
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// --- Obstaculo de chao: florzinha espinhenta, precisa pular -------------------

export class GroundObstacle {
  constructor(startX, groundY, variant) {
    this.w = variant.w;
    this.h = variant.h;
    this.x = startX;
    this.y = groundY - this.h;
    this.passed = false;
    this.kind = "ground";
    this.sway = Math.random() * Math.PI * 2;
  }

  update(dt, speed) {
    this.x -= speed * dt;
    this.sway += 0.05 * dt;
  }

  isOffscreen() {
    return this.x + this.w < -20;
  }

  getHitbox() {
    return { x: this.x + 4, y: this.y + 6, w: this.w - 8, h: this.h - 6 };
  }

  draw(ctx) {
    const petals = 5;
    const cx = this.x + this.w / 2;
    const baseY = this.y + this.h;
    const windOffset = Math.sin(this.sway) * 2;

    ctx.save();
    ctx.shadowColor = "rgba(74,46,61,0.3)";
    ctx.shadowBlur = 5;
    ctx.fillStyle = "rgba(74,46,61,0.18)";
    ctx.beginPath();
    ctx.ellipse(cx, baseY + 2, this.w * 0.32, 4, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    ctx.save();
    ctx.translate(windOffset, 0);

    const stemGrad = ctx.createLinearGradient(cx, baseY - this.h * 0.5, cx, baseY);
    stemGrad.addColorStop(0, "#4FBE85");
    stemGrad.addColorStop(1, "#2E7A50");
    ctx.fillStyle = stemGrad;
    ctx.fillRect(cx - 3, baseY - this.h * 0.5, 6, this.h * 0.5);

    for (let i = 0; i < petals; i++) {
      const angle = (Math.PI * 2 * i) / petals + this.sway * 0.15;
      const px = cx + Math.cos(angle) * (this.w * 0.32);
      const py = this.y + this.h * 0.42 + Math.sin(angle) * (this.w * 0.32);
      const petalGrad = ctx.createRadialGradient(px, py, 1, px, py, this.w * 0.26);
      petalGrad.addColorStop(0, "#FFD3E4");
      petalGrad.addColorStop(1, "#FF8FB8");
      ctx.fillStyle = petalGrad;
      ctx.beginPath();
      ctx.ellipse(px, py, this.w * 0.24, this.w * 0.16, angle, 0, Math.PI * 2);
      ctx.fill();
    }

    const coreGrad = ctx.createRadialGradient(
      cx - 2, this.y + this.h * 0.4, 1,
      cx, this.y + this.h * 0.42, this.w * 0.16
    );
    coreGrad.addColorStop(0, "#FFF3C4");
    coreGrad.addColorStop(1, "#FFC94A");
    ctx.fillStyle = coreGrad;
    ctx.beginPath();
    ctx.arc(cx, this.y + this.h * 0.42, this.w * 0.16, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }
}

// --- Obstaculo aereo: abelhinha, precisa abaixar -------------------------------

export class AerialObstacle {
  constructor(startX, groundY, flyHeight) {
    this.w = 34;
    this.h = 22;
    this.x = startX;
    this.groundY = groundY;
    this.baseY = groundY - flyHeight;
    this.bob = Math.random() * Math.PI * 2;
    this.kind = "aerial";
  }

  update(dt, speed) {
    this.x -= speed * dt;
    this.bob += 0.12 * dt;
  }

  isOffscreen() {
    return this.x + this.w < -20;
  }

  get y() {
    return this.baseY + Math.sin(this.bob) * 8;
  }

  getHitbox() {
    return { x: this.x + 4, y: this.y - this.h / 2 + 4, w: this.w - 8, h: this.h - 8 };
  }

  draw(ctx) {
    const cx = this.x + this.w / 2;
    const cy = this.y;
    const wingFlap = Math.sin(this.bob * 5) * 5;

    const shadowScale = 1 - Math.min((this.groundY - cy) / 220, 0.6);
    ctx.fillStyle = `rgba(74,46,61,${0.14 * shadowScale})`;
    ctx.beginPath();
    ctx.ellipse(cx, this.groundY + 6, 10 * shadowScale, 3 * shadowScale, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "rgba(255,255,255,0.65)";
    ctx.beginPath();
    ctx.ellipse(cx - 4, cy - 8 - wingFlap, 8, 5, 0.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(cx + 4, cy - 8 - wingFlap, 8, 5, -0.4, 0, Math.PI * 2);
    ctx.fill();

    const bodyGrad = ctx.createRadialGradient(cx - 4, cy - 4, 1, cx, cy, this.w * 0.34);
    bodyGrad.addColorStop(0, "#FFE9A0");
    bodyGrad.addColorStop(1, "#FFC533");
    ctx.fillStyle = bodyGrad;
    ctx.beginPath();
    ctx.ellipse(cx, cy, this.w * 0.32, this.h * 0.32, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#4A2E3D";
    ctx.fillRect(cx - this.w * 0.32, cy - 3, this.w * 0.64, 3);
    ctx.fillRect(cx - this.w * 0.2, cy + 3, this.w * 0.4, 3);

    ctx.fillStyle = "#4A2E3D";
    ctx.beginPath();
    ctx.arc(cx + this.w * 0.2, cy - 1, 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#FFFFFF";
    ctx.beginPath();
    ctx.arc(cx + this.w * 0.2 + 0.6, cy - 1.8, 0.6, 0, Math.PI * 2);
    ctx.fill();
  }
}

// --- Coletavel: coracaozinho de bonus (com brilho pulsante) --------------------

export class HeartPickup {
  constructor(startX, y) {
    this.x = startX;
    this.baseY = y;
    this.r = 12;
    this.bob = Math.random() * Math.PI * 2;
    this.collected = false;
  }

  update(dt, speed) {
    this.x -= speed * dt;
    this.bob += 0.08 * dt;
  }

  isOffscreen() {
    return this.x < -30;
  }

  get y() {
    return this.baseY + Math.sin(this.bob) * 6;
  }

  getCenter() {
    return { x: this.x, y: this.y };
  }

  draw(ctx) {
    const pulse = 1 + Math.sin(this.bob * 2) * 0.08;
    const s = this.r * 0.6 * pulse;

    ctx.save();
    ctx.shadowColor = "rgba(255,107,148,0.75)";
    ctx.shadowBlur = 10;
    ctx.fillStyle = "#FF6B94";
    ctx.beginPath();
    ctx.moveTo(this.x, this.y + s * 0.6);
    ctx.bezierCurveTo(this.x - s * 1.4, this.y - s * 0.6, this.x - s * 0.4, this.y - s * 1.6, this.x, this.y - s * 0.4);
    ctx.bezierCurveTo(this.x + s * 0.4, this.y - s * 1.6, this.x + s * 1.4, this.y - s * 0.6, this.x, this.y + s * 0.6);
    ctx.fill();
    ctx.restore();

    ctx.fillStyle = "rgba(255,255,255,0.8)";
    ctx.beginPath();
    ctx.arc(this.x - s * 0.35, this.y - s * 0.2, s * 0.18, 0, Math.PI * 2);
    ctx.fill();
  }
}

export class PinkSlimeEnemy {
  constructor(startX, groundY) {
    this.x = startX; this.groundY = groundY; this.w = 38; this.h = 34;
    this.y = groundY; this.vy = 0; this.jumpTimer = 20 + Math.random() * 35;
    this.kind = "slime"; this.blink = Math.random() * 10;
  }
  update(dt, speed) {
    this.x -= speed * dt; this.jumpTimer -= dt; this.blink += dt;
    if (this.jumpTimer <= 0 && this.y >= this.groundY) { this.vy = -7.4; this.jumpTimer = 55 + Math.random() * 45; }
    this.vy += 0.5 * dt; this.y = Math.min(this.groundY, this.y + this.vy * dt);
  }
  isOffscreen() { return this.x + this.w < -24; }
  getHitbox() { return { x:this.x + 5, y:this.y - this.h + 5, w:this.w - 10, h:this.h - 5 }; }
  draw(ctx) {
    const squash = this.y >= this.groundY - 2 ? 1 + Math.sin(this.blink * 0.25) * 0.06 : 0.92;
    ctx.save(); ctx.translate(this.x + this.w / 2, this.y); ctx.scale(1 / squash, squash);
    ctx.fillStyle = "#d8428c"; ctx.fillRect(-17,-28,34,25); ctx.fillStyle = "#f58db8"; ctx.fillRect(-12,-23,24,17);
    ctx.fillStyle = "#662052"; ctx.fillRect(-9,-17,4,5); ctx.fillRect(5,-17,4,5); ctx.fillStyle = "#fff1f7"; ctx.fillRect(-8,-16,2,2); ctx.fillRect(6,-16,2,2);
    ctx.fillStyle = "#ffbad6"; ctx.fillRect(-19,-12,5,6); ctx.fillRect(14,-12,5,6); ctx.restore();
  }
}

export class PinkWispEnemy {
  constructor(startX, groundY) {
    this.x = startX; this.groundY = groundY; this.w = 38; this.h = 28;
    this.baseY = groundY - 78 - Math.random() * 70; this.wave = Math.random() * Math.PI * 2;
    this.kind = "wisp";
  }
  update(dt, speed) { this.x -= (speed + 0.7) * dt; this.wave += 0.1 * dt; }
  get y() { return this.baseY + Math.sin(this.wave) * 25; }
  isOffscreen() { return this.x + this.w < -24; }
  getHitbox() { return { x:this.x + 5, y:this.y - this.h / 2 + 4, w:this.w - 10, h:this.h - 7 }; }
  draw(ctx) {
    const cx = this.x + this.w / 2, cy = this.y;
    ctx.save(); ctx.shadowColor = "#ff63aa"; ctx.shadowBlur = 12;
    ctx.fillStyle = "#ef67a7"; ctx.fillRect(cx - 15, cy - 10, 30, 20); ctx.fillRect(cx - 9, cy - 16, 18, 32);
    ctx.fillStyle = "#ffd5e7"; ctx.fillRect(cx - 8, cy - 7, 5, 5); ctx.fillRect(cx + 4, cy - 7, 5, 5);
    ctx.fillStyle = "#9d2e6c"; ctx.fillRect(cx - 9, cy + 6, 18, 3); ctx.fillRect(cx - 17, cy - 4, 5, 8); ctx.fillRect(cx + 12, cy - 4, 5, 8); ctx.restore();
  }
}

export class PhaseBoss {
  constructor(startX, groundY, phase) {
    this.x = startX;
    this.groundY = groundY;
    this.phase = phase;
    this.w = 94 + phase * 8;
    this.h = 90 + phase * 9;
    this.y = groundY;
    this.time = 0;
    this.kind = "boss";
    this.alerted = false;
  }

  update(dt, speed) {
    const difficultyBoost = 1 + this.phase * 0.24;
    this.x -= (Math.max(4.2, speed * 0.82) + difficultyBoost * 1.4) * dt;
    this.y = this.groundY - Math.sin(this.time * 0.22) * (8 + this.phase * 2.4);
    this.time += dt;
  }

  isOffscreen() { return this.x + this.w < -30; }

  getHitbox() {
    return {
      x: this.x + 12,
      y: this.y - this.h + 16,
      w: this.w - 24,
      h: this.h - 18,
    };
  }

  draw(ctx) {
    const cx = this.x + this.w / 2;
    const cy = this.y - this.h / 2 + Math.sin(this.time * 0.12) * 5;
    ctx.save();
    ctx.shadowColor = "#ff4caa";
    ctx.shadowBlur = 18 + this.phase * 4;
    ctx.fillStyle = "#8b2f68";
    ctx.fillRect(cx - 34, cy - 32, 68, 58);
    ctx.fillStyle = "#ef5a9e";
    ctx.fillRect(cx - 30, cy - 42, 60, 58);
    ctx.fillRect(cx - 48, cy - 22, 16, 30); ctx.fillRect(cx + 32, cy - 22, 16, 30);
    ctx.fillStyle = "#ffc5dc";
    ctx.fillRect(cx - 20, cy - 18, 12, 12); ctx.fillRect(cx + 8, cy - 18, 12, 12);
    ctx.fillStyle = "#6b2050";
    ctx.fillRect(cx - 18, cy - 12, 6, 6); ctx.fillRect(cx + 12, cy - 12, 6, 6);
    ctx.fillRect(cx - 18, cy + 6, 36, 6);
    ctx.fillStyle = "#ffd9e9";
    ctx.fillRect(cx - 7, cy - 52, 14, 14); ctx.fillRect(cx - 16, cy - 44, 32, 7);
    ctx.restore();
  }
}

export class PowerUp {
  constructor(startX, y, type) {
    this.x = startX;
    this.baseY = y;
    this.type = type;
    this.w = 24;
    this.h = 24;
    this.bob = Math.random() * Math.PI * 2;
    this.collected = false;
  }

  update(dt, speed) {
    this.x -= speed * dt;
    this.bob += 0.1 * dt;
  }

  isOffscreen() { return this.x + this.w < -24; }
  get y() { return this.baseY + Math.sin(this.bob) * 7; }
  getHitbox() { return { x: this.x + 3, y: this.y - this.h / 2 + 3, w: this.w - 6, h: this.h - 6 }; }

  draw(ctx) {
    const colors = { shield: ["#ffd3e8", "#f04f98"], magnet: ["#fff0fa", "#c957d6"], turbo: ["#ffe1b8", "#ef6c72"] };
    const [light, main] = colors[this.type] || colors.shield;
    const cx = this.x + this.w / 2, cy = this.y;
    const pulse = 1 + Math.sin(this.bob * 2) * 0.1;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(pulse, pulse);
    ctx.shadowColor = main; ctx.shadowBlur = 12;
    ctx.fillStyle = main; ctx.fillRect(-10, -10, 20, 20);
    ctx.fillStyle = light; ctx.fillRect(-6, -6, 12, 12);
    ctx.fillStyle = "#7d285d";
    if (this.type === "shield") { ctx.fillRect(-2, -5, 4, 10); ctx.fillRect(-5, -2, 10, 4); }
    if (this.type === "magnet") { ctx.fillRect(-6, -5, 3, 10); ctx.fillRect(3, -5, 3, 10); ctx.fillRect(-3, 4, 6, 3); }
    if (this.type === "turbo") { ctx.fillRect(-3, -7, 6, 14); ctx.fillRect(-7, -2, 14, 4); }
    ctx.restore();
  }
}

export function rectsOverlap(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}
