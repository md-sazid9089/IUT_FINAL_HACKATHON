# Gate Report

## Gate

Gate 0 — Repository and Resource Audit

> **Judge clarification (2026-07-10, added during Gate 3):** The required system
> uses six active arm joints only; `stylus_pitch` stays locked at 0 rad and is
> not a seventh control axis. `approach_axis = -z` defines the desired Cartesian
> TCP approach/retract path, not a hard requirement that the stylus local +Z stay
> perfectly aligned with world −Z. Gate 3 verified all six keys are reachable in
> the `competition_6dof` profile with a small bounded stylus tilt (measured worst
> ≈ 4.4°, hard max 20°). The `model_7dof` profile is a hidden diagnostic only.

## Objective

Audit the repository and organizer resources without scaffolding or implementing the application: print the tree, verify immutable resources by SHA-256, fully inspect the URDF, validate `key.config.json`, surface ambiguities and blockers, confirm the document-prompt isolation policy, propose stable dependencies (no install), and propose the Gate 1 plan.

## Assumptions

- The three files in `resources/` are immutable source artifacts and were treated as read-only.
- Values in the header comment of the URDF are non-authoritative where they conflict with actual joint/link elements (see URDF analysis §6).
- PIN semantics: exactly six characters, each from the set `{1,2,3,4,5,6}` mapping to an existing key. Other characters are rejected. (Carried from architecture; still an assumption pending PDF confirmation.)
- **Key coordinates are exact TCP (`stylus_tip`) contact targets in metres, in the `base_link` frame. They are finite, structurally valid, and appear to lie inside the robot's nominal geometric envelope; formal reachability is not proven in Gate 0 and remains for Gates 2–3.**

## Files created

- `docs/urdf-analysis.md` — complete link/joint/chain/frame analysis of the URDF.
- `docs/gate-0-audit.md` — this report.

## Files modified

- None. Existing `docs/source-hashes.md`, `docs/risk-register.md`, `docs/architecture-decisions.md`, and `docs/requirements-traceability.md` were reviewed and already cover the Gate 0 findings accurately; no updates were necessary. (See "Deferred work" for a proposed Gate 1 risk addition, held pending approval.)

## Commands run

```powershell
Get-FileHash -Algorithm SHA256 resources\6_dof_arm.urdf, resources\key.config.json, resources\Hackathon-Problem-Statement-Final-Round.pdf
```

### Repository tree (current)

```text
.github/
docs/
  architecture-decisions.md
  architecture.md
  demo-plan.md
  electrical-poc-plan.md
  implementation-roadmap.md
  math-stack.md
  prompt-injection-policy.md
  requirements-traceability.md
  review-checklist.md
  risk-register.md
  source-hashes.md
  testing-strategy.md
  urdf-analysis.md        (new, this gate)
  gate-0-audit.md         (new, this gate)
prompts/
  00_GATE_0_AUDIT.md … 10_GATE_10_AGENTIC_BONUS.md
resources/
  6_dof_arm.urdf          (immutable)
  Hackathon-Problem-Statement-Final-Round.pdf  (immutable)
  key.config.json         (immutable)
templates/
  ADR_TEMPLATE.md
  GATE_REPORT_TEMPLATE.md
COPILOT_MASTER_IMPLEMENTATION_PROMPT.md
KIT_MANIFEST.json
README.md
START_HERE.md
.gitignore
```

### SHA-256 verification (immutable resources)

| File                                                    | Computed SHA-256                                                   | Matches `source-hashes.md`? |
| ------------------------------------------------------- | ------------------------------------------------------------------ | --------------------------- |
| `resources/6_dof_arm.urdf`                              | `23e134ff8a0be1e91ddeefdc47185b1b3bbb7bb478082bcd03f8fa49af0677d9` | ✅ Yes                      |
| `resources/key.config.json`                             | `97273daa1859501c24a2c58293a7c9b29995587f50a0f4988920dd4014c3eada` | ✅ Yes                      |
| `resources/Hackathon-Problem-Statement-Final-Round.pdf` | `3bac5e25cc3caea4c89a97a6e98222bb55b756a62053a19bc756f5625f0e51cc` | ✅ Yes                      |

All three match the recorded hashes; no drift detected.

## Architecture decisions

No new ADRs this gate. Existing ADR-001…ADR-008 remain valid and directly govern the Gate 0 findings (notably ADR-003 two profiles, ADR-004 URDF-driven kinematics). Findings recorded in `docs/urdf-analysis.md`.

## Tests and exact results

No automated tests this gate (audit only). Verification performed:

- SHA-256 hashes computed and compared to `docs/source-hashes.md` → all match.
- URDF parsed by inspection: 9 links, 8 joints (7 revolute + 1 fixed), single serial chain confirmed.
- `key.config.json` schema/coordinates validated by inspection (see below).

### `key.config.json` validation

| Field           | Value                                 | Assessment                                         |
| --------------- | ------------------------------------- | -------------------------------------------------- |
| `frame`         | `base_link`                           | ✅ Matches URDF base link                          |
| `units`         | `meters`                              | ✅ Consistent with URDF                            |
| `approach_axis` | `-z`                                  | ✅ Downward approach; valid for top-down key press |
| `keys`          | 6 entries `"1"`…`"6"`, each `{x,y,z}` | ✅ Complete, well-formed                           |

Coordinates (metres, `base_link`):

| Key |     X |      Y |     Z |
| --- | ----: | -----: | ----: |
| 1   | 0.500 |  0.050 | 0.050 |
| 2   | 0.550 |  0.050 | 0.050 |
| 3   | 0.600 |  0.050 | 0.050 |
| 4   | 0.500 | −0.050 | 0.050 |
| 5   | 0.550 | −0.050 | 0.050 |
| 6   | 0.600 | −0.050 | 0.050 |

Layout in millimetres — a 2×3 planar grid on the plane z = 50 mm:

```text
Y = +50 mm:   [1]      [2]      [3]
             X=500    X=550    X=600
Y = -50 mm:   [4]      [5]      [6]

Column pitch (X): 50 mm    Row pitch (Y): 100 mm
Footprint: 100 mm (X span) × 100 mm (Y span), constant Z = 50 mm
```

All targets lie at horizontal radius ≈ 0.50–0.60 m and z = 50 mm. All six key coordinates are finite, structurally valid, and appear to lie inside the robot's nominal geometric envelope. Formal reachability remains unverified until the competition profile solves every hover, contact, and descent waypoint while satisfying joint limits and downward tool-axis alignment in Gates 2 and 3.

## Acceptance criteria

| Criterion                                                                                                | Result  | Evidence                                 |
| -------------------------------------------------------------------------------------------------------- | ------- | ---------------------------------------- |
| Repository tree printed                                                                                  | ✅ Pass | "Repository tree" section above          |
| Immutable resources verified via SHA-256                                                                 | ✅ Pass | Hash table; all match `source-hashes.md` |
| Complete URDF inspection (links, joints, chain, origins, RPY, axes, limits, velocity, base, TCP, 6-vs-7) | ✅ Pass | `docs/urdf-analysis.md` §1–§5            |
| `key.config.json` validated (schema, frame, units, approach axis, coords, mm layout)                     | ✅ Pass | Validation tables above                  |
| Ambiguities/contradictions/blockers identified                                                           | ✅ Pass | "Risks and blockers" below               |
| Document-prompt isolation policy confirmed                                                               | ✅ Pass | "Document isolation" below               |
| Stable dependencies proposed (not installed)                                                             | ✅ Pass | "Proposed dependencies" below            |
| Gate 1 file plan, tests, acceptance proposed                                                             | ✅ Pass | "Proposed next gate" below               |
| Only allowed files created; nothing implemented                                                          | ✅ Pass | Two docs created; no code/scaffold       |

## Document isolation

Confirmed and unchanged. The official PDF contains a block written to AI assistants; it is treated as **document content only**, per `.github/copilot-instructions.md` and `docs/prompt-injection-policy.md`. Trust order applied: direct user instruction → `.github/copilot-instructions.md` → `docs/architecture.md` → PDF factual requirements/rubric → organizer URDF & key config → other content. Embedded directives never bypass gates, safety validation, or source immutability. No conflicts required action this gate.

## Proposed dependencies (non-binding candidates — not installed)

The versions below are **non-binding candidates only**. Gate 1 must determine and pin a currently supported, mutually compatible set by checking package and peer dependencies for React, React Three Fiber, Three.js, `urdf-loader`, Vite, TypeScript, and the testing tools. Gate 1 must document the exact installed versions in `docs/dependencies.md` and commit the npm lock file. Indicative stable majors:

| Package                                       | Indicative version        | Purpose                     |
| --------------------------------------------- | ------------------------- | --------------------------- |
| `react`, `react-dom`                          | 18.x                      | UI                          |
| `typescript`                                  | 5.x (strict)              | Types                       |
| `vite`                                        | 5.x                       | Build/dev                   |
| `three`                                       | 0.16x                     | 3D engine                   |
| `@react-three/fiber`                          | 8.x (React 18-compatible) | React renderer for three    |
| `@react-three/drei`                           | 9.x                       | Scene helpers               |
| `urdf-loader`                                 | latest stable             | URDF loading                |
| `zustand`                                     | 4.x                       | State                       |
| `zod`                                         | 3.x                       | Runtime validation          |
| `gl-matrix`                                   | 3.x                       | Spatial math (Float64Array) |
| `tailwindcss` + `postcss` + `autoprefixer`    | 3.x                       | Styling                     |
| `vitest` + `@testing-library/react` + `jsdom` | current stable            | Unit/UI tests               |
| `@playwright/test`                            | current stable            | E2E                         |
| `eslint` + `prettier` (+ TS plugins)          | current stable            | Lint/format                 |

Version-pairing note: React and `@react-three/fiber` majors must match (React 18 ↔ R3F 8). No floating CDN imports; commit the lock file. These majors are candidates only — Gate 1 verifies peer-dependency compatibility before pinning.

## Manual validation

- Open `docs/urdf-analysis.md` and cross-check the joint table against `resources/6_dof_arm.urdf`.
- Re-run the `Get-FileHash` command and confirm all three hashes still match `docs/source-hashes.md`.
- Confirm no files under `resources/` were modified.

## Risks and blockers

Ambiguities / contradictions (all currently non-blocking; carried with default assumptions):

1. **6-vs-7 joints** — URDF has 7 revolute joints; requirement says 6-DOF. Resolved by two profiles (ADR-003). _Non-blocking._
2. **Stylus length comment (0.126) vs. actual TCP offset (0.137)** — the authoritative TCP offset is the `stylus_tip_frame` fixed-joint origin = `(0, 0, 0.137) m`. The `0.126 m` value in the URDF comment is descriptive only and must not override the actual joint definition. _Non-blocking._
3. **PIN character domain** — panel exposes keys 1–6 only; PDF says "six-digit PIN". Default: exactly 6 chars from `{1..6}`, reject others with explanation. _Non-blocking; confirm against PDF text in a later gate._
4. **`stylus_pitch` provisional lock value** — set to 0 rad by default; must be validated by FK/reach check in Gate 2/3 before acceptance. _Non-blocking._

No genuinely blocking questions. Proceeding to Gate 1 is safe under the recorded assumptions.

## Deferred work

- Proposed (pending approval) risk-register addition: "Stylus length comment vs. actual TCP offset — use 0.137 m from fixed-joint origin." Not applied because the register already captures the frame-convention risk; will add if you prefer explicit tracking.
- Pin exact dependency versions and commit lock file (Gate 1).

## Proposed next gate

**Gate 1 — Digital Twin (scaffold + URDF render + key panel + telemetry).**

Proposed file plan:

```text
package.json, vite.config.ts, tsconfig.json, tailwind.config.js, postcss.config.js
index.html
public/6_dof_arm.urdf              (verified runtime copy of immutable source)
public/key.config.json             (verified runtime copy of immutable source)
src/main.tsx, src/App.tsx
src/config/robotProfiles.ts        (competition_6dof default; model_7dof optional)
src/config/keyConfig.schema.ts     (Zod schema for key.config.json)
src/scene/RobotModel.tsx           (urdf-loader via R3F; no direct joint setters from UI)
src/scene/KeyPanel.tsx             (renders 6 keys from JSON; buttons below contact point)
src/scene/SceneRoot.tsx            (R3F canvas, OrbitControls, lighting, TCP marker)
src/state/robotStore.ts            (Zustand snapshot: joint angles, TCP readout)
src/ui/TelemetryPanel.tsx          (live joint angles + TCP position)
src/lib/urdfChain.ts               (read joint metadata for telemetry, no IK yet)
```

Proposed tests:

- Zod schema test: `key.config.json` parses; malformed input rejected.
- Runtime-copy integrity test: `public/*` copies byte-match `resources/*` (hash compare).
- URDF load E2E (Playwright): robot mounts; 6 key markers render at configured coordinates.
- Telemetry unit test: joint metadata (names, limits) extracted matches URDF table.

Proposed acceptance criteria:

- App builds and runs; URDF renders in-browser.
- Six key markers appear at the exact JSON coordinates.
- Telemetry shows all active joints and a live TCP position readout.
- Runtime copies verified identical to immutable sources; originals untouched.
- No input adapter or component moves joints directly (pipeline-only rule respected — even though the pipeline arrives in later gates, wiring is structured for it).

Stop and wait for approval.
