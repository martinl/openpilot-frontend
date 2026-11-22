# Openpilot Connect

Openpilot Connect is the web and mobile progressive web app (PWA) for managing your openpilot device, viewing driving routes and telemetry, and interacting with devices in real time via Athena.

Production instance: https://connect.apps.k8s.mlp.ee

## Prerequisites

- [Bun](https://bun.sh) `1.4.4` (pinned in `package.json`)
- [pre-commit](https://pre-commit.com) (for git hooks: Biome, TypeScript, Gitleaks, and line-ending checks)

## Local Development

`./live.sh` handles initial setup and starts the dev server automatically.

For a manual setup:

```bash
curl -fsSL https://bun.sh/install | bash

git clone https://github.com/martinl/openpilot-frontend.git
cd openpilot-frontend

bun install
pre-commit install
bun dev
```

## Scripts

| Command | Description |
| :--- | :--- |
| `bun dev` | Start Vite development server with HMR |
| `bun run build` | Build production bundle into `dist/` |
| `bun serve` | Preview the production build locally |
| `bun check` | Run Biome formatter and linter checks |
| `bun fix` | Auto-fix Biome formatting and lint issues |
| `bun tsc` | Run TypeScript type checking |
| `bun run test run` | Run unit and Playwright Chromium browser tests via Vitest |
| `bun lines` | Verify source line count stays below budget |
| `bun bundle-size` | Verify compressed production bundle size stays below budget |
| `bun audit --audit-level=high` | Audit `bun.lock` dependencies for security advisories |
| `./test.sh` | Run full CI verification suite (install, Biome, `tsc`, Playwright, Vitest, line & bundle budgets) |

## Runtime Configuration

In production/Kubernetes, runtime configuration is served from `/config.js` (excluded from service worker precaching and served with `Cache-Control: no-store`). Both `window.__OPENPILOT_CONFIG__` (injected by `openpilot-backend` container entrypoint) and `window.__APP_CONFIG__` are supported, falling back to `VITE_*` environment variables in local development:

```js
// /usr/share/nginx/html/config.js
window.__OPENPILOT_CONFIG__ = {
  API_HOST: "https://api.apps.k8s.mlp.ee",
  ATHENA_HOST: "https://athena.apps.k8s.mlp.ee",
  GITHUB_CLIENT_ID: "<github-oauth-client-id>",
  USERADMIN_HOST: "https://useradmin.apps.k8s.mlp.ee",
  MAPBOX_TOKEN: "<mapbox-public-token>",
};
```

See [`src/config.ts`](src/config.ts) for the full list of supported configuration options (`window.__APP_CONFIG__`).

## Docker

The multi-stage [`Dockerfile`](Dockerfile) builds the static bundle with `oven/bun:1.4.4-alpine` (stripping `.map` sourcemaps from the final image) and serves it via `nginxinc/nginx-unprivileged:1.27-alpine` on port `8080` as non-root UID `101`:

- **Health check endpoint**: `GET /healthz` (`200 OK`)
- **Runtime config mount**: `/usr/share/nginx/html/config.js`

```bash
./scripts/docker.sh
```
