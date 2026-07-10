# Electrical PoC

The production hardware concept is documented in:

- `hardware/schematics/production-architecture.md`
- `hardware/schematics/connection-table.md`
- `hardware/schematics/power-budget.md`
- `hardware/esp32/README.md`
- `hardware/wokwi/README.md`

Summary:

```text
browser dashboard -> Wi-Fi -> WebSocket -> ESP32 -> I2C -> PCA9685 -> servos 0..5
```

Only `joint_1` through `joint_6` are actuated. `stylus_pitch` remains locked at `0 rad` in the production profile and has no servo channel.

Status: documentation and firmware scaffold only. No physical hardware validation has been performed.
