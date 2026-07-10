# UI/UX Redesign Analysis (Phase 1)

Read-only audit of the current interface before the redesign. **No robotics
logic (FK, IK, runtime, safety, command pipeline, URDF, hardware) is changed by
this work** — only UI components, layout, styling, scene visuals, and UX flow.

## Current UI problems

- **No control-room hierarchy.** A single header (`Gate 1 · …` subtitle) plus a
  flat 3-column grid. No top status bar; runtime state, safety, and E-stop are
  buried inside a side panel.
- **Developer diagnostics mixed with operator controls.** FK verification and IK
  preflight (engineering diagnostics) sit next to primary controls with equal
  visual weight — noisy for a demo/judge.
- **Generic styling.** Default browser buttons, flat panels, inconsistent
  spacing, "temp-badge" debug chips, emoji lock icons. Reads as a student demo,
  not industrial software.
- **Telemetry is text-block heavy.** TCP is `x .. y .. z ..` inline; tables lack
  number alignment emphasis, zebra, or status chips.
- **Weak information scent.** Runtime state is a small colored word; no
  animated/meaningful status chips; no empty/loading/error polish beyond a
  spinner overlay.
- **Flat 3D scene.** Single directional light, mid-gray background/ground,
  utilitarian grid, no camera presets, minimal TCP/target affordances.
- **No guided narrative.** Nothing helps a judge understand the system in 60s.

## Duplicated / redundant UI

- `src/ui/JointDebugPanel.tsx` is dead (superseded by `manual/JointControlPanel`)
  — not imported.
- E-STOP appears in Runtime, Manual, and PIN panels (functionally fine; visually
  inconsistent). A single always-visible top-bar E-STOP is added; the others
  remain functional.

## Confusing flows

- Motion verbs (Stop/Pause/Resume/Reset) live only inside the Runtime panel,
  disconnected from the persistent state readout.
- PIN execution lacks a clear stepper (Idle → Preflight → Ready → Executing →
  Success/Failed); state is a mono string.

## Information hierarchy issues

- Everything is `<h2>` panels of equal weight; no primary/secondary/tertiary t=
  scale; no accent system; numbers not visually distinguished from labels.

## Improvement plan

1. **Design system** (`index.css`): near-black/graphite tokens, single cyan
   accent, status palette, spacing/radius/shadow scale, typography hierarchy,
   monospace tabular numerals, refined buttons/panels/tables/chips/scrollbars.
2. **Control-room layout** (`App.tsx`): persistent **top bar** (robot ·
   connection · runtime state chip · safety chip · E-STOP), left **Controls**,
   dominant **center viewport**, right **Telemetry/Diagnostics**, bottom
   **event timeline**.
3. **Reusable primitives**: `StatusChip`, top bar, floating **camera controls**,
   **demo mode** overlay — all snapshot-driven (no runtime state in React).
4. **Scene polish** (`SceneRoot`, `RobotModel`): near-black graded background,
   multi-light rig (hemisphere + key + fill + rim), contact shadows, refined
   radial grid, subtle metallic material pass (no URDF geometry change), TCP
   point + approach arrow, camera presets (Overview/Front/Side/Top/PIN/Tool).
5. **Advanced Mode**: hide FK/IK developer diagnostics behind a toggle.
6. **Judge Demo Mode**: one-click guided 6-step presentation.
7. **A11y**: focus-visible rings, aria labels, tooltips, contrast, reduced-motion.
8. **Performance**: UI-only state in a dedicated `uiStore`; runtime stays outside
   React; no per-frame React churn added.
