# Safety Case

| Hazard | Cause | Control | Verification | Residual risk |
|---|---|---|---|---|
| Joint limit exceedance | Bad command or IK output | Zod command schemas, runtime safety checks, calibrated hardware limits | Runtime and IK tests | Physical calibration may be wrong |
| Excessive velocity | Short trajectory duration | Quintic trajectory duration from joint velocity limits | Trajectory tests | Servo real speed differs from URDF |
| Sudden joint jump | Discontinuous IK branch | Preflight max joint delta diagnostics, safety validation | IK/preflight tests | Needs more hardware tuning |
| Wrong key press | Bad target mapping | Zod key config, contact measurement | Key config and PIN evidence | Demo interpretation risk |
| IK failure | Unreachable pose or singularity | Solver returns failure; sequence stops | IK tests | Solver tuning limitations |
| Communication loss | Wi-Fi/WebSocket failure | Heartbeat timeout and stop policy | Hardware scaffold review | Not physically validated |
| Stale command | Delayed network packet | Sequence/message IDs, stale-message rejection design | Protocol documentation | Firmware parser incomplete |
| Conflicting commands | Multiple input sources | Runtime arbitration | Runtime tests | Operator misuse |
| Software E-stop failure | Browser/runtime fault | Physical E-stop required for actuator power | Electrical docs | Physical circuit not built |
| Servo stall/overcurrent | Mechanical jam | Fuse, supply margin, current budget method | Power-budget review | Requires measured servo data |
| Brownout | Servo current sag | Separate supply, bulk capacitance, brownout handling | Documentation | Needs real load testing |
| Unexpected startup movement | Servo pulses during boot | Outputs disabled until handshake/calibration | Firmware scaffold | Library/hardware behavior must be verified |
| Voice ambiguity | Ambiguous transcript | Deterministic parser must clarify | Voice tests when implemented | Browser speech variability |
| AI ambiguity | Model guesses | Optional agent disabled by default and schema gated | Not implemented in Gate 9 | Gate 10 optional |
| Replay controls live robot | Mode confusion | Replay must use recorded samples only | Gate 8 requirement | Current replay not verified here |
| Hardware calibration mismatch | Real limits differ from URDF | Stricter calibrated limit wins | Calibration schema review | Requires physical calibration |

Operator responsibility:

- Verify wiring and servo calibration before energizing actuators.
- Use a physical E-stop for any hardware demo.
- Treat browser simulation evidence as software validation, not proof of electrical safety.
