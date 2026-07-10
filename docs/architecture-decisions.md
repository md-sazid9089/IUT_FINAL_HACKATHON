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

## ADR-009 — Six active joints; approach axis as a bounded-tilt preference

**Date:** 2026-07-10 (judge clarification)

**Decision:** Judge clarification confirms that the required system uses six
active arm joints (`joint_1`…`joint_6`). `stylus_pitch` remains locked at 0 rad
and is not a seventh control axis. The key configuration's `approach_axis`
defines the desired Cartesian TCP approach/retract path; exact global
stylus-axis alignment is treated as a **preference subject to a bounded tilt**
(preferred 0°, hard maximum 20°). The `model_7dof` profile is an optional hidden
engineering diagnostic only and must never be used to claim mandatory key
reachability.

**Reason:** Position is the physically meaningful press requirement (≤5 mm).
Forcing perfect straight-down alignment makes the far key column unreachable in
6-DOF, whereas a small bounded tilt (measured worst ≈ 4.4°) reaches all six keys
with `stylus_pitch` locked. This resolves the 6-vs-7 discrepancy in favour of the
judged six-knob hardware interpretation.

**Consequence:** The required preflight and execution path use `competition_6dof`
exclusively. The IK key-press task makes position the hard constraint and
minimises stylus tilt (soft, tool roll free) under a configurable maximum tilt.
