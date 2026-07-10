# Testing Strategy

## Gate-level rule

Every gate requires:

- typecheck
- lint
- relevant unit tests
- relevant integration tests
- production build
- manual acceptance steps

## Kinematics

- deterministic zero/midpoint/limit/mixed poses
- 100 seeded legal configurations
- FK versus rendered TCP
- analytical Jacobian versus finite differences
- FK→IK round trip
- all key hover/contact/descent targets
- unreachable targets
- NaN/Infinity rejection
- cancellation
- joint-limit behavior
- six- and seven-joint profiles

## Controls and safety

- joystick and keyboard normalize to equivalent commands
- stop on blur/hidden tab/pointer loss
- E-stop bypasses queue
- manual commands rejected during autonomous mode
- unsafe displacement rejected
- post-IK joint jump rejected
- no direct joint manipulation outside runtime

## Autonomous PIN

Required cases:

```text
123456
654321
555555
invalid length
unsupported digit
cancel halfway
E-stop halfway
failed contact
ten consecutive complete runs
```

## Voice

- synonyms
- number words
- millimetres/centimetres/metres
- degrees/radians
- negative values
- missing distance clarification
- unsupported command
- typed fallback

## Acceptance metrics

- FK position mismatch ≤ 0.0001 m
- FK orientation mismatch ≤ 0.0001 rad
- tool-axis dot ≥ 0.999999
- solver target around 0.002 m
- press pass ≤ 0.005 m actual runtime error
- no unhandled runtime errors
- approximately 55–60 FPS on demo laptop
