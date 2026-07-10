# Gate 6 — Autonomous PIN Entry

Gate 5 must be approved.

Implement:

1. PIN input with exact six-character validation using existing keys only.
2. Full-sequence preflight before movement.
3. Pose cache keyed by URDF/config/profile/solver settings.
4. Key sequence:
   - safe transition
   - hover
   - Cartesian descent
   - actual contact verification
   - dwell
   - Cartesian retract
5. State-machine progress and active-key highlighting.
6. Stop the whole sequence after a failed press and attempt safe retract.
7. Dry-run preview.
8. Actual target/reached coordinates and error in millimetres.
9. Run report and JSON/CSV export.
10. Required tests:
    - 123456
    - 654321
    - 555555
    - invalid length
    - unsupported digit
    - cancel
    - E-stop
    - failed contact
11. Automated repeatability runner.

Acceptance:

- actual contact error ≤ 0.005 m for every successful press
- 6/6 presses pass
- ten consecutive complete PIN runs pass
- no metric is hardcoded
- tests and build pass

Stop after the gate report.
