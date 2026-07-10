# syntax=docker/dockerfile:1

# =============================================================================
# Production image — multi-stage: Node build → static nginx server.
# Adds ONLY deployment infrastructure; no robotics logic is changed.
# =============================================================================

# ---- Stage 1: build the static bundle ---------------------------------------
FROM node:22-alpine AS build
WORKDIR /app

# Optional build-time flags. Vite inlines VITE_* at build time; defaults keep a
# fully self-contained simulation (no hardware, no agent, no secrets).
ARG VITE_APP_MODE=simulation
ARG VITE_HARDWARE_ENABLED=false
ARG VITE_AGENT_ENABLED=false
ARG VITE_API_URL=
ENV VITE_APP_MODE=$VITE_APP_MODE \
    VITE_HARDWARE_ENABLED=$VITE_HARDWARE_ENABLED \
    VITE_AGENT_ENABLED=$VITE_AGENT_ENABLED \
    VITE_API_URL=$VITE_API_URL

# Install dependencies first (reproducible, cache-friendly). `npm ci` is the
# primary, lockfile-exact path; the fallback only triggers for the known npm
# cross-platform optional-deps gap (Rolldown musl / @emnapi binaries absent from
# a lockfile generated on another OS) so the Linux image resolves native deps.
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund || npm install --no-audit --no-fund

# Copy the source and build: `tsc --noEmit && vite build` (see package.json).
COPY . .
RUN npm run build

# Build-time validation: fail early if critical static assets are missing.
RUN test -f dist/index.html \
 && test -f dist/robot/6_dof_arm.urdf \
 && test -f dist/config/key.config.json

# ---- Stage 2: serve the bundle with nginx -----------------------------------
FROM nginx:1.27-alpine AS runtime

# SPA routing + gzip + caching + security headers (no application logic).
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Ship ONLY the static bundle — no source, no node_modules, no secrets.
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80

# Liveness probe against the nginx-served /healthz endpoint.
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -q -O /dev/null http://127.0.0.1/healthz || exit 1

CMD ["nginx", "-g", "daemon off;"]
