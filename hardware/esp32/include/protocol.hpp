#pragma once

#include <Arduino.h>

static constexpr const char* PROTOCOL_VERSION = "poc-1";
static constexpr size_t MAX_ACTIVE_JOINTS = 6;
static constexpr uint32_t HEARTBEAT_TIMEOUT_MS = 500;

enum class MessageType {
  Hello,
  Telemetry,
  JointTarget,
  TrajectoryChunk,
  Home,
  Stop,
  EmergencyStop,
  ResetEmergencyStop,
  Heartbeat,
  Ack,
  Error
};

struct JointTargetMessage {
  char messageId[32];
  uint32_t sequence;
  float jointRadians[MAX_ACTIVE_JOINTS];
  uint32_t durationMs;
};

inline bool isFiniteJointArray(const float* values) {
  for (size_t i = 0; i < MAX_ACTIVE_JOINTS; ++i) {
    if (!isfinite(values[i])) return false;
  }
  return true;
}
