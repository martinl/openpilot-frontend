#!/bin/sh
set -eu

API_HOST="${API_ENDPOINT:-${API_HOST:-http://localhost:3112}}"
ATHENA_HOST="${ATHENA_ENDPOINT:-${ATHENA_HOST:-http://localhost:3112}}"
USERADMIN_HOST_URL="${USERADMIN_URL:-${USERADMIN_HOST:-http://localhost:3112}}"
GITHUB_CLIENT_ID="${GITHUB_CLIENT:-${GITHUB_CLIENT_ID:-}}"
MAPBOX_ACCESS_TOKEN="${MAPBOX_TOKEN:-}"

cat <<JSEOF > /usr/share/nginx/html/config.js
window.__APP_CONFIG__ = {
  apiUrl: "${API_HOST}",
  athenaUrl: "${ATHENA_HOST}",
  useradminUrl: "${USERADMIN_HOST_URL}",
  githubClientId: "${GITHUB_CLIENT_ID}",
  mapboxToken: "${MAPBOX_ACCESS_TOKEN}"
};
JSEOF
