# Requirements Traceability Matrix

Update the implementation-status and evidence columns after every gate.

| ID | Requirement | Source | Planned component | Test/evidence | Status |
|---|---|---|---|---|---|
| R-01 | Load and render supplied URDF in browser | PDF Phase 1 | RobotModelAdapter, R3F scene | URDF load E2E test | Planned |
| R-02 | Show live joint angles | PDF Phase 1 | Telemetry panel | UI integration test | Planned |
| R-03 | Show live end-effector position | PDF Phase 1 | Runtime telemetry | FK/renderer comparison | Planned |
| R-04 | Render six-key panel from JSON | PDF Phase 1, JSON | KeyPanel | Coordinate validation test | Planned |
| R-05 | Implement IK for target XYZ | PDF Phase 2 | Kinematics worker | IK round-trip and key tests | Planned |
| R-06 | GUI joystick control | PDF Phase 2 | Joystick adapter | Adapter integration test | Planned |
| R-07 | Keyboard control | PDF Phase 2 | Keyboard adapter | Blur/key-up safety tests | Planned |
| R-08 | Deterministic voice control | PDF Phase 3 | Voice parser/adapter | Parser fixtures and manual test | Planned |
| R-09 | Autonomous six-character PIN | PDF Phase 4 | PIN planner/executor | 123456, 654321, 555555 | Planned |
| R-10 | Press error within 5 mm | PDF Phase 4 | Contact verifier | Actual TCP error report | Planned |
| R-11 | Electrical PoC with Wi-Fi and servos | PDF Phase 5/rubric | Electrical docs | Wokwi screenshot and schematic | Planned |
| R-12 | Shared motion-control pipeline | PDF architecture language | Command/safety/runtime | Source audit and integration tests | Planned |
| R-13 | Agent output deterministically validated | PDF Phase 3B | Agent adapter + safety | Unsafe-plan rejection tests | Optional |
| R-14 | Working app and repository diagrams | PDF deliverables | Whole repository | Build, docs, rubric map | Planned |
| R-15 | Deployed URL | PDF bonus | Static deployment | Public smoke test | Bonus |
| R-16 | Demo video | PDF bonus | Presentation assets | Recorded fallback | Bonus |
