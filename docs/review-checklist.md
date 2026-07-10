# Gate Review Checklist

Use this before approving every gate.

## General

- [ ] Copilot changed only the requested gate scope.
- [ ] Source-of-truth files are unchanged.
- [ ] No conflicting architecture was introduced.
- [ ] No placeholder is presented as production behavior.
- [ ] Typecheck passes.
- [ ] Lint passes.
- [ ] Relevant tests pass.
- [ ] Production build passes.
- [ ] Copilot reported exact commands and results.
- [ ] Failure cases are visible and explained.

## Architecture

- [ ] UI/input code does not set robot joints directly.
- [ ] Robotics core does not import React.
- [ ] Runtime owns high-frequency state.
- [ ] Zustand receives only throttled UI snapshots.
- [ ] Units and frames are explicit.
- [ ] Six- and seven-joint profiles are configuration-driven.
- [ ] E-stop has an immediate path.
- [ ] AI output cannot bypass safety.

## Kinematics

- [ ] FK is URDF-driven.
- [ ] Locked revolute joints remain in the transform chain.
- [ ] FK comparison tolerance is measured, not claimed.
- [ ] IK returns diagnostics and failure reasons.
- [ ] No hardcoded key joint arrays.
- [ ] Final contact result uses actual runtime TCP.

## Demo readiness

- [ ] Main flow works after page refresh.
- [ ] Invalid input is rejected cleanly.
- [ ] Console has no unexplained errors.
- [ ] UI fits 1366×768.
- [ ] A backup recording exists before the event.
