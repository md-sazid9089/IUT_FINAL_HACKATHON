# Dependencies

Exact installed versions for the browser core (Gate 1). All versions are pinned
(no `^`/`~`) in `package.json`, and `package-lock.json` is committed. Regenerate
this file whenever dependencies change.

- **Environment:** Node `v24.11.1`, npm `11.6.2`
- **Install result:** 309 packages added, 0 vulnerabilities.

## Runtime dependencies

| Package | Version | Purpose |
|---|---|---|
| `react` | 19.2.7 | UI |
| `react-dom` | 19.2.7 | DOM renderer |
| `three` | 0.185.1 | 3D engine |
| `@react-three/fiber` | 9.6.1 | React renderer for three |
| `@react-three/drei` | 10.7.7 | Scene helpers (Grid, OrbitControls, Line, Text) |
| `urdf-loader` | 0.13.1 | Browser URDF loading/parsing |
| `zustand` | 5.0.14 | Snapshot state store |
| `zod` | 4.4.3 | Runtime validation of key config |
| `gl-matrix` | 3.4.4 | Spatial math (reserved for FK/IK gates) |

## Dev / tooling dependencies

| Package | Version | Purpose |
|---|---|---|
| `typescript` | 5.9.3 | Strict typecheck |
| `vite` | 8.1.4 | Build/dev server |
| `@vitejs/plugin-react` | 6.0.3 | React + Fast Refresh |
| `vitest` | 4.1.10 | Unit test runner |
| `jsdom` | 29.1.1 | DOM environment for tests |
| `@testing-library/react` | 16.3.2 | Component testing (later gates) |
| `@testing-library/dom` | 10.4.1 | Required peer of testing-library/react |
| `@testing-library/jest-dom` | 6.9.1 | DOM matchers |
| `@types/react` | 19.2.17 | React types |
| `@types/react-dom` | 19.2.3 | React DOM types |
| `@types/three` | 0.185.0 | Three.js types |
| `@types/node` | 24.13.3 | Node types |
| `eslint` | 9.39.4 | Linting |
| `@eslint/js` | 9.39.4 | ESLint recommended config |
| `typescript-eslint` | 8.63.0 | TS lint rules (flat config) |
| `eslint-plugin-react-hooks` | 7.0.0 | React hooks rules |
| `globals` | 17.7.0 | Global definitions for flat config |
| `prettier` | 3.6.2 | Formatting |

## Compatibility verification (why these versions)

Peer dependencies were checked against the npm registry before pinning:

- **React 19 ↔ R3F 9.** `@react-three/fiber@9.6.1` peers require `react >=19 <19.3`
  and `three >=0.156`. React `19.2.7` and three `0.185.1` satisfy both.
- **drei 10 ↔ R3F 9.** `@react-three/drei@10.7.7` peers require `react ^19`,
  `three >=0.159`, `@react-three/fiber ^9.0.0`. All satisfied.
- **urdf-loader.** `urdf-loader@0.13.1` peers require `three >=0.152`. Satisfied.
  The organizer URDF uses only primitive geometry (no mesh files), so no
  `package://` mesh resolution is needed.
- **Vite 8 ↔ plugin-react 6.** `@vitejs/plugin-react@6.0.3` peers require
  `vite ^8.0.0`; its Babel-related peers are marked optional. Vite 8 engines
  require Node `>=22.12` — satisfied by Node 24.
- **Vitest 4.** Peers accept `vite ^8` and Node `>=24`; `jsdom` is an accepted
  environment. Satisfied.
- **testing-library/react 16.** Peers accept `react ^19` and require
  `@testing-library/dom ^10` (pinned `10.4.1`).

### Deliberate downgrades from "latest"

Two packages were intentionally **not** taken at their latest published version
to keep the lint toolchain mutually compatible:

- **TypeScript pinned to 5.9.3 (not 7.0.2).** `typescript-eslint@8.63.0`
  supports `typescript >=4.8.4 <6.1.0`. TypeScript 7 is outside that range and
  would break typed linting. Re-evaluate when `typescript-eslint` adds TS 7
  support.
- **ESLint pinned to 9.39.4 (not 10.x).** `typescript-eslint@8.63.0` does list
  ESLint `^10` as an allowed peer, but ESLint 9 is the conservative, widely
  validated choice for this gate. Revisit in a later gate if needed.
