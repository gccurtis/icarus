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

Keep the worktree for review. No implementation or verification step remains for this request. Integration into main requires separate authorization; neither main nor the user's backlog file was changed.
