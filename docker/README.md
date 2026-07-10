# Docker quick reference

Container infrastructure for the robotics digital twin. **No robotics logic,
algorithms, URDF, key config, or safety limits are modified** — this is
deployment tooling only. The app runs identically inside and outside Docker.

## Files

| File                    | Purpose                                                  |
| ----------------------- | -------------------------------------------------------- |
| `../Dockerfile`         | Production multi-stage build → nginx static server       |
| `../Dockerfile.dev`     | Development image (Vite dev server, hot reload)          |
| `../docker-compose.yml` | `dev` and `prod` service profiles                        |
| `../nginx.conf`         | SPA routing, gzip, caching, security headers, `/healthz` |
| `../.dockerignore`      | Keeps images small and reproducible                      |
| `../.env.example`       | Optional, secret-free build/runtime flags                |

## Development

```bash
docker compose --profile dev up --build
# → http://localhost:5173  (hot reload; ./ is bind-mounted)
```

## Production

```bash
# Compose
docker compose --profile prod up --build
# → http://localhost:8080

# Or plain Docker
docker build -t robotics-twin .
docker run --rm -p 8080:80 robotics-twin
# → http://localhost:8080 ; health at http://localhost:8080/healthz
```

## Notes

- **Base path**: the app is served at web root `/`. nginx provides SPA fallback,
  so a hard refresh on any path returns the app shell.
- **Assets**: `/robot/6_dof_arm.urdf` and `/config/key.config.json` are served
  from the bundle root and validated at build time.
- **Workers**: FK/IK web workers are hashed `/assets/*` chunks — no `localhost`
  dependency and nothing to configure.
- **No secrets**: images contain only the static bundle (prod) or source +
  dependencies (dev). No API keys or tokens are baked in.
- **Non-root**: nginx runs its worker processes as the unprivileged `nginx`
  user. For a fully rootless runtime, swap the runtime stage base image to
  `nginxinc/nginx-unprivileged:1.27-alpine` and map `8080:8080`.

See `../docs/containerization.md` for architecture and troubleshooting.
