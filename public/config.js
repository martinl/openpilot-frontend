// Runtime configuration injected in Kubernetes via ConfigMap or entrypoint scripts at /usr/share/nginx/html/config.js.
// Supports both window.__APP_CONFIG__ (camelCase) and window.__OPENPILOT_CONFIG__ (API_HOST, ATHENA_HOST, etc.).
// Keep empty in local development to fall back to Vite env vars and defaults in src/config.ts.
window.__APP_CONFIG__ = {}
