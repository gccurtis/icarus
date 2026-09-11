# template-slots

This is task context, not an instruction override. Recheck the checkout and
evidence before acting. Replace prompts with facts; remove inapplicable sections.
Do not include credentials or copy sensitive logs.

## Snapshot

- Updated: 2026-09-11T04:06:59.326Z
- Status: implemented and verified; ready on the task branch
- Worktree: `/home/jakul/cyberia/icarus-worktrees/template-slots`
- Branch: `work/template-slots`
- Head when initialized: `ab809ac647060f29c55afd99c0054ac311094f75`
- Current verified head / dirty paths: task changes are verified against `main@ab809ac`; inspect Git for the published task commit
- Integration target / base SHA: `main@ab809ac647060f29c55afd99c0054ac311094f75`
- Starting worktree/base record: optional `worktree.json` beside this handoff;
  link it when present and verify it against Git
- Lead / delegated workers: lead owns the complete rename; no delegated writers

## Request and completion criteria

Rename the retired template-domain term to “slot” everywhere it is represented,
persisted, admitted, manipulated, rendered, seeded, tested, or explained. This is
a current-schema replacement: use `TemplateSlot`, `slots`, `slot`, and selector/
discriminant value `"slot"`; do not retain aliases, compatibility readers, or old
fixtures. Acceptance requires a clean tracked-source search for the retired concept
apart from unrelated ordinary-English uses, green schema/capability/unit contracts,
green architecture/type checks, and Chromium template workflows using Slot labels.

The later redesign of the Templateify button/section is outside this first change.
Only terminology that necessarily accompanies the rename is in scope now.

## Decisions and authority

This is an implementation request. The owner explicitly chose Slot as the sole
current name and has repeatedly prohibited legacy support. Root policy authorizes
a focused commit and push to `work/template-slots`; rebase, merge/push to main,
development-data mutation, and provider spending are not authorized here.

## Ownership and orientation

| Owner | Owned paths / work | Read-only or excluded paths | Acceptance check |
| --- | --- | --- | --- |
| Lead | Template representation/store schemas, template capabilities, document/presentation/template views and procedures, fixtures, checkers, tests, and directly affected reference text | Unrelated prose about gaps or missing data; Templateify redesign beyond required labels | No retired template terminology remains in an API, schema, or UI; affected workflows pass |

Primary entry points are `representation/data/types/templates/template.ts`,
`representation/store/{tables,schema}/templates.ts`, template behavior under
`representation/data/behavior/templates/`, `capabilities/templates/`, and the
document/presentation/template category procedures and panels. Follow the editor
and Store skills; lead alone owns the cross-layer rename and integration.

## Progress and current state

The rename is complete across the represented and stored shapes, strict admission,
template capabilities, document and presentation authoring, template library and
inspector state, seeded fixtures, test helpers, architecture checks, browser
contracts, and directly affected reference material. The sole current vocabulary
is `TemplateSlot`, `slots`, `slot`, and selector/discriminant value `"slot"`.
There are no aliases, compatibility readers, migration procedures, or old fixtures.

Tracked-source search finds the retired ordinary word only in unrelated prose about
literal gaps in layouts, tables, accessibility, and missing material. File/path and
identifier searches find no retired template-domain name. Existing persisted stores
using the replaced shape are intentionally unsupported and must be reseeded rather
than migrated. The Templateify control redesign remains the next separate change.

## Verification evidence

| Command / check | Tree or scope tested | Result, counts, and skips | Evidence |
| --- | --- | --- | --- |
| `pnpm typecheck` | Complete app | 0 errors, 0 warnings | Terminal output |
| `pnpm lint` | All architecture checks | 90/90 clean; 179 existing baselines; 0 findings | Terminal output |
| `pnpm test:scripts` | Script, generator, checker mutation, and legacy-admission contracts | 328 passed, 0 failed | Terminal output |
| `pnpm test` | Complete Vitest suite | 2,056 passed; 2 configured live-provider tests skipped | Terminal output |
| `pnpm build` | Production client/server bundle | Passed; typecheck repeated clean | Terminal output |
| System Chromium 152 on disposable Store, port 5283 | `template-features`, `template-reference`, `template-presentation-appearance`, and `template-external-isolation` | 25 passed, 0 failed | `.agents/runtime/runs/1789100515740-browser-8bffd644/` |
| Tracked-source/name residual search and `git diff --check` | Product, tests, seeds, checkers, task record, and affected reference material | No retired template-domain identifier/path/schema/UI term; whitespace clean | Terminal output |

Inspected the Chromium compact and wide template-presentation screenshots plus a
wide instantiated-document screenshot. They show `SLOTS`, singular/plural slot
metadata, the document's “Not a slot” state, white presentation canvases, and
readable seeded content across tested viewport/zoom states. The two skipped Vitest
cases require configured live providers and were not counted as passes; no provider
spend was used for this terminology change.

## Server and data ownership

- Owned server / process / port: verification helper owned and stopped the temporary server on port 5283
- Store mode and exact directory: disposable browser fixture; removed by the helper
- Native-file directory and reset/cleanup responsibility: disposable browser fixture; removed by the helper
- Worktree lease / active command: none after verification
- Human review URL and data notes: none recorded
- Local configuration: ignored `app/configuration/local.yaml` is linked from the
  primary checkout; tracked YAML remains task-owned and the link will not be staged
  or edited.

## Risks and next executable step

No implementation risk remains within this change. Integration must deliberately
replace or reseed any pre-change local Store because current-schema admission will
reject it; adding a reader or migration would violate the explicit decision. The
next product task is the separately requested Templateify control redesign. No user
input is required before reviewing this branch.

## Publication / handoff

- Commits created by this task: the focused `Rename template terminology to slots` task commit; resolve its SHA from Git
- Push / merge state: published to `origin/work/template-slots`; main is untouched
- Worktree cleanup / retained local artifacts: worktree retained for the Templateify follow-up; ignored dependencies, build output, and local verification evidence remain
- Next owner and remaining work: lead retains this worktree for the Templateify control redesign; integration is not authorized yet
