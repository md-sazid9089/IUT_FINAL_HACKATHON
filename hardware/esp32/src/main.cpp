#include <Arduino.h>
#include <Wire.h>
#include <Adafruit_PWMServoDriver.h>
#include "protocol.hpp"
#include "calibration.hpp"
#include "safety.hpp"

static constexpr uint8_t PCA9685_ADDRESS = 0x40;
static constexpr uint8_t SDA_PIN = 21;
static constexpr uint8_t SCL_PIN = 22;
static constexpr uint8_t ESTOP_INPUT_PIN = 27;
static constexpr uint8_t STATUS_LED_PIN = 2;

Adafruit_PWMServoDriver pwm(PCA9685_ADDRESS);
SafetyState safety;

ServoCalibration calibration[MAX_ACTIVE_JOINTS] = {
    {"joint_1", 0, -3.1416f, 3.1416f, 0, 180, 500, 2500, false, 0, 0},
    {"joint_2", 1, -2.0944f, 2.0944f, 0, 180, 500, 2500, false, 0, 0},
    {"joint_3", 2, -2.6180f, 2.6180f, 0, 180, 500, 2500, false, 0, 0},
    {"joint_4", 3, -3.1416f, 3.1416f, 0, 180, 500, 2500, false, 0, 0},
    {"joint_5", 4, -2.0944f, 2.0944f, 0, 180, 500, 2500, false, 0, 0},
    {"joint_6", 5, -3.1416f, 3.1416f, 0, 180, 500, 2500, false, 0, 0},
};

void disableOutputs() {
  for (uint8_t ch = 0; ch < MAX_ACTIVE_JOINTS; ++ch) {
    pwm.setPWM(ch, 0, 0);
  }
}

bool applyJointTarget(const JointTargetMessage& msg) {
  if (safety.eStopLatched) {
    latchFault(safety, "Rejected target while E-stop latched");
    return false;
  }
  if (!safety.handshakeReady || !safety.calibrated) {
    latchFault(safety, "Rejected target before handshake/calibration");
    return false;
  }
  if (!isFiniteJointArray(msg.jointRadians)) {
    latchFault(safety, "Rejected non-finite joint target");
    return false;
  }
  for (size_t i = 0; i < MAX_ACTIVE_JOINTS; ++i) {
    if (!withinCalibratedLimit(msg.jointRadians[i], calibration[i])) {
      latchFault(safety, "Rejected out-of-limit joint target");
      return false;
    }
  }
  for (size_t i = 0; i < MAX_ACTIVE_JOINTS; ++i) {
    const uint16_t pulseUs = radiansToPulse(msg.jointRadians[i], calibration[i]);
    const uint16_t count = static_cast<uint16_t>((pulseUs * 4096UL) / 20000UL);
    pwm.setPWM(calibration[i].channel, 0, count);
  }
  safety.outputsEnabled = true;
  return true;
}

void setup() {
  pinMode(ESTOP_INPUT_PIN, INPUT_PULLUP);
  pinMode(STATUS_LED_PIN, OUTPUT);
  digitalWrite(STATUS_LED_PIN, LOW);
  Serial.begin(115200);
  Wire.begin(SDA_PIN, SCL_PIN);
  pwm.begin();
  pwm.setPWMFreq(50);
  disableOutputs();
  safety.calibrated = true;  // Replace with config validation before physical use.
  safety.lastHeartbeatMs = millis();
  Serial.println("ESP32 servo bridge PoC booted safely; outputs disabled.");
}

void loop() {
  const uint32_t now = millis();
  if (digitalRead(ESTOP_INPUT_PIN) == LOW) {
    latchEStop(safety);
    disableOutputs();
  }
  if (heartbeatExpired(safety, now, HEARTBEAT_TIMEOUT_MS)) {
    latchFault(safety, "Heartbeat timeout");
    disableOutputs();
  }
  digitalWrite(STATUS_LED_PIN, safety.outputsEnabled ? HIGH : LOW);
  delay(10);
}
