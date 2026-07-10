# Power Budget Methodology

No exact servo model is provided, so this table is parameterized. Replace assumptions with measured or datasheet values before hardware use.

| Item | Symbol / example | Notes |
|---|---:|---|
| Servo quantity | `N = 6` | `joint_1` through `joint_6` only |
| Nominal servo voltage | `V_servo = 5-6 V` | Match selected servo datasheet |
| Idle current per servo | `I_idle` example `0.1 A` | Assumption until measured |
| Moving current per servo | `I_move` example `0.6 A` | Assumption until measured |
| Stall current per servo | `I_stall` example `1.5 A` | Datasheet or measured |
| Simultaneous load factor | `K = 0.5..1.0` | Depends on motion profile and load |
| ESP32 current | example `0.25 A` | Wi-Fi peaks vary by board |
| PCA9685 logic current | example `<0.05 A` | Logic side only |
| Continuous servo estimate | `N * I_move * K` | Use margin |
| Peak servo estimate | `N * I_stall * K_peak` | Short-duration capability |
| Safety margin | `1.25x..2x` | Engineering margin, not a guarantee |

Example with clearly labeled assumptions:

```text
continuous = 6 * 0.6 A * 0.75 * 1.5 margin = 4.05 A
peak       = 6 * 1.5 A * 0.75 = 6.75 A short duration
```

Recommended supply selection method:

1. Measure or obtain stall/moving current for the selected servo.
2. Estimate simultaneous load factor from the planned motion.
3. Choose a servo supply voltage allowed by the servo.
4. Choose continuous current rating above calculated continuous load plus margin.
5. Choose short-duration peak capability above credible transient load.
6. Size fuse below wiring damage current and above expected normal transient current.
7. Add bulk capacitance near servo rails; start with vendor guidance, then validate voltage sag under load.
