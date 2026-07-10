# GitHub Copilot Master Implementation Prompt

You are the Principal Software Architect, Senior Robotics Engineer, Senior Frontend Engineer, Test Engineer, DevOps Engineer, and Hackathon Technical Lead for this project.

Your task is to implement a production-quality, browser-based robotic-arm digital twin and control suite for a competitive hackathon final round. The system must be technically correct, visually polished, maintainable, safe by design, and easy to demonstrate to judges.

Do not treat this as a simple Three.js animation. Build it as a software-in-the-loop robotics validation platform.

---

## 1. Source of truth

Before changing any code, fully inspect every file currently present in the repository, especially:

- The official final-round problem statement PDF.
- The organizer-provided URDF file.
- The organizer-provided `key.config.json`.
- Any architecture, planning, rubric, hardware, or supporting documents.

The organizer files are authoritative. Do not silently modify their contents. Copy them into appropriate application asset locations while preserving the originals.

Expected organizer asset locations in the final repository:

```text
public/robot/6_dof_arm.urdf
public/config/key.config.json
docs/reference/Hackathon-Problem-Statement.pdf
```

If the filenames differ, locate the real files and use those exact files.

---

## 2. Core objective

Build a browser-first digital twin for a robotic arm that can:

1. Load and render the supplied URDF accurately.
2. Render the six-key test panel using the supplied coordinates.
3. Show live joint angles and end-effector/TCP position.
4. Support joint-level manual control.
5. Support Cartesian joystick control.
6. Support keyboard jogging.
7. Support deterministic voice commands.
8. Accept a six-character PIN using keys `1` through `6` and press each key autonomously.
9. Validate every command through one shared deterministic safety pipeline.
10. Produce measurable evidence of accuracy and repeatability.
11. Include a documented ESP32 + servo-driver electrical proof of concept.
12. Optionally support agentic natural-language control without allowing AI to bypass safety.

The system story is:

> Every input method is only an adapter into the same validated motion-control pipeline.

There must not be separate motion implementations for joystick, keyboard, voice, PIN automation, or AI.

---

## 3. Non-negotiable architectural decisions

### 3.1 Browser-first core

The core simulation, kinematics, command handling, safety, trajectory generation, telemetry, and autonomous PIN execution must run locally in the browser.

Do not add a traditional backend, database, authentication system, Docker stack, ROS dependency, or physics engine for the mandatory core.

A serverless endpoint is allowed only for the optional agentic language feature and must not hold robot state or execute motion.

### 3.2 Unified command pipeline

Every movement must pass through:

```text
Input Adapter
→ Command Normalization
→ Runtime Schema Validation
→ Command Dispatcher
→ Deterministic Safety Supervisor
→ Motion Planner
→ IK Solver when required
→ Trajectory Generator
→ Robot Runtime
→ URDF Scene + Telemetry + Event Log
```

Input adapters must never call the URDF model's joint setters directly.

### 3.3 Six-DOF versus seven actuated joints

The written problem describes a six-DOF arm with a fixed stylus, but the supplied URDF is expected to contain:

```text
joint_1
joint_2
joint_3
joint_4
joint_5
joint_6
stylus_pitch
```

Implement configuration-driven robot profiles:

```text
competition_6dof
- Active joints: joint_1 through joint_6
- stylus_pitch: locked to a configured value
- Default profile for judging

model_7dof
- Active joints: joint_1 through joint_6 plus stylus_pitch
- Expose the seventh joint as "Tool Pitch"
- Optional diagnostic/advanced mode
```

Never hardcode the solver to exactly six joints. It must accept an active-joint list.

### 3.4 PIN interpretation

The test panel contains keys `1` through `6` only.

Therefore:

- PIN length must be exactly six characters.
- Every character must be one of `1`, `2`, `3`, `4`, `5`, or `6`.
- Unsupported digits must be rejected clearly.
- Do not silently remap unsupported digits.

### 3.5 Key configuration

Treat the positions in `key.config.json` as exact stylus-tip contact targets in `base_link`, measured in metres.

Expected approach direction:

```text
-z
```

Treat each key target as a contact point, not as the visual centre of a box.

The panel geometry must be positioned so its top/contact surface matches the configured Z coordinate.

### 3.6 Key-press success

A press succeeds only when:

```text
distance(TCP, targetKeyPoint) <= 0.005 metres
```

Always calculate and display the real measured error in millimetres.

---

## 4. Required technology stack

Use compatible, stable package versions and lock them in the package lockfile.

Mandatory stack:

- React
- TypeScript with strict mode
- Vite
- Three.js
- React Three Fiber
- `urdf-loader`
- Zustand
- Zod
- Tailwind CSS
- Radix UI primitives where useful
- Web Worker for IK and planning
- Vitest
- React Testing Library
- Playwright
- ESLint
- Prettier
- GitHub Actions

For small-matrix numerical operations, use a reliable compatible library such as `ml-matrix`, while keeping the serial-chain IK algorithm and robotics logic inside this repository.

Do not introduce a large general-purpose robotics framework into the production dependency graph unless the custom serial-chain IK approach is proven infeasible.

---

## 5. Repository architecture

Create or evolve the repository toward this structure:

```text
vantage-arm-lab/
├── public/
│   ├── robot/
│   │   └── 6_dof_arm.urdf
│   └── config/
│       └── key.config.json
│
├── src/
│   ├── app/
│   │   ├── App.tsx
│   │   └── providers/
│   │
│   ├── config/
│   │   ├── robot-profiles.ts
│   │   ├── motion-config.ts
│   │   └── feature-flags.ts
│   │
│   ├── core/
│   │   ├── commands/
│   │   │   ├── command-types.ts
│   │   │   ├── command-schemas.ts
│   │   │   ├── command-dispatcher.ts
│   │   │   └── command-queue.ts
│   │   │
│   │   ├── kinematics/
│   │   │   ├── forward-kinematics.ts
│   │   │   ├── jacobian.ts
│   │   │   ├── pose-error.ts
│   │   │   ├── dls-ik.ts
│   │   │   └── joint-limits.ts
│   │   │
│   │   ├── planning/
│   │   │   ├── waypoint-planner.ts
│   │   │   ├── key-pose-planner.ts
│   │   │   ├── pin-planner.ts
│   │   │   └── trajectory-generator.ts
│   │   │
│   │   ├── runtime/
│   │   │   ├── robot-runtime.ts
│   │   │   ├── execution-machine.ts
│   │   │   └── emergency-stop.ts
│   │   │
│   │   ├── safety/
│   │   │   ├── safety-supervisor.ts
│   │   │   ├── workspace-validator.ts
│   │   │   └── safety-errors.ts
│   │   │
│   │   └── telemetry/
│   │       ├── telemetry-service.ts
│   │       ├── run-recorder.ts
│   │       └── report-generator.ts
│   │
│   ├── robot/
│   │   ├── robot-model-adapter.ts
│   │   ├── urdf-robot-adapter.ts
│   │   └── robot-profile.ts
│   │
│   ├── workers/
│   │   ├── ik.worker.ts
│   │   └── worker-client.ts
│   │
│   ├── adapters/
│   │   ├── joystick/
│   │   ├── keyboard/
│   │   ├── deterministic-voice/
│   │   └── agent/
│   │
│   ├── scene/
│   │   ├── RobotScene.tsx
│   │   ├── UrdfRobot.tsx
│   │   ├── KeyPanel.tsx
│   │   ├── MotionPath.tsx
│   │   ├── TargetMarker.tsx
│   │   └── CameraPresets.tsx
│   │
│   ├── features/
│   │   ├── dashboard/
│   │   ├── manual-control/
│   │   ├── voice-control/
│   │   ├── pin-entry/
│   │   ├── safety-console/
│   │   └── diagnostics/
│   │
│   ├── store/
│   ├── types/
│   └── utils/
│
├── tests/
│   ├── unit/
│   ├── integration/
│   └── fixtures/
│
├── e2e/
├── docs/
├── .github/workflows/
├── LICENSES.md
├── README.md
└── package.json
```

Adapt this structure only when the repository already has an equivalent clean structure. Do not create duplicate architectural layers.

---

## 6. Coding standards

- TypeScript strict mode must remain enabled.
- Do not use `any` unless wrapping an unavoidable third-party type gap, and document it.
- Prefer pure functions for mathematical code.
- React must not be imported into robotics core modules.
- UI components must not contain IK or safety logic.
- Use dependency inversion around the robot model.
- Use discriminated unions for command types and execution states.
- Validate all external JSON and optional AI output with Zod.
- Keep SI units internally: metres, radians, seconds.
- Convert to millimetres/degrees only for display.
- Avoid hidden magic numbers; place tunable values in typed config.
- Add concise comments explaining mathematical or safety-critical reasoning.
- Do not create placeholder files or TODO-only implementations.
- Do not fake telemetry, accuracy, reachability, safety results, or successful key presses.
- Never hardcode solved joint values for the six keys.
- Do not modify organizer-provided coordinates to make the demo pass.
- Preserve deterministic operation when network access is unavailable.

---

## 7. Domain command model

Implement a discriminated command union containing at least:

```text
CARTESIAN_JOG
MOVE_TO_POSITION
MOVE_TO_POSE
JOINT_JOG
MOVE_TO_JOINTS
PRESS_KEY
EXECUTE_PIN
HOME
PAUSE
RESUME
STOP
EMERGENCY_STOP
RESET_EMERGENCY_STOP
```

Each command must include:

```text
id
source
type
payload
timestamp
priority
requestedMode
```

Valid sources:

```text
dashboard
joystick
keyboard
voice
autonomous
agent
system
```

Each command should produce an auditable lifecycle:

```text
received
normalized
validated
approved or rejected
planned
executing
completed, cancelled, or failed
```

Record failure reasons in a machine-readable code and human-readable explanation.

---

## 8. Robot model adapter

Create an adapter around `urdf-loader` rather than exposing loader-specific APIs throughout the application.

Required capabilities:

```text
load()
validateRequiredFrames()
getJointDefinitions()
getActiveKinematicChain()
setJointPositions()
getJointPositions()
getTcpPose()
getBasePose()
reset()
```

At load time:

- Verify `base_link` exists.
- Locate the actual TCP frame from the URDF, expected to be `stylus_tip` or the equivalent final stylus frame.
- Discover joints, axes, limits, origins, and parent-child relationships.
- Fail visibly with a precise error if the expected chain cannot be built.
- Preserve the original URDF geometry and limits.

---

## 9. Forward kinematics and validation

Implement independent serial-chain forward kinematics using the URDF joint origins and axes.

Do not rely exclusively on the Three.js scene graph for the robotics math.

Create a strong verification test:

1. Generate legal joint configurations.
2. Apply them to the URDF scene graph.
3. Read the rendered TCP world transform.
4. Compute the TCP transform using the independent FK implementation.
5. Compare position and orientation within a tight tolerance.

This test is mandatory before implementing production IK.

---

## 10. Inverse kinematics

Implement a custom serial-chain damped-least-squares Jacobian IK solver.

Base update:

```text
Δq = Jᵀ (J Jᵀ + λ² I)⁻¹ e
```

Requirements:

- Accept a configurable active-joint list.
- Seed from the current joint configuration.
- Support position-only and position-plus-tool-axis targets.
- Use high position weight for key pressing.
- Align the stylus pointing axis with global `-Z` for a press.
- Do not overconstrain rotation around the stylus's own axis.
- Support adaptive damping.
- Clamp each iteration's joint update.
- Project or clamp to legal joint limits.
- Penalize movement toward joint limits.
- Detect stagnation.
- Detect divergence.
- Enforce maximum iterations.
- Try a small number of deterministic alternate seeds when needed.
- Verify the final result using FK before returning success.
- Return detailed diagnostics.

Return type must include:

```text
success
jointPositions
positionErrorMeters
orientationErrorRadians
iterations
conditionIndicator
failureCode
failureMessage
```

Start with configurable values near:

```text
position convergence: 0.002 to 0.003 m
press acceptance: 0.005 m
orientation convergence: approximately 5 to 10 degrees
maximum iterations: 80
base damping: approximately 0.05 to 0.10
maximum step: approximately 0.08 to 0.12 rad
alternate seeds: no more than 3
```

These are starting configuration values, not immutable constants.

For seven-DOF mode, add a null-space objective that:

- Keeps the solution near the current posture.
- Avoids joint limits.
- Reduces unnecessary tool-pitch motion.
- Produces visually stable elbow configurations.

Run IK and planning inside a Web Worker. Pass only serializable data such as numbers, arrays, typed arrays, and plain objects.

Do not require `SharedArrayBuffer`.

---

## 11. Motion planning and trajectories

### 11.1 Travel motion

For general travel:

- Solve a valid target joint configuration.
- Generate smooth joint-space motion.
- Use a quintic minimum-jerk interpolation:

```text
s(t) = 10t³ - 15t⁴ + 6t⁵
```

Respect configured joint velocity limits.

### 11.2 Key press motion

For each key target `K` and approach axis `A`:

```text
hover = K - A * clearance
contact = K
retract = hover
```

With `A = (0, 0, -1)` and default clearance `0.03 m`, hover must be above the key.

Press sequence:

1. Validate target.
2. Move to a safe transition pose when needed.
3. Move to hover.
4. Verify hover accuracy.
5. Generate Cartesian waypoints from hover to contact.
6. Solve waypoints sequentially using the previous solution as the next seed.
7. Verify TCP contact error.
8. Mark success only when error is at most 5 mm.
9. Dwell for a configurable short interval, initially around 250 ms.
10. Retract through Cartesian waypoints.

Do not use simple joint interpolation for the final descent because the TCP path may curve.

---

## 12. Autonomous PIN execution

Implement:

- Exact six-character validation.
- Characters restricted to `1` through `6`.
- Full preflight before motion starts.
- Reachability checks for every hover and contact pose.
- Estimated duration.
- Predicted errors.
- Current-digit progress.
- Cancellation.
- Failure handling.
- Safe retract after a recoverable execution failure.
- Run evidence report.

Execution states:

```text
IDLE
VALIDATING_PIN
PREFLIGHTING
MOVING_TO_SAFE_POSE
MOVING_TO_HOVER
DESCENDING
VERIFYING_CONTACT
DWELLING
RETRACTING
NEXT_DIGIT
COMPLETED
FAILED
SAFE_RETRACT
STOPPED
```

If a press fails, stop the overall sequence and report exactly why.

At application startup, build a key-pose cache:

- Generate hover and contact targets for all six keys.
- Solve and validate all target configurations.
- Record reachability and diagnostics.
- Do not hardcode solutions.
- Invalidate the cache when the robot profile, joint limits, key config, or orientation policy changes.

---

## 13. Safety supervisor

The safety supervisor must validate every command source.

Checks must include:

- Command schema.
- Source permission.
- Current operating mode.
- Coordinate frame.
- Numeric validity.
- Units.
- Joint limits.
- Workspace bounds.
- Maximum Cartesian displacement.
- Maximum joint displacement.
- Velocity limits.
- IK reachability.
- Command concurrency.
- Current execution state.
- PIN validity.
- Voice parsing certainty.
- Agent-output schema.
- Emergency-stop state.

Emergency stop requirements:

- Must bypass the normal queue.
- Must stop trajectory progression on the next runtime tick.
- Must clear queued commands.
- Must block all new movement.
- Must require explicit manual reset.
- Must never reset automatically.

Also stop manual jogging when:

- The browser window loses focus.
- The tab becomes hidden.
- A joystick pointer is released or capture is lost.
- Relevant keyboard keys are released.

---

## 14. Runtime, performance, and state

Use three runtime contexts:

### Main thread

- React UI.
- Three.js rendering.
- Input events.
- Lightweight telemetry snapshots.

### IK/planning worker

- Jacobian calculations.
- IK iterations.
- PIN preflight.
- Cartesian waypoint solving.

### Optional serverless agent endpoint

- Language interpretation only.
- No robot state ownership.
- No direct execution authority.

Do not put 60 Hz numerical runtime state into React state.

Maintain high-frequency state inside the robot runtime:

- Joint vector.
- TCP pose.
- Current trajectory.
- Target.
- Velocity.
- Interpolation progress.

Publish UI snapshots to Zustand around 10 to 20 Hz.

The Three.js scene should read and apply runtime joint values during `requestAnimationFrame`.

Performance targets:

- Approximately 55 to 60 FPS on a typical judging laptop.
- Manual controls should feel responsive within 100 ms.
- No full dashboard rerender on every animation frame.
- Memoize stable scene components.
- Avoid creating new Three.js objects inside every frame.
- Dispose Three.js resources when unmounting.

---

## 15. Manual controls

### Joint controls

Provide one slider per active joint showing:

- Current value.
- Legal minimum and maximum.
- Degrees for users.
- Radians optionally in diagnostics.
- Reset/home actions.

Joint slider commands still pass through the safety supervisor.

### Cartesian joystick

Provide:

- XY joystick.
- Separate Z control.
- Dead zone.
- Precision, normal, and fast modes.
- Clear direction feedback.

Initial step sizes:

```text
precision: 0.001 m
normal: 0.005 m
fast: 0.010 m
```

### Keyboard

Recommended mapping:

```text
W / S: +Y / -Y
A / D: -X / +X
R / F: +Z / -Z
Shift: faster
Alt: precision
H: home
Space: stop
Escape: emergency stop
```

Do not rely on browser auto-repeat. Track keydown and keyup state and generate controlled jog commands from a fixed loop.

Ignore movement shortcuts while the user is typing in an input.

Disable or reject manual movement during autonomous execution until the operator cancels the active sequence.

---

## 16. Deterministic voice control

The mandatory voice feature must work independently from any LLM.

Implement push-to-talk using browser speech recognition when supported.

Always provide a typed-command fallback that uses the exact same deterministic parser.

Support commands such as:

```text
move up
move left five centimetres
move the tip forward ten millimetres
rotate the base thirty degrees
move joint three minus fifteen degrees
go home
stop
press key five
enter PIN one two three four five six
```

Parser requirements:

- Normalize case and punctuation.
- Support common direction synonyms.
- Convert number words to numbers.
- Parse metres, centimetres, millimetres, degrees, and radians.
- Convert to SI units internally.
- Return structured commands only.
- Ask for clarification instead of guessing when distance or intent is ambiguous.
- Display transcript, interpretation, safety result, and execution outcome.
- Use speech synthesis for confirmation and outcome feedback when available.

Voice failure must never result in arbitrary motion.

---

## 17. Optional agentic control

Implement only after the full core is stable and tested.

The AI is an interpreter/planner, not a robot controller.

Flow:

```text
Speech or typed natural language
→ Optional language endpoint
→ Whitelisted structured plan
→ Zod validation
→ Deterministic safety supervisor
→ User preview/confirmation for multi-step plans
→ Existing command pipeline
```

Allowed agent actions:

```text
move_relative
move_to_position
joint_jog
press_key
execute_pin
home
stop
```

The agent must never output or execute:

- JavaScript.
- Arbitrary code.
- Direct URDF mutations.
- Safety overrides.
- Raw untyped joint arrays.
- Unknown command types.

Agent safeguards:

- Feature flag.
- Maximum five actions per plan.
- Maximum movement per action.
- Maximum total movement.
- Strict unknown-field rejection.
- Explicit unit validation.
- Clarifying question for ambiguous language.
- Human confirmation before multi-step execution.
- Complete audit log.
- Immediate cancellation support.

The mandatory deterministic voice system must remain fully usable when the agent feature is disabled or offline.

---

## 18. UI/UX requirements

Use a professional industrial dark interface:

- Charcoal background.
- Steel-grey panels.
- Amber/gold accents matching the arm.
- Green for safe and successful states.
- Yellow for warnings.
- Red only for faults, stop, and emergency stop.

Avoid excessive gradients, glassmorphism, playful animations, or gaming-style visuals.

Desktop-first layout:

```text
Top safety/status bar
- Brand
- Robot profile
- Operating mode
- Safety state
- Home
- Stop
- Large emergency-stop button

Main area
- Large 3D digital twin viewport
- Right-side control console with tabs

Bottom telemetry area
- Joint values
- TCP position
- Target
- Error
- IK status
- Active command
- Event history
```

Control tabs:

```text
Manual
Voice
Autonomous PIN
Joints
Diagnostics
```

3D scene must include:

- URDF arm.
- Six-key panel.
- Key labels.
- Ground grid.
- Base-frame axes.
- TCP marker.
- Current target marker.
- Lighting.
- Shadows where performance allows.
- Orbit camera controls.
- Overview, side, top, tool, and panel camera presets.

High-value scene additions:

- Planned path.
- Hover marker.
- Contact marker.
- Active-key highlight.
- Motion trail.
- Ghost target.
- Optional workspace boundary.

Add a visible live pipeline indicator, for example:

```text
VOICE
→ NORMALIZED
→ SAFETY PASSED
→ IK CONVERGED
→ TRAJECTORY EXECUTING
→ 2.4 mm ERROR — SUCCESS
```

Design for 1366×768 and 1920×1080 first. Do not sacrifice the desktop judging experience for mobile-first design.

---

## 19. Evidence and judge-impressing features

After the mandatory core is stable, implement these in order:

### Tier A

1. Dry-run PIN preview.
2. Per-key measured-error display.
3. Repeatability benchmark.
4. Run replay.
5. JSON and CSV run evidence export.
6. Singularity/conditioning indicator.
7. Guided judge mode.
8. Clear "why rejected" safety explanations.

Repeatability report should include:

- Mean positional error.
- Maximum error.
- Standard deviation.
- Success rate.
- Average execution time.

Do not fake or precompute report values.

### Tier B

- Workspace heatmap.
- Soft collision warnings.
- Bilingual deterministic commands.
- PWA support.
- Planned versus actual path comparison.
- Joint velocity charts.

### Tier C

- Agentic voice.
- On-device speech models.
- ROS bridge.
- Physics simulation.
- Multi-robot support.

Do not begin Tier C before all mandatory acceptance tests pass.

---

## 20. Electrical proof-of-concept documentation

Do not generate fake hardware behavior inside the web app.

Create professional documentation and diagrams for:

```text
Browser dashboard
→ Wi-Fi/WebSocket
→ ESP32
→ I2C
→ PCA9685 PWM driver
→ Six servo motors
```

Document:

- ESP32 controller.
- PCA9685 servo driver.
- Six servos for six-DOF compliance.
- Optional tool-pitch output as a future extension.
- Separate 5–6 V servo supply.
- Logic supply.
- Common ground.
- Fuse/resettable fuse.
- Main switch.
- Hardware emergency stop.
- Bulk capacitor near servo power.
- Status LED.
- Optional buzzer.

State clearly:

```text
ESP32 3.3 V → PCA9685 logic VCC
Dedicated servo PSU 5–6 V → PCA9685 V+
All grounds connected
Do not power all servos from the ESP32 board
```

Do not invent a final power-supply rating without a real servo specification.

Provide the formula:

```text
I_supply = numberOfServos × peakCurrentPerServo × simultaneityFactor × safetyMargin
```

Create:

- Electrical block diagram.
- Pin-mapping table.
- Connection list.
- Power-domain explanation.
- Safety explanation.
- Wokwi build instructions or screenshot guidance.

Do not auto-generate a complete Wokwi/Tinkercad simulator project JSON.

---

## 21. Testing requirements

### Unit tests

Configuration:

- Validate base frame.
- Validate units.
- Validate six key targets.
- Validate approach axis.
- Reject malformed config.

Kinematics:

- Known-pose FK tests.
- Random legal FK tests.
- Jacobian comparison against numerical differentiation.
- IK round-trip tests.
- Joint-limit enforcement.
- Six-DOF and seven-DOF profile tests.
- Unreachable target failure.
- Stagnation/divergence failure.

Commands and safety:

- Every command schema.
- Queue priority.
- Stop behavior.
- Emergency-stop behavior.
- Unsupported command rejection.
- Mode conflict rejection.

Voice:

- Number words.
- Units.
- Directions.
- Negative angles.
- Ambiguous commands.
- Unsupported requests.

PIN:

- `123456`.
- `654321`.
- `555555`.
- Invalid length.
- Unsupported characters.
- Cancellation halfway.
- Failed key press.

### Integration tests

- Joystick and keyboard produce equivalent normalized commands.
- Voice uses the same safety supervisor as manual control.
- PIN uses the same IK and runtime pipeline.
- Emergency stop interrupts every source.
- Agent output cannot bypass validation.
- UI telemetry matches runtime state.

### End-to-end tests

At minimum:

1. Application loads URDF and keys.
2. Joint slider updates robot and telemetry.
3. Keyboard jog works and stops on key release.
4. Emergency stop blocks movement until reset.
5. A valid PIN preflights and executes.
6. An invalid PIN is rejected.
7. A typed voice command produces a safe structured action.

---

## 22. Acceptance criteria

Do not declare the project complete until all of these are true:

```text
All six keys are reachable in competition_6dof mode, or any genuine impossibility is documented with evidence.
Every successful key contact has measured TCP error <= 5 mm.
A valid six-character PIN completes all six presses in order.
The same valid PIN flow succeeds ten consecutive times.
Joystick, keyboard, voice, and PIN all use the shared command pipeline.
No input adapter sets joints directly.
Emergency stop halts active motion and blocks further commands.
The mandatory core works without an LLM or backend.
There are zero unhandled runtime exceptions in the demo flow.
Production build succeeds.
Critical tests pass.
The application remains responsive on the judging laptop.
```

Target internal quality metrics:

```text
IK target error: <= 3 mm where feasible
Render performance: approximately 55–60 FPS
Manual input feedback: under 100 ms
Emergency stop: next runtime tick
Core offline availability after assets load: 100%
```

---

## 23. CI, deployment, and documentation

Create package scripts for at least:

```text
dev
build
preview
typecheck
lint
format
test
test:watch
test:e2e
```

Create GitHub Actions that run:

1. Install from lockfile.
2. Typecheck.
3. Lint.
4. Unit tests.
5. Integration tests.
6. Production build.
7. Playwright smoke test.

Keep the core statically deployable to Vercel, Netlify, or GitHub Pages.

Create professional documentation:

```text
README.md
docs/architecture.md
docs/requirements-traceability.md
docs/kinematics.md
docs/motion-planning.md
docs/safety-case.md
docs/voice-design.md
docs/electrical-poc.md
docs/testing-report.md
docs/rubric-mapping.md
docs/demo-script.md
LICENSES.md
```

README must include:

- Problem summary.
- Architecture diagram.
- Setup commands.
- Project scripts.
- Feature overview.
- Safety design.
- Demo steps.
- Known limitations.
- Browser requirements.
- Open-source attribution.

Do not claim a feature is complete unless it is implemented and tested.

---

## 24. Implementation workflow

Do not attempt the full project as one uncontrolled code dump.

Implement in gates. A gate is complete only when its tests and exit criteria pass.

### Gate 0 — Repository and requirement audit

- Inspect all files.
- Report current repository structure.
- Extract exact URDF joints, frames, limits, and TCP.
- Validate the key config.
- Record assumptions and ambiguities.
- Create an implementation checklist mapped to the rubric.

Exit condition:

- No unresolved file-discovery issue.
- Exact robot chain documented.
- Build plan confirmed.

### Gate 1 — Project foundation and digital twin

- Scaffold or clean the React/TypeScript/Vite project.
- Install required dependencies.
- Configure strict TypeScript, ESLint, Prettier, Tailwind, Vitest, and Playwright.
- Place organizer assets.
- Load and render URDF.
- Render key panel from config.
- Add camera, lights, grid, and axes.
- Show live joint and TCP telemetry from the scene graph.

Exit condition:

- URDF loads without errors.
- All keys appear at correct coordinates.
- Moving a joint visibly changes the TCP telemetry.
- Production build passes.

### Gate 2 — Independent FK

- Extract chain.
- Implement FK.
- Compare with Three.js world transforms.
- Add robot profiles and joint-limit tests.

Exit condition:

- Independent FK agrees with the rendered TCP within tolerance.

### Gate 3 — IK technical proof

- Implement DLS IK in a worker.
- Solve all six hover and contact poses.
- Add diagnostics and tests.

Exit condition:

- Every required target is solved within tolerance, or a genuine geometry conflict is demonstrated and documented before proceeding.

### Gate 4 — Command, runtime, safety, and trajectories

- Implement command union.
- Zod schemas.
- Queue.
- Safety supervisor.
- execution state machine.
- emergency stop.
- trajectory engine.
- telemetry.

Exit condition:

- All movement passes through one validated runtime.

### Gate 5 — Manual controls

- Joint dashboard.
- Joystick.
- Keyboard.
- Speed modes.
- Focus-loss safety.

Exit condition:

- Controls are responsive and use the shared pipeline.

### Gate 6 — Autonomous PIN

- PIN validation.
- Pose cache.
- Preflight.
- Hover/contact/retract planning.
- Progress UI.
- Report.

Exit condition:

- Ten consecutive valid PIN runs pass.

### Gate 7 — Deterministic voice

- Push-to-talk.
- Typed fallback.
- deterministic parser.
- speech confirmation.

Exit condition:

- Required voice commands work without AI.

### Gate 8 — UI polish and evidence

- Pipeline visualizer.
- camera presets.
- motion path.
- active-key highlight.
- safety explanations.
- dry-run preview.
- repeatability report.
- guided judge mode.

### Gate 9 — Electrical and final documentation

- Electrical documentation.
- diagrams.
- testing report.
- rubric map.
- demo script.
- deployment readiness.

### Gate 10 — Optional agentic bonus

Start only after Gates 0–9 are stable.

---

## 25. Required response after each gate

After completing each gate, do not merely say "done."

Return:

1. Gate objective.
2. Assumptions made.
3. Files created or changed.
4. Important architectural decisions.
5. Commands to install, run, test, and build.
6. Tests executed and exact results.
7. Acceptance criteria status.
8. Remaining risks or blockers.
9. The next gate plan.

Stop after each gate and wait for explicit approval before beginning the next major gate.

Never hide failing tests, incomplete features, or uncertainties.

---

## 26. Immediate task

Begin with Gate 0 only.

Do not start implementation yet.

First:

1. Inspect the full repository and every organizer resource.
2. Print the actual repository tree.
3. Extract the actual URDF chain, including all revolute and fixed joints, frames, limits, axes, and the TCP frame.
4. Validate the actual `key.config.json` and summarize the key layout in millimetres.
5. Identify contradictions or missing information.
6. Compare the current repository against the target architecture.
7. Produce a precise Gate 1 implementation plan, dependency list, file plan, tests, and acceptance criteria.
8. Ask only questions that are genuinely blocking. Do not ask questions whose answers can be derived from the files.

Wait for approval after delivering the Gate 0 audit.
