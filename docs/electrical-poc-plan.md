# Electrical Proof-of-Concept Plan

Gate 9 implementation files live under `hardware/` and the complete summary is in `docs/electrical-poc.md`.

## Logical architecture

```text
Browser dashboard
→ Wi-Fi / WebSocket
→ ESP32
→ I²C
→ PCA9685 PWM driver
→ six servo motors
```

## Required elements

- ESP32 DevKit
- PCA9685
- six servo channels
- separate 5–6 V regulated servo supply
- logic power
- common ground
- fuse/resettable fuse
- main switch
- hardware emergency stop
- bulk capacitor
- status LED

## Power rules

- ESP32 3.3 V → PCA9685 logic VCC
- servo PSU → PCA9685 V+
- all grounds connected
- never power six servos from the ESP32 regulator
- hardware E-stop should remove servo power while retaining controller telemetry when practical

## Deliverables

1. Wokwi demonstration assembled manually.
2. Production PoC schematic.
3. Pin-mapping table.
4. Connection list.
5. Power-budget method.
6. Explicit assumptions because servo models are not supplied.
7. Screenshot included in repository documentation.

If PCA9685 simulation becomes time-consuming, demonstrate direct PWM in Wokwi and keep PCA9685 in the production schematic.
