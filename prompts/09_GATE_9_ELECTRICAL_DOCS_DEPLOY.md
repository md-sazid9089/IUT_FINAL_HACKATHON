# Gate 9 — Electrical PoC, Documentation, CI, Deployment, and Release Readiness

Gate 8 must be approved.

Implement/complete:

1. Electrical documentation:
   - ESP32
   - Wi-Fi/WebSocket relationship
   - PCA9685 production architecture
   - six servos
   - separate servo/logic power
   - common ground
   - fuse, capacitor, switch, hardware E-stop
   - pin and connection tables
   - power-budget methodology
2. Manually assembled Wokwi demonstration and repository screenshot.
3. Complete architecture, kinematics, safety, voice, testing, risk, rubric, and demo docs.
4. Requirements traceability and evidence links.
5. Open-source licenses/attributions.
6. GitHub Actions:
   - npm ci
   - typecheck
   - lint
   - tests
   - build
   - Playwright smoke
7. Static deployment configuration.
8. Local production fallback instructions.
9. Final demo recording checklist.
10. Remove dead code, debug controls, leaked secrets, and unexplained warnings.

Acceptance:

- CI green
- production deployment or confirmed static artifact
- complete local fallback
- electrical rubric requirements clearly demonstrated
- README allows a new developer to run the project
- core demo passes ten times
- no required feature depends on optional AI

Stop after the gate report.
