# Containerization

Deployment/container infrastructure for the robotics digital twin. Adds Docker
support **only** — no FK/IK algorithms, runtime safety, command arbitration,
URDF, key config, joint limits, or safety limits are modified. The application
behaves identically inside and outside Docker.

## Architecture

```
Browser
  ↓
Nginx (static file server, SPA routing, gzip, caching, security headers)
  ↓
React Application (Vite build)
  ↓
Web Workers (forward kinematics / DLS-LM inverse kinematics)
  ↓
Robotics Runtime (RuntimeController → Safety → Trajectory)
  ↓
Simulation / Hardware Adapter (RobotModelAdapter → URDF; hardware optional)
```

- The **production** image is a pure static server: `dist/` served by nginx. All
  computation happens in the browser (main thread + workers).
- The **development** image runs the Vite dev server with hot reload and a
  bind-mounted source tree.

## Build & runtime flow

```
Stage 1 (node:22-alpine):  npm ci → npm run build (tsc --noEmit && vite build) → dist/
                           build-time asset validation (URDF, key config, index.html)
Stage 2 (nginx:1.27-alpine): copy dist/ → /usr/share/nginx/html; serve on :80; /healthz
```

## Commands

### Development

```bash
docker compose --profile dev up --build      # http://localhost:5173
```

### Production

```bash
# Compose
docker compose --profile prod up --build     # http://localhost:8080

# Plain Docker
docker build -t robotics-twin .
docker run --rm -p 8080:80 robotics-twin     # http://localhost:8080
```

### Validation

```bash
npm run typecheck
npm run lint
npm run test
npm run build
docker compose config          # validate/render compose
docker build -t robotics-twin . # build production image
```

## Environment

`VITE_*` variables are **build-time** (Vite inlines them). Defaults keep a
self-contained simulation and require no secrets:

| Variable                | Default      | Meaning                                     |
| ----------------------- | ------------ | ------------------------------------------- |
| `VITE_APP_MODE`         | `simulation` | Operating mode                              |
| `VITE_HARDWARE_ENABLED` | `false`      | Optional ESP32 transport; never required    |
| `VITE_AGENT_ENABLED`    | `false`      | Optional agent; build succeeds without keys |
| `VITE_API_URL`          | _(empty)_    | Optional backend base URL                   |

Copy `.env.example` → `.env` to override. The production service wires these as
Docker build args; the dev service passes them to Vite.

## Static assets & workers

- `public/` is copied to the `dist/` root by Vite and served at `/`:
  - `/robot/6_dof_arm.urdf`, `/config/key.config.json` (revalidated, not
    long-cached, so redeploys are picked up).
- FK/IK workers build to content-hashed `/assets/*` chunks (cached 1 year).
  They use `new Worker(new URL(..., import.meta.url), { type: 'module' })` — no
  `localhost` dependency and no worker path to configure.
- The production Dockerfile fails the build if the URDF, key config, or
  `index.html` are missing from `dist/`.

## Security

- Multi-stage build → the runtime image contains only the static bundle (no
  source, no `node_modules`, no `.env`, no secrets).
- nginx worker processes run as the unprivileged `nginx` user; security headers
  (`X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`) on all
  responses. For a fully rootless runtime use
  `nginxinc/nginx-unprivileged:1.27-alpine` and map `8080:8080`.
- Pinned base images (`node:22-alpine`, `nginx:1.27-alpine`); minimal Alpine
  images; no extra packages.

## Troubleshooting

- **URDF not loading (404)**: confirm the app is served at web root `/`. The app
  fetches `/robot/6_dof_arm.urdf` and `/config/key.config.json` at absolute
  paths — a sub-path deployment needs a matching Vite `base` (not required for
  this Docker setup, which serves at `/`).
- **Worker failure / blank scene**: ensure `/assets/*.js` are served with the
  correct MIME (`application/javascript`). nginx's default types handle this;
  don't rewrite `/assets/` to `index.html` (only unknown routes fall back).
- **Wrong base path** on GitHub Pages project sites (`/<repo>/`): that is a Pages
  concern, not Docker — the container always serves at `/`.
- **HMR not updating in dev**: `CHOKIDAR_USEPOLLING=true` is set in compose for
  reliable file watching over bind mounts.
- **Stale app after redeploy**: `index.html`, `/config`, and `/robot` are served
  with `expires -1` (revalidate); only hashed `/assets` are long-cached.

## Validation notes

- Docker image size, build time, and startup time are reported in the task's
  final report. If the local Docker daemon is unavailable, run the `docker build`
  / `docker run` commands above on any host with Docker Engine running; the
  configuration is validated with `docker compose config` and in CI.
