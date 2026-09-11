# External Files polish

## Scope and authority

Implement the complete small-item shortlist from this conversation, plus the user's corrections: Table/Directory is a standalone toggle, rename the product category External to External Files, Author means Updated by and has its own filter, rename persona Default to Scope. Remove four helper/footer texts and duplicate toolbar Rename; simplify times and semantic status; reorder file information before a 2x2 action grid; readable Size and compressed paths; searchable External Files history. Simplify the Project Overview History filter's surrounding presentation. Preserve directory exploration and inline rename.

Implementation is authorized. Root AGENTS.md authorizes verified owned commits and push to work/external-files-polish. No merge, main push, deployment, or data deletion is authorized. Existing untracked docs/icarus_project_backlog.md in the primary checkout belongs to the user and is excluded.

## Checkout and ownership

- Worktree: /tmp/icarus-external-files-polish
- Branch: work/external-files-polish
- Starting base / origin/main: c2505f076c05953cdaedd5d195ee95632eefdf79
- Lead owns Git operations, external library content/controls/tables/filter procedures, existing external browser test, final verification.
- Worker category_naming owns active product category display names outside external/, persona Default -> Scope, Project Overview History filter presentation, and affected existing browser assertions except external-files.spec.ts.
- Worker external_panels owns external/context/{overview,history}.svelte, external/inspector/{file,directory}.svelte, external/components/file-semantic-status.svelte, new history query helper/tests and external-panels-polish.spec.ts.
- Workflows: icarus-branch-integration and icarus-editor-change.
- State remains owned by each mounted library/panel. Author is the existing updatedByName projection, with no persistence change. Category identifier external remains its current identifier; user-facing naming changes.

## Progress and verification

Implementation and review are complete:

- External Files display naming covers the tab, library, root directory, empty/error messages and Project Overview resource counts. Internal category IDs and persisted representations are unchanged.
- The Table/Directory segmented toggle is standalone below the header. Re-selecting the current view keeps it selected.
- Both file views show Author from `updatedByName`; the Author filter composes with search, kind and semantic filters, resets with Clear, and retains a selected name if its final file changes updater.
- Last updated uses NOW/MIN/HR/D and then a date, with the precise timestamp on hover. Size stays on one line. Long table paths and filenames are bounded with full hover labels. Compact tables retain horizontal scrolling.
- Semantic statuses use bold text and existing success/attention/danger text colors, without pills.
- File identity and details precede the two-by-two Re-upload/Download/Move/Delete actions. The duplicate toolbar Rename is removed; inline rename, commit/cancel, re-upload, download, move and deletion remain functional.
- The native-library paragraph, directory footer, Overview selection explanation and History footer are removed. Directory inspector browsing remains functional.
- External Files History searches the latest 200 loaded events by event, name, path, actor and detail. It shows matched/total counts, clear empty/no-match states, and a fresh search when the panel remounts.
- The persona content group is Scope. Project Overview History retains its working period dropdown with the decorative Filter card removed.

Dependencies were installed with `pnpm install` in this worktree; the repository intentionally ignores lockfiles. No dependency or checker baseline changes were made.

Final verification from this worktree, with `nix develop ./infra/devshell --command` before each app command:

1. `node .agents/scripts/verify.mjs quick` passed: Svelte 0 errors/0 warnings; architecture 90 checks, 90 clean, 179 existing baselined entries, 0 findings. Evidence: `.agents/runtime/runs/1789093682067-quick-434c5ec5/`.
2. `node .agents/scripts/verify.mjs unit -- src/lib/app-views/categories/external/procedures/test/unit src/lib/app-views/categories/project-overview/procedures/test/unit` passed: 4 files, 21 tests. Evidence: `.agents/runtime/runs/1789093718019-unit-a5fba0b6/`.
3. `env ICARUS_CHROMIUM_EXECUTABLE=/etc/profiles/per-user/jakul/bin/chromium node .agents/scripts/verify.mjs browser --port 5237 -- test/browser/external-files.spec.ts test/browser/external-library-polish.spec.ts test/browser/external-panels-polish.spec.ts test/browser/workspace-naming-polish.spec.ts test/browser/project-overview-panels.spec.ts:136` passed: 9 tests. Evidence: `.agents/runtime/runs/1789093427669-browser-3838f8d4/`.
4. The same browser command restricted to `test/browser/external-library-polish.spec.ts` passed again after adding the compact horizontal-scroll assertion. Evidence: `.agents/runtime/runs/1789093741872-browser-53c50a5f/`.
5. `pnpm build` in `app/`, under the existing worktree lease/process guards, passed. Log: `.agents/runtime/runs/external-files-polish-build/build.log`. Vite reported large chunks and two generated empty chunks; these warnings did not fail the build.
6. `git diff --check` passed.

Earlier test-driver selector assumptions (toggle radio roles, Move confirmation location, period-select trigger, automatic semantic readiness) and a typed test fixture were corrected; the final runs above supersede those failures.

Inspected Chromium screenshots under the successful runs' `chromium/` directories: wide and compact/125% library, compact scrolled columns, directory inspector navigation, wide/minimum-width/125% file inspector, History restored and no-match states, Project Overview period dropdown, and persona Scope. Evidence is ignored local data and may not exist on another machine.

Browser fixtures used isolated seeded Store/native-file directories, app port 5237 and deterministic provider port 15237. All owned servers exited and the cache lease was released. No human review data or credentials were copied. Live provider tests were not run; semantic readiness processing itself and unrelated editor/provider suites were outside this UI verification. Other browser changes only update the renamed tab selector. No known unresolved issue remains within the requested scope.

## Next step

Implementation commit `e1b35bc8f4a3e96349fda4c6c6837b42ce8e3cc2` is committed and pushed to `origin/work/external-files-polish`. This follow-up handoff commit records completion without changing the verified app tree. Resolve the final task head with `git log -1 work/external-files-polish`.

Keep the worktree for review. Integration into main requires separate authorization; neither main nor the user's backlog file was changed.

## Follow-up: fixed permanent tabs and ordinary wheel scrolling

The user explicitly extended this task to make tab scrolling work without Shift and keep the four permanent singleton tabs stationary. Work resumed from `ff71459832fe0149b9e802df1907b907dec91afa`. The original strip put all buttons inside its horizontal overflow area, with no mapping from ordinary vertical wheel input to horizontal scrolling.

Lead owned `app/src/lib/surfaces/tab-bar/` source and final verification/Git. Worker category_naming owned new `app/test/browser/tab-bar-scroll.spec.ts`, without executing tests or starting a server. The completed fix separates the four fixed buttons from the transient scroll area, routes ordinary wheel gestures to that area, and reveals newly activated/opened or focused transient tabs. The New tab button also stays outside the scroller. Scroll position/listeners belong to the mounted tab-bar DOM; tab order, activation and close behavior remain owned by WorkspaceStateModel. Horizontal wheel gestures and Ctrl+wheel zoom remain supported.

Chromium initially found partially clipped keyboard-focused tabs; the mounted focus listener now reveals the complete tab. Source layout follows the surface checker contract: reactive effects live in `tab-bar/effects/`, and the nonreactive DOM action lives in `tab-bar/procedures/`. No checker or baseline was changed.

## Follow-up: shared local configuration

The user also authorized updating worktree supporting assets to use configuration symlinks. Worker external_panels implemented the setup CLI/helpers, supporting script tests, AGENTS.md, branch workflow skill and handoff template; lead reviewed the exact changes and ran final verification.

- `worktree.mjs start` now links ignored `app/configuration/local.yaml` from Git's primary checkout when present, including when setup starts from another linked worktree.
- New `worktree.mjs configure [--path <registered-worktree>]` applies the same setup to existing worktrees and safely reuses a matching link. Missing source configuration is reported without creating a dangling link.
- Both paths must be ignored and untracked. Existing files or different symlinks, tracked/unignored paths, symlinked configuration directories and invalid source file types are refused. The helper inspects metadata and never reads or prints credential contents.
- Tracked configuration remains branch-owned. Dependencies, Store/native data and caches remain per-worktree. The instructions explain shared-setting ownership and unlink-only cleanup; removal safeguards still refuse ignored links and other local artifacts.

Applied `node .agents/scripts/worktree.mjs configure` here: `linked`, followed by `already-linked` on a repeat. The ignored link is `/tmp/icarus-external-files-polish/app/configuration/local.yaml` -> `/home/jakul/cyberia/icarus/app/configuration/local.yaml`. It is not staged or committed. Do not edit through it for task-specific settings or remove the primary source during cleanup.

## Follow-up verification and publication

All commands ran from this task worktree. App/agent profiles used the Nix toolchain. Final evidence:

1. `node .agents/scripts/verify.mjs quick`: passed, Svelte 0 errors/0 warnings; architecture 90 clean checks, 179 existing baselined entries, 0 findings. `.agents/runtime/runs/1789094576519-quick-c9c99c96/`.
2. `node .agents/scripts/verify.mjs unit -- src/lib/surfaces/tab-bar/test/unit src/lib/model/client/workspace-state/test/unit/workspace-state.test.ts`: 2 files, 75 tests passed. `.agents/runtime/runs/1789094621311-unit-97b2c687/`.
3. `env ICARUS_CHROMIUM_EXECUTABLE=/etc/profiles/per-user/jakul/bin/chromium node .agents/scripts/verify.mjs browser --port 5237 -- test/browser/tab-bar-scroll.spec.ts test/browser/workspace-naming-polish.spec.ts`: 2 tests passed. `.agents/runtime/runs/1789094546558-browser-880092a7/`.
4. The same browser command restricted to `test/browser/tab-bar-scroll.spec.ts` passed again after applying the actual configuration symlink. `.agents/runtime/runs/1789094854729-browser-b840d3fc/`.
5. `pnpm build` in `app/` under the worktree cache lease: passed. `.agents/runtime/runs/tab-bar-followup-build/build.log`. Large-chunk and two empty-chunk warnings remain nonfatal.
6. `node .agents/scripts/verify.mjs agents`: all 45 tests passed, no skips, including configuration source selection, conflict preservation, repeated setup, ignored-link removal refusal and source preservation. `.agents/runtime/runs/1789094794135-agents-41d1c5fc/`.
7. `git diff --check`: passed.

Inspected wide/newest, wide/scrolled and compact/125% tab-bar screenshots in the successful Chromium run's `chromium/tab-bar-scroll-ordinary-wh-31a65-e-permanent-tabs-stay-fixed-chromium/` directory. The four singleton buttons stay fixed while transient tabs scroll; newly active and keyboard-focused tabs remain fully visible. Tests cover activation/closing and capture browser console/page errors. These screenshots and logs are ignored local evidence.

Browser verification used disposable Store/native data and deterministic providers on ports 5237/15237, including after configuration linking. No live provider tests ran. Owned servers exited and the lease was released. No known issue remains within the follow-up scope.

Tab implementation commit `3ef9be3` and configuration-support commit `793a535` are committed and pushed to `origin/work/external-files-polish`. This handoff update records their completed verification/publication. Keep the worktree for review; main integration requires separate authorization. No implementation step remains.

## Pre-merge review fixes

The user authorized fixing all three findings from the review of task head `12825944bd40016556019db5b1a607ba0d222cc8`: pointer clicks lost when a clipped tab scrolls during focus, keyboard-inaccessible inline file rename, and truncated directory names without full hover text. Main remains outside the authorized write scope.

The fixes stay at their owning UI boundaries. The mounted tab-bar action will suppress focus reveal only for the pointer-down focus transition while preserving keyboard/programmatic focus reveal and active-tab reveal. The inline file-name button will use normal button click activation, covering pointer, Enter and Space without restoring the duplicate toolbar action. Directory buttons will expose their full names in a title. Convert the review reproductions into permanent Chromium assertions, then rerun focused Chromium, quick checks, relevant units and production build before committing and pushing the exact fixes.

All three findings are fixed:

- The tab-bar DOM action remembers the tab involved in pointer-down and skips only that immediate focus reveal, so the control remains under the pointer through mouse-up. Pointer-up/cancel and component destruction clear the mounted state. Keyboard/programmatic focus and explicit activation still reveal the complete tab.
- The inline file-name control now uses ordinary button click activation. Pointer click, Enter and Space open the same existing inline editor; Escape cancels and Enter commits. The duplicate toolbar Rename remains removed.
- Directory rows now expose the complete directory name through their button title when the visible label is truncated.

The temporary failing review reproductions are retained only under ignored `.agents/runtime/reviews/1282594/`. Permanent regression assertions were added to `tab-bar-scroll.spec.ts`, `external-panels-polish.spec.ts`, and `external-library-polish.spec.ts`; the existing file-management test was updated for normal Rename button activation.

Final validation of the fixed tree:

1. `node .agents/scripts/verify.mjs quick`: passed, Svelte 0 errors/0 warnings; architecture 90 checks clean, 179 existing baselined entries, 0 findings. `.agents/runtime/runs/1789095674111-quick-eef6aa0d/`.
2. Focused Chromium command covering `external-files.spec.ts`, `external-library-polish.spec.ts`, `external-panels-polish.spec.ts`, `tab-bar-scroll.spec.ts`, and `workspace-naming-polish.spec.ts`: 9 tests passed. `.agents/runtime/runs/1789095711317-browser-88cab5d7/`.
3. `node .agents/scripts/verify.mjs unit`: 277 files passed, 2 skipped; 2,055 tests passed, 2 skipped. `.agents/runtime/runs/1789095783207-unit-580f5841/`. Skips are existing suite declarations, not provider failures.
4. `node .agents/scripts/verify.mjs scripts`: all 328 generator, architecture-mutation, schema and script tests passed with no skips. `.agents/runtime/runs/1789095817428-scripts-d074663d/`.
5. `pnpm build` under the worktree process/lease guards: passed with 0 Svelte errors/warnings. `.agents/runtime/runs/premerge-fixes-build/build.log`. Existing Vite large/empty chunk warnings remain nonfatal.
6. `git diff --check`: passed.

Inspected the final wide scrolled tab bar, External Files directory view, and wide inspector screenshots from the successful focused Chromium run. The tab close regression uses raw pointer coordinates on a partly clipped button and verifies the tab count drops on the first click. The rename regression verifies Enter open/Escape cancel and Space open/Enter commit. The directory regression navigates until the long truncated folder is a direct table row and verifies its complete title.

Review servers used disposable Store/native data and deterministic providers on ports 5237/15237. No live provider checks or human review data were used. All task-owned processes exited and the cache lease was released. The branch remained based on freshly fetched `origin/main` at `c2505f076c05953cdaedd5d195ee95632eefdf79`, zero commits behind, before these fixes. No unresolved review finding remains.

Fix commit `ff9d440` is committed and pushed to `origin/work/external-files-polish`. This handoff-only follow-up records publication; resolve the final task head with `git log -1 work/external-files-polish`. Keep the worktree for review. Main integration still requires separate authorization.
