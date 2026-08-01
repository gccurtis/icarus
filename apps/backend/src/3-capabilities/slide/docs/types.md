# Slide type reference

Canonical definitions are in [`domain/model.ts`](../domain/model.ts). The
families below exist and are tested even though the application service that
would compose them is missing.

## Aggregate and identity aliases

- `DeckId`, `SlideId`, `SlideElementId`, `SlideGroupId`, and `ShapeId` are
  semantic string aliases.
- `SlideLifecycle` is `active | archived | trashed`; `SlideOrigin` is
  `interactive | agent | automation`.
- `DeckHead` carries title/lifecycle, current revision/Base sequence, semantic
  digest, and timestamps.
- `DeckSnapshot` is representation v1 with revision, metadata, `SlideCanvas`,
  `SlideStyleRegistry`, `slideOrder`, and `Record<SlideId, Slide>`.

## Style and visual family

`SlideStyleRegistry` has one default Style ID per Shape kind and an embedded
Style array. `SlideStyle` has ID/name, optional inheritance, visual properties,
and Rich Text properties. Visual types include opacity, `FillStyle`,
`StrokeStyle`, and `ShadowStyle`; colors use canonical lowercase `#rrggbbaa`.
`ShapePresentationOverride` optionally overlays visual and text properties.

## Slide, element, and geometry family

`Slide` owns optional title, background, Rich Text notes, root element order,
and a record of all elements. Background is transparent, solid, or immutable
image snapshot.

- `SlideGroup`: structural element with ordered child IDs.
- `ShapeBase`: frame, transform, Style, presentation plus common locked/hidden.
- `ShapeFrame`: x/y/width/height in points.
- `ShapeTransform`: normalized rotation and horizontal/vertical flips.
- `ElementPlacement`: optional parent Group and immediate sibling anchor.

`ShapeBounds` and `GroupTransformDelta` support geometry helper results/input.

## Closed Shape union

| Kind | Payload |
| --- | --- |
| `text` | Authored `RichContent` and `TextBoxPresentation` |
| `prompt-content` | Exact `DerivedOutputRef` and text-box presentation |
| `geometry` | Rectangle, rounded rectangle, ellipse, triangle, diamond, or arrow |
| `line` | Local-unit endpoints and start/end decoration |
| `image` | Immutable image ref, crop/fit, alt/decorative |
| `table` | Embedded accepted table `FormulaWireValue` and presentation |
| `chart` | Embedded list/record/table value and chart specification |

Supporting types cover unit points, decorations, image/crop, accepted values,
table presentation, chart axes/specification, and text-box padding/alignment.

## Operation family

`SlideOperation` has 33 discriminants:

- Deck: rename, lifecycle, canvas.
- Style: create/update/delete/set default.
- Slide: insert/move/delete/title/background/notes.
- Group: create/ungroup.
- Element: internal subtree restore, move/delete, locked/hidden.
- Shape: insert, frame/transform/Style/presentation, text-box presentation.
- Content: authored text apply, internal prompt output adoption, and setters for
  geometry, line, image, table, and chart.

`element.restore-subtree` is an exact inverse primitive and internal only.
`prompt-content.apply-derived-output` is internal settlement only and cannot
change output identity. Exact payloads are in
[`model.ts`](../domain/model.ts); strict operation decoding is in
[`operationSchemas.ts`](../wire/operationSchemas.ts).

## History and persistence-domain family

- `SlideBase`: full Deck snapshot/digest at one `baseSeq`.
- `SlideChangeSet`: request/revision metadata, forward/inverse operations,
  touched IDs, optional compensation, digest, timestamp.
- `SlideCommittedFact`: accepted create/change/compensate outbox fact.
- `SlideSubmissionReceipt`: keyed request replay result.
- `SlideDelegatedCommandClaim`: frozen pending/completed Prompt definition target.
- `SlideIdentity*`: kinds, transitions, active/tombstoned ledger, and exact
  same-kind compensation reactivation policy.

Identity kinds are Style, Slide, Group, Shape, Rich Text atom, and Rich Text
mark.

## Prompt attempt and ownership family

States are `requested | computing | proposed | settled | unchanged | stale |
failed`. `SlideAttemptBase` freezes Deck revision, Slide/Shape target, request
digest, state, diagnostic/settlement, and timestamps.

- `PromptContentCreationAttempt` freezes geometry, Style/presentation,
  text-box, placement, and Derived definition, then may hold candidate output.
- `PromptContentRefreshAttempt` freezes output/applied revision and may hold a
  newer candidate.
- `SlideStageReceipt` owns compute/settle idempotency state.
- `PromptContentOutputOwnership` maps one output to Deck/Slide/Shape and tracks
  pending/attached/detached.

These records are persisted by the store but no current service advances them.

## Command/query and result family

Commands are:

- `deck.create`, `deck.submit`, `deck.compensate`;
- `prompt-content.create.request`;
- `prompt-content.update-definition`;
- `prompt-content.refresh.request`.

Results are Deck created/changed, Prompt Content create/refresh requested, or
definition updated. Queries are Deck list/load/history/attempt; load includes
the exact referenced Derived Output revisions. These are current types and wire
contracts, but no `SlideCapability.command/query` implementation exists.

## Internal jobs and options

`SlideInternalJobIntent` covers serial compaction; concurrent Prompt creation/
refresh compute; and serial creation/refresh settle. `SlideOptions` contains
history retention and domain limits. Current hardcoded defaults are 5 Bases,
1,000 ChangeSets, 500 terminal attempts; 500 Slides, 1,000 elements per Slide,
10 Group depth, 200 Styles, 10,000 Rich Text atoms, 25,000 accepted-value nodes,
and 10,000-point maximum canvas/frame dimension.

## Store and external ports

[`ports/slideStore.ts`](../ports/slideStore.ts) defines creation/mutation
commit families, prompt ownership transitions, prompt failure commit, stage
claim result, delegated claim result, and `SlideStore`. The method surface is
parallel to the Document store: heads/history, receipts/claims/identity, atomic
commits, Bases/pruning, attempts/stages/recovery, prompt ownership, and outbox.

[`ports/derivedOutputs.ts`](../ports/derivedOutputs.ts) narrows Derived Outputs
to declare/get/getRevision/updateDefinition/refresh/delete. The absent service
would also require Rich Text, internal jobs, Logger, and attribution; those
`SlideDependencies` are referenced by the barrel but not defined in current
source because `slideService.ts` is missing.

## Error family

[`domain/errors.ts`](../domain/errors.ts) defines Deck not found/already exists,
attempt not found, revision/idempotency/compensation conflicts, pruned history,
invalid cursor, validation, identity reuse, placement, Style reference,
operation, and stale-attempt errors. Endpoint wiring declares 404/410/409/400/
500 mappings, but those mappings are not reachable until the runtime exists.

## Wire family and budgets

`decodeSlideCommand`, `decodeSlideQuery`, `decodeSlideOperation(s)`, and the
value decoders strictly admit every nested canonical value. Generic submit
rejects internal operations and any operation introducing Prompt Content.

`SLIDE_WIRE_LIMITS`: 1 MiB payload, 256 KiB string, 512-byte identifier,
10,000 collection items, 1,000 Slide operations, 1,000 Rich Text operations,
depth 32, Group wire depth 32, 100,000 nodes, Formula value depth 16, and
100,000 Formula cells. Values must be finite acyclic JSON/plain objects with
exact known fields and safe record keys.

## SQL and projection families

`SlideTableNames` defines ten project-hashed tables: Deck heads, receipts,
delegated claims, identity ledger, Bases, ChangeSets, activity outbox, attempts,
prompt outputs, and stage receipts. SQLite mappers encode JSON as UTF-8 Buffers
and reconstruct the domain families.

Projection results include outline, prompt/image dependencies, plain text, and
resolved Shape/text styling. They are rebuildable and not canonical.
