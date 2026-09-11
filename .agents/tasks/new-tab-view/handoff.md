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
The user explicitly authorized integration into local `main` after the audit.
Pushing `main`, deployment, and external messages remain unauthorized.

## Checkout and ownership

- Worktree: `/tmp/icarus-new-tab-view`
- Branch: `work/new-tab-view`
- Starting base: `c2505f076c05953cdaedd5d195ee95632eefdf79`, origin/main at setup.
- Final target reconciled: `ab809ac647060f29c55afd99c0054ac311094f75`.
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

### Integration audit

- User explicitly authorized merging this work into main and requested a code-
  quality/bug audit first. Fresh `worktree.mjs ready` resolved both the historical
  and current target to `origin/main` `c2505f076c05953cdaedd5d195ee95632eefdf79`;
  source was `f4f31b51d20be224d959c90c88159077cc38f7b0`, two commits ahead, zero behind,
  with no textual conflicts or dirty task files.
- Full certification exposed a stale architecture mutation-test expectation:
  removing the resolved New Tab state-ownership baseline reduced that profile's
  debt count from 7 to 6, while `scripts/test/baseline.test.mjs` still asserted 7.
  Updated both exact assertions. This preserves the ratchet rather than restoring
  obsolete debt. Initial full evidence (expected failure):
  `.agents/runtime/runs/1789095579984-full-46081a42/`.
- Main's untracked `docs/icarus_project_backlog.md` and its existing Vite process
  remain unrelated, unstaged and untouched. Task review server was stopped and its
  disposable data cleaned before certification. No live providers are used.
- Read-only integration review found a cross-surface race: the center launcher and
  template context owned separate pending state, so two clicks in one New Tab
  could persist two resources. They now share one workspace-owned, tab-scoped
  command gate. New Tab creation/instantiation also stays independently owned, so
  separate New Tabs no longer share a result.
- Review also found that a failed template lost its library focus after resource
  inspection, Enter behaved differently from a native button click, and the reused
  template focus is now retained and Enter behaved differently from a native
  button click. Enter now inspects like a click and double-click opens. Per the
  explicit product boundary, shared Templates code is unchanged and spreadsheet
  templates remain unsupported; the New Tab context alerts without materializing
  one.
- Corrected-candidate evidence so far:
  - quick type/architecture profile: 0 errors, 0 warnings, 90/90 checks clean,
    `.agents/runtime/runs/1789096308758-quick-56748416/`;
  - focused lifecycle unit tests: 13 passed,
    `.agents/runtime/runs/1789096347807-unit-9d043fb8/`;
  - focused Chromium workflow: 15 passed, including the cross-surface race,
    delayed completion, reload, keyboard, failure, table, and compact/zoomed paths,
    `.agents/runtime/runs/1789096363004-browser-4b7f91ff/`.
    Wide, 1180 px, and 125% zoom screenshots were visually inspected.
- The full audit found old browser consumers of the retired `.area-editors`
  launcher selector and one helper that still single-clicked a row to open it.
  Those exact workflows now use `.area-create` and the resource table's specified
  double-click open interaction. Five affected browser files passed together:
  43 passed and one expected live-provider skip,
  `.agents/runtime/runs/1789097039593-browser-8389f8cb/`.
- The delayed-publication harness also treated an ordinary SvelteKit `__data.json`
  navigation cancellation as an application diagnostic in one run. Its collector
  now applies the same `net::ERR_ABORTED` filter as the other browser suites. The
  delayed workflow and all 15 New Tab workflows passed together:
  `.agents/runtime/runs/1789097996854-browser-e991c0b0/`.
- Per the clarified product boundary, all shared Templates inspector/procedure
  experiments were reverted. `git diff` has no shared Templates source changes.
  Spreadsheet templates remain unsupported: the existing inspector explanation
  remains, and New Tab's context alerts without creating a resource. Final focused
  evidence after that correction and ownership cleanup:
  - quick: 0 errors/warnings, 90/90 architecture checks clean,
    `.agents/runtime/runs/1789098957973-quick-9c35c622/`;
  - lifecycle unit: 14 passed (including alert-only spreadsheet templates),
    `.agents/runtime/runs/1789098988300-unit-cd4f17aa/`.
- Complete profile `.agents/runtime/runs/1789098080116-full-cb9852c4/` passed agent
  infrastructure (38), typecheck, 90/90 architecture checks, script tests (328),
  application tests (2,075 with two expected skips), and production build. Its
  Chromium phase passed 140 with five expected skips and one timing failure in an
  unchanged spreadsheet merged-cell focus test. No spreadsheet source or test was
  changed. Immediate rerun of the complete spreadsheet file passed 19/19, including
  that case: `.agents/runtime/runs/1789098832428-browser-3a221383/`.
- Live paid-provider tests were not enabled. Local deterministic provider-fixture
  workflows ran under the ordinary full/browser profiles.

### Final main reconciliation

- While the audit was running, `origin/main` advanced to
  `7d14ddb350b857898af97086af049da7d669c188`. The combined product tree was
  reconciled in `d91c291e1ee15610fdba098cee05ed0afc6863a0`. Two textual conflicts had
  established combined outcomes: Project Overview keeps the reusable resource
  table while consuming main's current project-resource index, and the tab bar
  keeps main's **External Files** label while permanent-tab activation preserves
  an unfinished New Tab.
- Shared Templates source has no branch diff. Document and presentation templates
  remain operational. Spreadsheet templates remain explicitly unsupported in New
  Tab and produce only the placeholder alert; no spreadsheet template resource is
  materialized.
- Final combined quick profile passed with zero type errors/warnings and 90/90
  clean architecture checks:
  `.agents/runtime/runs/1789099324488-quick-fd5c959a/`.
- Final combined focused unit profile passed 100/100 New Tab and workspace lifecycle
  tests: `.agents/runtime/runs/1789099359863-unit-e2271081/`.
- The first final Chromium attempt never reached the application because the
  downloaded browser binary lacked host `libnspr4.so`; this is environment-only
  evidence: `.agents/runtime/runs/1789099375782-browser-cc45849d/`. Rerunning with
  the repository-documented system Chromium passed all 24 New Tab, Overview,
  External Files, and tab-strip scenarios:
  `.agents/runtime/runs/1789099410130-browser-39a247c2/`. Wide, compact, 125% zoom,
  template-inspector, and tab-strip screenshots were inspected.
- Full combined certification passed: agent infrastructure 45/45, typecheck with
  zero errors/warnings, architecture 90/90 clean, scripts 328/328, application
  tests 2,091 passed with two expected skips, production build, and Chromium 146
  passed with five expected live-provider skips. Evidence:
  `.agents/runtime/runs/1789099525243-full-d6c9f85e/`.
- During that full run, main advanced once more to
  `ab809ac647060f29c55afd99c0054ac311094f75` through a Markdown-only backlog
  simplification. It was merged in `01b1390c792379edf84c62793c680e0a2dd5a899`.
  The certified product tree did not change; the task branch has no diff for that
  backlog file. The final post-reconciliation quick profile also passed with zero
  type errors/warnings and 90/90 clean architecture checks:
  `.agents/runtime/runs/1789100463392-quick-221033f5/`.

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

Final browser/full verification used isolated seeded Store/native-file data on
ports 5297 and 5307. The helpers cleaned those owned fixtures on completion. No
task review server or lease remains, and no primary development data was changed.
The requested ignored provider-configuration symlink remains in the task worktree
and was not read, edited, or staged.

Completion: implementation, current-main reconciliation, full certification, and
visual inspection are finished. Publish the exact task branch, run fresh readiness,
then fast-forward the clean local `main` checkout under the user's integration
authority. Do not push `main`. Retain the worktree, provider symlink, and ignored
evidence; cleanup requires separate exact authorization and a remote-main landing.
