# Vantage Arm Lab — System Architecture

## 1. Purpose

This document defines the approved architecture for the IUT Final Hackathon robotic-arm project.

The system is a browser-based software-in-the-loop validation platform for a robotic arm. It must visualize the organizer-provided URDF, expose live telemetry, support multiple manual control methods, interpret deterministic voice commands, execute autonomous six-digit PIN sequences, and demonstrate a safe path toward real hardware integration.

The central architectural principle is:

> Every input method must use the same validated motion-control pipeline.

The dashboard, joystick, keyboard, deterministic voice control, autonomous PIN entry, and optional agentic control must never move the robot directly.

---

## 2. Source of Truth

The following files are authoritative and must not be modified:

```text
resources/
├── 6_dof_arm.urdf
├── key.config.json
└── Hackathon Problem Statement (Final Round).pdf
```

Runtime copies may be placed under `public/`, but the original files must remain unchanged.

---

## 3. Product Goals

The system must provide:

1. Accurate browser-based URDF visualization.
2. A correctly placed six-key panel.
3. Live joint-angle telemetry.
4. Live end-effector position telemetry.
5. Joint-space manual control.
6. Cartesian joystick control.
7. Keyboard control.
8. Deterministic voice control.
9. Inverse kinematics.
10. Safe trajectory execution.
11. Autonomous six-digit PIN entry.
12. Contact verification within the required tolerance.
13. Emergency-stop and deterministic safety validation.
14. Run history and measurable accuracy evidence.
15. A professional electrical proof-of-concept architecture.
16. Optional agentic natural-language control through the same safety pipeline.

---

## 4. Architectural Principles

### 4.1 One shared motion pipeline

All control sources produce structured commands that pass through:

```text
Input Adapter
    ↓
Command Normalization
    ↓
Runtime Schema Validation
    ↓
Deterministic Safety Supervisor
    ↓
Motion Planner
    ↓
Inverse Kinematics
    ↓
Trajectory Generator
    ↓
Robot Runtime
    ↓
3D Scene + Telemetry + Logs
```

No UI component or input adapter may call URDF joint setters directly.

### 4.2 Browser-first core

The required project must work without a backend.

The browser handles:

- URDF loading
- 3D rendering
- forward kinematics
- inverse kinematics
- motion planning
- joystick and keyboard control
- deterministic voice parsing
- autonomous PIN execution
- safety validation
- telemetry
- run reports

A backend or serverless function may be added only for the optional agentic feature.

### 4.3 Deterministic safety before motion

Every command must pass a deterministic safety gate before execution.

AI output is treated as untrusted input.

### 4.4 Configuration-driven robot model

Robot joints, limits, frames, tool configuration, motion limits, and key coordinates must come from configuration and the supplied files.

Do not hardcode joint solutions for the six keys.

### 4.5 Separation of concerns

The robotics core must remain independent from React.

The UI displays state and submits commands. It does not contain kinematic or safety logic.

---

## 5. Technology Stack

| Area | Technology |
|---|---|
| Language | TypeScript |
| Frontend | React |
| Build tool | Vite |
| 3D rendering | Three.js |
| React 3D integration | React Three Fiber |
| URDF parsing | `urdf-loader` |
| State snapshots | Zustand |
| Runtime validation | Zod |
| Styling | Tailwind CSS |
| Accessible primitives | Radix UI |
| Heavy computation | Web Worker |
| Unit tests | Vitest |
| Component tests | React Testing Library |
| End-to-end tests | Playwright |
| CI | GitHub Actions |
| Persistent reports | IndexedDB |
| Small preferences | `localStorage` |

Do not add a database, authentication, ROS, Docker, physics engine, or Python backend to the mandatory core.

---

## 6. Important Model Ambiguity

The written requirement describes a six-DOF arm with a fixed stylus.

The supplied URDF includes:

```text
joint_1
joint_2
joint_3
joint_4
joint_5
joint_6
stylus_pitch
```

The architecture must support two robot profiles.

### 6.1 Competition profile

```text
competition_6dof
```

- Active joints: `joint_1` through `joint_6`
- `stylus_pitch` is locked
- Default judging mode
- Matches the written six-DOF requirement

### 6.2 Model-faithful profile

```text
model_7dof
```

- Active joints: all seven revolute joints
- `stylus_pitch` is exposed as Tool Pitch
- Used only as an optional diagnostic or advanced mode

The IK solver must receive the active joint list from configuration.

---

## 7. Key-Panel Model

The supplied key configuration uses:

```text
frame: base_link
units: meters
approach_axis: -z
```

The six targets form a two-row, three-column panel.

The configured coordinates must be treated as stylus-tip contact targets.

The visual key geometry may be positioned slightly below each target so that the key top surface aligns with the configured contact point.

For target point `K`, approach vector `A`, and hover clearance `c`:

```text
hover = K - A × c
contact = K
retract = hover
```

For `A = (0, 0, -1)` and `c = 0.03 m`:

```text
hover = K + (0, 0, 0.03)
```

---

## 8. High-Level System Architecture

```text
┌─────────────────────────────────────────────────────────────┐
│ Input Adapters                                              │
│                                                             │
│ Joint UI | Joystick | Keyboard | Voice | PIN | Agent       │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
                    Command Normalization
                               │
                               ▼
                       Zod Validation
                               │
                               ▼
                    Command Dispatcher
                               │
                               ▼
              Deterministic Safety Supervisor
                               │
                               ▼
                       Motion Planner
                  ┌────────────┴────────────┐
                  ▼                         ▼
          Cartesian Planning         Joint Planning
                  │                         │
                  └────────────┬────────────┘
                               ▼
                         IK Web Worker
                               │
                               ▼
                    Trajectory Generator
                               │
                               ▼
                      Robot Runtime Engine
                               │
        ┌──────────────────────┼──────────────────────┐
        ▼                      ▼                      ▼
  URDF Scene Graph       Telemetry Store        Event Log
        │                      │                      │
        └──────────────────────┴──────────────────────┘
                               │
                               ▼
                         Dashboard UI
```

---

## 9. Runtime Execution Contexts

### 9.1 Main thread

Responsible for:

- React UI
- Three.js rendering
- user interaction
- animation loop
- telemetry display
- scene overlays

### 9.2 IK Web Worker

Responsible for:

- forward-kinematic calculations when requested
- Jacobian calculations
- DLS inverse kinematics
- waypoint solving
- key-pose preflight
- optional reachability-map generation

Communication must use standard `postMessage`.

Do not require `SharedArrayBuffer`.

### 9.3 Optional agent endpoint

Responsible only for:

- natural-language interpretation
- structured plan generation
- clarification requests

It must not:

- hold robot authority
- mutate robot state
- bypass validation
- execute motion

---

## 10. Core Modules

### 10.1 Robot Model Adapter

The rest of the application must not depend directly on `urdf-loader`.

```ts
interface RobotModelAdapter {
  load(): Promise<void>;
  getJointDefinitions(): JointDefinition[];
  getActiveChain(): KinematicChain;
  setJointPositions(values: JointMap): void;
  getJointPositions(): JointMap;
  getTcpPose(): Pose;
  reset(): void;
}
```

Responsibilities:

- load the URDF
- find `base_link`
- find the TCP frame
- discover joints
- read limits and axes
- expose the serial chain
- apply joint values to the scene
- provide rendered TCP transforms

### 10.2 Robotics Core

Contains:

- forward kinematics
- geometric Jacobian
- pose error
- damped least-squares IK
- joint-limit handling
- workspace checks
- coordinate transforms
- unit conversion
- trajectory interpolation

This module must not import React.

### 10.3 Command System

Supported command types:

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

Every command contains:

```ts
interface MotionCommand {
  id: string;
  source: CommandSource;
  type: CommandType;
  payload: unknown;
  timestamp: number;
  priority: number;
}
```

Supported sources:

```text
dashboard
joystick
keyboard
voice
autonomous
agent
system
```

### 10.4 Safety Supervisor

Must validate:

1. command schema
2. command source
3. current execution mode
4. emergency-stop state
5. coordinate frame
6. unit validity
7. workspace bounds
8. joint limits
9. maximum Cartesian displacement
10. maximum joint displacement
11. joint velocity limits
12. IK reachability
13. command conflicts
14. PIN validity
15. voice ambiguity
16. agent-output schema

The supervisor returns a structured result:

```ts
interface SafetyResult {
  approved: boolean;
  checks: SafetyCheckResult[];
  reason?: string;
}
```

### 10.5 Motion Planner

Responsibilities:

- convert commands into waypoints
- distinguish joint-space and Cartesian plans
- generate hover, contact, and retract poses
- create safe transition points
- preflight entire PIN sequences
- calculate estimated execution time

### 10.6 Trajectory Generator

Travel motions use joint-space interpolation with a quintic minimum-jerk curve:

```text
s(t) = 10t³ - 15t⁴ + 6t⁵
```

Press descent and retraction use Cartesian waypoints so the stylus follows the configured approach line.

### 10.7 Robot Runtime

Responsibilities:

- own current robot state
- own active trajectory
- advance motion each frame
- publish telemetry snapshots
- manage cancellation
- enforce emergency stop
- record events
- expose execution status

---

## 11. Inverse Kinematics

Use damped least-squares Jacobian IK.

For Jacobian `J`, error `e`, and damping `λ`:

```text
Δq = Jᵀ(JJᵀ + λ²I)⁻¹e
```

### 11.1 Required capabilities

- position-only targets
- position plus tool-axis targets
- active-joint profiles
- current-state seed
- alternate seeds
- adaptive damping
- maximum iteration limit
- joint-step clamping
- joint-limit projection
- joint-limit avoidance
- stagnation detection
- divergence detection
- final FK verification

### 11.2 Error model

Use a six-dimensional pose error:

```text
[x, y, z, rx, ry, rz]
```

For key pressing:

- high position weight
- high stylus-axis alignment weight
- low tool-roll weight

### 11.3 Recommended initial settings

| Setting | Value |
|---|---:|
| Position convergence | 0.002–0.003 m |
| Press acceptance | 0.005 m |
| Orientation convergence | 5–10° |
| Maximum iterations | 80 |
| Base damping | 0.05–0.10 |
| Maximum joint update | 0.08–0.12 rad |
| Alternate seeds | Up to 3 |

All settings must be configurable.

### 11.4 Key-pose cache

At startup:

1. load the URDF
2. load the key configuration
3. generate hover and contact poses
4. solve IK for every key
5. record reachability
6. cache solutions
7. display diagnostics

The cache must be invalidated if the robot profile, joint limits, key coordinates, or tool orientation changes.

---

## 12. Autonomous PIN Execution

A valid PIN:

- contains exactly six characters
- uses only keys that exist in `key.config.json`
- passes full preflight before execution

### 12.1 Key press flow

```text
Resolve key
    ↓
Move to safe transition pose
    ↓
Move to hover pose
    ↓
Verify hover accuracy
    ↓
Descend through Cartesian waypoints
    ↓
Verify contact tolerance
    ↓
Dwell
    ↓
Retract through Cartesian waypoints
    ↓
Continue
```

A successful press requires:

```text
distance(TCP, target) ≤ 0.005 m
```

### 12.2 PIN state machine

```text
IDLE
  ↓
VALIDATING_PIN
  ↓
PREFLIGHTING
  ↓
MOVING_TO_SAFE_POSE
  ↓
MOVING_TO_HOVER
  ↓
DESCENDING
  ↓
VERIFYING_CONTACT
  ↓
DWELLING
  ↓
RETRACTING
  ↓
NEXT_DIGIT
  ↓
COMPLETED
```

Failure path:

```text
ANY ACTIVE STATE
  ↓
FAILED
  ↓
SAFE_RETRACT
  ↓
STOPPED
```

A failed press stops the full sequence.

---

## 13. Manual Controls

### 13.1 Joint controls

Provide:

- one slider per active joint
- current angle
- minimum and maximum angle
- degree and radian display
- reset
- home

Slider updates still use the command system.

### 13.2 Joystick

Use:

- XY joystick for X and Y
- separate vertical control for Z
- dead zone
- precision mode
- normal mode
- fast mode

Recommended Cartesian steps:

| Mode | Step |
|---|---:|
| Precision | 0.001 m |
| Normal | 0.005 m |
| Fast | 0.010 m |

### 13.3 Keyboard

Recommended mapping:

| Key | Action |
|---|---|
| W / S | +Y / -Y |
| A / D | -X / +X |
| R / F | +Z / -Z |
| Shift | Faster |
| Alt | Precision |
| H | Home |
| Space | Stop |
| Escape | Emergency stop |

Do not rely on browser key-repeat.

Use:

- `keydown` to activate a direction
- `keyup` to stop
- a fixed control loop to issue jog commands

Safety requirements:

- stop on window blur
- stop when tab becomes hidden
- stop when pointer capture is lost
- ignore shortcuts while typing
- disable manual control during autonomous execution unless cancelled

---

## 14. Deterministic Voice Control

The required voice system must work independently from the optional AI layer.

Use:

- browser speech recognition where supported
- typed command fallback
- push-to-talk
- browser speech synthesis for feedback

Flow:

```text
Capture speech
    ↓
Display transcript
    ↓
Normalize text
    ↓
Parse deterministic command
    ↓
Show interpretation
    ↓
Safety validation
    ↓
Execute
    ↓
Speak result
```

Supported examples:

```text
Move up
Move left five centimetres
Move forward ten millimetres
Rotate the base thirty degrees
Move joint three minus fifteen degrees
Go home
Stop
Press key five
Enter PIN one two three four five six
```

The parser must support:

- synonyms
- number words
- millimetres, centimetres, metres
- degrees and radians
- negative angles
- command confidence
- clarification for ambiguity

The parser must never guess when a required distance or target is unclear.

---

## 15. Optional Agentic Control

The AI layer is a planner, not a controller.

```text
Speech or typed instruction
    ↓
Reasoning service
    ↓
Structured proposed plan
    ↓
Zod validation
    ↓
Deterministic safety supervisor
    ↓
Preview
    ↓
Operator confirmation
    ↓
Existing motion pipeline
```

Allowed plan actions:

```text
move_relative
move_to_position
joint_jog
press_key
execute_pin
home
stop
```

Forbidden outputs:

- JavaScript
- arbitrary joint arrays
- code execution
- safety overrides
- URDF mutation
- direct scene changes

Additional safeguards:

- maximum five actions per plan
- maximum movement per action
- maximum total plan distance
- reject unknown fields
- reject invalid units
- ask for clarification when ambiguous
- require confirmation for multi-step plans
- log original text and approved plan
- allow instant cancellation
- support complete feature disabling

---

## 16. State Management

### 16.1 High-frequency state

Owned by the runtime engine:

- current joint vector
- current TCP pose
- active trajectory
- interpolation time
- current target
- current velocity

The scene reads this during animation frames.

### 16.2 UI snapshot state

Published to Zustand at about 10–20 Hz:

- displayed joint angles
- TCP position
- target position
- error distance
- IK status
- command status
- PIN progress
- safety result
- transcript
- event-log summary

Do not force React to rerender at 60 Hz.

### 16.3 Persistent state

Use `localStorage` for:

- selected robot profile
- camera preset
- speed mode
- UI preferences

Use IndexedDB for:

- execution logs
- run reports
- repeatability results
- replay data

---

## 17. UI Architecture

### 17.1 Layout

```text
┌─────────────────────────────────────────────────────────────┐
│ Logo | Profile | Mode | Safety | Home | Stop | E-Stop     │
├───────────────────────────────────┬─────────────────────────┤
│                                   │ Control Panel           │
│          3D DIGITAL TWIN          │                         │
│                                   │ Manual / Voice / PIN   │
│                                   │ Joints / Diagnostics   │
├───────────────────────────────────┴─────────────────────────┤
│ Joints | TCP | Target | Error | IK | Queue | Event Log    │
└─────────────────────────────────────────────────────────────┘
```

Primary target resolutions:

- 1366×768
- 1920×1080

### 17.2 Visual style

Use:

- charcoal backgrounds
- steel-grey panels
- amber robot accents
- green for safe or successful
- yellow for warning
- red for stop and fault states

Avoid gaming-style UI, excessive gradients, and decorative glass effects.

### 17.3 3D scene requirements

Mandatory:

- URDF arm
- six-key panel
- labels
- ground grid
- axis helper
- target marker
- TCP marker
- lighting
- shadows
- orbit camera

Recommended:

- motion path
- hover marker
- contact marker
- active key highlight
- motion trail
- ghost target
- workspace boundary
- camera presets

### 17.4 Pipeline visualizer

Show current flow:

```text
VOICE
  ↓
NORMALIZED
  ↓
SAFETY PASSED
  ↓
IK CONVERGED
  ↓
TRAJECTORY EXECUTING
  ↓
2.4 mm ERROR — SUCCESS
```

### 17.5 Safety UI

Always show:

- safety status
- active source
- active command
- current mode
- stop
- emergency stop

Emergency stop must:

- clear the queue
- cancel the trajectory
- block new motion
- require explicit reset

---

## 18. Evidence and Judge-Facing Features

Build after the core works.

### 18.1 Dry-run preview

Show the planned PIN path without moving the arm.

### 18.2 Accuracy evidence

For each press, show:

```text
Target
Reached position
Error in millimetres
Pass or fail
IK iteration count
```

### 18.3 Repeatability benchmark

Report:

- mean error
- maximum error
- standard deviation
- success rate
- average duration

### 18.4 Replay

Record and replay joint trajectories.

### 18.5 Run report

Include:

- PIN
- start time
- completion time
- result per digit
- measured error
- safety failures
- overall result

Support JSON and CSV export.

### 18.6 Guided demo mode

Provide a judge-friendly flow:

```text
1. Visualization
2. Joystick
3. Keyboard
4. Voice
5. PIN
6. Safety rejection
7. Report
```

---

## 19. Electrical Proof of Concept

Use the conceptual architecture:

```text
Browser Dashboard
       │
       │ Wi-Fi / WebSocket
       ▼
     ESP32
       │
       │ I²C
       ▼
 PCA9685 PWM Driver
   │ │ │ │ │ │
   ▼ ▼ ▼ ▼ ▼ ▼
 Six Servo Motors
```

Required electrical elements:

- ESP32 development board
- PCA9685 servo driver
- six servos
- separate regulated servo supply
- separate logic supply
- common ground
- main switch
- fuse or resettable fuse
- hardware emergency stop
- bulk capacitor
- status LED
- optional buzzer

Power-domain rule:

```text
ESP32 3.3 V → PCA9685 VCC
Servo PSU 5–6 V → PCA9685 V+
All grounds connected
```

Never power all servos from the ESP32 board.

The hardware emergency stop should cut servo power while keeping the controller alive.

The final documentation must include:

- pin-mapping table
- connection list
- power reasoning
- assumptions
- current-budget method
- Wokwi diagram
- production PoC schematic

---

## 20. Recommended Repository Structure

```text
IUT_FINAL_HACKATHON/
├── resources/
│   ├── 6_dof_arm.urdf
│   ├── key.config.json
│   └── Hackathon Problem Statement (Final Round).pdf
│
├── public/
│   ├── robot/
│   │   └── 6_dof_arm.urdf
│   └── config/
│       └── key.config.json
│
├── src/
│   ├── app/
│   ├── config/
│   ├── core/
│   │   ├── commands/
│   │   ├── kinematics/
│   │   ├── planning/
│   │   ├── runtime/
│   │   ├── safety/
│   │   └── telemetry/
│   ├── robot/
│   ├── workers/
│   ├── adapters/
│   │   ├── joystick/
│   │   ├── keyboard/
│   │   ├── deterministic-voice/
│   │   └── agent/
│   ├── scene/
│   ├── features/
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
│
├── docs/
│   ├── architecture.md
│   ├── requirements-traceability.md
│   ├── kinematics.md
│   ├── motion-planning.md
│   ├── safety-case.md
│   ├── voice-design.md
│   ├── electrical-poc.md
│   ├── testing-report.md
│   ├── rubric-mapping.md
│   └── demo-script.md
│
├── COPILOT_MASTER_IMPLEMENTATION_PROMPT.md
├── README.md
├── LICENSES.md
└── package.json
```

---

## 21. Testing Strategy

### 21.1 Unit tests

Configuration:

- valid base frame
- valid units
- six keys present
- valid approach axis
- malformed config rejection

Kinematics:

- FK at zero pose
- FK at random legal states
- analytic Jacobian compared with numerical Jacobian
- IK round-trip
- joint-limit enforcement
- six-DOF and seven-DOF profile switching

Commands:

- schema validation
- queue priority
- stop semantics
- emergency-stop blocking
- unsupported-command rejection

Voice:

- synonyms
- number words
- units
- negative values
- ambiguity
- unsupported commands

PIN:

- `123456`
- `654321`
- `555555`
- invalid length
- unsupported key
- cancellation
- repeated execution

### 21.2 Integration tests

Verify:

- joystick and keyboard produce equivalent normalized commands
- voice uses the same safety supervisor
- autonomous PIN uses the same IK engine
- emergency stop interrupts all command sources
- failed contact triggers safe retract
- agent output cannot bypass validation
- UI telemetry matches runtime state

### 21.3 Independent FK validation

For random legal joint configurations:

1. apply joints to the URDF scene
2. read the rendered TCP transform from Three.js
3. calculate the same transform with the independent FK implementation
4. compare the two results

This prevents the kinematics code from validating itself with the same implementation.

### 21.4 Acceptance targets

| Metric | Target |
|---|---:|
| Contact error | ≤5 mm |
| Internal IK target | ≤3 mm |
| Reachable keys | 6/6 |
| Successful PIN presses | 6/6 |
| Main demo reliability | 10 consecutive runs |
| Unhandled exceptions | 0 |
| Rendering | Approximately 55–60 FPS |
| Visible manual response | Under 100 ms |
| Emergency-stop response | Next runtime tick |
| Offline core | Fully functional after loading |

---

## 22. CI and Deployment

GitHub Actions must run:

```text
npm ci
npm run typecheck
npm run lint
npm run test
npm run build
npm run test:e2e
```

Deployment strategy:

- static deployment for the core
- optional serverless endpoint for AI
- no mandatory backend dependency

Maintain these fallbacks:

1. deployed URL
2. local production build
3. local development build
4. complete demo video
5. screenshots
6. exported run reports

---

## 23. Implementation Gates

### Gate 0 — Requirement and model validation

- inspect URDF
- inspect key config
- identify links and joints
- confirm frames
- document assumptions
- create dependency plan
- create folder structure

### Gate 1 — Digital twin

- load URDF
- render keys
- add camera and lighting
- show joints
- show TCP telemetry

### Gate 2 — Forward kinematics

- extract serial chain
- implement FK
- compare with Three.js
- validate profiles

### Gate 3 — Inverse kinematics

- implement DLS IK
- solve all hover and contact poses
- handle limits
- add alternate seeds
- confirm six-key reachability

### Gate 4 — Motion runtime and safety

- command schemas
- queue
- dispatcher
- safety supervisor
- execution state machine
- emergency stop
- trajectory engine

### Gate 5 — Manual controls

- joint controls
- joystick
- keyboard
- speed modes
- focus-loss safety

### Gate 6 — Autonomous PIN

- validation
- preflight
- key-pose cache
- press sequence
- progress UI
- reports
- repeated-run testing

### Gate 7 — Deterministic voice

- speech capture
- typed fallback
- parser
- spoken feedback
- ambiguity handling

### Gate 8 — UI polish

- camera presets
- path overlays
- accuracy display
- diagnostics
- guided demo mode

### Gate 9 — Electrical and documentation

- electrical diagram
- Wokwi
- pin mapping
- power reasoning
- architecture documentation
- rubric mapping

### Gate 10 — Agentic bonus

Begin only after the complete core is stable.

Copilot must stop after each gate and report:

- files created
- files modified
- commands run
- tests passed
- unresolved issues
- next-gate plan

---

## 24. Scope Priorities

### Must complete

- URDF visualization
- key panel
- telemetry
- forward kinematics
- inverse kinematics
- joint dashboard
- joystick
- keyboard
- deterministic voice
- autonomous PIN
- safety supervisor
- emergency stop
- electrical PoC
- documentation
- polished demo

### Should complete

- dry-run preview
- measured error
- run report
- repeatability benchmark
- pipeline visualizer
- typed command fallback
- camera presets
- guided demo mode

### Only after core stability

- agentic AI
- bilingual commands
- heatmap
- collision warnings
- PWA
- ROS adapter
- physics simulation

---

## 25. Final Architecture Decision

The approved architecture is:

> A browser-first React and TypeScript application using Three.js, React Three Fiber, and `urdf-loader`; a custom configuration-driven robotics core; damped least-squares IK in a Web Worker; a typed command bus; deterministic safety validation; smooth trajectory execution; Cartesian key-press planning; deterministic voice with typed fallback; optional safety-gated agentic interpretation; and an ESP32–PCA9685 electrical proof of concept.

Implementation must begin by proving:

1. the supplied URDF loads correctly
2. forward kinematics matches the rendered model
3. all six key hover and contact poses are reachable

No voice, autonomous workflow, or AI feature should be treated as production-ready until these three foundations are verified.
