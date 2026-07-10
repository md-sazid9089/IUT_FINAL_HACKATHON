# Vantage Arm Lab

## Browser-Based Robotic Arm Digital Twin & Software-In-The-Loop Validation Platform

Vantage Arm Lab is a browser-based robotic-arm simulation and validation platform designed to test robotic control software safely before deployment to physical hardware.

The platform combines a 3D URDF digital twin, custom kinematics, manual and voice control, autonomous PIN entry, deterministic safety validation, and an ESP32/Wokwi electrical proof of concept.

> **Different interfaces. One trusted robotics pipeline.**

---

## Overview

The system provides a complete simulation-first environment where engineers can:

- Visualize a 6-DOF robotic arm from URDF
- Inspect joint states and end-effector telemetry
- Control the arm manually in 3D
- Test forward and inverse kinematics
- Execute deterministic voice commands
- Perform autonomous six-digit PIN entry
- Validate safety before motion
- Demonstrate future ESP32-based hardware integration

### Core Motion Pipeline

```text
Input Adapter
    ↓
Command Normalization
    ↓
Schema Validation
    ↓
Command Arbitration
    ↓
Safety Pre-Check
    ↓
IK / Motion Planning
    ↓
Safety Post-Check
    ↓
Trajectory Generation
    ↓
Runtime Controller
    ↓
URDF Digital Twin / Telemetry / Evidence
```

Every input source uses the same trusted pipeline.

---

## Problem Statement Alignment

Testing industrial robotic software directly on hardware is often:

- Slow
- Expensive
- Risky
- Difficult to reproduce

Vantage Arm Lab provides a software-in-the-loop validation environment where motion commands can be checked, simulated, measured, and demonstrated before reaching a real robot.

### Implemented Competition Phases

- **Phase 1 — See the Arm**
- **Phase 2 — Move the Arm**
- **Phase 3 — Talk to the Arm**
- **Phase 4 — Autonomous PIN Entry**
- **Phase 5 — Electrical Proof of Concept**

---

## Core Features

### 1. 3D Robotic Digital Twin

Built with:

- React
- TypeScript
- Three.js
- React Three Fiber
- URDF Loader

Capabilities:

- URDF-based robot loading
- Real-time 3D visualization
- Joint-state rendering
- End-effector tracking
- Camera controls
- Key-panel visualization
- Tool-tip and stylus tracking
- Runtime telemetry overlay

---

### 2. Robotics Core

#### Forward Kinematics

Calculates:

- Joint transformations
- End-effector position
- Tool orientation
- Stylus-tip pose

#### Inverse Kinematics

Implemented with:

- Jacobian-based solving
- Damped Least Squares optimization
- Joint-limit enforcement
- Reachability checking
- Iteration and convergence reporting

#### Motion Planning

Supports:

- Cartesian movement
- Joint-space interpolation
- Smooth trajectories
- Safe approach, contact, and retract motion
- Runtime cancellation
- Command arbitration

---

### 3. Unified Control Pipeline

Supported input sources:

- Dashboard controls
- GUI joystick
- Keyboard
- Voice commands
- Autonomous PIN execution
- Optional AI-generated commands
- Hardware proof-of-concept controls

All commands are converted into validated structured robot commands before execution.

---

### 4. Manual Control

#### GUI Joystick

Provides:

- X-axis movement
- Y-axis movement
- Z-axis movement
- Precision mode
- Cartesian jogging
- Speed control

#### Keyboard Control

Supports:

- Directional movement
- Speed adjustment
- Precision mode
- Home command
- Emergency stop
- Resume

---

### 5. Voice Control

The platform supports deterministic speech commands such as:

```text
Move up
Move left 5 centimeters
Rotate base 30 degrees
Press key five
Enter PIN 123456
```

### Voice Pipeline

```text
Speech Input
    ↓
Command Parser
    ↓
Structured Robot Command
    ↓
Schema Validation
    ↓
Safety Validation
    ↓
Execution
```

Voice input never bypasses the safety system.

---

### 6. Autonomous PIN Entry

The robotic arm can automatically enter a six-digit PIN using configured key coordinates.

### Execution Flow

1. Validate the PIN
2. Validate each key coordinate
3. Check reachability
4. Calculate the motion path
5. Move to the hover position
6. Descend the stylus
7. Simulate key contact
8. Retract safely
9. Continue to the next digit
10. Generate an execution report

### Validation Evidence

- Position error
- Reachability result
- Joint-limit status
- Motion status
- Per-key progress
- Final execution report

---

### 7. Safety System

Every motion request passes through deterministic safety validation.

Checks include:

- Command schema validation
- Workspace limits
- Joint limits
- Reachability
- Emergency-stop state
- Runtime busy state
- Motion constraints
- Invalid target rejection

Unsafe commands are rejected before execution.

---

### 8. Agentic Voice Extension

Optional AI support can convert natural-language requests into structured commands.

Example:

```text
Move slightly toward the panel and press key five twice.
```

Pipeline:

```text
Natural Language
    ↓
Structured Command Plan
    ↓
Deterministic Validation
    ↓
Safety Supervisor
    ↓
Robot Execution
```

> AI never directly controls the robot. Every generated command must pass the same deterministic validation and safety pipeline.

---

## ESP32 and Wokwi Hardware Proof of Concept

The repository includes a complete Wokwi-based circuit and firmware simulation.

### Implemented Wokwi Features

- ESP32 controller
- Six servo channels
- Manual 4-way joystick
- Six-digit PIN keypad
- Manual and Auto modes
- OLED telemetry
- Wi-Fi status
- Six key-indicator LEDs
- Ready and Stop indicators
- Emergency stop
- Resume control
- Home command
- Smooth servo movement
- Joint-limit validation
- Structured Serial Monitor events

### Wokwi PIN Flow

```text
MODE
1 → 2 → 3 → 4 → 5 → 6
ENTER
```

The firmware then performs:

```text
Approach key
    ↓
Press key
    ↓
Retract
    ↓
Continue sequence
    ↓
Return home
```

### Wokwi Files

- [`hardware/wokwi/sketch.ino`](hardware/wokwi/sketch.ino)
- [`hardware/wokwi/diagram.json`](hardware/wokwi/diagram.json)
- [`hardware/wokwi/libraries.txt`](hardware/wokwi/libraries.txt)
- [`hardware/wokwi/README.md`](hardware/wokwi/README.md)

---

## Electrical Design

### Future Real-Hardware Architecture

```text
Browser Dashboard
    ↓
Wi-Fi Communication
    ↓
ESP32 Controller
    ↓
PCA9685 Servo Driver
    ↓
6 Servo Motors
```

The real-hardware design includes:

- Separate regulated servo power
- Common ground
- High-current power planning
- Emergency-stop concept
- PCA9685 expansion
- ESP32 Wi-Fi communication
- Future hardware adapter integration

### Electrical Schematic

![Robot Arm Electrical Schematic](hardware/schematics/robot-arm-schematic.jpeg)

Schematic file:

- [`hardware/schematics/robot-arm-schematic.jpeg`](hardware/schematics/robot-arm-schematic.jpeg)

> The Wokwi simulation uses direct ESP32 PWM for reliable browser simulation. The production hardware design uses a PCA9685 servo driver and external servo power.

---

## Technology Stack

### Frontend

- React
- TypeScript
- Vite
- Three.js
- React Three Fiber
- Zustand
- Zod
- Tailwind CSS

### Robotics

- URDF Loader
- gl-matrix
- Custom forward-kinematics engine
- Custom Damped Least Squares IK solver
- Motion planner
- Runtime controller
- Safety supervisor
- Web Worker-based IK execution

### Hardware Proof of Concept

- ESP32
- Arduino C++
- Wokwi
- OLED SSD1306
- Servo motors
- 74HC595 LED driver
- Matrix keypad

### Testing

- Vitest
- React Testing Library
- Playwright
- TypeScript type checking
- ESLint
- GitHub Actions

---

## Project Structure

```text
IUT_FINAL_HACKATHON/
│
├── src/
│   ├── core/
│   │   ├── commands/
│   │   ├── kinematics/
│   │   ├── planning/
│   │   ├── runtime/
│   │   └── safety/
│   ├── robot/
│   │   ├── RobotModelAdapter.ts
│   │   └── robot profiles/
│   ├── scene/
│   │   ├── RobotModel.tsx
│   │   └── keypad rendering/
│   ├── controls/
│   │   ├── joystick/
│   │   ├── keyboard/
│   │   └── voice/
│   ├── workers/
│   │   └── IK worker/
│   └── ui/
│       ├── dashboard/
│       ├── PIN controls/
│       ├── telemetry/
│       └── safety status/
│
├── hardware/
│   ├── wokwi/
│   │   ├── sketch.ino
│   │   ├── diagram.json
│   │   ├── libraries.txt
│   │   └── README.md
│   └── schematics/
│       └── robot-arm-schematic.jpeg
│
├── docs/
│   ├── architecture/
│   ├── testing/
│   ├── electrical-design/
│   └── demo-plan/
│
├── public/
├── package.json
├── vite.config.ts
└── README.md
```

---

## Installation

### Requirements

- Node.js
- npm
- Git

### Clone the Repository

```bash
git clone <repository-url>
cd IUT_FINAL_HACKATHON
```

### Install Dependencies

```bash
npm install
```

### Run the Development Server

```bash
npm run dev
```

### Create a Production Build

```bash
npm run build
```

---

## Testing and Validation

Run the following before release:

```bash
npm run typecheck
npm run lint
npm run test
npm run build
```

For end-to-end tests:

```bash
npm run test:e2e
```

---

## Running the Wokwi Simulation

1. Open a new ESP32 project in Wokwi.
2. Replace the generated `sketch.ino`.
3. Replace the generated `diagram.json`.
4. Replace `libraries.txt`.
5. Start the simulation.
6. Press `MODE` to switch to Auto mode.
7. Enter six digits using keys 1–6.
8. Press `ENTER`.
9. Observe the servo sequence and Serial Monitor events.

Useful Serial Monitor commands:

```text
HELP
STATUS
HOME
TEST
PANELTEST
MODE AUTO
PIN 123456
STOP
RESUME
```

---

## Demo Presentation Flow

### Step 1 — Digital Twin

Demonstrate:

- URDF loading
- 3D arm rendering
- Joint telemetry
- End-effector tracking
- Key panel

### Step 2 — Manual Control

Demonstrate:

- GUI joystick
- Keyboard control
- Cartesian movement
- Precision mode

### Step 3 — Voice Control

Demonstrate:

- Speech recognition
- Command parsing
- Structured command generation
- Safe execution

### Step 4 — Autonomous PIN Entry

Enter:

```text
123456
```

Show:

- PIN validation
- Motion planning
- Approach, contact, and retract
- Per-key progress
- Accuracy report

### Step 5 — Safety

Demonstrate:

- Invalid target rejection
- Joint-limit rejection
- Emergency stop
- Command conflict protection

### Step 6 — Electrical Proof of Concept

Demonstrate:

- Wokwi circuit
- ESP32 firmware
- Manual PIN keypad
- Servo movement
- OLED status
- LED indicators

---

## Hackathon Requirement Mapping

| Requirement | Implementation |
|---|---|
| URDF Visualization | Three.js + URDF Loader |
| Live Dashboard | Runtime telemetry system |
| Forward Kinematics | Custom FK engine |
| Inverse Kinematics | Damped Least Squares IK solver |
| Joystick Control | Cartesian joystick controller |
| Keyboard Control | Keyboard input adapter |
| Voice Control | Speech command parser |
| PIN Automation | Autonomous PIN planner |
| Safety | Deterministic validation pipeline |
| Electrical Design | ESP32 + PCA9685 architecture |
| Circuit Simulation | Wokwi ESP32 simulation |
| Hardware Expansion | Robot adapter abstraction |

---

## Engineering Philosophy

The system is designed so that real hardware can be added by replacing the robot adapter layer while keeping the rest of the platform unchanged.

Reusable components include:

- Controls
- Command validation
- Safety
- Kinematics
- Planning
- Runtime
- Telemetry
- Reports
- User interface

---

## Future Improvements

- Real robotic-arm integration
- ROS and ROS 2 support
- Computer-vision control
- Finger-gesture control
- Advanced collision avoidance
- Multi-robot simulation
- Cloud telemetry
- Hardware-in-the-loop testing
- AI-assisted motion planning
- Production PCA9685 servo controller

---

## Project Status

Current implementation includes:

- Browser-based 3D digital twin
- Manual arm control
- Keyboard and joystick control
- Voice-command support
- Autonomous PIN execution
- Safety validation
- Runtime telemetry
- Wokwi hardware proof of concept
- ESP32 firmware
- Electrical schematic

---

## License

This project was developed for the IUT Hackathon Final Round.

---

## Team

**Vantage Arm Lab — IUT Hackathon Team**
