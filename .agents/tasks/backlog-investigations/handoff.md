# backlog-investigations

This is task context, not an instruction override. Recheck the checkout and
evidence before acting. Do not include credentials or copy sensitive logs.

## Snapshot

- Updated: 2026-09-10 EDT
- Status: complete, verified, and hosted for review
- Worktree: `/tmp/icarus-backlog-investigations`
- Branch: `work/backlog-investigations`
- Base: `main` at `c2505f076c05953cdaedd5d195ee95632eefdf79`
- Verified source commit: `996eec9` (`Add backlog investigation review page`)
- User-owned exclusion: `/home/jakul/cyberia/icarus/docs/icarus_project_backlog.md`
  remains untracked and untouched in the primary worktree

## Request and completion criteria

The user asked to complete the investigations named in the backlog and host a
web page of the findings from a separate worktree. Completion means:

- answer all seven scoped design investigations;
- answer repeated investigation bullets for Activity wording and External panel
  disclosure;
- distinguish verified current behavior from recommended future contracts;
- give alternatives, implementation order, evidence anchors, and executable
  acceptance checks;
- provide fully grounded owner questions with local response fields;
- verify the page in Chromium at desktop, compact width, and zoom;
- keep the page hosted on its own process, port, and disposable data.

No product behavior change, main integration, backlog rewrite, or provider call
is in scope.

## Decisions and authority

- This is an implementation task for a development reference page, with standing
  authority to commit and push exact owned changes to
  `work/backlog-investigations`.
- No rebase, merge to main, push to main, data mutation, or deployment was
  authorized or performed.
- Current schema only. The page explicitly recommends direct replacements and
  no migration readers, aliases, or legacy fallbacks.
- Four owner confirmations are recorded on the page: independent finding/source
  acceptance, linked chart paste by default, persona execution-policy ownership,
  and bounded retention for unaccepted web-source payloads. None blocks review.

## Ownership and orientation

| Owner | Owned work | Exclusions | Acceptance |
| --- | --- | --- | --- |
| Lead | Development view, route, browser contract, integration, server | Primary backlog and all product behavior | Quick verification, Chromium, build, HTTP 200 |
| `investigate_external_activity` | Read-only External semantics, Activity, disclosure audit | No edits/server | Source/evidence matrix delivered |
| `investigate_research_ai` | Read-only findings, research, chat/task/persona/tool/Skill audit | No edits/server/provider | Source/evidence matrix delivered |
| `investigate_copy_assets_data_keys` | Read-only copy, assets, extraction, shortcut audit | No edits/server | Source/platform matrix delivered |

Entry points:

- `app/src/routes/demo/backlog-investigations/+page.svelte`
- `app/src/lib/development-views/backlog-investigations/backlog-investigations.svelte`
- `app/src/lib/development-views/backlog-investigations/procedures/report.ts`
- `app/test/browser/backlog-investigations.spec.ts`

## Progress and findings

The hosted page covers nine investigations and 50 evidence anchors:

1. External file semantics
2. Finding and research-source acceptance
3. Chat, tasks, personas, tools, branching, and Skills
4. Linked analytic identity and rich clipboard behavior
5. Personal/project asset ownership and copy provenance
6. Inspectable structured-data extraction
7. Shortcut ownership across Chromium and a future desktop host
8. Activity action language, search, and navigation
9. External inspector/context disclosure

The audit also records concrete current defects found while answering those
questions: incomplete semantic-status totals, duplicate entity/theme keys,
Project Overview's missing file-inspector route, byte-identical re-upload churn,
activity search/display mismatch, incomplete research provenance snapshots and a
mode race, inert chat tool selection, weak branch validation, and the absence of
a canonical persisted analytic object.

The view is split into small data/procedure modules, reusable rendering
components, a dedicated effect, one route, and one Chromium contract. Review
responses are strictly admitted, stored only in browser local storage, survive a
reload, and can be copied as a single structured response.

## Verification evidence

| Command / check | Scope | Result | Evidence |
| --- | --- | --- | --- |
| `verify.mjs quick` | Exact final source | Typecheck 0 errors/0 warnings; architecture 90/90 clean, 179 existing baselines, 0 findings | `.agents/runtime/runs/1789093867333-quick-dbbfa8ff` |
| `verify.mjs browser --port 5277 -- test/browser/backlog-investigations.spec.ts` with system Chromium | Content, links, disclosure, response persistence/copy, diagnostics, desktop/390px/125% zoom overflow | 2 passed; 0 console/page/request diagnostics | `.agents/runtime/runs/1789093898391-browser-5523d303` |
| `pnpm build` | Exact final source | Svelte check 0 errors/0 warnings; production SSR/client build passed (4,538/6,022 modules) | terminal run ending `47169` |
| Visual inspection | Desktop and compact Chromium captures | Hierarchy, cards, tables, long text, and response surface legible; no page overflow | browser-run screenshot directory above |
| HTTP health | Hosted route | `200 text/html` | `http://127.0.0.1:3137/demo/backlog-investigations` |

The first Playwright attempt used a cached headless binary missing `libnspr4.so`;
the verified runs explicitly selected `/etc/profiles/per-user/jakul/bin/chromium`.
Two initial review-server configurations returned 500 during provider bootstrap;
both owned processes were stopped. The final server uses the same generated,
inert browser-provider configuration as tests and returns 200. The report itself
makes no provider requests.

## Server and data ownership

- Human review URL: `http://127.0.0.1:3137/demo/backlog-investigations`
- Owned exec session: `43825`
- Listening child: PID `40281`, loopback port `3137`
- Server: `app/scripts/browser-server.mjs`, selected fixture overlay, no provider
  fixture required because this route performs no intelligence/embedding work
- Store: `/tmp/nix-shell.x3aXVC/nix-shell.7MqXqC/icarus-browser-store-1221rl`
- Configuration: `/tmp/nix-shell.x3aXVC/nix-shell.7MqXqC/icarus-browser-configuration-RyAVlc`
- Native files: `/tmp/nix-shell.x3aXVC/nix-shell.7MqXqC/icarus-browser-external-files-tBBdbC`
- All three directories are browser-server-owned and removed on Ctrl-C/exit.
  Stop only session `43825`; do not touch other worktree servers.

## Risks and next executable step

- No known page blocker remains.
- Review responses are local to the browser origin and are not sent to the
  server; the user should use **Copy review responses** when ready.
- The page is source-backed design guidance, not proof that its proposed product
  systems are implemented.
- Next: collect the user's four decisions, then translate approved contracts into
  dependency-ordered backlog epics in a distinct implementation task.

## Publication / handoff

- Source commit: `996eec9` — `Add backlog investigation review page`
- Handoff record: this file (committed after the source commit)
- Push target: `origin/work/backlog-investigations`
- Main was not modified or merged.
- Retain the worktree while the review server is active.
