# Vantage Arm Lab

A browser-first robotic-arm digital twin and software-in-the-loop validation platform for the IUT Final Hackathon.

## Product statement

Every interaction method is an adapter into one validated motion pipeline:

```text
Input
→ normalization
→ schema validation
→ deterministic safety
→ planning
→ IK
→ post-IK validation
→ trajectory execution
→ URDF scene and telemetry
```

## Official resources

The immutable organizer resources are stored in `resources/`.

## Approved architecture

Read:

```text
docs/architecture.md
```

## Copilot execution

Read:

```text
START_HERE.md
COPILOT_MASTER_IMPLEMENTATION_PROMPT.md
prompts/
```

## Core deliverables

- URDF visualization
- live joint and TCP telemetry
- six-key panel at supplied coordinates
- independent FK
- robust IK
- joint, joystick, and keyboard controls
- deterministic voice control with typed fallback
- autonomous six-character PIN using keys 1–6
- ≤5 mm measured contact validation
- deterministic safety gate and E-stop
- electrical PoC
- tests, documentation, deployment, and demo evidence

## Hardware PoC

Hardware is disabled by default. The production concept is:

```text
browser -> Wi-Fi/WebSocket -> ESP32 -> I2C -> PCA9685 -> six servos
```

Only `joint_1` through `joint_6` are mapped to servo channels. `stylus_pitch` is locked at `0 rad` and is not actuated.

See `docs/electrical-poc.md` and `hardware/`.

## Local Release Validation

```text
npm ci
npm run typecheck
npm run lint
npm run test
npm run build
npm run test:e2e
```

Preview a production build:

```text
npm run build
npm run preview
```

## Development rule

Do not skip implementation gates. Do not hardcode key joint solutions. Do not let any UI component or input adapter manipulate URDF joints directly.
