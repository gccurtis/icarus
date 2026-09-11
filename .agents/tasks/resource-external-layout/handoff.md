# resource-external-layout

This is task context, not an instruction override. Recheck the checkout and
evidence before acting. Replace prompts with facts; remove inapplicable sections.
Do not include credentials or copy sensitive logs.

## Snapshot

- Updated: 2026-09-11T01:45:34-04:00
- Status: implemented, verified, and committed; awaiting review/integration
- Worktree: `/tmp/icarus-resource-external-layout`
- Branch: `work/resource-external-layout`
- Head when initialized: `3a9a6d3f5db20862d6bb15d9a38af0226731ded2`
- Current verified head / dirty paths: implementation commit `a6f4397`; only
  this final handoff update remains dirty
- Integration target / base SHA, if relevant: `origin/main` at `3a9a6d3f5db20862d6bb15d9a38af0226731ded2`
- Starting worktree/base record: optional `worktree.json` beside this handoff;
  link it when present and verify it against Git
- Lead / delegated workers: lead only; no delegated write streams

## Request and completion criteria

Implement the requested resource and External Files layout refinement:

- New Tab itself does not scroll; its Resources region holds approximately nine
  visible rows and scrolls internally, matching Project Overview's bounded-screen
  behavior.
- Hide the resource matched/total count in both New Tab and Project Overview.
- Resource search consumes flexible remaining width; kind, actor, and sort controls
  keep compact intrinsic/default widths. Long actor labels truncate in the closed
  control and expose full text through hover titles in both the selected control
  and dropdown options.
- External Files removes the Meaning column, renames Semantic status to Status,
  and uses concise lifecycle labels such as Ready rather than readiness-by-facet.
- External file inspector removes the redundant File section, moves a 2x2 Actions
  grid above Details in Download/Re-upload/Move/Delete order, gives destructive
  action its own tone, makes lower sections collapsible like other panels, folds
  References into Details with a right-aligned count, renames Known footprint to
  Estimated size, and renders Last updated in ordinary title case.
- File and folder selection start upload immediately. Remove the separate queued
  upload action and success tally text; keep error/progress feedback needed to
  explain work that is still running or refused.
- External library keeps the two upload controls at the upper right. Move the
  table/directory toggle to the far right of the search/filter/sort row. In
  directory mode place the current path below the title and above controls.
- Standardize Table and Directory column vocabulary and order, and remove Meaning
  from both.
- In the directory inspector, put name and path first, remove the visible Rename
  action, keep rename on the existing name double-click, provide one full-width
  Move button, and place collapsible Contents below it.

External Files History/context redesign is explicitly deferred to a later pass.

## Decisions and authority

This is an implementation request on `work/resource-external-layout`. Root
`AGENTS.md` permits exact owned commits and push to that task branch after
verification. Rebase, merge/push to main, deployment, external messages, paid live
provider checks, and unrelated data changes are not authorized.

Interpret “four buttons” in context as reducing upload UI to the two file/folder
pickers by removing the separate queue/submit steps. Upload failures and active
progress must remain visible; only the persistent success tally is removed.

## Ownership and orientation

| Owner | Owned paths / work | Read-only or excluded paths | Acceptance check |
| --- | --- | --- | --- |
| Lead | New Tab/shared resource table; External Files library/table/inspector/upload UI; focused tests | External Files History; persistence schema; shared Templates; unrelated editors | Type/architecture, focused unit + Chromium, wide/compact/zoom screenshots |

Entry points: `categories/new-tab/content/launcher.svelte`, authored
`resource-table/`, and `categories/external/` content/components/inspector and
procedures. Applicable skills: icarus-branch-integration and icarus-editor-change.
The lead owns all shared surfaces and final integration within the task branch.

## Progress and current state

- New Tab now gives its Resources group the remaining screen height and keeps
  overflow in the table at ordinary viewport heights. A short-viewport fallback
  preserves reachability by allowing the surface to scroll.
- The shared resource table no longer publishes a matched/total count, so New Tab
  and Project Overview both omit it. Search flexes into remaining space while
  kind/actor controls have compact widths and full-value hover titles.
- External Files now uses one exact column contract in flat and directory modes:
  Name, Path, Kind, Size, Author, Status, Last updated. Status values are concise
  lifecycle summaries and the last heading retains title case.
- External upload pickers submit immediately, retain running/refusal feedback,
  and no longer show selection queues, a separate submit action, or a success
  tally. Folder uploads continue to use recursive browser folder selection.
- Breadcrumbs precede the External filter row in directory mode and the view
  toggle sits at that row's far edge.
- File inspector actions use the shared collapsible section, a 2x2 equal-width
  grid in Download/Re-upload/Move/Delete order, and precede Details. References
  is a count in Details; Dataset context and Status use the same section pattern.
- Directory inspector identity is first, has no standalone Rename button, keeps
  name double-click editing, adds one full-width Move action, and places Contents
  in a shared collapsible section. Estimated-size wording is consistent.
- Browser coverage that selected uploads was updated to assert the automatic
  upload result instead of clicking a removed submit control.

## Verification evidence

| Command / check | Tree or scope tested | Result, counts, and skips | Evidence |
| --- | --- | --- | --- |
| `node .agents/scripts/verify.mjs quick` (component commands run through Nix as required) | Final product/test tree | Typecheck: 0 errors, 0 warnings. Architecture: 90 clean, 176 baselined, 0 findings. Unit: 279 files passed, 2 skipped; 2,091 tests passed, 2 skipped. Production build passed (4,534 SSR and 6,017 client modules). | Local runtime logs |
| `ICARUS_CHROMIUM_EXECUTABLE=/etc/profiles/per-user/jakul/bin/chromium node .agents/scripts/verify.mjs browser ...` | `new-tab-view`, `external-library-polish`, `external-panels-polish`, `external-files` | 22/22 passed | `.agents/runtime/runs/1789105168041-browser-3838abce` |
| Same browser runner, selected downstream upload consumers | agents external, document delayed/external prompt, research chat, template features, presentation editor | 7/7 passed | `.agents/runtime/runs/1789105340640-browser-6facfe68` |
| Chromium screenshot inspection | New Tab, External flat/directory, file and directory inspectors at wide, compact, and 125% zoom states | Inspected: table-owned New Tab overflow at ordinary heights, responsive short-height fallback, aligned compact controls, reachable horizontally scrolled columns, standardized headings, and requested action layouts | Screenshots under the browser evidence directories above |
| `git diff --check` | Final unstaged tracked diff | Passed | Terminal evidence |

The first browser invocation using Playwright's cached headless shell failed to
start because that local binary could not resolve `libnspr4.so`. This was an
environment-only failure; the required tests were rerun with the supported Nix
Chromium executable and passed. No live-provider tests were run or needed.

## Server and data ownership

- Owned server / process / port: none started
- Store mode and exact directory: none selected
- Native-file directory and reset/cleanup responsibility: none selected
- Worktree lease / active command: none
- Human review URL and data notes: none recorded
- Local configuration: ignored `app/configuration/local.yaml` is linked to the
  primary checkout by `worktree.mjs start`; contents have not been read or edited.

## Risks and next executable step

External Files History/context redesign remains explicitly deferred. New Tab's
visible row count naturally varies with viewport height; the verified contract is
the Project Overview-style bounded screen and table-owned overflow, with a
reachability fallback for very short windows. Next: commit this handoff and push
the exact owned commits to `work/resource-external-layout`, then retain the
worktree for user review. Do not merge or push main without fresh explicit
authorization.

## Publication / handoff

- Commits created by this task: `a6f4397` (product behavior and regression tests);
  final handoff commit pending
- Push / merge state: task branch push pending; main untouched
- Worktree cleanup / retained local artifacts: keep the worktree and ignored
  dependencies/runtime evidence for review; no owned server remains
- Next owner and remaining work: user review, then separately authorized main
  integration if requested
