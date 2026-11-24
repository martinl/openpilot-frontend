# syntax=docker/dockerfile:1.7

# *** build app ***
FROM oven/bun:1.4.4-alpine AS build
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile
COPY . ./

# env
ARG VITE_APP_GIT_SHA=unknown
ARG VITE_APP_GIT_TIMESTAMP=1970-01-01T00:00:00Z
ARG SENTRY_RELEASE
ENV VITE_APP_GIT_SHA=$VITE_APP_GIT_SHA
ENV VITE_APP_GIT_TIMESTAMP=$VITE_APP_GIT_TIMESTAMP
ENV SENTRY_RELEASE=$SENTRY_RELEASE

RUN --mount=type=secret,id=sentry_auth_token,required=false \
  if [ -f /run/secrets/sentry_auth_token ]; then export SENTRY_AUTH_TOKEN="$(cat /run/secrets/sentry_auth_token)"; fi && \
  bun run build && \
  find /app/dist -name '*.map' -delete

# *** final image (non-root, port 8080) ***
FROM nginxinc/nginx-unprivileged:1.27-alpine
USER 0
RUN apk upgrade --no-cache \
  && rm -rf /usr/share/nginx/html/* \
  && chown -R 101:101 /usr/share/nginx/html

COPY --chown=101:101 nginx.conf /etc/nginx/conf.d/default.conf
COPY --chmod=755 --chown=101:101 scripts/40-openpilot-runtime-config.sh /docker-entrypoint.d/40-openpilot-runtime-config.sh
COPY --from=build --chown=101:101 /app/dist /usr/share/nginx/html

USER 101:101

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD ["wget", "-q", "-O", "/dev/null", "http://127.0.0.1:8080/healthz"]
