# New Tab view

## Request and authority

Implement the New Tab redesign in an owned worktree: opening/creating a resource
consumes its originating launcher and focuses the destination; add five colored
Create actions; standardize Recent cards; use the Overview resource table and
inspector; move real templates into the context panel. Remove the standalone
search, Recent count, bottom templates carousel and irrelevant variable warning.

The user clarified that **Analysis graph keeps its existing alert for now**.
The user subsequently requested symbolic links for provider configuration. The
ignored `app/configuration/local.yaml` now links to the primary checkout's file
at `/home/jakul/cyberia/icarus/app/configuration/local.yaml`. Its contents were
not copied, printed, edited, staged or committed. No live provider checks run.
Template launching uses saved defaults; missing required text retains the launcher
and offers the specific template in the library's existing input flow.
Ordinary tab-bar switching preserves New Tab; choosing a destination through the
launcher consumes it. Recent single-click inspects; double-click/Enter opens.

Root AGENTS.md authorizes exact owned commits/push to `work/new-tab-view`.
No rebase, main integration/push, deployment, or external messages authorized.

## Checkout and ownership

- Worktree: `/tmp/icarus-new-tab-view`
- Branch: `work/new-tab-view`
- Starting base: `c2505f076c05953cdaedd5d195ee95632eefdf79`, origin/main at setup.
- Lead owns final integration, launcher UI/procedures, inspector and test verification.
- Worker `resource_table`: reusable table extraction and narrow workspace admission.
- Worker `tab_lifecycle`: workspace open lifecycle and Chromium scenarios.
- Main's unrelated untracked `docs/icarus_project_backlog.md` is excluded.
- Skills used: icarus-branch-integration, icarus-editor-change, icarus-store-change.
- No secrets, local development data, dependencies or caches were copied.
  Dependencies installed through Nix from existing package.json (repository tracks
  no pnpm lockfile); generated dependency/toolchain lock files remain ignored.

## Implementation

### Review follow-up

- Reuse this worktree from `15dab2c`; no new branch or main changes.
- User's final scoping limits count removal to New Tab. Overview keeps its count.
- Template context single-click inspects the existing template panel; double-click
  and Enter use the template. Keep shared panel selection reloadable with a narrow
  workspace admission for `templates.template`, not arbitrary template lenses.
- New Tab's resource inspector adds Open chat (real research tab), Open spreadsheet
  (real editor) and Open finding (alert-only). Overview action availability stays
  unchanged. Finding/external consolidation is explicitly excluded.
- External-file absence is expected in the review server's seeded disposable
  Store: `app/seed` has no externalFiles table. Its query/projection is shared with
  Overview and does not exclude files. Do not copy the primary development Store.
- Template selection is workspace-owned, visibly highlighted and persisted;
  selecting another template clears the previous launch error. Enter first
  selects its subject so a missing-input shortcut cannot target an older template.
- The shared resource inspector's action procedure stays with its owning Overview
  category; new action availability is conditional on New Tab. No cross-category
  view import or architecture-baseline allowance was added.
- Storage change admits only the existing template inspector in New Tab snapshots
  and open/close logs. The normal project/user-scoped workspace transaction still
  publishes revisions and snapshots atomically; unrelated lenses remain refused.

- Workspace `open` captures the active launcher, opens/activates the destination,
  then closes that exact launcher through normal workspace operations. Existing
  destination tabs are reused, and other launchers remain.
- Permanent tab-bar buttons now activate their already-existing tabs, matching
  named-tab switching and preserving an unfinished launcher.
- Creation and template procedures capture the origin and component lifetime;
  late results after switching or remounting cannot navigate another tab.
- New Tab uses current resource queries and template capabilities. Analysis stays
  alert-only. No saved graph capability was introduced.
- Create uses existing resource color tokens. Recent uses the existing carousel,
  equal 13rem card slots, fixed 80px miniature preview wells and hover titles.
- `components/authored/resource-table/` owns common rendering/filter state.
  Each category has its own query/workspace adapter. Overview keeps the same
  search, kind/actor filters, ordering, selection and opening behavior.
- Resource inspector's Resources breadcrumb clears selection rather than trying
  to open an unavailable context view.
- Storage admission narrowly allows New Tab to retain the shared resource/file
  inspector and the resource inspector's connector/agent-task links. This fixes
  rejected close/snapshot operations after inspecting a resource. Unrelated
  template/editor/other category lenses remain refused. No transaction behavior,
  stored shape, ownership rule or compatibility reader changed.
- Removed three resolved launcher architecture baseline entries; added no debt.
- Existing unused mock New Tab procedure scaffolding and other inherited
  incomplete inspectors were not expanded or used as authoritative data.

## Verification

Evidence below is local ignored runtime storage, not portable to another checkout.

### Review follow-up evidence

- Final focused unit run: 164 tests / 9 files passed, including all resource Open
  routes, finding's alert-only behavior and template inspector admission/reload.
  `.agents/runtime/runs/1789095219854-unit-c38a2711/`
- Final Chromium run: 18 scenarios passed (14 New Tab, 4 Overview panels), including
  New Tab-only count omission, real chat/spreadsheet Open actions, finding alert,
  template single-click/reload, double-click/Enter creation and error retargeting.
  `.agents/runtime/runs/1789095140140-browser-3d53e8a9/`
- Inspected final template inspector screenshots at wide and compact/125% sizes,
  the finding action screenshot and the count-free table. Selection and action
  states are readable; artifacts are in the final run's `chromium/` directory.
- The first browser run had 16 passes and two test-assumption failures: the seed
  contains five research threads, and the existing editable template heading's
  accessible name includes "Edit template name". Corrected those assertions.
  `.agents/runtime/runs/1789095008787-browser-292bc4ac/`
- The first architecture run caught a cross-category view import. Moved the open
  procedure to the inspector's owning category; subsequent checks are clean.
- Final typecheck: zero errors/warnings. Architecture: all 90 checks clean, no
  new findings or baseline debt. `git diff --check` passed.
  `.agents/runtime/runs/1789095244847-quick-3bbe1208/`
- No live provider tests, external-data consolidation, or full-suite run.
  Production build evidence below belongs to the initial implementation.

### Initial implementation evidence

- Focused workspace/resource/projection unit run: 113 tests passed.
  `.agents/runtime/runs/1789093032220-unit-7e6bfa86/`
- Async creation/template lifetime and failure checks: 6 tests passed.
  `.agents/runtime/runs/1789093120133-unit-6b96c474/`
- Latest affected unit set: 157 tests / 9 files passed, covering workspace client,
  capability and stored admission, new-tab projections and async commands.
  `.agents/runtime/runs/1789093683887-unit-45d81732/`
- Typecheck: zero errors/warnings; architecture: all 90 checks clean, zero findings.
  `.agents/runtime/runs/1789093632139-quick-d7629978/`
- Initial Chromium run: 10 passed, 6 failed from two test selectors. It also
  exposed the shared-inspector persistence rejection, subsequently fixed.
  `.agents/runtime/runs/1789093288124-browser-be38faec/`
- Inspected initial wide and compact/125% screenshot artifacts: equal cards,
  correct colors, wrapped action row, readable filters and template list.
- Related Chromium rerun: 18/19 passed, including all 8 resource-creation and
  project-overview-panels scenarios. The remaining reload test used an incorrect
  predicate for the encoded command payload; corrected in the final run below.
  `.agents/runtime/runs/1789093710711-browser-66a237c0/`
- Final New Tab Chromium run: all 11 scenarios passed, including saved selection
  and consumed-launcher reloads, all creation types, template defaults/refusal/
  empty library, filters, inspection, deduplication and async failure/lifetime.
  `.agents/runtime/runs/1789093880777-browser-268eb519/`
- Inspected final wide, compact, and compact/125% screenshot artifacts, including
  the scrolled resource table. Cards remain equal; actions/filters wrap and rows
  remain readable. Screenshots live under the final run's `chromium/` directory.
- Production `pnpm build` passed, including zero type errors/warnings. Vite reports
  large chunks and empty generated chunks; no build failure. Evidence:
  `.agents/runtime/new-tab-build.log`.
- `git diff --check` passed.
- No live providers used. Paid research/generation is outside these checks.
- This is affected-area verification, not the full repository test suite.

## Runtime and next step

Browser verification used isolated seeded Store/native-file data on port 5267
(provider fixture 15267), cleaned by the harness on completion. Port 5237 was
already occupied; no process there was touched.

Human review server: `http://127.0.0.1:3197/app/dev-project`, exec session 67263,
started from this worktree with:
`nix develop ./infra/devshell --command node .agents/scripts/dev.mjs --port 3197 --store disposable`.
It uses the requested provider-configuration symlink and owns a development-server
lease and separate seeded disposable Store/native files. Earlier unconfigured and
local-provider-fixture review sessions (95594 / 14120) were stopped; their owned
disposable data was removed by the helpers. The temporary fixture wrapper was
removed; no primary development data was deleted. Session 42945 was stopped for
follow-up verification and its disposable review data cleaned by the helper.
Stop only session 67263 with Ctrl-C before running another cache user;
shutdown removes its disposable review data. Never reset human review data with
browser fixtures. The printed URL opens Overview; use the tab-bar plus for New Tab.

Completion: implementation and verification are finished. This handoff travels
with the owned changes on `work/new-tab-view`; the branch HEAD identifies the
completion commit. Publication destination is `origin work/new-tab-view`.
Next: user review on port 3197. Retain the worktree and ignored verification
evidence; main integration and cleanup require separate authorization.
