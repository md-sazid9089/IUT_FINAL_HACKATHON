# Gate 7 — Deterministic Voice and Typed Command Fallback

Gate 6 must be approved.

Implement the required deterministic layer independently from AI.

1. Push-to-talk browser speech recognition where supported.
2. Typed command fallback using the same parser.
3. Transcript and interpreted-command preview.
4. Deterministic parser supporting:
   - directional movement
   - metric distances
   - base/joint rotations
   - home
   - stop
   - press key
   - execute PIN
5. Number words, synonyms, units, and negative values.
6. Clarification instead of guessing.
7. Browser speech synthesis for confirmation/outcome.
8. Clear unsupported-browser/offline behavior.
9. All commands pass through the existing command/safety pipeline.
10. Parser and integration tests.

Acceptance:

- required command families work without AI
- typed fallback always works
- ambiguous commands do not move the robot
- stop/E-stop behavior remains immediate
- tests and build pass

Stop after the gate report.
