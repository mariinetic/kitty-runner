// Captura teclado, toque na tela e botões on-screen e emite eventos
// de alto nível (jump / jumpCancel / duckStart / duckEnd) pro resto do jogo.

export class InputManager {
  constructor(canvas) {
    this.canvas = canvas;
    this.listeners = {};
    this._bindKeyboard();
    this._bindPointer();
    window.addEventListener("keydown", (e) => {
      if (["Space", "ArrowUp", "ArrowDown"].includes(e.code) && !["INPUT", "TEXTAREA"].includes(document.activeElement?.tagName)) {
        e.preventDefault();
      }
    }, { capture: true });
  }

  on(event, cb) {
    (this.listeners[event] ||= []).push(cb);
  }

  emit(event, ...args) {
    (this.listeners[event] || []).forEach((cb) => cb(...args));
  }

  bindButton(el, downEvent, upEvent) {
    const start = (e) => {
      e.preventDefault();
      this.emit(downEvent);
    };
    const end = (e) => {
      e.preventDefault();
      this.emit(upEvent);
    };
    el.addEventListener("pointerdown", start);
    el.addEventListener("pointerup", end);
    el.addEventListener("pointerleave", end);
    el.addEventListener("pointercancel", end);
  }

  _bindKeyboard() {
    window.addEventListener("keydown", (e) => {
      if (e.repeat) return;
      if (e.code === "Space" || e.code === "ArrowUp") {
        e.preventDefault();
        this.emit("jump");
      }
      if (e.code === "ArrowDown" || e.code === "KeyS") {
        e.preventDefault();
        this.emit("duckStart");
      }
      if (e.code === "KeyP" || e.code === "Escape") {
        this.emit("pauseToggle");
      }
    });

    window.addEventListener("keyup", (e) => {
      if (e.code === "Space" || e.code === "ArrowUp") this.emit("jumpCancel");
      if (e.code === "ArrowDown" || e.code === "KeyS") this.emit("duckEnd");
    });

    window.addEventListener("blur", () => this.emit("windowBlur"));
  }

  _bindPointer() {
    this.canvas.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      this.canvas.focus({ preventScroll: true });
      const rect = this.canvas.getBoundingClientRect();
      const relY = (e.clientY - rect.top) / rect.height;
      if (relY > 0.6) {
        this.emit("duckStart");
      } else {
        this.emit("jump");
      }
    });
    this.canvas.addEventListener("pointerup", () => this.emit("duckEnd"));
    this.canvas.addEventListener("pointercancel", () => this.emit("duckEnd"));
  }
}
