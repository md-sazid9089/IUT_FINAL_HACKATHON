# Gate 8 — UI/UX Polish and Judge-Facing Evidence

Gate 7 must be approved.

Implement:

1. Industrial dark visual system.
2. Layout optimized for 1366×768 and 1920×1080.
3. Camera presets: overview, side, top, panel, tool.
4. Active-key glow, target/hover/contact markers, stylus direction, path preview, and motion trail.
5. Live pipeline strip:
   input → normalized → safety → IK → executing → result.
6. Safety explanation panel.
7. Repeatability statistics:
   mean, max, standard deviation, success rate, duration.
8. Run replay.
9. Guided judge mode.
10. Error boundary and polished empty/loading/fault states.
11. Accessibility labels and keyboard focus behavior.
12. Performance profiling and allocation cleanup.

Acceptance:

- main UI fits target laptop without critical clipping
- approximately 55–60 FPS on demo machine
- metrics are derived from real run data
- guided demo completes without hidden shortcuts
- tests and build pass

Stop after the gate report.
