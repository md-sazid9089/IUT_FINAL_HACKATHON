# Gate 4 — Unified Command Runtime, Safety Supervisor, and Trajectories

Gate 3 must be approved.

Implement:

1. Discriminated command union and Zod schemas.
2. Command sources and priority rules.
3. Command normalizer and arbitration.
4. Deterministic safety pre-check.
5. Post-IK solution validation.
6. Runtime state machine.
7. Immediate E-stop outside the normal queue.
8. Stop, pause, resume, and explicit E-stop reset.
9. Joint-space quintic minimum-jerk trajectories.
10. Cartesian waypoint planning for press descent/retract.
11. High-frequency runtime state outside React.
12. Throttled Zustand UI snapshots.
13. Event log and human-readable rejection reasons.
14. Tests for concurrency, priority, limit checks, cancellation, and E-stop.

Remove or isolate any Gate 1 debug path that sets joints outside the runtime.

Acceptance:

- every movement goes through the same command/safety/runtime path
- no input adapter or React component sets joints directly
- E-stop cancels by the next runtime tick and blocks new motion
- invalid commands never move the robot
- trajectory respects configured joint velocity limits
- tests and build pass

Stop after the gate report.
