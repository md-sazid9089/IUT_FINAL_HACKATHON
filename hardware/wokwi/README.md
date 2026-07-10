# Wokwi PoC

Wokwi files are local and manually usable. If PCA9685 support is unavailable in the selected Wokwi environment, use the direct-PWM sketch as a simulation-only stand-in while keeping the production design ESP32 -> I2C -> PCA9685.

Manual setup:

1. Create a new ESP32 Wokwi project.
2. Copy `diagram.json` and `sketch.ino` into the project.
3. Start the simulator and open Serial Monitor.
4. Observe safe startup, the test servo sequence, stop, E-stop latch, and reset log messages.

This is not physical validation and does not prove servo current, torque, or wiring safety.
