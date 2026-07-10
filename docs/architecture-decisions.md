# Architecture Decisions

## ADR-001 — Browser-first mandatory core

**Decision:** Run visualization, kinematics, planning, safety, and PIN execution in the browser.

**Reason:** Matches the problem, lowers latency, simplifies deployment, and reduces demo failure points.

## ADR-002 — Unified motion pipeline

**Decision:** Every input becomes a typed command and passes through one deterministic safety/planning/runtime path.

**Reason:** Required by the project story and essential for trustworthiness.

## ADR-003 — Two robot profiles

**Decision:** Default six-joint competition profile; optional seven-joint model-faithful profile.

**Reason:** Resolves the written 6-DOF requirement versus the URDF's additional stylus-pitch joint.

## ADR-004 — URDF-driven kinematics

**Decision:** Extract transforms from URDF rather than authoring a production DH table.

**Reason:** Avoids duplicated geometry and frame-convention errors.

## ADR-005 — Hybrid math layer

**Decision:** `gl-matrix` for spatial math and project-specific Float64 small-matrix/Cholesky code for DLS.

**Reason:** Uses proven rigid-transform primitives while preserving control and diagnostics for the tiny IK system.

## ADR-006 — Worker-based IK

**Decision:** Run IK/preflight in a Web Worker using normal `postMessage`.

**Reason:** Keeps rendering and input responsive without requiring cross-origin isolation.

## ADR-007 — Physics excluded from critical path

**Decision:** Use kinematic contact verification rather than a physics engine.

**Reason:** Explicitly sufficient for the task and much safer for hackathon delivery.

## ADR-008 — Deterministic voice independent from AI

**Decision:** Required voice commands use a deterministic parser. AI is optional and downstream of schema/safety gates.

**Reason:** Protects the core score and offline fallback.
