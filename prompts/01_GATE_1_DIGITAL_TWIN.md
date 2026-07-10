# Gate 1 — Digital Twin Foundation

Gate 0 must be approved.

Implement only the browser project foundation and digital twin.

Tasks:

1. Scaffold Vite + React + strict TypeScript in the current repository without deleting planning/resources.
2. Install stable compatible core dependencies and commit the lock file.
3. Copy immutable runtime assets to:
   - `public/robot/6_dof_arm.urdf`
   - `public/config/key.config.json`
4. Add Zod validation for key config.
5. Build a `RobotModelAdapter` around `urdf-loader`.
6. Render the URDF with React Three Fiber.
7. Render all six keys so configured coordinates represent top contact points.
8. Add grid, axes, lighting, shadows, orbit controls, TCP marker, approach-axis indicator, and target marker.
9. Add temporary raw joint-debug sliders bounded by actual limits.
10. Display the rendered `stylus_tip` world position and discovered joint metadata.
11. Add graceful loading/error states.
12. Add tests for config validation, URDF load failure, and key coordinate conversion.
13. Add typecheck, lint, test, and build scripts.

Do not implement custom FK, Jacobian, IK, command runtime, joystick, PIN, voice, or AI.

Acceptance:

- complete URDF visible at correct scale
- all keys positioned from JSON
- actual base/TCP discovered
- debug joint changes update rendered TCP
- `stylus_pitch` locked in the default profile
- no direct URDF calls outside the adapter/debug boundary documented for removal
- tests and production build pass

Stop after the gate report.
