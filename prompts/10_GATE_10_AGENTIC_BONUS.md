# Gate 10 — Optional Safety-Gated Agentic Control

Begin only after Gates 0–9 are approved and stable.

Implement:

1. Feature-flagged serverless reasoning endpoint or approved local model adapter.
2. Strict structured output schema with only:
   - move_relative
   - move_to_position
   - joint_jog
   - press_key
   - execute_pin
   - home
   - stop
3. Maximum five actions.
4. Per-action and total-plan displacement limits.
5. Unknown-field/unit rejection.
6. Clarification for ambiguity.
7. Plan preview and operator confirmation for multi-step plans.
8. Every action re-enters the existing deterministic safety pipeline.
9. Natural-language success/failure response and optional speech.
10. Logs linking original instruction, proposed plan, validated plan, and result.
11. Tests for malformed, unsafe, ambiguous, and prompt-injection-like inputs.
12. Graceful disabled/offline behavior.

Acceptance:

- AI has no direct robot or scene authority
- unsafe output cannot execute
- the mandatory deterministic voice mode remains independent
- feature can be disabled without affecting the core
- tests and build pass

Stop after the gate report.
