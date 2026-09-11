# Agent infrastructure

Status: implemented; final verification recorded below.
Updated: 2026-09-10
Lead: root agent. Workflow author: agent_workflows. Fresh-context check: onboarding_check.
Worktree: /home/jakul/cyberia/icarus
Starting branch/head: main @ eb784ec49b0574d785329320b91c7dd45c24303d

## Request, scope, and decisions

Create root agent instructions, repository skills, executable workflow helpers,
and durable task handoffs. Keep supporting files under `.agents/`. The future
Markdown wiki, existing references, and application behavior are out of scope.

The user approved bounded delegation with guardrails. Root instructions distinguish
scoped implementation from product decisions and history/publication authority.
The user subsequently authorized focused commits and a push for the completed
changes. No merge or deployment was requested. Existing permission for bounded
relevant Jina/OpenRouter verification is recorded; this task used neither.

Implementation-owned paths: `AGENTS.md` and `.agents/` only. At task start, a large
earlier presentation rename/editor/test change was uncommitted across app, seed,
and historical material. The publishing follow-up records that completed work
separately; it was not rewritten or included in the infrastructure tests. Do not
infer its verification status from the infrastructure results.

## Delivered structure

- `AGENTS.md`: orientation, source ownership map, architecture/design contracts,
  workflow routing, decision boundaries, verification, delegation, and handoffs.
- `.agents/skills/`: editor, Store, and branch-integration workflows. These are
  concise procedures, not a replacement wiki or a duplicate system explanation.
- `.agents/scripts/`: status, handoff creation, foreground dev server, and
  verification. Support modules separate process inspection, leases, command
  execution, profile planning, and checkout context; tests live in `test/`.
- `.agents/tasks/_template/handoff.md`: reusable context/decision/evidence template.
- `.agents/runtime/`: ignored process leases, command logs, and verification results.

Dev helpers require an owned port and explicit disposable/development Store mode.
The existing browser harness manages disposable data; development mode never
reseeds the review Store. Cache-touching helpers hold a worktree lease, refuse
active unmanaged Vite/test processes, and fail closed when process visibility is
sandbox-limited. They never automatically stop another process or steal a lease.
Browser verification strips inherited human-Store/harness/live-provider overrides,
uses Chromium and unique evidence paths, and requires explicit selected live tests.
Full verification includes the agent helper/skill checks as well as application checks.

## Verification evidence

Run `node .agents/scripts/verify.mjs agents` from the root with scoped access to
`.agents/runtime/` and process visibility if sandboxed. Exact outputs are in
ignored `.agents/runtime/runs/*-agents-*/result.json` and `1.log` on this machine.

Final pre-commit run: **25 passed, 0 failed, 0 skipped** on 2026-09-10, against the
task's uncommitted files. Evidence:
`.agents/runtime/runs/1789085013039-agents-245ba520/result.json` and `1.log`.
Architecture rerun: 90 clean checks, 179 existing baselines, 0 findings.
`git diff --check` passed; runtime evidence was confirmed ignored by Git.

- Helper tests exercise worktree lease ownership/contestation, occupied ports,
  process visibility, non-overwriting handoffs, protected browser configuration,
  command failure/logging, plan-only execution, and ordered full-profile execution.
- Dev lifecycle tests use the real disposable-data harness with a tiny temporary
  HTTP surface. Both modes release their lease/port on shutdown; disposable data
  is removed, and human-data sentinels are preserved. They do not run the app UI.
- Skill/frontmatter/link checks use the already installed YAML dependency. The
  bundled Python validator could not start without PyYAML; no dependency was added.
- A read-only fresh-context evaluation followed the document zoom/pin chain and
  selected an existing Chromium regression without reading old wiki material or
  mistaking diagnosis for permission to implement. It exposed a missing-handoff
  listing and limited process visibility; both were corrected.
- Real status found the review server on port 3113 plus another unmanaged Vite
  process. `dev.mjs --port 3123 --store disposable` correctly refused to start.
- App typecheck/build/browser suites were not rerun: no product source changed,
  and the existing review servers were deliberately left running.

## Runtime, risks, and next step

No persistent server was started by this task. Existing port 3113 and the other
Vite process are not owned by this task; recheck their current owners before any
cache-touching verification. Runtime evidence is local, ignored, and not portable.
Linux process discovery is best effort; inaccessible processes are not proof of
an idle host. A hard-killed owner may leave a lease: inspect owner and children
before removing only the exact stale lease files. No automatic recovery kills.

To orient a new agent: read `AGENTS.md`, run the status command, then read the
assigned handoff and relevant skill. Create its task with
`node .agents/scripts/handoff.mjs <task-name>`; fill the request and authority
sections before substantial work. Root instructions do not override sandbox/tool
permissions. Scoped access to protected `.agents` files may be required.

## Publishing follow-up

The user authorized committing and pushing all completed changes. The earlier
application work is recorded in focused commits:

- `92c1e92`: presentation terminology across resources, source, seeds, and references.
- `8749bcc`: spreadsheet range typing, both-endpoint locks, and regressions.
- `c47cfa1`: white template canvases and visual/external-source isolation coverage.

This handoff accompanies the separate agent-infrastructure commit. Locate it with
`git log -1 -- AGENTS.md .agents`; confirm current remote synchronization with
`git rev-list --left-right --count HEAD...origin/main` after fetching. Runtime logs
and review data are excluded from the commits. No wiki replacement was performed.
