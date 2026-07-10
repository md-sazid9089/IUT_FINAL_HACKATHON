# URDF Analysis — `resources/6_dof_arm.urdf`

**Robot name:** `stylus_arm`
**Source SHA-256:** `23e134ff8a0be1e91ddeefdc47185b1b3bbb7bb478082bcd03f8fa49af0677d9`
**Analysis type:** Read-only inspection. The source file is immutable and was not modified.

> All values below are transcribed directly from the URDF. Rotations are RPY (roll-pitch-yaw, radians). Lengths are metres. FK values here are hand-computed and must be re-verified against the rendered Three.js scene in Gate 2 before IK is trusted.

---

## 1. Links (9 total)

| # | Link | Role | Notes |
|---|---|---|---|
| 1 | `base_link` | Base / world-fixed root | Cylinder body, radius 0.100, has inertial |
| 2 | `link_1` | Base-yaw upper arm segment | L ≈ 0.250 |
| 3 | `link_2` | Shoulder segment | L ≈ 0.250 |
| 4 | `link_3` | Elbow segment | L ≈ 0.250 |
| 5 | `link_4` | Forearm-roll segment (short) | L ≈ 0.150 |
| 6 | `link_5` | Wrist-pitch segment | L ≈ 0.250 |
| 7 | `link_6` | Tool-roll segment (short) | L ≈ 0.150 |
| 8 | `stylus` | Stylus body (pitch hub + barrel + nib) | Nib sphere at z ≈ 0.132 |
| 9 | `stylus_tip` | **TCP frame** (empty link) | No geometry; pure frame |

---

## 2. Joints (8 total: 7 revolute + 1 fixed)

| Joint | Type | Parent → Child | Origin xyz | Origin rpy | Axis | Lower (rad) | Upper (rad) | Effort (N·m) | Velocity (rad/s) | Damping | Friction |
|---|---|---|---|---|---|---:|---:|---:|---:|---:|---:|
| `joint_1` | revolute | `base_link` → `link_1` | `0 0 0.060` | `0 0 0` | `0 0 1` (Z) | −3.1416 | 3.1416 | 60.0 | 2.5 | 0.8 | 0.4 |
| `joint_2` | revolute | `link_1` → `link_2` | `0 0 0.250` | `0 0 0` | `0 1 0` (Y) | −2.0944 | 2.0944 | 60.0 | 2.5 | 0.8 | 0.4 |
| `joint_3` | revolute | `link_2` → `link_3` | `0 0 0.250` | `0 0 0` | `0 1 0` (Y) | −2.6180 | 2.6180 | 40.0 | 3.0 | 0.6 | 0.3 |
| `joint_4` | revolute | `link_3` → `link_4` | `0 0 0.250` | `0 0 0` | `0 0 1` (Z) | −3.1416 | 3.1416 | 25.0 | 3.5 | 0.4 | 0.2 |
| `joint_5` | revolute | `link_4` → `link_5` | `0 0 0.150` | `0 0 0` | `0 1 0` (Y) | −2.0944 | 2.0944 | 15.0 | 4.0 | 0.3 | 0.15 |
| `joint_6` | revolute | `link_5` → `link_6` | `0 0 0.250` | `0 0 0` | `0 0 1` (Z) | −3.1416 | 3.1416 | 10.0 | 4.5 | 0.2 | 0.1 |
| `stylus_pitch` | revolute | `link_6` → `stylus` | `0 0 0.150` | `0 0 0` | `0 1 0` (Y) | −2.0944 | 2.0944 | 8.0 | 5.0 | 0.15 | 0.08 |
| `stylus_tip_frame` | **fixed** | `stylus` → `stylus_tip` | `0 0 0.137` | `0 0 0` | — | — | — | — | — | — | — |

---

## 3. Parent/child kinematic chain

```text
base_link
  └─(joint_1, revolute, Z)         → link_1
      └─(joint_2, revolute, Y)     → link_2
          └─(joint_3, revolute, Y) → link_3
              └─(joint_4, revolute, Z) → link_4
                  └─(joint_5, revolute, Y) → link_5
                      └─(joint_6, revolute, Z) → link_6
                          └─(stylus_pitch, revolute, Y) → stylus
                              └─(stylus_tip_frame, fixed) → stylus_tip  [TCP]
```

Single open serial chain, no branches. All revolute origins have zero RPY; the chain is built purely from translations along Z plus revolute rotations.

### Axis pattern

```text
J1 Z  |  J2 Y  |  J3 Y  |  J4 Z  |  J5 Y  |  J6 Z  |  stylus_pitch Y
```

Alternating yaw/roll (Z) and pitch (Y) family. `stylus_pitch` shares the Y-pitch family with J2/J3/J5.

---

## 4. Frames

- **Base frame:** `base_link` — matches `key.config.json` `"frame": "base_link"`.
- **TCP link/frame:** `stylus_tip` — child of the fixed `stylus_tip_frame`, offset `0 0 0.137` from `stylus`. This empty link is the contact point used for key targeting.

### Zero-configuration TCP (all joints = 0)

Because every origin RPY is zero and all translations are along +Z, at the zero pose the TCP lies straight up the Z axis:

```text
0.060 + 0.250 + 0.250 + 0.250 + 0.150 + 0.250 + 0.150 + 0.137 = 1.497 m
```

Zero-pose TCP ≈ `(0, 0, 1.497)` in `base_link`. Approximate maximum vertical reach ≈ 1.497 m. Key targets sit at horizontal radius ≈ 0.50–0.60 m and z = 0.05 m. All six key coordinates are finite, structurally valid, and appear to lie inside the robot's nominal geometric envelope. Formal reachability remains unverified until the competition profile solves every hover, contact, and descent waypoint while satisfying joint limits and downward tool-axis alignment in Gates 2 and 3. (Envelope figures are hand-computed; verify in Gate 2.)

---

## 5. Six-versus-seven-joint discrepancy

- The written requirement and file name describe a **6-DOF** arm with a fixed stylus.
- The URDF actually declares **7 revolute joints**: `joint_1`…`joint_6` **plus** `stylus_pitch`.
- The header comment confirms the intent: *"6-DOF serial arm + 1-DOF stylus pitch (7 actuated joints total)"* and notes the stylus *"is no longer fixed"* versus v1.

**Resolution (per architecture ADR-003):** two configuration-driven profiles.

| Profile | Active joints | `stylus_pitch` | Purpose |
|---|---|---|---|
| `competition_6dof` (default) | `joint_1`…`joint_6` | **Locked** (provisional 0 rad; remains a revolute joint, just constrained) | Strict alignment with the 6-DOF written requirement |
| `model_7dof` (optional/diagnostic) | `joint_1`…`joint_6` + `stylus_pitch` | Active ("Tool Pitch") | Demonstrate configuration-driven architecture |

Per repository instruction, `stylus_pitch` **remains a `revolute` joint in both profiles** — in `competition_6dof` it is revolute but locked by configuration; in `model_7dof` it is revolute and active. The lock is a control-layer constraint only; the URDF joint type is never changed.

---

## 6. Noted internal inconsistencies (documentation only — do not "fix" the immutable file)

1. **Stylus length comment vs. actual TCP offset.** The header comment says `stylus = 0.126`, but the actual `stylus_tip_frame` fixed-joint origin is `(0, 0, 0.137) m` (nib visual at z = 0.132 + sphere radius 0.005 = 0.137). **Authoritative TCP offset: `stylus_tip_frame` origin = `(0, 0, 0.137) m`**, taken from the actual joint definition. The `0.126 m` value in the URDF comment is descriptive only and must not override the actual joint definition.
2. **Header link-length summary is approximate.** The comment lists L4 = 0.15 and L6 = 0.15, consistent with joint origins; other lengths align with the 0.250 origins. No action needed.

These are recorded for traceability. The URDF is never edited; runtime FK reads the real joint origins.

---

## 7. Implications for downstream gates

- **FK (Gate 2):** Build FK from the real joint origins/axes above; validate the zero-pose TCP (`≈ (0,0,1.497)`) and at least one non-trivial pose against the rendered `stylus_tip` before writing IK.
- **IK (Gate 3):** 6 active DOF for a position + approach-axis (`-z`) task. Tool roll about the approach axis is redundant → treat as a 5-DOF task (position + pointing direction), leaving roll free for conditioning.
- **Safety:** Enforce the per-joint position limits and velocity limits from the table above.
- **Profiles:** `competition_6dof` default with `stylus_pitch` locked; `model_7dof` configurable.
