# Gate 3 — Geometric Jacobian and Weighted DLS/LM Inverse Kinematics

Gate 2 must be approved.

Implement:

1. World-space geometric Jacobian from FK joint origins/axes.
2. Finite-difference Jacobian comparison tests.
3. Robust position and tool-axis error.
4. Five-effective-constraint key-press task with free tool roll.
5. Preallocated Float64 small-matrix modules.
6. Cholesky factorization and solve for `(J Jᵀ + λ²I)y=e`.
7. Weighted DLS/LM step, adaptive damping, rejected-step retry.
8. Per-joint step clamp and legal-limit projection.
9. Joint-limit avoidance and redundant-profile posture objective.
10. Stagnation, divergence, numerical failure, singularity, and cancellation handling.
11. Deterministic seed strategy.
12. Post-solve independent FK verification.
13. Unsafe joint-jump diagnostics.
14. Worker request/response API.
15. Key reachability preflight for all hover/contact/descent points.
16. Diagnostics UI for development.

Do not implement the command runtime, joystick, PIN execution, or voice.

Acceptance:

- analytical Jacobian matches finite differences
- all six hover/contact targets solve in competition mode
- final independent FK meets configured position/tool-axis tolerance
- no hardcoded key joint arrays
- invalid/unreachable requests fail clearly
- worker cancellation works
- tests and build pass

If the custom solver misses the agreed time box, report exact failures and propose the pre-approved generalized IK fallback without silently switching.

Stop after the gate report.
