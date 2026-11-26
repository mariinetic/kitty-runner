// URL base da API (backend Flask no Render).
// - No GitHub Pages (*.github.io) usa o backend do Render.
// - Rodando o Flask local/Render (mesma origem) usa caminhos relativos.
const RENDER_API = "https://kitty-runner.onrender.com";

export const API_BASE = window.location.hostname.endsWith("github.io") ? RENDER_API : "";
