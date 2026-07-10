# Production Electrical Architecture

Signal path:

```text
browser dashboard -> Wi-Fi -> WebSocket -> ESP32 -> I2C -> PCA9685 -> six servo channels -> joint_1..joint_6
```

The browser never drives servos directly. It may send validated, acknowledged protocol messages only after the operator explicitly selects hardware mode. The judged production profile has six active joints; `stylus_pitch` is locked in software and has no servo channel.

Required components:

- ESP32 development board for Wi-Fi and command supervision.
- PCA9685 16-channel PWM driver for servo pulses.
- Six calibrated servos for `joint_1` through `joint_6`.
- Separate servo power supply sized by measured/datasheet current.
- Logic supply for ESP32 and PCA9685 VCC.
- Common ground between logic and servo power.
- Master power switch.
- Physical E-stop that removes actuator power or disables command authority.
- Fuse selected from measured/datasheet current and wiring limits.
- Bulk capacitor near PCA9685 servo V+ and GND.
- Connectors and wire gauge selected for expected current.

Safety principles:

- Never power six servos from the ESP32 regulator.
- PCA9685 VCC is logic power; PCA9685 V+ is servo power.
- Software E-stop is useful, but it is not a substitute for physical power isolation.
- ESP32 boot must leave servo outputs disabled until calibration, handshake, and heartbeat are valid.
- Communication loss or stale commands must stop motion.
- Servo calibration limits and URDF limits may differ; the stricter calibrated limit wins.
- Brownout, reverse polarity, overcurrent, and stalled servo conditions require hardware-level mitigation.
