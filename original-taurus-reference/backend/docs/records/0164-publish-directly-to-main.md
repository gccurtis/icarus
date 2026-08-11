# Publish directly to main

The repository workflow now uses scoped commits pushed directly to `main`.
Auxiliary publishing tools, side branches, and code-review gates are no longer
default delivery requirements.

## `AGENTS.md`

### Make the publishing rule authoritative

The working agreement now tells agents to commit verified work directly on
`main` and push it to `origin/main`. A different workflow is used only when the
user explicitly requests it.

## `docs/current-docs/`

### Correct the execution corpus

The corpus overview, packet index, program mirror, and all 44 agent-facing work
packets now describe one numbered change record and one scoped commit pushed to
`origin/main`. The useful completion-evidence checklist remains, but it belongs
in the change record and completion handoff.

### Preserve the source-mirror boundary

The Notion mirror policy now acknowledges explicit repository-owner workflow
corrections and requires them to be recorded until the upstream source is next
synchronized.

## `docs/records/0161-current-docs-execution-packets.md`

### Remove obsolete delivery language

The original corpus record now describes the current mainline delivery policy
without retaining stale protected-branch or code-review instructions.

## Verification

- Searched the active documentation for auxiliary publishing, protected-main,
  branch-stacking, and code-review workflow requirements.
- Ran the Ω completion baseline to revalidate all 44 execution packets and the
  176-page corpus inventory.
- Ran the repository format, build, and test gates before commit.
