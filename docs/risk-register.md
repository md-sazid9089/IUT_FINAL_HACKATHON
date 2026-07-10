# Risk Register

| Risk | Impact | Mitigation | Owner | Status |
|---|---|---|---|---|
| 6/7-joint ambiguity | High | Two profiles; six-joint default | Robotics | Open |
| Incorrect URDF frame convention | High | FK/render comparison before IK | Robotics | Open |
| IK instability | High | Adaptive DLS/LM, step rejection, deterministic seeds, fallback branch | Robotics | Open |
| Tool orientation overconstrained | High | Position + tool-axis task, free roll | Robotics | Open |
| PIN works only once | High | Pose cache, safe retract, ten-run acceptance | QA | Open |
| Browser voice unavailable | Medium | Typed deterministic fallback | Controls | Open |
| UI blocks during preflight | Medium | Worker-based planning | Platform | Open |
| E-stop delayed by queue | High | Dedicated immediate path | Platform | Open |
| Copilot edits source resources | High | Immutable paths and hash verification | Team | Open |
| Wokwi/PCA9685 simulation issue | Medium | Direct-PWM Wokwi demo plus production PCA9685 schematic | Electrical | Open |
| Deployment failure | High | Local production build and video fallback | DevOps | Open |
| Optional AI destabilizes core | High | Feature flag; begin only after Gate 9 | Team | Open |
