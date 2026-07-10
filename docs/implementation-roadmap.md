# Implementation Roadmap

| Gate | Objective | Exit condition | Suggested commit |
|---|---|---|---|
| 0 | Audit resources and lock assumptions | Complete URDF/config report; no code | `docs: complete gate 0 resource audit` |
| 1 | Digital twin foundation | URDF, panel, raw joint controls, rendered TCP visible | `feat(scene): add URDF digital twin and key panel` |
| 2 | Independent FK | Custom FK matches rendered TCP within tolerance | `feat(kinematics): add independently verified forward kinematics` |
| 3 | Jacobian and IK | All six hover/contact targets solve and verify | `feat(kinematics): add worker-based weighted DLS IK` |
| 4 | Runtime and safety | Every movement uses validated command pipeline; E-stop immediate | `feat(runtime): add command safety and trajectory engine` |
| 5 | Manual controls | Joint, joystick, keyboard responsive and safe | `feat(controls): add unified manual control adapters` |
| 6 | PIN automation | Ten consecutive valid runs pass | `feat(automation): add validated autonomous PIN entry` |
| 7 | Deterministic voice | Required commands work without AI | `feat(voice): add deterministic voice and typed fallback` |
| 8 | Polish and evidence | Judge mode, reports, replay, dry run | `feat(presentation): add evidence and guided demo experience` |
| 9 | Electrical/docs/deployment | CI green, docs complete, deployed/local fallback | `docs(release): add electrical poc and final delivery assets` |
| 10 | Agentic bonus | Safely gated multi-step language plans | `feat(agent): add safety-gated agentic command planning` |

Do not skip an exit condition. Keep the core demo reliable before adding optional features.
