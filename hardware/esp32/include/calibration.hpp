#pragma once

#include "protocol.hpp"

struct ServoCalibration {
  const char* jointName;
  uint8_t channel;
  float urdfLowerRad;
  float urdfUpperRad;
  float servoMechanicalMinDeg;
  float servoMechanicalMaxDeg;
  uint16_t pulseMinUs;
  uint16_t pulseMaxUs;
  bool inverted;
  float neutralOffsetRad;
  float safeHomeRad;
};

inline bool isKnownJoint(const char* name) {
  return strcmp(name, "joint_1") == 0 || strcmp(name, "joint_2") == 0 ||
         strcmp(name, "joint_3") == 0 || strcmp(name, "joint_4") == 0 ||
         strcmp(name, "joint_5") == 0 || strcmp(name, "joint_6") == 0;
}

inline bool withinCalibratedLimit(float value, const ServoCalibration& cal) {
  const float lower = max(cal.urdfLowerRad, -PI);
  const float upper = min(cal.urdfUpperRad, PI);
  return value >= lower && value <= upper;
}

inline uint16_t radiansToPulse(float radians, const ServoCalibration& cal) {
  const float normalized =
      (radians - cal.urdfLowerRad) / (cal.urdfUpperRad - cal.urdfLowerRad);
  const float t = cal.inverted ? 1.0f - normalized : normalized;
  return static_cast<uint16_t>(cal.pulseMinUs + t * (cal.pulseMaxUs - cal.pulseMinUs));
}
