export const PIN_SEQUENCE_LENGTH = 6;

export const PIN_MOTION_CONFIG = {
  hoverClearanceM: 0.03,
  safeRetreatClearanceM: 0.05,
  descentWaypointSpacingM: 0.005,
  contactDwellMs: 250,
  contactToleranceM: 0.005,
  preferredStylusTiltRad: 0,
  maxStylusTiltRad: (20 * Math.PI) / 180,
  solverSettingsVersion: 'gate6-pin-solver-v1',
  safetySettingsVersion: 'gate6-pin-safety-v1',
} as const;

export const PIN_STATES = [
  'IDLE',
  'VALIDATING',
  'PREFLIGHTING',
  'PREFLIGHT_READY',
  'STARTING',
  'TRAVELLING',
  'HOVERING',
  'DESCENDING',
  'CONTACT_VERIFY',
  'DWELLING',
  'RETRACTING',
  'NEXT_DIGIT',
  'COMPLETED',
  'CANCELLING',
  'CANCELLED',
  'FAILED',
  'E_STOPPED',
] as const;

export type PinState = (typeof PIN_STATES)[number];
