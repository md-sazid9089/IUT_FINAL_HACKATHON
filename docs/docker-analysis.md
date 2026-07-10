# Docker Analysis (Phase 1)

Read-only analysis of the existing project to drive a containerization that runs
**identically inside and outside Docker**. No robotics logic, algorithms, URDF,
key config, or safety limits are changed by the container work.

## Architecture

- **Frontend**: React 19 + TypeScript + Vite 8, Three.js / React Three Fiber,
  Zustand state.
- **Robotics** (browser-first, backend-free): URDF digital twin, forward
  kinematics, Jacobian, DLS/LM inverse kinematics, RuntimeController, safety
  supervisor, quintic trajectory generation.
- **Controls**: manual joystick + keyboard + joint sliders (Gate 5), autonomous
  PIN (Gate 6). Hardware transport (Gate 9) and any agent mode are optional and
  **disabled by default** (pure simulation).
- **Workers**: `src/kinematics/fkWorker.ts` and `ikWorker.ts`, instantiated with
  the standard Vite pattern
  `new Worker(new URL('./ikWorker.ts', import.meta.url), { type: 'module' })`.
  Vite emits them as hashed ES-module chunks under `/assets/` — there is **no
  `localhost` dependency** and no runtime worker path to configure.

## Build flow

```
npm ci                # reproducible install from package-lock.json
npm run build         # = tsc --noEmit  (typecheck)  &&  vite build
                      # → static bundle in dist/
```

- Node engine: `>=22.12.0` (package.json). CI uses Node 24; the images use
  `node:22-alpine` which satisfies the engine range.
- Vite `base` is unset → default `/`. The app is designed to be served at the
  **web root**, which is exactly how nginx serves it in the production image.

## Runtime flow

```
Browser → nginx (static files) → React app → Web Workers (FK/IK)
        → RuntimeController → Safety → Trajectory → RobotModelAdapter → URDF
```

The production container is a pure static file server; all computation happens
in the browser (main thread + workers).

## Asset requirements

Vite copies `public/` to the `dist/` root. The app fetches these at **absolute
root paths**, so the server must expose them at `/`:

| Asset | Source | Served path |
|---|---|---|
| URDF | `public/robot/6_dof_arm.urdf` | `/robot/6_dof_arm.urdf` |
| Key config | `public/config/key.config.json` | `/config/key.config.json` |
| Workers / JS / CSS | bundled | `/assets/*` (content-hashed) |
| App shell | `index.html` | `/` and SPA fallback |

The production Dockerfile asserts the URDF, key config, and `index.html` exist in
`dist/` before shipping the image (build-time validation).

## Environment variables

Grep shows **no `import.meta.env.*` usage today** — the app is fully
self-contained simulation and needs no env vars, secrets, API keys, or external
services to build or run. `.env.example` documents forward-looking flags
(`VITE_APP_MODE`, `VITE_HARDWARE_ENABLED`, `VITE_AGENT_ENABLED`, `VITE_API_URL`).
Because Vite inlines `VITE_*` at **build time**, these are wired as Docker build
args on the production service; on the dev service they are passed to the Vite
process.

## Deployment assumptions

- Served at web root `/` (no sub-path base). nginx provides SPA fallback so a
  hard refresh on any path returns the app shell.
- Static, stateless, horizontally scalable. No server-side robotics.
- Hardware (ESP32) and agent modes are optional; their absence must never break
  simulation. Default `VITE_HARDWARE_ENABLED=false`, `VITE_AGENT_ENABLED=false`.
- Runtime robotics data (`/config`, `/robot`) is served with revalidation so a
  redeploy is picked up immediately; hashed `/assets` are cached long-term.
