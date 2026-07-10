# START HERE

This is the complete planning and Copilot execution kit for the IUT Final Hackathon robotic-arm project.

## 1. Remove confusing old planning files

Before starting, remove or move outside the repository any earlier duplicate planning files, especially files named like:

```text
Hackathon Project Architecture.txt
Branch · Hackathon Project Architecture.txt
architecture_from_scratch.md
old COPILOT_MASTER_IMPLEMENTATION_PROMPT.md
```

Keep one approved architecture only:

```text
docs/architecture.md
```

Multiple competing plans will confuse Copilot.

## 2. Use this repository layout

Extract this kit into your project root so the root contains:

```text
IUT_FINAL_HACKATHON/
├── .github/
├── docs/
├── prompts/
├── resources/
├── templates/
├── .gitignore
├── COPILOT_MASTER_IMPLEMENTATION_PROMPT.md
├── README.md
└── START_HERE.md
```

The three files under `resources/` are immutable source-of-truth copies.

## 3. Requirements on your PC

Install:

- Git
- Node.js LTS
- npm
- VS Code
- GitHub Copilot and GitHub Copilot Chat extensions
- Google Chrome or Microsoft Edge

Confirm:

```powershell
git --version
node --version
npm --version
```

Use a currently supported Node.js LTS release. Do not use an experimental Node version for the final demo.

## 4. Initialize Git before Copilot changes anything

Run from the project root:

```powershell
git init
git add .
git commit -m "chore: add official resources and approved implementation plan"
```

Optional but recommended: create a private GitHub repository and push this baseline.

## 5. Start Copilot correctly

Open VS Code in the project root.

Open **GitHub Copilot Chat** and select **Agent mode**.

First paste the full content of:

```text
COPILOT_MASTER_IMPLEMENTATION_PROMPT.md
```

Then paste:

```text
prompts/00_GATE_0_AUDIT.md
```

Do not ask Copilot to build the whole project at once.

## 6. Gate workflow

For every gate:

1. Paste only that gate prompt.
2. Let Copilot inspect and implement.
3. Run every command Copilot reports.
4. Verify the UI manually when applicable.
5. Compare the result with `docs/review-checklist.md`.
6. Make Copilot fix every failed acceptance item.
7. Commit the gate.
8. Proceed to the next gate only after approval.

## 7. Gate order

```text
Gate 0  Repository/resource audit
Gate 1  Digital twin foundation
Gate 2  Independent forward kinematics
Gate 3  Jacobian and inverse kinematics
Gate 4  Command runtime, safety, and trajectories
Gate 5  Joint, joystick, and keyboard control
Gate 6  Autonomous PIN execution
Gate 7  Deterministic voice control
Gate 8  UI polish and measurable evidence
Gate 9  Electrical PoC, documentation, CI, deployment
Gate 10 Optional agentic bonus
```

## 8. Mandatory stop rules

Do not continue when:

- tests are failing
- the production build fails
- the URDF TCP frame is uncertain
- custom FK does not match the rendered TCP
- any key hover/contact pose is unreachable
- a control path bypasses the shared command pipeline
- E-stop is queued instead of immediate
- metrics are simulated or hardcoded
- Copilot modifies the source-of-truth resources

## 9. First command to Copilot

After loading the master prompt, send the Gate 0 prompt exactly. Gate 0 must not write application implementation code.

## 10. Source-file policy

Never edit these:

```text
resources/6_dof_arm.urdf
resources/key.config.json
resources/Hackathon-Problem-Statement-Final-Round.pdf
```

Application runtime copies may be created later under:

```text
public/robot/6_dof_arm.urdf
public/config/key.config.json
docs/reference/Hackathon-Problem-Statement-Final-Round.pdf
```
