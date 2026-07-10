# Gate 5 — Joint, Joystick, and Keyboard Controls

Gate 4 must be approved.

Implement:

1. Production joint-control panel through the shared pipeline.
2. XY joystick with pointer capture and dead zone.
3. Separate Z control.
4. Precision/normal/fast modes.
5. Keyboard state controller:
   - W/S: ±Y
   - A/D: ±X
   - R/F: ±Z
   - Shift: fast
   - Alt: precision
   - H: home
   - Space: stop
   - Escape: E-stop
6. Fixed-rate jog generation, not browser key repeat.
7. Stop on blur, hidden tab, pointer loss, and unmount.
8. Ignore shortcuts while typing.
9. Reject manual motion during autonomous execution unless cancelled.
10. Tests proving joystick and keyboard normalize into the same command model.

Acceptance:

- responsive visible movement
- no stuck controls
- all limits/safety rules enforced
- telemetry and pipeline status update
- tests and build pass

Stop after the gate report.
