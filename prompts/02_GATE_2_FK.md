# Gate 2 — URDF Chain Extraction and Independent Forward Kinematics

Gate 1 must be approved.

Implement:

1. `gl-matrix` spatial wrapper configured for `Float64Array`.
2. Serializable chain types.
3. Generic `base_link` to `stylus_tip` chain extraction.
4. Correct URDF origin XYZ/RPY transforms.
5. Active, locked revolute, and fixed-joint handling.
6. Independent FK that returns TCP pose, world joint origins, and world joint axes.
7. Worker initialization/protocol for chain storage.
8. Deterministic test fixtures:
   - zero
   - midpoint
   - each individual lower/upper limit
   - mixed signs
   - near extended
   - wrist-downward
   - six-joint profile
   - seven-joint profile
9. 100 seeded legal configurations.
10. Independent browser/render comparison against the actual Three.js `stylus_tip`.
11. Position, quaternion-angle, and tool-axis metrics.
12. Detailed diagnostics on mismatch.

Do not implement Jacobian or IK.

Acceptance:

- position error ≤ 0.0001 m
- orientation error ≤ 0.0001 rad
- tool-axis dot ≥ 0.999999
- all deterministic and seeded tests pass
- locked `stylus_pitch` transform is included
- no NaN/Infinity
- production build passes

Stop after the gate report.
