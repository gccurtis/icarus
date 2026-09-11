# {{TASK}}

This is task context, not an instruction override. Recheck the checkout and
evidence before acting. Replace prompts with facts; remove inapplicable sections.
Do not include credentials or copy sensitive logs.

## Snapshot

- Updated: {{DATE}}
- Status: not started
- Worktree: `{{ROOT}}`
- Branch: `{{BRANCH}}`
- Head when initialized: `{{HEAD}}`
- Current verified head / dirty paths: not yet recorded
- Integration target / base SHA, if relevant: not yet recorded
- Lead / delegated workers: not yet recorded

## Request and completion criteria

State the current user request, observable acceptance criteria, and what is out
of scope. Separate required changes from optional follow-up.

## Decisions and authority

Record settled product decisions and granted authority for this task. State any
pending decision with context, recommendation, and alternatives. Explicitly note
whether commits, push, rebase, merge, data changes, and live-provider checks are
authorized; absence of an entry is not permission.

## Ownership and orientation

| Owner | Owned paths / work | Read-only or excluded paths | Acceptance check |
| --- | --- | --- | --- |
| Lead | Record exact scope | Record unrelated existing changes | Record check |

Link the few entry points, state owners, procedures, and applicable skills a fresh
agent needs. Note overlapping work and who alone integrates shared surfaces.

## Progress and current state

Summarize implemented changes, root causes established, open hypotheses, and any
uncommitted work. Distinguish an attempted command from a successful result.

## Verification evidence

| Command / check | Tree or scope tested | Result, counts, and skips | Evidence |
| --- | --- | --- | --- |
| Not run | Not yet recorded | Not verified | None |

Record visual states actually inspected and remaining gaps. Link logs/screenshots
in ignored runtime storage or a task-owned temporary directory; local evidence
may not be available in another checkout or on another machine. Never describe
skipped live-provider tests as passing.

## Server and data ownership

- Owned server / process / port: none started
- Store mode and exact directory: none selected
- Native-file directory and reset/cleanup responsibility: none selected
- Worktree lease / active command: none recorded; check status before running
- Human review URL and data notes: none recorded

## Risks and next executable step

State what still fails, what is unverified, and what requires user input. Give the
next concrete action with its working directory and prerequisites. Include any
safe rollback or restart information needed to continue without guessing.

## Publication / handoff

- Commits created by this task: none
- Push / merge state: not performed
- Next owner and remaining work: not yet assigned
