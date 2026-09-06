# Document editor implementation plan

**Status:** Complete · current-main Chromium convergence green; Firefox baseline retained
**Implementation branch:** `work/document-editor-integration`, based directly on `main`
**Reference implementation:** `work/document-editor` at `55a7b22`
**Validated base:** local `main` at `b4894c7`
**Companion:** [Document editor review](../document-editor-review/document-editor-review.md)

## Outcome

Bring the useful document-editor implementation into the product without importing its known
failures, its accidental UI regressions, or a second source of truth.

The reference branch is a **donor**, not the merge target. The implementation should begin on a new
branch from current `main`. Each donor phase is applied without committing, repaired and reshaped,
then committed only when its unit, browser, accessibility, and console gates are green. The final
history should contain coherent, reviewable, working slices—not seven known-broken commits followed
by a cleanup commit.

```text
main
  └─ work/document-editor-integration
       ├─ 01 model + runtime foundation                 green
       ├─ 02 projection + editing + selection           green
       ├─ 03 shared inspector controls                  green
       ├─ 04 inspectors + context panels                green
       ├─ 05 comments + links                           green
       ├─ 06 furniture + layout                         green
       └─ 07 release evidence                           mergeable

work/document-editor @ 55a7b22  ── donor/reference only; never merged as ancestry
```

## Approved decisions

The recommended choices were approved on 5 September 2026. They are fixed inputs to the
implementation because three of them change representation shapes or editing semantics.

| Decision | Recommended default | Alternative | Why it matters |
| --- | --- | --- | --- |
| Style after Enter | Fixed semantic rules: Body→Body; list→list; Heading/Quote/Caption→Body. | Add editable `nextStyle` metadata to every named style. | Determines whether continuation is editor behavior or persisted style data. Fixed rules solve the current defect with less model surface. |
| Comment span | One contiguous selection may cross blocks and stores multiple structural spans. | Explicitly restrict comment creation to one block for this release. | Multi-span support changes the comment anchor representation and shifting logic. Restriction is smaller but must be visible and honest. |
| Link notes | Notes belong to one link occurrence/mark. | Create a URL-level object shared by every occurrence. | Occurrence notes fit the current mark model and can describe why a source matters in this sentence. Shared notes require identity, deduplication, and another editing surface. |
| Typography ownership | Font family/size remain named-style properties; Body style fields may be block overrides. | Permit character-level font family/size marks. | Preserves the established model boundary and prevents selection-local controls from inventing data the model does not own. |

## Non-negotiable architecture

These are acceptance criteria, not aspirations.

| Guardrail | Must remain true | Proof required |
| --- | --- | --- |
| Canonical ownership | The stored leader is canonical; the client runtime owns the one live body shown while editing. | No component or editor plugin keeps an authoritative body copy. Runtime tests cover attach, apply, flush, refusal, catch-up, and release. |
| Editor boundary | ProseMirror is a projection and input adapter. Only typing lands there first; panels state native operations directly. ProseMirror JSON is never persisted. | Projection round-trip tests and browser tests compare pixels/selection with `runtime.body`. |
| One operation language | The same document applier runs client and server. Every operation validates, applies, and inverts without a lookup. | Apply/invert property matrix; `invertAll(ops)` restores the exact prior body. |
| Structural addresses | Marks, links, comments, selections, find hits, and repaint bookmarks use stable block/atom IDs plus display offsets. | Insert/delete/reflow tests keep anchors on the intended content or enter an explicit detached state. |
| One gesture, one history entry | Runtime history records user gestures; buffer coalescing never rewrites undo history. | Undo/redo browser scenarios include formatting, multi-range edits, comments where applicable, and furniture. |
| Derived layout | Natural pages, line placement, zoom, and repeated furniture projections do not become collaborative document data. | Resize/reflow emits no document operation unless a modeled page setting changed. |
| Canonical furniture editor | Each header/footer root has at most one editable ProseMirror instance. Repeated page appearances are read-only projections that activate it. | Editing one instance updates every page without echoed operations or divergent state. |
| Selection survives inspection | Focusing any inspector, context panel, picker, composer, or drawer preserves the visible document selection and all ranges. | Keyboard and pointer browser tests at narrow/default/wide rails. |
| Shared controls, semantic styling | Inspector controls use authored panel primitives and public design tokens, with full idle/hover/focus/selected/disabled/error states. | Component lint, keyboard tests, grayscale review, and no one-off swatch/number/mark implementations. |
| Failure is recoverable | A refused or failed mutation never disappears and never surfaces only as an uncaught console exception. | Panel error state names the failure and offers retry/reapply where valid. |

Primary source contracts:

- `docs/archive/screen-specs/document-editor.md`
- `app/src/lib/model/client/document-runtimes/document-runtimes.md`
- `app/src/lib/model/client/document-runtimes/methods/history/history.md`
- `docs/archive/app-docs/frontend-design/accessibility/component.md`
- `docs/archive/app-docs/frontend-design/interaction/component.md`

## Adoption map

### Adopt the idea and implementation shape

- Native document operation/applier spine shared by client and server.
- Optimistic live `DocumentRuntime`, catch-up handling, and runtime undo/redo.
- Structural atom endpoints for marks and selection.
- ProseMirror schema/projection for rows, blocks, marks, formulas, explicit breaks, and pagination.
- Real Sections, Find, Styles, Layout, and Comments panel data flows.
- Non-contiguous selection as a custom selection plus decorations.
- Stored page setup, furniture roots, and generated page numbering.

Adopt does not mean copy unchanged. Every item crosses its phase gate before becoming a commit.

### Repair before adoption

- Mark insertion ordering during foreground, background, and link replacement.
- Full selection type/range preservation and held highlighting across repaint.
- Enter/split semantics so the declared next style and rendered presentation agree.
- Link activation and suppression of raw ProseMirror node-selection chrome.
- Comment anchor shifting after text edits and safe handling of cross-block selections.
- Sections line calculation/formatting and long-title layout.
- Recoverable control errors and clean normal-path requests.

### Recompose using the main-branch interaction design

- Four-up Bold/Italic/Underline/Strikethrough row with responsive words/initials.
- Shared FG/BG color picker on one row, with palette, eyedropper, and “More colors…”.
- Compact font row and direct numeric inputs without stepper buttons.
- Body style section: alignment, Space above, Space below, Line height, Indent.
- Commented-text source, opening comment, and replies as distinct hierarchy.
- Compact key/value rows, stronger section rhythm, and one-row orientation.

### Build or extend

- Persisted per-occurrence link notes and URL normalization/validation.
- Multi-span comment anchors if approved, including legacy decoding and anchor shifting.
- On-page canonical header/footer editing with styled repeated projections.
- Deterministic seeded editor fixture and browser regression suite.
- Custom-color detail screen later; the shared picker and callback contract ship now.

### Remove from the ordinary interface

- Code from the inline formatting row; retain read compatibility for stored code marks and blocks.
- Hard-coded Quote bar/padding and forced link blue/underline.
- Header/footer “From edge” controls; keep a safe internal compatibility value.
- Detached comment pins floating at the top of the page.
- Plus/minus number steppers and the inherited disabled-descendant dimming behavior.

### Explicitly defer

- Variables, Templates, and Prompts panels beyond honest placeholders.
- Visual hex/color-field custom-color screen beyond its “More colors…” entry point.
- In-place table cell editing, uploads, formula authoring, presence, rulers, and margin guides.

## Sequence

Every phase begins green and ends green. A donor commit may be applied with `--no-commit` as a
starting point, but its code is not committed until the phase outcomes below are true.

### Phase 00 — alignment, fixture, and test harness

**Purpose:** remove ambiguity before moving model boundaries.

- Confirm the four decisions above and record them in the plan.
- Create a deterministic, resettable *Winter readiness brief* fixture; do not use mutated personal
  browser state as a test oracle.
- Add a Playwright editor harness that fails on console warnings/errors, page errors, and unexpected
  failed requests.
- Encode the gesture contract: click caret, drag range, double-click word, Shift-double-click block
  text, Ctrl/Cmd-drag add range, Ctrl/Cmd-click link open.
- Record narrow, default, and expanded rail widths as named viewport configurations.
- Write acceptance scenario names for every audit finding before porting its implementation.

**Exit:** current `main` stays green; the harness can open the fixture and report clean evidence.

### Phase 01 — representation and live runtime

**Donor:** the representation/runtime portion of `62be118`.

- Port structural mark endpoints, block-format fields, document targets, furniture paths, and
  selection ranges.
- Settle approved link-note and comment-anchor shapes now; include legacy decoders and round-trip
  fixtures rather than migrating the same model twice.
- Install one document applier under representation and keep capabilities as validation wrappers.
- Port optimistic runtime apply, coalescing, refusal/rebase/catch-up, release, and runtime history.
- Ensure every op contains its exact inverse data and every path is validated on both sides.
- Update schema/model documentation in the same commit as representation changes.

**Tests:** every operation × apply × inverse; invalid path/value matrix; optimistic refusal leaves
body/buffer unchanged; coalescing preserves first `was` and last `value`; release never drops work.

**Exit:** a headless runtime can perform and undo every required data change with no editor mounted.

### Phase 02 — projection, editing, and selection

**Donor:** repaired portions of `967064e` and `55a7b22`.

- Port the custom schema, projection, translation, pagination, and style resolution.
- Preserve complete selection snapshots: primary range, every secondary range, selection type,
  direction, and held-highlight state.
- Implement approved next-style semantics without copying stale `presentation` or local formatting
  into a block that declares Body.
- Add multi-range pointer behavior, safe text replacement, IME/composition coverage, and stable
  mapping through local, accepted, remote, formula-display, and layout-only repaint origins.
- Prevent text blocks from becoming user-visible node selections.
- Add explicit link activation handling with scheme validation and safe window semantics.
- Fix mark replacement by choosing an insertion anchor from the post-removal sequence or using a
  single in-place replacement operation.

**Tests:** projection round trip; repeated FG/BG/link replacement; split/merge matrix by variant;
selection snapshot/restore; multi-range typing; IME; reflow; Ctrl/Cmd-open link.

**Exit:** the page surface is live, data and pixels agree, and no editor action exposes raw library
state or loses a legal selection.

### Phase 03 — shared inspector instruments

**Source:** retain the main-branch interaction concepts; use donor handlers only after Phase 02.

- Implement one `PanelMarks` with exactly four ordinary actions, equal-width cells, and a container
  query for full labels versus B/I/U/S.
- Implement one `PanelColorPicker` used by selection, next-letter, empty-line, and named-style
  lenses. Include palette, None where legal, EyeDropper capability state, and `onCustom` entry point.
- Reduce `PanelNumber` to direct input with keyboard arrows, validation, units, and a normal-looking
  minimum value. Remove disabled-descendant opacity from mixed groups.
- Add a compact shared key/value row/group primitive rather than restyling each lens independently.
- Define full interaction states with semantic tokens and minimum 24px targets.
- Add a component/demo matrix at 280px, the default rail width, and 500px.

**Tests:** keyboard-only operation; focus-visible; disabled reason; mixed values; container-width
snapshots; eyedropper unavailable state; invalid number/color recovery.

**Exit:** every shared control is independently reviewable and no document lens carries a private
copy of its behavior or palette.

### Phase 04 — inspectors and context panels

**Donor:** repaired portions of `c4a542e` and `3d9b633`.

- Wire shared controls to real operations for text selection, next letter, empty line, named style,
  image, and table.
- Preserve typography ownership: selection lenses report/apply the relevant named style; they do not
  invent character-level font family or size.
- Compose Body style from alignment, Space above, Space below, Line height, and Indent.
- Remove immutable Quote/link projection styling. Link creation may add ordinary blue + underline
  marks as editable defaults.
- Port Sections, Find, Styles, Layout, and Comments with compact rows and stronger hierarchy.
- Round/humanize Sections placement and protect title width from metadata.
- Keep Variables, Templates, and Prompts as explicit placeholders.

**Tests:** every control writes the intended native path; mixed/multi-block selection; narrow and
wide rows; Find/replace boundaries; style apply/duplicate/delete; long and empty Sections states.

**Exit:** each implemented rail destination and lens is real, responsive, keyboard-operable, and
free of duplicated control logic.

### Phase 05 — comments and links

**Donor:** repaired portions of `b70d0b8` plus the store-backed work in `c4a542e`.

- Persist URL + note using the approved ownership model; normalize allowed schemes and reject unsafe
  ones with inline recovery.
- Keep link navigation semantic and link appearance editable through ordinary marks.
- Compose comment inspection as Commented text → divider → opening comment → ordered replies →
  composer/actions.
- Implement the approved selection-span model without silently truncating a selection.
- Shift structural comment anchors when text operations touch their atoms; define overlap/delete
  collapse rules and apply them on the canonical operation path.
- Put detached threads in a named Comments-panel group with Show/relink/dismiss policy; draw no
  detached page pin.
- Keep resolved threads discoverable in the panel and absent from the active gutter.

**Tests:** link add/edit/remove/re-add/note/undo/open; unsafe URL; comment create/reply/resolve/reopen;
typing before/inside/over an anchor; block deletion; cross-block span; detachment and relink state.

**Exit:** links and comments survive edits, reloads, undo where modeled, and concurrent-safe server
application without losing or misrepresenting their targets.

### Phase 06 — furniture and layout

**Donor:** model/projection ideas from `fae879e`; replace its inspector mini-editor.

- Mount one canonical editor for each active header/footer root in the page canvas.
- Make every repeated page appearance a styled, read-only projection that activates the canonical
  editor and never emits duplicate operations.
- Expose the ordinary text inspector while furniture is active; provide Escape and Move to body.
- Remove From edge fields from the UI while preserving a stable internal compatibility default.
- Keep Portrait/Landscape on one row and margins as compact key/value inputs under “Margins (in)”.
- Define Start at as the first visible page number; hiding page one makes page two display 1 by
  default.
- Verify first-page variants if present without adding a creation UI in this round.

**Tests:** header/footer selection/style/typing/undo; repeated equality across page count changes;
one operation per gesture; focus return; page-number position/hide/start matrix; orientation widths.

**Exit:** all furniture is edited where it appears, repeats faithfully, and remains one canonical
document root per furniture path.

### Phase 07 — convergence and merge gate

- Rebase the integration branch onto current `main` and rerun the complete suite.
- Update representation tables and the document-editor screen spec where this plan supersedes the
  older Code/From-edge/detached-pin behaviors.
- Run browser scenarios at all three rail widths in Chromium and one second engine supported by CI.
- Run keyboard-only and reduced-motion passes; inspect light/dark themes and grayscale hierarchy.
- Reset the fixture and manually review *Winter readiness brief* against the target UI.
- Produce a short final delta: donor code adopted, rewritten, omitted, and newly built.

**Exit:** typecheck, unit/invariant tests, architecture/style lint, production build, browser suite,
accessibility pass, and clean console/network evidence all pass from a clean checkout.

### Recorded convergence evidence — 5 September 2026

| Gate | Result |
| --- | --- |
| Branch boundary | local `main` at `b4894c7` is the merge base; `work/document-editor` at `55a7b22` is not an ancestor. |
| Static analysis | Svelte/typecheck: 0 errors and 0 warnings. Architecture/style lint: 56/56 checks clean. |
| Unit suite | 73 files and 745 assertions passed. |
| Chromium | 16/16 editor and reference scenarios passed from a reset fixture on the current base. |
| Firefox | 13/13 editor scenarios passed on the pre-rebase baseline. The current cached runner cannot launch locally because its host GTK runtime is unavailable, so this is not represented as a current-base rerun. |
| Accessibility | Keyboard entry, visible focus, reduced motion, Helios/Selene appearance, and grayscale hierarchy passed in the current Chromium run. |
| Runtime quality | The current Chromium harness captured 0 console warnings/errors, page errors, failed requests, or HTTP failures. |
| Production | The complete application production build passed on the validated branch. |

The current-main rebase surfaced two shared-control conflicts. The numeric control keeps main's
validation feedback and the editor's stepper-free direct entry. The choice control keeps main's
current sizing while retaining the editor's full-row, responsive full-label/initial behavior. The
post-rebase browser pass also caught a stale test contract: main replaced
`data-theme="celestial|cyberpunk"` with `data-appearance="helios|selene"`; the accessibility scenario
now verifies the new contract.

The earlier convergence run also caught and repaired two integration seams introduced by the moving base:
the new scoped store projection had omitted comment anchor state, and Firefox exposed browser-native
double-click selection as inconsistent. Comment collaboration fields now cross an exact, validated
projection, and word selection is deterministic in the editor rather than delegated to browser
selection heuristics.

## Workstream ownership map

| Workstream | Primary code areas | Principal risk | Required reviewer |
| --- | --- | --- | --- |
| Representation and validation | `representation/data/types/documents`, `representation/data/behavior/documents`, `capabilities/document` | A shape accepted on one side but not the other | Model/server boundary reviewer |
| Runtime and history | `model/client/document-runtimes` | Lost buffered work or history/coalescing coupling | Client model reviewer |
| Projection and input | `app-views/categories/document-editor/procedures` | Data/pixel divergence, IME loss, selection loss | Editor adapter reviewer |
| Shared panel controls | `components/authored/panel`, vendored wrappers only when necessary | One-off behavior and incomplete states | Design-system/accessibility reviewer |
| Lenses and context | `app-views/categories/document-editor/inspector`, `context` | UI writes wrong ownership layer | Product/editor reviewer |
| Comments and links | editor procedures, general comment view, store/capability boundary | Anchor corruption and unsafe navigation | Collaboration/security reviewer |
| Furniture and layout | document content, projection, page/furniture procedures | Multiple editable roots or echoed operations | Editor adapter reviewer |
| Browser evidence | editor fixtures and browser test suite | Green unit suite masking interaction regressions | Reviewer not authoring the slice |

## Commit and review discipline

- Actual implementation starts from current `main`; the donor branch is never merged into its
  ancestry.
- One phase may use more than one commit, but a commit never mixes representation migration, visual
  restyling, and unrelated behavior.
- Every commit is green. Test-first work may be locally red; red commits are not shared as review
  checkpoints.
- Each behavior fix includes the smallest failing regression test that demonstrates the original
  defect, plus a browser test when focus, pointer, selection, layout, or console is involved.
- Model changes ship with validator, applier, inverse, legacy decoder/fixture, and documentation in
  the same review unit.
- Shared components land before lenses consume them; private lens copies are deleted in the same
  slice that adopts the shared primitive.
- No broad “cleanup” commit at the end. If a phase cannot be reviewed independently, it is too large.

## Risk register

| Risk | Early signal | Containment |
| --- | --- | --- |
| Selection regressions hide behind green unit tests | Highlight vanishes on focus transfer or secondary ranges collapse | Browser harness in Phase 00; selection origin/type/ranges asserted in Phase 02 |
| Operation sequence is valid in isolation but invalid as a batch | Insert references an ID removed earlier in the same gesture | Apply whole sequences in tests; compute anchors against evolving state |
| Model migration repeats late | Link/comment decisions deferred until their UI phase | Settle representation choices before Phase 01 |
| Comment anchors drift under editing/concurrency | Tint moves to unrelated text after an earlier splice | Shift anchors in the canonical applier and test overlap/deletion rules |
| Furniture mounts several writable editors | Repeated header changes echo or diverge | One canonical editor registry keyed by native furniture root |
| Responsive styling forks behavior | Narrow rail gets different actions or inaccessible icon-only controls | Same DOM/actions at every width; labels change through container queries |
| The donor becomes an accidental merge dependency | Integration history includes `62be118..55a7b22` unchanged | Verify merge-base and ancestry in CI/review checklist |
| Fixture state masks defects | Manual behavior differs after reload or between reviewers | Deterministic reset command and isolated browser data |

## Final acceptance matrix

### Editing and selection

- Selection remains visible while every inspector control, picker, composer, and context row is used.
- Three non-contiguous ranges survive formatting, repaint, undo/redo, and a remote/catch-up update.
- Enter/Backspace after Body, Heading 1–3, Quote, Caption, list, and code-block content follows the
  approved continuation matrix in both data and pixels.
- Double-click selects a word; Shift-double-click selects current block text; no text-block outline
  appears.

### Formatting and panels

- FG changes ten times, BG ten times, and alternating changes all succeed and undo/redo in order.
- B/I/U/S and FG/BG stay on one row at narrow/default/wide rail widths.
- Zero-valued Indent and First visible number look editable and accept keyboard input.
- Sections never prints fractional line placement, and long titles keep useful width.

### Links, comments, and furniture

- Link URL and note persist through edit, reload, remove/re-add, undo/redo, and safe open.
- Comment source/opener/replies are unmistakable; anchors shift correctly; detached threads draw no
  page pin.
- Styled header/footer editing happens on the page and every repeated appearance matches.
- Hide first page + First visible number 1 makes page two display 1.

### System quality

- Clean checkout: typecheck, all unit/invariant tests, 63 architecture/style checks, and production
  build pass.
- Normal load and the full interaction suite produce zero console warnings/errors, page errors, or
  unexpected failed requests.
- The workflow completes with keyboard only, visible focus, stable focus return, and reduced motion.
- The final branch contains no unchanged donor commits and no unrelated user/worktree changes.
