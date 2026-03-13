# Workflow: New Project Initialization

## Trigger
`claude-suite new-project`

## Steps

1. **Scaffold Directory Structure**
   - Create `.suite/` directory in current working directory.
   - Copy all templates from `templates/` into `.suite/`.

2. **Populate PROJECT.md**
   - Prompt user (or read `--auto` flag) for core value, business context, and tech stack.
   - Write answers into `.suite/PROJECT.md`.

3. **Populate REQUIREMENTS.md**
   - Prompt user for initial feature requirements.
   - Assign sequential IDs (`REQ-01`, `REQ-02`, ...).

4. **Generate ROADMAP.md Phases**
   - Map requirements to phases using default grouping (infrastructure → auth → logic → UI → deploy).
   - Fill in the traceability matrix in REQUIREMENTS.md.

5. **Initialize STATE.md**
   - Set current phase to `0. Initial Setup`.
   - Clear active tasks and blockers.

## Output
- Fully scaffolded `.suite/` directory ready for `plan-phase 0`.
