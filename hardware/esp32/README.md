# ESP32 Servo Bridge PoC

This is a firmware scaffold for a future hardware bridge:

```text
browser dashboard -> Wi-Fi -> WebSocket -> ESP32 -> I2C -> PCA9685 -> servos 0..5
```

The browser software remains a simulator unless an operator explicitly selects hardware mode. This PoC has not been physically validated on hardware.

Safety defaults:

- Outputs stay inactive until boot, calibration, protocol handshake, and heartbeat are valid.
- Only `joint_1` through `joint_6` are accepted.
- `stylus_pitch` is intentionally unassigned.
- E-stop latches and requires explicit reset.
- Heartbeat timeout enters a stopped fault state.
- Unknown, non-finite, stale, duplicate, or out-of-limit commands are rejected.

Suggested PlatformIO usage:

```text
cd hardware/esp32
pio run
```

If using Arduino IDE, copy `src/main.cpp` and `include/*.hpp` into an ESP32 sketch and install compatible WebSocket and PCA9685 libraries.
