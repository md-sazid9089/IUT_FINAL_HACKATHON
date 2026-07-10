# Contributing

Work one gate at a time. Keep immutable organizer resources unchanged:

- `resources/6_dof_arm.urdf`
- `resources/key.config.json`
- `resources/Hackathon-Problem-Statement-Final-Round.pdf`

Before opening a PR:

```text
npm ci
npm run typecheck
npm run lint
npm run test
npm run build
npm run test:e2e
```

Do not add direct UI-to-URDF mutation paths. Robot motion must go through the runtime pipeline.
