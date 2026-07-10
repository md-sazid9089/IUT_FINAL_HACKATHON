#pragma once

#include <Arduino.h>

struct SafetyState {
  bool eStopLatched = false;
  bool calibrated = false;
  bool handshakeReady = false;
  bool outputsEnabled = false;
  uint32_t lastHeartbeatMs = 0;
  String fault;
};

inline void latchFault(SafetyState& state, const String& reason) {
  state.outputsEnabled = false;
  state.fault = reason;
}

inline void latchEStop(SafetyState& state) {
  state.eStopLatched = true;
  state.outputsEnabled = false;
  state.fault = "E-stop latched";
}

inline bool heartbeatExpired(const SafetyState& state, uint32_t nowMs, uint32_t timeoutMs) {
  return state.handshakeReady && nowMs - state.lastHeartbeatMs > timeoutMs;
}
