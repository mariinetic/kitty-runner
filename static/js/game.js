import { InputManager } from "./input.js";
import { SoundManager } from "./sound.js";
import { ParticleSystem } from "./particles.js";
import { Background } from "./background.js";
import { Cat, GroundObstacle, AerialObstacle, HeartPickup, PowerUp, PinkSlimeEnemy, PinkWispEnemy, PhaseBoss, rectsOverlap } from "./entities.js";

// --- Configuração base ---------------------------------------------------------

const LOGICAL_W = 800;
const LOGICAL_H = 360;
const GROUND_Y = LOGICAL_H - 56;
const TOTAL_LIVES = 3;

const BASE_SPEED = 5.2;
const SPEED_STEP = 0.28;
const SPEED_STEP_INTERVAL = 720; // "frames" lógicos (~12s a 60fps)

const GROUND_VARIANTS = [
  { w: 26, h: 40 },
  { w: 34, h: 56 },
  { w: 58, h: 34 },
];

const BEST_KEY = "kittyRunnerBest";
const NAME_KEY = "kittyRunnerName";
const PLAYER_ID_KEY = "kittyRunnerPlayerId";
const playerId = localStorage.getItem(PLAYER_ID_KEY) || (crypto.randomUUID ? crypto.randomUUID() : `player-${Date.now()}-${Math.random().toString(16).slice(2)}`);
localStorage.setItem(PLAYER_ID_KEY, playerId);
const MUTE_KEY = "kittyRunnerMuted";
const SCENARIO_KEY = "kittyRunnerScenario";

// --- Elementos do DOM ------------------------------------------------------------

const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

const scoreValueEl = document.getElementById("scoreValue");
const bestValueEl = document.getElementById("bestValue");
const livesValueEl = document.getElementById("livesValue");
const startOverlay = document.getElementById("startOverlay");
const gameOverOverlay = document.getElementById("gameOverOverlay");
const pauseOverlay = document.getElementById("pauseOverlay");
const countdownOverlay = document.getElementById("countdownOverlay");
const countdownValueEl = document.getElementById("countdownValue");
const finalScoreEl = document.getElementById("finalScore");
const startBtn = document.getElementById("startBtn");
const retryBtn = document.getElementById("retryBtn");
const resumeBtn = document.getElementById("resumeBtn");
const scoreForm = document.getElementById("scoreForm");
const playerNameInput = document.getElementById("playerName");
const saveStatus = document.getElementById("saveStatus");
const leaderboardList = document.getElementById("leaderboardList");
const refreshBoardBtn = document.getElementById("refreshBoard");
const muteBtn = document.getElementById("muteBtn");
const pauseBtn = document.getElementById("pauseBtn");
const mobileJumpBtn = document.getElementById("mobileJumpBtn");
const mobileDuckBtn = document.getElementById("mobileDuckBtn");
const scenarioPicker = document.getElementById("scenarioPicker");
const pawImageSrc = livesValueEl.dataset.pawSrc;
const phaseValueEl = document.getElementById("phaseValue");
const powerupValueEl = document.getElementById("powerupValue");
const stageBadgeEl = document.getElementById("stageBadge");
const powerupBadgeEl = document.getElementById("powerupBadge");
const bossBadgeEl = document.getElementById("bossBadge");
const phaseProgressBarEl = document.getElementById("phaseProgressBar");
const phaseCompleteOverlay = document.getElementById("phaseCompleteOverlay");
const phaseCompleteTitleEl = document.getElementById("phaseCompleteTitle");
const phaseCompleteScoreEl = document.getElementById("phaseCompleteScore");
const nextPhaseBtn = document.getElementById("nextPhaseBtn");
const replayPhaseBtn = document.getElementById("replayPhaseBtn");
const infiniteModeBtn = document.getElementById("infiniteModeBtn");
const playerNameDisplayEl = document.getElementById("playerNameDisplay");
const levelValueEl = document.getElementById("levelValue");
const xpValueEl = document.getElementById("xpValue");
const xpBarEl = document.getElementById("xpBar");
const achievementCountEl = document.getElementById("achievementCount");
const PHASES = [
  { name: "PRADO", threshold: 0, color: "#f05b9b" },
  { name: "PRAIA ROSA", threshold: 320, color: "#ee78ae" },
  { name: "BOSQUE DE NEON", threshold: 760, color: "#c957d6" },
  { name: "CEU DE ALGODAO", threshold: 1320, color: "#ed7391" },
  { name: "CASTELO RUBI", threshold: 2050, color: "#b83270" },
  { name: "FINAL FELINO", threshold: 3000, color: "#ff4caa" },
];
const POWERUP_NAMES = { shield: "ESCUDO", magnet: "IMA", turbo: "TURBO" };

// --- DPI / canvas nítido ----------------------------------------------------------

function setupCanvasScaling() {
  const dpr = window.devicePixelRatio || 1;
  canvas.width = LOGICAL_W * dpr;
  canvas.height = LOGICAL_H * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
setupCanvasScaling();

// --- Serviços --------------------------------------------------------------------

const input = new InputManager(canvas);
const sound = new SoundManager();
const particles = new ParticleSystem();
const background = new Background(LOGICAL_W, LOGICAL_H, GROUND_Y);
const savedScenario = localStorage.getItem(SCENARIO_KEY) || "meadow";
background.setBiome(savedScenario);

sound.muted = localStorage.getItem(MUTE_KEY) === "1";
updateMuteButton();

// --- Estado do jogo ----------------------------------------------------------------

let state = "idle"; // idle | countdown | running | paused | gameover | phasecomplete
let gameMode = "campaign";
let phaseRunTicks = 0;
const PHASE_DURATION_TICKS = 36000; // cerca de 10 minutos por fase a 60 FPS
let lastTime = 0;
let score = 0;
let best = Number(localStorage.getItem(BEST_KEY) || 0);
let speed = BASE_SPEED;
let elapsedTicks = 0;
let lives = TOTAL_LIVES;
let invulnerable = 0;
let countdownValue = 3;
let countdownAccum = 0;
let stateBeforePause = "running";

let cat = new Cat(90, GROUND_Y);
let obstacles = [];
let hearts = [];
let powerups = [];
let phaseIndex = 0;
let activePowerup = null;
let powerupTimer = 180;
let runPowerups = 0;
let runHearts = 0;
let runEnemies = 0;
let runBosses = 0;
let boss = null;
let bossPhase = -1;
let bossWarningTimer = 0;
let spawnTimer = 0;
let heartTimer = 0;
let shakeTime = 0;
let shakeMag = 0;
let hitStopFrames = 0;

bestValueEl.textContent = best;
playerNameInput.value = localStorage.getItem(NAME_KEY) || "";
updateHud();

function resetGame() {
  score = 0;
  speed = BASE_SPEED;
  elapsedTicks = 0;
  obstacles = [];
  hearts = [];
  powerups = [];
  phaseRunTicks = 0;
  phaseProgressBarEl.style.width = "0%";
  phaseProgressBarEl.setAttribute("aria-valuenow", "0");
  activePowerup = null;
  powerupTimer = 180;
  runPowerups = 0;
  runHearts = 0;
  runEnemies = 0;
  runBosses = 0;
  boss = null;
  bossPhase = -1;
  bossWarningTimer = 0;
  bossBadgeEl.classList.add("hidden");
  spawnTimer = 40;
  heartTimer = 130;
  lives = TOTAL_LIVES;
  invulnerable = 0;
  shakeTime = 0;
  shakeMag = 0;
  hitStopFrames = 0;
  background.setBiome(localStorage.getItem(SCENARIO_KEY) || "meadow");
  cat = new Cat(90, GROUND_Y);
  updateHud();
  updatePhaseHud();
  updatePowerupHud();
}

function selectScenario(key) {
  const validKeys = ["meadow", "beach", "forest", "castle"];
  if (!validKeys.includes(key)) return;
  localStorage.setItem(SCENARIO_KEY, key);
  background.setBiome(key);
  scenarioPicker.querySelectorAll("[data-scenario]").forEach((button) => {
    button.classList.toggle("active", button.dataset.scenario === key);
  });
  draw();
}

selectScenario(savedScenario);

function updateHud() {
  scoreValueEl.textContent = Math.floor(score);
  bestValueEl.textContent = best;
  const lifeCount = Math.max(lives, 0);
  livesValueEl.innerHTML = lifeCount > 0
    ? Array.from({ length: lifeCount }, () => `<img class="paw-image" src="${pawImageSrc}" alt="vida">`).join("")
    : '<span class="no-lives">Sem vidas</span>';
  livesValueEl.setAttribute("aria-label", `${lifeCount} ${lifeCount === 1 ? "vida" : "vidas"}`);
}

function updatePhaseHud() {
  const phase = PHASES[phaseIndex];
  phaseValueEl.textContent = String(phaseIndex + 1).padStart(2, "0");
  stageBadgeEl.textContent = `FASE ${String(phaseIndex + 1).padStart(2, "0")} · ${phase.name}`;
  stageBadgeEl.style.setProperty("--phase-color", phase.color);
  phaseProgressBarEl.style.setProperty("--phase-color", phase.color);
}

function updatePowerupHud() {
  const label = activePowerup ? `${POWERUP_NAMES[activePowerup.type]} ${Math.ceil(activePowerup.time / 60)}s` : "—";
  powerupValueEl.textContent = label;
  if (activePowerup) {
    powerupBadgeEl.textContent = `${POWERUP_NAMES[activePowerup.type]} ATIVO`;
    powerupBadgeEl.classList.remove("hidden");
  } else powerupBadgeEl.classList.add("hidden");
}

function updateMuteButton() {
  muteBtn.textContent = sound.muted ? "🔇" : "🔊";
  muteBtn.setAttribute("aria-label", sound.muted ? "Ativar som" : "Silenciar som");
}

// --- Fluxo de estados -----------------------------------------------------------

function goToStart() {
  state = "idle";
  hideAllOverlays();
  startOverlay.classList.remove("hidden");
  draw(); // desenha um quadro parado
}

function beginCountdown(targetPhase = phaseIndex) {
  const requestedPhase = Number.isFinite(Number(targetPhase)) ? Number(targetPhase) : phaseIndex;
  phaseIndex = Math.max(0, Math.min(PHASES.length - 1, requestedPhase));
  resetGame();
  state = "countdown";
  countdownValue = 3;
  countdownAccum = 0;
  hideAllOverlays();
  countdownOverlay.classList.remove("hidden");
  countdownValueEl.textContent = countdownValue;
  sound.countdownTick();
  lastTime = performance.now();
  requestAnimationFrame(loop);
}

function startRunning() {
  state = "running";
  hideAllOverlays();
  sound.startMusic();
  lastTime = performance.now();
}

async function persistProgress() {
  try {
    await fetch(`/api/profile/${encodeURIComponent(playerId)}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ unlocked_phases: Array.from({ length: Math.min(PHASES.length, phaseIndex + 2) }, (_, i) => i + 1), phase_records: { [String(phaseIndex + 1)]: Math.floor(score) } }),
    });
  } catch (err) { /* mantém o progresso local quando o banco estiver offline */ }
}

function completePhase() {
  state = "phasecomplete";
  sound.stopMusic();
  phaseCompleteScoreEl.textContent = Math.floor(score);
  phaseCompleteTitleEl.textContent = phaseIndex >= PHASES.length - 1 ? "Campanha concluída!" : `Fase ${String(phaseIndex + 1).padStart(2, "0")} concluída!`;
  nextPhaseBtn.classList.toggle("hidden", phaseIndex >= PHASES.length - 1);
  hideAllOverlays();
  phaseCompleteOverlay.classList.remove("hidden");
  persistProgress();
}

function endGame() {
  state = "gameover";
  sound.gameOver();
  if (score > best) {
    best = Math.floor(score);
    localStorage.setItem(BEST_KEY, best);
  }
  finalScoreEl.textContent = Math.floor(score);
  saveStatus.textContent = "";
  hideAllOverlays();
  gameOverOverlay.classList.remove("hidden");
  updateHud();
}

function togglePause() {
  if (state === "running") {
    stateBeforePause = "running";
    state = "paused";
    pauseOverlay.classList.remove("hidden");
  } else if (state === "paused") {
    state = "running";
    pauseOverlay.classList.add("hidden");
    lastTime = performance.now();
    requestAnimationFrame(loop);
  }
}

function hideAllOverlays() {
  [startOverlay, gameOverOverlay, pauseOverlay, countdownOverlay, phaseCompleteOverlay].forEach((el) =>
    el.classList.add("hidden")
  );
}

// --- Spawner -----------------------------------------------------------------------

function pickSpawnKind() {
  // conforme a pontuação sobe, obstáculos aéreos passam a aparecer também
  const aerialUnlocked = elapsedTicks > 260;
  if (!aerialUnlocked) return "ground";
  return Math.random() < 0.32 ? "aerial" : "ground";
}

function spawnObstacle() {
  const kind = phaseIndex >= 2 && Math.random() < 0.2 ? (Math.random() < 0.5 ? "slime" : "wisp") : pickSpawnKind();
  if (kind === "slime") {
    obstacles.push(new PinkSlimeEnemy(LOGICAL_W + 20, GROUND_Y));
  } else if (kind === "wisp") {
    obstacles.push(new PinkWispEnemy(LOGICAL_W + 20, GROUND_Y));
  } else if (kind === "aerial") {
    // altura de voo escolhida para exigir abaixar (não dá pra só pular por cima
    // nem passar andando por baixo sem abaixar)
    obstacles.push(new AerialObstacle(LOGICAL_W + 20, GROUND_Y, 44));
  } else {
    const variant = GROUND_VARIANTS[Math.floor(Math.random() * GROUND_VARIANTS.length)];
    obstacles.push(new GroundObstacle(LOGICAL_W + 20, GROUND_Y, variant));
  }
}

function spawnHeart() {
  const y = GROUND_Y - 90 - Math.random() * 50;
  hearts.push(new HeartPickup(LOGICAL_W + 20, y));
}

function spawnPowerUp() {
  const types = ["shield", "magnet", "turbo"];
  const type = types[Math.floor(Math.random() * types.length)];
  powerups.push(new PowerUp(LOGICAL_W + 20, GROUND_Y - 110 - Math.random() * 52, type));
}

function applyPowerUp(type) {
  activePowerup = { type, time: type === "turbo" ? 360 : 480 };
  runPowerups += 1;
  sound.powerUp();
  particles.burstHearts(cat.x + cat.width / 2, cat.y - cat.height / 2);
  updatePowerupHud();
}

function startBoss(completedPhase) {
  if (boss || completedPhase < 0 || completedPhase >= PHASES.length || gameMode !== "campaign") return;
  boss = new PhaseBoss(LOGICAL_W + 80, GROUND_Y, completedPhase);
  bossPhase = completedPhase;
  bossWarningTimer = 150;
  bossBadgeEl.textContent = `CHEFE · ${PHASES[completedPhase].name}`;
  bossBadgeEl.classList.remove("hidden");
  sound.bossAlert();
}

function finishBoss() {
  if (!boss) return;
  boss = null;
  runBosses += 1;
  bossBadgeEl.classList.add("hidden");
  score += 120;
  sound.bossDefeated();
  particles.burstHearts(LOGICAL_W - 100, GROUND_Y - 80);
  completePhase();
}

// --- Loop principal -------------------------------------------------------------

function loop(now) {
  const dt = Math.min((now - lastTime) / 16.67, 2.2);
  lastTime = now;

  if (hitStopFrames > 0) {
    // congela um instante no momento do impacto (efeito de "hit-stop")
    hitStopFrames -= 1;
    draw();
    requestAnimationFrame(loop);
    return;
  }

  if (state === "countdown") {
    updateCountdown(dt);
  } else if (state === "running") {
    update(dt);
  }

  particles.update(dt);
  if (shakeTime > 0) {
    shakeTime -= dt;
    shakeMag = Math.max(0, shakeMag - dt * 0.6);
  }
  draw();

  if (state === "countdown" || state === "running") {
    requestAnimationFrame(loop);
  }
}

function updateCountdown(dt) {
  countdownAccum += dt;
  if (countdownAccum > 38) {
    countdownAccum = 0;
    countdownValue -= 1;
    if (countdownValue <= 0) {
      countdownOverlay.classList.add("hidden");
      sound.countdownGo();
      startRunning();
      return;
    }
    countdownValueEl.textContent = countdownValue;
    sound.countdownTick();
  }
}

function update(dt) {
  elapsedTicks += dt;
  phaseRunTicks += dt;
  if (gameMode === "campaign") {
    phaseProgressBarEl.style.width = `${Math.min(100, (phaseRunTicks / PHASE_DURATION_TICKS) * 100)}%`;
    phaseProgressBarEl.setAttribute("aria-valuenow", String(Math.floor((phaseRunTicks / PHASE_DURATION_TICKS) * 100)));
  }
  if (gameMode === "campaign" && !boss && phaseRunTicks >= PHASE_DURATION_TICKS) startBoss(phaseIndex);

  // dificuldade em estágios (mais previsível de jogar do que um aumento contínuo)
  const stage = Math.floor(elapsedTicks / SPEED_STEP_INTERVAL);
  speed = BASE_SPEED + stage * SPEED_STEP + (activePowerup?.type === "turbo" ? 2.4 : 0);

  score += dt * (speed * 0.28);
  background.update(dt, speed);

  cat.update(dt, particles);

  spawnTimer -= dt;
  if (spawnTimer <= 0) {
    spawnObstacle();
    const gap = 58 - Math.min(speed * 2.2, 32);
    spawnTimer = gap + Math.random() * 26;
  }

  heartTimer -= dt;
  if (heartTimer <= 0) {
    spawnHeart();
    heartTimer = 140 + Math.random() * 90;
  }

  powerupTimer -= dt;
  if (powerupTimer <= 0) {
    spawnPowerUp();
    powerupTimer = 330 + Math.random() * 220;
  }
  if (activePowerup) {
    activePowerup.time -= dt;
    if (activePowerup.time <= 0) activePowerup = null;
    updatePowerupHud();
  }

  obstacles.forEach((o) => o.update(dt, speed));
  obstacles = obstacles.filter((o) => !o.isOffscreen());
  if (boss) {
    boss.update(dt, speed);
    bossWarningTimer = Math.max(0, bossWarningTimer - dt);
    if (boss.isOffscreen()) finishBoss();
  }

  hearts.forEach((h) => {
    h.update(dt, speed);
    if (activePowerup?.type === "magnet") {
      const dx = cat.x + cat.width / 2 - h.x;
      const dy = cat.y - cat.height / 2 - h.y;
      if (Math.hypot(dx, dy) < 150) { h.x += dx * 0.045 * dt; h.baseY += dy * 0.045 * dt; }
    }
  });
  hearts = hearts.filter((h) => !h.isOffscreen() && !h.collected);
  powerups.forEach((p) => p.update(dt, speed));
  powerups = powerups.filter((p) => !p.isOffscreen() && !p.collected);

  if (invulnerable > 0) invulnerable -= dt;

  const catBox = cat.getHitbox();

  for (const p of powerups) {
    if (!p.collected && rectsOverlap(catBox, p.getHitbox())) {
      p.collected = true;
      applyPowerUp(p.type);
      score += 30;
    }
  }

  for (const o of obstacles) {
    if (invulnerable <= 0 && activePowerup?.type !== "shield" && rectsOverlap(catBox, o.getHitbox())) {
      handleHit();
      break;
    }
  }
  if (boss && invulnerable <= 0 && activePowerup?.type !== "shield" && rectsOverlap(catBox, boss.getHitbox())) {
    handleHit();
  }

  for (const h of hearts) {
    const c = h.getCenter();
    const dx = catBox.x + catBox.w / 2 - c.x;
    const dy = catBox.y + catBox.h / 2 - c.y;
    if (!h.collected && Math.hypot(dx, dy) < h.r + 20) {
      h.collected = true;
      runHearts += 1;
      score += 15;
      sound.collect();
      particles.burstHearts(c.x, c.y);
    }
  }
}

function handleHit() {
  runEnemies += 1;
  lives -= 1;
  invulnerable = 75;
  hitStopFrames = 6;
  shakeTime = 22;
  shakeMag = 7;
  sound.hit();
  const box = cat.getHitbox();
  particles.burstHit(box.x + box.w / 2, box.y + box.h / 2);
  updateHud();
  if (lives <= 0) {
    endGame();
  }
}

// --- Desenho -----------------------------------------------------------------------

function draw() {
  ctx.clearRect(0, 0, LOGICAL_W, LOGICAL_H);

  const shakeX = shakeTime > 0 ? (Math.random() - 0.5) * shakeMag : 0;
  const shakeY = shakeTime > 0 ? (Math.random() - 0.5) * shakeMag : 0;

  ctx.save();
  ctx.translate(shakeX, shakeY);

  background.draw(ctx);
  drawSpeedLines(ctx);
  hearts.forEach((h) => h.draw(ctx));
  powerups.forEach((p) => p.draw(ctx));
  obstacles.forEach((o) => o.draw(ctx));
  if (boss) boss.draw(ctx);

  cat.drawTrail(ctx);
  const flash = invulnerable > 0 && Math.floor(invulnerable / 6) % 2 === 0;
  ctx.globalAlpha = flash ? 0.35 : 1;
  cat.draw(ctx);
  ctx.globalAlpha = 1;

  particles.draw(ctx);
  ctx.restore();

  drawVignette();
}

function drawSpeedLines(ctx) {
  const fastThreshold = BASE_SPEED + SPEED_STEP * 3;
  if (speed < fastThreshold || state !== "running") return;
  const intensity = Math.min((speed - fastThreshold) / 3, 1);
  ctx.strokeStyle = `rgba(255,255,255,${0.25 * intensity})`;
  ctx.lineWidth = 2;
  const scroll = (elapsedTicks * speed * 3) % (LOGICAL_W + 200);
  for (let i = 0; i < 6; i++) {
    const laneY = 40 + i * 42;
    if (laneY > GROUND_Y - 20) continue;
    const x = LOGICAL_W - ((scroll + i * 130) % (LOGICAL_W + 200)) + 200;
    ctx.beginPath();
    ctx.moveTo(x, laneY);
    ctx.lineTo(x - 34, laneY);
    ctx.stroke();
  }
}

function drawVignette() {
  const g = ctx.createRadialGradient(
    LOGICAL_W / 2, LOGICAL_H / 2, LOGICAL_H * 0.35,
    LOGICAL_W / 2, LOGICAL_H / 2, LOGICAL_H * 0.85
  );
  g.addColorStop(0, "rgba(74,46,61,0)");
  g.addColorStop(1, "rgba(74,46,61,0.22)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, LOGICAL_W, LOGICAL_H);
}

// --- Ranking (integração com a API Flask/Mongo) ----------------------------------

async function loadProfile() {
  try {
    const res = await fetch(`/api/profile/${encodeURIComponent(playerId)}`);
    if (!res.ok) return;
    const profile = await res.json();
    if (profile.name && profile.name !== "Jogador Misterioso") playerNameInput.value = profile.name;
    if (profile.stats?.score) best = Math.max(best, Number(profile.stats.score));
    playerNameDisplayEl.textContent = profile.name || "Jogador Misterioso";
    levelValueEl.textContent = profile.level || 1;
    xpValueEl.textContent = profile.xp || 0;
    xpBarEl.style.width = `${Math.min(100, ((profile.xp || 0) % 500) / 5)}%`;
    achievementCountEl.textContent = (profile.achievements || []).length;
    updateHud();
  } catch (err) { /* continua com o progresso local quando o banco está offline */ }
}

async function loadLeaderboard() {
  leaderboardList.innerHTML = '<li class="leaderboard-empty">Carregando...</li>';
  try {
    const res = await fetch("/api/leaderboard");
    const data = await res.json();
    if (!Array.isArray(data) || data.length === 0) {
      leaderboardList.innerHTML =
        '<li class="leaderboard-empty">Ninguém pontuou ainda — seja a primeira!</li>';
      return;
    }
    leaderboardList.innerHTML = "";
    data.forEach((entry, i) => {
      const li = document.createElement("li");
      const medal = ["🥇", "🥈", "🥉"][i] || `${i + 1}º`;
      li.innerHTML = `<span class="rank-name">${medal} ${escapeHtml(entry.name)}</span><span class="rank-score">${entry.score}</span>`;
      leaderboardList.appendChild(li);
    });
  } catch (err) {
    leaderboardList.innerHTML =
      '<li class="leaderboard-empty">Não consegui carregar o ranking agora.</li>';
  }
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

async function submitScore(name, finalScoreValue) {
  saveStatus.textContent = "Salvando...";
  try {
    const res = await fetch("/api/score", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, score: finalScoreValue, player_id: playerId, phase: phaseIndex + 1, distance: Math.floor(elapsedTicks), hearts: runHearts, powerups: runPowerups, enemies: runEnemies, bosses: runBosses }),
    });
    const data = await res.json();
    if (res.ok) {
      saveStatus.textContent = `Salvo! Você ficou em ${data.rank}º lugar 🎉`;
      localStorage.setItem(NAME_KEY, name);
      loadLeaderboard();
    } else {
      saveStatus.textContent = data.error || "Não deu pra salvar agora.";
    }
  } catch (err) {
    saveStatus.textContent = "Sem conexão com o servidor.";
  }
}

// --- Eventos de entrada -------------------------------------------------------------

input.on("jump", () => {
  if (state === "idle") return beginCountdown();
  if (state === "running") cat.jump(sound, particles);
});
input.on("jumpCancel", () => {
  if (state === "running") cat.cancelJump();
});
input.on("duckStart", () => {
  if (state === "running") cat.startDuck(sound);
});
input.on("duckEnd", () => {
  if (state === "running") cat.endDuck();
});
input.on("pauseToggle", () => {
  if (state === "running" || state === "paused") togglePause();
});
input.on("windowBlur", () => {
  if (state === "running") togglePause();
});

input.bindButton(mobileJumpBtn, "jump", "jump");
input.bindButton(mobileDuckBtn, "duckStart", "duckEnd");

startBtn.addEventListener("click", () => beginCountdown(phaseIndex));
retryBtn.addEventListener("click", () => beginCountdown(phaseIndex));
resumeBtn.addEventListener("click", togglePause);
pauseBtn.addEventListener("click", () => {
  if (state === "running" || state === "paused") togglePause();
});

muteBtn.addEventListener("click", () => {
  const muted = sound.toggleMute();
  localStorage.setItem(MUTE_KEY, muted ? "1" : "0");
  updateMuteButton();
});

scoreForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const name = playerNameInput.value.trim() || "Jogador Misterioso";
  submitScore(name, Math.floor(score));
});

refreshBoardBtn.addEventListener("click", loadLeaderboard);
nextPhaseBtn.addEventListener("click", () => beginCountdown(phaseIndex + 1));
replayPhaseBtn.addEventListener("click", () => beginCountdown(phaseIndex));
infiniteModeBtn.addEventListener("click", () => { gameMode = "infinite"; beginCountdown(0); });
scenarioPicker.addEventListener("click", (event) => {
  const card = event.target.closest("[data-scenario]");
  if (card) selectScenario(card.dataset.scenario);
});

// --- Inicialização ---------------------------------------------------------------

goToStart();
loadLeaderboard();
loadProfile();
