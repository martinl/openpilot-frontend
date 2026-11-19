# syntax=docker/dockerfile:1

# *** build app ***
FROM oven/bun:1.2.9-alpine AS build
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
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 8080
