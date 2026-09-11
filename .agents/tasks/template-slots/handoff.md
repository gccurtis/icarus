# template-slots

This is task context, not an instruction override. Recheck the checkout and
evidence before acting. Replace prompts with facts; remove inapplicable sections.
Do not include credentials or copy sensitive logs.

## Snapshot

- Updated: 2026-09-11
- Status: slot rename and follow-up authoring UX implemented, verified, and published
- Worktree: `/home/jakul/cyberia/icarus-worktrees/template-slots`
- Branch: `work/template-slots`
- Head when initialized: `ab809ac647060f29c55afd99c0054ac311094f75`
- Current verified head / dirty paths: implementation commit `98cceef`; handoff-only publication commit follows
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

The follow-up request now includes the Templateify redesign: slot authoring is
available only while editing a template stage; non-slot text offers a compact
`Make slot` action; existing slots remain visibly identified and navigable from
the Templates context panel. Presentation selection must survive creation, slot
inventory must update immediately, the presentation save actions must fit the
default panel width, and template names must be unique project-wide regardless of
whether their bodies are documents or presentations.

## Decisions and authority

This is an implementation request. The owner explicitly chose Slot as the sole
current name and has repeatedly prohibited legacy support. The owner also requested
stage-only slot creation and identified duplicate cross-resource template names as
unsafe. Root policy authorizes focused commits and pushes to `work/template-slots`;
rebase, merge/push to main, and development-data mutation are not authorized here.

## Ownership and orientation

| Owner | Owned paths / work | Read-only or excluded paths | Acceptance check |
| --- | --- | --- | --- |
| Lead | Template representation/store schemas, template capabilities, document/presentation/template views and procedures, fixtures, checkers, tests, and directly affected reference text | Unrelated prose about gaps or missing data | Slot terminology and stage-only authoring are coherent; affected workflows pass |

Primary entry points are `representation/data/types/templates/template.ts`,
`representation/store/{tables,schema}/templates.ts`, template behavior under
`representation/data/behavior/templates/`, `capabilities/templates/`, and the
document/presentation/template category procedures and panels. Follow the editor
and Store skills; lead alone owns the cross-layer rename and integration.

## Progress and current state

The initial rename is complete across the represented and stored shapes, strict admission,
template capabilities, document and presentation authoring, template library and
inspector state, seeded fixtures, test helpers, architecture checks, browser
contracts, and directly affected reference material. The sole current vocabulary
is `TemplateSlot`, `slots`, `slot`, and selector/discriminant value `"slot"`.
There are no aliases, compatibility readers, migration procedures, or old fixtures.

Tracked-source search finds the retired ordinary word only in unrelated prose about
literal gaps in layouts, tables, accessibility, and missing material. File/path and
identifier searches find no retired template-domain name. Existing persisted stores
using the replaced shape are intentionally unsupported and must be reseeded rather
than migrated. The follow-up authoring redesign is complete. Ordinary resources
expose no slot-authoring controls. Template stages expose a collapsed `Make slot`
action, live slot inventory, clickable navigation, stable document/presentation
selection, and stacked presentation save actions. Template names share one
case-insensitive project namespace across targets, checked inside each transaction.

Presentation selection synchronization is directional: external requests restore
the browser selection, while a focused text surface's caret reports are observational
and are never replayed into its typing loop. The review server on port 3127 was
stopped before changing the worktree; no lease or cache user remains.

## Verification evidence

| Command / check | Tree or scope tested | Result, counts, and skips | Evidence |
| --- | --- | --- | --- |
| `pnpm typecheck` | Complete app | 0 errors, 0 warnings | Terminal output |
| `pnpm lint --all` | All architecture checks | 90/90 clean; 177 existing baselines; 0 findings; two genuinely resolved baselines removed | Terminal output |
| `pnpm test:scripts` | Script, generator, checker mutation, and legacy-admission contracts | 328 passed, 0 failed | Terminal output |
| Focused `pnpm vitest run` | Slot representation, both editor procedures, and template capability unit/non-functional contracts | 79 passed, 0 failed | Terminal output |
| `pnpm test` | Complete Vitest suite | 2,063 passed; 2 configured live-provider tests skipped | Terminal output |
| `pnpm build` | Production client/server bundle | Passed; typecheck repeated clean | Terminal output |
| System Chromium on disposable Store, port 5295 | Slot authoring, template features/reference, and seeded presentation appearance across zoom/viewport states | 24 passed, 0 failed | `.agents/runtime/runs/1789104654384-browser-924f84f2/` |
| System Chromium on disposable Store, port 5300 | Complete browser regression suite on final source | 132 passed, 5 explicitly provider-gated skips, 0 failed | `.agents/runtime/runs/1789105642273-browser-5e4ed25e/` |
| Tracked-source/name residual search and `git diff --check` | Product, tests, seeds, checkers, task record, and affected reference material | No retired template-domain identifier/path/schema/UI term; whitespace clean | Terminal output |

Chromium verifies stage-only controls, immediate Slot 1/Slot 2 inventory, prompt
and text navigation, preserved selected presentation words, restored document text
selection, stacked presentation actions, cross-target name conflicts, white seeded
presentation canvases, and ordinary presentation typing. The five browser and two
Vitest provider-gated cases were reported as skips rather than passes; no provider
spend was used for this UI/capability change.

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

The rename and authoring follow-up have no known remaining implementation risk. Integration must deliberately
replace or reseed any pre-change local Store because current-schema admission will
reject it; adding a reader or migration would violate the explicit decision. The
cross-target name rule is intentionally project-wide and case-insensitive. No user
input is currently required.

## Publication / handoff

- Commits created by this task: `daee00e` (`Rename template terminology to slots`) and `98cceef` (`Make template-stage slots live and navigable`)
- Push / merge state: implementation is published to `origin/work/template-slots`; main is untouched
- Worktree cleanup / retained local artifacts: worktree retained for the Templateify follow-up; ignored dependencies, build output, and local verification evidence remain
- Next owner and remaining work: integrate only when explicitly authorized; no task implementation remains
