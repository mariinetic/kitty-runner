// Sistema de cenarios: o jogo alterna entre biomas diferentes (prado, praia,
// floresta e castelo a noite) conforme a distancia percorrida, cada um com
// sua paleta, elementos de paralaxe e particulas ambientes proprias -- tudo
// desenhado proceduralmente em canvas (gradientes, silhuetas, blur de sombra).

const BIOME_DISTANCE = 2600; // distancia (em "unidades de velocidade") ate trocar de cenario
const TRANSITION_LEN = 130; // duracao do crossfade entre biomas
const DAY_CYCLE_LENGTH = 1500; // ciclo dia/entardecer dentro de um mesmo bioma

// --- Paletas -----------------------------------------------------------------

const MEADOW = {
  key: "meadow",
  skyDay: { top: "#f5a9c9", bottom: "#ffe0ee", sun: "#fff0b8", glow: "#fff4d8" },
  skyAlt: { top: "#c94f8c", bottom: "#f08bb4", sun: "#ffd0e3", glow: "#ffb5d2" },
  groundTop: "#f4a8c8",
  groundBottom: "#c95b91",
  farColor: "rgba(244, 168, 200, 0.55)",
  midColor: "rgba(224, 112, 163, 0.75)",
  grassColor: "rgba(91,31,71,0.28)",
  farShape: "mountain",
  midShape: "hill",
  bushColor: ["#f39ac3", "#b94e86"],
  particle: "petal",
  hasStars: false,
};

const BEACH = {
  key: "beach",
  skyDay: { top: "#f3b0d0", bottom: "#fff0f7", sun: "#ffe0a8", glow: "#fff3d3" },
  skyAlt: { top: "#d65c98", bottom: "#f3a1c4", sun: "#ffd1e3", glow: "#ffc0d9" },
  groundTop: "#ffd1e3",
  groundBottom: "#e783ad",
  seaTop: "#e979ad",
  seaBottom: "#f6b4d0",
  farColor: "rgba(255,238,247,0.8)",
  midColor: "rgba(255, 196, 220, 0.65)",
  grassColor: "rgba(153,70,110,0.28)",
  farShape: "palm",
  midShape: "dune",
  bushColor: ["#ffd0e3", "#e874a7"],
  particle: "bubble",
  hasStars: false,
};

const FOREST = {
  key: "forest",
  skyDay: { top: "#e8b2d0", bottom: "#ffe8f3", sun: "#ffe9bf", glow: "#fff1d5" },
  skyAlt: { top: "#64284f", bottom: "#a44978", sun: "#ffd5e6", glow: "#d886ad" },
  groundTop: "#d987b0",
  groundBottom: "#8e3c6a",
  farColor: "rgba(129, 57, 101, 0.55)",
  midColor: "rgba(173, 75, 132, 0.7)",
  grassColor: "rgba(71,28,58,0.3)",
  farShape: "pine",
  midShape: "bush",
  bushColor: ["#d978aa", "#883664"],
  particle: "firefly",
  hasStars: false,
};

const CASTLE = {
  key: "castle",
  skyDay: { top: "#7b285f", bottom: "#c7528c", sun: "#ffe6f0", glow: "#f6a9c9" },
  skyAlt: { top: "#32152f", bottom: "#702553", sun: "#ffe6f0", glow: "#d86a9e" },
  groundTop: "#d87aa9",
  groundBottom: "#8c356d",
  farColor: "rgba(255, 197, 222, 0.5)",
  midColor: "rgba(216, 122, 169, 0.6)",
  grassColor: "rgba(61,21,48,0.3)",
  farShape: "castle",
  midShape: "hedge",
  bushColor: ["#f2a8ca", "#b95791"],
  particle: "confetti",
  hasStars: true,
};

const BIOMES = [MEADOW, BEACH, FOREST, CASTLE];

export class Background {
  constructor(width, height, groundY) {
    this.width = width;
    this.height = height;
    this.groundY = groundY;
    this.time = 0;
    this.distance = 0;

    this.biomeIndex = 0;
    this.transition = 0; // 0 = totalmente no bioma atual, 1 = totalmente no proximo

    this.cloudOffset = 0;
    this.farOffset = 0;
    this.midOffset = 0;
    this.grassOffset = 0;

    this.clouds = Array.from({ length: 5 }, (_, i) => ({
      x: (i * width) / 4 + Math.random() * 60,
      y: 26 + Math.random() * 60,
      scale: 0.7 + Math.random() * 0.6,
    }));

    this.starsField = Array.from({ length: 46 }, () => ({
      x: Math.random() * width,
      y: Math.random() * height * 0.55,
      r: 0.6 + Math.random() * 1.3,
      seed: Math.random() * Math.PI * 2,
    }));

    this.farItems = this._layoutItems(5, width / 2.4, 220, 320);
    this.midItems = this._layoutItems(6, width / 3, 150, 300);

    this.particles = Array.from({ length: 16 }, () => this._newParticle(true));
  }

  _layoutItems(count, spacing, seedMin, seedMax) {
    return Array.from({ length: count }, (_, i) => ({
      x: i * spacing + Math.random() * 40,
      seed: seedMin + Math.random() * (seedMax - seedMin),
      scale: 0.75 + Math.random() * 0.6,
    }));
  }

  _newParticle(randomX) {
    return {
      x: randomX ? Math.random() * this.width : this.width + 10,
      y: Math.random() * this.height * 0.75,
      vx: -0.35 - Math.random() * 0.5,
      vy: 0.2 + Math.random() * 0.3,
      r: 2.6 + Math.random() * 2.4,
      sway: Math.random() * Math.PI * 2,
      seed: Math.random() * Math.PI * 2,
      hue: Math.floor(Math.random() * 4),
    };
  }

  get currentBiome() {
    return BIOMES[this.biomeIndex];
  }

  get nextBiome() {
    return BIOMES[(this.biomeIndex + 1) % BIOMES.length];
  }

  setBiome(key) {
    const index = BIOMES.findIndex((biome) => biome.key === key);
    if (index < 0) return;
    this.biomeIndex = index;
    this.distance = 0;
    this.transition = 0;
  }

  _getSkyPalette(biome) {
    const phase = 0.5 + 0.5 * Math.sin((this.time / DAY_CYCLE_LENGTH) * Math.PI * 2 - Math.PI / 2);
    return {
      top: lerpColor(biome.skyDay.top, biome.skyAlt.top, phase),
      bottom: lerpColor(biome.skyDay.bottom, biome.skyAlt.bottom, phase),
      sun: lerpColor(biome.skyDay.sun, biome.skyAlt.sun, phase),
      glow: lerpColor(biome.skyDay.glow, biome.skyAlt.glow, phase),
      sunArc: (this.time % (DAY_CYCLE_LENGTH * 2)) / (DAY_CYCLE_LENGTH * 2),
      duskness: phase,
    };
  }

  update(dt, speed) {
    this.time += dt;
    this.distance += speed * dt;

    if (this.transition > 0) {
      this.transition += dt / TRANSITION_LEN;
      if (this.transition >= 1) {
        this.biomeIndex = (this.biomeIndex + 1) % BIOMES.length;
        this.transition = 0;
      }
    } else if (this.distance >= BIOME_DISTANCE * (this.biomeIndex + 1)) {
      this.transition = 0.001; // comeca o crossfade
    }

    this.cloudOffset -= speed * 0.12 * dt;
    this.farOffset -= speed * 0.28 * dt;
    this.midOffset -= speed * 0.5 * dt;
    this.grassOffset -= speed * dt;

    const wrap = this.width + 220;
    if (this.cloudOffset <= -wrap) this.cloudOffset += wrap;
    if (this.farOffset <= -wrap) this.farOffset += wrap;
    if (this.midOffset <= -wrap) this.midOffset += wrap;
    if (this.grassOffset <= -40) this.grassOffset += 40;

    this.particles.forEach((p) => {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.sway += 0.03 * dt;
    });
    this.particles = this.particles.filter((p) => p.x > -20 && p.y < this.height + 20);
    while (this.particles.length < 16) this.particles.push(this._newParticle(false));
  }

  getGroundColors() {
    const a = this.currentBiome;
    const b = this.nextBiome;
    const t = this.transition;
    return {
      top: lerpColor(a.groundTop, b.groundTop, t),
      bottom: lerpColor(a.groundBottom, b.groundBottom, t),
    };
  }

  draw(ctx) {
    if (this.transition > 0) {
      ctx.save();
      ctx.globalAlpha = 1 - this.transition;
      this._drawBiome(ctx, this.currentBiome);
      ctx.restore();
      ctx.save();
      ctx.globalAlpha = this.transition;
      this._drawBiome(ctx, this.nextBiome);
      ctx.restore();
    } else {
      this._drawBiome(ctx, this.currentBiome);
    }
    this._drawGround(ctx);
    this._drawParticles(ctx, this.currentBiome, this.transition > 0 ? this.nextBiome : null);
  }

  _drawBiome(ctx, biome) {
    const pal = this._getSkyPalette(biome);
    this._drawSky(ctx, pal);
    if (biome.hasStars) this._drawStars(ctx, pal);
    this._drawSun(ctx, pal, biome);
    this._drawClouds(ctx, pal);
    if (biome.key === "beach") this._drawSea(ctx, biome, pal);
    this._drawFarLayer(ctx, biome);
    this._drawMidLayer(ctx, biome);
    this._drawGroundTexture(ctx, biome);
  }

  _drawSky(ctx, pal) {
    const g = ctx.createLinearGradient(0, 0, 0, this.groundY + 20);
    g.addColorStop(0, pal.top);
    g.addColorStop(1, pal.bottom);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, this.width, this.height);
  }

  _drawStars(ctx, pal) {
    ctx.save();
    this.starsField.forEach((s) => {
      const twinkle = 0.5 + 0.5 * Math.sin(this.time * 0.05 + s.seed);
      ctx.globalAlpha = 0.55 + 0.45 * twinkle;
      ctx.fillStyle = "#FFFFFF";
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.restore();
  }

  _drawSun(ctx, pal, biome) {
    const arc = pal.sunArc;
    const x = this.width * (0.1 + arc * 0.85);
    const y = 50 + Math.sin(arc * Math.PI) * -30 + 60;

    const glow = ctx.createRadialGradient(x, y, 4, x, y, 58);
    glow.addColorStop(0, pal.glow);
    glow.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(x, y, 58, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = pal.sun;
    ctx.beginPath();
    ctx.arc(x, y, biome.key === "castle" ? 15 : 17, 0, Math.PI * 2);
    ctx.fill();

    if (biome.key === "castle") {
      ctx.fillStyle = "rgba(180,170,220,0.5)";
      ctx.beginPath();
      ctx.arc(x - 5, y - 3, 2.4, 0, Math.PI * 2);
      ctx.arc(x + 4, y + 4, 1.8, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  _drawClouds(ctx, pal) {
    ctx.fillStyle = "rgba(255,255,255,0.85)";
    this.clouds.forEach((c) => {
      for (let pass = -1; pass <= 1; pass++) {
        const x = c.x + this.cloudOffset + pass * (this.width + 220);
        if (x < -100 || x > this.width + 100) continue;
        drawCloudShape(ctx, x, c.y, c.scale);
      }
    });
  }

  _drawSea(ctx, biome, pal) {
    const seaTop = this.groundY - 46;
    const g = ctx.createLinearGradient(0, seaTop, 0, this.groundY + 6);
    g.addColorStop(0, lerpColor(biome.seaTop, pal.sun, 0.08));
    g.addColorStop(1, biome.seaBottom);
    ctx.fillStyle = g;
    ctx.fillRect(0, seaTop, this.width, this.groundY - seaTop + 6);

    ctx.strokeStyle = "rgba(255,255,255,0.55)";
    ctx.lineWidth = 2;
    for (let i = 0; i < 3; i++) {
      const waveY = seaTop + 12 + i * 11;
      const offset = (this.midOffset * (0.4 + i * 0.15)) % 40;
      ctx.beginPath();
      for (let x = offset - 40; x < this.width + 40; x += 40) {
        ctx.moveTo(x, waveY);
        ctx.quadraticCurveTo(x + 20, waveY - 4, x + 40, waveY);
      }
      ctx.stroke();
    }
  }

  _drawFarLayer(ctx, biome) {
    ctx.fillStyle = biome.farColor;
    this.farItems.forEach((m) => {
      for (let pass = -1; pass <= 1; pass++) {
        const x = m.x + this.farOffset + pass * (this.width + 220);
        if (x < -260 || x > this.width + 260) continue;
        this._drawFarShape(ctx, biome, x, m);
      }
    });
  }

  _drawFarShape(ctx, biome, x, m) {
    const baseY = this.groundY + 4;
    switch (biome.farShape) {
      case "mountain": {
        const w = m.seed;
        const h = m.scale * 70;
        ctx.beginPath();
        ctx.moveTo(x - w / 2, baseY);
        ctx.lineTo(x, baseY - h);
        ctx.lineTo(x + w / 2, baseY);
        ctx.closePath();
        ctx.fill();
        break;
      }
      case "palm":
        drawPalmTree(ctx, x, baseY, m.scale, biome.farColor);
        break;
      case "pine":
        drawPineTree(ctx, x, baseY, m.scale * 1.3, biome.farColor);
        break;
      case "castle":
        drawCastleSilhouette(ctx, x, baseY, m.scale, biome.farColor);
        break;
      default:
        break;
    }
  }

  _drawMidLayer(ctx, biome) {
    this.midItems.forEach((b) => {
      for (let pass = -1; pass <= 1; pass++) {
        const x = b.x + this.midOffset + pass * (this.width + 220);
        if (x < -100 || x > this.width + 100) continue;
        this._drawMidShape(ctx, biome, x, b);
      }
    });
  }

  _drawMidShape(ctx, biome, x, b) {
    const baseY = this.groundY + 4;
    switch (biome.midShape) {
      case "hill":
        ctx.fillStyle = biome.midColor;
        ctx.beginPath();
        ctx.ellipse(x, baseY + 6, b.seed * 0.55, b.seed * 0.3, 0, Math.PI, 0);
        ctx.fill();
        break;
      case "dune":
        ctx.fillStyle = biome.midColor;
        ctx.beginPath();
        ctx.ellipse(x, baseY + 8, 70 * b.scale, 20 * b.scale, 0, Math.PI, 0);
        ctx.fill();
        break;
      case "bush":
        drawBushShape(ctx, x, baseY, b.scale, biome.bushColor);
        break;
      case "hedge":
        drawHedgeShape(ctx, x, baseY, b.scale, biome.bushColor);
        break;
      default:
        break;
    }
  }

  _drawGroundTexture(ctx, biome) {
    ctx.strokeStyle = biome.grassColor;
    ctx.lineWidth = 2.4;
    for (let x = this.grassOffset; x < this.width; x += 26) {
      const h = 5 + ((x * 13) % 5);
      ctx.beginPath();
      ctx.moveTo(x, this.groundY + 6);
      ctx.lineTo(x - 2, this.groundY + 6 - h);
      ctx.stroke();
    }
  }

  _drawGround(ctx) {
    const colors = this.getGroundColors();
    const g = ctx.createLinearGradient(0, this.groundY + 4, 0, this.height);
    g.addColorStop(0, colors.top);
    g.addColorStop(1, colors.bottom);
    ctx.fillStyle = g;
    ctx.fillRect(0, this.groundY + 4, this.width, this.height - this.groundY);
  }

  _drawParticles(ctx, biomeA, biomeB) {
    this.particles.forEach((p) => {
      const kind = biomeB
        ? this.transition < 0.5
          ? biomeA.particle
          : biomeB.particle
        : biomeA.particle;
      drawParticle(ctx, p, kind, this.time);
    });
  }
}

// --- Formas decorativas --------------------------------------------------------

function drawCloudShape(ctx, x, y, scale) {
  ctx.beginPath();
  ctx.ellipse(x, y, 26 * scale, 14 * scale, 0, 0, Math.PI * 2);
  ctx.ellipse(x + 18 * scale, y - 8 * scale, 18 * scale, 14 * scale, 0, 0, Math.PI * 2);
  ctx.ellipse(x - 18 * scale, y - 4 * scale, 16 * scale, 12 * scale, 0, 0, Math.PI * 2);
  ctx.fill();
}

function drawBushShape(ctx, x, y, scale, colors) {
  const [light, dark] = colors;
  const g = ctx.createRadialGradient(x, y - 14 * scale, 2, x, y - 10 * scale, 26 * scale);
  g.addColorStop(0, light);
  g.addColorStop(1, dark);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.ellipse(x, y - 6 * scale, 22 * scale, 16 * scale, 0, 0, Math.PI * 2);
  ctx.ellipse(x - 16 * scale, y - 2 * scale, 14 * scale, 11 * scale, 0, 0, Math.PI * 2);
  ctx.ellipse(x + 16 * scale, y - 2 * scale, 14 * scale, 11 * scale, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#FFD65C";
  ctx.beginPath();
  ctx.arc(x - 6 * scale, y - 10 * scale, 2.2 * scale, 0, Math.PI * 2);
  ctx.arc(x + 9 * scale, y - 6 * scale, 2 * scale, 0, Math.PI * 2);
  ctx.fill();
}

function drawHedgeShape(ctx, x, y, scale, colors) {
  const [light, dark] = colors;
  ctx.fillStyle = dark;
  roundRectPath(ctx, x - 20 * scale, y - 26 * scale, 40 * scale, 26 * scale, 6 * scale);
  ctx.fill();
  ctx.fillStyle = light;
  ctx.beginPath();
  ctx.arc(x, y - 26 * scale, 9 * scale, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "rgba(255,244,200,0.9)";
  ctx.beginPath();
  ctx.arc(x, y - 34 * scale, 2.4 * scale, 0, Math.PI * 2);
  ctx.fill();
}

function drawPalmTree(ctx, x, baseY, scale, color) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = 5 * scale;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(x, baseY);
  ctx.quadraticCurveTo(x + 10 * scale, baseY - 40 * scale, x + 4 * scale, baseY - 70 * scale);
  ctx.stroke();

  const topX = x + 4 * scale;
  const topY = baseY - 70 * scale;
  ctx.fillStyle = color;
  for (let i = 0; i < 5; i++) {
    const angle = -Math.PI / 2 + (i - 2) * 0.45;
    ctx.beginPath();
    ctx.ellipse(
      topX + Math.cos(angle) * 16 * scale,
      topY + Math.sin(angle) * 10 * scale,
      14 * scale,
      5 * scale,
      angle,
      0,
      Math.PI * 2
    );
    ctx.fill();
  }
  ctx.restore();
}

function drawPineTree(ctx, x, baseY, scale, color) {
  ctx.fillStyle = color;
  const w = 26 * scale;
  const h = 90 * scale;
  for (let i = 0; i < 3; i++) {
    const tierH = h * 0.42;
    const tierW = w * (1 - i * 0.22);
    const tierY = baseY - h * 0.15 - i * tierH * 0.62;
    ctx.beginPath();
    ctx.moveTo(x - tierW / 2, tierY);
    ctx.lineTo(x, tierY - tierH);
    ctx.lineTo(x + tierW / 2, tierY);
    ctx.closePath();
    ctx.fill();
  }
}

function drawCastleSilhouette(ctx, x, baseY, scale, color) {
  ctx.fillStyle = color;
  const w = 60 * scale;
  const h = 90 * scale;
  roundRectPath(ctx, x - w / 2, baseY - h, w, h, 4);
  ctx.fill();
  [-1, 1].forEach((side) => {
    const tw = w * 0.32;
    const th = h * 0.5;
    const tx = x + side * (w / 2 - tw / 2);
    ctx.fillRect(tx - tw / 2, baseY - h - th * 0.7, tw, th * 0.7);
    ctx.beginPath();
    ctx.moveTo(tx - tw / 2, baseY - h - th * 0.7);
    ctx.lineTo(tx, baseY - h - th * 1.15);
    ctx.lineTo(tx + tw / 2, baseY - h - th * 0.7);
    ctx.closePath();
    ctx.fill();
  });
  ctx.fillStyle = "rgba(255,214,235,0.9)";
  ctx.fillRect(x - 1, baseY - h - h * 0.42, 2, 14 * scale);
  ctx.beginPath();
  ctx.moveTo(x + 1, baseY - h - h * 0.42);
  ctx.lineTo(x + 10 * scale, baseY - h - h * 0.42 + 4 * scale);
  ctx.lineTo(x + 1, baseY - h - h * 0.42 + 8 * scale);
  ctx.closePath();
  ctx.fill();
}

function drawParticle(ctx, p, kind, time) {
  const x = p.x + Math.sin(p.sway) * 8;
  switch (kind) {
    case "petal":
      ctx.fillStyle = "rgba(255, 182, 208, 0.85)";
      ctx.beginPath();
      ctx.ellipse(x, p.y, p.r, p.r * 0.6, p.sway, 0, Math.PI * 2);
      ctx.fill();
      break;
    case "bubble":
      ctx.save();
      ctx.strokeStyle = "rgba(255,255,255,0.85)";
      ctx.fillStyle = "rgba(255,255,255,0.25)";
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.arc(x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
      break;
    case "firefly": {
      const twinkle = 0.5 + 0.5 * Math.sin(time * 0.12 + p.seed);
      ctx.save();
      ctx.globalAlpha = 0.4 + twinkle * 0.6;
      const glow = ctx.createRadialGradient(x, p.y, 0, x, p.y, p.r * 3.2);
      glow.addColorStop(0, "rgba(255,244,160,0.9)");
      glow.addColorStop(1, "rgba(255,244,160,0)");
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(x, p.y, p.r * 3.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#FFF6B8";
      ctx.beginPath();
      ctx.arc(x, p.y, p.r * 0.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      break;
    }
    case "confetti": {
      const colors = ["#FFD6EB", "#C9B6E4", "#FFF3C4", "#B8E4D8"];
      ctx.save();
      ctx.translate(x, p.y);
      ctx.rotate(p.sway * 2);
      ctx.fillStyle = colors[p.hue % colors.length];
      ctx.fillRect(-p.r * 0.5, -p.r * 0.5, p.r, p.r);
      ctx.restore();
      break;
    }
    default:
      break;
  }
}

function roundRectPath(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function hexToRgb(hex) {
  const clean = hex.replace("#", "");
  const bigint = parseInt(clean, 16);
  return { r: (bigint >> 16) & 255, g: (bigint >> 8) & 255, b: bigint & 255 };
}

function lerpColor(a, b, t) {
  const ca = hexToRgb(a);
  const cb = hexToRgb(b);
  const r = Math.round(ca.r + (cb.r - ca.r) * t);
  const g = Math.round(ca.g + (cb.g - ca.g) * t);
  const bl = Math.round(ca.b + (cb.b - ca.b) * t);
  return `rgb(${r}, ${g}, ${bl})`;
}
