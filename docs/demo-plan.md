# Judge Demo Plan

## Four-minute sequence

### 0:00–0:20 — Problem

Testing control software directly on a robot is slow, costly, and unsafe.

### 0:20–0:45 — Architecture

Show:

```text
INPUT → VALIDATION → SAFETY → IK → TRAJECTORY → DIGITAL TWIN
```

State that all control modes share this pipeline.

### 0:45–1:10 — Digital twin

Rotate the scene, show the key panel, joint telemetry, TCP coordinates, and tool direction.

### 1:10–1:35 — Manual controls

Demonstrate joint slider, joystick, and keyboard.

### 1:35–2:00 — Voice

Say: “Move up two centimetres.”

Show transcript, normalization, safety, motion, and spoken result.

### 2:00–3:00 — PIN

Enter a valid sequence, show preflight, execute, and display measured error per press.

### 3:00–3:25 — Safety

Attempt an unreachable target and show rejection without movement.

### 3:25–3:45 — Electrical PoC

Show ESP32, Wi-Fi, PWM driver, servo rail, and E-stop.

### 3:45–4:00 — Closing

Explain that a future hardware adapter can replace the simulation adapter without changing control, planning, or safety logic.

## Backup package

- local production build
- deployed URL
- complete demo recording
- screenshots
- exported successful run report
