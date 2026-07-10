# Connection Table

| From | To | Purpose |
|---|---|---|
| ESP32 3.3 V | PCA9685 VCC | Logic supply only |
| ESP32 GND | PCA9685 GND | Shared logic ground |
| Servo supply GND | PCA9685 GND | Common ground with logic |
| ESP32 GPIO21 | PCA9685 SDA | I2C data |
| ESP32 GPIO22 | PCA9685 SCL | I2C clock |
| Servo supply +5-6 V | Master switch -> fuse -> E-stop -> PCA9685 V+ | Actuator power path |
| Bulk capacitor + | PCA9685 V+ | Reduce servo rail sag |
| Bulk capacitor - | PCA9685 GND | Return path |
| PCA9685 channel 0 signal | joint_1 servo signal | Base yaw |
| PCA9685 channel 1 signal | joint_2 servo signal | Shoulder |
| PCA9685 channel 2 signal | joint_3 servo signal | Elbow |
| PCA9685 channel 3 signal | joint_4 servo signal | Forearm roll |
| PCA9685 channel 4 signal | joint_5 servo signal | Wrist pitch |
| PCA9685 channel 5 signal | joint_6 servo signal | Tool roll |
| Servo red wires | PCA9685 V+ rail | Servo power |
| Servo brown/black wires | PCA9685 GND rail | Servo return |
| Physical E-stop switch | Servo power path or enable circuit | Actuator power isolation |
| Status LED/buzzer | ESP32 GPIO | Optional fault/status indication |

`stylus_pitch` has no channel in the production PoC.
