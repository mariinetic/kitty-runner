// Efeitos sonoros gerados na hora com Web Audio API — nenhum arquivo de
// áudio externo é necessário, então o projeto continua leve e sem
// dependências de licenciamento de som.

export class SoundManager {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this.musicTimer = null;
    this.musicStep = 0;
    this.musicEnabled = false;
  }

  _ensureContext() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AudioCtx();
    }
    if (this.ctx.state === "suspended") this.ctx.resume();
  }

  toggleMute() {
    this.muted = !this.muted;
    if (!this.muted && this.musicEnabled) this._scheduleMusic();
    return this.muted;
  }

  startMusic() {
    this.musicEnabled = true;
    if (!this.muted) this._scheduleMusic();
  }

  stopMusic() {
    this.musicEnabled = false;
    if (this.musicTimer) window.clearTimeout(this.musicTimer);
    this.musicTimer = null;
  }

  _scheduleMusic() {
    if (!this.musicEnabled || this.muted || this.musicTimer) return;
    const melody = [659, 784, 988, 784, 698, 880, 1047, 880, 659, 784, 988, 1175, 1047, 880, 784, 698];
    const bass = [165, 165, 196, 196, 220, 220, 196, 196];
    const step = this.musicStep % melody.length;
    this._tone(melody[step], 0.12, "square", 0.025);
    if (step % 2 === 0) this._tone(bass[(step / 2) % bass.length], 0.18, "triangle", 0.035);
    if (step % 4 === 0) this._tone(110, 0.06, "square", 0.018, 0.01);
    this.musicStep += 1;
    this.musicTimer = window.setTimeout(() => { this.musicTimer = null; this._scheduleMusic(); }, 150);
  }

  _tone(freq, duration, type = "sine", gainValue = 0.08, delay = 0) {
    if (this.muted) return;
    try {
      this._ensureContext();
    } catch (err) {
      return; // navegador sem suporte a Web Audio — falha silenciosa
    }
    const t0 = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    gain.gain.setValueAtTime(gainValue, t0);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + duration);
    osc.connect(gain).connect(this.ctx.destination);
    osc.start(t0);
    osc.stop(t0 + duration);
  }

  jump() {
    this._tone(520, 0.12, "triangle");
    this._tone(760, 0.1, "triangle", 0.06, 0.05);
  }

  duck() {
    this._tone(220, 0.08, "square", 0.05);
  }

  collect() {
    this._tone(880, 0.09, "square");
    this._tone(1180, 0.12, "square", 0.07, 0.06);
  }

  powerUp() {
    [523, 659, 784, 1047].forEach((f, i) => this._tone(f, 0.1, "square", 0.06, i * 0.055));
  }

  phaseUp() {
    [392, 523, 659, 784, 1047].forEach((f, i) => this._tone(f, 0.13, "square", 0.055, i * 0.06));
  }

  bossAlert() {
    [220, 220, 165, 220, 277].forEach((f, i) => this._tone(f, 0.15, "square", 0.07, i * 0.13));
  }

  bossDefeated() {
    [523, 659, 784, 1047, 1318].forEach((f, i) => this._tone(f, 0.16, "square", 0.065, i * 0.07));
  }

  hit() {
    this._tone(160, 0.25, "sawtooth", 0.09);
  }

  gameOver() {
    this.stopMusic();
    [440, 370, 300, 220].forEach((f, i) => this._tone(f, 0.18, "square", 0.07, i * 0.12));
  }

  countdownTick() {
    this._tone(660, 0.1, "square", 0.05);
  }

  countdownGo() {
    this._tone(990, 0.22, "square", 0.08);
  }
}
