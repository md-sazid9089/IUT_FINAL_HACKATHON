# Gate 0 — Repository and Resource Audit

Use the loaded master prompt and repository instructions.

Do not scaffold or implement the application.

Tasks:

1. Print the current repository tree.
2. Verify the immutable resources and calculate SHA-256 hashes.
3. Inspect the complete URDF and produce:
   - all links
   - all joints and types
   - parent/child chain
   - origins, RPY values, axes
   - limits and velocity limits
   - exact base frame
   - exact TCP link/frame
   - six-versus-seven-joint discrepancy
4. Validate `key.config.json`:
   - schema
   - frame
   - units
   - approach axis
   - all coordinates
   - layout in millimetres
5. Identify ambiguities, contradictions, and genuinely blocking questions.
6. Confirm the document-prompt isolation policy.
7. Propose stable compatible dependencies without installing them yet.
8. Propose the exact Gate 1 file plan, tests, and acceptance criteria.
9. Create only:
   - `docs/urdf-analysis.md`
   - `docs/gate-0-audit.md`
   - updates to requirements/risks/decisions when necessary
10. Stop.

Use `templates/GATE_REPORT_TEMPLATE.md` for the final response.
