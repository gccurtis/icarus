# Template Features Change Set

138 files under app/ against 1166f8e, the commit this branch sits on — 80 created, 58 changed, 0 deleted — +16600 / −1335 lines, measured from committed and working-tree changes when this page was built.

| Status | File | + | − | Systematic change |
| --- | --- | --- | --- | --- |
| new | `scripts/generate-template-reference-inventory.mjs` | +126 | −0 | The reference pages, and the one shared component they moved |
| changed | `seed/documents.json` | +0 | −4 | The seeded one-slide template |
| changed | `seed/resourceSets.json` | +17 | −0 | The seeded one-slide template |
| changed | `seed/slideDecks.json` | +0 | −4 | The seeded one-slide template |
| changed | `seed/spreadsheets.json` | +0 | −2 | The seeded one-slide template |
| changed | `seed/templates.json` | +1524 | −250 | The seeded one-slide template |
| changed | `seed/templateVersions.json` | +518 | −22 | The seeded one-slide template |
| changed | `src/lib/app-views/categories/document-editor/content/document.svelte` | +15 | −0 | The document editor's Templates panel |
| new | `src/lib/app-views/categories/document-editor/context/templates.svelte` | +683 | −0 | The document editor's Templates panel |
| changed | `src/lib/app-views/categories/document-editor/procedures/projection.ts` | +33 | −8 | The document editor's Templates panel |
| changed | `src/lib/app-views/categories/document-editor/procedures/schema.ts` | +37 | −3 | The document editor's Templates panel |
| new | `src/lib/app-views/categories/document-editor/procedures/templating.ts` | +394 | −0 | The document editor's Templates panel |
| new | `src/lib/app-views/categories/document-editor/procedures/test/unit/templating.test.ts` | +167 | −0 | The document editor's Templates panel |
| new | `src/lib/app-views/categories/project-overview/context/contexts.svelte` | +283 | −0 | Project Overview's Contexts panel |
| new | `src/lib/app-views/categories/project-overview/procedures/contexts.ts` | +115 | −0 | Project Overview's Contexts panel |
| new | `src/lib/app-views/categories/project-overview/procedures/test/unit/contexts.test.ts` | +68 | −0 | Project Overview's Contexts panel |
| changed | `src/lib/app-views/categories/project-overview/project-overview.md` | +25 | −21 | Project Overview's Contexts panel |
| changed | `src/lib/app-views/categories/slide-deck-editor/context/comments.svelte` | +6 | −1 | The slide-deck editor's Templates panel |
| changed | `src/lib/app-views/categories/slide-deck-editor/context/templates.svelte` | +700 | −3 | The slide-deck editor's Templates panel |
| changed | `src/lib/app-views/categories/slide-deck-editor/inspector/threads.svelte` | +8 | −1 | The slide-deck editor's Templates panel |
| changed | `src/lib/app-views/categories/slide-deck-editor/procedures/scene.ts` | +3 | −3 | The slide-deck editor's Templates panel |
| new | `src/lib/app-views/categories/slide-deck-editor/procedures/templating.ts` | +418 | −0 | The slide-deck editor's Templates panel |
| new | `src/lib/app-views/categories/slide-deck-editor/procedures/test/unit/templating.test.ts` | +130 | −0 | The slide-deck editor's Templates panel |
| changed | `src/lib/app-views/categories/slide-deck-editor/procedures/typing.ts` | +2 | −3 | The slide-deck editor's Templates panel |
| changed | `src/lib/app-views/categories/slide-deck-editor/slide-deck-editor.md` | +23 | −1 | The slide-deck editor's Templates panel |
| changed | `src/lib/app-views/categories/templates/content/editor.svelte` | +48 | −17 | The template library, editor door, and inspector |
| changed | `src/lib/app-views/categories/templates/content/library.svelte` | +33 | −21 | The template library, editor door, and inspector |
| changed | `src/lib/app-views/categories/templates/inspector/template.svelte` | +347 | −119 | The template library, editor door, and inspector |
| changed | `src/lib/app-views/categories/templates/procedures/library.svelte.ts` | +177 | −45 | The template library, editor door, and inspector |
| changed | `src/lib/app-views/categories/templates/procedures/test/unit/library.test.ts` | +16 | −0 | The template library, editor door, and inspector |
| changed | `src/lib/app-views/categories/templates/templates.md` | +46 | −75 | The template library, editor door, and inspector |
| changed | `src/lib/capabilities/comments/api/start-thread/start-thread.ts` | +8 | −0 | What the other capabilities changed |
| changed | `src/lib/capabilities/comments/comments.md` | +4 | −0 | What the other capabilities changed |
| changed | `src/lib/capabilities/comments/test/unit/comments.test.ts` | +12 | −0 | What the other capabilities changed |
| changed | `src/lib/capabilities/project-resources/api/read-project-resource-index/read-project-resource-index.ts` | +9 | −9 | What the other capabilities changed |
| new | `src/lib/capabilities/resource-sets/api/create-resource-set/create-resource-set.ts` | +25 | −0 | The resource-sets capability |
| new | `src/lib/capabilities/resource-sets/api/create-resource-set/validate-create-resource-set.ts` | +22 | −0 | The resource-sets capability |
| new | `src/lib/capabilities/resource-sets/api/read-resource-sets/read-resource-sets.ts` | +10 | −0 | The resource-sets capability |
| new | `src/lib/capabilities/resource-sets/api/remove-resource-set/remove-resource-set.ts` | +74 | −0 | The resource-sets capability |
| new | `src/lib/capabilities/resource-sets/api/remove-resource-set/validate-remove-resource-set.ts` | +16 | −0 | The resource-sets capability |
| new | `src/lib/capabilities/resource-sets/api/shared/projection.ts` | +220 | −0 | The resource-sets capability |
| new | `src/lib/capabilities/resource-sets/api/shared/validation.ts` | +172 | −0 | The resource-sets capability |
| new | `src/lib/capabilities/resource-sets/api/update-resource-set/update-resource-set.ts` | +72 | −0 | The resource-sets capability |
| new | `src/lib/capabilities/resource-sets/api/update-resource-set/validate-update-resource-set.ts` | +41 | −0 | The resource-sets capability |
| new | `src/lib/capabilities/resource-sets/index.remote.ts` | +39 | −0 | The resource-sets capability |
| new | `src/lib/capabilities/resource-sets/resource-sets.md` | +27 | −0 | The resource-sets capability |
| new | `src/lib/capabilities/resource-sets/test/unit/resource-sets.test.ts` | +230 | −0 | The resource-sets capability |
| new | `src/lib/capabilities/resource-sets/types/resource-sets.ts` | +72 | −0 | The resource-sets capability |
| changed | `src/lib/capabilities/store/store.md` | +1 | −2 | What the other capabilities changed |
| new | `src/lib/capabilities/templates/api/commit-template-stage/commit-template-stage.ts` | +121 | −0 | The templates capability |
| new | `src/lib/capabilities/templates/api/commit-template-stage/validate-commit-template-stage.ts` | +16 | −0 | The templates capability |
| new | `src/lib/capabilities/templates/api/create-template-from-resource/create-template-from-resource.ts` | +89 | −0 | The templates capability |
| new | `src/lib/capabilities/templates/api/create-template-from-resource/validate-create-template-from-resource.ts` | +44 | −0 | The templates capability |
| changed | `src/lib/capabilities/templates/api/create-template/create-template.ts` | +2 | −1 | The templates capability |
| new | `src/lib/capabilities/templates/api/discard-template-stage/discard-template-stage.ts` | +31 | −0 | The templates capability |
| new | `src/lib/capabilities/templates/api/discard-template-stage/validate-discard-template-stage.ts` | +8 | −0 | The templates capability |
| changed | `src/lib/capabilities/templates/api/duplicate-template/duplicate-template.ts` | +2 | −1 | The templates capability |
| changed | `src/lib/capabilities/templates/api/instantiate-template/instantiate-template.ts` | +112 | −48 | The templates capability |
| changed | `src/lib/capabilities/templates/api/instantiate-template/validate-instantiate-template.ts` | +8 | −3 | The templates capability |
| new | `src/lib/capabilities/templates/api/open-template-stage/open-template-stage.ts` | +115 | −0 | The templates capability |
| new | `src/lib/capabilities/templates/api/open-template-stage/validate-open-template-stage.ts` | +8 | −0 | The templates capability |
| new | `src/lib/capabilities/templates/api/read-resource-template/read-resource-template.ts` | +48 | −0 | The templates capability |
| new | `src/lib/capabilities/templates/api/read-resource-template/validate-read-resource-template.ts` | +8 | −0 | The templates capability |
| changed | `src/lib/capabilities/templates/api/remove-template/remove-template.ts` | +10 | −68 | The templates capability |
| changed | `src/lib/capabilities/templates/api/shared/bodies.ts` | +17 | −171 | The templates capability |
| new | `src/lib/capabilities/templates/api/shared/holes.ts` | +39 | −0 | The templates capability |
| changed | `src/lib/capabilities/templates/api/shared/projection.ts` | +32 | −49 | The templates capability |
| new | `src/lib/capabilities/templates/api/shared/scopes.ts` | +204 | −0 | The templates capability |
| new | `src/lib/capabilities/templates/api/shared/stages.ts` | +141 | −0 | The templates capability |
| changed | `src/lib/capabilities/templates/api/shared/template-rows.ts` | +3 | −2 | The templates capability |
| changed | `src/lib/capabilities/templates/api/shared/validation.ts` | +227 | −51 | The templates capability |
| changed | `src/lib/capabilities/templates/api/update-template/update-template.ts` | +81 | −26 | The templates capability |
| changed | `src/lib/capabilities/templates/api/update-template/validate-update-template.ts` | +14 | −10 | The templates capability |
| changed | `src/lib/capabilities/templates/index.remote.ts` | +58 | −6 | The templates capability |
| changed | `src/lib/capabilities/templates/templates.md` | +126 | −64 | The templates capability |
| new | `src/lib/capabilities/templates/test/unit/answers.test.ts` | +491 | −0 | The templates capability |
| new | `src/lib/capabilities/templates/test/unit/stages.test.ts` | +377 | −0 | The templates capability |
| changed | `src/lib/capabilities/templates/test/unit/templates.test.ts` | +89 | −122 | The templates capability |
| changed | `src/lib/capabilities/templates/types/templates.ts` | +118 | −22 | The templates capability |
| changed | `src/lib/components/authored/panel/panel-section.svelte` | +13 | −1 | The reference pages, and the one shared component they moved |
| new | `src/lib/components/authored/scope-builder/index.ts` | +9 | −0 | The reference pages, and the one shared component they moved |
| new | `src/lib/components/authored/scope-builder/scope-builder.svelte` | +455 | −0 | The reference pages, and the one shared component they moved |
| new | `src/lib/components/authored/template-answers/index.ts` | +8 | −0 | The reference pages, and the one shared component they moved |
| new | `src/lib/components/authored/template-answers/template-answers.svelte` | +185 | −0 | The reference pages, and the one shared component they moved |
| changed | `src/lib/development-views/demo/components/demo-index.svelte` | +3 | −3 | The reference pages, and the one shared component they moved |
| new | `src/lib/development-views/template-reference/components/changes-page.svelte` | +285 | −0 | The reference pages, and the one shared component they moved |
| new | `src/lib/development-views/template-reference/components/diagram-binding.svelte` | +168 | −0 | The reference pages, and the one shared component they moved |
| new | `src/lib/development-views/template-reference/components/diagram-builder.svelte` | +274 | −0 | The reference pages, and the one shared component they moved |
| new | `src/lib/development-views/template-reference/components/diagram-difference.svelte` | +128 | −0 | The reference pages, and the one shared component they moved |
| new | `src/lib/development-views/template-reference/components/diagram-panel.svelte` | +128 | −0 | The reference pages, and the one shared component they moved |
| new | `src/lib/development-views/template-reference/components/diagram-rows.svelte` | +75 | −0 | The reference pages, and the one shared component they moved |
| new | `src/lib/development-views/template-reference/components/diagram-saves.svelte` | +63 | −0 | The reference pages, and the one shared component they moved |
| new | `src/lib/development-views/template-reference/components/diagram-scope.svelte` | +87 | −0 | The reference pages, and the one shared component they moved |
| new | `src/lib/development-views/template-reference/components/diagram-verbs.svelte` | +79 | −0 | The reference pages, and the one shared component they moved |
| new | `src/lib/development-views/template-reference/components/file-ledger.svelte` | +138 | −0 | The reference pages, and the one shared component they moved |
| new | `src/lib/development-views/template-reference/components/reference-header.svelte` | +166 | −0 | The reference pages, and the one shared component they moved |
| new | `src/lib/development-views/template-reference/components/reference.css` | +305 | −0 | The reference pages, and the one shared component they moved |
| new | `src/lib/development-views/template-reference/components/scope-page.svelte` | +468 | −0 | The reference pages, and the one shared component they moved |
| new | `src/lib/development-views/template-reference/components/system-page.svelte` | +329 | −0 | The reference pages, and the one shared component they moved |
| new | `src/lib/development-views/template-reference/procedures/changes.ts` | +312 | −0 | The reference pages, and the one shared component they moved |
| new | `src/lib/development-views/template-reference/procedures/inventory.ts` | +148 | −0 | The reference pages, and the one shared component they moved |
| new | `src/lib/development-views/template-reference/procedures/navigation.ts` | +16 | −0 | The reference pages, and the one shared component they moved |
| new | `src/lib/development-views/template-reference/procedures/scope.ts` | +521 | −0 | The reference pages, and the one shared component they moved |
| new | `src/lib/development-views/template-reference/procedures/system.ts` | +223 | −0 | The reference pages, and the one shared component they moved |
| new | `src/lib/development-views/template-reference/template-reference.svelte` | +5 | −0 | The reference pages, and the one shared component they moved |
| new | `src/lib/development-views/template-reference/types.ts` | +129 | −0 | The reference pages, and the one shared component they moved |
| changed | `src/lib/model/client/workspace-state/methods/open.ts` | +10 | −0 | The vocabulary: one table, five functions, one field |
| changed | `src/lib/model/client/workspace-state/methods/shared/mint-view.ts` | +5 | −1 | The vocabulary: one table, five functions, one field |
| changed | `src/lib/model/client/workspace-state/test/unit/workspace-state.test.ts` | +23 | −0 | The vocabulary: one table, five functions, one field |
| changed | `src/lib/representation/data/behavior/content/positions.ts` | +9 | −1 | The vocabulary: one table, five functions, one field |
| new | `src/lib/representation/data/behavior/core/resource-set.ts` | +45 | −0 | The vocabulary: one table, five functions, one field |
| new | `src/lib/representation/data/behavior/core/scope-draft.ts` | +439 | −0 | The vocabulary: one table, five functions, one field |
| new | `src/lib/representation/data/behavior/core/test/unit/resource-set.test.ts` | +46 | −0 | The vocabulary: one table, five functions, one field |
| new | `src/lib/representation/data/behavior/core/test/unit/scope-draft.test.ts` | +194 | −0 | The vocabulary: one table, five functions, one field |
| changed | `src/lib/representation/data/behavior/documents/apply-ops.ts` | +2 | −1 | The vocabulary: one table, five functions, one field |
| changed | `src/lib/representation/data/behavior/slide-decks/apply-ops.ts` | +2 | −2 | The vocabulary: one table, five functions, one field |
| new | `src/lib/representation/data/behavior/templates/answers.ts` | +62 | −0 | The vocabulary: one table, five functions, one field |
| new | `src/lib/representation/data/behavior/templates/deck-of-slide.ts` | +18 | −0 | The vocabulary: one table, five functions, one field |
| new | `src/lib/representation/data/behavior/templates/fresh-ids.ts` | +71 | −0 | The vocabulary: one table, five functions, one field |
| new | `src/lib/representation/data/behavior/templates/portable.ts` | +103 | −0 | The vocabulary: one table, five functions, one field |
| new | `src/lib/representation/data/behavior/templates/scopes.ts` | +216 | −0 | The vocabulary: one table, five functions, one field |
| new | `src/lib/representation/data/behavior/templates/test/unit/answers.test.ts` | +104 | −0 | The vocabulary: one table, five functions, one field |
| new | `src/lib/representation/data/behavior/templates/test/unit/deck-of-slide.test.ts` | +36 | −0 | The vocabulary: one table, five functions, one field |
| new | `src/lib/representation/data/behavior/templates/test/unit/fresh-ids.test.ts` | +81 | −0 | The vocabulary: one table, five functions, one field |
| new | `src/lib/representation/data/behavior/templates/test/unit/portable.test.ts` | +97 | −0 | The vocabulary: one table, five functions, one field |
| new | `src/lib/representation/data/behavior/templates/test/unit/scopes.test.ts` | +109 | −0 | The vocabulary: one table, five functions, one field |
| changed | `src/lib/representation/data/behavior/workspace/opening.ts` | +5 | −1 | The vocabulary: one table, five functions, one field |
| changed | `src/lib/representation/data/types/content/content-block.ts` | +16 | −1 | The vocabulary: one table, five functions, one field |
| changed | `src/lib/representation/data/types/core/resource-set.ts` | +16 | −24 | The vocabulary: one table, five functions, one field |
| changed | `src/lib/representation/data/types/templates/template.ts` | +12 | −27 | The vocabulary: one table, five functions, one field |
| changed | `src/lib/representation/data/types/workspace/tab.ts` | +1 | −0 | The vocabulary: one table, five functions, one field |
| changed | `src/lib/representation/store/tables.ts` | +26 | −12 | The vocabulary: one table, five functions, one field |
| changed | `src/routes/app/[project]/reference/templates/+page.svelte` | +11 | −2 | The reference pages, and the one shared component they moved |
| new | `src/routes/app/[project]/reference/templates/changes/+page.svelte` | +14 | −0 | The reference pages, and the one shared component they moved |
| new | `src/routes/app/[project]/reference/templates/scope/+page.svelte` | +14 | −0 | The reference pages, and the one shared component they moved |
| changed | `test/browser/document-editor.spec.ts` | +8 | −1 | Browser evidence |
| new | `test/browser/template-features.spec.ts` | +315 | −0 | Browser evidence |
| new | `test/browser/template-reference.spec.ts` | +115 | −0 | Browser evidence |

## Outside app/

| Status | File | + | − |
| --- | --- | --- | --- |
| changed | `docs/artifacts/template-dictionary/index.html` | +297 | −0 |
| changed | `docs/artifacts/template-dictionary/index.md` | +139 | −0 |
| changed | `docs/artifacts/template-features-changes/index.html` | +1071 | −0 |
| changed | `docs/artifacts/template-features-changes/index.md` | +21922 | −0 |
| changed | `docs/artifacts/template-stage-flow/index.html` | +393 | −0 |
| changed | `docs/artifacts/template-stage-flow/index.md` | +140 | −0 |
| changed | `docs/artifacts/template-system-concepts/index.html` | +627 | −0 |
| changed | `docs/artifacts/template-system-concepts/index.md` | +129 | −0 |
| changed | `docs/reference/template-features/01-system.html` | +189 | −0 |
| changed | `docs/reference/template-features/02-model.html` | +209 | −0 |
| changed | `docs/reference/template-features/03-capabilities.html` | +235 | −0 |
| changed | `docs/reference/template-features/04-panels.html` | +208 | −0 |
| changed | `docs/reference/template-features/05-changes.html` | +1160 | −0 |
| changed | `docs/reference/template-features/build-diffs.mjs` | +243 | −0 |
| changed | `docs/reference/template-features/index.html` | +167 | −0 |
| changed | `docs/reference/template-features/reference.css` | +389 | −0 |
| changed | `docs/superpowers/specs/2026-09-06-template-features-design.md` | +255 | −0 |

## The vocabulary: one table, five functions, one field

### changed · `src/lib/model/client/workspace-state/methods/open.ts` (+10 / −0)

~~~~diff
@@ -4,6 +4,7 @@ import { landOn } from "$model/client/workspace-state/methods/shared/land-on";
 import { landing } from "$model/client/workspace-state/methods/shared/landing";
 import { mintView } from "$model/client/workspace-state/methods/shared/mint-view";
 import { perform } from "$model/client/workspace-state/methods/shared/perform";
+import { offersContext } from "$model/client/workspace-state/methods/shared/rails";
 import { targetKey } from "$model/client/workspace-state/methods/shared/target-key";
 import type { Tab } from "$model/client/workspace-state/types";
 
@@ -24,6 +25,15 @@ export const open = (state: WorkspaceStateData, target: Target): Tab => {
       perform(state, { op: "land", tab: existing.id, was, now: { ...was, focus: target.focus } });
     }
 
+    const held = state.views.of(existing.id);
+    if (
+      target.context !== undefined &&
+      offersContext(existing.category, target.context) &&
+      held.contextId !== target.context
+    ) {
+      perform(state, { op: "context", tab: existing.id, was: held.contextId, now: target.context });
+    }
+
     return state.compose(existing.id);
   }
~~~~

### changed · `src/lib/model/client/workspace-state/methods/shared/mint-view.ts` (+5 / −1)

~~~~diff
@@ -2,4 +2,8 @@ import type { TabView, Target } from "$representation/data/types/workspace/tab";
 import { openingView } from "$representation/data/behavior/workspace/opening";
 
 export const mintView = (target: Target): TabView =>
-  openingView(target.category, { content: target.content, focus: target.focus });
+  openingView(target.category, {
+    content: target.content,
+    context: target.context,
+    focus: target.focus
+  });
~~~~

### changed · `src/lib/model/client/workspace-state/test/unit/workspace-state.test.ts` (+23 / −0)

~~~~diff
@@ -288,6 +288,29 @@ test("opening an already-open permanent tab onto a centre moves it, keeps the ra
   assert.equal(model.selection, undefined);
 });
 
+test("a target may say which context view the tab opens on, if its rail offers it", () => {
+  const model = workspaceState();
+
+  const tab = model.open({
+    category: "document-editor",
+    resourceId: "k57",
+    context: "document-editor.templates"
+  });
+  assert.equal(tab.contextId, "document-editor.templates");
+  assert.equal(model.context, "document-editor.templates");
+
+  model.selectContext("document-editor.styles");
+  model.open({ category: "document-editor", resourceId: "k57", context: "document-editor.templates" });
+  assert.equal(model.context, "document-editor.templates");
+
+  const other = model.open({
+    category: "slide-deck-editor",
+    resourceId: "d1",
+    context: "document-editor.templates"
+  });
+  assert.equal(other.contextId, defaultContext("slide-deck-editor"));
+});
+
 test("a target with a focus and no centre says what the tab is about without moving it", () => {
   // The narrower half of the same call, and the one a thread needs: the category
   // has one centre, so arriving at a question inside it is a change of subject and
~~~~

### changed · `src/lib/representation/data/behavior/content/positions.ts` (+9 / −1)

~~~~diff
@@ -4,8 +4,16 @@ import type {
   MarkEnd
 } from "$representation/data/types/content/content-block";
 
+/**
+ * A template atom shows its parameter's name in braces, so a hole reads as one
+ * wherever prose is measured or drawn, and so its width is stable.
+ */
 export const displayOfAtom = (atom: Atom): string =>
-  atom.kind === "literal" ? atom.text : atom.lastResolvedDisplay;
+  atom.kind === "literal"
+    ? atom.text
+    : atom.kind === "template"
+      ? `{${atom.name}}`
+      : atom.lastResolvedDisplay;
 
 export type AtomSegment = {
   readonly atom: Atom;
~~~~

### new · `src/lib/representation/data/behavior/core/resource-set.ts` (+45 / −0)

~~~~diff
@@ -0,0 +1,45 @@
+import { kindMatches } from "$representation/data/behavior/core/resource";
+import type { ResourceRef } from "$representation/data/types/core/resource";
+import type { ResourceSet, SetTerm } from "$representation/data/types/core/resource-set";
+
+const keyOf = (ref: ResourceRef): string => `${ref.kind}\u0000${ref.id}`;
+
+export const resolveResourceSet = (
+  set: ResourceSet,
+  catalogue: readonly ResourceRef[],
+  setsById: ReadonlyMap<string, ResourceSet> = new Map()
+): readonly ResourceRef[] => {
+  const known = new Map(catalogue.map((ref) => [keyOf(ref), ref]));
+
+  const ofTerm = (term: SetTerm, seen: ReadonlySet<string>): readonly ResourceRef[] => {
+    if (term.select === "project") return catalogue;
+    if (term.select === "kinds") {
+      return catalogue.filter((ref) => term.kinds.some((kind) => kindMatches(kind, ref.kind)));
+    }
+    if (term.select === "resources") {
+      return term.refs.flatMap((ref) => {
+        const held = known.get(keyOf(ref));
+        return held === undefined ? [] : [held];
+      });
+    }
+    if (seen.has(term.setId)) return [];
+    const named = setsById.get(term.setId);
+    return named === undefined ? [] : ofSet(named, new Set([...seen, term.setId]));
+  };
+
+  const union = (terms: readonly SetTerm[], seen: ReadonlySet<string>): Map<string, ResourceRef> => {
+    const found = new Map<string, ResourceRef>();
+    for (const term of terms) {
+      for (const ref of ofTerm(term, seen)) found.set(keyOf(ref), ref);
+    }
+    return found;
+  };
+
+  const ofSet = (held: ResourceSet, seen: ReadonlySet<string>): readonly ResourceRef[] => {
+    const included = union(held.include, seen);
+    const excluded = union(held.exclude, seen);
+    return [...included].filter(([key]) => !excluded.has(key)).map(([, ref]) => ref);
+  };
+
+  return ofSet(set, new Set());
+};
~~~~

### new · `src/lib/representation/data/behavior/core/scope-draft.ts` (+439 / −0)

~~~~diff
@@ -0,0 +1,439 @@
+import { kindMatches } from "$representation/data/behavior/core/resource";
+import type { ResourceKind, ResourceRef } from "$representation/data/types/core/resource";
+import type {
+  ResourceSet,
+  SetTerm,
+  TemplatedResourceSet,
+  TemplatedTerm
+} from "$representation/data/types/core/resource-set";
+
+/**
+ * A scope while somebody is building it, and the words for the one they built.
+ *
+ * Every surface that offers a scope reads this: both editors' Templates panels,
+ * the library inspector, and the Contexts panel. Before it existed the same
+ * arithmetic and the same sentence were written out four times, and the fourth
+ * had already drifted.
+ *
+ * A draft is the widest shape either union can hold, so one component can edit a
+ * template's default and a project's own set without knowing which it has.
+ * `narrowed` and `templated` are the two doors back out.
+ */
+
+export type AnyTerm = SetTerm | TemplatedTerm;
+
+export type ScopeSide = "include" | "exclude";
+
+export type ScopeDraft = {
+  readonly include: readonly AnyTerm[];
+  readonly exclude: readonly AnyTerm[];
+};
+
+export type KindOption = { readonly kind: ResourceKind; readonly label: string };
+
+/**
+ * The kinds a project's catalogue reports, with the words for them.
+ *
+ * `ResourceKind` is an open prefix-matched string, so this is the offer list
+ * rather than the vocabulary: naming `externalFile` here would still match every
+ * subkind under it.
+ */
+export const PROJECT_KINDS: readonly KindOption[] = [
+  { kind: "document", label: "Documents" },
+  { kind: "slides", label: "Slide decks" },
+  { kind: "spreadsheet", label: "Spreadsheets" },
+  { kind: "finding", label: "Findings" },
+  { kind: "research", label: "Research threads" }
+];
+
+const KIND_LABEL = new Map(PROJECT_KINDS.map((entry) => [entry.kind, entry.label]));
+
+export const WHOLE_PROJECT: ResourceSet = { include: [{ select: "project" }], exclude: [] };
+
+export const EMPTY_DRAFT: ScopeDraft = { include: [], exclude: [] };
+
+/**
+ * One term, one row.
+ *
+ * A stored rule may hold several kinds or several resources in one term, which
+ * is the same selection either way. A row that says "Findings, Documents" is one
+ * thing to remove and two things to read, so a draft splits them: what you can
+ * take out is what you put in.
+ */
+const split = (term: AnyTerm): readonly AnyTerm[] => {
+  if (term.select === "kinds" && term.kinds.length > 1) {
+    return term.kinds.map((kind) => ({ select: "kinds", kinds: [kind] }));
+  }
+  if (term.select === "resources" && term.refs.length > 1) {
+    return term.refs.map((ref) => ({ select: "resources", refs: [{ ...ref }] }));
+  }
+  return [term];
+};
+
+export const draftOf = (scope: ScopeDraft | undefined): ScopeDraft =>
+  scope === undefined
+    ? { include: [...WHOLE_PROJECT.include], exclude: [] }
+    : { include: scope.include.flatMap(split), exclude: scope.exclude.flatMap(split) };
+
+/** A stable identity for a term, so a draft can say whether it already holds one. */
+export const termKey = (term: AnyTerm): string => {
+  if (term.select === "project") return "project";
+  if (term.select === "kinds") return `kinds:${[...term.kinds].sort().join(",")}`;
+  if (term.select === "set") return `set:${term.setId}`;
+  if (term.select === "hole") return `hole:${term.name}`;
+  return `resources:${term.refs.map((ref) => `${ref.kind}/${ref.id}`).sort().join(",")}`;
+};
+
+export const isWholeProject = (scope: ScopeDraft): boolean =>
+  scope.exclude.length === 0 &&
+  scope.include.length === 1 &&
+  scope.include[0].select === "project";
+
+export const isEmpty = (scope: ScopeDraft): boolean => scope.include.length === 0;
+
+export const holds = (scope: ScopeDraft, side: ScopeSide, term: AnyTerm): boolean =>
+  scope[side].some((held) => termKey(held) === termKey(term));
+
+/** Anywhere in the draft, which is what an offer list needs to grey a row out. */
+export const heldAnywhere = (scope: ScopeDraft, term: AnyTerm): ScopeSide | undefined => {
+  if (holds(scope, "include", term)) return "include";
+  if (holds(scope, "exclude", term)) return "exclude";
+  return undefined;
+};
+
+/**
+ * Adding the whole project replaces the include list, because everything else on
+ * that side is already inside it and leaving it there reads as a contradiction.
+ */
+export const withTerm = (scope: ScopeDraft, side: ScopeSide, term: AnyTerm): ScopeDraft => {
+  if (holds(scope, side, term)) return scope;
+  if (side === "include" && term.select === "project") return { include: [term], exclude: scope.exclude };
+  const kept = side === "include" ? scope.include.filter((held) => held.select !== "project") : scope[side];
+  return side === "include"
+    ? { include: [...kept, term], exclude: scope.exclude }
+    : { include: scope.include, exclude: [...scope.exclude, term] };
+};
+
+export const withoutTerm = (scope: ScopeDraft, side: ScopeSide, key: string): ScopeDraft => ({
+  include: side === "include" ? scope.include.filter((term) => termKey(term) !== key) : scope.include,
+  exclude: side === "exclude" ? scope.exclude.filter((term) => termKey(term) !== key) : scope.exclude
+});
+
+/** The draft with everything cleared back to the floor. */
+export const withWholeProject = (): ScopeDraft => draftOf(undefined);
+
+const isSetTerm = (term: AnyTerm): term is SetTerm => term.select !== "hole";
+
+const isTemplatedTerm = (term: AnyTerm): term is TemplatedTerm => term.select !== "resources";
+
+/** The draft as a concrete set, or undefined when it names a hole. */
+export const narrowed = (scope: ScopeDraft): ResourceSet | undefined =>
+  scope.include.every(isSetTerm) && scope.exclude.every(isSetTerm)
+    ? {
+        include: scope.include.filter(isSetTerm).map((term) => ({ ...term })),
+        exclude: scope.exclude.filter(isSetTerm).map((term) => ({ ...term }))
+      }
+    : undefined;
+
+/** The draft as a templated set, or undefined when it names particular resources. */
+export const templated = (scope: ScopeDraft): TemplatedResourceSet | undefined =>
+  scope.include.every(isTemplatedTerm) && scope.exclude.every(isTemplatedTerm)
+    ? {
+        include: scope.include.filter(isTemplatedTerm).map((term) => ({ ...term })),
+        exclude: scope.exclude.filter(isTemplatedTerm).map((term) => ({ ...term }))
+      }
+    : undefined;
+
+/**
+ * Whether saying this rule needs a row of its own.
+ *
+ * A variable term is substituted for whatever fills it, and substituting one
+ * term for a difference cannot be expressed on the excluding side. So a rule
+ * that excludes anything, or that names particular resources, is stored once and
+ * referred to by a single `set` term. Everything else is said inline, which is
+ * the common case and keeps the table free of rows that say `project`.
+ */
+export const needsRow = (scope: ScopeDraft): boolean =>
+  scope.exclude.length > 0 || scope.include.some((term) => term.select === "resources");
+
+/** Which set ids a scope reaches, following stored sets, so a cycle can be refused. */
+export const reaches = (
+  scope: ScopeDraft,
+  sets: ReadonlyMap<string, ResourceSet>,
+  seen: ReadonlySet<string> = new Set()
+): ReadonlySet<string> => {
+  const found = new Set<string>(seen);
+  for (const term of [...scope.include, ...scope.exclude]) {
+    if (term.select !== "set" || found.has(term.setId)) continue;
+    found.add(term.setId);
+    const held = sets.get(term.setId);
+    if (held === undefined) continue;
+    for (const id of reaches(held, sets, found)) found.add(id);
+  }
+  return found;
+};
+
+/** Whether adding this set to that scope would close a loop, and which set closes it. */
+export const closesLoop = (
+  scope: ScopeDraft,
+  setId: string,
+  sets: ReadonlyMap<string, ResourceSet>,
+  self?: string
+): boolean => {
+  if (self !== undefined && setId === self) return true;
+  if (self === undefined) return false;
+  const held = sets.get(setId);
+  return held !== undefined && reaches(held, sets).has(self);
+};
+
+export type ScopeNames = {
+  /** A stored set's name, by id. A bound row has none, and reads as its own rule. */
+  readonly sets?: ReadonlyMap<string, string>;
+  /** A resource's title, by id, for a term that names particular ones. */
+  readonly resources?: ReadonlyMap<string, string>;
+};
+
+const countWords = (count: number, one: string, many: string): string =>
+  `${count} ${count === 1 ? one : many}`;
+
+export const termWords = (term: AnyTerm, names: ScopeNames = {}): string => {
+  if (term.select === "project") return "everything in the project";
+  if (term.select === "kinds") {
+    return term.kinds.map((kind) => KIND_LABEL.get(kind) ?? kind).join(", ");
+  }
+  if (term.select === "set") {
+    return names.sets?.get(term.setId) ?? "a chosen group";
+  }
+  if (term.select === "hole") return `whatever ${term.name} holds`;
+  if (term.refs.length === 1) {
+    const held = names.resources?.get(term.refs[0].id);
+    return held ?? "one chosen resource";
+  }
+  return countWords(term.refs.length, "chosen resource", "chosen resources");
+};
+
+const listWords = (terms: readonly AnyTerm[], names: ScopeNames): string => {
+  const words = terms.map((term) => termWords(term, names));
+  if (words.length <= 1) return words.join("");
+  return `${words.slice(0, -1).join(", ")} and ${words[words.length - 1]}`;
+};
+
+const capitalized = (words: string): string => words.charAt(0).toUpperCase() + words.slice(1);
+
+/** One rule, read as a sentence. Every surface that shows a scope shows this. */
+export const ruleWords = (scope: ScopeDraft | undefined, names: ScopeNames = {}): string => {
+  if (scope === undefined) return "Everything in the project";
+  if (scope.include.length === 0) return "Nothing";
+  const included = isWholeProject(scope)
+    ? "Everything in the project"
+    : capitalized(listWords(scope.include, names));
+  if (scope.exclude.length === 0) return included;
+  return `${included}, minus ${listWords(scope.exclude, names)}`;
+};
+
+/**
+ * The draft as rows and offers, which is all a component may be handed.
+ *
+ * Nothing under `components/` may reach this tree, so the arithmetic and the
+ * words are done here and the builder is given the result. That is also what
+ * keeps the four surfaces saying the same thing: they all call these.
+ */
+
+export type ScopeRow = { readonly key: string; readonly kind: string; readonly words: string };
+
+export type ScopeOffer = {
+  readonly key: string;
+  readonly label: string;
+  readonly note?: string;
+  readonly held?: ScopeSide;
+  readonly refused?: string;
+};
+
+export type OfferSource = "kinds" | "sets" | "resources";
+
+export const rowsOf = (
+  scope: ScopeDraft,
+  side: ScopeSide,
+  names: ScopeNames = {}
+): readonly ScopeRow[] =>
+  scope[side].map((term) => ({
+    key: termKey(term),
+    kind: term.select,
+    words: termWords(term, names)
+  }));
+
+/** A resource is offered under one key, because a term needs its kind as well. */
+export const resourceKey = (ref: ResourceRef): string => `${ref.kind}/${ref.id}`;
+
+/** The term an offer stands for, so a callback can name a key rather than a shape. */
+export const termFor = (source: OfferSource, key: string): AnyTerm | undefined => {
+  if (source === "kinds") return { select: "kinds", kinds: [key] };
+  if (source === "sets") return { select: "set", setId: key as never };
+  const cut = key.indexOf("/");
+  if (cut <= 0) return undefined;
+  return { select: "resources", refs: [{ kind: key.slice(0, cut), id: key.slice(cut + 1) }] };
+};
+
+const offer = (scope: ScopeDraft, key: string, label: string, note: string | undefined, term: AnyTerm, refused?: string): ScopeOffer => {
+  const held = heldAnywhere(scope, term);
+  return {
+    key,
+    label,
+    ...(note === undefined ? {} : { note }),
+    ...(held === undefined ? {} : { held }),
+    ...(refused === undefined ? {} : { refused })
+  };
+};
+
+export const kindOffers = (scope: ScopeDraft): readonly ScopeOffer[] =>
+  PROJECT_KINDS.map((entry) =>
+    offer(scope, entry.kind, entry.label, undefined, { select: "kinds", kinds: [entry.kind] })
+  );
+
+export const setOffers = (
+  scope: ScopeDraft,
+  sets: readonly { readonly id: string; readonly name: string }[],
+  known: ReadonlyMap<string, ResourceSet>,
+  self?: string
+): readonly ScopeOffer[] =>
+  sets.map((entry) =>
+    offer(
+      scope,
+      entry.id,
+      entry.name,
+      "set",
+      { select: "set", setId: entry.id as never },
+      closesLoop(scope, entry.id, known, self) ? "This set already reaches the one being edited" : undefined
+    )
+  );
+
+export const resourceOffers = (
+  scope: ScopeDraft,
+  resources: readonly { readonly id: string; readonly kind: string; readonly name: string }[]
+): readonly ScopeOffer[] =>
+  resources.map((entry) =>
+    offer(scope, resourceKey(entry), entry.name, entry.kind, {
+      select: "resources",
+      refs: [{ kind: entry.kind, id: entry.id }]
+    })
+  );
+
+export type ScopeOffering = {
+  /** The project's own named sets. */
+  readonly sets?: readonly { readonly id: string; readonly name: string; readonly set: ResourceSet }[];
+  /** Everything the project holds, for the count and for naming one directly. */
+  readonly resources?: readonly { readonly id: string; readonly kind: string; readonly name: string }[];
+  /** The set being edited, when one is, so it cannot be put inside itself. */
+  readonly self?: string;
+};
+
+export type ScopeView = {
+  readonly whole: boolean;
+  readonly include: readonly ScopeRow[];
+  readonly exclude: readonly ScopeRow[];
+  readonly sentence: string;
+  readonly count: number;
+  readonly preview: readonly { readonly key: string; readonly label: string; readonly note: string }[];
+  readonly sources: readonly {
+    readonly key: OfferSource;
+    readonly label: string;
+    readonly placeholder?: string;
+    readonly offers: readonly ScopeOffer[];
+  }[];
+};
+
+/**
+ * Everything the builder needs to draw, from a draft and what the project holds.
+ *
+ * The four surfaces that open a builder call this and pass the result straight
+ * through, which is what keeps them saying the same words in the same order.
+ */
+export const builderView = (scope: ScopeDraft, offering: ScopeOffering = {}): ScopeView => {
+  const sets = offering.sets ?? [];
+  const resources = offering.resources ?? [];
+  const known = new Map(sets.map((entry) => [entry.id, entry.set]));
+  const names: ScopeNames = {
+    sets: new Map(sets.map((entry) => [entry.id, entry.name])),
+    resources: new Map(resources.map((entry) => [entry.id, entry.name]))
+  };
+  const catalogue = resources.map((entry) => ({ kind: entry.kind, id: entry.id }));
+  const selected = selectedBy(scope, catalogue, known);
+  const titles = new Map(resources.map((entry) => [entry.id, entry]));
+
+  return {
+    whole: isWholeProject(scope),
+    include: rowsOf(scope, "include", names),
+    exclude: rowsOf(scope, "exclude", names),
+    sentence: ruleWords(scope, names),
+    count: selected.length,
+    preview: selected.slice(0, 40).map((ref) => ({
+      key: resourceKey(ref),
+      label: titles.get(ref.id)?.name ?? ref.id,
+      note: ref.kind
+    })),
+    sources: [
+      { key: "kinds", label: "Kinds", offers: kindOffers(scope) },
+      {
+        key: "sets",
+        label: "Sets",
+        placeholder: "Search sets…",
+        offers: setOffers(scope, sets, known, offering.self)
+      },
+      {
+        key: "resources",
+        label: "Resources",
+        placeholder: "Search this project…",
+        offers: resourceOffers(scope, resources)
+      }
+    ]
+  };
+};
+
+/**
+ * What a draft selects right now, resolved against the project's catalogue.
+ *
+ * A variable term contributes nothing, because what fills it is not known here.
+ * The count is the point of the builder: a rule with no number beside it is a
+ * guess.
+ */
+export const selectedBy = (
+  scope: ScopeDraft,
+  catalogue: readonly ResourceRef[],
+  sets: ReadonlyMap<string, ResourceSet>
+): readonly ResourceRef[] => {
+  const keyOf = (ref: ResourceRef) => `${ref.kind} ${ref.id}`;
+  const known = new Map(catalogue.map((ref) => [keyOf(ref), ref]));
+
+  const ofTerm = (term: AnyTerm, seen: ReadonlySet<string>): readonly ResourceRef[] => {
+    if (term.select === "project") return catalogue;
+    if (term.select === "hole") return [];
+    if (term.select === "kinds") {
+      return catalogue.filter((ref) => term.kinds.some((kind) => kindMatches(kind, ref.kind)));
+    }
+    if (term.select === "resources") {
+      return term.refs.flatMap((ref) => {
+        const held = known.get(keyOf(ref));
+        return held === undefined ? [] : [held];
+      });
+    }
+    if (seen.has(term.setId)) return [];
+    const held = sets.get(term.setId);
+    return held === undefined ? [] : ofScope(held, new Set([...seen, term.setId]));
+  };
+
+  const union = (terms: readonly AnyTerm[], seen: ReadonlySet<string>): Map<string, ResourceRef> => {
+    const found = new Map<string, ResourceRef>();
+    for (const term of terms) {
+      for (const ref of ofTerm(term, seen)) found.set(keyOf(ref), ref);
+    }
+    return found;
+  };
+
+  const ofScope = (held: ScopeDraft, seen: ReadonlySet<string>): readonly ResourceRef[] => {
+    const included = union(held.include, seen);
+    const excluded = union(held.exclude, seen);
+    return [...included].filter(([key]) => !excluded.has(key)).map(([, ref]) => ref);
+  };
+
+  return ofScope(scope, new Set());
+};
~~~~

### new · `src/lib/representation/data/behavior/core/test/unit/resource-set.test.ts` (+46 / −0)

~~~~diff
@@ -0,0 +1,46 @@
+import { describe, expect, it } from "vitest";
+
+import type { ResourceRef } from "$representation/data/types/core/resource";
+import type { ResourceSet } from "$representation/data/types/core/resource-set";
+import { resolveResourceSet } from "$representation/data/behavior/core/resource-set";
+
+const catalogue: ResourceRef[] = [
+  { kind: "document", id: "documents:1" },
+  { kind: "document", id: "documents:2" },
+  { kind: "slides", id: "slideDecks:1" },
+  { kind: "finding", id: "findings:1" },
+  { kind: "externalFile::pdf", id: "externalFiles:1" }
+];
+
+const ids = (refs: readonly ResourceRef[]) => refs.map((ref) => ref.id);
+
+describe("resolveResourceSet", () => {
+  it("selects the whole project, minus what is excluded", () => {
+    const set: ResourceSet = { include: [{ select: "project" }], exclude: [{ select: "kinds", kinds: ["slides"] }] };
+    expect(ids(resolveResourceSet(set, catalogue))).toEqual(["documents:1", "documents:2", "findings:1", "externalFiles:1"]);
+  });
+
+  it("matches kinds by segment and named resources only when they exist", () => {
+    const set: ResourceSet = {
+      include: [
+        { select: "kinds", kinds: ["externalFile"] },
+        { select: "resources", refs: [{ kind: "document", id: "documents:2" }, { kind: "document", id: "documents:9" }] }
+      ],
+      exclude: []
+    };
+    expect(ids(resolveResourceSet(set, catalogue))).toEqual(["externalFiles:1", "documents:2"]);
+  });
+
+  it("follows a named set and stops at a cycle", () => {
+    const sets = new Map<string, ResourceSet>([
+      ["resourceSets:1", { include: [{ select: "kinds", kinds: ["finding"] }, { select: "set", setId: "resourceSets:2" as never }], exclude: [] }],
+      ["resourceSets:2", { include: [{ select: "set", setId: "resourceSets:1" as never }, { select: "kinds", kinds: ["slides"] }], exclude: [] }]
+    ]);
+    const set: ResourceSet = { include: [{ select: "set", setId: "resourceSets:1" as never }], exclude: [] };
+    expect(ids(resolveResourceSet(set, catalogue, sets))).toEqual(["findings:1", "slideDecks:1"]);
+  });
+
+  it("selects nothing from an empty include", () => {
+    expect(resolveResourceSet({ include: [], exclude: [] }, catalogue)).toEqual([]);
+  });
+});
~~~~

### new · `src/lib/representation/data/behavior/core/test/unit/scope-draft.test.ts` (+194 / −0)

~~~~diff
@@ -0,0 +1,194 @@
+import { describe, expect, it } from "vitest";
+
+import type { ResourceSet } from "$representation/data/types/core/resource-set";
+import {
+  builderView,
+  closesLoop,
+  draftOf,
+  heldAnywhere,
+  isWholeProject,
+  needsRow,
+  narrowed,
+  ruleWords,
+  selectedBy,
+  templated,
+  termFor,
+  termKey,
+  withTerm,
+  withWholeProject,
+  withoutTerm,
+  type AnyTerm,
+  type ScopeDraft
+} from "$representation/data/behavior/core/scope-draft";
+
+const resources = [
+  { id: "documents:1", kind: "document", name: "Winter readiness brief" },
+  { id: "documents:2", kind: "document", name: "Decision memo" },
+  { id: "slideDecks:1", kind: "slides", name: "Board review" },
+  { id: "findings:1", kind: "finding", name: "Pump housing" }
+];
+
+const catalogue = resources.map((entry) => ({ kind: entry.kind, id: entry.id }));
+
+const named = new Map<string, ResourceSet>([
+  ["resourceSets:1", { include: [{ select: "kinds", kinds: ["document"] }], exclude: [] }],
+  ["resourceSets:2", { include: [{ select: "set", setId: "resourceSets:1" as never }], exclude: [] }]
+]);
+
+describe("a draft", () => {
+  it("starts at the floor and says so", () => {
+    const draft = draftOf(undefined);
+    expect(isWholeProject(draft)).toBe(true);
+    expect(ruleWords(draft)).toBe("Everything in the project");
+    expect(needsRow(draft)).toBe(false);
+  });
+
+  it("replaces the include list when the whole project is added", () => {
+    const narrow: ScopeDraft = { include: [{ select: "kinds", kinds: ["document"] }], exclude: [] };
+    const widened = withTerm(narrow, "include", { select: "project" });
+    expect(widened.include).toHaveLength(1);
+    expect(isWholeProject(widened)).toBe(true);
+  });
+
+  it("drops the whole project when something narrower is added beside it", () => {
+    const narrowed = withTerm(withWholeProject(), "include", { select: "kinds", kinds: ["slides"] });
+    expect(narrowed.include).toHaveLength(1);
+    expect(ruleWords(narrowed)).toBe("Slide decks");
+  });
+
+  it("never holds the same term twice, and removes by key", () => {
+    const term: AnyTerm = { select: "kinds", kinds: ["document"] };
+    const once = withTerm({ include: [], exclude: [] }, "include", term);
+    expect(withTerm(once, "include", term).include).toHaveLength(1);
+    expect(heldAnywhere(once, term)).toBe("include");
+    expect(withoutTerm(once, "include", termKey(term)).include).toHaveLength(0);
+  });
+
+  it("reads a difference as one sentence", () => {
+    const draft: ScopeDraft = {
+      include: [
+        { select: "kinds", kinds: ["document"] },
+        { select: "set", setId: "resourceSets:1" as never }
+      ],
+      exclude: [{ select: "resources", refs: [{ kind: "document", id: "documents:2" }] }]
+    };
+    expect(
+      ruleWords(draft, {
+        sets: new Map([["resourceSets:1", "Winter filings"]]),
+        resources: new Map([["documents:2", "Decision memo"]])
+      })
+    ).toBe("Documents and Winter filings, minus Decision memo");
+  });
+
+  it("says nothing when nothing is included", () => {
+    expect(ruleWords({ include: [], exclude: [] })).toBe("Nothing");
+  });
+});
+
+describe("whether a rule needs a row", () => {
+  it("does not for the project, for kinds, or for named sets", () => {
+    expect(needsRow({ include: [{ select: "project" }], exclude: [] })).toBe(false);
+    expect(needsRow({ include: [{ select: "kinds", kinds: ["document"] }], exclude: [] })).toBe(false);
+    expect(needsRow({ include: [{ select: "set", setId: "resourceSets:1" as never }], exclude: [] })).toBe(false);
+  });
+
+  it("does for anything excluded, because a difference cannot be substituted", () => {
+    expect(
+      needsRow({
+        include: [{ select: "project" }],
+        exclude: [{ select: "kinds", kinds: ["slides"] }]
+      })
+    ).toBe(true);
+  });
+
+  it("does for a particular resource, which a template cannot name", () => {
+    expect(
+      needsRow({
+        include: [{ select: "resources", refs: [{ kind: "document", id: "documents:1" }] }],
+        exclude: []
+      })
+    ).toBe(true);
+  });
+});
+
+describe("the two doors out of a draft", () => {
+  it("narrows to a concrete set when nothing names a hole", () => {
+    const draft: ScopeDraft = {
+      include: [{ select: "resources", refs: [{ kind: "document", id: "documents:1" }] }],
+      exclude: []
+    };
+    expect(narrowed(draft)).not.toBeUndefined();
+    expect(templated(draft)).toBeUndefined();
+  });
+
+  it("stays templated when nothing names a resource", () => {
+    const draft: ScopeDraft = { include: [{ select: "hole", name: "source_material" }], exclude: [] };
+    expect(templated(draft)).not.toBeUndefined();
+    expect(narrowed(draft)).toBeUndefined();
+  });
+});
+
+describe("cycles", () => {
+  it("refuses a set that is the one being edited", () => {
+    expect(closesLoop({ include: [], exclude: [] }, "resourceSets:1", named, "resourceSets:1")).toBe(true);
+  });
+
+  it("refuses a set that already reaches the one being edited", () => {
+    expect(closesLoop({ include: [], exclude: [] }, "resourceSets:2", named, "resourceSets:1")).toBe(true);
+  });
+
+  it("allows one that does not", () => {
+    expect(closesLoop({ include: [], exclude: [] }, "resourceSets:1", named, "resourceSets:9")).toBe(false);
+  });
+});
+
+describe("what a draft selects", () => {
+  it("counts the difference against the catalogue", () => {
+    const draft: ScopeDraft = {
+      include: [{ select: "project" }],
+      exclude: [{ select: "kinds", kinds: ["slides"] }]
+    };
+    expect(selectedBy(draft, catalogue, named).map((ref) => ref.id)).toEqual([
+      "documents:1",
+      "documents:2",
+      "findings:1"
+    ]);
+  });
+
+  it("counts a hole term as nothing, because what fills it is not known here", () => {
+    const draft: ScopeDraft = { include: [{ select: "hole", name: "source" }], exclude: [] };
+    expect(selectedBy(draft, catalogue, named)).toHaveLength(0);
+  });
+});
+
+describe("the builder's view", () => {
+  it("hands over rows, a sentence, a count and three sources", () => {
+    const draft: ScopeDraft = {
+      include: [{ select: "kinds", kinds: ["document"] }],
+      exclude: [{ select: "resources", refs: [{ kind: "document", id: "documents:2" }] }]
+    };
+    const view = builderView(draft, { resources, sets: [] });
+    expect(view.whole).toBe(false);
+    expect(view.include).toHaveLength(1);
+    expect(view.exclude[0].words).toBe("Decision memo");
+    expect(view.sentence).toBe("Documents, minus Decision memo");
+    expect(view.count).toBe(1);
+    expect(view.sources.map((source) => source.key)).toEqual(["kinds", "sets", "resources"]);
+  });
+
+  it("marks what the draft already holds, so nothing is offered twice", () => {
+    const draft: ScopeDraft = { include: [{ select: "kinds", kinds: ["document"] }], exclude: [] };
+    const kinds = builderView(draft, { resources }).sources[0];
+    expect(kinds.offers.find((offer) => offer.key === "document")?.held).toBe("include");
+    expect(kinds.offers.find((offer) => offer.key === "slides")?.held).toBeUndefined();
+  });
+
+  it("turns an offer key back into the term it stands for", () => {
+    expect(termFor("kinds", "document")).toEqual({ select: "kinds", kinds: ["document"] });
+    expect(termFor("sets", "resourceSets:1")).toEqual({ select: "set", setId: "resourceSets:1" });
+    expect(termFor("resources", "document/documents:1")).toEqual({
+      select: "resources",
+      refs: [{ kind: "document", id: "documents:1" }]
+    });
+  });
+});
~~~~

### changed · `src/lib/representation/data/behavior/documents/apply-ops.ts` (+2 / −1)

~~~~diff
@@ -4,6 +4,7 @@ import type {
   Mark,
   MarkEnd
 } from "$representation/data/types/content/content-block";
+import { displayOfAtom } from "$representation/data/behavior/content/positions";
 import type { DocumentBody, DocumentRow } from "$representation/data/types/documents/body";
 import type { DocumentOp } from "$representation/data/types/documents/op";
 import type { StyleSet, TextStyle } from "$representation/data/types/documents/style-set";
@@ -23,7 +24,7 @@ const isMarked = (block: ContentBlock): block is Marked =>
   block.type === "text" || block.type === "prompt";
 
 export const displayOf = (atoms: readonly Atom[]): string =>
-  atoms.map((atom) => (atom.kind === "literal" ? atom.text : atom.lastResolvedDisplay)).join("");
+  atoms.map(displayOfAtom).join("");
 
 const insertAfter = <T extends { id: string }>(
   items: readonly T[],
~~~~

### changed · `src/lib/representation/data/behavior/slide-decks/apply-ops.ts` (+2 / −2)

~~~~diff
@@ -4,6 +4,7 @@ import type {
   PromptBlock,
   TextBlock
 } from "$representation/data/types/content/content-block";
+import { displayOfAtom } from "$representation/data/behavior/content/positions";
 import type { SlideDeckBody } from "$representation/data/types/slide-decks/body";
 import type { SlideDeckOp } from "$representation/data/types/slide-decks/op";
 
@@ -218,8 +219,7 @@ const applyMove = (body: SlideDeckBody, op: Extract<SlideDeckOp, { op: "move" }>
     return insertAfter(withoutIds(list, [op.id]), op.after, [moving]);
   });
 
-const displayOf = (atoms: readonly Atom[]): string =>
-  atoms.map((atom) => (atom.kind === "literal" ? atom.text : atom.lastResolvedDisplay)).join("");
+const displayOf = (atoms: readonly Atom[]): string => atoms.map(displayOfAtom).join("");
 
 const spliced = (op: Extract<SlideDeckOp, { op: "text" }>, atom: Atom): Atom => {
   if (atom.kind !== "literal") throw new Error(`Atom ${atom.id} is not a literal.`);
~~~~

### new · `src/lib/representation/data/behavior/templates/answers.ts` (+62 / −0)

~~~~diff
@@ -0,0 +1,62 @@
+import { ruleWords, type ScopeDraft, type ScopeNames } from "$representation/data/behavior/core/scope-draft";
+import type { TemplateHole } from "$representation/data/types/templates/template";
+
+/**
+ * What placing a template has to ask for, one row per hole.
+ *
+ * Every hole is listed, because the list is the shape of the thing about to be
+ * made. A scope always has a value — what the caller chose, else what the
+ * template suggests — so it is never missing. Text has none until somebody types
+ * some, which is the only thing that can hold a placement up.
+ */
+
+export type AnswerRow = {
+  readonly key: string;
+  readonly label: string;
+  readonly description?: string;
+  readonly kind: "scope" | "text";
+  readonly value: string;
+  readonly answered: boolean;
+  readonly missing: boolean;
+};
+
+export const kindOfHole = (hole: TemplateHole): "scope" | "text" =>
+  hole.kind === "text" ? "text" : "scope";
+
+export const answerRowsOf = (
+  holes: readonly TemplateHole[],
+  chosen: Readonly<Record<string, ScopeDraft | undefined>>,
+  texts: Readonly<Record<string, string | undefined>>,
+  names: ScopeNames = {}
+): readonly AnswerRow[] =>
+  holes.map((hole) => {
+    const kind = kindOfHole(hole);
+    if (kind === "text") {
+      const typed = texts[hole.name];
+      const words = typed ?? hole.text ?? "";
+      return {
+        key: hole.name,
+        label: hole.label,
+        ...(hole.description === undefined ? {} : { description: hole.description }),
+        kind,
+        value: words,
+        answered: typed !== undefined && typed !== (hole.text ?? ""),
+        missing: words.trim() === ""
+      };
+    }
+    const held = chosen[hole.name];
+    return {
+      key: hole.name,
+      label: hole.label,
+      ...(hole.description === undefined ? {} : { description: hole.description }),
+      kind,
+      /** The rule alone; whether it is the template's or the caller's is said beside it. */
+      value: ruleWords(held ?? hole.default, names),
+      answered: held !== undefined,
+      missing: false
+    };
+  });
+
+/** The holes still holding a placement up. */
+export const missingIn = (rows: readonly AnswerRow[]): readonly string[] =>
+  rows.filter((row) => row.missing).map((row) => row.label);
~~~~

### new · `src/lib/representation/data/behavior/templates/deck-of-slide.ts` (+18 / −0)

~~~~diff
@@ -0,0 +1,18 @@
+import type { SlideDeckBody } from "$representation/data/types/slide-decks/body";
+
+export const deckOfSlide = (
+  deck: SlideDeckBody,
+  slideId: string
+): SlideDeckBody | undefined => {
+  const slide = deck.slides.find((held) => held.id === slideId);
+  if (slide === undefined) return undefined;
+  const layout = deck.layouts.find((held) => held.key === slide.layoutKey);
+  return {
+    aspectRatio: deck.aspectRatio,
+    theme: deck.theme,
+    styles: deck.styles,
+    layouts: layout === undefined ? [] : [layout],
+    slides: [slide],
+    sections: []
+  };
+};
~~~~

### new · `src/lib/representation/data/behavior/templates/fresh-ids.ts` (+71 / −0)

~~~~diff
@@ -0,0 +1,71 @@
+type Fields = Record<string, unknown>;
+
+export type IdHint =
+  | "row"
+  | "block"
+  | "atom"
+  | "mark"
+  | "slide"
+  | "element"
+  | "layout"
+  | "section"
+  | "cell";
+
+export type Mint = (hint: IdHint, previous: string) => string;
+
+const LIST_HINTS: Record<string, IdHint> = {
+  rows: "row",
+  blocks: "block",
+  notes: "block",
+  atoms: "atom",
+  marks: "mark",
+  slides: "slide",
+  elements: "element",
+  children: "element",
+  locked: "element",
+  layouts: "layout",
+  sections: "section",
+  cells: "cell"
+};
+
+const HELD_HINTS: Record<string, IdHint> = { caption: "block", block: "block" };
+
+const isRecord = (value: unknown): value is Fields =>
+  value !== null && typeof value === "object" && !Array.isArray(value);
+
+const collect = (value: unknown, hint: IdHint | undefined, into: Map<string, IdHint>): void => {
+  if (Array.isArray(value)) {
+    for (const entry of value) collect(entry, hint, into);
+    return;
+  }
+  if (!isRecord(value)) return;
+  if (hint !== undefined && typeof value.id === "string" && !into.has(value.id)) {
+    into.set(value.id, hint);
+  }
+  for (const [field, nested] of Object.entries(value)) {
+    const next = LIST_HINTS[field] ?? HELD_HINTS[field];
+    collect(nested, next, into);
+  }
+};
+
+const replace = (value: unknown, fresh: ReadonlyMap<string, string>): unknown => {
+  if (Array.isArray(value)) return value.map((entry) => replace(entry, fresh));
+  if (!isRecord(value)) return value;
+  const next: Fields = {};
+  for (const [field, nested] of Object.entries(value)) {
+    const renamed =
+      (field === "id" || field === "atom" || field === "firstSlideId") &&
+      typeof nested === "string" &&
+      fresh.has(nested);
+    next[field] = renamed ? fresh.get(nested as string) : replace(nested, fresh);
+  }
+  return next;
+};
+
+export const withFreshIds = <T>(fragment: T, mint: Mint, hint?: IdHint): T => {
+  const found = new Map<string, IdHint>();
+  collect(fragment, hint, found);
+  const fresh = new Map<string, string>();
+  for (const [previous, hint] of found) fresh.set(previous, mint(hint, previous));
+  return replace(fragment, fresh) as T;
+};
~~~~

### new · `src/lib/representation/data/behavior/templates/portable.ts` (+103 / −0)

~~~~diff
@@ -0,0 +1,103 @@
+type Fields = Record<string, unknown>;
+
+export type Portable<T> = { readonly body: T; readonly dropped: readonly string[] };
+
+const isRecord = (value: unknown): value is Fields =>
+  value !== null && typeof value === "object" && !Array.isArray(value);
+
+const WORDS: Record<string, [string, string]> = {
+  formula: ["a formula's project binding", "formulas' project bindings"],
+  output: ["a prompt's generated output", "prompts' generated outputs"],
+  link: ["a link to something in the project", "links to things in the project"],
+  image: ["an image stored in the project", "images stored in the project"],
+  background: ["an image background", "image backgrounds"],
+  scope: ["a scope term naming project resources", "scope terms naming project resources"],
+  value: ["a value bound to the project", "values bound to the project"]
+};
+
+const sentence = (counts: ReadonlyMap<string, number>): readonly string[] =>
+  [...counts].map(([kind, count]) => {
+    const [one, many] = WORDS[kind];
+    return count === 1 ? `Dropped ${one}.` : `Dropped ${count} ${many}.`;
+  });
+
+const without = (fields: Fields, gone: readonly string[]): Fields =>
+  Object.fromEntries(Object.entries(fields).filter(([key]) => !gone.includes(key)));
+
+export const portableBodyOf = <T>(body: T): Portable<T> => {
+  const counts = new Map<string, number>();
+  const drop = (kind: string): void => {
+    counts.set(kind, (counts.get(kind) ?? 0) + 1);
+  };
+
+  const scope = (held: Fields): Fields => {
+    const keep = (terms: unknown): unknown[] => {
+      if (!Array.isArray(terms)) return [];
+      return terms.filter((term) => {
+        const portable =
+          isRecord(term) &&
+          (term.select === "project" || term.select === "kinds" || term.select === "hole");
+        if (!portable) drop("scope");
+        return portable;
+      });
+    };
+    return { include: keep(held.include), exclude: keep(held.exclude) };
+  };
+
+  const walk = (value: unknown): unknown => {
+    if (Array.isArray(value)) return value.map(walk);
+    if (!isRecord(value)) return value;
+
+    if (value.kind === "reference" && isRecord(value.target) && value.target.to === "resource") {
+      drop("value");
+      return { kind: "empty" };
+    }
+    if (value.kind === "range" && "resourceId" in value) {
+      drop("value");
+      return { kind: "empty" };
+    }
+    if (value.kind === "function" && "formulaId" in value) {
+      drop("value");
+      return { kind: "empty" };
+    }
+    if (value.kind === "image" && "fileId" in value && "fit" in value) {
+      drop("background");
+      return undefined;
+    }
+
+    let held: Fields = value;
+    if ((held.kind === "formula" || held.type === "formula") && "formulaId" in held) {
+      drop("formula");
+      held = without(held, ["formulaId"]);
+    }
+    if (held.type === "prompt" && "derivedOutputId" in held) {
+      drop("output");
+      held = without(held, ["derivedOutputId"]);
+    }
+    if (
+      isRecord(held.link) &&
+      (held.link.kind === "actor" || held.link.kind === "persona" || held.link.kind === "resource")
+    ) {
+      drop("link");
+      held = without(held, ["link"]);
+    }
+    if (
+      held.type === "image" &&
+      isRecord(held.source) &&
+      (held.source.kind === "file" || held.source.kind === "storage")
+    ) {
+      drop("image");
+      held = without(held, ["source"]);
+    }
+
+    const next: Fields = {};
+    for (const [field, nested] of Object.entries(held)) {
+      const walked =
+        held.type === "prompt" && field === "scope" && isRecord(nested) ? scope(nested) : walk(nested);
+      if (walked !== undefined) next[field] = walked;
+    }
+    return next;
+  };
+
+  return { body: walk(body) as T, dropped: sentence(counts) };
+};
~~~~

### new · `src/lib/representation/data/behavior/templates/scopes.ts` (+216 / −0)

~~~~diff
@@ -0,0 +1,216 @@
+import { displayOfAtom } from "$representation/data/behavior/content/positions";
+import type { Atom } from "$representation/data/types/content/content-block";
+import type {
+  ResourceSet,
+  SetTerm,
+  TemplatedResourceSet,
+  TemplatedTerm
+} from "$representation/data/types/core/resource-set";
+import type {
+  TemplateBody,
+  TemplateHole
+} from "$representation/data/types/templates/template";
+
+type Term = SetTerm | TemplatedTerm;
+type Scope = { readonly include: readonly Term[]; readonly exclude: readonly Term[] };
+type Sides = { readonly same: readonly Term[]; readonly opposite: readonly Term[] };
+
+export type ScopeAnswers = Readonly<Record<string, ResourceSet>>;
+
+export type ResolvedScopes =
+  | { readonly accepted: true; readonly body: TemplateBody; readonly undeclared: readonly string[] }
+  | { readonly accepted: false; readonly reason: "unsupported-body"; readonly detail: string };
+
+const MAX_TERMS = 10_000;
+const OVERFLOW = "template-scope-resolution-overflow";
+const DIFFERENCE = "template-scope-difference-is-not-flattenable";
+const WHOLE_PROJECT: Scope = { include: [{ select: "project" }], exclude: [] };
+
+const cloneTerm = (term: Term): Term =>
+  term.select === "kinds"
+    ? { ...term, kinds: [...term.kinds] }
+    : term.select === "resources"
+      ? { ...term, refs: term.refs.map((ref) => ({ ...ref })) }
+      : { ...term };
+
+const cloneScope = (scope: Scope): Scope => ({
+  include: scope.include.map(cloneTerm),
+  exclude: scope.exclude.map(cloneTerm)
+});
+
+const isRecord = (value: unknown): value is Record<string, unknown> =>
+  value !== null && typeof value === "object" && !Array.isArray(value);
+
+const isTemplateAtom = (value: Record<string, unknown>): boolean =>
+  value.kind === "template" && typeof value.name === "string" && typeof value.id === "string";
+
+/** Every hole the body's template atoms ask for words for. */
+export const templateAtomNamesIn = (body: TemplateBody): readonly string[] => {
+  const names = new Set<string>();
+  const walk = (value: unknown): void => {
+    if (Array.isArray(value)) {
+      for (const entry of value) walk(entry);
+      return;
+    }
+    if (!isRecord(value)) return;
+    if (isTemplateAtom(value)) names.add(value.name as string);
+    for (const nested of Object.values(value)) walk(nested);
+  };
+  walk(body);
+  return [...names].sort();
+};
+
+/**
+ * A template atom becomes the words it was answered with.
+ *
+ * An atom nobody answered is left exactly as it is, because a template being
+ * edited is full of unanswered holes and that is what it is for. A block's
+ * display is rebuilt from its atoms afterwards, since the words changed.
+ */
+export const fillTemplateAtoms = (
+  body: TemplateBody,
+  texts: Readonly<Record<string, string>>
+): TemplateBody => {
+  const walk = (value: unknown): unknown => {
+    if (Array.isArray(value)) return value.map(walk);
+    if (!isRecord(value)) return value;
+    if (isTemplateAtom(value)) {
+      const held = texts[value.name as string];
+      return held === undefined ? value : { id: value.id, kind: "literal", text: held };
+    }
+    const next = Object.fromEntries(
+      Object.entries(value).map(([field, nested]) => [field, walk(nested)])
+    );
+    if (!Array.isArray(next.atoms) || typeof next.display !== "string") return next;
+    return { ...next, display: (next.atoms as Atom[]).map(displayOfAtom).join("") };
+  };
+  return walk(body) as TemplateBody;
+};
+
+export const scopeHoleNamesIn = (body: TemplateBody): readonly string[] => {
+  const names = new Set<string>();
+  const walk = (value: unknown): void => {
+    if (Array.isArray(value)) {
+      for (const entry of value) walk(entry);
+      return;
+    }
+    if (!isRecord(value)) return;
+    if (value.type === "prompt" && isRecord(value.scope)) {
+      for (const side of ["include", "exclude"]) {
+        const terms = value.scope[side];
+        if (!Array.isArray(terms)) continue;
+        for (const term of terms) {
+          if (isRecord(term) && term.select === "hole" && typeof term.name === "string") {
+            names.add(term.name);
+          }
+        }
+      }
+    }
+    for (const nested of Object.values(value)) walk(nested);
+  };
+  walk(body);
+  return [...names].sort();
+};
+
+export const resolveTemplateScopes = (
+  body: TemplateBody,
+  holes: readonly TemplateHole[],
+  answers: ScopeAnswers = {}
+): ResolvedScopes => {
+  const definitions = new Map(holes.map((hole) => [hole.name, hole]));
+  const memo = new Map<string, Scope>();
+  const undeclared = new Set<string>();
+  let emitted = 0;
+
+  const append = (target: Term[], terms: readonly Term[]): void => {
+    for (const term of terms) {
+      emitted += 1;
+      if (emitted > MAX_TERMS) throw new RangeError(OVERFLOW);
+      target.push(cloneTerm(term));
+    }
+  };
+
+  let resolveScope: (scope: Scope, stack: readonly string[]) => Scope;
+
+  const expand = (terms: readonly Term[], stack: readonly string[]): Sides => {
+    const same: Term[] = [];
+    const opposite: Term[] = [];
+    for (const term of terms) {
+      if (term.select !== "hole") {
+        append(same, [term]);
+        continue;
+      }
+      const answer = answers[term.name];
+      if (answer !== undefined) {
+        if (answer.exclude.length > 0) throw new Error(DIFFERENCE);
+        append(same, answer.include);
+        continue;
+      }
+      const definition = definitions.get(term.name);
+      if (definition === undefined) {
+        undeclared.add(term.name);
+        append(same, [term]);
+        continue;
+      }
+      const rule = definition.default;
+      if (rule === undefined || stack.includes(term.name)) {
+        append(same, WHOLE_PROJECT.include);
+        continue;
+      }
+      if (rule.exclude.length > 0) throw new Error(DIFFERENCE);
+      const cached = memo.get(term.name);
+      const resolved =
+        cached === undefined ? resolveScope(rule, [...stack, term.name]) : cloneScope(cached);
+      if (cached === undefined) memo.set(term.name, cloneScope(resolved));
+      append(same, resolved.include);
+      append(opposite, resolved.exclude);
+    }
+    return { same, opposite };
+  };
+
+  resolveScope = (scope, stack) => {
+    const included = expand(scope.include, stack);
+    const excluded = expand(scope.exclude, stack);
+    const include: Term[] = [];
+    const exclude: Term[] = [];
+    append(include, included.same);
+    append(include, excluded.opposite);
+    append(exclude, included.opposite);
+    append(exclude, excluded.same);
+    return { include, exclude };
+  };
+
+  const walk = (value: unknown): unknown => {
+    if (Array.isArray(value)) return value.map(walk);
+    if (!isRecord(value)) return value;
+    return Object.fromEntries(
+      Object.entries(value).map(([field, nested]) => [
+        field,
+        value.type === "prompt" && field === "scope" && isRecord(nested)
+          ? resolveScope(nested as unknown as TemplatedResourceSet, [])
+          : walk(nested)
+      ])
+    );
+  };
+
+  try {
+    const resolved = walk(body) as TemplateBody;
+    return { accepted: true, body: resolved, undeclared: [...undeclared].sort() };
+  } catch (error) {
+    if (error instanceof Error && error.message === DIFFERENCE) {
+      return {
+        accepted: false,
+        reason: "unsupported-body",
+        detail: "a hole answered with exclusions cannot be flattened without changing scope"
+      };
+    }
+    if (error instanceof RangeError && error.message === OVERFLOW) {
+      return {
+        accepted: false,
+        reason: "unsupported-body",
+        detail: `template scopes expand beyond ${MAX_TERMS} terms`
+      };
+    }
+    throw error;
+  }
+};
~~~~

### new · `src/lib/representation/data/behavior/templates/test/unit/answers.test.ts` (+104 / −0)

~~~~diff
@@ -0,0 +1,104 @@
+import { describe, expect, it } from "vitest";
+
+import { answerRowsOf, missingIn } from "$representation/data/behavior/templates/answers";
+import {
+  fillTemplateAtoms,
+  templateAtomNamesIn
+} from "$representation/data/behavior/templates/scopes";
+import type { TemplateBody, TemplateHole } from "$representation/data/types/templates/template";
+
+const body = (): TemplateBody => ({
+  resource: "document",
+  rows: [
+    {
+      id: "r1",
+      kind: "blocks",
+      blocks: [
+        {
+          id: "b1",
+          type: "text",
+          variant: "paragraph",
+          atoms: [
+            { id: "a1", kind: "literal", text: "Dear " },
+            { id: "a2", kind: "template", name: "recipient" },
+            { id: "a3", kind: "literal", text: ", about " },
+            { id: "a4", kind: "template", name: "subject" }
+          ],
+          display: "Dear {recipient}, about {subject}",
+          marks: []
+        }
+      ]
+    }
+  ]
+});
+
+const blockOf = (held: TemplateBody) => {
+  if (held.resource !== "document") throw new Error("a document was expected");
+  const row = held.rows[0];
+  if (row.kind !== "blocks") throw new Error("blocks were expected");
+  return row.blocks[0] as { atoms: { kind: string; text?: string }[]; display: string };
+};
+
+describe("a template's text parameters", () => {
+  it("are found from the atoms that ask for them", () => {
+    expect(templateAtomNamesIn(body())).toEqual(["recipient", "subject"]);
+  });
+
+  it("become the words they were answered with, and the display follows", () => {
+    const filled = blockOf(fillTemplateAtoms(body(), { recipient: "Ana", subject: "the winter packet" }));
+    expect(filled.atoms.map((atom) => atom.kind)).toEqual(["literal", "literal", "literal", "literal"]);
+    expect(filled.display).toBe("Dear Ana, about the winter packet");
+  });
+
+  it("are left alone when nobody answered, because a template is holes", () => {
+    const held = blockOf(fillTemplateAtoms(body(), { recipient: "Ana" }));
+    expect(held.atoms[3].kind).toBe("template");
+    expect(held.display).toBe("Dear Ana, about {subject}");
+  });
+});
+
+describe("what placing a template asks for", () => {
+  const holes: TemplateHole[] = [
+    {
+      name: "evidence",
+      label: "Evidence",
+      description: "What it reads.",
+      default: { include: [{ select: "kinds", kinds: ["finding"] }], exclude: [] }
+    },
+    { name: "subject", label: "Subject", kind: "text" }
+  ];
+
+  it("gives every parameter a row, and a scope always has a value", () => {
+    const rows = answerRowsOf(holes, {}, {});
+    expect(rows.map((row) => row.kind)).toEqual(["scope", "text"]);
+    expect(rows[0].value).toBe("Findings");
+    expect(rows[0].missing).toBe(false);
+    expect(rows[0].answered).toBe(false);
+  });
+
+  it("starts a text parameter at its own default words", () => {
+    const withWords = [{ name: "subject", label: "Subject", kind: "text" as const, text: "Winter" }];
+    const rows = answerRowsOf(withWords, {}, {});
+    expect(rows[0].value).toBe("Winter");
+    expect(rows[0].missing).toBe(false);
+    expect(rows[0].answered).toBe(false);
+    expect(answerRowsOf(withWords, {}, { subject: "Spring" })[0].answered).toBe(true);
+  });
+
+  it("marks a text parameter missing until it has words", () => {
+    expect(missingIn(answerRowsOf(holes, {}, {}))).toEqual(["Subject"]);
+    expect(missingIn(answerRowsOf(holes, {}, { subject: "  " }))).toEqual(["Subject"]);
+    expect(missingIn(answerRowsOf(holes, {}, { subject: "Winter" }))).toEqual([]);
+  });
+
+  it("reads a chosen scope as itself rather than as the default", () => {
+    const rows = answerRowsOf(
+      holes,
+      { evidence: { include: [{ select: "project" }], exclude: [] } },
+      { subject: "Winter" }
+    );
+    expect(rows[0].value).toBe("Everything in the project");
+    expect(rows[0].answered).toBe(true);
+    expect(rows[1].value).toBe("Winter");
+  });
+});
~~~~

### new · `src/lib/representation/data/behavior/templates/test/unit/deck-of-slide.test.ts` (+36 / −0)

~~~~diff
@@ -0,0 +1,36 @@
+import { describe, expect, it } from "vitest";
+
+import type { SlideDeckBody } from "$representation/data/types/slide-decks/body";
+import { deckOfSlide } from "$representation/data/behavior/templates/deck-of-slide";
+
+const deck: SlideDeckBody = {
+  aspectRatio: "4:3",
+  theme: { colors: { text: "ink", accent: "blue" } },
+  styles: { defaultKey: "body", styles: { body: { name: "Body" } } },
+  layouts: [
+    { id: "l1", key: "title", name: "Title", locked: [], placeholders: [] },
+    { id: "l2", key: "blank", name: "Blank", locked: [], placeholders: [] }
+  ],
+  slides: [
+    { id: "s1", layoutKey: "title", elements: [], notes: [] },
+    { id: "s2", layoutKey: "blank", elements: [], notes: [] }
+  ],
+  sections: [{ id: "sec1", name: "One", firstSlideId: "s1" }]
+};
+
+describe("deckOfSlide", () => {
+  it("is a deck holding one slide, its layout, the theme and the styles, and no sections", () => {
+    expect(deckOfSlide(deck, "s2")).toEqual({
+      aspectRatio: "4:3",
+      theme: deck.theme,
+      styles: deck.styles,
+      layouts: [deck.layouts[1]],
+      slides: [deck.slides[1]],
+      sections: []
+    });
+  });
+
+  it("answers nothing for a slide the deck does not have", () => {
+    expect(deckOfSlide(deck, "s9")).toBeUndefined();
+  });
+});
~~~~

### new · `src/lib/representation/data/behavior/templates/test/unit/fresh-ids.test.ts` (+81 / −0)

~~~~diff
@@ -0,0 +1,81 @@
+import { describe, expect, it } from "vitest";
+
+import type { DocumentRow } from "$representation/data/types/documents/body";
+import type { SlideDeckBody } from "$representation/data/types/slide-decks/body";
+import { withFreshIds, type IdHint } from "$representation/data/behavior/templates/fresh-ids";
+
+const mint = (hint: IdHint, previous: string) => `${hint}:${previous}`;
+
+describe("withFreshIds", () => {
+  it("renames rows, blocks, atoms and marks and keeps mark ends attached", () => {
+    const rows: DocumentRow[] = [
+      {
+        id: "r1",
+        kind: "blocks",
+        blocks: [
+          {
+            id: "b1",
+            type: "text",
+            variant: "paragraph",
+            atoms: [{ id: "a1", kind: "literal", text: "Hello" }],
+            display: "Hello",
+            marks: [{ id: "m1", from: { atom: "a1", offset: 0 }, to: { atom: "a1", offset: 2 }, style: ["bold"] }]
+          },
+          {
+            id: "t1",
+            type: "table",
+            headerRows: 1,
+            rows: [{ id: "tr1", cells: [{ id: "c1", blocks: [{ id: "b2", type: "text", variant: "paragraph", atoms: [{ id: "a2", kind: "literal", text: "" }], display: "", marks: [] }] }] }]
+          }
+        ]
+      }
+    ];
+    const fresh = withFreshIds(rows, mint, "row");
+    const row = fresh[0];
+    if (row.kind !== "blocks") throw new Error("blocks expected");
+    expect(row.id).toBe("row:r1");
+    const text = row.blocks[0];
+    if (text.type !== "text") throw new Error("text expected");
+    expect(text.id).toBe("block:b1");
+    expect(text.atoms[0].id).toBe("atom:a1");
+    expect(text.marks[0]).toEqual({ id: "mark:m1", from: { atom: "atom:a1", offset: 0 }, to: { atom: "atom:a1", offset: 2 }, style: ["bold"] });
+    const table = row.blocks[1];
+    if (table.type !== "table") throw new Error("table expected");
+    expect(table.rows[0].id).toBe("row:tr1");
+    expect(table.rows[0].cells[0].id).toBe("cell:c1");
+    expect(table.rows[0].cells[0].blocks[0].id).toBe("block:b2");
+    expect(rows[0].id).toBe("r1");
+  });
+
+  it("renames slides, elements, groups, layouts and section anchors", () => {
+    const deck: SlideDeckBody = {
+      aspectRatio: "16:9",
+      theme: { colors: { text: "ink", accent: "blue" } },
+      styles: { defaultKey: "body", styles: { body: { name: "Body" } } },
+      layouts: [{ id: "l1", key: "title", name: "Title", locked: [{ id: "e0", frame: { x: 0, y: 0, width: 1, height: 1 }, content: { type: "shape", shape: "rectangle" } }], placeholders: [] }],
+      slides: [
+        {
+          id: "s1",
+          layoutKey: "title",
+          elements: [
+            { id: "e1", frame: { x: 0, y: 0, width: 1, height: 1 }, content: { type: "group", children: [{ id: "e2", frame: { x: 0, y: 0, width: 1, height: 1 }, content: { type: "line", from: { x: 0, y: 0 }, to: { x: 1, y: 1 } } }] } }
+          ],
+          notes: [{ id: "n1", type: "text", variant: "paragraph", atoms: [{ id: "na1", kind: "literal", text: "" }], display: "", marks: [] }]
+        }
+      ],
+      sections: [{ id: "sec1", name: "Opening", firstSlideId: "s1" }]
+    };
+    const fresh = withFreshIds(deck, mint);
+    expect(fresh.layouts[0].id).toBe("layout:l1");
+    expect(fresh.layouts[0].key).toBe("title");
+    expect(fresh.layouts[0].locked[0].id).toBe("element:e0");
+    expect(fresh.slides[0].id).toBe("slide:s1");
+    expect(fresh.slides[0].layoutKey).toBe("title");
+    expect(fresh.slides[0].elements[0].id).toBe("element:e1");
+    const group = fresh.slides[0].elements[0].content;
+    if (group.type !== "group") throw new Error("group expected");
+    expect(group.children[0].id).toBe("element:e2");
+    expect(fresh.slides[0].notes[0].id).toBe("block:n1");
+    expect(fresh.sections[0]).toEqual({ id: "section:sec1", name: "Opening", firstSlideId: "slide:s1" });
+  });
+});
~~~~

### new · `src/lib/representation/data/behavior/templates/test/unit/portable.test.ts` (+97 / −0)

~~~~diff
@@ -0,0 +1,97 @@
+import { describe, expect, it } from "vitest";
+
+import type { DocumentBody } from "$representation/data/types/documents/body";
+import type { SlideDeckBody } from "$representation/data/types/slide-decks/body";
+import { portableBodyOf } from "$representation/data/behavior/templates/portable";
+
+const documentBody = (): DocumentBody => ({
+  rows: [
+    {
+      id: "r1",
+      kind: "blocks",
+      blocks: [
+        {
+          id: "b1",
+          type: "text",
+          variant: "paragraph",
+          atoms: [
+            { id: "a1", kind: "literal", text: "See " },
+            {
+              id: "a2",
+              kind: "formula",
+              expression: "=total",
+              formulaId: "formulas:1" as never,
+              lastResolvedValue: { kind: "number", value: 4 },
+              lastResolvedDisplay: "4",
+              state: "fresh"
+            }
+          ],
+          display: "See 4",
+          marks: [
+            { id: "m1", from: { atom: "a1", offset: 0 }, to: { atom: "a1", offset: 3 }, link: { kind: "url", url: "https://example.com" } },
+            { id: "m2", from: { atom: "a1", offset: 0 }, to: { atom: "a1", offset: 2 }, style: ["bold"], link: { kind: "resource", ref: { kind: "document", id: "documents:1" } } }
+          ]
+        },
+        { id: "b2", type: "image", alt: "Site", source: { kind: "file", fileId: "externalFiles:1" as never } },
+        {
+          id: "b3",
+          type: "prompt",
+          derivedOutputId: "derivedOutputs:1" as never,
+          atoms: [{ id: "a3", kind: "literal", text: "Sum up" }],
+          display: "Sum up",
+          marks: [],
+          scope: {
+            include: [{ select: "kinds", kinds: ["finding"] }, { select: "set", setId: "resourceSets:1" as never }],
+            exclude: [{ select: "resources", refs: [{ kind: "document", id: "documents:2" }] }]
+          },
+          state: "idle"
+        }
+      ]
+    }
+  ]
+});
+
+describe("portableBodyOf", () => {
+  it("strips every project-bound field and says what went", () => {
+    const { body, dropped } = portableBodyOf(documentBody());
+    const row = body.rows[0];
+    if (row.kind !== "blocks") throw new Error("blocks expected");
+    const [text, image, prompt] = row.blocks;
+    if (text.type !== "text" || image.type !== "image" || prompt.type !== "prompt") {
+      throw new Error("block kinds moved");
+    }
+    expect("formulaId" in text.atoms[1]).toBe(false);
+    expect(text.marks[0].link).toEqual({ kind: "url", url: "https://example.com" });
+    expect(text.marks[1]).toEqual({ id: "m2", from: { atom: "a1", offset: 0 }, to: { atom: "a1", offset: 2 }, style: ["bold"] });
+    expect("source" in image).toBe(false);
+    expect("derivedOutputId" in prompt).toBe(false);
+    expect(prompt.scope).toEqual({ include: [{ select: "kinds", kinds: ["finding"] }], exclude: [] });
+    expect(dropped).toEqual([
+      "Dropped a formula's project binding.",
+      "Dropped a link to something in the project.",
+      "Dropped an image stored in the project.",
+      "Dropped a prompt's generated output.",
+      "Dropped 2 scope terms naming project resources."
+    ]);
+  });
+
+  it("drops an image background from a deck theme and leaves colours alone", () => {
+    const deck: SlideDeckBody = {
+      aspectRatio: "16:9",
+      theme: { background: { kind: "image", fileId: "externalFiles:2" as never, fit: "cover" }, colors: { text: "ink", accent: "blue" } },
+      styles: { defaultKey: "body", styles: { body: { name: "Body" } } },
+      layouts: [],
+      slides: [{ id: "s1", elements: [], notes: [], background: { kind: "color", color: "white" } }],
+      sections: []
+    };
+    const { body, dropped } = portableBodyOf(deck);
+    expect("background" in body.theme).toBe(false);
+    expect(body.slides[0].background).toEqual({ kind: "color", color: "white" });
+    expect(dropped).toEqual(["Dropped an image background."]);
+  });
+
+  it("leaves a portable body untouched and says nothing", () => {
+    const held: DocumentBody = { rows: [{ id: "r1", kind: "pageBreak" }] };
+    expect(portableBodyOf(held)).toEqual({ body: held, dropped: [] });
+  });
+});
~~~~

### new · `src/lib/representation/data/behavior/templates/test/unit/scopes.test.ts` (+109 / −0)

~~~~diff
@@ -0,0 +1,109 @@
+import { describe, expect, it } from "vitest";
+
+import type { PromptBlock } from "$representation/data/types/content/content-block";
+import type { TemplatedTerm } from "$representation/data/types/core/resource-set";
+import type { TemplateBody, TemplateHole } from "$representation/data/types/templates/template";
+import {
+  resolveTemplateScopes,
+  scopeHoleNamesIn
+} from "$representation/data/behavior/templates/scopes";
+
+const prompt = (id: string, include: TemplatedTerm[]): PromptBlock => ({
+  id,
+  type: "prompt",
+  atoms: [{ id: `${id}-a`, kind: "literal", text: "Summarise" }],
+  display: "Summarise",
+  marks: [],
+  scope: { include, exclude: [] },
+  state: "idle"
+});
+
+const body = (blocks: PromptBlock[]): TemplateBody => ({
+  resource: "document",
+  rows: [{ id: "r1", kind: "blocks", blocks }]
+});
+
+const scopeOf = (held: TemplateBody, blockId: string) => {
+  if (held.resource !== "document") throw new Error("a document was expected");
+  const row = held.rows[0];
+  if (row.kind !== "blocks") throw new Error("a blocks row was expected");
+  const block = row.blocks.find((candidate) => candidate.id === blockId);
+  return block?.type === "prompt" ? block.scope : undefined;
+};
+
+const evidence: TemplateHole = {
+  name: "evidence",
+  label: "Evidence",
+  default: { include: [{ select: "kinds", kinds: ["finding"] }], exclude: [] }
+};
+
+describe("resolveTemplateScopes", () => {
+  it("fills a hole term from its default", () => {
+    const resolved = resolveTemplateScopes(body([prompt("p", [{ select: "hole", name: "evidence" }])]), [evidence]);
+    expect(resolved.accepted).toBe(true);
+    if (!resolved.accepted) return;
+    expect(resolved.undeclared).toEqual([]);
+    expect(scopeOf(resolved.body, "p")).toEqual({
+      include: [{ select: "kinds", kinds: ["finding"] }],
+      exclude: []
+    });
+  });
+
+  it("prefers the caller's answer to the default", () => {
+    const resolved = resolveTemplateScopes(
+      body([prompt("p", [{ select: "hole", name: "evidence" }])]),
+      [evidence],
+      { evidence: { include: [{ select: "set", setId: "resourceSets:2" as never }], exclude: [] } }
+    );
+    if (!resolved.accepted) throw new Error(resolved.detail);
+    expect(scopeOf(resolved.body, "p")).toEqual({
+      include: [{ select: "set", setId: "resourceSets:2" }],
+      exclude: []
+    });
+  });
+
+  it("means the whole project for a hole declared without a default", () => {
+    const resolved = resolveTemplateScopes(
+      body([prompt("p", [{ select: "hole", name: "models" }])]),
+      [{ name: "models", label: "Models" }]
+    );
+    if (!resolved.accepted) throw new Error(resolved.detail);
+    expect(scopeOf(resolved.body, "p")).toEqual({ include: [{ select: "project" }], exclude: [] });
+  });
+
+  it("keeps the term and reports a name the template does not declare", () => {
+    const resolved = resolveTemplateScopes(
+      body([prompt("p", [{ select: "hole", name: "evidence" }, { select: "hole", name: "models" }])]),
+      [evidence]
+    );
+    if (!resolved.accepted) throw new Error(resolved.detail);
+    expect(resolved.undeclared).toEqual(["models"]);
+    expect(scopeOf(resolved.body, "p")).toEqual({
+      include: [{ select: "kinds", kinds: ["finding"] }, { select: "hole", name: "models" }],
+      exclude: []
+    });
+  });
+
+  it("refuses a default that excludes, because a difference does not flatten", () => {
+    const resolved = resolveTemplateScopes(body([prompt("p", [{ select: "hole", name: "evidence" }])]), [
+      { ...evidence, default: { include: [{ select: "project" }], exclude: [{ select: "kinds", kinds: ["slides"] }] } }
+    ]);
+    expect(resolved).toMatchObject({ accepted: false, reason: "unsupported-body" });
+  });
+
+  it("treats a hole that reaches itself as the whole project", () => {
+    const resolved = resolveTemplateScopes(body([prompt("p", [{ select: "hole", name: "loop" }])]), [
+      { name: "loop", label: "Loop", default: { include: [{ select: "hole", name: "loop" }], exclude: [] } }
+    ]);
+    if (!resolved.accepted) throw new Error(resolved.detail);
+    expect(scopeOf(resolved.body, "p")).toEqual({ include: [{ select: "project" }], exclude: [] });
+  });
+
+  it("lists the hole names a body refers to", () => {
+    const held = body([
+      prompt("p", [{ select: "hole", name: "b" }]),
+      prompt("q", [{ select: "hole", name: "a" }, { select: "kinds", kinds: ["document"] }])
+    ]);
+    expect(scopeHoleNamesIn(held)).toEqual(["a", "b"]);
+  });
+});
~~~~

### changed · `src/lib/representation/data/behavior/workspace/opening.ts` (+5 / −1)

~~~~diff
@@ -145,6 +145,7 @@ export const STARTING_ZOOM: number | null = null;
 
 export type Overrides = {
   readonly content?: ContentView;
+  readonly context?: ContextView;
   readonly focus?: string;
 };
 
@@ -155,7 +156,10 @@ export const openingView = (category: Category, overrides: Overrides = {}): TabV
   return {
     content,
     focus: overrides.focus ?? null,
-    contextId: defaultContext(category),
+    contextId:
+      overrides.context !== undefined && offersContext(category, overrides.context)
+        ? overrides.context
+        : defaultContext(category),
     inspected: "empty",
     selection: null,
     frame: { ...STARTING_FRAME },
~~~~

### changed · `src/lib/representation/data/types/content/content-block.ts` (+16 / −1)

~~~~diff
@@ -20,7 +20,22 @@ export type FormulaAtom = {
   error?: string;
 };
 
-export type Atom = TextAtom | FormulaAtom;
+/**
+ * A hole in a template's prose, filled with words when the template is placed.
+ *
+ * **It is a template's parameter, not a variable.** A variable in this
+ * application is a named value a formula can read; this is unrelated to that and
+ * must not borrow the word. What it names is one of the template's own
+ * parameters, which is why the kind is `template`: outside a template body and
+ * the copy it is edited through, this atom does not belong anywhere.
+ *
+ * It carries only the name. The label and the description that explain it to
+ * whoever fills it in live on the template's parameter of that name, because two
+ * atoms may name one parameter and there must be one answer.
+ */
+export type TemplateAtom = { id: string; kind: "template"; name: string };
+
+export type Atom = TextAtom | FormulaAtom | TemplateAtom;
 
 export type MarkStyle = "bold" | "italic" | "underline" | "strikethrough" | "code";
~~~~

### changed · `src/lib/representation/data/types/core/resource-set.ts` (+16 / −24)

~~~~diff
@@ -1,40 +1,32 @@
 import type { Id } from "$representation/data/types/core/id";
 import type { ResourceKind, ResourceRef } from "$representation/data/types/core/resource";
 
-/** Everything in this project, including whatever is made tomorrow. */
 type ProjectTerm = { select: "project" };
 
-/** Each entry is prefix-matched, so one names a whole family. */
 type KindsTerm = { select: "kinds"; kinds: ResourceKind[] };
 
-/**
- * A term bound to one project. Following a `set` reads another row, whose own
- * set may name a third.
- */
+type NamedSetTerm = { select: "set"; setId: Id<"resourceSets"> };
+
 export type SetTerm =
   | ProjectTerm
   | KindsTerm
   | { select: "resources"; refs: ResourceRef[] }
-  | { select: "set"; setId: Id<"resourceSets"> };
+  | NamedSetTerm;
 
-/**
- * A term a template body may hold. No ids, so it means the same in any project.
- *
- * A `variable` is a hole an answer fills at instantiation. It is a term rather
- * than a field on the set because a template may draw on several variables, and
- * a variable may be excluded as easily as included.
- */
-export type TemplatedTerm = ProjectTerm | KindsTerm | { select: "variable"; name: string };
+export type TemplatedTerm = ProjectTerm | KindsTerm | NamedSetTerm | { select: "hole"; name: string };
 
-/**
- * Everything in `include`, minus everything in `exclude`.
- *
- * Two flat lists rather than a tree. What they cannot say directly — `A ∩ B`,
- * `A − (B − C)` — a named set says instead, as a `set` term.
- *
- * An empty `include` selects nothing. Checked where a set is accepted.
- */
 export type ResourceSet = { include: SetTerm[]; exclude: SetTerm[] };
 
-/** The same, as a template carries it between projects. */
 export type TemplatedResourceSet = { include: TemplatedTerm[]; exclude: TemplatedTerm[] };
+
+/**
+ * What a stored set exists for, when it exists for one thing.
+ *
+ * A row with a name is a project subject: people make it, list it, and reuse it.
+ * A row with an owner is a value something else holds, written because the rule
+ * could not be said inline. It is never listed and never named, and it goes when
+ * its owner goes.
+ */
+export type BoundTo =
+  | { kind: "hole"; templateId: Id<"templates">; hole: string }
+  | { kind: "resource"; resourceId: string; hole: string };
~~~~

### changed · `src/lib/representation/data/types/templates/template.ts` (+12 / −27)

~~~~diff
@@ -9,40 +9,34 @@ import type { PageSetup } from "$representation/data/types/spreadsheets/page-set
 import type { StyleSet } from "$representation/data/types/spreadsheets/style-set";
 
 /**
- * One question a template asks when it is instantiated.
+ * What a hole is answered with.
  *
- * `name` is what a `{ select: "variable" }` term names. Nothing lists which
- * blocks the answer reaches — instantiation walks the body and fills every term
- * naming this variable, so there is no id list that can point at a block the
- * body no longer has.
- *
- * A default may only use templated terms, so it means something in whatever
- * project the template lands in.
+ * `scope` is a group of resources, and it always has an answer: what the caller
+ * said, else the default, else the whole project. `text` is words, and it has
+ * none until somebody types them, which is why placing a template asks.
  */
-export type TemplateVariable = {
+export type TemplateHoleKind = "scope" | "text";
+
+export type TemplateHole = {
   name: string;
-  /** What the person filling it in is asked. */
   label: string;
   description?: string;
+  /** Absent means `scope`, which is what every hole was before text ones existed. */
+  kind?: TemplateHoleKind;
+  /** What a `scope` selects when the caller says nothing. */
   default?: TemplatedResourceSet;
+  /** What a `text` says when the caller says nothing. Absent means it must be filled in. */
+  text?: string;
 };
 
-/**
- * One cell as a template holds it. An expression rather than a formula id: a
- * formula is a row scoped to one project, and the text an author wrote is the
- * portable form.
- */
 export type TemplateCell = {
   value?: VariableValue;
-  /** The expression as authored, when the cell computes. */
   expression?: string;
   marks?: Mark[];
   format?: BlockFormat;
-  /** `"D4"` — the far corner of a merge. */
   merge?: string;
 };
 
-/** Addressed rather than identified, like everything else in a spreadsheet template. */
 export type TemplateFormatRule = {
   from: string;
   to: string;
@@ -60,17 +54,8 @@ export type TemplatePrint = {
   headings?: boolean;
 };
 
-/**
- * A spreadsheet as a template holds it: **addressed, never identified.**
- *
- * A live grid names its rows and columns by ids that exist only in that
- * resource. A template has no resource to point at, so everything here is keyed
- * by the address a person reads — `"B7"`, `"A"`, `"3"` — and nothing in it can
- * dangle. It is the one template body that is a projection rather than a copy.
- */
 export type SpreadsheetTemplate = {
   cells: Record<string, TemplateCell>;
-  /** Keyed by the ruler label — `"A"`, `"3"`. */
   columnWidths?: Record<string, number>;
   rowHeights?: Record<string, number>;
   formatRules: TemplateFormatRule[];
~~~~

### changed · `src/lib/representation/data/types/workspace/tab.ts` (+1 / −0)

~~~~diff
@@ -49,6 +49,7 @@ export type Landing = Pick<
 export type Target = {
   readonly category: Category;
   readonly content?: ContentView;
+  readonly context?: ContextView;
   readonly resourceId?: string;
   readonly focus?: string;
 };
~~~~

### changed · `src/lib/representation/store/tables.ts` (+26 / −12)

~~~~diff
@@ -15,7 +15,7 @@ import type { MembershipRole } from "$representation/data/types/core/access";
 import type { Actor } from "$representation/data/types/core/actor";
 import type { Id, Row } from "$representation/data/types/core/id";
 import type { ResourceRef } from "$representation/data/types/core/resource";
-import type { ResourceSet } from "$representation/data/types/core/resource-set";
+import type { BoundTo, ResourceSet } from "$representation/data/types/core/resource-set";
 import type { BackReferenceTargetKind } from "$representation/data/types/data/back-reference";
 import type { FormulaUse } from "$representation/data/types/data/formula-use";
 import type {
@@ -77,7 +77,7 @@ import type {
 } from "$representation/data/types/spreadsheets/snapshot";
 import type {
   TemplateBody,
-  TemplateVariable
+  TemplateHole
 } from "$representation/data/types/templates/template";
 import type { WorkspaceOp } from "$representation/data/types/workspace/op";
 import type { TabId, TabRecord, TabView } from "$representation/data/types/workspace/tab";
@@ -185,7 +185,6 @@ export type SpreadsheetChangeSet = Row<"spreadsheetChangeSets"> & SpreadsheetCha
 export type DocumentFields = {
   projectId: Id<"projects">;
   title: string;
-  templateId?: Id<"templates">;
   createdBy: Actor;
   updatedBy: Actor;
   updatedAt: number;
@@ -195,7 +194,6 @@ export type Document = Row<"documents"> & DocumentFields;
 export type SlideDeckFields = {
   projectId: Id<"projects">;
   title: string;
-  templateId?: Id<"templates">;
   createdBy: Actor;
   updatedBy: Actor;
   updatedAt: number;
@@ -205,7 +203,6 @@ export type SlideDeck = Row<"slideDecks"> & SlideDeckFields;
 export type SpreadsheetFields = {
   projectId: Id<"projects">;
   title: string;
-  templateId?: Id<"templates">;
   createdBy: Actor;
   updatedBy: Actor;
   updatedAt: number;
@@ -380,16 +377,17 @@ export type AgentTaskFields = {
 export type AgentTask = Row<"agentTasks"> & AgentTaskFields;
 
 export type TemplateFields = {
+  projectId: Id<"projects">;
   userId: Id<"users">;
   name: string;
   description?: string;
-  /** Flat library labels. An empty array means the template is untagged. */
   tags: string[];
   body: TemplateBody;
-  variables: TemplateVariable[];
+  holes: TemplateHole[];
   createdBy: Actor;
   revision: number;
   updatedAt: number;
+  lastUsedAt?: number;
 };
 export type Template = Row<"templates"> & TemplateFields;
 
@@ -400,21 +398,35 @@ export type TemplateVersionFields = {
   description?: string;
   tags: string[];
   body: TemplateBody;
-  variables: TemplateVariable[];
+  holes: TemplateHole[];
   at: number;
 };
 export type TemplateVersion = Row<"templateVersions"> & TemplateVersionFields;
 
-export type NamedResourceSetFields = {
+export type TemplateStageFields = {
   projectId: Id<"projects">;
-  name: string;
+  templateId: Id<"templates">;
+  templateRevision: number;
+  target: Exclude<TemplateBody["resource"], "spreadsheet">;
+  resourceId: string;
+  createdBy: Actor;
+  updatedAt: number;
+};
+export type TemplateStage = Row<"templateStages"> & TemplateStageFields;
+
+export type ResourceSetFields = {
+  projectId: Id<"projects">;
+  /** Present on a project's own sets. Absent on a row bound to one hole or one resource. */
+  name?: string;
   description?: string;
+  /** Present on a bound row, and never together with a name. */
+  boundTo?: BoundTo;
   set: ResourceSet;
   createdBy: Actor;
   revision: number;
   updatedAt: number;
 };
-export type NamedResourceSet = Row<"resourceSets"> & NamedResourceSetFields;
+export type StoredResourceSet = Row<"resourceSets"> & ResourceSetFields;
 
 export type ConnectorFields = {
   projectId: Id<"projects">;
@@ -619,6 +631,7 @@ export const TABLE_NAMES = [
   "spreadsheets",
   "spreadsheetSnapshots",
   "templates",
+  "templateStages",
   "templateVersions",
   "threadParts",
   "threads",
@@ -652,7 +665,7 @@ export type TableFields = {
   projects: ProjectFields;
   questions: QuestionFields;
   researchThreads: ResearchThreadFields;
-  resourceSets: NamedResourceSetFields;
+  resourceSets: ResourceSetFields;
   semanticIndexes: SemanticIndexFields;
   semanticIndexNodes: SemanticIndexNodeFields;
   semanticMaterialHistory: SemanticMaterialHistoryFields;
@@ -672,6 +685,7 @@ export type TableFields = {
   spreadsheets: SpreadsheetFields;
   spreadsheetSnapshots: SpreadsheetSnapshotFields;
   templates: TemplateFields;
+  templateStages: TemplateStageFields;
   templateVersions: TemplateVersionFields;
   threadParts: ThreadPartFields;
   threads: ThreadFields;
~~~~

## The templates capability

### new · `src/lib/capabilities/templates/api/commit-template-stage/commit-template-stage.ts` (+121 / −0)

~~~~diff
@@ -0,0 +1,121 @@
+import { requireScope } from "$runtime/server/scope.server";
+import { serverModel } from "$runtime/server/start.server";
+import { portableBodyOf } from "$representation/data/behavior/templates/portable";
+import type { TemplateBody } from "$representation/data/types/templates/template";
+
+import { validateCommitTemplateStage } from "$capabilities/templates/api/commit-template-stage/validate-commit-template-stage";
+import {
+  admitStoredTemplate,
+  reportableRevision,
+  visibleTemplate
+} from "$capabilities/templates/api/shared/projection";
+import { leaderBodyOf, stageById } from "$capabilities/templates/api/shared/stages";
+import type { RowFields } from "$capabilities/templates/api/shared/store";
+import { writeTemplateVersion } from "$capabilities/templates/api/shared/template-rows";
+import { bodyOf } from "$capabilities/templates/api/shared/validation";
+import { declaredFor } from "$capabilities/templates/api/shared/holes";
+import type { CommitTemplateStageResult } from "$capabilities/templates/types/templates";
+
+export const commitTemplateStage = async (input: unknown): Promise<CommitTemplateStageResult> => {
+  const scope = await requireScope();
+  const asked = validateCommitTemplateStage(input);
+
+  const store = serverModel().store;
+  const stage = stageById(store, asked.stageId);
+  if (stage === undefined || stage.projectId !== scope.projectId) {
+    return {
+      accepted: false,
+      stageId: asked.stageId,
+      templateId: null,
+      reason: "not-found",
+      revision: null,
+      detail: "no stage in this project has that id"
+    };
+  }
+  const found = visibleTemplate(store, scope, stage.templateId);
+  if (found.kind !== "found") {
+    return {
+      accepted: false,
+      stageId: stage._id,
+      templateId: stage.templateId,
+      reason: found.kind === "missing" ? "not-found" : "unsupported-body",
+      revision: null,
+      detail: found.kind === "missing" ? "the template this stage edits is gone" : found.detail
+    };
+  }
+  if (found.template.revision !== asked.baseRevision) {
+    return {
+      accepted: false,
+      stageId: stage._id,
+      templateId: stage.templateId,
+      reason: "stale",
+      revision: reportableRevision(found.template.revision),
+      detail: `saved against revision ${asked.baseRevision}, the template is at ${found.template.revision}`
+    };
+  }
+  let template: ReturnType<typeof admitStoredTemplate>;
+  try {
+    template = admitStoredTemplate(found.template);
+  } catch (error) {
+    return {
+      accepted: false,
+      stageId: stage._id,
+      templateId: stage.templateId,
+      reason: "unsupported-body",
+      revision: reportableRevision(found.template.revision),
+      detail: error instanceof Error ? error.message : String(error)
+    };
+  }
+
+  const leader = leaderBodyOf(store, scope.projectId, stage.target, stage.resourceId);
+  if (leader === undefined) {
+    return {
+      accepted: false,
+      stageId: stage._id,
+      templateId: template._id,
+      reason: "unsupported-body",
+      revision: template.revision,
+      detail: "the staged copy has no body to save"
+    };
+  }
+  const portable = portableBodyOf({ resource: stage.target, ...leader.body });
+  let body: TemplateBody;
+  try {
+    body = bodyOf(portable.body, "commit-template-stage");
+  } catch (error) {
+    return {
+      accepted: false,
+      stageId: stage._id,
+      templateId: template._id,
+      reason: "unsupported-body",
+      revision: template.revision,
+      detail: error instanceof Error ? error.message : String(error)
+    };
+  }
+
+  const at = Date.now();
+  const fields: RowFields<"templates"> = {
+    projectId: template.projectId,
+    userId: template.userId,
+    name: template.name,
+    ...(template.description === undefined ? {} : { description: template.description }),
+    tags: [...template.tags],
+    body,
+    holes: declaredFor(body, template.holes),
+    createdBy: template.createdBy,
+    revision: template.revision + 1,
+    updatedAt: at
+  };
+  store.update(`templates.${template._id}`, fields);
+  writeTemplateVersion(store, template._id, fields, at);
+  store.update(`templateStages.${stage._id}.templateRevision`, fields.revision);
+  store.update(`templateStages.${stage._id}.updatedAt`, at);
+
+  return {
+    accepted: true,
+    stageId: stage._id,
+    templateId: template._id,
+    revision: fields.revision,
+    dropped: portable.dropped
+  };
+};
~~~~

### new · `src/lib/capabilities/templates/api/commit-template-stage/validate-commit-template-stage.ts` (+16 / −0)

~~~~diff
@@ -0,0 +1,16 @@
+import {
+  fieldsOf,
+  only,
+  revisionOf,
+  stageIdOf
+} from "$capabilities/templates/api/shared/validation";
+import type { CommitTemplateStageInput } from "$capabilities/templates/types/templates";
+
+export const validateCommitTemplateStage = (input: unknown): CommitTemplateStageInput => {
+  const fields = fieldsOf(input, "commit-template-stage");
+  only(fields, ["stageId", "baseRevision"], "commit-template-stage");
+  return {
+    stageId: stageIdOf(fields.stageId, "commit-template-stage"),
+    baseRevision: revisionOf(fields.baseRevision, "commit-template-stage")
+  };
+};
~~~~

### new · `src/lib/capabilities/templates/api/create-template-from-resource/create-template-from-resource.ts` (+89 / −0)

~~~~diff
@@ -0,0 +1,89 @@
+import { requireScope } from "$runtime/server/scope.server";
+import { serverModel } from "$runtime/server/start.server";
+import { asId } from "$representation/data/behavior/core/id";
+import { deckOfSlide } from "$representation/data/behavior/templates/deck-of-slide";
+import { portableBodyOf } from "$representation/data/behavior/templates/portable";
+import type { TemplateBody } from "$representation/data/types/templates/template";
+
+import { validateCreateTemplateFromResource } from "$capabilities/templates/api/create-template-from-resource/validate-create-template-from-resource";
+import { leaderBodyOf, resourceTableOf } from "$capabilities/templates/api/shared/stages";
+import { recordsIn, type RowFields } from "$capabilities/templates/api/shared/store";
+import { writeTemplateVersion } from "$capabilities/templates/api/shared/template-rows";
+import { bodyOf } from "$capabilities/templates/api/shared/validation";
+import { declaredFor } from "$capabilities/templates/api/shared/holes";
+import type { CreateTemplateFromResourceResult } from "$capabilities/templates/types/templates";
+
+export const createTemplateFromResource = async (
+  input: unknown
+): Promise<CreateTemplateFromResourceResult> => {
+  const scope = await requireScope();
+  const asked = validateCreateTemplateFromResource(input);
+
+  const store = serverModel().store;
+  const table = resourceTableOf(asked.target);
+  const resource = recordsIn(store, table).find(
+    (row) => row._id === asked.resourceId && row.projectId === scope.projectId
+  );
+  const leader =
+    resource === undefined
+      ? undefined
+      : leaderBodyOf(store, scope.projectId, asked.target, asked.resourceId);
+  if (resource === undefined || leader === undefined) {
+    return {
+      accepted: false,
+      resourceId: asked.resourceId,
+      reason: "not-found",
+      detail: resource === undefined ? "no such resource in this project" : "the resource has no body yet"
+    };
+  }
+
+  let candidate: unknown;
+  if (leader.target === "document") {
+    candidate = { resource: "document", ...leader.body };
+  } else if (asked.slideId === undefined) {
+    candidate = { resource: "slides", ...leader.body };
+  } else {
+    const slide = deckOfSlide(leader.body, asked.slideId);
+    if (slide === undefined) {
+      return {
+        accepted: false,
+        resourceId: asked.resourceId,
+        reason: "not-found",
+        detail: "the deck has no such slide"
+      };
+    }
+    candidate = { resource: "slides", ...slide };
+  }
+
+  const portable = portableBodyOf(candidate);
+  let body: TemplateBody;
+  try {
+    body = bodyOf(portable.body, "create-template-from-resource");
+  } catch (error) {
+    return {
+      accepted: false,
+      resourceId: asked.resourceId,
+      reason: "unsupported-body",
+      detail: error instanceof Error ? error.message : String(error)
+    };
+  }
+
+  const at = Date.now();
+  const actor = { kind: "user" as const, userId: asId<"users">(scope.userId) };
+  const fields: RowFields<"templates"> = {
+    projectId: asId<"projects">(scope.projectId),
+    userId: actor.userId,
+    name: asked.name,
+    ...(asked.description === undefined ? {} : { description: asked.description }),
+    tags: [...(asked.tags ?? [])],
+    body,
+    holes: declaredFor(body, []),
+    createdBy: actor,
+    revision: 1,
+    updatedAt: at
+  };
+  const templateId = store.create("templates", fields);
+  writeTemplateVersion(store, templateId, fields, at);
+
+  return { accepted: true, templateId, target: asked.target, revision: 1, dropped: portable.dropped };
+};
~~~~

### new · `src/lib/capabilities/templates/api/create-template-from-resource/validate-create-template-from-resource.ts` (+44 / −0)

~~~~diff
@@ -0,0 +1,44 @@
+import {
+  descriptionOf,
+  fieldsOf,
+  has,
+  nameOf,
+  only,
+  resourceIdOf,
+  slideIdOf,
+  stageTargetOf,
+  tagsOf
+} from "$capabilities/templates/api/shared/validation";
+import type { CreateTemplateFromResourceInput } from "$capabilities/templates/types/templates";
+
+export const validateCreateTemplateFromResource = (
+  input: unknown
+): CreateTemplateFromResourceInput => {
+  const fields = fieldsOf(input, "create-template-from-resource");
+  only(
+    fields,
+    ["target", "resourceId", "name", "description", "tags", "slideId"],
+    "create-template-from-resource"
+  );
+  const target = stageTargetOf(fields.target, "create-template-from-resource");
+  const resourceId = resourceIdOf(fields.resourceId, "create-template-from-resource");
+  if (resourceId.startsWith(target === "document" ? "slideDecks:" : "documents:")) {
+    throw new Error(
+      `templates/create-template-from-resource: a ${target} template comes from a ${target === "document" ? "document" : "deck"}`
+    );
+  }
+  if (has(fields, "slideId") && target !== "slides") {
+    throw new Error("templates/create-template-from-resource: only a deck template names a slide");
+  }
+  const description = has(fields, "description")
+    ? descriptionOf(fields.description, "create-template-from-resource")
+    : undefined;
+  return {
+    target,
+    resourceId,
+    name: nameOf(fields.name, "create-template-from-resource"),
+    ...(description === undefined || description === "" ? {} : { description }),
+    ...(has(fields, "tags") ? { tags: tagsOf(fields.tags, "create-template-from-resource") } : {}),
+    ...(has(fields, "slideId") ? { slideId: slideIdOf(fields.slideId, "create-template-from-resource") } : {})
+  };
+};
~~~~

### changed · `src/lib/capabilities/templates/api/create-template/create-template.ts` (+2 / −1)

~~~~diff
@@ -16,12 +16,13 @@ export const createTemplate = async (input: unknown): Promise<CreateTemplateResu
   const at = Date.now();
   const actor = { kind: "user" as const, userId: asId<"users">(scope.userId) };
   const fields: RowFields<"templates"> = {
+    projectId: asId<"projects">(scope.projectId),
     userId: actor.userId,
     name: asked.name,
     ...(asked.description === undefined ? {} : { description: asked.description }),
     tags: [...(asked.tags ?? [])],
     body: emptyTemplateBody(asked.target),
-    variables: [],
+    holes: [],
     createdBy: actor,
     revision: 1,
     updatedAt: at
~~~~

### new · `src/lib/capabilities/templates/api/discard-template-stage/discard-template-stage.ts` (+31 / −0)

~~~~diff
@@ -0,0 +1,31 @@
+import { requireScope } from "$runtime/server/scope.server";
+import { serverModel } from "$runtime/server/start.server";
+
+import { validateDiscardTemplateStage } from "$capabilities/templates/api/discard-template-stage/validate-discard-template-stage";
+import { removeStage, stageById } from "$capabilities/templates/api/shared/stages";
+import type { DiscardTemplateStageResult } from "$capabilities/templates/types/templates";
+
+export const discardTemplateStage = async (input: unknown): Promise<DiscardTemplateStageResult> => {
+  const scope = await requireScope();
+  const asked = validateDiscardTemplateStage(input);
+
+  const store = serverModel().store;
+  const stage = stageById(store, asked.stageId);
+  if (stage === undefined || stage.projectId !== scope.projectId) {
+    return {
+      accepted: false,
+      stageId: asked.stageId,
+      reason: "not-found",
+      detail: "no stage in this project has that id"
+    };
+  }
+
+  removeStage(store, stage);
+  return {
+    accepted: true,
+    stageId: stage._id,
+    templateId: stage.templateId,
+    target: stage.target,
+    resourceId: stage.resourceId
+  };
+};
~~~~

### new · `src/lib/capabilities/templates/api/discard-template-stage/validate-discard-template-stage.ts` (+8 / −0)

~~~~diff
@@ -0,0 +1,8 @@
+import { fieldsOf, only, stageIdOf } from "$capabilities/templates/api/shared/validation";
+import type { DiscardTemplateStageInput } from "$capabilities/templates/types/templates";
+
+export const validateDiscardTemplateStage = (input: unknown): DiscardTemplateStageInput => {
+  const fields = fieldsOf(input, "discard-template-stage");
+  only(fields, ["stageId"], "discard-template-stage");
+  return { stageId: stageIdOf(fields.stageId, "discard-template-stage") };
+};
~~~~

### changed · `src/lib/capabilities/templates/api/duplicate-template/duplicate-template.ts` (+2 / −1)

~~~~diff
@@ -49,12 +49,13 @@ export const duplicateTemplate = async (input: unknown): Promise<DuplicateTempla
   const at = Date.now();
   const actor = { kind: "user" as const, userId: asId<"users">(scope.userId) };
   const fields: RowFields<"templates"> = {
+    projectId: asId<"projects">(scope.projectId),
     userId: actor.userId,
     name: asked.name ?? copyName(source.name),
     ...(source.description === undefined ? {} : { description: source.description }),
     tags: [...source.tags],
     body: structuredClone(source.body),
-    variables: structuredClone(source.variables),
+    holes: structuredClone(source.holes),
     createdBy: actor,
     revision: 1,
     updatedAt: at
~~~~

### changed · `src/lib/capabilities/templates/api/instantiate-template/instantiate-template.ts` (+112 / −48)

~~~~diff
@@ -3,19 +3,37 @@ import { serverModel } from "$runtime/server/start.server";
 import { asId } from "$representation/data/behavior/core/id";
 import { normalizeDocumentStyleSet } from "$representation/data/behavior/documents/typography";
 import { ensureSlideDeckReady } from "$representation/data/behavior/slide-decks/normalize";
+import {
+  fillTemplateAtoms,
+  resolveTemplateScopes
+} from "$representation/data/behavior/templates/scopes";
 import type { TemplateBody } from "$representation/data/types/templates/template";
 
 import { validateInstantiateTemplate } from "$capabilities/templates/api/instantiate-template/validate-instantiate-template";
-import {
-  materializeSpreadsheet,
-  resolveTemplateDefaults
-} from "$capabilities/templates/api/shared/bodies";
+import { materializeSpreadsheet } from "$capabilities/templates/api/shared/bodies";
 import {
   admitStoredTemplate,
   reportableRevision,
   visibleTemplate
 } from "$capabilities/templates/api/shared/projection";
-import type { InstantiateTemplateResult } from "$capabilities/templates/types/templates";
+import { normalizeScope, unknownSetsIn } from "$capabilities/templates/api/shared/scopes";
+import { kindOf } from "$capabilities/templates/api/shared/holes";
+import type {
+  InstantiateTemplateResult,
+  TemplateAnswers
+} from "$capabilities/templates/types/templates";
+
+const unknownSetsInAnswers = (
+  store: ReturnType<typeof serverModel>["store"],
+  projectId: string,
+  answers: TemplateAnswers
+): readonly string[] => {
+  const missing = new Set<string>();
+  for (const answer of Object.values(answers)) {
+    for (const id of unknownSetsIn(store, projectId, answer)) missing.add(id);
+  }
+  return [...missing].sort();
+};
 
 export const instantiateTemplate = async (input: unknown): Promise<InstantiateTemplateResult> => {
   const scope = await requireScope();
@@ -35,11 +53,11 @@ export const instantiateTemplate = async (input: unknown): Promise<InstantiateTe
   const stored = found.template;
   let template: ReturnType<typeof admitStoredTemplate>;
   let body: TemplateBody;
-  let variables;
+  let holes;
   try {
     template = admitStoredTemplate(stored);
     body = template.body;
-    variables = template.variables;
+    holes = template.holes;
   } catch (error) {
     return {
       accepted: false,
@@ -49,48 +67,110 @@ export const instantiateTemplate = async (input: unknown): Promise<InstantiateTe
       detail: error instanceof Error ? error.message : String(error)
     };
   }
-  const resolved = resolveTemplateDefaults(body, variables);
-  if (!resolved.accepted) {
-    if (resolved.reason === "unsupported-body") {
-      return {
-        accepted: false,
-        templateId: template._id,
-        reason: resolved.reason,
-        revision: template.revision,
-        detail: resolved.detail
-      };
-    }
+
+  /** A text hole untouched by the caller falls back to its own default words. */
+  const texts: Record<string, string> = { ...asked.texts };
+  for (const hole of holes) {
+    if (kindOf(hole) !== "text" || hole.text === undefined) continue;
+    if (texts[hole.name] === undefined) texts[hole.name] = hole.text;
+  }
+  const unfilled = holes
+    .filter((hole) => kindOf(hole) === "text")
+    .map((hole) => hole.name)
+    .filter((name) => texts[name] === undefined || texts[name].trim() === "");
+  if (unfilled.length > 0) {
     return {
       accepted: false,
       templateId: template._id,
-      reason: "variables-required",
+      reason: "unsupported-body",
       revision: template.revision,
-      detail: "one or more template variables need answers and have no usable default",
-      variables: resolved.variables
+      detail: `these need words before the template can be placed: ${unfilled.join(", ")}`
+    };
+  }
+
+  const answers = asked.answers ?? {};
+  const unknownSets = unknownSetsInAnswers(store, scope.projectId, answers);
+  if (unknownSets.length > 0) {
+    return {
+      accepted: false,
+      templateId: template._id,
+      reason: "unsupported-body",
+      revision: template.revision,
+      detail: `this project holds no resource set ${unknownSets.join(", ")}`
     };
   }
-  body = resolved.body;
 
   const projectId = asId<"projects">(scope.projectId);
   const actor = { kind: "user" as const, userId: asId<"users">(scope.userId) };
   const at = Date.now();
   const title = asked.name ?? template.name;
 
+  /**
+   * The resource is minted before its scopes are resolved, because an answer
+   * that excludes anything is stored as a row and that row is owned by the
+   * resource this call makes. Nothing else is written until resolution
+   * succeeds, and the rollback undoes exactly what was.
+   */
+  const table =
+    body.resource === "document" ? "documents" : body.resource === "slides" ? "slideDecks" : "spreadsheets";
+  const resourceId = store.create(table, {
+    projectId,
+    title,
+    createdBy: actor,
+    updatedBy: { ...actor },
+    updatedAt: at
+  });
+
+  const written: string[] = [];
+  const answered: Record<string, TemplateAnswers[string]> = {};
+  for (const [name, rule] of Object.entries(answers)) {
+    const term = normalizeScope(
+      store,
+      scope.projectId,
+      actor,
+      { kind: "resource", resourceId, hole: name },
+      rule,
+      at
+    );
+    if (term === undefined) continue;
+    if (term.setId !== undefined) written.push(term.setId);
+    answered[name] = term.term as TemplateAnswers[string];
+  }
+
+  const rollback = () => {
+    for (const setId of written) store.remove(`resourceSets.${setId}`);
+    store.remove(`${table}.${resourceId}`);
+  };
+
+  const resolved = resolveTemplateScopes(body, holes, answered);
+  if (!resolved.accepted) {
+    rollback();
+    return {
+      accepted: false,
+      templateId: template._id,
+      reason: resolved.reason,
+      revision: template.revision,
+      detail: resolved.detail
+    };
+  }
+  if (resolved.undeclared.length > 0) {
+    rollback();
+    return {
+      accepted: false,
+      templateId: template._id,
+      reason: "unsupported-body",
+      revision: template.revision,
+      detail: `the body names a hole the template does not declare: ${resolved.undeclared.join(", ")}`
+    };
+  }
+  body = fillTemplateAtoms(resolved.body, texts);
+  store.update(`templates.${template._id}.lastUsedAt`, at);
+
   if (body.resource === "document") {
     const { resource: _resource, ...documentBody } = body;
     const readyBody = documentBody.styles === undefined
       ? documentBody
       : { ...documentBody, styles: normalizeDocumentStyleSet(documentBody.styles) };
-    const resourceId = store.create("documents", {
-      projectId,
-      title,
-      templateId: template._id,
-      createdBy: actor,
-      // The file store requires a tree rather than a graph: two properties may
-      // not share one object reference even when JSON could stringify it.
-      updatedBy: { ...actor },
-      updatedAt: at
-    });
     store.create("documentSnapshots", {
       projectId,
       resourceId,
@@ -113,14 +193,6 @@ export const instantiateTemplate = async (input: unknown): Promise<InstantiateTe
   if (body.resource === "slides") {
     const { resource: _resource, ...slideDeckBody } = body;
     const readyBody = ensureSlideDeckReady(slideDeckBody);
-    const resourceId = store.create("slideDecks", {
-      projectId,
-      title,
-      templateId: template._id,
-      createdBy: actor,
-      updatedBy: { ...actor },
-      updatedAt: at
-    });
     store.create("slideDeckSnapshots", {
       projectId,
       resourceId,
@@ -141,14 +213,6 @@ export const instantiateTemplate = async (input: unknown): Promise<InstantiateTe
   }
 
   const materialized = materializeSpreadsheet(body);
-  const resourceId = store.create("spreadsheets", {
-    projectId,
-    title,
-    templateId: template._id,
-    createdBy: actor,
-    updatedBy: { ...actor },
-    updatedAt: at
-  });
   store.create("spreadsheetSnapshots", {
     projectId,
     resourceId,
~~~~

### changed · `src/lib/capabilities/templates/api/instantiate-template/validate-instantiate-template.ts` (+8 / −3)

~~~~diff
@@ -1,17 +1,22 @@
 import {
+  answersOf,
   fieldsOf,
+  has,
   only,
   optionalNameOf,
-  templateIdOf
+  templateIdOf,
+  textsOf
 } from "$capabilities/templates/api/shared/validation";
 import type { InstantiateTemplateInput } from "$capabilities/templates/types/templates";
 
 export const validateInstantiateTemplate = (input: unknown): InstantiateTemplateInput => {
   const fields = fieldsOf(input, "instantiate-template");
-  only(fields, ["templateId", "name"], "instantiate-template");
+  only(fields, ["templateId", "name", "answers", "texts"], "instantiate-template");
   const name = optionalNameOf(fields.name, "instantiate-template");
   return {
     templateId: templateIdOf(fields.templateId, "instantiate-template"),
-    ...(name === undefined ? {} : { name })
+    ...(name === undefined ? {} : { name }),
+    ...(has(fields, "answers") ? { answers: answersOf(fields.answers, "instantiate-template") } : {}),
+    ...(has(fields, "texts") ? { texts: textsOf(fields.texts, "instantiate-template") } : {})
   };
 };
~~~~

### new · `src/lib/capabilities/templates/api/open-template-stage/open-template-stage.ts` (+115 / −0)

~~~~diff
@@ -0,0 +1,115 @@
+import { requireScope } from "$runtime/server/scope.server";
+import { serverModel } from "$runtime/server/start.server";
+import { asId } from "$representation/data/behavior/core/id";
+
+import { validateOpenTemplateStage } from "$capabilities/templates/api/open-template-stage/validate-open-template-stage";
+import {
+  admitStoredTemplate,
+  reportableRevision,
+  visibleTemplate
+} from "$capabilities/templates/api/shared/projection";
+import { stageOf, stageTitleOf } from "$capabilities/templates/api/shared/stages";
+import type { OpenTemplateStageResult } from "$capabilities/templates/types/templates";
+
+export const openTemplateStage = async (input: unknown): Promise<OpenTemplateStageResult> => {
+  const scope = await requireScope();
+  const asked = validateOpenTemplateStage(input);
+
+  const store = serverModel().store;
+  const found = visibleTemplate(store, scope, asked.templateId);
+  if (found.kind !== "found") {
+    return {
+      accepted: false,
+      templateId: asked.templateId,
+      reason: found.kind === "missing" ? "not-found" : "unsupported-body",
+      revision: null,
+      detail: found.kind === "missing" ? "no visible template has that id" : found.detail
+    };
+  }
+  let template: ReturnType<typeof admitStoredTemplate>;
+  try {
+    template = admitStoredTemplate(found.template);
+  } catch (error) {
+    return {
+      accepted: false,
+      templateId: asked.templateId,
+      reason: "unsupported-body",
+      revision: reportableRevision(found.template.revision),
+      detail: error instanceof Error ? error.message : String(error)
+    };
+  }
+  const body = template.body;
+  if (body.resource === "spreadsheet") {
+    return {
+      accepted: false,
+      templateId: template._id,
+      reason: "unsupported-body",
+      revision: template.revision,
+      detail: "a spreadsheet template opens for editing once the spreadsheet editor lands"
+    };
+  }
+
+  const held = stageOf(store, scope.projectId, template._id);
+  if (held !== undefined) {
+    return {
+      accepted: true,
+      stageId: held._id,
+      templateId: template._id,
+      templateRevision: held.templateRevision,
+      target: held.target,
+      resourceId: held.resourceId,
+      reused: true
+    };
+  }
+
+  const projectId = asId<"projects">(scope.projectId);
+  const actor = { kind: "user" as const, userId: asId<"users">(scope.userId) };
+  const at = Date.now();
+  const title = stageTitleOf(template.name);
+  const { resource: target, ...stageBody } = body;
+
+  const resourceId =
+    target === "document"
+      ? store.create("documents", {
+          projectId,
+          title,
+          createdBy: actor,
+          updatedBy: { ...actor },
+          updatedAt: at
+        })
+      : store.create("slideDecks", {
+          projectId,
+          title,
+          createdBy: actor,
+          updatedBy: { ...actor },
+          updatedAt: at
+        });
+  store.create(target === "document" ? "documentSnapshots" : "slideDeckSnapshots", {
+    projectId,
+    resourceId,
+    revision: 0,
+    role: "leader",
+    part: 0,
+    body: stageBody,
+    at
+  });
+  const stageId = store.create("templateStages", {
+    projectId,
+    templateId: template._id,
+    templateRevision: template.revision,
+    target,
+    resourceId,
+    createdBy: { ...actor },
+    updatedAt: at
+  });
+
+  return {
+    accepted: true,
+    stageId,
+    templateId: template._id,
+    templateRevision: template.revision,
+    target,
+    resourceId,
+    reused: false
+  };
+};
~~~~

### new · `src/lib/capabilities/templates/api/open-template-stage/validate-open-template-stage.ts` (+8 / −0)

~~~~diff
@@ -0,0 +1,8 @@
+import { fieldsOf, only, templateIdOf } from "$capabilities/templates/api/shared/validation";
+import type { OpenTemplateStageInput } from "$capabilities/templates/types/templates";
+
+export const validateOpenTemplateStage = (input: unknown): OpenTemplateStageInput => {
+  const fields = fieldsOf(input, "open-template-stage");
+  only(fields, ["templateId"], "open-template-stage");
+  return { templateId: templateIdOf(fields.templateId, "open-template-stage") };
+};
~~~~

### new · `src/lib/capabilities/templates/api/read-resource-template/read-resource-template.ts` (+48 / −0)

~~~~diff
@@ -0,0 +1,48 @@
+import { requireScope } from "$runtime/server/scope.server";
+import { serverModel } from "$runtime/server/start.server";
+
+import { validateReadResourceTemplate } from "$capabilities/templates/api/read-resource-template/validate-read-resource-template";
+import { admitStoredTemplate, visibleTemplate } from "$capabilities/templates/api/shared/projection";
+import { resourceTableOfId, stageOfResource } from "$capabilities/templates/api/shared/stages";
+import { recordsIn } from "$capabilities/templates/api/shared/store";
+import type { ReadResourceTemplateResult } from "$capabilities/templates/types/templates";
+
+export const readResourceTemplate = async (input: unknown): Promise<ReadResourceTemplateResult> => {
+  const scope = await requireScope();
+  const asked = validateReadResourceTemplate(input);
+
+  const store = serverModel().store;
+  const table = resourceTableOfId(asked.resourceId);
+  const resource =
+    table === undefined
+      ? undefined
+      : recordsIn(store, table).find(
+          (row) => row._id === asked.resourceId && row.projectId === scope.projectId
+        );
+  if (resource === undefined) return { resourceId: asked.resourceId, stage: null };
+
+  const held = stageOfResource(store, scope.projectId, asked.resourceId);
+  if (held === undefined) return { resourceId: asked.resourceId, stage: null };
+
+  const found = visibleTemplate(store, scope, held.templateId);
+  let template: ReturnType<typeof admitStoredTemplate> | undefined;
+  if (found.kind === "found") {
+    try {
+      template = admitStoredTemplate(found.template);
+    } catch {
+      template = undefined;
+    }
+  }
+
+  return {
+    resourceId: asked.resourceId,
+    stage: {
+      stageId: held._id,
+      templateId: held.templateId,
+      templateName: template?.name ?? "Unavailable template",
+      target: held.target,
+      stagedRevision: held.templateRevision,
+      currentRevision: template?.revision ?? null
+    }
+  };
+};
~~~~

### new · `src/lib/capabilities/templates/api/read-resource-template/validate-read-resource-template.ts` (+8 / −0)

~~~~diff
@@ -0,0 +1,8 @@
+import { fieldsOf, only, resourceIdOf } from "$capabilities/templates/api/shared/validation";
+import type { ReadResourceTemplateInput } from "$capabilities/templates/types/templates";
+
+export const validateReadResourceTemplate = (input: unknown): ReadResourceTemplateInput => {
+  const fields = fieldsOf(input, "read-resource-template");
+  only(fields, ["resourceId"], "read-resource-template");
+  return { resourceId: resourceIdOf(fields.resourceId, "read-resource-template") };
+};
~~~~

### changed · `src/lib/capabilities/templates/api/remove-template/remove-template.ts` (+10 / −68)

~~~~diff
@@ -7,6 +7,8 @@ import {
   reportableRevision,
   visibleTemplate
 } from "$capabilities/templates/api/shared/projection";
+import { removeRowsBoundTo } from "$capabilities/templates/api/shared/scopes";
+import { removeStage, stagesIn } from "$capabilities/templates/api/shared/stages";
 import {
   canonicalRowId,
   recordsIn
@@ -30,15 +32,6 @@ export const removeTemplate = async (input: unknown): Promise<RemoveTemplateResu
     };
   }
   const stored = found.template;
-  if (stored.userId !== scope.userId) {
-    return {
-      accepted: false,
-      templateId: asked.templateId,
-      reason: "forbidden",
-      revision: reportableRevision(stored.revision),
-      detail: "only the template owner can delete it"
-    };
-  }
   if (stored.revision !== asked.baseRevision) {
     return {
       accepted: false,
@@ -62,59 +55,7 @@ export const removeTemplate = async (input: unknown): Promise<RemoveTemplateResu
     };
   }
 
-  // Resolve and validate every affected id before the first write. A corrupt
-  // version or provenance row must not be discovered after resources have
-  // already been detached from the template.
-  const resourceTables = ["documents", "slideDecks", "spreadsheets"] as const;
-  const detach = new Map<(typeof resourceTables)[number], readonly string[]>();
-  for (const table of resourceTables) {
-    const resources = recordsIn(store, table);
-    const claimants = new Map<string, number>();
-    for (const resource of resources) {
-      const id = canonicalRowId(resource._id, table);
-      if (id !== undefined) claimants.set(id, (claimants.get(id) ?? 0) + 1);
-    }
-    const ids: string[] = [];
-    for (const resource of resources) {
-      if (resource.templateId !== template._id) continue;
-      const id = canonicalRowId(resource._id, table);
-      if (
-        id === undefined ||
-        typeof resource.projectId !== "string" ||
-        resource.projectId !== resource.projectId.trim() ||
-        resource.projectId.length === 0 ||
-        resource.projectId.length > 500
-      ) {
-        return {
-          accepted: false,
-          templateId: template._id,
-          reason: "unsupported-body",
-          revision: template.revision,
-          detail: `a ${table} provenance row is corrupt`
-        };
-      }
-      if (claimants.get(id) !== 1) {
-        return {
-          accepted: false,
-          templateId: template._id,
-          reason: "unsupported-body",
-          revision: template.revision,
-          detail: `a ${table} provenance id is ambiguous`
-        };
-      }
-      if (resource.projectId !== scope.projectId) {
-        return {
-          accepted: false,
-          templateId: template._id,
-          reason: "in-use-elsewhere",
-          revision: template.revision,
-          detail: "this template is referenced outside the current project and cannot be deleted here"
-        };
-      }
-      ids.push(id);
-    }
-    detach.set(table, ids);
-  }
+  const stages = stagesIn(store).filter((stage) => stage.templateId === template._id);
 
   const versions = recordsIn(store, "templateVersions");
   const versionClaimants = new Map<string, number>();
@@ -147,12 +88,13 @@ export const removeTemplate = async (input: unknown): Promise<RemoveTemplateResu
     versionIds.push(id);
   }
 
-  for (const table of resourceTables) {
-    store.removeFieldFromRows(
-      table,
-      (detach.get(table) ?? []).map((id) => asId<typeof table>(id)),
-      "templateId"
-    );
+  for (const stage of stages) removeStage(store, stage);
+  for (const hole of template.holes) {
+    removeRowsBoundTo(store, scope.projectId, {
+      kind: "hole",
+      templateId: template._id,
+      hole: hole.name
+    });
   }
   store.removeRows(
     "templateVersions",
~~~~

### changed · `src/lib/capabilities/templates/api/shared/bodies.ts` (+17 / −171)

~~~~diff
@@ -1,14 +1,9 @@
 import type { VariableValue } from "$representation/data/types/content/variable-value";
 import type { CellRef } from "$representation/data/types/content/formula-value";
-import type {
-  TemplatedResourceSet,
-  TemplatedTerm
-} from "$representation/data/types/core/resource-set";
 import type { SpreadsheetBody } from "$representation/data/types/spreadsheets/body";
 import type {
   SpreadsheetTemplate,
-  TemplateBody,
-  TemplateVariable
+  TemplateBody
 } from "$representation/data/types/templates/template";
 
 import type { RowFields } from "$capabilities/templates/api/shared/store";
@@ -27,26 +22,24 @@ const defaultStyles = {
   }
 };
 
+const emptyDeck = () => ({
+  aspectRatio: "16:9" as const,
+  theme: {
+    colors: {
+      text: "--token-ink-primary",
+      accent: "--token-color-accent-1-fill",
+      muted: "--token-ink-muted"
+    },
+    fontFamily: "IBM Plex Sans"
+  },
+  styles: defaultStyles,
+  layouts: [],
+  sections: []
+});
+
 export const emptyTemplateBody = (target: TemplateTarget): TemplateBody => {
   if (target === "document") return { resource: "document", rows: [] };
-  if (target === "slides") {
-    return {
-      resource: "slides",
-      aspectRatio: "16:9",
-      theme: {
-        colors: {
-          text: "--token-ink-primary",
-          accent: "--token-color-accent-1-fill",
-          muted: "--token-ink-muted"
-        },
-        fontFamily: "IBM Plex Sans"
-      },
-      styles: defaultStyles,
-      layouts: [],
-      slides: [],
-      sections: []
-    };
-  }
+  if (target === "slides") return { resource: "slides", ...emptyDeck(), slides: [] };
   return {
     resource: "spreadsheet",
     cells: {},
@@ -56,153 +49,6 @@ export const emptyTemplateBody = (target: TemplateTarget): TemplateBody => {
   };
 };
 
-type ResolvedTerm = Exclude<TemplatedTerm, { select: "variable" }>;
-type ResolvedSet = {
-  readonly include: readonly ResolvedTerm[];
-  readonly exclude: readonly ResolvedTerm[];
-};
-type ExpandedTerms = {
-  readonly same: readonly ResolvedTerm[];
-  readonly opposite: readonly ResolvedTerm[];
-};
-
-const MAX_RESOLVED_TEMPLATE_TERMS = 10_000;
-const TEMPLATE_DEFAULT_OVERFLOW = "template-default-resolution-overflow";
-const TEMPLATE_DEFAULT_DIFFERENCE = "template-default-difference-is-not-flattenable";
-
-/** Every stored occurrence owns its nested arrays; the file store rejects shared references. */
-const cloneResolvedTerm = (term: ResolvedTerm): ResolvedTerm =>
-  term.select === "kinds" ? { ...term, kinds: [...term.kinds] } : { ...term };
-
-const cloneResolvedSet = (set: ResolvedSet): ResolvedSet => ({
-  include: set.include.map(cloneResolvedTerm),
-  exclude: set.exclude.map(cloneResolvedTerm)
-});
-
-type ResolvedDefaults =
-  | { readonly accepted: true; readonly body: TemplateBody }
-  | {
-      readonly accepted: false;
-      readonly reason: "variables-required";
-      readonly variables: readonly string[];
-    }
-  | {
-      readonly accepted: false;
-      readonly reason: "unsupported-body";
-      readonly detail: string;
-    };
-
-/**
- * Fills represented variable holes from represented defaults. There is no
- * caller-supplied answer shape yet, so an unbound hole is returned explicitly.
- */
-export const resolveTemplateDefaults = (
-  body: TemplateBody,
-  variables: readonly TemplateVariable[]
-): ResolvedDefaults => {
-  const definitions = new Map(variables.map((variable) => [variable.name, variable]));
-  const memo = new Map<string, ResolvedSet>();
-  const missing = new Set<string>();
-  let emittedTerms = 0;
-
-  const append = (target: ResolvedTerm[], terms: readonly ResolvedTerm[]): void => {
-    for (const term of terms) {
-      emittedTerms += 1;
-      if (emittedTerms > MAX_RESOLVED_TEMPLATE_TERMS) {
-        throw new RangeError(TEMPLATE_DEFAULT_OVERFLOW);
-      }
-      target.push(cloneResolvedTerm(term));
-    }
-  };
-
-  let resolveSet: (set: TemplatedResourceSet, stack?: readonly string[]) => ResolvedSet;
-
-  const expandTerms = (
-    terms: readonly TemplatedTerm[],
-    stack: readonly string[]
-  ): ExpandedTerms => {
-    const same: ResolvedTerm[] = [];
-    const opposite: ResolvedTerm[] = [];
-    for (const term of terms) {
-      if (term.select !== "variable") {
-        append(same, [term]);
-        continue;
-      }
-      const definition = definitions.get(term.name);
-      if (definition?.default === undefined || stack.includes(term.name)) {
-        missing.add(term.name);
-        continue;
-      }
-      if (definition.default.exclude.length > 0) {
-        throw new Error(TEMPLATE_DEFAULT_DIFFERENCE);
-      }
-      const cached = memo.get(term.name);
-      const resolved =
-        cached === undefined
-          ? resolveSet(definition.default, [...stack, term.name])
-          : cloneResolvedSet(cached);
-      if (cached === undefined) memo.set(term.name, cloneResolvedSet(resolved));
-      append(same, resolved.include);
-      append(opposite, resolved.exclude);
-    }
-    return { same, opposite };
-  };
-
-  resolveSet = (
-    set: TemplatedResourceSet,
-    stack: readonly string[] = []
-  ): ResolvedSet => {
-    const included = expandTerms(set.include, stack);
-    const excluded = expandTerms(set.exclude, stack);
-    const include: ResolvedTerm[] = [];
-    const exclude: ResolvedTerm[] = [];
-    append(include, included.same);
-    append(include, excluded.opposite);
-    append(exclude, included.opposite);
-    append(exclude, excluded.same);
-    return { include, exclude };
-  };
-
-  const walk = (value: unknown): unknown => {
-    if (Array.isArray(value)) return value.map(walk);
-    if (value === null || typeof value !== "object") return value;
-    const fields = value as Record<string, unknown>;
-    return Object.fromEntries(
-      Object.entries(fields).map(([field, nested]) => [
-        field,
-        fields.type === "prompt" && field === "scope" && nested !== undefined
-          ? resolveSet(nested as TemplatedResourceSet)
-          : walk(nested)
-      ])
-    );
-  };
-
-  try {
-    const resolved = walk(body) as TemplateBody;
-    return missing.size === 0
-      ? { accepted: true, body: resolved }
-      : {
-          accepted: false,
-          reason: "variables-required",
-          variables: [...missing].sort()
-        };
-  } catch (error) {
-    if (error instanceof Error && error.message === TEMPLATE_DEFAULT_DIFFERENCE) {
-      return {
-        accepted: false,
-        reason: "unsupported-body",
-        detail: "a variable default with exclusions cannot be flattened without changing scope"
-      };
-    }
-    if (!(error instanceof RangeError) || error.message !== TEMPLATE_DEFAULT_OVERFLOW) throw error;
-    return {
-      accepted: false,
-      reason: "unsupported-body",
-      detail: `template defaults expand beyond ${MAX_RESOLVED_TEMPLATE_TERMS} terms`
-    };
-  }
-};
-
 type MaterializedCell = Omit<RowFields<"sheetCells">, "projectId" | "resourceId">;
 
 export type MaterializedSpreadsheet = {
~~~~

### new · `src/lib/capabilities/templates/api/shared/holes.ts` (+39 / −0)

~~~~diff
@@ -0,0 +1,39 @@
+import {
+  scopeHoleNamesIn,
+  templateAtomNamesIn
+} from "$representation/data/behavior/templates/scopes";
+import type { TemplateBody, TemplateHole } from "$representation/data/types/templates/template";
+
+/**
+ * The holes a body asks for, found rather than authored.
+ *
+ * A prompt's scope naming one makes it a `scope` hole, answered with a group of
+ * resources and defaulting to the whole project. A template atom in the prose
+ * makes it a `text` one, answered with words and defaulting to nothing, which is
+ * why placing a template has to ask for it.
+ *
+ * A name used both ways is a scope, because a scope always has an answer and
+ * text never does: taking the other side would leave a template that cannot be
+ * placed until somebody types into a hole they cannot see.
+ */
+export const declaredFor = (
+  body: TemplateBody,
+  known: readonly TemplateHole[]
+): TemplateHole[] => {
+  const declared = new Set(known.map((hole) => hole.name));
+  const scopes = scopeHoleNamesIn(body);
+  const asScope = new Set(scopes);
+  const texts = templateAtomNamesIn(body).filter((name) => !asScope.has(name));
+
+  return [
+    ...known,
+    ...scopes.filter((name) => !declared.has(name)).map((name) => ({ name, label: name })),
+    ...texts
+      .filter((name) => !declared.has(name))
+      .map((name) => ({ name, label: name, kind: "text" as const }))
+  ];
+};
+
+/** What a hole is answered with, treating an older one with no kind as a scope. */
+export const kindOf = (hole: TemplateHole): "scope" | "text" =>
+  hole.kind === "text" ? "text" : "scope";
~~~~

### changed · `src/lib/capabilities/templates/api/shared/projection.ts` (+32 / −49)

~~~~diff
@@ -2,6 +2,7 @@ import type { StoreModel, TableRow } from "$model/server/store/index.server";
 import type { Scope } from "$runtime/server/scope.server";
 import type { Actor } from "$representation/data/types/core/actor";
 
+import { expandedScope } from "$capabilities/templates/api/shared/scopes";
 import {
   canonicalRowId,
   recordsIn
@@ -13,7 +14,7 @@ import {
   requiredId,
   tagsOf,
   templateIdOf,
-  variablesOf
+  holesOf
 } from "$capabilities/templates/api/shared/validation";
 import type {
   TemplateDetail,
@@ -74,10 +75,10 @@ const actorOf = (value: unknown, subject: string): Actor => {
   throw new Error(`templates/${subject}: createdBy is a represented actor`);
 };
 
-/** Admit an existing row before any projection or mutation trusts its typed claim. */
 export const admitStoredTemplate = (template: Template): Template => {
   const subject = `stored-${template._id}`;
   templateIdOf(template._id, subject);
+  requiredId(template.projectId, subject, "project id");
   requiredId(template.userId, subject, "owner id");
   if (!Number.isFinite(template._creationTime) || template._creationTime < 0) {
     throw new Error(`templates/${subject}: creation time is finite`);
@@ -88,6 +89,12 @@ export const admitStoredTemplate = (template: Template): Template => {
   if (!Number.isFinite(template.updatedAt) || template.updatedAt < 0) {
     throw new Error(`templates/${subject}: updated time is finite`);
   }
+  if (
+    template.lastUsedAt !== undefined &&
+    (!Number.isFinite(template.lastUsedAt) || template.lastUsedAt < 0)
+  ) {
+    throw new Error(`templates/${subject}: last use time is finite`);
+  }
 
   const name = nameOf(template.name, subject);
   const description =
@@ -96,7 +103,7 @@ export const admitStoredTemplate = (template: Template): Template => {
       : descriptionOf(template.description, subject);
   const tags = tagsOf(template.tags, subject);
   const body = bodyOf(template.body, subject);
-  const variables = variablesOf(template.variables, subject);
+  const holes = holesOf(template.holes, subject);
   const createdBy = actorOf(template.createdBy, subject);
   const { description: _description, ...withoutDescription } = template;
   return {
@@ -105,7 +112,7 @@ export const admitStoredTemplate = (template: Template): Template => {
     ...(description === undefined ? {} : { description }),
     tags: [...tags],
     body,
-    variables: [...variables],
+    holes: [...holes],
     createdBy
   };
 };
@@ -116,7 +123,7 @@ export const visibleTemplate = (
   templateId: string
 ): TemplateLookup => {
   const matching = recordsIn(store, "templates").filter((row) => row._id === templateId);
-  const visible = matching.filter((row) => row.userId === scope.userId);
+  const visible = matching.filter((row) => row.projectId === scope.projectId);
   if (visible.length === 0) return { kind: "missing" };
   if (matching.length !== 1 || visible.length !== 1) {
     return {
@@ -168,30 +175,6 @@ const actorName = (store: StoreModel, scope: Scope, actor: Actor): string => {
   return title === undefined ? "An agent" : `Agent · ${title}`;
 };
 
-const usesByTemplate = (store: StoreModel, projectId: string): ReadonlyMap<string, number> => {
-  const uses = new Map<string, number>();
-  const collect = (rows: readonly Record<string, unknown>[]) => {
-    for (const row of rows) {
-      if (
-        row.projectId !== projectId ||
-        typeof row.templateId !== "string" ||
-        !/^templates:[^.\s:]+$/.test(row.templateId) ||
-        typeof row._creationTime !== "number" ||
-        !Number.isFinite(row._creationTime) ||
-        row._creationTime < 0
-      ) {
-        continue;
-      }
-      uses.set(row.templateId, Math.max(uses.get(row.templateId) ?? 0, row._creationTime));
-    }
-  };
-
-  collect(recordsIn(store, "documents"));
-  collect(recordsIn(store, "slideDecks"));
-  collect(recordsIn(store, "spreadsheets"));
-  return uses;
-};
-
 export const projectLibrary = (
   store: StoreModel,
   scope: Scope
@@ -199,7 +182,6 @@ export const projectLibrary = (
   readonly templates: readonly TemplateLibraryItem[];
   readonly unavailable: readonly TemplateUnavailable[];
 } => {
-  const uses = usesByTemplate(store, scope.projectId);
   const templates: TemplateLibraryItem[] = [];
   const unavailable: TemplateUnavailable[] = [];
   const rows = recordsIn(store, "templates");
@@ -208,7 +190,7 @@ export const projectLibrary = (
     const id = canonicalRowId(row._id, "templates");
     if (id !== undefined) idCounts.set(id, (idCounts.get(id) ?? 0) + 1);
   }
-  const visible = rows.filter((row) => row.userId === scope.userId);
+  const visible = rows.filter((row) => row.projectId === scope.projectId);
   for (const [index, row] of visible.entries()) {
     const id = canonicalRowId(row._id, "templates");
     const reportId =
@@ -227,7 +209,7 @@ export const projectLibrary = (
     try {
       const stored = row as unknown as Template;
       const template = admitStoredTemplate(stored);
-      templates.push(itemOf(store, scope, template, uses.get(template._id) ?? null));
+      templates.push(itemOf(store, scope, template));
     } catch (error) {
       unavailable.push({
         unavailable: true,
@@ -243,24 +225,19 @@ export const projectLibrary = (
   return { templates, unavailable };
 };
 
-const itemOf = (
-  store: StoreModel,
-  scope: Scope,
-  template: Template,
-  lastUsedAt: number | null = null
-): TemplateLibraryItem => {
+const itemOf = (store: StoreModel, scope: Scope, template: Template): TemplateLibraryItem => {
   return {
     id: template._id,
     name: template.name,
     ...(template.description === undefined ? {} : { description: template.description }),
     target: template.body.resource,
-    availability: "personal",
+    availability: "project",
     tags: template.tags,
-    variableCount: template.variables.length,
+    holeCount: template.holes.length,
     createdByName: actorName(store, scope, template.createdBy),
     revision: template.revision,
     updatedAt: template.updatedAt,
-    lastUsedAt,
+    lastUsedAt: template.lastUsedAt ?? null,
     canEdit: true,
     canDelete: true
   };
@@ -272,12 +249,18 @@ export const detailOf = (
   template: Template
 ): TemplateDetail => {
   const admitted = admitStoredTemplate(template);
-  const lastUsedAt = usesByTemplate(store, scope.projectId).get(template._id) ?? null;
-  const { variableCount: _variableCount, ...item } = itemOf(
-    store,
-    scope,
-    admitted,
-    lastUsedAt
-  );
-  return { ...item, body: admitted.body, variables: admitted.variables };
+  const { holeCount: _holeCount, ...item } = itemOf(store, scope, admitted);
+  return {
+    ...item,
+    body: admitted.body,
+    /**
+     * A default naming a bound row is read back as the rule it holds, because
+     * that row is the hole's value rather than a set anyone chose. A named set
+     * stays a named set.
+     */
+    holes: admitted.holes.map((hole) => {
+      const expanded = expandedScope(store, scope.projectId, hole.default);
+      return expanded === undefined ? hole : { ...hole, default: expanded };
+    })
+  };
 };
~~~~

### new · `src/lib/capabilities/templates/api/shared/scopes.ts` (+204 / −0)

~~~~diff
@@ -0,0 +1,204 @@
+import type { StoreModel } from "$model/server/store/index.server";
+import { asId } from "$representation/data/behavior/core/id";
+import { needsRow, ruleWords } from "$representation/data/behavior/core/scope-draft";
+import type { Actor } from "$representation/data/types/core/actor";
+import type {
+  BoundTo,
+  ResourceSet,
+  TemplatedResourceSet
+} from "$representation/data/types/core/resource-set";
+
+import { recordsIn } from "$capabilities/templates/api/shared/store";
+
+/**
+ * A chosen rule becomes a term, and a row only when it has to.
+ *
+ * Four surfaces choose a scope: a hole's default from either editor's panel or
+ * from the library inspector, and an answer given while placing a template.
+ * All four send the rule they built and none of them writes anything, because
+ * the normalisation is the same every time and a client-side write would put a
+ * second round trip in front of a save that can then half-fail.
+ *
+ * **A rule that excludes anything, or names particular resources, is stored.**
+ * Resolving a template substitutes a hole term for what fills it, and a hole
+ * term may sit on either side of a prompt's scope. One term for one term works
+ * on both sides; one term for a difference does not. So the difference lives
+ * inside a row and what points at it is a single `set` term. Everything else is
+ * said inline, which is the common case.
+ */
+
+export type ScopeOwner = BoundTo;
+
+const named = (store: StoreModel, projectId: string): ReadonlySet<string> =>
+  new Set(
+    recordsIn(store, "resourceSets")
+      .filter(
+        (row) => row.projectId === projectId && typeof row._id === "string" && row.name !== undefined
+      )
+      .map((row) => row._id as string)
+  );
+
+const sameOwner = (held: unknown, owner: ScopeOwner): boolean => {
+  if (held === null || typeof held !== "object") return false;
+  const record = held as Record<string, unknown>;
+  if (owner.kind === "hole") {
+    return (
+      record.kind === "hole" &&
+      record.templateId === owner.templateId &&
+      record.hole === owner.hole
+    );
+  }
+  return (
+    record.kind === "resource" &&
+    record.resourceId === owner.resourceId &&
+    record.hole === owner.hole
+  );
+};
+
+/** Every row bound to one resource, whichever hole it answered. */
+export const rowsOfResource = (
+  store: StoreModel,
+  projectId: string,
+  resourceId: string
+): readonly string[] =>
+  recordsIn(store, "resourceSets")
+    .filter((row) => {
+      if (row.projectId !== projectId || typeof row._id !== "string") return false;
+      const held = row.boundTo;
+      return (
+        held !== null &&
+        typeof held === "object" &&
+        (held as Record<string, unknown>).kind === "resource" &&
+        (held as Record<string, unknown>).resourceId === resourceId
+      );
+    })
+    .map((row) => row._id as string);
+
+/** The bound rows an owner holds, newest last, so a rewrite can reuse the first. */
+export const rowsBoundTo = (
+  store: StoreModel,
+  projectId: string,
+  owner: ScopeOwner
+): readonly string[] =>
+  recordsIn(store, "resourceSets")
+    .filter(
+      (row) =>
+        row.projectId === projectId &&
+        typeof row._id === "string" &&
+        sameOwner(row.boundTo, owner)
+    )
+    .map((row) => row._id as string);
+
+export const removeRowsBoundTo = (
+  store: StoreModel,
+  projectId: string,
+  owner: ScopeOwner
+): number => {
+  const held = rowsBoundTo(store, projectId, owner);
+  for (const setId of held) store.remove(`resourceSets.${setId}`);
+  return held.length;
+};
+
+/** Every set term in a rule that the project does not hold. */
+export const unknownSetsIn = (
+  store: StoreModel,
+  projectId: string,
+  scope: { include: readonly { select: string }[]; exclude: readonly { select: string }[] }
+): readonly string[] => {
+  const held = new Set(
+    recordsIn(store, "resourceSets")
+      .filter((row) => row.projectId === projectId && typeof row._id === "string")
+      .map((row) => row._id as string)
+  );
+  const missing: string[] = [];
+  for (const term of [...scope.include, ...scope.exclude]) {
+    const setId = (term as { setId?: unknown }).setId;
+    if (term.select !== "set" || typeof setId !== "string") continue;
+    if (!held.has(setId) && !missing.includes(setId)) missing.push(setId);
+  }
+  return missing;
+};
+
+type Written = { readonly term: TemplatedResourceSet; readonly setId?: string };
+
+/**
+ * The rule as a templated set, writing or rewriting the owner's row when the
+ * rule cannot be said inline, and clearing the row when it can.
+ */
+export const normalizeScope = (
+  store: StoreModel,
+  projectId: string,
+  actor: Actor,
+  owner: ScopeOwner,
+  rule: ResourceSet | TemplatedResourceSet | undefined,
+  at: number
+): Written | undefined => {
+  if (rule === undefined) {
+    removeRowsBoundTo(store, projectId, owner);
+    return undefined;
+  }
+
+  const held = rowsBoundTo(store, projectId, owner);
+
+  if (!needsRow(rule)) {
+    for (const setId of held) store.remove(`resourceSets.${setId}`);
+    return { term: rule as TemplatedResourceSet };
+  }
+
+  const [first, ...extra] = held;
+  for (const setId of extra) store.remove(`resourceSets.${setId}`);
+
+  if (first !== undefined) {
+    const row = recordsIn(store, "resourceSets").find((candidate) => candidate._id === first);
+    const revision = typeof row?.revision === "number" ? row.revision : 1;
+    store.update(`resourceSets.${first}.set`, rule);
+    store.update(`resourceSets.${first}.revision`, revision + 1);
+    store.update(`resourceSets.${first}.updatedAt`, at);
+    return {
+      term: { include: [{ select: "set", setId: asId<"resourceSets">(first) }], exclude: [] },
+      setId: first
+    };
+  }
+
+  const setId = store.create("resourceSets", {
+    projectId: asId<"projects">(projectId),
+    boundTo: owner,
+    set: rule as ResourceSet,
+    createdBy: actor,
+    revision: 1,
+    updatedAt: at
+  });
+  return {
+    term: { include: [{ select: "set", setId: asId<"resourceSets">(setId) }], exclude: [] },
+    setId
+  };
+};
+
+/**
+ * A stored default read back as the rule somebody built.
+ *
+ * A term naming a bound row is expanded, because that row is this hole's value
+ * rather than a set anyone chose. A term naming one of the project's own
+ * sets is left alone, because choosing it was the point.
+ */
+export const expandedScope = (
+  store: StoreModel,
+  projectId: string,
+  scope: TemplatedResourceSet | undefined
+): TemplatedResourceSet | undefined => {
+  if (scope === undefined) return undefined;
+  if (scope.exclude.length > 0 || scope.include.length !== 1) return scope;
+  const term = scope.include[0];
+  if (term.select !== "set" || named(store, projectId).has(term.setId)) return scope;
+  const row = recordsIn(store, "resourceSets").find(
+    (candidate) => candidate._id === term.setId && candidate.projectId === projectId
+  );
+  const rule = row?.set;
+  if (rule === null || typeof rule !== "object" || Array.isArray(rule)) return scope;
+  const held = rule as { include?: unknown; exclude?: unknown };
+  if (!Array.isArray(held.include) || !Array.isArray(held.exclude)) return scope;
+  return held as unknown as TemplatedResourceSet;
+};
+
+/** What a rule says, for a refusal that has to name it. */
+export const scopeWords = (scope: TemplatedResourceSet | ResourceSet): string => ruleWords(scope);
~~~~

### new · `src/lib/capabilities/templates/api/shared/stages.ts` (+141 / −0)

~~~~diff
@@ -0,0 +1,141 @@
+import type { StoreModel, TableName, TableRow } from "$model/server/store/index.server";
+import { asId } from "$representation/data/behavior/core/id";
+import type { Id } from "$representation/data/types/core/id";
+import type { DocumentBody } from "$representation/data/types/documents/body";
+import type { SlideDeckBody } from "$representation/data/types/slide-decks/body";
+
+import { rowsOfResource } from "$capabilities/templates/api/shared/scopes";
+import { canonicalRowId, recordsIn } from "$capabilities/templates/api/shared/store";
+import type { TemplateStageTarget } from "$capabilities/templates/types/templates";
+
+export type Stage = TableRow<"templateStages">;
+
+export type ResourceTable = "documents" | "slideDecks";
+
+export const stageTitleOf = (name: string): string => `Template · ${name}`.slice(0, 160);
+
+export const resourceTableOf = (target: TemplateStageTarget): ResourceTable =>
+  target === "document" ? "documents" : "slideDecks";
+
+export const resourceTableOfId = (resourceId: string): ResourceTable | undefined =>
+  resourceId.startsWith("documents:")
+    ? "documents"
+    : resourceId.startsWith("slideDecks:")
+      ? "slideDecks"
+      : undefined;
+
+const isStageTarget = (value: unknown): value is TemplateStageTarget =>
+  value === "document" || value === "slides";
+
+const admittedStage = (row: Record<string, unknown>): Stage | undefined =>
+  canonicalRowId(row._id, "templateStages") !== undefined &&
+  typeof row.projectId === "string" &&
+  typeof row.templateId === "string" &&
+  Number.isSafeInteger(row.templateRevision) &&
+  isStageTarget(row.target) &&
+  typeof row.resourceId === "string" &&
+  resourceTableOfId(row.resourceId) === resourceTableOf(row.target)
+    ? (row as unknown as Stage)
+    : undefined;
+
+export const stagesIn = (store: StoreModel): readonly Stage[] =>
+  recordsIn(store, "templateStages").flatMap((row) => {
+    const stage = admittedStage(row);
+    return stage === undefined ? [] : [stage];
+  });
+
+export const stageById = (store: StoreModel, stageId: string): Stage | undefined =>
+  stagesIn(store).find((stage) => stage._id === stageId);
+
+export const stageOf = (
+  store: StoreModel,
+  projectId: string,
+  templateId: string
+): Stage | undefined =>
+  stagesIn(store).find((stage) => stage.projectId === projectId && stage.templateId === templateId);
+
+export const stageOfResource = (
+  store: StoreModel,
+  projectId: string,
+  resourceId: string
+): Stage | undefined =>
+  stagesIn(store).find((stage) => stage.projectId === projectId && stage.resourceId === resourceId);
+
+export const stagedResourceIdsIn = (store: StoreModel, projectId: string): ReadonlySet<string> =>
+  new Set(
+    stagesIn(store)
+      .filter((stage) => stage.projectId === projectId)
+      .map((stage) => stage.resourceId)
+  );
+
+export type StageLeader =
+  | { readonly target: "document"; readonly revision: number; readonly body: DocumentBody }
+  | { readonly target: "slides"; readonly revision: number; readonly body: SlideDeckBody };
+
+export const leaderBodyOf = (
+  store: StoreModel,
+  projectId: string,
+  target: TemplateStageTarget,
+  resourceId: string
+): StageLeader | undefined => {
+  const table = target === "document" ? "documentSnapshots" : "slideDeckSnapshots";
+  const found = recordsIn(store, table).find(
+    (row) => row.projectId === projectId && row.resourceId === resourceId && row.role === "leader"
+  );
+  if (found === undefined || typeof found.revision !== "number" || found.body === null) return undefined;
+  return target === "document"
+    ? { target, revision: found.revision, body: found.body as DocumentBody }
+    : { target, revision: found.revision, body: found.body as SlideDeckBody };
+};
+
+const idsOf = <T extends TableName>(rows: readonly Record<string, unknown>[], table: T): Id<T>[] =>
+  rows.flatMap((row) => {
+    const id = canonicalRowId(row._id, table);
+    return id === undefined ? [] : [asId<T>(id)];
+  });
+
+export const removeStage = (store: StoreModel, stage: Stage): void => {
+  const table = resourceTableOf(stage.target);
+  const snapshots = stage.target === "document" ? "documentSnapshots" : "slideDeckSnapshots";
+  const changeSets = stage.target === "document" ? "documentChangeSets" : "slideDeckChangeSets";
+  const kind = stage.target === "document" ? "document" : "slides";
+
+  const threads = recordsIn(store, "commentThreads").filter((row) => {
+    const target = row.target as Record<string, unknown> | undefined;
+    return (
+      row.projectId === stage.projectId &&
+      target?.kind === kind &&
+      target.id === stage.resourceId
+    );
+  });
+  const threadIds = new Set(threads.map((row) => row._id));
+  const comments = recordsIn(store, "comments").filter((row) => threadIds.has(row.threadId as string));
+
+  store.removeRows("comments", idsOf(comments, "comments"));
+  store.removeRows("commentThreads", idsOf(threads, "commentThreads"));
+  store.removeRows(
+    changeSets,
+    idsOf(
+      recordsIn(store, changeSets).filter(
+        (row) => row.projectId === stage.projectId && row.resourceId === stage.resourceId
+      ),
+      changeSets
+    )
+  );
+  store.removeRows(
+    snapshots,
+    idsOf(
+      recordsIn(store, snapshots).filter(
+        (row) => row.projectId === stage.projectId && row.resourceId === stage.resourceId
+      ),
+      snapshots
+    )
+  );
+  for (const setId of rowsOfResource(store, stage.projectId, stage.resourceId)) {
+    store.remove(`resourceSets.${setId}`);
+  }
+  if (recordsIn(store, table).some((row) => row._id === stage.resourceId)) {
+    store.remove(`${table}.${stage.resourceId}`);
+  }
+  store.remove(`templateStages.${stage._id}`);
+};
~~~~

### changed · `src/lib/capabilities/templates/api/shared/template-rows.ts` (+3 / −2)

~~~~diff
@@ -18,18 +18,19 @@ export const writeTemplateVersion = (
     ...(fields.description === undefined ? {} : { description: fields.description }),
     tags: fields.tags,
     body: fields.body,
-    variables: fields.variables,
+    holes: fields.holes,
     at
   });
 };
 
 export const fieldsOfTemplate = (template: Template): TemplateFields => ({
+  projectId: template.projectId,
   userId: template.userId,
   name: template.name,
   ...(template.description === undefined ? {} : { description: template.description }),
   tags: template.tags,
   body: template.body,
-  variables: template.variables,
+  holes: template.holes,
   createdBy: template.createdBy,
   revision: template.revision,
   updatedAt: template.updatedAt
~~~~

### changed · `src/lib/capabilities/templates/api/shared/validation.ts` (+227 / −51)

~~~~diff
@@ -1,10 +1,15 @@
 import type {
   TemplateBody,
-  TemplateVariable
+  TemplateHole
 } from "$representation/data/types/templates/template";
+import type { ResourceSet, SetTerm } from "$representation/data/types/core/resource-set";
 import { normalizeSlideDeckBody } from "$representation/data/behavior/slide-decks/normalize";
 
-import type { TemplateTarget } from "$capabilities/templates/types/templates";
+import type {
+  TemplateAnswers,
+  TemplateStageTarget,
+  TemplateTarget
+} from "$capabilities/templates/types/templates";
 import {
   MAX_TEMPLATE_CELLS,
   MAX_TEMPLATE_COLUMNS,
@@ -33,7 +38,6 @@ export const requiredId = (value: unknown, subject: string, field: string): stri
   return value;
 };
 
-/** A template id is one Store path segment, never another path in disguise. */
 export const templateIdOf = (value: unknown, subject: string): string => {
   const id = requiredId(value, subject, "templateId");
   if (!/^templates:[^.:\s]+$/.test(id)) {
@@ -60,6 +64,39 @@ export const targetOf = (value: unknown, subject: string): TemplateTarget => {
   return value;
 };
 
+export const stageTargetOf = (value: unknown, subject: string): TemplateStageTarget => {
+  if (value !== "document" && value !== "slides") {
+    throw new Error(`templates/${subject}: target is document or slides`);
+  }
+  return value;
+};
+
+const rowIdOf = (value: unknown, subject: string, table: string, field: string): string => {
+  const id = requiredId(value, subject, field);
+  if (!new RegExp(`^${table}:[^.:\\s]+$`).test(id)) {
+    throw new Error(`templates/${subject}: ${field} is one canonical ${table} row id`);
+  }
+  return id;
+};
+
+export const stageIdOf = (value: unknown, subject: string): string =>
+  rowIdOf(value, subject, "templateStages", "stageId");
+
+export const resourceIdOf = (value: unknown, subject: string): string => {
+  const id = requiredId(value, subject, "resourceId");
+  if (!/^(documents|slideDecks):[^.:\s]+$/.test(id)) {
+    throw new Error(`templates/${subject}: resourceId is one canonical documents or slideDecks row id`);
+  }
+  return id;
+};
+
+export const slideIdOf = (value: unknown, subject: string): string => {
+  if (typeof value !== "string" || value !== value.trim() || value.length === 0 || value.length > 500) {
+    throw new Error(`templates/${subject}: slideId is an identifier`);
+  }
+  return value;
+};
+
 export const nameOf = (value: unknown, subject: string): string => {
   if (typeof value !== "string" || value.trim().length === 0) {
     throw new Error(`templates/${subject}: name is required`);
@@ -513,7 +550,11 @@ const validActor = (value: unknown): boolean => {
 const validMarkLink = (value: unknown): boolean => {
   if (!isRecord(value) || !isText(value.kind)) return false;
   if (value.kind === "url") {
-    return hasOnlyKeys(value, ["kind", "url"]) && validText(value.url, 10_000);
+    return (
+      hasOnlyKeys(value, ["kind", "url", "note"]) &&
+      validText(value.url, 10_000) &&
+      (value.note === undefined || validText(value.note, 10_000))
+    );
   }
   if (value.kind === "actor") {
     return hasOnlyKeys(value, ["kind", "actor"]) && validActor(value.actor);
@@ -613,6 +654,12 @@ const validAtom = (value: unknown): boolean => {
       validText(value.text, MAX_BLOCK_TEXT_LENGTH, true)
     );
   }
+  if (value.kind === "template") {
+    return (
+      hasOnlyKeys(value, ["id", "kind", "name"]) &&
+      validCanonicalText(value.name, MAX_HOLE_NAME_LENGTH)
+    );
+  }
   return (
     value.kind === "formula" &&
     hasOnlyKeys(value, [
@@ -639,7 +686,9 @@ const displayOfAtoms = (atoms: readonly unknown[]): string =>
     .map((atom) =>
       isRecord(atom) && atom.kind === "formula"
         ? (atom.lastResolvedDisplay as string)
-        : ((atom as Fields).text as string)
+        : isRecord(atom) && atom.kind === "template"
+          ? `{${atom.name as string}}`
+          : ((atom as Fields).text as string)
     )
     .join("");
 
@@ -811,6 +860,7 @@ const validBlock = (value: unknown, depth = 0): boolean => {
         "id",
         "type",
         "derivedOutputId",
+        "style",
         "atoms",
         "display",
         "marks",
@@ -821,6 +871,7 @@ const validBlock = (value: unknown, depth = 0): boolean => {
         "format"
       ]) &&
       (value.derivedOutputId === undefined || validIdentifier(value.derivedOutputId)) &&
+      (value.style === undefined || validIdentifier(value.style)) &&
       Array.isArray(value.atoms) &&
       value.atoms.length <= MAX_BLOCKS_PER_CONTAINER &&
       value.atoms.every(validAtom) &&
@@ -1515,7 +1566,6 @@ const validSpreadsheet = (body: Fields): boolean => {
   return validStyles(body.styles);
 };
 
-/** A template body must not smuggle live project/store identities into a new resource. */
 const assertPortableBody = (value: unknown, subject: string): void => {
   const boundField = (step: Fields): string | undefined => {
     if (step.to === "resource" && "ref" in step) return "resource reference";
@@ -1557,9 +1607,7 @@ export const bodyOf = (value: unknown, subject: string): TemplateBody => {
   const raw = fieldsOf(value, subject);
   const target = targetOf(raw.resource, subject);
   const normalized =
-    target === "slides"
-      ? { ...normalizeSlideDeckBody(raw), resource: "slides" as const }
-      : value;
+    target === "slides" ? { ...normalizeSlideDeckBody(raw), resource: target } : value;
   const body = fieldsOf(normalized, subject);
   const valid =
     target === "document"
@@ -1567,16 +1615,103 @@ export const bodyOf = (value: unknown, subject: string): TemplateBody => {
       : target === "slides"
         ? validSlides(body)
         : validSpreadsheet(body);
-  if (!valid) throw new Error(`templates/${subject}: body is not a valid ${target} template body`);
+  if (!valid) {
+    throw new Error(`templates/${subject}: body is not a valid ${target} template body`);
+  }
   return normalized as TemplateBody;
 };
 
-const MAX_TEMPLATE_VARIABLES = 100;
+const validSetTerm = (value: unknown): boolean => {
+  if (!isRecord(value)) return false;
+  if (value.select === "project") return Object.keys(value).length === 1;
+  if (value.select === "kinds") return validTerm(value);
+  if (value.select === "set") {
+    return (
+      hasOnlyKeys(value, ["select", "setId"]) &&
+      typeof value.setId === "string" &&
+      /^resourceSets:[^.:\s]+$/.test(value.setId)
+    );
+  }
+  return (
+    value.select === "resources" &&
+    hasOnlyKeys(value, ["select", "refs"]) &&
+    Array.isArray(value.refs) &&
+    value.refs.length <= 1_000 &&
+    value.refs.every(
+      (ref) =>
+        isRecord(ref) &&
+        hasOnlyKeys(ref, ["kind", "id"]) &&
+        validCanonicalText(ref.kind, MAX_RESOURCE_KIND_LENGTH) &&
+        validIdentifier(ref.id)
+    )
+  );
+};
+
+export const resourceSetOf = (value: unknown, subject: string): ResourceSet => {
+  if (
+    !isRecord(value) ||
+    !hasOnlyKeys(value, ["include", "exclude"]) ||
+    !Array.isArray(value.include) ||
+    !Array.isArray(value.exclude) ||
+    value.include.length > MAX_TEMPLATE_TERMS_PER_SIDE ||
+    value.exclude.length > MAX_TEMPLATE_TERMS_PER_SIDE ||
+    !value.include.every(validSetTerm) ||
+    !value.exclude.every(validSetTerm)
+  ) {
+    throw new Error(`templates/${subject}: a resource set is an include list and an exclude list`);
+  }
+  return {
+    include: (value.include as SetTerm[]).map((term) => structuredClone(term)),
+    exclude: (value.exclude as SetTerm[]).map((term) => structuredClone(term))
+  };
+};
+
+export const answersOf = (value: unknown, subject: string): TemplateAnswers => {
+  if (!isRecord(value)) {
+    throw new Error(`templates/${subject}: answers map hole names to resource sets`);
+  }
+  const entries = Object.entries(value);
+  if (entries.length > MAX_TEMPLATE_HOLES) {
+    throw new Error(`templates/${subject}: at most ${MAX_TEMPLATE_HOLES} holes are answered`);
+  }
+  const answers: Record<string, ResourceSet> = {};
+  for (const [name, answer] of entries) {
+    if (!validCanonicalText(name, MAX_HOLE_NAME_LENGTH)) {
+      throw new Error(`templates/${subject}: every answered hole has a name`);
+    }
+    answers[name] = resourceSetOf(answer, subject);
+  }
+  return answers;
+};
+
+/** The words a caller filled the template's text holes in with. */
+export const textsOf = (value: unknown, subject: string): Readonly<Record<string, string>> => {
+  if (!isRecord(value)) {
+    throw new Error(`templates/${subject}: texts map hole names to words`);
+  }
+  const entries = Object.entries(value);
+  if (entries.length > MAX_TEMPLATE_HOLES) {
+    throw new Error(`templates/${subject}: at most ${MAX_TEMPLATE_HOLES} holes are answered`);
+  }
+  const texts: Record<string, string> = {};
+  for (const [name, words] of entries) {
+    if (!validCanonicalText(name, MAX_HOLE_NAME_LENGTH)) {
+      throw new Error(`templates/${subject}: every answered hole has a name`);
+    }
+    if (!validText(words, MAX_BLOCK_TEXT_LENGTH, true)) {
+      throw new Error(`templates/${subject}: a text answer is words`);
+    }
+    texts[name] = words as string;
+  }
+  return texts;
+};
+
+const MAX_TEMPLATE_HOLES = 100;
 const MAX_TEMPLATE_TERMS_PER_SIDE = 100;
 const MAX_TEMPLATE_KINDS_PER_TERM = 100;
-const MAX_VARIABLE_NAME_LENGTH = 160;
-const MAX_VARIABLE_LABEL_LENGTH = 500;
-const MAX_VARIABLE_DESCRIPTION_LENGTH = 4_000;
+const MAX_HOLE_NAME_LENGTH = 160;
+const MAX_HOLE_LABEL_LENGTH = 500;
+const MAX_HOLE_DESCRIPTION_LENGTH = 4_000;
 const MAX_RESOURCE_KIND_LENGTH = 160;
 
 const validTerm = (value: unknown): boolean => {
@@ -1584,11 +1719,19 @@ const validTerm = (value: unknown): boolean => {
   if (value.select === "project") {
     return hasOnlyKeys(value, ["select"]) && Object.keys(value).length === 1;
   }
-  if (value.select === "variable") {
+  if (value.select === "hole") {
     return (
       hasOnlyKeys(value, ["select", "name"]) &&
       Object.keys(value).length === 2 &&
-      validCanonicalText(value.name, MAX_VARIABLE_NAME_LENGTH)
+      validCanonicalText(value.name, MAX_HOLE_NAME_LENGTH)
+    );
+  }
+  if (value.select === "set") {
+    return (
+      hasOnlyKeys(value, ["select", "setId"]) &&
+      Object.keys(value).length === 2 &&
+      typeof value.setId === "string" &&
+      /^resourceSets:[^.:\s]+$/.test(value.setId)
     );
   }
   if (
@@ -1618,62 +1761,95 @@ const validTemplatedSet = (value: unknown): boolean =>
   value.exclude.length <= MAX_TEMPLATE_TERMS_PER_SIDE &&
   value.exclude.every(validTerm);
 
-export const variablesOf = (value: unknown, subject: string): readonly TemplateVariable[] => {
-  if (!Array.isArray(value)) throw new Error(`templates/${subject}: variables is a list`);
-  if (value.length > MAX_TEMPLATE_VARIABLES) {
-    throw new Error(
-      `templates/${subject}: a template has at most ${MAX_TEMPLATE_VARIABLES} variables`
-    );
+/**
+ * A rule somebody just built, before it is normalised.
+ *
+ * It may exclude things and it may name particular resources, neither of which a
+ * stored default can carry. Both become one `set` term naming a bound row, which
+ * is why the wire shape is wider than the stored one.
+ */
+const validChosenSet = (value: unknown): boolean =>
+  isRecord(value) &&
+  hasOnlyKeys(value, ["include", "exclude"]) &&
+  Object.keys(value).length === 2 &&
+  Array.isArray(value.include) &&
+  value.include.length <= MAX_TEMPLATE_TERMS_PER_SIDE &&
+  value.include.every((term) => validTerm(term) || validSetTerm(term)) &&
+  Array.isArray(value.exclude) &&
+  value.exclude.length <= MAX_TEMPLATE_TERMS_PER_SIDE &&
+  value.exclude.every((term) => validTerm(term) || validSetTerm(term));
+
+export const holesOf = (
+  value: unknown,
+  subject: string,
+  chosen = false
+): readonly TemplateHole[] => {
+  if (!Array.isArray(value)) throw new Error(`templates/${subject}: holes is a list`);
+  if (value.length > MAX_TEMPLATE_HOLES) {
+    throw new Error(`templates/${subject}: a template has at most ${MAX_TEMPLATE_HOLES} holes`);
   }
   const seen = new Set<string>();
   const declared = new Set<string>();
-  for (const variable of value) {
+  for (const hole of value) {
     if (
-      !isRecord(variable) ||
-      !hasOnlyKeys(variable, ["name", "label", "description", "default"])
+      !isRecord(hole) ||
+      !hasOnlyKeys(hole, ["name", "label", "description", "kind", "default", "text"])
     ) {
-      throw new Error(`templates/${subject}: a variable has only represented fields`);
+      throw new Error(`templates/${subject}: a hole has only represented fields`);
     }
-    if (!validCanonicalText(variable.name, MAX_VARIABLE_NAME_LENGTH)) {
-      throw new Error(`templates/${subject}: every variable has a name`);
+    if (hole.kind !== undefined && hole.kind !== "scope" && hole.kind !== "text") {
+      throw new Error(`templates/${subject}: a hole is answered with a scope or with text`);
     }
-    if (!validCanonicalText(variable.label, MAX_VARIABLE_LABEL_LENGTH)) {
-      throw new Error(`templates/${subject}: every variable has a label`);
+    if (hole.kind === "text" && hole.default !== undefined) {
+      throw new Error(`templates/${subject}: a text hole has no default scope`);
+    }
+    if (hole.text !== undefined) {
+      if (hole.kind !== "text") {
+        throw new Error(`templates/${subject}: only a text hole has default words`);
+      }
+      if (!validText(hole.text, MAX_BLOCK_TEXT_LENGTH, true)) {
+        throw new Error(`templates/${subject}: a hole's default words are text`);
+      }
+    }
+    if (!validCanonicalText(hole.name, MAX_HOLE_NAME_LENGTH)) {
+      throw new Error(`templates/${subject}: every hole has a name`);
+    }
+    if (!validCanonicalText(hole.label, MAX_HOLE_LABEL_LENGTH)) {
+      throw new Error(`templates/${subject}: every hole has a label`);
     }
     if (
-      variable.description !== undefined &&
-      (!isText(variable.description) ||
-        variable.description.length > MAX_VARIABLE_DESCRIPTION_LENGTH ||
-        variable.description !== variable.description.trim())
+      hole.description !== undefined &&
+      (!isText(hole.description) ||
+        hole.description.length > MAX_HOLE_DESCRIPTION_LENGTH ||
+        hole.description !== hole.description.trim())
     ) {
-      throw new Error(`templates/${subject}: a variable description is text`);
+      throw new Error(`templates/${subject}: a hole description is text`);
     }
-    if (variable.default !== undefined && !validTemplatedSet(variable.default)) {
-      throw new Error(`templates/${subject}: a variable default is a templated resource set`);
+    if (
+      hole.default !== undefined &&
+      !(chosen ? validChosenSet(hole.default) : validTemplatedSet(hole.default))
+    ) {
+      throw new Error(`templates/${subject}: a hole default is a templated resource set`);
     }
-    const key = variable.name.toLocaleLowerCase();
-    if (seen.has(key)) throw new Error(`templates/${subject}: variable names are unique`);
+    const key = hole.name.toLocaleLowerCase();
+    if (seen.has(key)) throw new Error(`templates/${subject}: hole names are unique`);
     seen.add(key);
-    declared.add(variable.name);
+    declared.add(hole.name);
   }
-  for (const variable of value as Fields[]) {
-    if (!isRecord(variable.default)) continue;
+  for (const hole of value as Fields[]) {
+    if (!isRecord(hole.default)) continue;
     const terms = [
-      ...((variable.default.include as unknown[]) ?? []),
-      ...((variable.default.exclude as unknown[]) ?? [])
+      ...((hole.default.include as unknown[]) ?? []),
+      ...((hole.default.exclude as unknown[]) ?? [])
     ];
     for (const term of terms) {
-      if (
-        isRecord(term) &&
-        term.select === "variable" &&
-        !declared.has(term.name as string)
-      ) {
-        throw new Error(`templates/${subject}: a variable default names a declared variable`);
+      if (isRecord(term) && term.select === "hole" && !declared.has(term.name as string)) {
+        throw new Error(`templates/${subject}: a hole default names a declared hole`);
       }
     }
   }
   assertStoredValue(value, subject);
-  return value as readonly TemplateVariable[];
+  return value as readonly TemplateHole[];
 };
 
 export const has = (fields: Fields, field: string): boolean =>
~~~~

### changed · `src/lib/capabilities/templates/api/update-template/update-template.ts` (+81 / −26)

~~~~diff
@@ -1,11 +1,19 @@
 import { requireScope } from "$runtime/server/scope.server";
 import { serverModel } from "$runtime/server/start.server";
+import { asId } from "$representation/data/behavior/core/id";
+import { scopeHoleNamesIn } from "$representation/data/behavior/templates/scopes";
 
 import {
   admitStoredTemplate,
   reportableRevision,
   visibleTemplate
 } from "$capabilities/templates/api/shared/projection";
+import {
+  normalizeScope,
+  removeRowsBoundTo,
+  unknownSetsIn
+} from "$capabilities/templates/api/shared/scopes";
+import { stagesIn } from "$capabilities/templates/api/shared/stages";
 import type { RowFields } from "$capabilities/templates/api/shared/store";
 import { writeTemplateVersion } from "$capabilities/templates/api/shared/template-rows";
 import { validateUpdateTemplate } from "$capabilities/templates/api/update-template/validate-update-template";
@@ -27,15 +35,6 @@ export const updateTemplate = async (input: unknown): Promise<UpdateTemplateResu
     };
   }
   const stored = found.template;
-  if (stored.userId !== scope.userId) {
-    return {
-      accepted: false,
-      templateId: asked.templateId,
-      reason: "forbidden",
-      revision: reportableRevision(stored.revision),
-      detail: "only the template owner can change it"
-    };
-  }
   if (stored.revision !== asked.baseRevision) {
     return {
       accepted: false,
@@ -71,43 +70,99 @@ export const updateTemplate = async (input: unknown): Promise<UpdateTemplateResu
     asked.patch.description === null
       ? undefined
       : (asked.patch.description ?? template.description);
-  let variables = [...template.variables];
-  if (asked.patch.variableDescription !== undefined) {
-    const variable = asked.patch.variableDescription;
-    if (!variables.some((candidate) => candidate.name === variable.name)) {
+  const at = Date.now();
+  const actor = { kind: "user" as const, userId: asId<"users">(scope.userId) };
+  let holes = [...(asked.patch.holes ?? template.holes)];
+  if (asked.patch.holes !== undefined) {
+    const declared = new Set(holes.map((hole) => hole.name));
+    const orphaned = scopeHoleNamesIn(template.body).filter((name) => !declared.has(name));
+    if (orphaned.length > 0) {
+      return {
+        accepted: false,
+        templateId: asked.templateId,
+        reason: "hole-in-use",
+        revision: template.revision,
+        detail: `the body still names ${orphaned.join(", ")}`
+      };
+    }
+    for (const hole of holes) {
+      const missing = unknownSetsIn(
+        store,
+        scope.projectId,
+        hole.default ?? { include: [], exclude: [] }
+      );
+      if (missing.length > 0) {
+        return {
+          accepted: false,
+          templateId: asked.templateId,
+          reason: "unsupported-body",
+          revision: template.revision,
+          detail: `no set in this project has id ${missing.join(", ")}`
+        };
+      }
+    }
+    for (const held of template.holes) {
+      if (holes.some((hole) => hole.name === held.name)) continue;
+      removeRowsBoundTo(store, scope.projectId, {
+        kind: "hole",
+        templateId: template._id,
+        hole: held.name
+      });
+    }
+    holes = holes.map((hole) => {
+      const written = normalizeScope(
+        store,
+        scope.projectId,
+        actor,
+        { kind: "hole", templateId: template._id, hole: hole.name },
+        hole.default,
+        at
+      );
+      return {
+        name: hole.name,
+        label: hole.label,
+        ...(hole.description === undefined ? {} : { description: hole.description }),
+        ...(hole.kind === undefined ? {} : { kind: hole.kind }),
+        ...(hole.text === undefined ? {} : { text: hole.text }),
+        ...(written === undefined ? {} : { default: written.term })
+      };
+    });
+  }
+  if (asked.patch.holeDescription !== undefined) {
+    const asking = asked.patch.holeDescription;
+    if (!holes.some((candidate) => candidate.name === asking.name)) {
       return {
         accepted: false,
         templateId: asked.templateId,
         reason: "unsupported-body",
         revision: template.revision,
-        detail: `the template no longer declares variable ${variable.name}`
+        detail: `the template no longer declares hole ${asking.name}`
       };
     }
-    variables = variables.map((candidate) =>
-      candidate.name !== variable.name
-        ? candidate
-        : {
-            name: candidate.name,
-            label: candidate.label,
-            ...(variable.description === null ? {} : { description: variable.description }),
-            ...(candidate.default === undefined ? {} : { default: candidate.default })
-          }
-    );
+    holes = holes.map((candidate) => {
+      if (candidate.name !== asking.name) return candidate;
+      const { description: _description, ...rest } = candidate;
+      return asking.description === null ? rest : { ...rest, description: asking.description };
+    });
   }
-  const at = Date.now();
   const fields: RowFields<"templates"> = {
+    projectId: template.projectId,
     userId: template.userId,
     name: asked.patch.name ?? template.name,
     ...(description === undefined ? {} : { description }),
     tags: [...(asked.patch.tags ?? template.tags)],
     body: template.body,
-    variables,
+    holes,
     createdBy: template.createdBy,
     revision: template.revision + 1,
     updatedAt: at
   };
   store.update(`templates.${template._id}`, fields);
   writeTemplateVersion(store, template._id, fields, at);
+  for (const stage of stagesIn(store)) {
+    if (stage.templateId !== template._id) continue;
+    store.update(`templateStages.${stage._id}.templateRevision`, fields.revision);
+  }
 
   return { accepted: true, templateId: template._id, revision: fields.revision };
 };
~~~~

### changed · `src/lib/capabilities/templates/api/update-template/validate-update-template.ts` (+14 / −10)

~~~~diff
@@ -6,6 +6,7 @@ import {
   only,
   revisionOf,
   tagsOf,
+  holesOf,
   templateIdOf
 } from "$capabilities/templates/api/shared/validation";
 import type {
@@ -17,16 +18,16 @@ export const validateUpdateTemplate = (input: unknown): UpdateTemplateInput => {
   const fields = fieldsOf(input, "update-template");
   only(fields, ["templateId", "baseRevision", "patch"], "update-template");
   const incoming = fieldsOf(fields.patch, "update-template");
-  only(incoming, ["name", "description", "tags", "variableDescription"], "update-template");
+  only(incoming, ["name", "description", "tags", "holeDescription", "holes"], "update-template");
   if (Object.keys(incoming).length === 0) {
     throw new Error("templates/update-template: patch changes at least one field");
   }
 
-  const variableDescription = has(incoming, "variableDescription")
-    ? fieldsOf(incoming.variableDescription, "update-template")
+  const holeDescription = has(incoming, "holeDescription")
+    ? fieldsOf(incoming.holeDescription, "update-template")
     : undefined;
-  if (variableDescription !== undefined) {
-    only(variableDescription, ["name", "description"], "update-template");
+  if (holeDescription !== undefined) {
+    only(holeDescription, ["name", "description"], "update-template");
   }
 
   const patch: UpdateTemplatePatch = {
@@ -40,15 +41,18 @@ export const validateUpdateTemplate = (input: unknown): UpdateTemplateInput => {
         }
       : {}),
     ...(has(incoming, "tags") ? { tags: tagsOf(incoming.tags, "update-template") } : {}),
-    ...(variableDescription === undefined
+    ...(has(incoming, "holes")
+      ? { holes: holesOf(incoming.holes, "update-template", true) }
+      : {}),
+    ...(holeDescription === undefined
       ? {}
       : {
-          variableDescription: {
-            name: nameOf(variableDescription.name, "update-template"),
+          holeDescription: {
+            name: nameOf(holeDescription.name, "update-template"),
             description:
-              variableDescription.description === null
+              holeDescription.description === null
                 ? null
-                : descriptionOf(variableDescription.description, "update-template")
+                : descriptionOf(holeDescription.description, "update-template")
           }
         })
   };
~~~~

### changed · `src/lib/capabilities/templates/index.remote.ts` (+58 / −6)

~~~~diff
@@ -1,28 +1,37 @@
 import { command, query } from "$app/server";
 
 import { readProjectResourceIndex } from "$capabilities/project-resources/index.remote";
+import { read as readStoreTable } from "$capabilities/store/index.remote";
+import { commitTemplateStage as commitTemplateStageProcedure } from "$capabilities/templates/api/commit-template-stage/commit-template-stage";
 import { createTemplate as createTemplateProcedure } from "$capabilities/templates/api/create-template/create-template";
+import { createTemplateFromResource as createTemplateFromResourceProcedure } from "$capabilities/templates/api/create-template-from-resource/create-template-from-resource";
+import { discardTemplateStage as discardTemplateStageProcedure } from "$capabilities/templates/api/discard-template-stage/discard-template-stage";
 import { duplicateTemplate as duplicateTemplateProcedure } from "$capabilities/templates/api/duplicate-template/duplicate-template";
 import { instantiateTemplate as instantiateTemplateProcedure } from "$capabilities/templates/api/instantiate-template/instantiate-template";
+import { openTemplateStage as openTemplateStageProcedure } from "$capabilities/templates/api/open-template-stage/open-template-stage";
+import { readResourceTemplate as readResourceTemplateProcedure } from "$capabilities/templates/api/read-resource-template/read-resource-template";
 import { readTemplate as readTemplateProcedure } from "$capabilities/templates/api/read-template/read-template";
 import { readTemplateLibrary as readTemplateLibraryProcedure } from "$capabilities/templates/api/read-template-library/read-template-library";
 import { removeTemplate as removeTemplateProcedure } from "$capabilities/templates/api/remove-template/remove-template";
+import { resourceTableOf } from "$capabilities/templates/api/shared/stages";
 import { updateTemplate as updateTemplateProcedure } from "$capabilities/templates/api/update-template/update-template";
 
 export const readTemplateLibrary = query(readTemplateLibraryProcedure);
 export const readTemplate = query("unchecked", readTemplateProcedure);
+export const readResourceTemplate = query("unchecked", readResourceTemplateProcedure);
 
-/**
- * Commands refresh the query instances they mutate from inside the same remote
- * request. Client `.updates(...)` calls name the mounted cache keys; these
- * refreshes return their new values alongside the command result.
- */
 export const createTemplate = command("unchecked", async (input) => {
   const result = await createTemplateProcedure(input);
   await readTemplateLibrary().refresh();
   return result;
 });
 
+export const createTemplateFromResource = command("unchecked", async (input) => {
+  const result = await createTemplateFromResourceProcedure(input);
+  await readTemplateLibrary().refresh();
+  return result;
+});
+
 export const updateTemplate = command("unchecked", async (input) => {
   const result = await updateTemplateProcedure(input);
   await readTemplateLibrary().refresh();
@@ -50,23 +59,66 @@ export const instantiateTemplate = command("unchecked", async (input) => {
   return result;
 });
 
+export const openTemplateStage = command("unchecked", async (input) => {
+  const result = await openTemplateStageProcedure(input);
+  await readTemplateLibrary().refresh();
+  await readTemplate({ templateId: result.templateId }).refresh();
+  if (result.accepted) {
+    await readResourceTemplate({ resourceId: result.resourceId }).refresh();
+    await readStoreTable({ path: resourceTableOf(result.target) }).refresh();
+  }
+  return result;
+});
+
+export const commitTemplateStage = command("unchecked", async (input) => {
+  const result = await commitTemplateStageProcedure(input);
+  await readTemplateLibrary().refresh();
+  if (result.templateId !== null) await readTemplate({ templateId: result.templateId }).refresh();
+  return result;
+});
+
+export const discardTemplateStage = command("unchecked", async (input) => {
+  const result = await discardTemplateStageProcedure(input);
+  await readTemplateLibrary().refresh();
+  if (result.accepted) {
+    await readTemplate({ templateId: result.templateId }).refresh();
+    await readResourceTemplate({ resourceId: result.resourceId }).refresh();
+    await readStoreTable({ path: resourceTableOf(result.target) }).refresh();
+  }
+  return result;
+});
+
 export type {
+  CommitTemplateStageInput,
+  CommitTemplateStageResult,
+  CreateTemplateFromResourceInput,
+  CreateTemplateFromResourceResult,
   CreateTemplateInput,
   CreateTemplateResult,
+  DiscardTemplateStageInput,
+  DiscardTemplateStageResult,
   DuplicateTemplateInput,
   DuplicateTemplateResult,
   InstantiateTemplateInput,
   InstantiateTemplateResult,
+  OpenTemplateStageInput,
+  OpenTemplateStageResult,
+  ReadResourceTemplateInput,
+  ReadResourceTemplateResult,
   ReadTemplateInput,
   ReadTemplateLibraryResult,
   ReadTemplateResult,
   RemoveTemplateInput,
   RemoveTemplateResult,
+  ResourceTemplateStage,
+  TemplateAnswers,
+  TemplateTexts,
   TemplateAvailability,
   TemplateDetail,
   TemplateLibraryItem,
-  TemplateUnavailable,
+  TemplateStageTarget,
   TemplateTarget,
+  TemplateUnavailable,
   UpdateTemplateInput,
   UpdateTemplatePatch,
   UpdateTemplateResult
~~~~

### changed · `src/lib/capabilities/templates/templates.md` (+126 / −64)

~~~~diff
@@ -1,57 +1,127 @@
 # templates
 
-The project-facing template library, with its mutations and the crossing that
-turns a template into an ordinary editable resource.
+The project's template library, its mutations, the crossing that turns a
+template into an ordinary editable resource, and the crossing back: a template
+opened in an ordinary editor and saved into.
 
 | procedure | answers |
 | --- | --- |
-| `readTemplateLibrary` | Every valid template visible from the scoped project, projected as library metadata with creator name, permissions, and last use, plus quarantined invalid row notices |
-| `readTemplate` | The full body and variables for one valid visible template, `unavailable` for a corrupt visible row, or `null` |
-| `createTemplate` | A viewer-owned template with a server-built valid empty body and revision-one history |
-| `updateTemplate` | An owner-only, compare-and-swap name, description, tag, or variable-help update plus an immutable version snapshot |
-| `duplicateTemplate` | A visible template copied into the viewer's ownership at revision one |
-| `removeTemplate` | An owner-only, compare-and-swap delete after current-project provenance and all version rows are removed; cross-project references refuse deletion |
-| `instantiateTemplate` | A regular document, deck, or spreadsheet with template provenance and a revision-zero leader snapshot |
-
-## Visibility and availability
-
-The representation currently gives a template a `userId`, but no project id or
-sharing field. The capability therefore makes only the claim stored data can
-support:
-
-- the viewer's templates are `personal`;
-- every template owned by someone else is not visible. Project membership alone
-  never grants access to that person's templates.
-
-The request scope proves project membership but does not yet expose membership
-role. The development user is the project owner; a production boundary must add
-role-aware scope before project-resource creation can distinguish a viewer from
-an editor. Template metadata mutation remains additionally owner-checked against
-the represented template `userId`.
-
-`project` remains in the public `TemplateAvailability` vocabulary as the one
-named future ownership state. The capability never invents it. There is no
-generic `shared` availability in the current contract; future access to a
-personal template needs an explicit owner-and-access-list design instead.
-
-A personal template has no represented project association. Deletion therefore
-refuses while any resource outside the request's project still references it;
-the scoped command never creates a dangling foreign-project `templateId` and
-never mutates a project it was not authorized to enter.
-
-`lastUsedAt` is the newest `_creationTime` of a document, deck, or spreadsheet
-in the scoped project whose `templateId` names the template. Later edits to that
-resource do not make the template appear newly used.
+| `readTemplateLibrary` | Every valid template in the scoped project, projected as library metadata with creator name, permissions and last use, plus quarantined invalid row notices |
+| `readTemplate` | The full body and holes for one valid template in the project, `unavailable` for a corrupt row, or `null` |
+| `readResourceTemplate` | For one document or deck: the stage it is, if any |
+| `createTemplate` | A template in the scoped project with a server-built valid empty body and revision-one history |
+| `createTemplateFromResource` | A template from a live document, a live deck, or one slide of a deck as a one-slide deck, its body made portable first; says what could not travel |
+| `updateTemplate` | A compare-and-swap name, description, tag, hole-help or hole-list update plus an immutable version snapshot |
+| `duplicateTemplate` | A template in the project copied into a new one at revision one |
+| `removeTemplate` | A compare-and-swap delete after the stage and all version rows are removed |
+| `instantiateTemplate` | A regular document, deck, or spreadsheet with a revision-zero leader snapshot and no reference back to the template, its prompt scopes filled from the caller's answers, else each hole's default |
+| `openTemplateStage` | The template's stage, made if absent: a scratch document or deck holding the template body, and the row that says so |
+| `commitTemplateStage` | The stage resource's leader body, made portable and validated, written as the template's next revision |
+| `discardTemplateStage` | The stage row and its scratch resource removed, with the resource's snapshots, change sets and comments |
+
+## Visibility
+
+A template belongs to one project. `projectId` is required on every row, the
+library lists the scoped project's templates and nothing else, and every
+procedure that names a template answers `not-found` for one in another
+project. Anyone the scope admits to the project may read, edit, save into,
+duplicate and delete its templates; `userId` and `createdBy` record who made
+one and grant nothing. Every template is `project`; `personal` stays in the
+availability vocabulary for a future owner-only state the capability never
+invents.
+
+A resource made from a template is a copy and nothing more: it carries no
+reference to the template, and later changes to the template never reach it.
+The template records `lastUsedAt` when it is instantiated, which is all the
+library's recency reads. Opening a template to edit it is not a use.
+
+## Bodies
+
+A body is `document`, `slides`, or `spreadsheet`. A template made from one slide
+is a deck body holding that slide, the layout it uses, and the theme and styles
+it is drawn with, and no sections; nothing distinguishes it from any other deck
+template afterwards.
+
+A body made from a live resource is made portable first: formula ids, generated
+output ids, links to people and resources, images stored in the project, and
+scope terms naming project resources are dropped, and each is said back to the
+caller. A template turns a value into a function, so this holds inside one
+project as much as across two: a prompt's scope is what the holes fill, and
+a formula keeps its expression and loses its instance, its project-neutral
+form, drawn as unbound in the editor until a formula is made for it again. The
+body is then admitted exactly as a stored one would be, so a template can never
+hold what a template may not.
+
+## Holes
+
+A hole is a place the body leaves for whoever places the template. A scope hole
+exists because the body names it: saving a stage or making a template from a
+resource declares every name the prompts ask for, so that list is found rather
+than authored. A text hole is authored, because nothing but the writer knows
+where in the prose it belongs — the panel declares it and drops its atom at the
+caret in one act, and the next save finds it like any other.
+
+**A body asks in two ways, so a hole is answered in two ways.** A prompt's scope
+naming one makes it a `scope`: a group of resources, which always has an answer
+because the whole project is the floor. A template atom in the prose makes it a
+`text`: words, filled from the caller, else the hole's own `text`, else nothing.
+That last case is the only thing that can hold a placement up, and
+`instantiateTemplate` refuses it with the names of what is still empty. A name
+used both ways is a scope, because otherwise the template could never be placed.
+
+A hole's `default` is what it selects when the caller says nothing: the whole
+project, kinds, one of the project's named sets, or another hole. A hole
+declared without one means the whole project. Instantiation fills every prompt
+scope from the caller's answers, else the default; an answer is a resource set,
+and a named set it points at is checked to exist before anything is written. A
+body naming a hole the template does not declare is refused rather than guessed
+at.
+
+**A rule that cannot be said inline is stored, and what points at it is one
+term.** Both a default and an answer arrive as whatever somebody built, which
+may exclude things and may name particular resources — neither of which the
+templated vocabulary holds. `normalizeScope` writes those as a `resourceSets`
+row bound to the hole that owns them, and the default or answer becomes a single
+`set` term naming it. That is not bookkeeping: resolving a template substitutes
+a hole term for what fills it, on either side of a prompt's scope, and one term
+for a difference cannot be expressed on the excluding side. A rule that is only
+the project, kinds or named sets is kept inline and writes nothing. Reading a
+template back expands a bound default into the rule it holds, so a builder opens
+on what was built; a named set is left as the named set somebody chose. The rows
+go when their owner does: a template removed, a hole dropped, a working copy
+discarded.
+
+`updateTemplate` still takes a whole hole list, because that is how a
+description, a default or a new text hole is written, and it refuses with
+`hole-in-use` while the body still names a scope hole the list drops.
+
+## Stages
+
+A stage is how a template is edited: a scratch document or deck the ordinary
+editor and runtime work on unchanged, and a row naming the template, the
+revision it was taken from, and the resource. One per template, shared by
+everyone in the project; opening again reuses it, so several people editing a
+template are editing one copy through the editor's own collaboration. Saving
+reads the scratch leader body, makes it portable, validates it, and writes it as
+the template's next revision; the stage stays open until it is discarded, so
+saving twice is ordinary. A name, tag or hole edit never touches the body,
+so it carries the stage to the new revision. The stage is the only thing that
+writes a template's body, so a copy and its template cannot drift apart; the
+compare-and-swap on save refuses only a second session's save that landed
+first. Comments are stripped like everything else that does not travel: the
+comments capability refuses to start a thread on a stage resource, and any
+thread that reaches one goes with the stage when it is discarded. A spreadsheet
+template cannot be staged until its editor lands.
+
+Project Overview leaves stage resources out of its index, and a resource set
+never counts one.
 
 ## Revisions and refusals
 
-Updates and deletes require `baseRevision`. Stale, forbidden, and missing
-requests are ordinary `accepted: false` answers, not transport errors. Invalid
-payloads throw before the store is read. Every created or updated template
-writes the corresponding `templateVersions` row. The current update door handles
-metadata plus one variable description at a time; stable variable keys/defaults
-and body authoring wait for the durable editor-session contract rather than
-exposing a weakly validated generic object write.
+Updates, deletes and saves require `baseRevision`. Stale and missing requests
+are ordinary `accepted: false` answers, not transport errors. Invalid payloads
+throw before the store is read. Every created or updated template writes the
+corresponding `templateVersions` row.
 
 Every stored row is re-admitted before projection or mutation. A malformed
 legacy row is quarantined from the list, reported as unavailable on direct read,
@@ -62,19 +132,12 @@ therefore cannot crash the rest of the library or be copied into new history.
 
 Instantiation writes normal resource rows, not a private template-editor data
 model. Documents and decks receive their represented body as a leader snapshot.
-Spreadsheet templates are materialized from addresses into stable row/column
-ids, sheet-cell rows, print ranges, dimensions, and a leader snapshot. All
-materialized cells are admitted and persisted as one table batch rather than
-rewriting the cell table once per cell.
-
-There is deliberately no ad-hoc variable-values input. The representation
-defines portable defaults, so instantiation substitutes those defaults into
-prompt scopes (including nested defaults) and can open the seeded templates
-without inventing another data shape. An unbound or cyclic variable hole returns
-`variables-required` and writes nothing. Caller-supplied overrides wait for the
-representation to define the command payload that records a person's answers.
-Formula evaluation and derived-output creation are downstream editor/runtime
-responsibilities, not side effects hidden in instantiation.
+Spreadsheet templates are
+materialized from addresses into stable row/column ids, sheet-cell rows, print
+ranges, dimensions, and a leader snapshot. All materialized cells are admitted
+and persisted as one table batch rather than rewriting the cell table once per
+cell. Formula evaluation and derived-output creation are downstream
+editor/runtime responsibilities, not side effects hidden in instantiation.
 
 ## Persistence boundary
 
@@ -84,8 +147,7 @@ then updates live memory. This removes phantom state after a failed write and
 bounds collection creation/removal to one table persistence operation.
 
 It is not yet a transaction across table files. Template/version writes,
-provenance/template deletion, and resource/snapshot/cell instantiation cross
-that boundary. Known validation and conflict refusals happen before writes, but
-a later-table I/O failure still needs a represented transaction or explicit
-recovery contract. The future-state reference calls this limitation out rather
-than describing those mutations as atomic.
+provenance/template deletion, stage creation and discard, and
+resource/snapshot/cell instantiation cross that boundary. Known validation and
+conflict refusals happen before writes, but a later-table I/O failure still
+needs a represented transaction or explicit recovery contract.
~~~~

### new · `src/lib/capabilities/templates/test/unit/answers.test.ts` (+491 / −0)

~~~~diff
@@ -0,0 +1,491 @@
+import assert from "node:assert/strict";
+import { beforeEach, describe, test, vi } from "vitest";
+
+type Row = Record<string, unknown> & { _id: string; _creationTime: number };
+
+const model = vi.hoisted(() => ({
+  scope: { projectId: "p", userId: "u", username: "Uma" },
+  tables: {} as Record<string, Row[]>,
+  store: {
+    create: (table: string, fields: unknown) => {
+      const rows = (model.tables[table] ??= []);
+      const id = `${table}:${rows.length + 1}`;
+      rows.push({ ...(fields as Record<string, unknown>), _id: id, _creationTime: 1 });
+      return id;
+    },
+    createMany: (table: string, fields: readonly unknown[]) =>
+      fields.map((entry) => model.store.create(table, entry)),
+    read: (path: string) => {
+      const [table] = path.split(".");
+      return { table, kind: "table", rows: model.tables[table] ?? [] };
+    },
+    update: (path: string, value: unknown) => {
+      const [table, id, ...fields] = path.split(".");
+      const rows = model.tables[table] ?? [];
+      const index = rows.findIndex((row) => row._id === id);
+      if (index < 0) throw new Error(`no row ${path}`);
+      rows[index] =
+        fields.length === 0
+          ? { ...(value as Record<string, unknown>), _id: id, _creationTime: rows[index]._creationTime }
+          : { ...rows[index], [fields[0]]: value };
+    },
+    remove: (path: string) => {
+      const [table, id] = path.split(".");
+      const rows = model.tables[table] ?? [];
+      const index = rows.findIndex((row) => row._id === id);
+      if (index >= 0) rows.splice(index, 1);
+    },
+    removeRows: () => {},
+    removeFieldFromRows: () => {}
+  }
+}));
+
+vi.mock("$runtime/server/start.server", () => ({ serverModel: () => model }));
+vi.mock("$runtime/server/scope.server", () => ({
+  requireScope: () => Promise.resolve(model.scope)
+}));
+
+const { createTemplateFromResource } = await import(
+  "$capabilities/templates/api/create-template-from-resource/create-template-from-resource"
+);
+const { instantiateTemplate } = await import(
+  "$capabilities/templates/api/instantiate-template/instantiate-template"
+);
+const { updateTemplate } = await import(
+  "$capabilities/templates/api/update-template/update-template"
+);
+
+const prompt = (id: string, name: string) => ({
+  id,
+  type: "prompt",
+  atoms: [{ id: `${id}-a`, kind: "literal", text: "Sum up" }],
+  display: "Sum up",
+  marks: [],
+  scope: { include: [{ select: "hole", name }], exclude: [] },
+  state: "idle"
+});
+
+const body = {
+  resource: "document",
+  rows: [{ id: "r1", kind: "blocks", blocks: [prompt("p1", "evidence")] }]
+};
+
+const row = (table: string, id: string, fields: Record<string, unknown>): Row => ({
+  ...fields,
+  _id: `${table}:${id}`,
+  _creationTime: 1
+});
+
+const scopeOf = (held: Row) => {
+  const rows = (held.body as { rows: { blocks: { scope: unknown }[] }[] }).rows;
+  return rows[0].blocks[0].scope;
+};
+
+beforeEach(() => {
+  vi.spyOn(Date, "now").mockReturnValue(500);
+  model.scope = { projectId: "p", userId: "u", username: "Uma" };
+  model.tables = {
+    users: [{ _id: "u", _creationTime: 1, displayName: "Uma" }],
+    memberships: [row("memberships", "1", { userId: "u", projectId: "p", token: "u", role: "owner" })],
+    templates: [
+      row("templates", "1", {
+        projectId: "p",
+        userId: "u",
+        name: "Brief",
+        tags: [],
+        body,
+        holes: [{ name: "evidence", label: "Evidence", default: { include: [{ select: "kinds", kinds: ["finding"] }], exclude: [] } }],
+        createdBy: { kind: "user", userId: "u" },
+        revision: 1,
+        updatedAt: 20
+      })
+    ],
+    templateVersions: [],
+    templateStages: [],
+    resourceSets: [row("resourceSets", "1", { projectId: "p", name: "Field evidence", set: { include: [{ select: "project" }], exclude: [] }, createdBy: { kind: "user", userId: "u" }, revision: 1, updatedAt: 1 })],
+    documents: [],
+    documentSnapshots: [],
+    slideDecks: [],
+    slideDeckSnapshots: [],
+    spreadsheets: []
+  };
+});
+
+describe("instantiating with answers", () => {
+  test("fills the scope from the caller, else the default", async () => {
+    const byDefault = await instantiateTemplate({ templateId: "templates:1" });
+    assert.ok(byDefault.accepted);
+    assert.deepEqual(scopeOf(model.tables.documentSnapshots[0]), {
+      include: [{ select: "kinds", kinds: ["finding"] }],
+      exclude: []
+    });
+
+    const byCaller = await instantiateTemplate({
+      templateId: "templates:1",
+      answers: { evidence: { include: [{ select: "set", setId: "resourceSets:1" }], exclude: [] } }
+    });
+    assert.ok(byCaller.accepted);
+    assert.deepEqual(scopeOf(model.tables.documentSnapshots[1]), {
+      include: [{ select: "set", setId: "resourceSets:1" }],
+      exclude: []
+    });
+  });
+
+  test("a default may name one of the project's sets", async () => {
+    model.tables.templates[0].holes = [
+      {
+        name: "evidence",
+        label: "Evidence",
+        default: { include: [{ select: "set", setId: "resourceSets:1" }], exclude: [] }
+      }
+    ];
+    const made = await instantiateTemplate({ templateId: "templates:1" });
+    assert.equal(made.accepted, true);
+    assert.deepEqual(scopeOf(model.tables.documentSnapshots[0]), {
+      include: [{ select: "set", setId: "resourceSets:1" }],
+      exclude: []
+    });
+  });
+
+  test("a hole without a default means the whole project", async () => {
+    model.tables.templates[0].holes = [{ name: "evidence", label: "Evidence" }];
+    const made = await instantiateTemplate({ templateId: "templates:1" });
+    assert.ok(made.accepted);
+    assert.deepEqual(scopeOf(model.tables.documentSnapshots[0]), {
+      include: [{ select: "project" }],
+      exclude: []
+    });
+  });
+
+  test("refuses an answer naming a set the project does not hold, and a body naming an undeclared hole", async () => {
+    const unknownSet = await instantiateTemplate({
+      templateId: "templates:1",
+      answers: { evidence: { include: [{ select: "set", setId: "resourceSets:9" }], exclude: [] } }
+    });
+    assert.equal(unknownSet.accepted, false);
+    assert.match(unknownSet.accepted === false ? unknownSet.detail : "", /resourceSets:9/);
+
+    model.tables.templates[0].holes = [];
+    const undeclared = await instantiateTemplate({ templateId: "templates:1" });
+    assert.deepEqual(undeclared, {
+      accepted: false,
+      templateId: "templates:1",
+      reason: "unsupported-body",
+      revision: 1,
+      detail: "the body names a hole the template does not declare: evidence"
+    });
+    assert.deepEqual(model.tables.documents, []);
+    await assert.rejects(
+      () => instantiateTemplate({ templateId: "templates:1", answers: { evidence: { kind: "set" } } }),
+      /include list and an exclude list/
+    );
+  });
+});
+
+describe("replacing the hole list", () => {
+  test("keeps a hole the body names and accepts a list that declares it", async () => {
+    const dropped = await updateTemplate({ templateId: "templates:1", baseRevision: 1, patch: { holes: [] } });
+    assert.deepEqual(dropped, {
+      accepted: false,
+      templateId: "templates:1",
+      reason: "hole-in-use",
+      revision: 1,
+      detail: "the body still names evidence"
+    });
+
+    const kept = await updateTemplate({
+      templateId: "templates:1",
+      baseRevision: 1,
+      patch: {
+        holes: [
+          { name: "evidence", label: "Evidence", description: "What happened" },
+          { name: "models", label: "Models", default: { include: [{ select: "project" }], exclude: [] } }
+        ]
+      }
+    });
+    assert.deepEqual(kept, { accepted: true, templateId: "templates:1", revision: 2 });
+    assert.deepEqual(
+      (model.tables.templates[0].holes as { name: string }[]).map((hole) => hole.name),
+      ["evidence", "models"]
+    );
+  });
+});
+
+describe("a template from a live resource", () => {
+  test("makes a portable document template and declares the names its body uses", async () => {
+    model.tables.documents.push(row("documents", "1", { projectId: "p", title: "Winter brief" }));
+    model.tables.documentSnapshots.push(
+      row("documentSnapshots", "1", {
+        projectId: "p",
+        resourceId: "documents:1",
+        role: "leader",
+        revision: 4,
+        body: {
+          rows: [
+            {
+              id: "r1",
+              kind: "blocks",
+              blocks: [
+                { ...prompt("p1", "evidence"), derivedOutputId: "derivedOutputs:3" },
+                {
+                  id: "t1",
+                  type: "text",
+                  variant: "paragraph",
+                  atoms: [{ id: "t1-a", kind: "literal", text: "Read the plan" }],
+                  display: "Read the plan",
+                  marks: [
+                    {
+                      id: "m1",
+                      from: { atom: "t1-a", offset: 9 },
+                      to: { atom: "t1-a", offset: 13 },
+                      link: { kind: "url", url: "https://example.com/plan", note: "Scope" }
+                    }
+                  ]
+                }
+              ]
+            }
+          ]
+        }
+      })
+    );
+
+    const made = await createTemplateFromResource({
+      target: "document",
+      resourceId: "documents:1",
+      name: "Winter brief shell",
+      tags: ["Winter"]
+    });
+    assert.deepEqual(made, {
+      accepted: true,
+      templateId: "templates:2",
+      target: "document",
+      revision: 1,
+      dropped: ["Dropped a prompt's generated output."]
+    });
+    const held = model.tables.templates[1];
+    assert.equal(held.name, "Winter brief shell");
+    assert.deepEqual(held.tags, ["Winter"]);
+    assert.deepEqual(held.holes, [{ name: "evidence", label: "evidence" }]);
+    const kept = (held.body as { rows: { blocks: { marks: { link: unknown }[] }[] }[] }).rows[0]
+      .blocks[1].marks[0].link;
+    assert.deepEqual(kept, { kind: "url", url: "https://example.com/plan", note: "Scope" });
+    assert.equal("templateId" in model.tables.documents[0], false);
+    assert.equal(model.tables.templateVersions.length, 1);
+  });
+
+  test("makes a deck template from the whole deck or from one of its slides", async () => {
+    model.tables.slideDecks.push(row("slideDecks", "1", { projectId: "p", title: "Board" }));
+    model.tables.slideDeckSnapshots.push(
+      row("slideDeckSnapshots", "1", {
+        projectId: "p",
+        resourceId: "slideDecks:1",
+        role: "leader",
+        revision: 1,
+        body: {
+          aspectRatio: "16:9",
+          theme: { colors: { text: "ink", accent: "blue" } },
+          styles: { defaultKey: "body", styles: { body: { name: "Body" } } },
+          layouts: [{ id: "l1", key: "title", name: "Title", locked: [], placeholders: [] }],
+          slides: [
+            { id: "s1", elements: [], notes: [] },
+            { id: "s2", layoutKey: "title", elements: [], notes: [] }
+          ],
+          sections: [{ id: "sec", name: "One", firstSlideId: "s1" }]
+        }
+      })
+    );
+
+    const whole = await createTemplateFromResource({ target: "slides", resourceId: "slideDecks:1", name: "Board" });
+    assert.ok(whole.accepted);
+    const wholeBody = model.tables.templates[1].body as { resource: string; slides: unknown[]; sections: unknown[] };
+    assert.equal(wholeBody.resource, "slides");
+    assert.equal(wholeBody.slides.length, 2);
+    assert.equal(wholeBody.sections.length, 1);
+
+    const one = await createTemplateFromResource({
+      target: "slides",
+      resourceId: "slideDecks:1",
+      name: "Section divider",
+      slideId: "s2"
+    });
+    assert.ok(one.accepted);
+    const held = model.tables.templates[2].body as { resource: string; slides: { id: string }[]; layouts: unknown[]; sections: unknown[] };
+    assert.equal(held.resource, "slides");
+    assert.deepEqual(held.slides.map((slide) => slide.id), ["s2"]);
+    assert.equal(held.layouts.length, 1);
+    assert.deepEqual(held.sections, []);
+
+    const missing = await createTemplateFromResource({
+      target: "slides",
+      resourceId: "slideDecks:1",
+      name: "Nothing",
+      slideId: "s9"
+    });
+    assert.equal(missing.accepted === false && missing.reason, "not-found");
+    await assert.rejects(
+      () => createTemplateFromResource({ target: "document", resourceId: "slideDecks:1", name: "x" }),
+      /comes from a document/
+    );
+    await assert.rejects(
+      () => createTemplateFromResource({ target: "document", resourceId: "documents:1", name: "x", slideId: "s1" }),
+      /only a deck template names a slide/
+    );
+  });
+});
+
+describe("a rule that cannot be said inline becomes a row", () => {
+  const excluding = {
+    include: [{ select: "project" }],
+    exclude: [{ select: "kinds", kinds: ["slides"] }]
+  };
+
+  test("a default that excludes something is stored, and the hole holds one term", async () => {
+    const result = await updateTemplate({
+      templateId: "templates:1",
+      baseRevision: 1,
+      patch: { holes: [{ name: "evidence", label: "Evidence", default: excluding }] }
+    });
+    assert.ok(result.accepted);
+
+    const bound = model.tables.resourceSets.filter((set) => set.boundTo !== undefined);
+    assert.equal(bound.length, 1);
+    assert.deepEqual(bound[0].boundTo, {
+      kind: "hole",
+      templateId: "templates:1",
+      hole: "evidence"
+    });
+    assert.equal(bound[0].name, undefined);
+    assert.deepEqual(bound[0].set, excluding);
+    assert.deepEqual(model.tables.templates[0].holes, [
+      {
+        name: "evidence",
+        label: "Evidence",
+        default: { include: [{ select: "set", setId: bound[0]._id }], exclude: [] }
+      }
+    ]);
+  });
+
+  test("a rule that can be said inline writes nothing, and clears a row it had", async () => {
+    await updateTemplate({
+      templateId: "templates:1",
+      baseRevision: 1,
+      patch: { holes: [{ name: "evidence", label: "Evidence", default: excluding }] }
+    });
+    const result = await updateTemplate({
+      templateId: "templates:1",
+      baseRevision: 2,
+      patch: {
+        holes: [
+          {
+            name: "evidence",
+            label: "Evidence",
+            default: { include: [{ select: "kinds", kinds: ["finding"] }], exclude: [] }
+          }
+        ]
+      }
+    });
+    assert.ok(result.accepted);
+    assert.equal(model.tables.resourceSets.filter((set) => set.boundTo !== undefined).length, 0);
+  });
+
+  test("the same hole rewrites its own row rather than piling them up", async () => {
+    await updateTemplate({
+      templateId: "templates:1",
+      baseRevision: 1,
+      patch: { holes: [{ name: "evidence", label: "Evidence", default: excluding }] }
+    });
+    const first = model.tables.resourceSets.find((set) => set.boundTo !== undefined);
+    await updateTemplate({
+      templateId: "templates:1",
+      baseRevision: 2,
+      patch: {
+        holes: [
+          {
+            name: "evidence",
+            label: "Evidence",
+            default: {
+              include: [{ select: "project" }],
+              exclude: [{ select: "kinds", kinds: ["document"] }]
+            }
+          }
+        ]
+      }
+    });
+    const bound = model.tables.resourceSets.filter((set) => set.boundTo !== undefined);
+    assert.equal(bound.length, 1);
+    assert.equal(bound[0]._id, first?._id);
+    assert.equal(bound[0].revision, 2);
+  });
+
+  test("a default may name particular resources, which a template cannot say itself", async () => {
+    const result = await updateTemplate({
+      templateId: "templates:1",
+      baseRevision: 1,
+      patch: {
+        holes: [
+          {
+            name: "evidence",
+            label: "Evidence",
+            default: {
+              include: [{ select: "resources", refs: [{ kind: "document", id: "documents:9" }] }],
+              exclude: []
+            }
+          }
+        ]
+      }
+    });
+    assert.ok(result.accepted);
+    const bound = model.tables.resourceSets.find((set) => set.boundTo !== undefined);
+    assert.deepEqual(bound?.set, {
+      include: [{ select: "resources", refs: [{ kind: "document", id: "documents:9" }] }],
+      exclude: []
+    });
+  });
+
+  test("an answer that excludes something resolves, because it became one term", async () => {
+    const placed = await instantiateTemplate({
+      templateId: "templates:1",
+      answers: { evidence: excluding }
+    });
+    assert.ok(placed.accepted);
+    const bound = model.tables.resourceSets.filter((set) => set.boundTo !== undefined);
+    assert.equal(bound.length, 1);
+    assert.deepEqual(bound[0].boundTo, {
+      kind: "resource",
+      resourceId: placed.resourceId,
+      hole: "evidence"
+    });
+    assert.deepEqual(scopeOf(model.tables.documentSnapshots[0]), {
+      include: [{ select: "set", setId: bound[0]._id }],
+      exclude: []
+    });
+  });
+
+  test("a default naming a set from another project is refused", async () => {
+    model.tables.resourceSets.push(
+      row("resourceSets", "9", {
+        projectId: "other",
+        name: "Elsewhere",
+        set: { include: [], exclude: [] },
+        createdBy: { kind: "user", userId: "u" },
+        revision: 1,
+        updatedAt: 1
+      })
+    );
+    const result = await updateTemplate({
+      templateId: "templates:1",
+      baseRevision: 1,
+      patch: {
+        holes: [
+          {
+            name: "evidence",
+            label: "Evidence",
+            default: { include: [{ select: "set", setId: "resourceSets:9" }], exclude: [] }
+          }
+        ]
+      }
+    });
+    assert.equal(result.accepted, false);
+    assert.equal(result.accepted === false && result.reason, "unsupported-body");
+  });
+});
~~~~

### new · `src/lib/capabilities/templates/test/unit/stages.test.ts` (+377 / −0)

~~~~diff
@@ -0,0 +1,377 @@
+import assert from "node:assert/strict";
+import { beforeEach, describe, test, vi } from "vitest";
+
+type Row = Record<string, unknown> & { _id: string; _creationTime: number };
+
+const model = vi.hoisted(() => ({
+  scope: { projectId: "p", userId: "u", username: "Uma" },
+  tables: {} as Record<string, Row[]>,
+  store: {
+    create: (table: string, fields: unknown) => {
+      const rows = (model.tables[table] ??= []);
+      const id = `${table}:${rows.length + 1}`;
+      rows.push({ ...(fields as Record<string, unknown>), _id: id, _creationTime: 1 });
+      return id;
+    },
+    createMany: (table: string, fields: readonly unknown[]) =>
+      fields.map((entry) => model.store.create(table, entry)),
+    removeRows: (table: string, ids: readonly string[]) => {
+      const rows = model.tables[table] ?? [];
+      if (ids.some((id) => !rows.some((row) => row._id === id))) throw new Error(`no '${table}' row`);
+      model.tables[table] = rows.filter((row) => !ids.includes(row._id));
+    },
+    removeFieldFromRows: (table: string, ids: readonly string[], field: string) => {
+      for (const row of model.tables[table] ?? []) if (ids.includes(row._id)) delete row[field];
+    },
+    read: (path: string) => {
+      const [table] = path.split(".");
+      return { table, kind: "table", rows: model.tables[table] ?? [] };
+    },
+    update: (path: string, value: unknown) => {
+      const [table, id, ...fields] = path.split(".");
+      const rows = model.tables[table] ?? [];
+      const index = rows.findIndex((row) => row._id === id);
+      if (index < 0) throw new Error(`no row ${path}`);
+      rows[index] =
+        fields.length === 0
+          ? { ...(value as Record<string, unknown>), _id: id, _creationTime: rows[index]._creationTime }
+          : { ...rows[index], [fields[0]]: value };
+    },
+    remove: (path: string) => {
+      const [table, id] = path.split(".");
+      const rows = model.tables[table] ?? [];
+      const index = rows.findIndex((row) => row._id === id);
+      if (index < 0) throw new Error(`no row ${path}`);
+      rows.splice(index, 1);
+    }
+  }
+}));
+
+vi.mock("$runtime/server/start.server", () => ({ serverModel: () => model }));
+vi.mock("$runtime/server/scope.server", () => ({
+  requireScope: () => Promise.resolve(model.scope)
+}));
+
+const { openTemplateStage } = await import(
+  "$capabilities/templates/api/open-template-stage/open-template-stage"
+);
+const { commitTemplateStage } = await import(
+  "$capabilities/templates/api/commit-template-stage/commit-template-stage"
+);
+const { discardTemplateStage } = await import(
+  "$capabilities/templates/api/discard-template-stage/discard-template-stage"
+);
+const { readResourceTemplate } = await import(
+  "$capabilities/templates/api/read-resource-template/read-resource-template"
+);
+const { readTemplateLibrary } = await import(
+  "$capabilities/templates/api/read-template-library/read-template-library"
+);
+const { readTemplate } = await import("$capabilities/templates/api/read-template/read-template");
+const { removeTemplate } = await import(
+  "$capabilities/templates/api/remove-template/remove-template"
+);
+const { updateTemplate } = await import(
+  "$capabilities/templates/api/update-template/update-template"
+);
+
+const text = (id: string, display: string) => ({
+  id,
+  type: "text",
+  variant: "paragraph",
+  atoms: [{ id: `${id}-a`, kind: "literal", text: display }],
+  display,
+  marks: []
+});
+
+const documentBody = {
+  resource: "document",
+  rows: [{ id: "r1", kind: "blocks", blocks: [text("b1", "Incident write-up")] }]
+};
+
+const deckBody = {
+  resource: "slides",
+  aspectRatio: "16:9",
+  theme: { colors: { text: "ink", accent: "blue" } },
+  styles: { defaultKey: "body", styles: { body: { name: "Body" } } },
+  layouts: [],
+  slides: [{ id: "s1", elements: [], notes: [] }],
+  sections: []
+};
+
+const row = (table: string, id: string, fields: Record<string, unknown>): Row => ({
+  ...fields,
+  _id: `${table}:${id}`,
+  _creationTime: 1
+});
+
+const template = (id: string, body: unknown = documentBody, extra: Record<string, unknown> = {}): Row =>
+  row("templates", id, {
+    projectId: "p",
+    userId: "u",
+    name: `Template ${id}`,
+    tags: [],
+    body,
+    holes: [],
+    createdBy: { kind: "user", userId: "u" },
+    revision: 2,
+    updatedAt: 20,
+    ...extra
+  });
+
+beforeEach(() => {
+  vi.spyOn(Date, "now").mockReturnValue(500);
+  model.scope = { projectId: "p", userId: "u", username: "Uma" };
+  model.tables = {
+    users: [{ _id: "u", _creationTime: 1, displayName: "Uma" }],
+    memberships: [row("memberships", "1", { userId: "u", projectId: "p", token: "u", role: "owner" })],
+    templates: [template("1"), template("2", deckBody)],
+    templateVersions: [],
+    templateStages: [],
+    resourceSets: [],
+    documents: [],
+    documentSnapshots: [],
+    documentChangeSets: [],
+    slideDecks: [],
+    slideDeckSnapshots: [],
+    slideDeckChangeSets: [],
+    spreadsheets: [],
+    commentThreads: [],
+    comments: []
+  };
+});
+
+describe("opening a stage", () => {
+  test("makes a scratch document holding the template body and a stage row, once", async () => {
+    const opened = await openTemplateStage({ templateId: "templates:1" });
+    assert.deepEqual(opened, {
+      accepted: true,
+      stageId: "templateStages:1",
+      templateId: "templates:1",
+      templateRevision: 2,
+      target: "document",
+      resourceId: "documents:1",
+      reused: false
+    });
+    assert.equal(model.tables.documents[0].title, "Template · Template 1");
+    assert.equal("templateId" in model.tables.documents[0], false);
+    assert.deepEqual(model.tables.documentSnapshots[0].body, { rows: documentBody.rows });
+    assert.deepEqual(model.tables.templateStages[0], {
+      _id: "templateStages:1",
+      _creationTime: 1,
+      projectId: "p",
+      templateId: "templates:1",
+      templateRevision: 2,
+      target: "document",
+      resourceId: "documents:1",
+      createdBy: { kind: "user", userId: "u" },
+      updatedAt: 500
+    });
+
+    const again = await openTemplateStage({ templateId: "templates:1" });
+    assert.deepEqual(again, { ...opened, reused: true });
+    assert.equal(model.tables.documents.length, 1);
+
+    const library = await readTemplateLibrary();
+    assert.deepEqual(library.templates.map((item) => item.id), ["templates:1", "templates:2"]);
+    const detail = await readTemplate({ templateId: "templates:1" });
+    assert.ok(detail !== null && !("unavailable" in detail));
+    assert.equal("stage" in detail, false);
+  });
+
+  test("is shared by everyone in the project rather than kept per viewer", async () => {
+    const opened = await openTemplateStage({ templateId: "templates:1" });
+    assert.ok(opened.accepted);
+    const read = await readResourceTemplate({ resourceId: "documents:1" });
+    assert.equal(read.stage?.stageId, "templateStages:1");
+    assert.equal("mine" in (read.stage ?? {}), false);
+
+    model.scope = { projectId: "p", userId: "v", username: "Victor" };
+    const saved = await commitTemplateStage({ stageId: "templateStages:1", baseRevision: 2 });
+    assert.equal(saved.accepted, true);
+    assert.equal(model.tables.templates[0].revision, 3);
+  });
+
+  test("a name or hole edit carries every stage of the template to the new revision", async () => {
+    await openTemplateStage({ templateId: "templates:1" });
+    const renamed = await updateTemplate({
+      templateId: "templates:1",
+      baseRevision: 2,
+      patch: { name: "Renamed" }
+    });
+    assert.ok(renamed.accepted);
+    assert.equal(model.tables.templateStages[0].templateRevision, 3);
+    const read = await readResourceTemplate({ resourceId: "documents:1" });
+    assert.equal(read.stage?.stagedRevision, 3);
+    assert.equal(read.stage?.currentRevision, 3);
+  });
+
+  test("stages a deck template as a deck and refuses a spreadsheet", async () => {
+    const opened = await openTemplateStage({ templateId: "templates:2" });
+    assert.ok(opened.accepted);
+    assert.equal(opened.target, "slides");
+    assert.equal(model.tables.slideDecks[0].title, "Template · Template 2");
+    assert.equal((model.tables.slideDeckSnapshots[0].body as { slides: unknown[] }).slides.length, 1);
+
+    model.tables.templates.push(
+      template("3", {
+        resource: "spreadsheet",
+        cells: {},
+        formatRules: [],
+        print: { page: { paper: "letter", orientation: "portrait", margins: { top: 1, right: 1, bottom: 1, left: 1 } } },
+        styles: { defaultKey: "body", styles: { body: { name: "Body" } } }
+      })
+    );
+    const refused = await openTemplateStage({ templateId: "templates:3" });
+    assert.deepEqual(refused, {
+      accepted: false,
+      templateId: "templates:3",
+      reason: "unsupported-body",
+      revision: 2,
+      detail: "a spreadsheet template opens for editing once the spreadsheet editor lands"
+    });
+  });
+});
+
+describe("reading what a resource is", () => {
+  test("names the stage, and nothing for a plain resource", async () => {
+    await openTemplateStage({ templateId: "templates:1" });
+    model.tables.documents.push(row("documents", "10", { projectId: "p", title: "Plain" }));
+
+    assert.deepEqual(await readResourceTemplate({ resourceId: "documents:1" }), {
+      resourceId: "documents:1",
+      stage: {
+        stageId: "templateStages:1",
+        templateId: "templates:1",
+        templateName: "Template 1",
+        target: "document",
+        stagedRevision: 2,
+        currentRevision: 2
+      }
+    });
+    assert.deepEqual(await readResourceTemplate({ resourceId: "documents:10" }), {
+      resourceId: "documents:10",
+      stage: null
+    });
+  });
+});
+
+describe("saving a stage", () => {
+  test("writes the scratch body into the template as the next revision, made portable", async () => {
+    await openTemplateStage({ templateId: "templates:1" });
+    model.tables.documentSnapshots[0].body = {
+      rows: [
+        {
+          id: "r1",
+          kind: "blocks",
+          blocks: [
+            {
+              ...text("b1", "Edited"),
+              marks: [
+                { id: "m1", from: { atom: "b1-a", offset: 0 }, to: { atom: "b1-a", offset: 2 }, link: { kind: "resource", ref: { kind: "document", id: "documents:4" } } }
+              ]
+            },
+            {
+              id: "p1",
+              type: "prompt",
+              atoms: [{ id: "p1-a", kind: "literal", text: "Sum up" }],
+              display: "Sum up",
+              marks: [],
+              scope: { include: [{ select: "hole", name: "evidence" }], exclude: [] },
+              state: "idle"
+            }
+          ]
+        }
+      ]
+    };
+
+    const saved = await commitTemplateStage({ stageId: "templateStages:1", baseRevision: 2 });
+    assert.deepEqual(saved, {
+      accepted: true,
+      stageId: "templateStages:1",
+      templateId: "templates:1",
+      revision: 3,
+      dropped: ["Dropped a link to something in the project."]
+    });
+    const held = model.tables.templates[0];
+    assert.equal(held.revision, 3);
+    assert.deepEqual((held.body as { rows: unknown[] }).rows.length, 1);
+    assert.deepEqual(held.holes, [{ name: "evidence", label: "evidence" }]);
+    assert.equal(model.tables.templateVersions.length, 1);
+    assert.equal(model.tables.templateStages[0].templateRevision, 3);
+
+    const stale = await commitTemplateStage({ stageId: "templateStages:1", baseRevision: 2 });
+    assert.equal(stale.accepted, false);
+    assert.equal(stale.accepted === false && stale.reason, "stale");
+  });
+
+  test("saves a deck stage back however many slides it holds now", async () => {
+    await openTemplateStage({ templateId: "templates:2" });
+    model.tables.slideDeckSnapshots[0].body = {
+      ...deckBody,
+      slides: [
+        { id: "s1", elements: [], notes: [] },
+        { id: "s2", elements: [], notes: [] }
+      ]
+    };
+    delete (model.tables.slideDeckSnapshots[0].body as Record<string, unknown>).resource;
+
+    const saved = await commitTemplateStage({ stageId: "templateStages:1", baseRevision: 2 });
+    assert.ok(saved.accepted);
+    assert.equal((model.tables.templates[1].body as { slides: unknown[] }).slides.length, 2);
+  });
+
+  test("refuses to save a stage from another project", async () => {
+    await openTemplateStage({ templateId: "templates:1" });
+    model.scope = { projectId: "other", userId: "u", username: "Uma" };
+    const saved = await commitTemplateStage({ stageId: "templateStages:1", baseRevision: 2 });
+    assert.equal(saved.accepted === false && saved.reason, "not-found");
+  });
+});
+
+describe("discarding a stage", () => {
+  test("removes the stage and everything the scratch resource accumulated", async () => {
+    await openTemplateStage({ templateId: "templates:1" });
+    model.tables.documentChangeSets.push(
+      row("documentChangeSets", "1", { projectId: "p", resourceId: "documents:1", revision: 1 })
+    );
+    model.tables.commentThreads.push(
+      row("commentThreads", "1", { projectId: "p", target: { kind: "document", id: "documents:1" } }),
+      row("commentThreads", "2", { projectId: "p", target: { kind: "document", id: "documents:7" } })
+    );
+    model.tables.comments.push(
+      row("comments", "1", { projectId: "p", threadId: "commentThreads:1" }),
+      row("comments", "2", { projectId: "p", threadId: "commentThreads:2" })
+    );
+
+    const discarded = await discardTemplateStage({ stageId: "templateStages:1" });
+    assert.deepEqual(discarded, {
+      accepted: true,
+      stageId: "templateStages:1",
+      templateId: "templates:1",
+      target: "document",
+      resourceId: "documents:1"
+    });
+    assert.deepEqual(model.tables.templateStages, []);
+    assert.deepEqual(model.tables.documents, []);
+    assert.deepEqual(model.tables.documentSnapshots, []);
+    assert.deepEqual(model.tables.documentChangeSets, []);
+    assert.deepEqual(model.tables.commentThreads.map((thread) => thread._id), ["commentThreads:2"]);
+    assert.deepEqual(model.tables.comments.map((comment) => comment._id), ["comments:2"]);
+  });
+
+  test("goes with the template when the template is deleted, and is out of reach from another project", async () => {
+    await openTemplateStage({ templateId: "templates:1" });
+
+    model.scope = { projectId: "other", userId: "u", username: "Uma" };
+    const elsewhere = await removeTemplate({ templateId: "templates:1", baseRevision: 2 });
+    assert.equal(elsewhere.accepted === false && elsewhere.reason, "not-found");
+
+    model.scope = { projectId: "p", userId: "u", username: "Uma" };
+    const here = await removeTemplate({ templateId: "templates:1", baseRevision: 2 });
+    assert.equal(here.accepted, true);
+    assert.deepEqual(model.tables.templateStages, []);
+    assert.deepEqual(model.tables.documents, []);
+    assert.deepEqual(model.tables.templates.map((held) => held._id), ["templates:2"]);
+  });
+});
~~~~

### changed · `src/lib/capabilities/templates/test/unit/templates.test.ts` (+89 / −122)

~~~~diff
@@ -118,7 +118,7 @@ const { removeTemplate } = await import(
 const { updateTemplate } = await import(
   "$capabilities/templates/api/update-template/update-template"
 );
-const { bodyOf, variablesOf } = await import(
+const { bodyOf, holesOf } = await import(
   "$capabilities/templates/api/shared/validation"
 );
 
@@ -168,11 +168,12 @@ const template = (
   extra: Record<string, unknown> = {}
 ): Row =>
   row("templates", id, {
+    projectId: "p",
     userId: owner,
     name: `Template ${id}`,
     tags: ["Useful"],
     body,
-    variables: [],
+    holes: [],
     createdBy: { kind: "user", userId: owner },
     revision: 2,
     updatedAt: 20,
@@ -227,12 +228,12 @@ describe("the project library", () => {
     assert.equal(answer.templates[0].createdByName, "Someone");
   });
 
-  test("quarantines duplicate ids across owners and tolerates malformed resource rows", async () => {
+  test("quarantines duplicate ids across projects and tolerates malformed resource rows", async () => {
     model.tables.templates.push(
       template("1", "u", documentBody, {
         createdBy: { kind: "user", userId: "x" }
       }),
-      template("1", "v", slidesBody)
+      template("1", "v", slidesBody, { projectId: "other" })
     );
     model.tables.documents.push(null as unknown as Row);
 
@@ -262,50 +263,34 @@ describe("the project library", () => {
     assert.equal("projectId" in answer, false);
   });
 
-  test("projects only owner-visible templates with project-local recency", async () => {
+  test("projects only this project's templates with project-local recency", async () => {
     model.tables.templates.push(
-      template("1", "u", documentBody, { name: "Mine", updatedAt: 30 }),
-      template("2", "v", slidesBody, { name: "Shared", updatedAt: 40 }),
-      template("3", "x", documentBody, { name: "Hidden", updatedAt: 50 })
-    );
-    model.tables.documents.push(
-      row("documents", "1", {
-        projectId: "p",
-        templateId: "templates:1",
-        updatedAt: 800,
-        _creationTime: 80
-      }),
-      row("documents", "2", {
-        projectId: "other",
-        templateId: "templates:1",
-        updatedAt: 999,
-        _creationTime: 999
-      })
-    );
-    model.tables.slideDecks.push(
-      row("slideDecks", "1", {
-        projectId: "p",
-        templateId: "templates:2",
-        updatedAt: 900,
-        _creationTime: 90
-      })
+      template("1", "u", documentBody, { name: "Mine", updatedAt: 30, lastUsedAt: 80 }),
+      template("2", "v", slidesBody, { name: "Shared", updatedAt: 40, lastUsedAt: 90 }),
+      template("3", "x", documentBody, { name: "Hidden", updatedAt: 50, projectId: "other" })
     );
 
     const answer = await readTemplateLibrary();
 
     assert.equal(model.calls[0], "scope");
-    assert.deepEqual(answer.templates.map((item) => item.id), ["templates:1"]);
+    assert.deepEqual(answer.templates.map((item) => item.id), ["templates:2", "templates:1"]);
     assert.deepEqual(
       answer.templates.map((item) => [item.availability, item.createdByName, item.lastUsedAt]),
-      [["personal", "Uma", 80]]
+      [
+        ["project", "Victor", 90],
+        ["project", "Uma", 80]
+      ]
     );
     assert.equal(answer.templates[0].canEdit, true);
     assert.equal(answer.templates[0].canDelete, true);
     assert.deepEqual(answer.unavailable, []);
   });
 
-  test("reads an owned full body and does not disclose another user's template", async () => {
-    model.tables.templates.push(template("1", "u", slidesBody), template("2", "v"));
+  test("reads a full body and does not disclose another project's template", async () => {
+    model.tables.templates.push(
+      template("1", "u", slidesBody),
+      template("2", "v", documentBody, { projectId: "other" })
+    );
 
     const answer = await readTemplate({ templateId: "templates:1" });
     assert.ok(answer !== null && !("unavailable" in answer));
@@ -369,8 +354,11 @@ describe("template mutations", () => {
     assert.deepEqual(model.tables.templateVersions.map((version) => version.revision), [1, 1, 1]);
   });
 
-  test("updates only an owner's current revision and snapshots the accepted result", async () => {
-    model.tables.templates.push(template("1", "u"), template("2", "v"));
+  test("updates only this project's current revision and snapshots the accepted result", async () => {
+    model.tables.templates.push(
+      template("1", "u"),
+      template("2", "v", documentBody, { projectId: "other" })
+    );
 
     assert.deepEqual(
       await updateTemplate({ templateId: "templates:1", baseRevision: 1, patch: { name: "Stale" } }),
@@ -403,10 +391,10 @@ describe("template mutations", () => {
     assert.equal(model.tables.templateVersions[0].revision, 3);
   });
 
-  test("updates variable prose without exposing its stable key or default to editing", async () => {
+  test("updates hole prose without exposing its stable key or default to editing", async () => {
     model.tables.templates.push(
       template("1", "u", documentBody, {
-        variables: [
+        holes: [
           {
             name: "evidence",
             label: "Evidence",
@@ -421,12 +409,12 @@ describe("template mutations", () => {
       templateId: "templates:1",
       baseRevision: 2,
       patch: {
-        variableDescription: { name: "evidence", description: "  Choose the evidence set.  " }
+        holeDescription: { name: "evidence", description: "  Choose the evidence set.  " }
       }
     });
 
     assert.deepEqual(answer, { accepted: true, templateId: "templates:1", revision: 3 });
-    assert.deepEqual(model.tables.templates[0].variables, [
+    assert.deepEqual(model.tables.templates[0].holes, [
       {
         name: "evidence",
         label: "Evidence",
@@ -445,10 +433,11 @@ describe("template mutations", () => {
     assert.equal(answer.accepted, true);
     const copy = model.tables.templates.find((candidate) => candidate._id === "templates:2");
     assert.equal(copy?.userId, "u");
+    assert.equal(copy?.projectId, "p");
     assert.equal(copy?.name, "My copy");
     assert.deepEqual(copy?.createdBy, { kind: "user", userId: "u" });
     assert.notEqual(copy?.body, model.tables.templates[0].body);
-    assert.notEqual(copy?.variables, model.tables.templates[0].variables);
+    assert.notEqual(copy?.holes, model.tables.templates[0].holes);
     assert.equal(model.tables.templateVersions.length, 1);
   });
 
@@ -508,28 +497,16 @@ describe("template mutations", () => {
     assert.equal(typeof copy?.name === "string" && copy.name.endsWith(" copy"), true);
   });
 
-  test("refuses cross-project dangling provenance, then deletes after clearing local provenance", async () => {
+  test("deletes a template with its versions and leaves the resources made from it alone", async () => {
     model.tables.templates.push(template("1", "u"));
     model.tables.templateVersions.push(
       row("templateVersions", "1", { templateId: "templates:1", revision: 1 }),
       row("templateVersions", "2", { templateId: "templates:1", revision: 2 })
     );
     model.tables.documents.push(
-      row("documents", "1", { projectId: "p", templateId: "templates:1", updatedAt: 1 }),
-      row("documents", "2", { projectId: "other", templateId: "templates:1", updatedAt: 1 })
+      row("documents", "1", { projectId: "p", title: "Made from it", updatedAt: 1 })
     );
 
-    assert.deepEqual(await removeTemplate({ templateId: "templates:1", baseRevision: 2 }), {
-      accepted: false,
-      templateId: "templates:1",
-      reason: "in-use-elsewhere",
-      revision: 2,
-      detail: "this template is referenced outside the current project and cannot be deleted here"
-    });
-    assert.equal(model.tables.templates.length, 1);
-    assert.equal(model.tables.templateVersions.length, 2);
-
-    delete model.tables.documents[1].templateId;
     assert.deepEqual(await removeTemplate({ templateId: "templates:1", baseRevision: 2 }), {
       accepted: true,
       templateId: "templates:1",
@@ -537,15 +514,12 @@ describe("template mutations", () => {
     });
     assert.equal(model.tables.templates.length, 0);
     assert.equal(model.tables.templateVersions.length, 0);
-    assert.equal("templateId" in model.tables.documents[0], false);
-    assert.equal("templateId" in model.tables.documents[1], false);
+    assert.equal(model.tables.documents.length, 1);
+    assert.equal(model.tables.documents[0].title, "Made from it");
   });
 
-  test("preflights corrupt version ids before detaching local provenance", async () => {
+  test("preflights corrupt version ids before removing anything", async () => {
     model.tables.templates.push(template("1", "u"));
-    model.tables.documents.push(
-      row("documents", "1", { projectId: "p", templateId: "templates:1", updatedAt: 1 })
-    );
     model.tables.templateVersions.push({
       _id: "templateVersions:bad.path",
       _creationTime: 1,
@@ -558,32 +532,10 @@ describe("template mutations", () => {
     assert.equal(answer.accepted, false);
     assert.equal(answer.accepted ? "" : answer.reason, "unsupported-body");
     assert.equal(model.tables.templates.length, 1);
-    assert.equal(model.tables.documents[0].templateId, "templates:1");
     assert.equal(model.tables.templateVersions.length, 1);
     assert.equal(model.calls.some((call) => call.startsWith("remove")), false);
   });
 
-  test("refuses ambiguous ancillary ids before a batch can touch another claimant", async () => {
-    model.tables.templates.push(template("1", "u"));
-    model.tables.documents.push(
-      row("documents", "1", { projectId: "p", templateId: "templates:1", updatedAt: 1 }),
-      row("documents", "1", { projectId: "other", templateId: "templates:other", updatedAt: 1 })
-    );
-    model.tables.templateVersions.push(
-      row("templateVersions", "1", { templateId: "templates:1", revision: 2 })
-    );
-
-    const answer = await removeTemplate({ templateId: "templates:1", baseRevision: 2 });
-
-    assert.equal(answer.accepted, false);
-    assert.equal(answer.accepted ? "" : answer.reason, "unsupported-body");
-    assert.match(answer.accepted ? "" : answer.detail, /provenance id is ambiguous/);
-    assert.equal(model.tables.templates.length, 1);
-    assert.equal(model.tables.documents[0].templateId, "templates:1");
-    assert.equal(model.tables.documents[1].templateId, "templates:other");
-    assert.equal(model.calls.some((call) => call.startsWith("remove")), false);
-  });
-
   test("refuses an ambiguous version id before deleting another template's history", async () => {
     model.tables.templates.push(template("1", "u"));
     model.tables.templateVersions.push(
@@ -638,7 +590,7 @@ describe("instantiation", () => {
     assert.equal(model.tables.documentSnapshots.length, 0);
   });
 
-  test("creates ordinary document and slide-deck rows with leader snapshots and provenance", async () => {
+  test("creates ordinary document and slide-deck rows with leader snapshots and no provenance", async () => {
     model.tables.templates.push(template("1", "u"), template("2", "u", slidesBody));
 
     const document = await instantiateTemplate({ templateId: "templates:1", name: "Brief" });
@@ -646,13 +598,15 @@ describe("instantiation", () => {
 
     assert.equal(document.accepted && document.target, "document");
     assert.equal(slides.accepted && slides.target, "slides");
-    assert.equal(model.tables.documents[0].templateId, "templates:1");
+    assert.equal("templateId" in model.tables.documents[0], false);
     assert.equal(model.tables.documentSnapshots[0].role, "leader");
-    assert.equal(model.tables.slideDecks[0].templateId, "templates:2");
+    assert.equal("templateId" in model.tables.slideDecks[0], false);
     assert.equal(model.tables.slideDeckSnapshots[0].revision, 0);
     const readyDeck = model.tables.slideDeckSnapshots[0].body as { slides: { id: string }[] };
     assert.equal(readyDeck.slides.length, 1);
     assert.match(readyDeck.slides[0].id, /^slide-/);
+    assert.equal(model.tables.templates[0].lastUsedAt, 500);
+    assert.equal(model.tables.templates[0].revision, 2);
     assert.notEqual(model.tables.documents[0].createdBy, model.tables.documents[0].updatedBy);
     assert.notEqual(model.tables.slideDecks[0].createdBy, model.tables.slideDecks[0].updatedBy);
   });
@@ -702,7 +656,7 @@ describe("instantiation", () => {
     assert.equal(model.calls.some((call) => call === "create sheetCells"), false);
   });
 
-  test("does not invent a variable-answer contract", async () => {
+  test("does not invent a hole-answer contract", async () => {
     model.tables.templates.push(
       template(
         "1",
@@ -721,7 +675,7 @@ describe("instantiation", () => {
                   display: "",
                   marks: [],
                   scope: {
-                    include: [{ select: "variable", name: "region" }],
+                    include: [{ select: "hole", name: "region" }],
                     exclude: []
                   },
                   state: "idle"
@@ -730,21 +684,20 @@ describe("instantiation", () => {
             }
           ]
         },
-        { variables: [{ name: "region", label: "Region" }] }
+        { holes: [{ name: "region", label: "Region" }] }
       )
     );
 
     const answer = await instantiateTemplate({ templateId: "templates:1" });
 
-    assert.deepEqual(answer, {
-      accepted: false,
-      templateId: "templates:1",
-      reason: "variables-required",
-      revision: 2,
-      detail: "one or more template variables need answers and have no usable default",
-      variables: ["region"]
+    assert.equal(answer.accepted, true);
+    const made = model.tables.documentSnapshots[0].body as {
+      rows: { blocks: { scope: unknown }[] }[];
+    };
+    assert.deepEqual(made.rows[0].blocks[0].scope, {
+      include: [{ select: "project" }],
+      exclude: []
     });
-    assert.equal(model.tables.documents.length, 0);
   });
 
   test("uses represented defaults without asking for an invented value shape", async () => {
@@ -766,7 +719,7 @@ describe("instantiation", () => {
                   display: "",
                   marks: [],
                   scope: {
-                    include: [{ select: "variable", name: "evidence" }],
+                    include: [{ select: "hole", name: "evidence" }],
                     exclude: []
                   },
                   state: "idle"
@@ -778,7 +731,7 @@ describe("instantiation", () => {
                   display: "",
                   marks: [],
                   scope: {
-                    include: [{ select: "variable", name: "evidence" }],
+                    include: [{ select: "hole", name: "evidence" }],
                     exclude: []
                   },
                   state: "idle"
@@ -788,7 +741,7 @@ describe("instantiation", () => {
           ]
         },
         {
-          variables: [
+          holes: [
             {
               name: "evidence",
               label: "Evidence",
@@ -821,7 +774,7 @@ describe("instantiation", () => {
   });
 
   test("bounds recursively expanding represented defaults before writing", async () => {
-    const variables = Array.from({ length: 16 }, (_, index) => ({
+    const holes = Array.from({ length: 16 }, (_, index) => ({
       name: `branch-${index}`,
       label: `Branch ${index}`,
       default:
@@ -829,8 +782,8 @@ describe("instantiation", () => {
           ? { include: [{ select: "project" as const }], exclude: [] }
           : {
               include: [
-                { select: "variable" as const, name: `branch-${index + 1}` },
-                { select: "variable" as const, name: `branch-${index + 1}` }
+                { select: "hole" as const, name: `branch-${index + 1}` },
+                { select: "hole" as const, name: `branch-${index + 1}` }
               ],
               exclude: []
             }
@@ -853,7 +806,7 @@ describe("instantiation", () => {
                   display: "",
                   marks: [],
                   scope: {
-                    include: [{ select: "variable", name: "branch-0" }],
+                    include: [{ select: "hole", name: "branch-0" }],
                     exclude: []
                   },
                   state: "idle"
@@ -862,7 +815,7 @@ describe("instantiation", () => {
             }
           ]
         },
-        { variables }
+        { holes }
       )
     );
 
@@ -874,7 +827,7 @@ describe("instantiation", () => {
     assert.equal(model.tables.documents.length, 0);
   });
 
-  test("refuses a variable-set difference rather than broadening its scope", async () => {
+  test("refuses a hole-set difference rather than broadening its scope", async () => {
     model.tables.templates.push(
       template(
         "1",
@@ -894,7 +847,7 @@ describe("instantiation", () => {
                   marks: [],
                   scope: {
                     include: [{ select: "kinds", kinds: ["document"] }],
-                    exclude: [{ select: "variable", name: "other-material" }]
+                    exclude: [{ select: "hole", name: "other-material" }]
                   },
                   state: "idle"
                 }
@@ -903,7 +856,7 @@ describe("instantiation", () => {
           ]
         },
         {
-          variables: [
+          holes: [
             {
               name: "other-material",
               label: "Other material",
@@ -1007,7 +960,7 @@ describe("stored template validation", () => {
     assert.doesNotThrow(() => bodyOf(body, "record-keys"));
   });
 
-  test("accepts only canonical represented variables and bounded templated defaults", () => {
+  test("accepts only canonical represented holes and bounded templated defaults", () => {
     const valid = [
       {
         name: "region",
@@ -1017,9 +970,14 @@ describe("stored template validation", () => {
           include: [{ select: "kinds", kinds: ["finding", "document"] }],
           exclude: [{ select: "project" }]
         }
+      },
+      {
+        name: "evidence",
+        label: "Evidence",
+        default: { include: [{ select: "set", setId: "resourceSets:1" }], exclude: [] }
       }
     ];
-    assert.equal(variablesOf(valid, "test").length, 1);
+    assert.equal(holesOf(valid, "test").length, 2);
 
     const invalid = [
       [{ ...valid[0], invented: true }],
@@ -1057,7 +1015,16 @@ describe("stored template validation", () => {
         {
           ...valid[0],
           default: {
-            include: [{ select: "variable", name: "Region" }],
+            include: [{ select: "hole", name: "Region" }],
+            exclude: []
+          }
+        }
+      ],
+      [
+        {
+          ...valid[0],
+          default: {
+            include: [{ select: "set", setId: "sets:1" }],
             exclude: []
           }
         }
@@ -1067,29 +1034,29 @@ describe("stored template validation", () => {
         { name: "Region", label: "Duplicate by case" }
       ]
     ];
-    for (const variables of invalid) {
-      assert.throws(() => variablesOf(variables, "test"), /templates\/test:/);
+    for (const holes of invalid) {
+      assert.throws(() => holesOf(holes, "test"), /templates\/test:/);
     }
   });
 
-  test("requires exact case for one variable default referencing another", () => {
+  test("requires exact case for one hole default referencing another", () => {
     assert.throws(
       () =>
-        variablesOf(
+        holesOf(
           [
             { name: "region", label: "Region" },
             {
               name: "evidence",
               label: "Evidence",
               default: {
-                include: [{ select: "variable", name: "Region" }],
+                include: [{ select: "hole", name: "Region" }],
                 exclude: []
               }
             }
           ],
           "test"
         ),
-      /default names a declared variable/
+      /default names a declared hole/
     );
   });
 
@@ -1398,7 +1365,7 @@ describe("stored template validation", () => {
     }
   });
 
-  test("keeps body variable lookup exact when declarations differ only by case", async () => {
+  test("keeps body hole lookup exact when declarations differ only by case", async () => {
     model.tables.templates.push(
       template(
         "1",
@@ -1417,7 +1384,7 @@ describe("stored template validation", () => {
                   display: "",
                   marks: [],
                   scope: {
-                    include: [{ select: "variable", name: "Region" }],
+                    include: [{ select: "hole", name: "Region" }],
                     exclude: []
                   },
                   state: "idle"
@@ -1427,7 +1394,7 @@ describe("stored template validation", () => {
           ]
         },
         {
-          variables: [
+          holes: [
             {
               name: "region",
               label: "Region",
@@ -1441,7 +1408,7 @@ describe("stored template validation", () => {
     const answer = await instantiateTemplate({ templateId: "templates:1" });
 
     assert.equal(answer.accepted, false);
-    assert.equal(answer.accepted ? "" : answer.reason, "variables-required");
-    assert.deepEqual(answer.accepted ? [] : answer.variables, ["Region"]);
+    assert.equal(answer.accepted ? "" : answer.reason, "unsupported-body");
+    assert.match(answer.accepted ? "" : answer.detail, /does not declare: Region/);
   });
 });
~~~~

### changed · `src/lib/capabilities/templates/types/templates.ts` (+118 / −22)

~~~~diff
@@ -1,17 +1,17 @@
+import type { ResourceSet } from "$representation/data/types/core/resource-set";
 import type {
   TemplateBody,
-  TemplateVariable
+  TemplateHole
 } from "$representation/data/types/templates/template";
 
 export type TemplateTarget = TemplateBody["resource"];
 
-/**
- * `project` is reserved for a represented project-owned template set. Until
- * that ownership model exists, the capability returns only `personal` (the
- * viewer owns it). There is no generic Shared state in the current contract.
- */
+export type TemplateStageTarget = Exclude<TemplateTarget, "spreadsheet">;
+
 export type TemplateAvailability = "project" | "personal";
 
+export type TemplateAnswers = Readonly<Record<string, ResourceSet>>;
+
 export type TemplateLibraryItem = {
   readonly id: string;
   readonly name: string;
@@ -19,7 +19,7 @@ export type TemplateLibraryItem = {
   readonly target: TemplateTarget;
   readonly availability: TemplateAvailability;
   readonly tags: readonly string[];
-  readonly variableCount: number;
+  readonly holeCount: number;
   readonly createdByName: string;
   readonly revision: number;
   readonly updatedAt: number;
@@ -28,9 +28,9 @@ export type TemplateLibraryItem = {
   readonly canDelete: boolean;
 };
 
-export type TemplateDetail = Omit<TemplateLibraryItem, "variableCount"> & {
+export type TemplateDetail = Omit<TemplateLibraryItem, "holeCount"> & {
   readonly body: TemplateBody;
-  readonly variables: readonly TemplateVariable[];
+  readonly holes: readonly TemplateHole[];
 };
 
 export type TemplateUnavailable = {
@@ -62,16 +62,39 @@ export type CreateTemplateResult = {
   readonly revision: 1;
 };
 
+export type CreateTemplateFromResourceInput = {
+  readonly target: TemplateStageTarget;
+  readonly resourceId: string;
+  readonly name: string;
+  readonly description?: string;
+  readonly tags?: readonly string[];
+  readonly slideId?: string;
+};
+
+export type CreateTemplateFromResourceResult =
+  | {
+      readonly accepted: true;
+      readonly templateId: string;
+      readonly target: TemplateStageTarget;
+      readonly revision: 1;
+      readonly dropped: readonly string[];
+    }
+  | {
+      readonly accepted: false;
+      readonly resourceId: string;
+      readonly reason: "not-found" | "unsupported-body";
+      readonly detail: string;
+    };
+
 export type UpdateTemplatePatch = {
   readonly name?: string;
-  /** `null` removes an existing description. */
   readonly description?: string | null;
   readonly tags?: readonly string[];
-  /** Changes one variable's prose without making its stable key client-editable. */
-  readonly variableDescription?: {
+  readonly holeDescription?: {
     readonly name: string;
     readonly description: string | null;
   };
+  readonly holes?: readonly TemplateHole[];
 };
 
 export type UpdateTemplateInput = {
@@ -85,7 +108,7 @@ export type UpdateTemplateResult =
   | {
       readonly accepted: false;
       readonly templateId: string;
-      readonly reason: "not-found" | "forbidden" | "stale" | "unsupported-body";
+      readonly reason: "not-found" | "stale" | "unsupported-body" | "hole-in-use";
       readonly revision: number | null;
       readonly detail: string;
     };
@@ -121,20 +144,19 @@ export type RemoveTemplateResult =
   | {
       readonly accepted: false;
       readonly templateId: string;
-      readonly reason:
-        | "not-found"
-        | "forbidden"
-        | "stale"
-        | "in-use-elsewhere"
-        | "unsupported-body";
+      readonly reason: "not-found" | "stale" | "unsupported-body";
       readonly revision: number | null;
       readonly detail: string;
     };
 
+/** What a caller typed into the template's text holes, by name. */
+export type TemplateTexts = Readonly<Record<string, string>>;
+
 export type InstantiateTemplateInput = {
   readonly templateId: string;
-  /** Defaults to the template name. */
   readonly name?: string;
+  readonly answers?: TemplateAnswers;
+  readonly texts?: TemplateTexts;
 };
 
 export type InstantiateTemplateResult =
@@ -149,8 +171,82 @@ export type InstantiateTemplateResult =
   | {
       readonly accepted: false;
       readonly templateId: string;
-      readonly reason: "not-found" | "variables-required" | "unsupported-body";
+      readonly reason: "not-found" | "unsupported-body";
+      readonly revision: number | null;
+      readonly detail: string;
+    };
+
+export type OpenTemplateStageInput = { readonly templateId: string };
+
+export type OpenTemplateStageResult =
+  | {
+      readonly accepted: true;
+      readonly stageId: string;
+      readonly templateId: string;
+      readonly templateRevision: number;
+      readonly target: TemplateStageTarget;
+      readonly resourceId: string;
+      readonly reused: boolean;
+    }
+  | {
+      readonly accepted: false;
+      readonly templateId: string;
+      readonly reason: "not-found" | "unsupported-body";
       readonly revision: number | null;
       readonly detail: string;
-      readonly variables?: readonly string[];
+    };
+
+export type ReadResourceTemplateInput = { readonly resourceId: string };
+
+export type ResourceTemplateStage = {
+  readonly stageId: string;
+  readonly templateId: string;
+  readonly templateName: string;
+  readonly target: TemplateStageTarget;
+  readonly stagedRevision: number;
+  readonly currentRevision: number | null;
+};
+
+export type ReadResourceTemplateResult = {
+  readonly resourceId: string;
+  readonly stage: ResourceTemplateStage | null;
+};
+
+export type CommitTemplateStageInput = {
+  readonly stageId: string;
+  readonly baseRevision: number;
+};
+
+export type CommitTemplateStageResult =
+  | {
+      readonly accepted: true;
+      readonly stageId: string;
+      readonly templateId: string;
+      readonly revision: number;
+      readonly dropped: readonly string[];
+    }
+  | {
+      readonly accepted: false;
+      readonly stageId: string;
+      readonly templateId: string | null;
+      readonly reason: "not-found" | "stale" | "unsupported-body";
+      readonly revision: number | null;
+      readonly detail: string;
+    };
+
+export type DiscardTemplateStageInput = { readonly stageId: string };
+
+export type DiscardTemplateStageResult =
+  | {
+      readonly accepted: true;
+      readonly stageId: string;
+      readonly templateId: string;
+      readonly target: TemplateStageTarget;
+      readonly resourceId: string;
+    }
+  | {
+      readonly accepted: false;
+      readonly stageId: string;
+      readonly reason: "not-found";
+      readonly detail: string;
     };
~~~~

## The resource-sets capability

### new · `src/lib/capabilities/resource-sets/api/create-resource-set/create-resource-set.ts` (+25 / −0)

~~~~diff
@@ -0,0 +1,25 @@
+import { requireScope } from "$runtime/server/scope.server";
+import { serverModel } from "$runtime/server/start.server";
+import { asId } from "$representation/data/behavior/core/id";
+
+import { validateCreateResourceSet } from "$capabilities/resource-sets/api/create-resource-set/validate-create-resource-set";
+import type { CreateResourceSetResult } from "$capabilities/resource-sets/types/resource-sets";
+
+export const createResourceSet = async (input: unknown): Promise<CreateResourceSetResult> => {
+  const scope = await requireScope();
+  const asked = validateCreateResourceSet(input);
+
+  const store = serverModel().store;
+  const actor = { kind: "user" as const, userId: asId<"users">(scope.userId) };
+  const setId = store.create("resourceSets", {
+    projectId: asId<"projects">(scope.projectId),
+    name: asked.name,
+    ...(asked.description === undefined ? {} : { description: asked.description }),
+    set: asked.set,
+    createdBy: actor,
+    revision: 1,
+    updatedAt: Date.now()
+  });
+
+  return { accepted: true, setId, revision: 1 };
+};
~~~~

### new · `src/lib/capabilities/resource-sets/api/create-resource-set/validate-create-resource-set.ts` (+22 / −0)

~~~~diff
@@ -0,0 +1,22 @@
+import {
+  descriptionOf,
+  fieldsOf,
+  has,
+  nameOf,
+  only,
+  resourceSetOf
+} from "$capabilities/resource-sets/api/shared/validation";
+import type { CreateResourceSetInput } from "$capabilities/resource-sets/types/resource-sets";
+
+export const validateCreateResourceSet = (input: unknown): CreateResourceSetInput => {
+  const fields = fieldsOf(input, "create-resource-set");
+  only(fields, ["name", "description", "set"], "create-resource-set");
+  const description = has(fields, "description")
+    ? descriptionOf(fields.description, "create-resource-set")
+    : undefined;
+  return {
+    name: nameOf(fields.name, "create-resource-set"),
+    ...(description === undefined || description === "" ? {} : { description }),
+    set: resourceSetOf(fields.set, "create-resource-set")
+  };
+};
~~~~

### new · `src/lib/capabilities/resource-sets/api/read-resource-sets/read-resource-sets.ts` (+10 / −0)

~~~~diff
@@ -0,0 +1,10 @@
+import { requireScope } from "$runtime/server/scope.server";
+import { serverModel } from "$runtime/server/start.server";
+
+import { projectSets } from "$capabilities/resource-sets/api/shared/projection";
+import type { ReadResourceSetsResult } from "$capabilities/resource-sets/types/resource-sets";
+
+export const readResourceSets = async (): Promise<ReadResourceSetsResult> => {
+  const scope = await requireScope();
+  return projectSets(serverModel().store, scope);
+};
~~~~

### new · `src/lib/capabilities/resource-sets/api/remove-resource-set/remove-resource-set.ts` (+74 / −0)

~~~~diff
@@ -0,0 +1,74 @@
+import { requireScope } from "$runtime/server/scope.server";
+import { serverModel } from "$runtime/server/start.server";
+
+import {
+  recordsIn,
+  reportableRevision,
+  visibleSet
+} from "$capabilities/resource-sets/api/shared/projection";
+import { validateRemoveResourceSet } from "$capabilities/resource-sets/api/remove-resource-set/validate-remove-resource-set";
+import type { RemoveResourceSetResult } from "$capabilities/resource-sets/types/resource-sets";
+
+const namesSet = (value: unknown, setId: string): boolean => {
+  if (Array.isArray(value)) return value.some((entry) => namesSet(entry, setId));
+  if (value === null || typeof value !== "object") return false;
+  const fields = value as Record<string, unknown>;
+  if (fields.select === "set" && fields.setId === setId) return true;
+  return Object.values(fields).some((nested) => namesSet(nested, setId));
+};
+
+export const removeResourceSet = async (input: unknown): Promise<RemoveResourceSetResult> => {
+  const scope = await requireScope();
+  const asked = validateRemoveResourceSet(input);
+
+  const store = serverModel().store;
+  const found = visibleSet(store, scope, asked.setId);
+  if (found.kind !== "found") {
+    return {
+      accepted: false,
+      setId: asked.setId,
+      reason: found.kind === "missing" ? "not-found" : "corrupt",
+      revision: null,
+      detail: found.kind === "missing" ? "no set in this project has that id" : found.detail
+    };
+  }
+  const stored = found.set;
+  if (stored.revision !== asked.baseRevision) {
+    return {
+      accepted: false,
+      setId: asked.setId,
+      reason: "stale",
+      revision: reportableRevision(stored.revision),
+      detail: `deletion asked for revision ${asked.baseRevision}, the set is at ${stored.revision}`
+    };
+  }
+
+  const usedBySet = recordsIn(store, "resourceSets").find(
+    (row) => row._id !== stored._id && namesSet(row.set, stored._id)
+  );
+  if (usedBySet !== undefined) {
+    return {
+      accepted: false,
+      setId: asked.setId,
+      reason: "in-use",
+      revision: reportableRevision(stored.revision),
+      detail: `the set "${String(usedBySet.name)}" still names it`
+    };
+  }
+
+  const usedByTemplate = recordsIn(store, "templates").find(
+    (row) => row.projectId === scope.projectId && namesSet(row.holes, stored._id)
+  );
+  if (usedByTemplate !== undefined) {
+    return {
+      accepted: false,
+      setId: asked.setId,
+      reason: "in-use",
+      revision: reportableRevision(stored.revision),
+      detail: `the template "${String(usedByTemplate.name)}" still names it`
+    };
+  }
+
+  store.remove(`resourceSets.${stored._id}`);
+  return { accepted: true, setId: stored._id, revision: stored.revision };
+};
~~~~

### new · `src/lib/capabilities/resource-sets/api/remove-resource-set/validate-remove-resource-set.ts` (+16 / −0)

~~~~diff
@@ -0,0 +1,16 @@
+import {
+  fieldsOf,
+  only,
+  revisionOf,
+  setIdOf
+} from "$capabilities/resource-sets/api/shared/validation";
+import type { RemoveResourceSetInput } from "$capabilities/resource-sets/types/resource-sets";
+
+export const validateRemoveResourceSet = (input: unknown): RemoveResourceSetInput => {
+  const fields = fieldsOf(input, "remove-resource-set");
+  only(fields, ["setId", "baseRevision"], "remove-resource-set");
+  return {
+    setId: setIdOf(fields.setId, "remove-resource-set"),
+    baseRevision: revisionOf(fields.baseRevision, "remove-resource-set")
+  };
+};
~~~~

### new · `src/lib/capabilities/resource-sets/api/shared/projection.ts` (+220 / −0)

~~~~diff
@@ -0,0 +1,220 @@
+import type { StoreModel, TableName, TableRow } from "$model/server/store/index.server";
+import type { Scope } from "$runtime/server/scope.server";
+import { resolveResourceSet } from "$representation/data/behavior/core/resource-set";
+import type { Actor } from "$representation/data/types/core/actor";
+import type { ResourceRef } from "$representation/data/types/core/resource";
+import type { ResourceSet } from "$representation/data/types/core/resource-set";
+
+import {
+  boundToOf,
+  descriptionOf,
+  nameOf,
+  resourceSetOf,
+  setIdOf
+} from "$capabilities/resource-sets/api/shared/validation";
+import type {
+  ResourceSetItem,
+  ResourceSetUnavailable
+} from "$capabilities/resource-sets/types/resource-sets";
+
+type NamedSet = TableRow<"resourceSets">;
+
+export type SetLookup =
+  | { readonly kind: "found"; readonly set: NamedSet }
+  | { readonly kind: "missing" }
+  | { readonly kind: "ambiguous"; readonly detail: string };
+
+const recordOf = (value: unknown): Record<string, unknown> | undefined =>
+  value !== null && typeof value === "object" && !Array.isArray(value)
+    ? (value as Record<string, unknown>)
+    : undefined;
+
+export const recordsIn = (
+  store: StoreModel,
+  table: TableName
+): readonly Record<string, unknown>[] => {
+  const found = store.read(table);
+  if (found?.table !== table || found.kind !== "table" || !Array.isArray(found.rows)) return [];
+  return found.rows.flatMap((value) => {
+    const record = recordOf(value);
+    return record === undefined ? [] : [record];
+  });
+};
+
+export const reportableRevision = (value: unknown): number | null =>
+  typeof value === "number" && Number.isSafeInteger(value) && value > 0 ? value : null;
+
+const actorOf = (value: unknown, subject: string): Actor => {
+  const actor = recordOf(value);
+  const identifier = (candidate: unknown): candidate is string =>
+    typeof candidate === "string" && candidate === candidate.trim() && candidate.length > 0 && candidate.length <= 500;
+  const exact = (fields: readonly string[]) =>
+    actor !== undefined && Object.keys(actor).every((field) => fields.includes(field));
+  if (actor?.kind === "system" && exact(["kind"])) return { kind: "system" };
+  if (actor?.kind === "user" && exact(["kind", "userId"]) && identifier(actor.userId)) {
+    return value as Actor;
+  }
+  if (actor?.kind === "connector" && exact(["kind", "connectorId"]) && identifier(actor.connectorId)) {
+    return value as Actor;
+  }
+  if (actor?.kind === "agent" && exact(["kind", "taskId"]) && identifier(actor.taskId)) {
+    return value as Actor;
+  }
+  throw new Error(`resource-sets/${subject}: createdBy is a represented actor`);
+};
+
+export const admitStoredSet = (row: NamedSet): NamedSet => {
+  const subject = `stored-${row._id}`;
+  setIdOf(row._id, subject);
+  if (typeof row.projectId !== "string" || row.projectId.length === 0) {
+    throw new Error(`resource-sets/${subject}: projectId is required`);
+  }
+  if (!Number.isSafeInteger(row.revision) || row.revision < 1) {
+    throw new Error(`resource-sets/${subject}: revision is safe and positive`);
+  }
+  if (!Number.isFinite(row.updatedAt) || row.updatedAt < 0) {
+    throw new Error(`resource-sets/${subject}: updated time is finite`);
+  }
+  if ((row.name === undefined) === (row.boundTo === undefined)) {
+    throw new Error(`resource-sets/${subject}: a row carries a name or an owner, never both or neither`);
+  }
+  const description = row.description === undefined ? undefined : descriptionOf(row.description, subject);
+  return {
+    ...row,
+    ...(row.name === undefined ? {} : { name: nameOf(row.name, subject) }),
+    ...(row.boundTo === undefined ? {} : { boundTo: boundToOf(row.boundTo, subject) }),
+    ...(description === undefined ? {} : { description }),
+    set: resourceSetOf(row.set, subject),
+    createdBy: actorOf(row.createdBy, subject)
+  };
+};
+
+export const visibleSet = (store: StoreModel, scope: Scope, setId: string): SetLookup => {
+  const matching = recordsIn(store, "resourceSets").filter((row) => row._id === setId);
+  const visible = matching.filter((row) => row.projectId === scope.projectId);
+  if (visible.length === 0) return { kind: "missing" };
+  if (matching.length !== 1) {
+    return { kind: "ambiguous", detail: "more than one stored row claims this set id" };
+  }
+  return { kind: "found", set: visible[0] as unknown as NamedSet };
+};
+
+const CATALOGUE: readonly { table: TableName; kind: string }[] = [
+  { table: "documents", kind: "document" },
+  { table: "slideDecks", kind: "slides" },
+  { table: "spreadsheets", kind: "spreadsheet" },
+  { table: "findings", kind: "finding" },
+  { table: "researchThreads", kind: "research" }
+];
+
+export const catalogueOf = (store: StoreModel, projectId: string): readonly ResourceRef[] => {
+  const staged = new Set(
+    recordsIn(store, "templateStages")
+      .filter((row) => row.projectId === projectId && typeof row.resourceId === "string")
+      .map((row) => row.resourceId as string)
+  );
+  return CATALOGUE.flatMap(({ table, kind }) =>
+    recordsIn(store, table)
+      .filter(
+        (row) =>
+          row.projectId === projectId && typeof row._id === "string" && !staged.has(row._id)
+      )
+      .map((row) => ({ kind, id: row._id as string }))
+  );
+};
+
+export const namedSetsIn = (store: StoreModel, projectId: string): ReadonlyMap<string, ResourceSet> => {
+  const sets = new Map<string, ResourceSet>();
+  for (const row of recordsIn(store, "resourceSets")) {
+    if (row.projectId !== projectId || typeof row._id !== "string") continue;
+    try {
+      sets.set(row._id, resourceSetOf(row.set, `stored-${row._id}`));
+    } catch {
+      continue;
+    }
+  }
+  return sets;
+};
+
+const namedRow = (
+  store: StoreModel,
+  table: "users" | "connectors" | "agentTasks",
+  id: string,
+  field: "displayName" | "name" | "title",
+  projectId?: string
+): string | undefined => {
+  const row = recordsIn(store, table).find(
+    (candidate) => candidate._id === id && (projectId === undefined || candidate.projectId === projectId)
+  );
+  const value = row?.[field];
+  return typeof value === "string" && value === value.trim() && value.length > 0 && value.length <= 160
+    ? value
+    : undefined;
+};
+
+const actorName = (store: StoreModel, scope: Scope, actor: Actor): string => {
+  if (actor.kind === "system") return "Icarus";
+  if (actor.kind === "user") {
+    const member = recordsIn(store, "memberships").some(
+      (row) => row.projectId === scope.projectId && row.userId === actor.userId
+    );
+    return member ? (namedRow(store, "users", actor.userId, "displayName") ?? "Someone") : "Someone";
+  }
+  if (actor.kind === "connector") {
+    return namedRow(store, "connectors", actor.connectorId, "name", scope.projectId) ?? "A connector";
+  }
+  const title = namedRow(store, "agentTasks", actor.taskId, "title", scope.projectId);
+  return title === undefined ? "An agent" : `Agent · ${title}`;
+};
+
+export const itemOf = (
+  store: StoreModel,
+  scope: Scope,
+  set: NamedSet,
+  catalogue: readonly ResourceRef[],
+  sets: ReadonlyMap<string, ResourceSet>
+): ResourceSetItem => ({
+  id: set._id,
+  name: set.name ?? "",
+  ...(set.description === undefined ? {} : { description: set.description }),
+  set: set.set,
+  createdByName: actorName(store, scope, set.createdBy),
+  revision: set.revision,
+  updatedAt: set.updatedAt,
+  resolves: resolveResourceSet(set.set, catalogue, sets).length
+});
+
+export const projectSets = (
+  store: StoreModel,
+  scope: Scope
+): { readonly sets: readonly ResourceSetItem[]; readonly unavailable: readonly ResourceSetUnavailable[] } => {
+  const catalogue = catalogueOf(store, scope.projectId);
+  const named = namedSetsIn(store, scope.projectId);
+  const sets: ResourceSetItem[] = [];
+  const unavailable: ResourceSetUnavailable[] = [];
+  const rows = recordsIn(store, "resourceSets");
+  const claims = new Map<string, number>();
+  for (const row of rows) {
+    if (typeof row._id === "string") claims.set(row._id, (claims.get(row._id) ?? 0) + 1);
+  }
+  for (const [index, row] of rows.entries()) {
+    if (row.projectId !== scope.projectId) continue;
+    if (row.name === undefined) continue;
+    const reportId = typeof row._id === "string" && row._id.length <= 500 ? row._id : `resourceSets:invalid-${index + 1}`;
+    if (typeof row._id === "string" && (claims.get(row._id) ?? 0) > 1) {
+      unavailable.push({ setId: reportId, reason: "corrupt", detail: "more than one stored row claims this set id" });
+      continue;
+    }
+    try {
+      sets.push(itemOf(store, scope, admitStoredSet(row as unknown as NamedSet), catalogue, named));
+    } catch (error) {
+      unavailable.push({
+        setId: reportId,
+        reason: "corrupt",
+        detail: error instanceof Error ? error.message : String(error)
+      });
+    }
+  }
+  sets.sort((left, right) => left.name.localeCompare(right.name));
+  return { sets, unavailable };
+};
~~~~

### new · `src/lib/capabilities/resource-sets/api/shared/validation.ts` (+172 / −0)

~~~~diff
@@ -0,0 +1,172 @@
+import { asId } from "$representation/data/behavior/core/id";
+import type { BoundTo, ResourceSet, SetTerm } from "$representation/data/types/core/resource-set";
+
+type Fields = Record<string, unknown>;
+
+const MAX_TERMS_PER_SIDE = 100;
+const MAX_KINDS_PER_TERM = 100;
+const MAX_REFS_PER_TERM = 1_000;
+const MAX_KIND_LENGTH = 160;
+const MAX_IDENTIFIER_LENGTH = 500;
+
+export const fieldsOf = (value: unknown, subject: string): Fields => {
+  if (value === null || typeof value !== "object" || Array.isArray(value)) {
+    throw new Error(`resource-sets/${subject}: an object is required`);
+  }
+  return value as Fields;
+};
+
+export const has = (fields: Fields, field: string): boolean =>
+  Object.prototype.hasOwnProperty.call(fields, field);
+
+export const only = (fields: Fields, allowed: readonly string[], subject: string): void => {
+  const extra = Object.keys(fields).filter((field) => !allowed.includes(field));
+  if (extra.length > 0) {
+    throw new Error(
+      `resource-sets/${subject}: unknown ${extra.length === 1 ? "field" : "fields"} ${extra.join(", ")}`
+    );
+  }
+};
+
+const isRecord = (value: unknown): value is Fields =>
+  value !== null && typeof value === "object" && !Array.isArray(value);
+
+const canonicalText = (value: unknown, maximum: number): value is string =>
+  typeof value === "string" &&
+  value === value.trim() &&
+  value.length > 0 &&
+  value.length <= maximum;
+
+export const setIdOf = (value: unknown, subject: string): string => {
+  if (typeof value !== "string" || !/^resourceSets:[^.:\s]+$/.test(value)) {
+    throw new Error(`resource-sets/${subject}: setId is one canonical resourceSets row id`);
+  }
+  return value;
+};
+
+export const revisionOf = (value: unknown, subject: string): number => {
+  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 1) {
+    throw new Error(`resource-sets/${subject}: baseRevision is a safe positive revision number`);
+  }
+  return value;
+};
+
+export const nameOf = (value: unknown, subject: string): string => {
+  if (typeof value !== "string" || value.trim().length === 0) {
+    throw new Error(`resource-sets/${subject}: name is required`);
+  }
+  const name = value.trim();
+  if (name.length > 160) throw new Error(`resource-sets/${subject}: name is at most 160 characters`);
+  return name;
+};
+
+/**
+ * What owns a bound row.
+ *
+ * A row carries a name or an owner and never both: naming is the whole
+ * difference between a project's own set and a value something else holds.
+ */
+export const boundToOf = (value: unknown, subject: string): BoundTo => {
+  if (!isRecord(value)) throw new Error(`resource-sets/${subject}: boundTo is an object`);
+  if (value.kind === "hole") {
+    if (
+      Object.keys(value).length !== 3 ||
+      !canonicalText(value.templateId, MAX_IDENTIFIER_LENGTH) ||
+      !canonicalText(value.hole, MAX_KIND_LENGTH)
+    ) {
+      throw new Error(`resource-sets/${subject}: a hole owner names a template and a hole`);
+    }
+    return {
+      kind: "hole",
+      templateId: asId<"templates">(value.templateId as string),
+      hole: value.hole as string
+    };
+  }
+  if (value.kind === "resource") {
+    if (
+      Object.keys(value).length !== 3 ||
+      !canonicalText(value.resourceId, MAX_IDENTIFIER_LENGTH) ||
+      !canonicalText(value.hole, MAX_KIND_LENGTH)
+    ) {
+      throw new Error(`resource-sets/${subject}: a resource owner names one resource and a hole`);
+    }
+    return {
+      kind: "resource",
+      resourceId: value.resourceId as string,
+      hole: value.hole as string
+    };
+  }
+  throw new Error(`resource-sets/${subject}: an owner is a hole or a resource`);
+};
+
+export const descriptionOf = (value: unknown, subject: string): string => {
+  if (typeof value !== "string") throw new Error(`resource-sets/${subject}: description is text`);
+  const description = value.trim();
+  if (description.length > 4_000) {
+    throw new Error(`resource-sets/${subject}: description is at most 4000 characters`);
+  }
+  return description;
+};
+
+const termOf = (value: unknown, subject: string): SetTerm => {
+  if (!isRecord(value)) throw new Error(`resource-sets/${subject}: a term is an object`);
+  if (value.select === "project") {
+    if (Object.keys(value).length !== 1) throw new Error(`resource-sets/${subject}: a project term carries nothing else`);
+    return { select: "project" };
+  }
+  if (value.select === "kinds") {
+    if (
+      Object.keys(value).length !== 2 ||
+      !Array.isArray(value.kinds) ||
+      value.kinds.length === 0 ||
+      value.kinds.length > MAX_KINDS_PER_TERM ||
+      !value.kinds.every((kind) => canonicalText(kind, MAX_KIND_LENGTH)) ||
+      new Set(value.kinds.map((kind) => (kind as string).toLocaleLowerCase())).size !== value.kinds.length
+    ) {
+      throw new Error(`resource-sets/${subject}: a kinds term lists distinct resource kinds`);
+    }
+    return { select: "kinds", kinds: [...(value.kinds as string[])] };
+  }
+  if (value.select === "resources") {
+    if (
+      Object.keys(value).length !== 2 ||
+      !Array.isArray(value.refs) ||
+      value.refs.length > MAX_REFS_PER_TERM ||
+      !value.refs.every(
+        (ref) =>
+          isRecord(ref) &&
+          Object.keys(ref).length === 2 &&
+          canonicalText(ref.kind, MAX_KIND_LENGTH) &&
+          canonicalText(ref.id, MAX_IDENTIFIER_LENGTH)
+      )
+    ) {
+      throw new Error(`resource-sets/${subject}: a resources term lists resource references`);
+    }
+    return {
+      select: "resources",
+      refs: (value.refs as { kind: string; id: string }[]).map((ref) => ({ kind: ref.kind, id: ref.id }))
+    };
+  }
+  if (value.select === "set") {
+    if (Object.keys(value).length !== 2) throw new Error(`resource-sets/${subject}: a set term names one set`);
+    return { select: "set", setId: asId<"resourceSets">(setIdOf(value.setId, subject)) };
+  }
+  throw new Error(`resource-sets/${subject}: a term selects project, kinds, resources, or set`);
+};
+
+export const resourceSetOf = (value: unknown, subject: string): ResourceSet => {
+  if (
+    !isRecord(value) ||
+    Object.keys(value).length !== 2 ||
+    !Array.isArray(value.include) ||
+    !Array.isArray(value.exclude) ||
+    value.include.length > MAX_TERMS_PER_SIDE ||
+    value.exclude.length > MAX_TERMS_PER_SIDE
+  ) {
+    throw new Error(`resource-sets/${subject}: a set is an include list and an exclude list`);
+  }
+  return {
+    include: value.include.map((term) => termOf(term, subject)),
+    exclude: value.exclude.map((term) => termOf(term, subject))
+  };
+};
~~~~

### new · `src/lib/capabilities/resource-sets/api/update-resource-set/update-resource-set.ts` (+72 / −0)

~~~~diff
@@ -0,0 +1,72 @@
+import { requireScope } from "$runtime/server/scope.server";
+import { serverModel } from "$runtime/server/start.server";
+
+import {
+  admitStoredSet,
+  reportableRevision,
+  visibleSet
+} from "$capabilities/resource-sets/api/shared/projection";
+import { validateUpdateResourceSet } from "$capabilities/resource-sets/api/update-resource-set/validate-update-resource-set";
+import type { UpdateResourceSetResult } from "$capabilities/resource-sets/types/resource-sets";
+
+export const updateResourceSet = async (input: unknown): Promise<UpdateResourceSetResult> => {
+  const scope = await requireScope();
+  const asked = validateUpdateResourceSet(input);
+
+  const store = serverModel().store;
+  const found = visibleSet(store, scope, asked.setId);
+  if (found.kind !== "found") {
+    return {
+      accepted: false,
+      setId: asked.setId,
+      reason: found.kind === "missing" ? "not-found" : "corrupt",
+      revision: null,
+      detail: found.kind === "missing" ? "no set in this project has that id" : found.detail
+    };
+  }
+  const stored = found.set;
+  if (stored.revision !== asked.baseRevision) {
+    return {
+      accepted: false,
+      setId: asked.setId,
+      reason: "stale",
+      revision: reportableRevision(stored.revision),
+      detail: `authored against revision ${asked.baseRevision}, the set is at ${stored.revision}`
+    };
+  }
+  let held: ReturnType<typeof admitStoredSet>;
+  try {
+    held = admitStoredSet(stored);
+  } catch (error) {
+    return {
+      accepted: false,
+      setId: asked.setId,
+      reason: "corrupt",
+      revision: reportableRevision(stored.revision),
+      detail: error instanceof Error ? error.message : String(error)
+    };
+  }
+  if (asked.patch.set?.include.some((term) => term.select === "set" && term.setId === held._id)) {
+    return {
+      accepted: false,
+      setId: asked.setId,
+      reason: "corrupt",
+      revision: held.revision,
+      detail: "a set cannot include itself"
+    };
+  }
+
+  const description =
+    asked.patch.description === null ? undefined : (asked.patch.description ?? held.description);
+  store.update(`resourceSets.${held._id}`, {
+    projectId: held.projectId,
+    name: asked.patch.name ?? held.name,
+    ...(description === undefined || description === "" ? {} : { description }),
+    set: asked.patch.set ?? held.set,
+    createdBy: held.createdBy,
+    revision: held.revision + 1,
+    updatedAt: Date.now()
+  });
+
+  return { accepted: true, setId: held._id, revision: held.revision + 1 };
+};
~~~~

### new · `src/lib/capabilities/resource-sets/api/update-resource-set/validate-update-resource-set.ts` (+41 / −0)

~~~~diff
@@ -0,0 +1,41 @@
+import {
+  descriptionOf,
+  fieldsOf,
+  has,
+  nameOf,
+  only,
+  resourceSetOf,
+  revisionOf,
+  setIdOf
+} from "$capabilities/resource-sets/api/shared/validation";
+import type {
+  UpdateResourceSetInput,
+  UpdateResourceSetPatch
+} from "$capabilities/resource-sets/types/resource-sets";
+
+export const validateUpdateResourceSet = (input: unknown): UpdateResourceSetInput => {
+  const fields = fieldsOf(input, "update-resource-set");
+  only(fields, ["setId", "baseRevision", "patch"], "update-resource-set");
+  const incoming = fieldsOf(fields.patch, "update-resource-set");
+  only(incoming, ["name", "description", "set"], "update-resource-set");
+  if (Object.keys(incoming).length === 0) {
+    throw new Error("resource-sets/update-resource-set: patch changes at least one field");
+  }
+  const patch: UpdateResourceSetPatch = {
+    ...(has(incoming, "name") ? { name: nameOf(incoming.name, "update-resource-set") } : {}),
+    ...(has(incoming, "description")
+      ? {
+          description:
+            incoming.description === null
+              ? null
+              : descriptionOf(incoming.description, "update-resource-set")
+        }
+      : {}),
+    ...(has(incoming, "set") ? { set: resourceSetOf(incoming.set, "update-resource-set") } : {})
+  };
+  return {
+    setId: setIdOf(fields.setId, "update-resource-set"),
+    baseRevision: revisionOf(fields.baseRevision, "update-resource-set"),
+    patch
+  };
+};
~~~~

### new · `src/lib/capabilities/resource-sets/index.remote.ts` (+39 / −0)

~~~~diff
@@ -0,0 +1,39 @@
+import { command, query } from "$app/server";
+
+import { createResourceSet as createResourceSetProcedure } from "$capabilities/resource-sets/api/create-resource-set/create-resource-set";
+import { readResourceSets as readResourceSetsProcedure } from "$capabilities/resource-sets/api/read-resource-sets/read-resource-sets";
+import { removeResourceSet as removeResourceSetProcedure } from "$capabilities/resource-sets/api/remove-resource-set/remove-resource-set";
+import { updateResourceSet as updateResourceSetProcedure } from "$capabilities/resource-sets/api/update-resource-set/update-resource-set";
+
+export const readResourceSets = query(readResourceSetsProcedure);
+
+export const createResourceSet = command("unchecked", async (input) => {
+  const result = await createResourceSetProcedure(input);
+  await readResourceSets().refresh();
+  return result;
+});
+
+export const updateResourceSet = command("unchecked", async (input) => {
+  const result = await updateResourceSetProcedure(input);
+  await readResourceSets().refresh();
+  return result;
+});
+
+export const removeResourceSet = command("unchecked", async (input) => {
+  const result = await removeResourceSetProcedure(input);
+  await readResourceSets().refresh();
+  return result;
+});
+
+export type {
+  CreateResourceSetInput,
+  CreateResourceSetResult,
+  ReadResourceSetsResult,
+  RemoveResourceSetInput,
+  RemoveResourceSetResult,
+  ResourceSetItem,
+  ResourceSetUnavailable,
+  UpdateResourceSetInput,
+  UpdateResourceSetPatch,
+  UpdateResourceSetResult
+} from "$capabilities/resource-sets/types/resource-sets";
~~~~

### new · `src/lib/capabilities/resource-sets/resource-sets.md` (+27 / −0)

~~~~diff
@@ -0,0 +1,27 @@
+# resource-sets
+
+The project's resource sets: the scopes a prompt looks things up in.
+
+| procedure | answers |
+| --- | --- |
+| `readResourceSets` | Every valid **named** set in the scoped project, with its creator's name and how many resources it selects now, plus quarantined invalid rows |
+| `createResourceSet` | A set from a name, an optional description, and an include and exclude list |
+| `updateResourceSet` | A compare-and-swap change to name, description, or the set itself |
+| `removeResourceSet` | A compare-and-swap delete, refused while another set or a template hole's default in this project still names it |
+
+A set is `include` minus `exclude`. A term selects the whole project, a list of
+resource kinds matched by segment, named resources, or another set by id. The
+count each set reports is resolved when it is read, over the documents, decks,
+spreadsheets, findings and research threads the project holds — never stored,
+so it cannot go stale. A template's staged copy is left out of that catalogue.
+
+**A row carries a name or an owner, and never both or neither.** A named row is
+a project subject: people make it here, it is listed here, and every builder
+offers it. A row with `boundTo` instead is a value something else holds, written
+because the rule could not be said inline — it is never listed, never named, and
+goes when its owner goes. These procedures only ever make and change named rows;
+the bound ones belong to whichever capability owns the thing that points at them.
+
+Every stored row is re-admitted before projection or mutation. A malformed row
+is quarantined from the list and refused by update and remove, so one corrupt
+row cannot take the rest down. A set that would include itself is refused.
~~~~

### new · `src/lib/capabilities/resource-sets/test/unit/resource-sets.test.ts` (+230 / −0)

~~~~diff
@@ -0,0 +1,230 @@
+import assert from "node:assert/strict";
+import { beforeEach, describe, test, vi } from "vitest";
+
+type Row = Record<string, unknown> & { _id: string; _creationTime: number };
+
+const model = vi.hoisted(() => ({
+  scope: { projectId: "p", userId: "u", username: "Uma" },
+  tables: {} as Record<string, Row[]>,
+  store: {
+    create: (table: string, fields: unknown) => {
+      const rows = (model.tables[table] ??= []);
+      const id = `${table}:${rows.length + 1}`;
+      rows.push({ ...(fields as Record<string, unknown>), _id: id, _creationTime: 1 });
+      return id;
+    },
+    read: (path: string) => {
+      const [table] = path.split(".");
+      return { table, kind: "table", rows: model.tables[table] ?? [] };
+    },
+    update: (path: string, value: unknown) => {
+      const [table, id] = path.split(".");
+      const rows = model.tables[table] ?? [];
+      const index = rows.findIndex((row) => row._id === id);
+      if (index < 0) throw new Error(`no row ${path}`);
+      rows[index] = { ...(value as Record<string, unknown>), _id: id, _creationTime: rows[index]._creationTime };
+    },
+    remove: (path: string) => {
+      const [table, id] = path.split(".");
+      const rows = model.tables[table] ?? [];
+      const index = rows.findIndex((row) => row._id === id);
+      if (index < 0) throw new Error(`no row ${path}`);
+      rows.splice(index, 1);
+    }
+  }
+}));
+
+vi.mock("$runtime/server/start.server", () => ({ serverModel: () => model }));
+vi.mock("$runtime/server/scope.server", () => ({
+  requireScope: () => Promise.resolve(model.scope)
+}));
+
+const { createResourceSet } = await import(
+  "$capabilities/resource-sets/api/create-resource-set/create-resource-set"
+);
+const { readResourceSets } = await import(
+  "$capabilities/resource-sets/api/read-resource-sets/read-resource-sets"
+);
+const { removeResourceSet } = await import(
+  "$capabilities/resource-sets/api/remove-resource-set/remove-resource-set"
+);
+const { updateResourceSet } = await import(
+  "$capabilities/resource-sets/api/update-resource-set/update-resource-set"
+);
+
+const row = (table: string, id: string, fields: Record<string, unknown>): Row => ({
+  ...fields,
+  _id: `${table}:${id}`,
+  _creationTime: 1
+});
+
+const namedSet = (id: string, fields: Record<string, unknown> = {}): Row =>
+  row("resourceSets", id, {
+    projectId: "p",
+    name: `Set ${id}`,
+    set: { include: [{ select: "kinds", kinds: ["document"] }], exclude: [] },
+    createdBy: { kind: "user", userId: "u" },
+    revision: 1,
+    updatedAt: 5,
+    ...fields
+  });
+
+beforeEach(() => {
+  vi.spyOn(Date, "now").mockReturnValue(500);
+  model.scope = { projectId: "p", userId: "u", username: "Uma" };
+  model.tables = {
+    users: [{ _id: "u", _creationTime: 1, displayName: "Uma" }],
+    memberships: [row("memberships", "1", { userId: "u", projectId: "p", token: "u", role: "owner" })],
+    resourceSets: [],
+    templates: [],
+    templateStages: [],
+    documents: [
+      row("documents", "1", { projectId: "p", title: "Brief" }),
+      row("documents", "2", { projectId: "p", title: "Staged" }),
+      row("documents", "3", { projectId: "other", title: "Elsewhere" })
+    ],
+    slideDecks: [row("slideDecks", "1", { projectId: "p", title: "Deck" })],
+    spreadsheets: [],
+    findings: [row("findings", "1", { projectId: "p", title: "Relay" })],
+    researchThreads: []
+  };
+});
+
+describe("reading the project's sets", () => {
+  test("projects only this project's sets, sorted by name, with a live count", async () => {
+    model.tables.resourceSets.push(
+      namedSet("2", { name: "Zulu", set: { include: [{ select: "project" }], exclude: [{ select: "kinds", kinds: ["slides"] }] } }),
+      namedSet("1", { name: "Alpha" }),
+      namedSet("3", { name: "Foreign", projectId: "other" })
+    );
+    model.tables.templateStages.push(row("templateStages", "1", { projectId: "p", resourceId: "documents:2" }));
+
+    const answer = await readResourceSets();
+
+    assert.deepEqual(
+      answer.sets.map((set) => [set.id, set.name, set.resolves, set.createdByName]),
+      [
+        ["resourceSets:1", "Alpha", 1, "Uma"],
+        ["resourceSets:2", "Zulu", 2, "Uma"]
+      ]
+    );
+    assert.deepEqual(answer.unavailable, []);
+  });
+
+  test("quarantines a malformed row without hiding the rest", async () => {
+    model.tables.resourceSets.push(namedSet("1"), namedSet("2", { set: { include: "everything" } }));
+
+    const answer = await readResourceSets();
+
+    assert.deepEqual(answer.sets.map((set) => set.id), ["resourceSets:1"]);
+    assert.equal(answer.unavailable.length, 1);
+    assert.match(answer.unavailable[0].detail, /include list/);
+  });
+});
+
+describe("changing sets", () => {
+  test("creates a set in the scoped project from a validated input", async () => {
+    const answer = await createResourceSet({
+      name: " Field evidence ",
+      set: { include: [{ select: "kinds", kinds: ["finding"] }], exclude: [] }
+    });
+
+    assert.deepEqual(answer, { accepted: true, setId: "resourceSets:1", revision: 1 });
+    assert.deepEqual(model.tables.resourceSets[0], {
+      _id: "resourceSets:1",
+      _creationTime: 1,
+      projectId: "p",
+      name: "Field evidence",
+      set: { include: [{ select: "kinds", kinds: ["finding"] }], exclude: [] },
+      createdBy: { kind: "user", userId: "u" },
+      revision: 1,
+      updatedAt: 500
+    });
+  });
+
+  test("refuses an input it cannot act on before reading the store", async () => {
+    await assert.rejects(() => createResourceSet({ name: "", set: { include: [], exclude: [] } }), /name is required/);
+    await assert.rejects(
+      () => createResourceSet({ name: "x", set: { include: [{ select: "everything" }], exclude: [] } }),
+      /selects project, kinds, resources, or set/
+    );
+    await assert.rejects(() => updateResourceSet({ setId: "resourceSets:1", baseRevision: 1, patch: {} }), /at least one field/);
+  });
+
+  test("updates with a revision check and refuses a stale or self-including patch", async () => {
+    model.tables.resourceSets.push(namedSet("1"));
+
+    const stale = await updateResourceSet({ setId: "resourceSets:1", baseRevision: 3, patch: { name: "Late" } });
+    assert.deepEqual(stale, {
+      accepted: false,
+      setId: "resourceSets:1",
+      reason: "stale",
+      revision: 1,
+      detail: "authored against revision 3, the set is at 1"
+    });
+
+    const loop = await updateResourceSet({
+      setId: "resourceSets:1",
+      baseRevision: 1,
+      patch: { set: { include: [{ select: "set", setId: "resourceSets:1" }], exclude: [] } }
+    });
+    assert.equal(loop.accepted, false);
+
+    const renamed = await updateResourceSet({
+      setId: "resourceSets:1",
+      baseRevision: 1,
+      patch: { name: "Renamed", description: "Now described" }
+    });
+    assert.deepEqual(renamed, { accepted: true, setId: "resourceSets:1", revision: 2 });
+    assert.equal(model.tables.resourceSets[0].name, "Renamed");
+    assert.equal(model.tables.resourceSets[0].description, "Now described");
+    assert.equal(model.tables.resourceSets[0].revision, 2);
+  });
+
+  test("refuses to remove a set another set or a template default still names", async () => {
+    model.tables.resourceSets.push(
+      namedSet("1"),
+      namedSet("2", { set: { include: [{ select: "set", setId: "resourceSets:1" }], exclude: [] } })
+    );
+
+    const held = await removeResourceSet({ setId: "resourceSets:1", baseRevision: 1 });
+    assert.deepEqual(held, {
+      accepted: false,
+      setId: "resourceSets:1",
+      reason: "in-use",
+      revision: 1,
+      detail: 'the set "Set 2" still names it'
+    });
+
+    model.tables.resourceSets.splice(1, 1);
+    model.tables.templates.push(
+      row("templates", "1", {
+        projectId: "p",
+        name: "Brief",
+        holes: [
+          {
+            name: "evidence",
+            label: "Evidence",
+            default: { include: [{ select: "set", setId: "resourceSets:1" }], exclude: [] }
+          }
+        ]
+      })
+    );
+    const named = await removeResourceSet({ setId: "resourceSets:1", baseRevision: 1 });
+    assert.equal(named.accepted === false && named.detail, 'the template "Brief" still names it');
+
+    model.tables.templates.splice(0, 1);
+    const gone = await removeResourceSet({ setId: "resourceSets:1", baseRevision: 1 });
+    assert.deepEqual(gone, { accepted: true, setId: "resourceSets:1", revision: 1 });
+    assert.deepEqual(model.tables.resourceSets, []);
+  });
+
+  test("does not reach a set in another project", async () => {
+    model.tables.resourceSets.push(namedSet("1", { projectId: "other" }));
+
+    const answer = await removeResourceSet({ setId: "resourceSets:1", baseRevision: 1 });
+    assert.equal(answer.accepted, false);
+    assert.equal(answer.accepted === false && answer.reason, "not-found");
+    assert.equal(model.tables.resourceSets.length, 1);
+  });
+});
~~~~

### new · `src/lib/capabilities/resource-sets/types/resource-sets.ts` (+72 / −0)

~~~~diff
@@ -0,0 +1,72 @@
+import type { ResourceSet } from "$representation/data/types/core/resource-set";
+
+export type ResourceSetItem = {
+  readonly id: string;
+  readonly name: string;
+  readonly description?: string;
+  readonly set: ResourceSet;
+  readonly createdByName: string;
+  readonly revision: number;
+  readonly updatedAt: number;
+  readonly resolves: number;
+};
+
+export type ResourceSetUnavailable = {
+  readonly setId: string;
+  readonly reason: "corrupt";
+  readonly detail: string;
+};
+
+export type ReadResourceSetsResult = {
+  readonly sets: readonly ResourceSetItem[];
+  readonly unavailable: readonly ResourceSetUnavailable[];
+};
+
+export type CreateResourceSetInput = {
+  readonly name: string;
+  readonly description?: string;
+  readonly set: ResourceSet;
+};
+
+export type CreateResourceSetResult = {
+  readonly accepted: true;
+  readonly setId: string;
+  readonly revision: 1;
+};
+
+export type UpdateResourceSetPatch = {
+  readonly name?: string;
+  readonly description?: string | null;
+  readonly set?: ResourceSet;
+};
+
+export type UpdateResourceSetInput = {
+  readonly setId: string;
+  readonly baseRevision: number;
+  readonly patch: UpdateResourceSetPatch;
+};
+
+export type UpdateResourceSetResult =
+  | { readonly accepted: true; readonly setId: string; readonly revision: number }
+  | {
+      readonly accepted: false;
+      readonly setId: string;
+      readonly reason: "not-found" | "stale" | "corrupt";
+      readonly revision: number | null;
+      readonly detail: string;
+    };
+
+export type RemoveResourceSetInput = {
+  readonly setId: string;
+  readonly baseRevision: number;
+};
+
+export type RemoveResourceSetResult =
+  | { readonly accepted: true; readonly setId: string; readonly revision: number }
+  | {
+      readonly accepted: false;
+      readonly setId: string;
+      readonly reason: "not-found" | "stale" | "in-use" | "corrupt";
+      readonly revision: number | null;
+      readonly detail: string;
+    };
~~~~

## What the other capabilities changed

### changed · `src/lib/capabilities/comments/api/start-thread/start-thread.ts` (+8 / −0)

~~~~diff
@@ -11,6 +11,14 @@ export const startThread = async (input: unknown): Promise<StartThreadResult> =>
   const asked = validateStartThread(input);
 
   const store = serverModel().store;
+  const stages = store.read("templateStages");
+  if (
+    stages?.table === "templateStages" &&
+    stages.kind === "table" &&
+    stages.rows.some((row) => row.projectId === scope.projectId && row.resourceId === asked.target.id)
+  ) {
+    throw new Error("comments/start-thread: a template's working copy takes no comments");
+  }
   const projectId = asId<"projects">(scope.projectId);
   const author = { kind: "user" as const, userId: asId<"users">(scope.userId) };
   const at = Date.now();
~~~~

### changed · `src/lib/capabilities/comments/comments.md` (+4 / −0)

~~~~diff
@@ -11,5 +11,9 @@ settles a thread or reopens it.
 the scope, so a caller cannot file a remark as someone else or into a project it
 cannot open. A thread in another project is not found rather than refused.
 
+**A template's working copy takes no comments.** `startThread` refuses a target
+that a `templateStages` row names, because a comment is one of the things that
+does not travel with a template; the panels say so where the composer would be.
+
 **Reading is not here.** Threads and comments are rows, and a panel reads them
 through `store` like any other table; this capability only adds to them.
~~~~

### changed · `src/lib/capabilities/comments/test/unit/comments.test.ts` (+12 / −0)

~~~~diff
@@ -41,6 +41,18 @@ beforeEach(() => {
 });
 
 describe("startThread", () => {
+  it("refuses a thread on a template's working copy", async () => {
+    model.tables.set("templateStages", [
+      { _id: "templateStages:1", projectId: "p", templateId: "templates:1", resourceId: "slideDecks:1" }
+    ]);
+
+    await assert.rejects(
+      () => startThread({ target: { kind: "slides", id: "slideDecks:1" }, text: "Not here" }),
+      /working copy takes no comments/
+    );
+    assert.equal(model.tables.get("commentThreads"), undefined);
+  });
+
   it("files a thread and its first comment under the asking user and project", async () => {
     const made = await startThread({
       target: { kind: "slides", id: "slideDecks:1" },
~~~~

### changed · `src/lib/capabilities/project-resources/api/read-project-resource-index/read-project-resource-index.ts` (+9 / −9)

~~~~diff
@@ -124,16 +124,18 @@ const timeOf = (value: unknown): number => {
   return value;
 };
 
-/**
- * The one cache key shared by template instantiation and Project Overview.
- * It intentionally exposes metadata only from the five listable resource
- * tables, and only for the project resolved from the request route.
- */
 export const readProjectResourceIndex = async (): Promise<ProjectResourceIndex> => {
   const scope = await requireScope();
   const resources: ProjectResourceIndexItem[] = [];
   const unavailable: ProjectResourceUnavailable[] = [];
 
+  const staged = new Set(
+    rowsIn("templateStages")
+      .map(recordOf)
+      .filter((row) => row?.projectId === scope.projectId && typeof row.resourceId === "string")
+      .map((row) => row?.resourceId as string)
+  );
+
   const collect = (
     table: TableName,
     kind: ProjectResourceKind,
@@ -143,9 +145,6 @@ export const readProjectResourceIndex = async (): Promise<ProjectResourceIndex>
     const rows = rowsIn(table);
     const idCounts = new Map<string, number>();
 
-    // Count canonical ids across the whole table before projecting scoped
-    // metadata. Store mutations resolve a row by table + id, so even a
-    // foreign or otherwise malformed claimant makes that path ambiguous.
     for (const value of rows) {
       const row = recordOf(value);
       if (row === undefined) continue;
@@ -153,13 +152,14 @@ export const readProjectResourceIndex = async (): Promise<ProjectResourceIndex>
         const id = idOf(row._id, table);
         idCounts.set(id, (idCounts.get(id) ?? 0) + 1);
       } catch {
-        // Noncanonical ids cannot alias a canonical Store mutation path.
+        continue;
       }
     }
 
     for (const value of rows) {
       const row = recordOf(value);
       if (row === undefined || row.projectId !== scope.projectId) continue;
+      if (typeof row._id === "string" && staged.has(row._id)) continue;
 
       try {
         const id = idOf(row._id, table);
~~~~

### changed · `src/lib/capabilities/store/store.md` (+1 / −2)

~~~~diff
@@ -28,8 +28,7 @@ that row belongs to the active project.
   hidden until the representation has an explicit ownership rule for it.
 - Template tables, snapshot/change-set tables, and every other table or field
   outside the allowlist fail closed and must be read through a subject
-  capability. Template provenance (`templateId`) is deliberately not part of
-  the document/deck/spreadsheet projection.
+  capability.
 - Loaded members must first be records with bounded path-safe ids and finite
   creation times. Ambiguous duplicate ids and rows with missing or malformed
   required projected fields are omitted. Composite values are copied through a
~~~~

## The template library, editor door, and inspector

### changed · `src/lib/app-views/categories/templates/content/editor.svelte` (+48 / −17)

~~~~diff
@@ -1,23 +1,49 @@
 <script lang="ts">
+  import { onDestroy } from "svelte";
   import ArrowLeft from "@lucide/svelte/icons/arrow-left";
   import FilePenLine from "@lucide/svelte/icons/file-pen-line";
 
   import { ScreenEmpty, ScreenNote, ScreenSurface } from "$authored-components/screen";
   import { Button } from "$vendored-components/button";
+  import {
+    editTemplate,
+    templateLibrary,
+    templatesIn
+  } from "$app-views/categories/templates/procedures/library.svelte";
   import { workspaceState } from "$model/client/workspace-state";
 
-  /**
-   * Compatibility landing for workspace snapshots that still name `templates.editor`.
-   *
-   * Template authoring is not a fourth editor. The intended implementation stages a
-   * represented body into the ordinary document/deck editor, flushes that runtime,
-   * commits the resulting body with a template-revision check, then removes the stage.
-   * That lifecycle needs a durable session record before it is safe across reload,
-   * workspace undo, and reopened tabs, so this route states the boundary instead of
-   * preserving the former 700-line session-local editor mock.
-   */
   const view = workspaceState();
+  const library = templateLibrary();
+  let live = true;
+  onDestroy(() => {
+    live = false;
+  });
+
+  let opening = $state<string | undefined>(undefined);
+  let refused = $state<string | undefined>(undefined);
+
   const back = () => view.showContent("templates.library", view.active.focus);
+
+  $effect(() => {
+    const focus = view.active.focus;
+    if (!library.ready || focus === undefined || opening !== undefined || refused !== undefined) return;
+    const row = templatesIn(library.current, Date.now()).find((candidate) => candidate.id === focus);
+    if (row === undefined) return;
+    opening = row.id;
+    void editTemplate(view, row).then(
+      (result) => {
+        if (!live) return;
+        if (result.accepted) view.showContent("templates.library", focus);
+        else refused = result.detail;
+        opening = undefined;
+      },
+      (error: unknown) => {
+        if (!live) return;
+        refused = error instanceof Error ? error.message : String(error);
+        opening = undefined;
+      }
+    );
+  });
 </script>
 
 <ScreenSurface>
@@ -28,15 +54,20 @@
     </Button>
   </header>
 
-  <ScreenEmpty title="The editor shell is intentionally deferred" icon={FilePenLine}>
-    This remains inside the Template category. A later pass can mount the ordinary document or
-    slide-deck runtime beneath this quiet return bar without creating another workspace tab.
-  </ScreenEmpty>
+  {#if refused !== undefined}
+    <ScreenEmpty title="This template cannot be opened for editing" icon={FilePenLine}>
+      {refused}
+    </ScreenEmpty>
+  {:else}
+    <ScreenEmpty title="Opening the template in its editor" icon={FilePenLine}>
+      A template is edited as a staged copy in the ordinary document or slide-deck editor. The
+      editor's Templates panel saves the copy back or discards it.
+    </ScreenEmpty>
+  {/if}
 
   <ScreenNote tone="gap">
-    Name, description, variable help text, and tags autosave in the Inspector today. Body authoring
-    still needs a collaborative edit-session identity, Template blocks for variable-bearing Prompt
-    positions, and deterministic scratch cleanup after the editor flushes.
+    Spreadsheet templates wait for the spreadsheet editor; their name, description, holes and
+    tags still change in the Inspector.
   </ScreenNote>
 </ScreenSurface>
~~~~

### changed · `src/lib/app-views/categories/templates/content/library.svelte` (+33 / −21)

~~~~diff
@@ -25,6 +25,7 @@
   import { Button } from "$vendored-components/button";
   import * as DropdownMenu from "$vendored-components/dropdown-menu";
   import {
+    editTemplate,
     inspectTemplate,
     recentTemplatesIn,
     templateLibrary,
@@ -37,6 +38,8 @@
 
   const view = workspaceState();
   const library = templateLibrary();
+  let opening = $state<string | undefined>(undefined);
+  let openError = $state<string | undefined>(undefined);
   let now = $state(Date.now());
   onMount(() => {
     const timer = setInterval(() => (now = Date.now()), 60_000);
@@ -52,7 +55,7 @@
     { value: "updated", label: "Updated" },
     { value: "name", label: "Name" },
     { value: "makes", label: "Makes" },
-    { value: "variables", label: "Variables" }
+    { value: "holes", label: "Holes" }
   ] as const;
 
   const TARGETS: readonly TemplateTarget[] = ["Document", "Slide deck", "Spreadsheet"];
@@ -69,7 +72,6 @@
     Spreadsheet: "1 / 1"
   };
 
-  /** One sorted union: the menu never invents a tag that no template carries. */
   const TAGS = $derived(
     [...new Set(templates.flatMap((row) => row.tags))].sort((a, b) => a.localeCompare(b))
   );
@@ -112,7 +114,6 @@
     selectedTags = [];
   };
 
-  /** A removed/retagged last template must not leave an invisible stale filter behind. */
   $effect(() => {
     if (tagMode !== "some") return;
     const next = selectedTags.filter((tag) => TAGS.includes(tag));
@@ -124,8 +125,8 @@
   const compare = (a: LibraryTemplate, b: LibraryTemplate): number => {
     if (sortBy === "name") return a.name.localeCompare(b.name);
     if (sortBy === "makes") return a.makes.localeCompare(b.makes) || a.name.localeCompare(b.name);
-    if (sortBy === "variables") {
-      return a.variableCount - b.variableCount || a.name.localeCompare(b.name);
+    if (sortBy === "holes") {
+      return a.holeCount - b.holeCount || a.name.localeCompare(b.name);
     }
     return b.updatedAt - a.updatedAt || a.name.localeCompare(b.name);
   };
@@ -162,11 +163,11 @@
     updated: { asc: "Newest first", desc: "Oldest first" },
     name: { asc: "A to Z", desc: "Z to A" },
     makes: { asc: "A to Z", desc: "Z to A" },
-    variables: { asc: "Fewest variables first", desc: "Most variables first" }
+    holes: { asc: "Fewest holes first", desc: "Most holes first" }
   };
 
-  const variableCount = (row: LibraryTemplate): string =>
-    `${row.variableCount} ${row.variableCount === 1 ? "variable" : "variables"}`;
+  const holeCount = (row: LibraryTemplate): string =>
+    `${row.holeCount} ${row.holeCount === 1 ? "hole" : "holes"}`;
 
   const clear = () => {
     search = "";
@@ -183,7 +184,6 @@
     inspectTemplate(view, row.id);
   };
 
-  /** A launcher can land the singleton on one template without opening the obsolete mock editor. */
   $effect(() => {
     const focus = view.active.focus;
     if (!library.ready || focus === undefined) return;
@@ -193,10 +193,23 @@
     if (row !== undefined) inspect(row);
   });
 
-  /** Authoring stays inside the singleton Template category; Use is a separate explicit action. */
-  const edit = (row: LibraryTemplate) => {
+  const edit = async (row: LibraryTemplate) => {
+    if (opening !== undefined) return;
     inspect(row);
-    view.showContent("templates.editor", row.id);
+    if (row.makes === "Spreadsheet") {
+      openError = "Spreadsheet templates open for editing once the spreadsheet editor lands.";
+      return;
+    }
+    opening = row.id;
+    openError = undefined;
+    try {
+      const result = await editTemplate(view, row);
+      if (!result.accepted) openError = result.detail;
+    } catch (error) {
+      openError = error instanceof Error ? error.message : String(error);
+    } finally {
+      opening = undefined;
+    }
   };
 </script>
 
@@ -219,12 +232,12 @@
           <ScreenThumb
             ratio={TARGET_RATIO[row.makes]}
             lines={4}
-            variables={Math.min(row.variableCount, 4)}
+            variables={Math.min(row.holeCount, 4)}
           />
         </span>
       {/snippet}
       <span class="text-caption text-ink-muted truncate">
-        Used {row.lastUsed} · {variableCount(row)}
+        Used {row.lastUsed} · {holeCount(row)}
       </span>
     </ScreenCard>
   </div>
@@ -236,6 +249,7 @@
       {#snippet actions()}
         <p class="text-caption text-ink-muted m-0 max-w-xs text-end">
           Reusable starting points for documents, slide decks, and spreadsheets.
+          Double-click one to edit it in its editor.
         </p>
       {/snippet}
     </ScreenHeader>
@@ -254,6 +268,9 @@
         Reading the scoped library from the representation store.
       </ScreenEmpty>
     {:else}
+      {#if openError !== undefined}
+        <ScreenNote tone="gap">{openError}</ScreenNote>
+      {/if}
       {#if unavailable.length > 0}
         <ScreenNote tone="gap">
           {unavailable.length} stored {unavailable.length === 1 ? "template is" : "templates are"}
@@ -376,7 +393,7 @@
                 : "Templates will appear here when one is created."}
             </ScreenEmpty>
           {:else}
-            <ScreenTable columns={["Name", "Makes", "Scope", "Variables", "Tags", "Updated"]}>
+            <ScreenTable columns={["Name", "Makes", "Scope", "Holes", "Tags", "Updated"]}>
               {#each ordered as row (row.id)}
                 {@const Icon = TARGET_ICON[row.makes]}
                 <ScreenRow
@@ -399,7 +416,7 @@
                   </ScreenCell>
                   <ScreenCell>{row.makes}</ScreenCell>
                   <ScreenCell>{row.scope}</ScreenCell>
-                  <ScreenCell num>{row.variableCount}</ScreenCell>
+                  <ScreenCell num>{row.holeCount}</ScreenCell>
                   <ScreenCell>{row.tags.join(", ") || "—"}</ScreenCell>
                   <ScreenCell num>{row.updated}</ScreenCell>
                 </ScreenRow>
@@ -497,11 +514,6 @@
     outline-offset: 1px;
   }
 
-  /**
-   * The preview keeps the target's shape inside a shorter, consistent card
-   * band. Cards remain recognisable without making recent history dominate the
-   * library beneath it.
-   */
   .shape {
     display: flex;
     height: calc(var(--token-spacing-unit) * 16);
~~~~

### changed · `src/lib/app-views/categories/templates/inspector/template.svelte` (+347 / −119)

~~~~diff
@@ -4,10 +4,12 @@
   import ChevronDown from "@lucide/svelte/icons/chevron-down";
   import Copy from "@lucide/svelte/icons/copy";
   import ExternalLink from "@lucide/svelte/icons/external-link";
+  import FilePenLine from "@lucide/svelte/icons/file-pen-line";
   import Plus from "@lucide/svelte/icons/plus";
   import Trash2 from "@lucide/svelte/icons/trash-2";
   import X from "@lucide/svelte/icons/x";
 
+  import { OverlayModal } from "$authored-components/overlay";
   import {
     Panel,
     PanelBanner,
@@ -15,26 +17,52 @@
     PanelEmpty,
     PanelSkeleton
   } from "$authored-components/panel";
+  import { ScopeBuilder } from "$authored-components/scope-builder";
+  import { TemplateAnswers as TemplateAnswerList } from "$authored-components/template-answers";
   import { Button } from "$vendored-components/button";
   import { Input } from "$vendored-components/input";
   import { Textarea } from "$vendored-components/textarea";
   import {
+    EDITOR_CATEGORY,
+    answerRowsOf,
+    answersFrom,
+    builderView,
+    missingIn,
+    wordsFrom,
     detailIn,
+    draftOf,
     duplicateTemplate,
+    editTemplate,
     emptyTemplateInspectorTitle,
     inspectTemplate,
     instantiateTemplate,
+    offeringOf,
+    projectResources,
     removeTemplate,
+    resourceSets,
+    resourcesIn,
+    ruleOf,
+    scopeNamesOf,
     selectedTemplateIdIn,
+    setsIn,
     templateDetail,
     templateLibrary,
+    termFor,
     unavailableTemplateIn,
     updateTemplateDescription,
     updateTemplateName,
     updateTemplateTags,
-    updateTemplateVariableDescription,
+    updateTemplateHoleDefault,
+    updateTemplateHoleDescription,
+    withTerm,
+    withWholeProject,
+    withoutTerm,
     type LibraryTemplateDetail,
-    type TemplateVariable
+    type OfferSource,
+    type ScopeDraft,
+    type ScopeSide,
+    type TemplateAnswers,
+    type TemplateHole
   } from "$app-views/categories/templates/procedures/library.svelte";
   import { workspaceState } from "$model/client/workspace-state";
 
@@ -43,6 +71,12 @@
     view.selection?.kind === "template" ? view.selection.id : undefined
   );
   const library = templateLibrary();
+  const sets = resourceSets();
+  const index = projectResources();
+  const setItems = $derived(setsIn(sets.ready ? sets.current : undefined));
+  const catalogue = $derived(resourcesIn(index.ready ? index.current : undefined));
+  const setNames = $derived(scopeNamesOf(setItems, catalogue));
+  const offering = $derived(offeringOf(setItems, catalogue));
   const availableTemplateIds = $derived(
     library.ready ? library.current.templates.map((row) => row.id) : []
   );
@@ -63,6 +97,42 @@
   });
   const template = $derived(detailIn(detailAnswer, now));
   const unavailable = $derived(unavailableTemplateIn(detailAnswer));
+  let defaultFor = $state<TemplateHole | undefined>(undefined);
+  let defaultOpen = $state(false);
+  let draft = $state<ScopeDraft>(draftOf(undefined));
+  let useOpen = $state(false);
+  let answerOpen = $state(false);
+  let useChoices = $state<Record<string, ScopeDraft | undefined>>({});
+  let useTexts = $state<Record<string, string | undefined>>({});
+  let answering = $state<TemplateHole | undefined>(undefined);
+
+  const askRows = $derived(answerRowsOf(template?.holes ?? [], useChoices, useTexts, setNames));
+  const askBlocked = $derived(
+    missingIn(askRows).length === 0 ? undefined : `${missingIn(askRows).join(", ")} still needs words.`
+  );
+  const scopeBlocked = $derived(
+    draft.include.length === 0 ? "Include something, or choose everything in the project." : undefined
+  );
+
+  /** Every builder edits this one draft, because only one is ever open. */
+  const view$ = $derived(builderView(draft, offering));
+
+  const addTerm = (side: ScopeSide, source: string, key: string) => {
+    const term = termFor(source as OfferSource, key);
+    if (term !== undefined) draft = withTerm(draft, side, term);
+  };
+
+  const dropTerm = (side: ScopeSide, key: string) => {
+    draft = withoutTerm(draft, side, key);
+  };
+
+  const setMode = (whole: boolean) => {
+    draft = whole ? withWholeProject() : { include: [], exclude: [] };
+  };
+
+  const clearScope = () => {
+    draft = { include: [], exclude: [] };
+  };
 
   let editingDescription = $state(false);
   let descriptionDraft = $state("");
@@ -74,15 +144,15 @@
   let descriptionEditor = $state<HTMLTextAreaElement | null>(null);
   let nameTrigger = $state<HTMLButtonElement | null>(null);
   let descriptionTrigger = $state<HTMLButtonElement | null>(null);
-  let editingVariable = $state<string>();
-  let variableDescriptionDraft = $state("");
-  let variableBase = $state<LibraryTemplateDetail>();
-  let variableEditor = $state<HTMLTextAreaElement | null>(null);
+  let editingHole = $state<string>();
+  let holeDescriptionDraft = $state("");
+  let holeBase = $state<LibraryTemplateDetail>();
+  let holeEditor = $state<HTMLTextAreaElement | null>(null);
   let tagEditor = $state<HTMLInputElement | null>(null);
   let tagDraft = $state("");
   let activeTemplateId = $state<string>();
   let pending = $state<
-    "name" | "description" | "variable" | "tag" | "duplicate" | "delete" | "use"
+    "name" | "description" | "hole" | "tag" | "duplicate" | "delete" | "use" | "edit" | "default"
   >();
   let actionError = $state<string>();
   let live = true;
@@ -103,9 +173,9 @@
     descriptionBase = undefined;
     tagDraft = "";
     editingDescription = false;
-    editingVariable = undefined;
-    variableDescriptionDraft = "";
-    variableBase = undefined;
+    editingHole = undefined;
+    holeDescriptionDraft = "";
+    holeBase = undefined;
     actionError = undefined;
   });
 
@@ -125,8 +195,8 @@
     if (template === undefined || !template.canEdit || pending !== undefined) return;
     editingName = false;
     nameBase = undefined;
-    editingVariable = undefined;
-    variableBase = undefined;
+    editingHole = undefined;
+    holeBase = undefined;
     descriptionBase = template;
     descriptionDraft = template.description;
     editingDescription = true;
@@ -139,8 +209,8 @@
     if (template === undefined || !template.canEdit || pending !== undefined) return;
     editingDescription = false;
     descriptionBase = undefined;
-    editingVariable = undefined;
-    variableBase = undefined;
+    editingHole = undefined;
+    holeBase = undefined;
     nameBase = template;
     nameDraft = template.name;
     editingName = true;
@@ -294,55 +364,55 @@
     }
   };
 
-  const startVariableDescription = async (variable: TemplateVariable) => {
+  const startHoleDescription = async (hole: TemplateHole) => {
     if (template === undefined || !template.canEdit || pending !== undefined) return;
     editingName = false;
     nameBase = undefined;
     editingDescription = false;
     descriptionBase = undefined;
-    variableBase = template;
-    editingVariable = variable.name;
-    variableDescriptionDraft = variable.description ?? "";
+    holeBase = template;
+    editingHole = hole.name;
+    holeDescriptionDraft = hole.description ?? "";
     await tick();
-    variableEditor?.focus();
-    variableEditor?.select();
+    holeEditor?.focus();
+    holeEditor?.select();
   };
 
-  const cancelVariableDescription = () => {
-    editingVariable = undefined;
-    variableDescriptionDraft = "";
-    variableBase = undefined;
+  const cancelHoleDescription = () => {
+    editingHole = undefined;
+    holeDescriptionDraft = "";
+    holeBase = undefined;
   };
 
-  const commitVariableDescription = async (variable: TemplateVariable) => {
-    const subject = variableBase;
+  const commitHoleDescription = async (hole: TemplateHole) => {
+    const subject = holeBase;
     const originTabId = view.activeId;
     if (
       subject === undefined ||
       template?.id !== subject.id ||
-      editingVariable !== variable.name ||
+      editingHole !== hole.name ||
       !subject.canEdit ||
       pending !== undefined
     ) {
       return;
     }
-    if (variableDescriptionDraft.trim() === (variable.description ?? "").trim()) {
-      cancelVariableDescription();
+    if (holeDescriptionDraft.trim() === (hole.description ?? "").trim()) {
+      cancelHoleDescription();
       return;
     }
 
-    pending = "variable";
+    pending = "hole";
     actionError = undefined;
     try {
-      const result = await updateTemplateVariableDescription(
+      const result = await updateTemplateHoleDescription(
         view,
         subject,
-        variable.name,
-        variableDescriptionDraft
+        hole.name,
+        holeDescriptionDraft
       );
       if (!stillInspecting(originTabId, subject.id)) return;
       if (!result.accepted) actionError = result.detail;
-      else cancelVariableDescription();
+      else cancelHoleDescription();
     } catch (error) {
       fail(error, originTabId, subject.id);
     } finally {
@@ -350,10 +420,10 @@
     }
   };
 
-  const variableKeydown = (event: KeyboardEvent) => {
+  const holeKeydown = (event: KeyboardEvent) => {
     if (event.key !== "Escape") return;
     event.preventDefault();
-    cancelVariableDescription();
+    cancelHoleDescription();
   };
 
   const addTag = async () => {
@@ -450,35 +520,114 @@
     }
   };
 
-  const use = async () => {
+  const use = () => {
     if (template === undefined || pending !== undefined) return;
-    const subject = template;
-    const originTabId = view.activeId;
-
-    if (subject.makes === "Spreadsheet") {
+    if (template.makes === "Spreadsheet") {
       actionError = SPREADSHEET_HANDOFF;
       return;
     }
+    if (template.holes.length === 0) {
+      void instantiate({});
+      return;
+    }
+    useChoices = {};
+    useTexts = {};
+    answering = undefined;
+    useOpen = true;
+  };
+
+  const confirmUse = () => void instantiate(answersFrom(useChoices), wordsFrom(useTexts));
+
+  /**
+   * The builder is its own modal rather than a second face of the ask modal.
+   * Swapping one modal's title, body and confirm while it is open replaces the
+   * footer under the pointer, and the press lands on a button that has gone.
+   */
+  const openAnswer = (name: string) => {
+    const hole = template?.holes.find((candidate) => candidate.name === name);
+    if (hole === undefined) return;
+    answering = hole;
+    draft = draftOf(useChoices[name] ?? hole.default);
+    useOpen = false;
+    answerOpen = true;
+  };
+
+  const confirmAnswer = () => {
+    if (answering !== undefined) useChoices = { ...useChoices, [answering.name]: draft };
+    answering = undefined;
+    answerOpen = false;
+    useOpen = true;
+  };
+
+  const cancelAnswer = () => {
+    answering = undefined;
+    useOpen = true;
+  };
+
+  /** Inside the ask, Default means the template's own suggestion, not the floor. */
+  const resetAnswering = () => {
+    if (answering !== undefined) clearAnswer(answering.name);
+    answering = undefined;
+    answerOpen = false;
+    useOpen = true;
+  };
+
+  const writeText = (name: string, words: string) => {
+    useTexts = { ...useTexts, [name]: words };
+  };
+
+  const clearAnswer = (name: string) => {
+    const { [name]: _chosen, ...restChoices } = useChoices;
+    const { [name]: _typed, ...restTexts } = useTexts;
+    useChoices = restChoices;
+    useTexts = restTexts;
+  };
+
+  const instantiate = async (
+    answers: TemplateAnswers,
+    words: Readonly<Record<string, string>> = {}
+  ) => {
+    if (template === undefined || pending !== undefined) return;
+    const subject = template;
+    const originTabId = view.activeId;
 
     pending = "use";
     actionError = undefined;
     try {
-      const result = await instantiateTemplate(view, subject);
+      const result = await instantiateTemplate(view, subject, answers, words);
       if (!stillInspecting(originTabId, subject.id)) return;
       if (!result.accepted) {
         actionError = result.detail;
         return;
       }
 
-      const category = {
-        document: "document-editor",
-        slides: "slide-deck-editor"
-      } as const;
       if (result.target === "spreadsheet") {
         actionError = SPREADSHEET_HANDOFF;
         return;
       }
-      view.open({ category: category[result.target], resourceId: result.resourceId });
+      view.open({ category: EDITOR_CATEGORY[result.target], resourceId: result.resourceId });
+    } catch (error) {
+      fail(error, originTabId, subject.id);
+    } finally {
+      pending = undefined;
+    }
+  };
+
+  const edit = async () => {
+    if (template === undefined || pending !== undefined) return;
+    const subject = template;
+    const originTabId = view.activeId;
+    if (subject.makes === "Spreadsheet") {
+      actionError = "Spreadsheet templates open for editing once the spreadsheet editor lands.";
+      return;
+    }
+
+    pending = "edit";
+    actionError = undefined;
+    try {
+      const result = await editTemplate(view, subject);
+      if (!live) return;
+      if (!result.accepted) actionError = result.detail;
     } catch (error) {
       fail(error, originTabId, subject.id);
     } finally {
@@ -486,9 +635,31 @@
     }
   };
 
-  /** Placeholder for the variable settings modal; defaults stay unchanged until that contract exists. */
-  const showVariableSettings = (variable: TemplateVariable) => {
-    alert(`Variable settings for “${variable.label}” will open here.`);
+  const openDefault = (hole: TemplateHole) => {
+    if (template === undefined || !template.canEdit || pending !== undefined) return;
+    defaultFor = hole;
+    draft = draftOf(hole.default);
+    defaultOpen = true;
+  };
+
+  const setDefault = async () => {
+    const hole = defaultFor;
+    if (template === undefined || hole === undefined || pending !== undefined) return;
+    const subject = template;
+    const originTabId = view.activeId;
+    const rule = draft;
+
+    pending = "default";
+    actionError = undefined;
+    try {
+      const result = await updateTemplateHoleDefault(view, subject, hole.name, rule);
+      if (!stillInspecting(originTabId, subject.id)) return;
+      if (!result.accepted) actionError = result.detail;
+    } catch (error) {
+      fail(error, originTabId, subject.id);
+    } finally {
+      pending = undefined;
+    }
   };
 </script>
 
@@ -600,6 +771,17 @@
             : "Use template — create an independent project resource"}
           onclick={use}
         ><ExternalLink aria-hidden="true" /></Button>
+        <Button
+          variant="ghost"
+          size="icon-sm"
+          class="template-action"
+          aria-label={pending === "edit" ? "Opening template" : "Edit template"}
+          disabled={pending !== undefined || template.makes === "Spreadsheet"}
+          title={template.makes === "Spreadsheet"
+            ? "Spreadsheet templates open for editing once the spreadsheet editor lands"
+            : "Edit template — open a copy in its editor"}
+          onclick={edit}
+        ><FilePenLine aria-hidden="true" /></Button>
         <Button
           variant="ghost"
           size="icon-sm"
@@ -621,7 +803,7 @@
       </div>
 
       {#if !template.canEdit}
-        <p class="permission-note">Duplicate this template to edit its name, description, variables, or tags.</p>
+        <p class="permission-note">Duplicate this template to edit its name, description, holes, or tags.</p>
       {/if}
       {#if template.makes === "Spreadsheet"}
         <p class="permission-note">{SPREADSHEET_HANDOFF}</p>
@@ -629,61 +811,64 @@
 
       <div class="divider" aria-hidden="true"></div>
 
-      <section aria-labelledby="variables-heading">
-        <h3 id="variables-heading" class="section-heading">
-          Variables <span>{template.variables.length}</span>
+      <section aria-labelledby="holes-heading">
+        <h3 id="holes-heading" class="section-heading">
+          Holes <span>{template.holes.length}</span>
         </h3>
 
-        {#if template.variables.length === 0}
-          <PanelEmpty title="This template asks for no variables." flush />
+        {#if template.holes.length === 0}
+          <PanelEmpty title="This template asks for no holes." flush />
         {:else}
-          <div class="variable-list">
-            {#each template.variables as variable (variable.id)}
-              <details class="variable">
+          <div class="hole-list">
+            {#each template.holes as hole (hole.id)}
+              <details class="hole">
                 <summary>
-                  <button
-                    type="button"
-                    class="variable-name"
-                    title="Open variable settings"
-                    aria-label={`Open settings for ${variable.label}`}
-                    onclick={(event) => {
-                      event.preventDefault();
-                      event.stopPropagation();
-                      showVariableSettings(variable);
-                    }}
-                  >
+                  <span class="hole-name">
                     <Braces size={13} aria-hidden="true" />
-                    {variable.label}
-                  </button>
+                    {hole.label}
+                  </span>
                   <ChevronDown class="disclosure-icon" size={13} aria-hidden="true" />
                 </summary>
-                <div class="variable-body">
-                  {#if editingVariable === variable.name}
+                <div class="hole-body">
+                  {#if editingHole === hole.name}
                     <Textarea
-                      bind:ref={variableEditor}
-                      class="variable-description-editor"
-                      bind:value={variableDescriptionDraft}
-                      aria-label={`Description for ${variable.label}`}
+                      bind:ref={holeEditor}
+                      class="hole-description-editor"
+                      bind:value={holeDescriptionDraft}
+                      aria-label={`Description for ${hole.label}`}
                       rows={3}
-                      onkeydown={variableKeydown}
-                      onblur={() => commitVariableDescription(variable)}
+                      onkeydown={holeKeydown}
+                      onblur={() => commitHoleDescription(hole)}
                     />
                   {:else if template.canEdit}
                     <button
                       type="button"
-                      class="variable-description"
+                      class="hole-description"
                       title="Double-click to edit this description"
-                      aria-label={`Edit description for ${variable.label}`}
-                      ondblclick={() => startVariableDescription(variable)}
+                      aria-label={`Edit description for ${hole.label}`}
+                      ondblclick={() => startHoleDescription(hole)}
                       onkeydown={(event) => {
                         if (event.key === "Enter" || event.key === " ") {
-                          startVariableDescription(variable);
+                          startHoleDescription(hole);
                         }
                       }}
-                    >{variable.description ?? "Add a description"}</button>
+                    >{hole.description ?? "Add a description"}</button>
                   {:else}
-                    <p>{variable.description ?? "No description supplied."}</p>
+                    <p>{hole.description ?? "No description supplied."}</p>
                   {/if}
+                  <div class="hole-default">
+                    {#if template.canEdit}
+                      <Button
+                        variant="outline"
+                        size="xs"
+                        title={`${ruleOf(hole.default, setNames)} — change what ${hole.label} selects by default`}
+                        disabled={pending !== undefined}
+                        onclick={() => openDefault(hole)}
+                      >Default scope</Button>
+                    {:else}
+                      <span>{ruleOf(hole.default, setNames)}</span>
+                    {/if}
+                  </div>
                 </div>
               </details>
             {/each}
@@ -759,7 +944,58 @@
   {/if}
 </Panel>
 
+<OverlayModal
+  bind:open={useOpen}
+  title={`Use “${template?.name ?? "the template"}”`}
+  description="Every parameter this template asks for. Open one to read what it means."
+  confirm="Create"
+  width="wide"
+  blocked={askBlocked}
+  onconfirm={confirmUse}
+>
+  <TemplateAnswerList
+    rows={askRows}
+    onscope={openAnswer}
+    ontext={writeText}
+    onreset={clearAnswer}
+  />
+</OverlayModal>
+
+<OverlayModal
+  bind:open={answerOpen}
+  title={`What ${answering?.label ?? "the parameter"} selects here`}
+  description="For the new resource only. Nothing here changes the template."
+  confirm="Use this"
+  width="wide"
+  blocked={scopeBlocked}
+  onconfirm={confirmAnswer}
+  oncancel={cancelAnswer}
+>
+  <ScopeBuilder
+    {...view$}
+    resettable
+    onmode={setMode}
+    onadd={addTerm}
+    ondrop={dropTerm}
+    onclear={clearScope}
+    onreset={resetAnswering}
+  />
+</OverlayModal>
+
+<OverlayModal
+  bind:open={defaultOpen}
+  title={`Default scope for ${defaultFor?.label ?? "the parameter"}`}
+  description="What it selects until whoever places the template says otherwise."
+  confirm="Set the default scope"
+  width="wide"
+  blocked={scopeBlocked}
+  onconfirm={() => void setDefault()}
+>
+  <ScopeBuilder {...view$} onmode={setMode} onadd={addTerm} ondrop={dropTerm} onclear={clearScope} />
+</OverlayModal>
+
 <style>
+
   .inspector-stack {
     display: flex;
     flex-direction: column;
@@ -776,7 +1012,7 @@
   .meta-line,
   .byline,
   .description,
-  .variable-body {
+  .hole-body {
     font-size: var(--token-text-caption);
     line-height: var(--token-text-caption-leading);
   }
@@ -906,7 +1142,7 @@
 
   .template-actions {
     display: grid;
-    grid-template-columns: repeat(3, minmax(0, 1fr));
+    grid-template-columns: repeat(4, minmax(0, 1fr));
     align-self: stretch;
     overflow: hidden;
     width: 100%;
@@ -987,17 +1223,17 @@
     font-weight: 500;
   }
 
-  .variable-list {
+  .hole-list {
     overflow: hidden;
     border: 1px solid var(--token-border-subtle);
     border-radius: var(--token-radius-panel);
   }
 
-  .variable + .variable {
+  .hole + .hole {
     border-top: 1px solid var(--token-border-subtle);
   }
 
-  .variable summary {
+  .hole summary {
     display: flex;
     min-height: calc(var(--token-spacing-unit) * 8);
     align-items: center;
@@ -1011,75 +1247,67 @@
     list-style: none;
   }
 
-  .variable summary::-webkit-details-marker {
+  .hole summary::-webkit-details-marker {
     display: none;
   }
 
-  .variable summary:hover {
+  .hole summary:hover {
     background: var(--token-surface-panel-hover);
   }
 
-  .variable[open] > summary {
+  .hole[open] > summary {
     background: var(--token-surface-panel-hover);
     color: var(--token-ink-primary);
   }
 
-  .variable summary:focus-visible {
+  .hole summary:focus-visible {
     outline: 2px solid var(--token-color-interactive-border);
     outline-offset: -2px;
   }
 
-  .variable-name {
+  .hole-name {
     display: flex;
     min-width: 0;
     align-items: center;
     gap: calc(var(--token-spacing-unit) * 1.5);
-    padding: 0;
-    border: 0;
-    background: transparent;
     color: inherit;
-    cursor: pointer;
     font: inherit;
     font-weight: 600;
     text-align: left;
   }
 
-  .variable-name:hover {
-    text-decoration: underline;
-    text-underline-offset: 2px;
-  }
-
-  .variable-name:focus-visible {
-    border-radius: var(--token-radius-control);
-    outline: 2px solid var(--token-color-interactive-border);
-    outline-offset: 2px;
-  }
-
-  .variable-name :global(svg) {
+  .hole-name :global(svg) {
     flex: none;
     color: var(--token-ink-muted);
   }
 
+  .hole-default {
+    display: flex;
+    align-items: center;
+    margin-top: calc(var(--token-spacing-unit) * 1.5);
+    color: var(--token-ink-secondary);
+  }
+
   :global(.disclosure-icon) {
     flex: none;
     color: var(--token-ink-muted);
     transition: transform var(--token-motion-small) var(--token-ease-standard);
   }
 
-  .variable[open] :global(.disclosure-icon) {
+  .hole[open] :global(.disclosure-icon) {
     transform: rotate(180deg);
   }
 
-  .variable-body {
+  .hole-body {
     padding: 0 calc(var(--token-spacing-unit) * 2) calc(var(--token-spacing-unit) * 2.5);
     color: var(--token-ink-muted);
   }
 
-  .variable-body p {
+  .hole-body p {
     margin: 0;
   }
 
-  .variable-description {
+  .hole-description {
     display: block;
     width: 100%;
     margin: 0;
@@ -1093,16 +1321,16 @@
     text-align: left;
   }
 
-  .variable-description:hover {
+  .hole-description:hover {
     color: var(--token-ink-secondary);
   }
 
-  .variable-description:focus-visible {
+  .hole-description:focus-visible {
     outline: 2px solid var(--token-color-interactive-surface);
     outline-offset: 2px;
   }
 
-  :global(.variable-description-editor) {
+  :global(.hole-description-editor) {
     height: calc(var(--token-spacing-unit) * 18);
     min-height: calc(var(--token-spacing-unit) * 18);
     max-height: calc(var(--token-spacing-unit) * 18);
~~~~

### changed · `src/lib/app-views/categories/templates/procedures/library.svelte.ts` (+177 / −45)

~~~~diff
@@ -2,33 +2,47 @@ import {
   createTemplate as createTemplateRemote,
   duplicateTemplate as duplicateTemplateRemote,
   instantiateTemplate as instantiateTemplateRemote,
+  openTemplateStage as openTemplateStageRemote,
   readTemplate,
   readTemplateLibrary,
   removeTemplate as removeTemplateRemote,
   updateTemplate as updateTemplateRemote,
   type ReadTemplateLibraryResult,
   type ReadTemplateResult,
+  type TemplateAnswers,
   type TemplateDetail,
   type TemplateLibraryItem,
   type TemplateUnavailable,
   type TemplateTarget as StoredTemplateTarget
 } from "$capabilities/templates/index.remote";
-import { readProjectResourceIndex } from "$capabilities/project-resources/index.remote";
-import type { WorkspaceStateModel } from "$model/client/workspace-state";
+import {
+  readProjectResourceIndex,
+  type ProjectResourceIndex
+} from "$capabilities/project-resources/index.remote";
+import {
+  readResourceSets,
+  type ReadResourceSetsResult,
+  type ResourceSetItem
+} from "$capabilities/resource-sets/index.remote";
+import { asId } from "$representation/data/behavior/core/id";
+import {
+  narrowed,
+  type ScopeDraft,
+  type ScopeNames,
+  type ScopeOffering
+} from "$representation/data/behavior/core/scope-draft";
+import type { Category, WorkspaceStateModel } from "$model/client/workspace-state";
+
+export type { ResourceSetItem } from "$capabilities/resource-sets/index.remote";
+export type { TemplateAnswers } from "$capabilities/templates/index.remote";
 
-/** The target and availability words used by the library UI. */
 export type TemplateTarget = "Document" | "Slide deck" | "Spreadsheet";
 export type TemplateScope = "Project" | "Personal";
 
-export type TemplateVariable = TemplateDetail["variables"][number] & {
-  /** Stable inside one template; represented variables are named rather than identified. */
+export type TemplateHole = TemplateDetail["holes"][number] & {
   readonly id: string;
 };
 
-/**
- * The compact read model shared by the content, context, and inspector surfaces.
- * It is a projection of the Templates capability answer, never a second source of data.
- */
 export type LibraryTemplate = {
   readonly id: string;
   readonly name: string;
@@ -36,7 +50,7 @@ export type LibraryTemplate = {
   readonly makes: TemplateTarget;
   readonly scope: TemplateScope;
   readonly tags: readonly string[];
-  readonly variableCount: number;
+  readonly holeCount: number;
   readonly createdBy: string;
   readonly revision: number;
   readonly updatedAt: number;
@@ -48,7 +62,7 @@ export type LibraryTemplate = {
 };
 
 export type LibraryTemplateDetail = LibraryTemplate & {
-  readonly variables: readonly TemplateVariable[];
+  readonly holes: readonly TemplateHole[];
 };
 
 export type TemplateLibrarySummary = {
@@ -72,6 +86,16 @@ const TARGET_VALUE: Record<TemplateTarget, StoredTemplateTarget> = {
   Spreadsheet: "spreadsheet"
 };
 
+export const EDITOR_CATEGORY: Record<Exclude<StoredTemplateTarget, "spreadsheet">, Category> = {
+  document: "document-editor",
+  slides: "slide-deck-editor"
+};
+
+const EDITOR_TEMPLATES_PANEL = {
+  document: "document-editor.templates",
+  slides: "slide-deck-editor.templates"
+} as const;
+
 const SCOPE_LABEL = {
   project: "Project",
   personal: "Personal"
@@ -81,7 +105,6 @@ const MINUTE = 60_000;
 const HOUR = 60 * MINUTE;
 const DAY = 24 * HOUR;
 
-/** One timestamp, said the same way in the shelf, table, and inspector. */
 export const relativeTime = (at: number, now: number): string => {
   const gap = Math.max(0, now - at);
   if (gap < MINUTE) return "just now";
@@ -109,7 +132,7 @@ const project = (row: TemplateLibraryItem, now: number): LibraryTemplate => ({
   makes: TARGET_LABEL[row.target],
   scope: SCOPE_LABEL[row.availability],
   tags: row.tags,
-  variableCount: row.variableCount,
+  holeCount: row.holeCount,
   createdBy: row.createdByName,
   revision: row.revision,
   updatedAt: row.updatedAt,
@@ -120,54 +143,46 @@ const project = (row: TemplateLibraryItem, now: number): LibraryTemplate => ({
   canDelete: row.canDelete
 });
 
-/** Start the scoped, metadata-only library read. */
 export const templateLibrary = () => readTemplateLibrary();
 
-/** Start the body-bearing read only when a real template is selected. */
 export const templateDetail = (templateId: string | undefined) =>
   templateId === undefined ? undefined : readTemplate({ templateId });
 
-/** Keep restored legacy or deleted selections away from the strict server read boundary. */
 export const selectedTemplateIdIn = (
   templateId: string | undefined,
   availableIds: readonly string[]
 ): string | undefined =>
   templateId !== undefined && availableIds.includes(templateId) ? templateId : undefined;
 
-/** Explain an empty inspector without pretending that an absent selection is a row id. */
 export const emptyTemplateInspectorTitle = (templateCount: number | undefined): string =>
   templateCount === 0 ? "No templates exist." : "Select a template to inspect it.";
 
-/** Every template visible to the current scoped capability call. */
 export const templatesIn = (
   answer: ReadTemplateLibraryResult | undefined,
   now: number
 ): readonly LibraryTemplate[] => answer?.templates.map((row) => project(row, now)) ?? [];
 
-/** The full selected template, projected into the same display vocabulary as the table. */
 export const detailIn = (
   answer: ReadTemplateResult | undefined,
   now: number
 ): LibraryTemplateDetail | undefined => {
   if (answer === null || answer === undefined || "unavailable" in answer) return undefined;
 
-  const row = project({ ...answer, variableCount: answer.variables.length }, now);
+  const row = project({ ...answer, holeCount: answer.holes.length }, now);
   return {
     ...row,
-    variables: answer.variables.map((variable) => ({
-      ...variable,
-      id: `${answer.id}:${variable.name}`
+    holes: answer.holes.map((hole) => ({
+      ...hole,
+      id: `${answer.id}:${hole.name}`
     }))
   };
 };
 
-/** A selected legacy row can be unavailable without taking down the library. */
 export const unavailableTemplateIn = (
   answer: ReadTemplateResult | undefined
 ): TemplateUnavailable | undefined =>
   answer !== null && answer !== undefined && "unavailable" in answer ? answer : undefined;
 
-/** The bounded usage shelf, newest use first. */
 export const recentTemplatesIn = (
   rows: readonly LibraryTemplate[],
   limit = 10
@@ -184,7 +199,6 @@ export const recentTemplatesIn = (
     .toSorted((a, b) => b.lastUsedAt - a.lastUsedAt)
     .slice(0, Math.max(0, limit));
 
-/** Counts used by the compact library overview. */
 export const templateLibrarySummaryIn = (
   rows: readonly LibraryTemplate[]
 ): TemplateLibrarySummary => {
@@ -208,7 +222,6 @@ const defaultName = (target: TemplateTarget): string =>
     Spreadsheet: "Untitled spreadsheet template"
   })[target];
 
-/** Give a no-name creation control a required, visibly editable unique name. */
 export const nextTemplateName = (
   target: TemplateTarget,
   rows: readonly LibraryTemplate[]
@@ -220,13 +233,93 @@ export const nextTemplateName = (
   return `${base} ${suffix}`;
 };
 
-/** Keep a singleton Template tab's durable focus and transient inspector selection aligned. */
+export {
+  answerRowsOf,
+  missingIn,
+  type AnswerRow
+} from "$representation/data/behavior/templates/answers";
+
+export {
+  PROJECT_KINDS as KINDS,
+  builderView,
+  draftOf,
+  isWholeProject,
+  narrowed,
+  needsRow,
+  ruleWords as ruleOf,
+  termFor,
+  withTerm,
+  withWholeProject,
+  withoutTerm,
+  type OfferSource,
+  type ScopeDraft,
+  type ScopeNames,
+  type ScopeSide
+} from "$representation/data/behavior/core/scope-draft";
+
+export const resourceSets = () => readResourceSets();
+
+export const setsIn = (answer: ReadResourceSetsResult | undefined): readonly ResourceSetItem[] =>
+  answer?.sets ?? [];
+
+export const projectResources = () => readProjectResourceIndex();
+
+export const resourcesIn = (
+  answer: ProjectResourceIndex | undefined
+): readonly { readonly id: string; readonly kind: string; readonly name: string }[] =>
+  (answer?.resources ?? []).map((item) => ({ id: item.id, kind: item.kind, name: item.name }));
+
+/** What the builder and every sentence read a set or a resource by. */
+export const scopeNamesOf = (
+  sets: readonly ResourceSetItem[],
+  resources: readonly { readonly id: string; readonly name: string }[]
+): ScopeNames => ({
+  sets: new Map(sets.map((set) => [set.id, set.name])),
+  resources: new Map(resources.map((resource) => [resource.id, resource.name]))
+});
+
+/** What the builder is handed for a hole's default, or for an answer. */
+export const offeringOf = (
+  sets: readonly ResourceSetItem[],
+  resources: readonly { readonly id: string; readonly kind: string; readonly name: string }[]
+): ScopeOffering => ({
+  sets: sets.map((set) => ({ id: set.id, name: set.name, set: set.set })),
+  resources
+});
+
+/**
+ * The answers a caller chose, as rules.
+ *
+ * A hole nobody touched is absent, which is what makes the template's own
+ * default apply. Everything present is sent as built; the server decides
+ * whether it needs a row.
+ */
+/** The words typed for each text parameter, with the untouched ones left out. */
+export const wordsFrom = (
+  texts: Readonly<Record<string, string | undefined>>
+): Readonly<Record<string, string>> =>
+  Object.fromEntries(
+    Object.entries(texts).flatMap(([name, words]) =>
+      words === undefined || words.trim() === "" ? [] : [[name, words] as const]
+    )
+  );
+
+export const answersFrom = (
+  choices: Readonly<Record<string, ScopeDraft | undefined>>
+): TemplateAnswers =>
+  Object.fromEntries(
+    Object.entries(choices).flatMap(([name, draft]) => {
+      if (draft === undefined) return [];
+      const rule = narrowed(draft);
+      return rule === undefined ? [] : [[name, rule] as const];
+    })
+  );
+
 export const inspectTemplate = (view: WorkspaceStateModel, templateId: string): void => {
   view.open({ category: "templates", focus: templateId });
   view.inspect("templates.template", { kind: "template", id: templateId });
 };
 
-/** Create a represented template, then refresh every mounted library query. */
 export const createTemplate = (
   view: WorkspaceStateModel,
   target: TemplateTarget,
@@ -241,7 +334,6 @@ export const createTemplate = (
   );
 };
 
-/** Persist one name edit with the revision the inspector actually read. */
 export const updateTemplateName = (
   view: WorkspaceStateModel,
   row: LibraryTemplateDetail,
@@ -259,7 +351,6 @@ export const updateTemplateName = (
   );
 };
 
-/** Persist one description edit with the revision the inspector actually read. */
 export const updateTemplateDescription = (
   view: WorkspaceStateModel,
   row: LibraryTemplateDetail,
@@ -285,11 +376,10 @@ export const updateTemplateDescription = (
   );
 };
 
-/** Update variable help text while preserving its stable key, label, and default selection. */
-export const updateTemplateVariableDescription = (
+export const updateTemplateHoleDescription = (
   view: WorkspaceStateModel,
   row: LibraryTemplateDetail,
-  variableName: string,
+  holeName: string,
   description: string
 ) => {
   const storedDescription = description.trim() || null;
@@ -300,8 +390,8 @@ export const updateTemplateVariableDescription = (
       row.id,
       "update",
       row.revision,
-      "variable-description",
-      variableName,
+      "hole-description",
+      holeName,
       storedDescription
     ],
     () =>
@@ -309,13 +399,12 @@ export const updateTemplateVariableDescription = (
         templateId: row.id,
         baseRevision: row.revision,
         patch: {
-          variableDescription: { name: variableName, description: storedDescription }
+          holeDescription: { name: holeName, description: storedDescription }
         }
       }).updates(readTemplateLibrary, readTemplate({ templateId: row.id }))
   );
 };
 
-/** Persist the complete flat tag set; the server normalizes and versions it. */
 export const updateTemplateTags = (
   view: WorkspaceStateModel,
   row: LibraryTemplateDetail,
@@ -331,13 +420,31 @@ export const updateTemplateTags = (
       }).updates(readTemplateLibrary, readTemplate({ templateId: row.id }))
   );
 
-/** Copy any visible template into the current viewer's ownership. */
+export const updateTemplateHoleDefault = (
+  view: WorkspaceStateModel,
+  row: LibraryTemplateDetail,
+  holeName: string,
+  rule: ScopeDraft
+) => {
+  const holes = row.holes.map(({ id: _id, ...hole }) =>
+    hole.name === holeName ? { ...hole, default: rule } : hole
+  );
+  return view.singleFlight(
+    ["template", view.project, row.id, "update", row.revision, "hole-default", holeName, JSON.stringify(rule)],
+    () =>
+      updateTemplateRemote({
+        templateId: row.id,
+        baseRevision: row.revision,
+        patch: { holes }
+      }).updates(readTemplateLibrary, readTemplate({ templateId: row.id }))
+  );
+};
+
 export const duplicateTemplate = (view: WorkspaceStateModel, row: LibraryTemplateDetail) =>
   view.singleFlight(["template", view.project, row.id, "duplicate"], () =>
     duplicateTemplateRemote({ templateId: row.id }).updates(readTemplateLibrary)
   );
 
-/** Remove an owned template at the revision currently shown. */
 export const removeTemplate = (view: WorkspaceStateModel, row: LibraryTemplateDetail) =>
   view.singleFlight(["template", view.project, row.id, "remove", row.revision], () =>
     removeTemplateRemote({ templateId: row.id, baseRevision: row.revision }).updates(
@@ -346,11 +453,36 @@ export const removeTemplate = (view: WorkspaceStateModel, row: LibraryTemplateDe
     )
   );
 
-/** Materialize an independent project resource and refresh recency provenance. */
-export const instantiateTemplate = (view: WorkspaceStateModel, row: LibraryTemplate) =>
-  view.singleFlight(["template", view.project, row.id, "instantiate"], () =>
-    instantiateTemplateRemote({ templateId: row.id }).updates(
+export const instantiateTemplate = (
+  view: WorkspaceStateModel,
+  row: LibraryTemplate,
+  answers: TemplateAnswers = {},
+  texts: Readonly<Record<string, string>> = {}
+) =>
+  view.singleFlight(
+    ["template", view.project, row.id, "instantiate", JSON.stringify(answers), JSON.stringify(texts)],
+    () =>
+      instantiateTemplateRemote({
+        templateId: row.id,
+        ...(Object.keys(answers).length === 0 ? {} : { answers }),
+        ...(Object.keys(texts).length === 0 ? {} : { texts })
+      }).updates(readTemplateLibrary, readProjectResourceIndex)
+  );
+
+export const editTemplate = async (view: WorkspaceStateModel, row: LibraryTemplate) => {
+  const result = await view.singleFlight(["template", view.project, row.id, "stage"], () =>
+    openTemplateStageRemote({ templateId: row.id }).updates(
       readTemplateLibrary,
-      readProjectResourceIndex
+      readTemplate({ templateId: row.id }),
+      view.readStore(row.makes === "Document" ? "documents" : "slideDecks")
     )
   );
+  if (result.accepted) {
+    view.open({
+      category: EDITOR_CATEGORY[result.target],
+      resourceId: result.resourceId,
+      context: EDITOR_TEMPLATES_PANEL[result.target]
+    });
+  }
+  return result;
+};
~~~~

### changed · `src/lib/app-views/categories/templates/procedures/test/unit/library.test.ts` (+16 / −0)

~~~~diff
@@ -1,12 +1,28 @@
 import { describe, expect, it } from "vitest";
 
 import {
+  answersFrom,
   emptyTemplateInspectorTitle,
+  ruleOf,
+  scopeNamesOf,
   selectedTemplateIdIn,
   templateDetail
 } from "$app-views/categories/templates/procedures/library.svelte";
 
 describe("template library view procedures", () => {
+  it("reads a default in the shared words and sends an answer as the rule it is", () => {
+    const rule = { include: [{ select: "set" as const, setId: "resourceSets:1" as never }], exclude: [] };
+    const sets = [
+      { id: "resourceSets:1", name: "Winter filings", set: { include: [], exclude: [] }, createdByName: "Uma", revision: 1, updatedAt: 1, resolves: 2 }
+    ];
+    expect(ruleOf(rule, scopeNamesOf(sets, []))).toBe("Winter filings");
+    expect(ruleOf(rule)).toBe("A chosen group");
+    expect(answersFrom({ evidence: undefined })).toEqual({});
+    expect(
+      answersFrom({ evidence: { include: [{ select: "kinds", kinds: ["finding"] }], exclude: [] } })
+    ).toEqual({ evidence: { include: [{ select: "kinds", kinds: ["finding"] }], exclude: [] } });
+  });
+
   it("does not issue a detail read when no template is selected", () => {
     expect(templateDetail(undefined)).toBeUndefined();
   });
~~~~

### changed · `src/lib/app-views/categories/templates/templates.md` (+46 / −75)

~~~~diff
@@ -1,109 +1,80 @@
 # Templates
 
-The singleton library for reusable document, slide-deck, and spreadsheet bodies.
+The singleton library for reusable document, slide-deck, and spreadsheet bodies,
+and the door into editing any of them.
 
 | Content | Shows |
 | --- | --- |
 | [`library.svelte`](content/library.svelte) | Ten most recently used templates over a searchable, sortable, filterable table |
-| [`editor.svelte`](content/editor.svelte) | Compatibility landing that explains why authoring belongs in the ordinary editors |
+| [`editor.svelte`](content/editor.svelte) | Opens the focused template for editing in its own editor, then lands back on the library |
 
 ## Library
 
 The centre has one vertical stack: header, recently used shelf, then the complete
 table. Search reaches names, descriptions, and tags. Availability, target, and a
 bounded multi-select tag menu compose, and every sort has an explicit direction.
-A click selects the template for inspection; a double-click moves the singleton
-Template category into its authoring shell without creating a resource or a
-second workspace tab. `Use` is the only gesture that instantiates an independent
-project resource and opens its ordinary editor for documents and slide decks.
-Spreadsheet materialization exists at the capability boundary, but its library
-handoff is visibly disabled until the mock-backed spreadsheet editor consumes
-the created resource id. Represented variable
-defaults are resolved before the write; an unbound, cyclic, or excessively
-expanding variable refuses before any resource write.
+A click selects the template for inspection. A double-click **edits** it: the
+capability stages a copy of the template's body as a scratch document or deck,
+and the ordinary editor opens on that copy in its own tab. The editor's Templates
+panel is where the copy is saved back or discarded. `Use` is the separate gesture
+that instantiates an independent project resource and opens its ordinary editor
+for documents and decks, after asking, in one modal, what fills each hole, its
+default offered first; the resource it makes carries no reference
+back to the template. Spreadsheet materialization exists at the capability
+boundary, but neither Use nor Edit reaches it until the spreadsheet editor
+consumes represented resource ids.
 
 The shelf is a horizontal scrollport with a quiet bottom scrollbar. Its rows are
-not a second seed: recency is derived by joining represented documents,
-slide-decks, and spreadsheets back through their `templateId` provenance and
-taking the newest resource creation time per template. Later resource edits do
-not make an old template use look recent again.
+not a second seed: recency is the `lastUsedAt` a template records when it is
+instantiated. A resource made from a template carries no reference back to it,
+and editing a template's working copy is never a use.
 
 ## Context: overview-library
 
 The Overview context panel creates a represented empty template of any supported
 target. An optional name sits above three colored icon actions for Document,
-Slide deck, and Spreadsheet. Pressing an icon creates that kind immediately;
-the view supplies a unique working name only when the field is blank, then moves
-inspection to the returned id. A compact Total section breaks the library down
-by scope and target.
+Slide deck, and Spreadsheet. Pressing an icon creates that kind
+immediately; the view supplies a unique working name only when the field is
+blank, then moves inspection to the returned id. A compact Total section breaks
+the library down by scope and target.
 
 ## Inspector: template
 
 The inspector performs a body-bearing read only for the selected template. It
-shows target, availability, update time, creator, description, variables, and
-tags. Name and fixed-height description fields autosave on blur; variable help
-text autosaves, while clicking a variable name marks the future default-settings
-modal boundary without exposing keys or defaults in the disclosure. Tag creation
-is kept above the tags it adds. Duplicate always creates
-an independent viewer-owned copy. Delete is owner-only, revision-checked, removes
-version rows, and clears provenance from existing resources rather than deleting
-those resources. Batched removals avoid repeated whole-table rewrites. Use
-creates a new resource and leader snapshot through the Templates capability;
-spreadsheet cells are admitted in one store batch.
-
-The inspector displays the represented variable label and optional description.
-Stable keys and templated resource-set defaults remain in the capability model,
-but their future settings modal is not implemented. The library does not invent
-type or requiredness fields that representation does not carry.
-Instantiation resolves represented defaults, including nested defaults. It does
-not invent caller-supplied answers before representation defines that payload.
+shows target, availability, update time, creator, description, holes, and
+tags. Name and fixed-height description fields autosave on blur. Four actions
+sit in one row: Use, Edit, Duplicate, Delete. Edit opens the template's copy in
+its editor, making the copy if the project has none yet. Duplicate always
+creates an independent copy in the project. Delete is revision-checked and
+removes the template with its version rows and its working copy; resources made
+from it are untouched, because none refers back.
+
+Each hole opens into its description, then one button reading its default scope
+as a sentence, which opens a modal to change it — everything in the project,
+particular kinds, or one of the project's named sets. Which scope holes exist is
+not editable here: they are the names the body's prompt scopes use, found when
+the template is saved.
 
 ## Capability seam
 
 All stored reads and writes enter
 [`$capabilities/templates/index.remote.ts`](../../../capabilities/templates/index.remote.ts).
-It exposes:
-
-- `readTemplateLibrary`
-- `readTemplate`
-- `createTemplate`
-- `updateTemplate`
-- `duplicateTemplate`
-- `removeTemplate`
-- `instantiateTemplate`
-
-Every server procedure establishes request scope first. Mutations validate their
-payload, enforce ownership where relevant, and use the represented revision for
-compare-and-set updates. Template versions are written with creates and accepted
-updates. No view imports the generic store capability for template work. Store
-writes are failure-safe within one table, but the model has no transaction
-across the several tables touched by versioning, deletion, or instantiation; the
-reference documents that recovery decision explicitly.
+No view imports the generic store capability for template work.
 
 ## Availability boundary
 
-Representation currently records a template owner but no project ownership or
-sharing policy. The capability therefore returns only viewer-owned **Personal**
-rows. **Project** remains a visible future scope and reports zero until its
-ownership/transfer model is represented. **Shared** is not a current scope;
-future personal-template access should name an owner and explicit access list
-instead of introducing an ambiguous bucket. Project membership and tags are
-never used to manufacture access.
+A template belongs to the project it was made in, so every row the library
+shows is **Project** and anyone in the project may edit it. **Personal** stays
+in the scope vocabulary as a future owner-only state and reports zero until one
+is represented.
 
 ## Authoring boundary
 
-There is no separate template editor implementation in this future state. The
-singleton Template category owns a quiet, left-aligned Library return bar. The
-intended authoring body stages the template under a real
-resource id and borrows the ordinary document or slide-deck runtime below that
-header. Variable-bearing Prompt positions render as Template blocks while
-authoring; Done flushes the runtime, compare-and-sets the body back into the
-template, and then cleans up the stage.
-
-That stage needs durable identity before it is safe. Workspace close and reopen
-are persisted and undoable, and runtime release begins an asynchronous flush;
-deleting a scratch resource merely because a tab closed can therefore revive a
-dead tab or race unsaved changes. A future represented edit-session row must
-associate template, user, stage id, base revision, and expiry. Until that schema
-is approved, the compatibility content names the boundary and the library does
-not route into the old session-local authoring mock.
+There is no separate template editor. A template is edited as a **stage**: a
+scratch resource holding its body, and a row that names the template, the
+revision it was taken from, and the resource. The ordinary editor, runtime,
+comments and change sets work on the scratch resource unchanged. Saving reads
+its leader body, makes it portable, validates it as a template body, and writes
+it as the template's next revision; the stage stays open until it is discarded.
+One stage per template, shared by everyone in the project, so opening again
+resumes the same copy.
~~~~

## The document editor's Templates panel

### changed · `src/lib/app-views/categories/document-editor/content/document.svelte` (+15 / −0)

~~~~diff
@@ -888,6 +888,21 @@
     color: var(--token-color-danger-text);
   }
 
+  .editor :global(.document-formula-unbound) {
+    outline: 1px dashed var(--token-border-strong);
+    outline-offset: 1px;
+  }
+
+  /* A template's own hole, waiting for whoever places the template to fill it. */
+  .editor :global(.document-template-atom) {
+    padding: 0 0.15em;
+    border-radius: var(--token-radius-control);
+    background-color: var(--token-color-accent-1-surface);
+    color: var(--token-color-accent-1-text);
+    font-family: var(--token-font-mono);
+    font-size: 0.9em;
+  }
+
   .editor :global(.document-underline) {
     text-decoration: underline;
     text-underline-offset: 0.12em;
~~~~

### new · `src/lib/app-views/categories/document-editor/context/templates.svelte` (+683 / −0)

~~~~diff
@@ -0,0 +1,683 @@
+<script lang="ts">
+  import { onDestroy } from "svelte";
+
+  import { OverlayModal } from "$authored-components/overlay";
+  import {
+    Panel,
+    PanelBanner,
+    PanelButton,
+    PanelChip,
+    PanelEditableText,
+    PanelEmpty,
+    PanelInput,
+    PanelNote,
+    PanelRow,
+    PanelSearch,
+    PanelSection
+  } from "$authored-components/panel";
+  import { ScopeBuilder } from "$authored-components/scope-builder";
+  import { TemplateAnswers as TemplateAnswerList } from "$authored-components/template-answers";
+  import { rowsIn } from "$app-views/categories/document-editor/procedures/store";
+  import {
+    answerRowsOf,
+    answersFrom,
+    builderView,
+    missingIn,
+    wordsFrom,
+    commitStage,
+    currentRowId,
+    detailIn,
+    discardStage,
+    documentTemplatesIn,
+    draftOf,
+    holeNameRefusal,
+    insertionOf,
+    mergedHoles,
+    offeringOf,
+    openStage,
+    projectResources,
+    resourceSets,
+    resourceTemplate,
+    resourcesIn,
+    ruleOf,
+    saveAsTemplate,
+    scopeNamesOf,
+    setsIn,
+    stageIn,
+    templateDetail,
+    templateLibrary,
+    termFor,
+    textHoleInsertion,
+    updateHoles,
+    withHoleField,
+    withNewTextHole,
+    withTerm,
+    withWholeProject,
+    withoutTerm,
+    type ChosenHole,
+    type OfferSource,
+    type ScopeDraft,
+    type ScopeSide,
+    type TemplateAnswers,
+    type TemplateDetail,
+    type TemplateHole,
+    type TemplateLibraryItem
+  } from "$app-views/categories/document-editor/procedures/templating";
+  import { workspaceState } from "$model/client/workspace-state";
+  import type { DocumentRuntime } from "$model/client/workspace-state";
+
+  const view = workspaceState();
+  let live = true;
+  onDestroy(() => {
+    live = false;
+  });
+
+  const documentId = $derived(view.active.resourceId);
+
+  let runtime = $state<DocumentRuntime | undefined>(undefined);
+
+  $effect(() => {
+    runtime = documentId === undefined ? undefined : view.documentRuntime(documentId);
+  });
+
+  const body = $derived(runtime?.body);
+  const title = $derived(rowsIn("documents").find((row) => row._id === documentId)?.title);
+
+  const library = templateLibrary();
+  const sets = resourceSets();
+  const index = projectResources();
+  const setItems = $derived(setsIn(sets.ready ? sets.current : undefined));
+  const catalogue = $derived(resourcesIn(index.ready ? index.current : undefined));
+  const setNames = $derived(scopeNamesOf(setItems, catalogue));
+  const offering = $derived(offeringOf(setItems, catalogue));
+  const resourceQuery = $derived(documentId === undefined ? undefined : resourceTemplate(documentId));
+  const resource = $derived(resourceQuery?.ready ? resourceQuery.current : undefined);
+  const stage = $derived(stageIn(resource));
+  const detailQuery = $derived(templateDetail(stage?.templateId));
+  const template = $derived(detailIn(detailQuery?.ready ? detailQuery.current : undefined));
+  const templates = $derived(documentTemplatesIn(library.ready ? library.current : undefined));
+  const currentRevision = $derived(template?.revision ?? stage?.currentRevision ?? null);
+
+  let query = $state("");
+  let nameDraft = $state("");
+  let pending = $state<string | undefined>(undefined);
+  let actionError = $state<string | undefined>(undefined);
+  let notice = $state<readonly string[]>([]);
+  let defaultFor = $state<TemplateHole | undefined>(undefined);
+  let defaultOpen = $state(false);
+  let draft = $state<ScopeDraft>(draftOf(undefined));
+  let insertFor = $state<TemplateDetail | undefined>(undefined);
+  let insertOpen = $state(false);
+  let answerOpen = $state(false);
+  let choices = $state<Record<string, ScopeDraft | undefined>>({});
+  let texts = $state<Record<string, string | undefined>>({});
+  let answering = $state<TemplateHole | undefined>(undefined);
+  let makeOpen = $state(false);
+  let holeName = $state("");
+  let holeDescription = $state("");
+  let holeText = $state("");
+
+  const askRows = $derived(answerRowsOf(insertFor?.holes ?? [], choices, texts, setNames));
+  const askBlocked = $derived(
+    missingIn(askRows).length === 0 ? undefined : `${missingIn(askRows).join(", ")} still needs words.`
+  );
+
+  const shown = $derived(
+    templates.filter((item) => item.name.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()))
+  );
+
+  const fail = (error: unknown) => {
+    if (live) actionError = error instanceof Error ? error.message : String(error);
+  };
+
+  const run = async (key: string, work: () => Promise<void>) => {
+    if (pending !== undefined) return;
+    pending = key;
+    actionError = undefined;
+    try {
+      await work();
+    } catch (error) {
+      fail(error);
+    } finally {
+      if (live) pending = undefined;
+    }
+  };
+
+  const settled = async (): Promise<boolean> => {
+    if (runtime === undefined) return false;
+    await runtime.flush();
+    if (runtime.pending > 0 || runtime.failure !== undefined) {
+      actionError = "The document has changes that are not saved yet. Save them first.";
+      return false;
+    }
+    return true;
+  };
+
+  const save = () =>
+    run("save", async () => {
+      if (documentId === undefined || stage === undefined || currentRevision === null) return;
+      if (!(await settled())) return;
+      const result = await commitStage(
+        view,
+        { stageId: stage.stageId, templateId: stage.templateId, baseRevision: currentRevision },
+        documentId
+      );
+      if (!live) return;
+      if (!result.accepted) {
+        actionError = result.detail;
+        return;
+      }
+      notice = result.dropped.length === 0 ? ["Saved to the template."] : ["Saved to the template.", ...result.dropped];
+    });
+
+  const discard = () =>
+    run("discard", async () => {
+      if (documentId === undefined || stage === undefined) return;
+      if (!confirm(`Discard the working copy of “${stage.templateName}”? Unsaved edits are lost.`)) return;
+      if (!(await settled())) return;
+      const tab = view.activeId;
+      const result = await discardStage(view, { stageId: stage.stageId, templateId: stage.templateId }, documentId);
+      if (!live) return;
+      if (!result.accepted) {
+        actionError = result.detail;
+        return;
+      }
+      view.close(tab);
+    });
+
+  const saveAs = () =>
+    run("save-as", async () => {
+      const name = nameDraft.trim();
+      if (documentId === undefined || name === "") return;
+      const made = await saveAsTemplate(view, documentId, name);
+      if (!live) return;
+      if (!made.accepted) {
+        actionError = made.detail;
+        return;
+      }
+      nameDraft = "";
+      notice = [`Saved as the template “${name}”.`, ...made.dropped];
+      const opened = await openStage(view, made.templateId);
+      if (!live) return;
+      if (!opened.accepted) {
+        actionError = opened.detail;
+        return;
+      }
+      view.open({
+        category: "document-editor",
+        resourceId: opened.resourceId,
+        context: "document-editor.templates"
+      });
+    });
+
+  const edit = (item: TemplateLibraryItem) =>
+    run(`edit:${item.id}`, async () => {
+      const result = await openStage(view, item.id);
+      if (!live) return;
+      if (!result.accepted) {
+        actionError = result.detail;
+        return;
+      }
+      view.open({
+        category: "document-editor",
+        resourceId: result.resourceId,
+        context: "document-editor.templates"
+      });
+    });
+
+  const place = async (
+    detail: TemplateDetail,
+    answers: TemplateAnswers,
+    words: Readonly<Record<string, string>> = {}
+  ) => {
+    if (body === undefined || runtime === undefined) return;
+    const insertion = insertionOf(
+      body,
+      detail,
+      currentRowId(body, view.selection),
+      stage === undefined ? "resolve" : "keep",
+      answers,
+      words
+    );
+    if (insertion.ops.length === 0) {
+      notice = ["That template has no content to insert."];
+      return;
+    }
+    runtime.apply(insertion.ops);
+    if (insertion.firstBlockId !== undefined) runtime.scrollTo = insertion.firstBlockId;
+    if (stage !== undefined && template !== undefined) {
+      const merged = mergedHoles(template.holes, detail.holes);
+      if (merged.length !== template.holes.length) {
+        const result = await updateHoles(view, template, merged, documentId);
+        if (live && !result.accepted) actionError = result.detail;
+      }
+    }
+    notice = [`Inserted “${detail.name}”.`];
+  };
+
+  const insert = (item: TemplateLibraryItem) =>
+    run(`insert:${item.id}`, async () => {
+      if (body === undefined || runtime === undefined) return;
+      const detail = detailIn(await templateDetail(item.id));
+      if (detail === undefined) {
+        actionError = "That template could not be read.";
+        return;
+      }
+      if (stage === undefined && detail.holes.length > 0) {
+        insertFor = detail;
+        choices = {};
+        texts = {};
+        answering = undefined;
+        insertOpen = true;
+        return;
+      }
+      await place(detail, {});
+    });
+
+  const confirmInsert = () => {
+    const detail = insertFor;
+    if (detail === undefined) return;
+    void run(`place:${detail.id}`, () => place(detail, answersFrom(choices), wordsFrom(texts)));
+  };
+
+  const changeHoles = (next: readonly ChosenHole[]) =>
+    run("holes", async () => {
+      if (template === undefined) return;
+      const result = await updateHoles(view, template, next, documentId);
+      if (live && !result.accepted) actionError = result.detail;
+    });
+
+  const openDefault = (hole: TemplateHole) => {
+    defaultFor = hole;
+    draft = draftOf(hole.default);
+    defaultOpen = true;
+  };
+
+  const confirmDefault = () => {
+    if (template === undefined || defaultFor === undefined) return;
+    void changeHoles(withHoleField(template.holes, defaultFor.name, { default: draft }));
+  };
+
+  const openMake = () => {
+    holeName = "";
+    holeDescription = "";
+    holeText = "";
+    makeOpen = true;
+  };
+
+  /**
+   * Declaring the hole and dropping its atom are one act, because a hole nothing
+   * in the prose asks for is a hole that fills nothing.
+   */
+  const confirmMake = () =>
+    void run("make-hole", async () => {
+      if (template === undefined || body === undefined || runtime === undefined) return;
+      const name = holeName.trim();
+      const ops = textHoleInsertion(body, view.selection, name);
+      if (ops.length === 0) {
+        actionError = "Put the caret in some text first — that is where the hole goes.";
+        return;
+      }
+      const result = await updateHoles(
+        view,
+        template,
+        withNewTextHole(template.holes, { name, description: holeDescription, text: holeText }),
+        documentId
+      );
+      if (!live) return;
+      if (!result.accepted) {
+        actionError = result.detail;
+        return;
+      }
+      runtime.apply(ops);
+      makeOpen = false;
+      notice = [`Added the hole “${name}”.`];
+    });
+
+  /**
+   * The builder is its own modal rather than a second face of the ask modal.
+   * Swapping one modal's title, body and confirm while it is open replaces the
+   * footer under the pointer, and the press lands on a button that has gone.
+   */
+  const openAnswer = (name: string) => {
+    const hole = insertFor?.holes.find((candidate) => candidate.name === name);
+    if (hole === undefined) return;
+    answering = hole;
+    draft = draftOf(choices[name] ?? hole.default);
+    insertOpen = false;
+    answerOpen = true;
+  };
+
+  const confirmAnswer = () => {
+    if (answering !== undefined) choices = { ...choices, [answering.name]: draft };
+    answering = undefined;
+    answerOpen = false;
+    insertOpen = true;
+  };
+
+  const cancelAnswer = () => {
+    answering = undefined;
+    insertOpen = true;
+  };
+
+  /** Inside the ask, Default means the template's own suggestion, not the floor. */
+  const resetAnswering = () => {
+    if (answering !== undefined) clearAnswer(answering.name);
+    answering = undefined;
+    answerOpen = false;
+    insertOpen = true;
+  };
+
+  const writeText = (name: string, words: string) => {
+    texts = { ...texts, [name]: words };
+  };
+
+  const clearAnswer = (name: string) => {
+    const { [name]: _chosen, ...restChoices } = choices;
+    const { [name]: _typed, ...restTexts } = texts;
+    choices = restChoices;
+    texts = restTexts;
+  };
+
+
+  /** Every builder edits this one draft, because only one is ever open. */
+  const view$ = $derived(builderView(draft, offering));
+
+  const addTerm = (side: ScopeSide, source: string, key: string) => {
+    const term = termFor(source as OfferSource, key);
+    if (term !== undefined) draft = withTerm(draft, side, term);
+  };
+
+  const dropTerm = (side: ScopeSide, key: string) => {
+    draft = withoutTerm(draft, side, key);
+  };
+
+  const setMode = (whole: boolean) => {
+    draft = whole ? withWholeProject() : { include: [], exclude: [] };
+  };
+
+  const clearScope = () => {
+    draft = { include: [], exclude: [] };
+  };
+
+  const busy = $derived(pending !== undefined || body === undefined);
+  const scopeBlocked = $derived(
+    draft.include.length === 0 ? "Include something, or choose everything in the project." : undefined
+  );
+  const makeBlocked = $derived(holeNameRefusal(template?.holes ?? [], holeName));
+</script>
+
+<Panel title="Templates">
+  {#snippet actions()}
+    {#if documentId !== undefined && stage !== undefined}
+      <PanelButton label="Save" tone="primary" disabled={busy} title="Write this copy back to the template" onclick={save} />
+      <PanelButton label="Discard" tone="danger" disabled={busy} title="Remove this copy and close it" onclick={discard} />
+    {/if}
+  {/snippet}
+
+  {#if documentId === undefined}
+    <PanelEmpty title="Open a document to work with templates" />
+  {:else}
+    {#if actionError}
+      <PanelBanner title="That did not happen" tone="attention">{actionError}</PanelBanner>
+    {/if}
+    {#if notice.length > 0}
+      <div class="notice">
+        {#each notice as line (line)}
+          <PanelNote>{line}</PanelNote>
+        {/each}
+      </div>
+    {/if}
+
+    {#if resourceQuery === undefined || !resourceQuery.ready}
+      <PanelNote>Reading this document…</PanelNote>
+    {:else if stage !== undefined}
+      <div class="after-verbs">
+        <PanelSection title="Holes" count={template?.holes.length} chevron="end">
+          <div class="make">
+            <PanelButton
+              label="Create hole"
+              disabled={busy || template === undefined}
+              title="Name a text hole and drop it where the caret is"
+              onclick={openMake}
+            />
+          </div>
+          {#if template === undefined}
+            <PanelNote>Reading the template…</PanelNote>
+          {:else}
+            {#each template.holes as hole (hole.name)}
+              <article class="hole">
+                <header>
+                  <PanelChip tone="accent-1">{hole.name}</PanelChip>
+                  <span class="hole-label">{hole.label}</span>
+                </header>
+                <PanelEditableText
+                  value={hole.description ?? ""}
+                  label={`Description for ${hole.label}`}
+                  placeholder="What this hole stands for"
+                  multiline
+                  disabled={busy}
+                  onchange={(next) => changeHoles(withHoleField(template.holes, hole.name, { description: next }))}
+                />
+                {#if hole.kind === "text"}
+                  <PanelEditableText
+                    value={hole.text ?? ""}
+                    label={`Default words for ${hole.label}`}
+                    placeholder="What it says when nobody says otherwise"
+                    multiline
+                    disabled={busy}
+                    onchange={(next) => changeHoles(withHoleField(template.holes, hole.name, { text: next }))}
+                  />
+                {:else}
+                  <div class="scope">
+                    <PanelButton
+                      label="Default scope"
+                      disabled={busy}
+                      title={`${ruleOf(hole.default, setNames)} — change what ${hole.label} selects by default`}
+                      onclick={() => openDefault(hole)}
+                    />
+                  </div>
+                {/if}
+              </article>
+            {/each}
+          {/if}
+        </PanelSection>
+      </div>
+    {:else}
+      <div class="save">
+        <PanelInput label="Template name" placeholder={title ?? "Template name"} flush bind:value={nameDraft} onenter={saveAs} />
+        <PanelButton label="Save" tone="primary" disabled={busy || nameDraft.trim() === ""} title={nameDraft.trim() === "" ? "Give the template a name first" : "Copy this document into a new template and open it"} onclick={saveAs} />
+      </div>
+    {/if}
+
+    <div class="after-holes">
+    <PanelSection title="List" chevron="end" flush>
+      {#if library.error}
+        <PanelBanner title="Templates unavailable" tone="danger">
+          {library.error instanceof Error ? library.error.message : String(library.error)}
+        </PanelBanner>
+      {:else if !library.ready}
+        <PanelNote>Reading the library…</PanelNote>
+      {:else if templates.length === 0}
+        <PanelEmpty title="No document templates yet" action="Save this document as one to start" />
+      {:else}
+        <PanelSearch placeholder="Search templates…" matched={shown.length} flush bind:value={query}>
+          {#each shown as item (item.id)}
+            <div class="item">
+              <PanelRow title={item.name}>
+                <span class="item-title">{item.name}</span>
+                <span class="item-sub">{item.holeCount} {item.holeCount === 1 ? "hole" : "holes"} · revision {item.revision}</span>
+                <span class="item-actions">
+                  <PanelButton label="Insert" tone="ghost" disabled={busy} title={`Insert “${item.name}” after the current row`} onclick={() => insert(item)} />
+                  <PanelButton label="Edit" tone="ghost" disabled={busy} title={`Edit “${item.name}” in the editor`} onclick={() => edit(item)} />
+                </span>
+              </PanelRow>
+            </div>
+          {/each}
+        </PanelSearch>
+      {/if}
+    </PanelSection>
+    </div>
+  {/if}
+</Panel>
+
+<OverlayModal
+  bind:open={insertOpen}
+  title={`Insert “${insertFor?.name ?? "the template"}”`}
+  description="Every hole this template asks for. Open one to read what it means."
+  confirm="Insert"
+  width="wide"
+  blocked={askBlocked}
+  onconfirm={confirmInsert}
+>
+  <TemplateAnswerList
+    rows={askRows}
+    onscope={openAnswer}
+    ontext={writeText}
+    onreset={clearAnswer}
+  />
+</OverlayModal>
+
+<OverlayModal
+  bind:open={answerOpen}
+  title={`What ${answering?.label ?? "the hole"} selects here`}
+  description="For this copy only. Nothing here changes the template."
+  confirm="Use this"
+  width="wide"
+  blocked={scopeBlocked}
+  onconfirm={confirmAnswer}
+  oncancel={cancelAnswer}
+>
+  <ScopeBuilder
+    {...view$}
+    resettable
+    onmode={setMode}
+    onadd={addTerm}
+    ondrop={dropTerm}
+    onclear={clearScope}
+    onreset={resetAnswering}
+  />
+</OverlayModal>
+
+<OverlayModal
+  bind:open={defaultOpen}
+  title={`Default scope for ${defaultFor?.label ?? "the hole"}`}
+  description="What it selects until whoever places the template says otherwise."
+  confirm="Set the default scope"
+  width="wide"
+  blocked={scopeBlocked}
+  onconfirm={confirmDefault}
+>
+  <ScopeBuilder {...view$} onmode={setMode} onadd={addTerm} ondrop={dropTerm} onclear={clearScope} />
+</OverlayModal>
+
+<OverlayModal
+  bind:open={makeOpen}
+  title="Create a hole"
+  description="A place in the prose that whoever places this template fills in with words."
+  confirm="Create"
+  blocked={makeBlocked}
+  onconfirm={confirmMake}
+>
+  <div class="making">
+    <PanelInput label="Name" placeholder="subject_line" flush bind:value={holeName} />
+    <PanelInput label="Description" placeholder="What this hole stands for" flush bind:value={holeDescription} />
+    <PanelInput label="Default words" placeholder="What it says when nobody says otherwise" flush bind:value={holeText} />
+  </div>
+</OverlayModal>
+
+<style>
+  .notice {
+    display: flex;
+    flex-direction: column;
+    gap: calc(var(--token-spacing-unit) * 1);
+    margin-bottom: calc(var(--token-spacing-unit) * 2);
+  }
+
+  .save {
+    display: flex;
+    flex-direction: column;
+    align-items: stretch;
+    gap: calc(var(--token-spacing-unit) * 1);
+    margin-bottom: calc(var(--token-spacing-unit) * 2);
+    padding: 0 calc(var(--token-spacing-unit) * 3);
+  }
+
+  .after-verbs {
+    margin-top: calc(var(--token-spacing-unit) * 2);
+    padding-top: calc(var(--token-spacing-unit) * 1);
+    border-top: 1px solid var(--token-border-subtle);
+  }
+
+  .after-holes {
+    margin-top: calc(var(--token-spacing-unit) * 2);
+    padding-top: calc(var(--token-spacing-unit) * 1);
+    border-top: 1px solid var(--token-border-subtle);
+  }
+
+  .make {
+    display: flex;
+    margin-bottom: calc(var(--token-spacing-unit) * 1.5);
+  }
+
+  .making {
+    display: flex;
+    flex-direction: column;
+    gap: calc(var(--token-spacing-unit) * 2);
+  }
+
+  .hole {
+    display: flex;
+    flex-direction: column;
+    gap: calc(var(--token-spacing-unit) * 1.5);
+    padding: calc(var(--token-spacing-unit) * 2);
+    border: 1px solid var(--token-border-subtle);
+    border-radius: var(--token-radius-control);
+    background: var(--token-surface-elevated);
+  }
+
+  .hole + .hole {
+    margin-top: calc(var(--token-spacing-unit) * 1.5);
+  }
+
+  .hole header {
+    display: flex;
+    flex-wrap: wrap;
+    align-items: center;
+    gap: calc(var(--token-spacing-unit) * 1.5);
+  }
+
+  .hole-label {
+    color: var(--token-ink-primary);
+    font-size: var(--token-text-body-sm);
+    font-weight: 600;
+    line-height: var(--token-text-body-sm-leading);
+  }
+
+  .scope {
+    display: flex;
+  }
+
+  .item + .item {
+    border-top: 1px solid var(--token-border-subtle);
+  }
+
+  .item-title {
+    color: var(--token-ink-primary);
+    font-size: var(--token-text-body-sm);
+    line-height: var(--token-text-body-sm-leading);
+    white-space: normal;
+  }
+
+  .item-sub {
+    color: var(--token-ink-muted);
+    font-size: var(--token-text-caption);
+    line-height: var(--token-text-caption-leading);
+  }
+
+  .item-actions {
+    display: flex;
+    gap: calc(var(--token-spacing-unit) * 1);
+    margin-top: calc(var(--token-spacing-unit) * 1);
+  }
+</style>
~~~~

### changed · `src/lib/app-views/categories/document-editor/procedures/projection.ts` (+33 / −8)

~~~~diff
@@ -72,8 +72,9 @@ export const emptyRow = (): DocumentRow => ({
   ]
 });
 
-export const displayOfAtom = (atom: Atom): string =>
-  atom.kind === "literal" ? atom.text : atom.lastResolvedDisplay;
+import { displayOfAtom } from "$representation/data/behavior/content/positions";
+
+export { displayOfAtom };
 
 export type Segment = { readonly atom: Atom; readonly start: number; readonly end: number };
 
@@ -174,6 +175,9 @@ const formulaNode = (atom: Extract<Atom, { kind: "formula" }>, marks: readonly P
     [...marks]
   );
 
+const templateNode = (atom: Extract<Atom, { kind: "template" }>, marks: readonly ProseMirrorMark[]) =>
+  schema.node("template_atom", { atomId: atom.id, name: atom.name }, undefined, [...marks]);
+
 const inlineOf = (block: Styled): ProseMirrorNode[] => {
   const segments = segmentsOf(block.atoms);
   const spans: Span[] = block.marks
@@ -194,6 +198,10 @@ const inlineOf = (block: Styled): ProseMirrorNode[] => {
       nodes.push(formulaNode(segment.atom, covering(segment.start, segment.end)));
       continue;
     }
+    if (segment.atom.kind === "template") {
+      nodes.push(templateNode(segment.atom, covering(segment.start, segment.end)));
+      continue;
+    }
 
     const cuts = new Set<number>([segment.start, segment.end]);
     for (const span of spans) {
@@ -291,10 +299,18 @@ export const docOf = (body: DocumentBody, metrics: Metrics): ProseMirrorNode =>
   );
 };
 
+/** What one inline child stands for in the body's own text, atoms included. */
+const displayOfChild = (child: ProseMirrorNode): string =>
+  child.type.name === "formula_atom"
+    ? String(child.attrs.resolved)
+    : child.type.name === "template_atom"
+      ? `{${String(child.attrs.name)}}`
+      : (child.text ?? "");
+
 export const displayTextOf = (node: ProseMirrorNode): string => {
   let text = "";
   node.forEach((child) => {
-    text += child.type.name === "formula_atom" ? String(child.attrs.resolved) : child.text ?? "";
+    text += displayOfChild(child);
   });
   return text;
 };
@@ -427,6 +443,15 @@ const atomsOf = (node: ProseMirrorNode): Walked => {
   };
 
   node.forEach((child) => {
+    if (child.type.name === "template_atom") {
+      if (run.length > 0) flush();
+      atoms.push({
+        id: child.attrs.atomId as string,
+        kind: "template",
+        name: child.attrs.name as string
+      });
+      return;
+    }
     if (child.type.name !== "formula_atom") {
       run += child.text ?? "";
       return;
@@ -463,7 +488,7 @@ const gather = (node: ProseMirrorNode): Map<string, Gathered> => {
   let at = 0;
 
   node.forEach((child) => {
-    const length = child.type.name === "formula_atom" ? String(child.attrs.resolved).length : (child.text?.length ?? 0);
+    const length = displayOfChild(child).length;
     const from = at;
     const to = at + length;
     at = to;
@@ -633,9 +658,9 @@ export const displayOffsetOf = (block: ProseMirrorNode, offset: number): number
 
   for (let index = 0; index < block.childCount && pm < offset; index += 1) {
     const child = block.child(index);
-    if (child.type.name === "formula_atom") {
+    if (child.type.name === "formula_atom" || child.type.name === "template_atom") {
       pm += 1;
-      display += String(child.attrs.resolved).length;
+      display += displayOfChild(child).length;
       continue;
     }
 
@@ -654,8 +679,8 @@ export const proseOffsetOf = (block: ProseMirrorNode, display: number): number =
 
   for (let index = 0; index < block.childCount && seen < display; index += 1) {
     const child = block.child(index);
-    if (child.type.name === "formula_atom") {
-      const length = String(child.attrs.resolved).length;
+    if (child.type.name === "formula_atom" || child.type.name === "template_atom") {
+      const length = displayOfChild(child).length;
       if (seen + length > display) break;
       seen += length;
       pm += 1;
~~~~

### changed · `src/lib/app-views/categories/document-editor/procedures/schema.ts` (+37 / −3)

~~~~diff
@@ -51,6 +51,9 @@ const textBlockSpec: NodeSpec = {
   ]
 };
 
+const unboundFormula = (name: string, block: unknown): boolean =>
+  name === "formula" && ((block ?? {}) as Record<string, unknown>).formulaId === undefined;
+
 const atomBlockSpec = (name: string): NodeSpec => ({
   group: "block",
   atom: true,
@@ -60,7 +63,7 @@ const atomBlockSpec = (name: string): NodeSpec => ({
   toDOM: (node) => [
     "div",
     {
-      class: `document-block document-${name}`,
+      class: `document-block document-${name}${unboundFormula(name, node.attrs.block) ? " document-formula-unbound" : ""}`,
       "data-block": node.attrs.blockId,
       style: `flex-basis: ${node.attrs.share * 100}%`
     },
@@ -146,6 +149,32 @@ export const schema = new Schema({
 
     text: { group: "inline" },
 
+    /**
+     * A template's own hole, drawn as its name in braces.
+     *
+     * It is an atom like a formula is: one indivisible thing the caret steps
+     * over, because half a parameter name is not a thing anyone means to type.
+     */
+    template_atom: {
+      group: "inline",
+      inline: true,
+      atom: true,
+      selectable: true,
+      attrs: {
+        atomId: { default: null },
+        name: { default: "" }
+      },
+      toDOM: (node) => [
+        "span",
+        {
+          class: "document-template-atom",
+          "data-atom": node.attrs.atomId,
+          title: `${node.attrs.name} · filled in when this template is placed`
+        },
+        `{${node.attrs.name}}`
+      ]
+    },
+
     formula_atom: {
       group: "inline",
       inline: true,
@@ -163,9 +192,14 @@ export const schema = new Schema({
       toDOM: (node) => [
         "span",
         {
-          class: `document-formula document-formula-${node.attrs.state}`,
+          class: `document-formula document-formula-${node.attrs.state}${
+            node.attrs.formulaId === null ? " document-formula-unbound" : ""
+          }`,
           "data-atom": node.attrs.atomId,
-          title: node.attrs.expression
+          title:
+            node.attrs.formulaId === null
+              ? `${node.attrs.expression} · not bound to a formula yet`
+              : node.attrs.expression
         },
         node.attrs.resolved
       ]
~~~~

### new · `src/lib/app-views/categories/document-editor/procedures/templating.ts` (+394 / −0)

~~~~diff
@@ -0,0 +1,394 @@
+import {
+  readProjectResourceIndex,
+  type ProjectResourceIndex
+} from "$capabilities/project-resources/index.remote";
+import {
+  readResourceSets,
+  type ReadResourceSetsResult,
+  type ResourceSetItem
+} from "$capabilities/resource-sets/index.remote";
+import {
+  commitTemplateStage as commitTemplateStageRemote,
+  createTemplateFromResource as createTemplateFromResourceRemote,
+  discardTemplateStage as discardTemplateStageRemote,
+  openTemplateStage as openTemplateStageRemote,
+  readResourceTemplate,
+  readTemplate,
+  readTemplateLibrary,
+  updateTemplate as updateTemplateRemote,
+  type ReadResourceTemplateResult,
+  type ReadTemplateLibraryResult,
+  type ReadTemplateResult,
+  type ResourceTemplateStage,
+  type TemplateAnswers,
+  type TemplateDetail,
+  type TemplateLibraryItem
+} from "$capabilities/templates/index.remote";
+import { asId } from "$representation/data/behavior/core/id";
+import {
+  narrowed,
+  type ScopeDraft,
+  type ScopeNames,
+  type ScopeOffering
+} from "$representation/data/behavior/core/scope-draft";
+import { withFreshIds, type IdHint } from "$representation/data/behavior/templates/fresh-ids";
+import {
+  fillTemplateAtoms,
+  resolveTemplateScopes
+} from "$representation/data/behavior/templates/scopes";
+import type { TemplatedResourceSet } from "$representation/data/types/core/resource-set";
+import type { DocumentBody, DocumentRow } from "$representation/data/types/documents/body";
+import type { DocumentOp } from "$representation/data/types/documents/op";
+import type { TemplateHole } from "$representation/data/types/templates/template";
+import { rowHolding } from "$app-views/categories/document-editor/procedures/blocks";
+import { mint, type IdKind } from "$app-views/categories/document-editor/procedures/ids";
+import { addressOf } from "$app-views/categories/document-editor/procedures/inspecting";
+import type { Selection, WorkspaceStateModel } from "$model/client/workspace-state";
+
+export type { ResourceSetItem } from "$capabilities/resource-sets/index.remote";
+export type {
+  ResourceTemplateStage,
+  TemplateAnswers,
+  TemplateDetail,
+  TemplateLibraryItem
+} from "$capabilities/templates/index.remote";
+export type { TemplatedResourceSet } from "$representation/data/types/core/resource-set";
+export type { TemplateHole } from "$representation/data/types/templates/template";
+
+export {
+  answerRowsOf,
+  missingIn,
+  type AnswerRow
+} from "$representation/data/behavior/templates/answers";
+
+export {
+  PROJECT_KINDS as KINDS,
+  builderView,
+  draftOf,
+  isWholeProject,
+  narrowed,
+  needsRow,
+  ruleWords as ruleOf,
+  termFor,
+  withTerm,
+  withWholeProject,
+  withoutTerm,
+  type OfferSource,
+  type ScopeDraft,
+  type ScopeNames,
+  type ScopeSide
+} from "$representation/data/behavior/core/scope-draft";
+
+export const resourceSets = () => readResourceSets();
+
+export const setsIn = (answer: ReadResourceSetsResult | undefined): readonly ResourceSetItem[] =>
+  answer?.sets ?? [];
+
+export const projectResources = () => readProjectResourceIndex();
+
+export const resourcesIn = (
+  answer: ProjectResourceIndex | undefined
+): readonly { readonly id: string; readonly kind: string; readonly name: string }[] =>
+  (answer?.resources ?? []).map((item) => ({ id: item.id, kind: item.kind, name: item.name }));
+
+/** What the builder and every sentence read a set or a resource by. */
+export const scopeNamesOf = (
+  sets: readonly ResourceSetItem[],
+  resources: readonly { readonly id: string; readonly name: string }[]
+): ScopeNames => ({
+  sets: new Map(sets.map((set) => [set.id, set.name])),
+  resources: new Map(resources.map((resource) => [resource.id, resource.name]))
+});
+
+/** What the builder is handed for a hole's default, or for an answer. */
+export const offeringOf = (
+  sets: readonly ResourceSetItem[],
+  resources: readonly { readonly id: string; readonly kind: string; readonly name: string }[]
+): ScopeOffering => ({
+  sets: sets.map((set) => ({ id: set.id, name: set.name, set: set.set })),
+  resources
+});
+
+/**
+ * The answers a caller chose, as rules.
+ *
+ * A hole nobody touched is absent, which is what makes the template's own
+ * default apply. Everything present is sent as built; the server decides
+ * whether it needs a row.
+ */
+/** The words typed for each text hole, with the untouched ones left out. */
+export const wordsFrom = (
+  texts: Readonly<Record<string, string | undefined>>
+): Readonly<Record<string, string>> =>
+  Object.fromEntries(
+    Object.entries(texts).flatMap(([name, words]) =>
+      words === undefined || words.trim() === "" ? [] : [[name, words] as const]
+    )
+  );
+
+export const answersFrom = (
+  choices: Readonly<Record<string, ScopeDraft | undefined>>
+): TemplateAnswers =>
+  Object.fromEntries(
+    Object.entries(choices).flatMap(([name, draft]) => {
+      if (draft === undefined) return [];
+      const rule = narrowed(draft);
+      return rule === undefined ? [] : [[name, rule] as const];
+    })
+  );
+
+export const resourceTemplate = (resourceId: string) => readResourceTemplate({ resourceId });
+export const templateLibrary = () => readTemplateLibrary();
+export const templateDetail = (templateId: string | undefined) =>
+  templateId === undefined ? undefined : readTemplate({ templateId });
+
+export const stageIn = (
+  answer: ReadResourceTemplateResult | undefined
+): ResourceTemplateStage | undefined => answer?.stage ?? undefined;
+
+export const detailIn = (answer: ReadTemplateResult | undefined): TemplateDetail | undefined =>
+  answer === null || answer === undefined || "unavailable" in answer ? undefined : answer;
+
+export const documentTemplatesIn = (
+  answer: ReadTemplateLibraryResult | undefined
+): readonly TemplateLibraryItem[] =>
+  (answer?.templates ?? []).filter((item) => item.target === "document");
+
+export const currentRowId = (
+  body: DocumentBody,
+  selection: Selection | undefined
+): string | null => {
+  const blockId = selection === undefined ? undefined : addressOf(selection.id)?.blockId;
+  const row = blockId === undefined ? undefined : rowHolding(body, blockId);
+  return row?.id ?? body.rows.at(-1)?.id ?? null;
+};
+
+const HINT_KIND: Record<IdHint, IdKind> = {
+  row: "row",
+  block: "block",
+  cell: "block",
+  atom: "atom",
+  mark: "mark",
+  slide: "block",
+  element: "block",
+  layout: "block",
+  section: "block"
+};
+
+const mintFor = (hint: IdHint): string => mint(HINT_KIND[hint]);
+
+export type Insertion = {
+  readonly ops: readonly DocumentOp[];
+  readonly firstBlockId: string | undefined;
+};
+
+const firstBlockIn = (rows: readonly DocumentRow[]): string | undefined => {
+  for (const row of rows) {
+    if (row.kind === "blocks" && row.blocks.length > 0) return row.blocks[0].id;
+  }
+  return undefined;
+};
+
+export const insertionOf = (
+  body: DocumentBody,
+  template: TemplateDetail,
+  afterRowId: string | null,
+  mode: "resolve" | "keep",
+  answers: TemplateAnswers = {},
+  texts: Readonly<Record<string, string>> = {}
+): Insertion => {
+  if (template.body.resource !== "document") return { ops: [], firstBlockId: undefined };
+
+  let source = template.body;
+  if (mode === "resolve") {
+    const resolved = resolveTemplateScopes(template.body, template.holes, answers);
+    if (!resolved.accepted || resolved.body.resource !== "document") {
+      return { ops: [], firstBlockId: undefined };
+    }
+    const filled = fillTemplateAtoms(resolved.body, texts);
+    if (filled.resource !== "document") return { ops: [], firstBlockId: undefined };
+    source = filled;
+  }
+
+  const rows = withFreshIds(source.rows, mintFor, "row");
+  if (rows.length === 0) return { ops: [], firstBlockId: undefined };
+
+  const ops: DocumentOp[] = [];
+  const held = body.styles?.styles ?? {};
+  for (const [key, style] of Object.entries(source.styles?.styles ?? {})) {
+    if (key in held) continue;
+    ops.push({ op: "insert", target: "document", path: "styles", ids: [key], after: null, values: [style] });
+  }
+  ops.push({
+    op: "insert",
+    target: "row",
+    path: "rows",
+    ids: rows.map((row) => row.id),
+    after: afterRowId,
+    values: rows
+  });
+  return { ops, firstBlockId: firstBlockIn(rows) };
+};
+
+/**
+ * A hole as the client sends it, which is wider than one as it is stored: a
+ * chosen rule may exclude things and may name particular resources, and the
+ * server turns either into a row before it lands.
+ */
+export type ChosenHole = Omit<TemplateHole, "default"> & { default?: ScopeDraft };
+
+export const withHoleField = (
+  holes: readonly ChosenHole[],
+  name: string,
+  change: { label?: string; description?: string; default?: ScopeDraft; text?: string }
+): readonly ChosenHole[] =>
+  holes.map((hole) => {
+    if (hole.name !== name) return hole;
+    const next: ChosenHole = { name: hole.name, label: change.label ?? hole.label };
+    const description = "description" in change ? change.description : hole.description;
+    const fallback = "default" in change ? change.default : hole.default;
+    const words = "text" in change ? change.text : hole.text;
+    if (hole.kind !== undefined) next.kind = hole.kind;
+    if (description !== undefined && description.trim().length > 0) next.description = description.trim();
+    if (fallback !== undefined) next.default = fallback;
+    if (words !== undefined && words.trim().length > 0) next.text = words;
+    return next;
+  });
+
+export const mergedHoles = (
+  held: readonly ChosenHole[],
+  inserted: readonly ChosenHole[]
+): readonly ChosenHole[] => {
+  const names = new Set(held.map((hole) => hole.name));
+  return [...held, ...inserted.filter((hole) => !names.has(hole.name))];
+};
+
+/**
+ * A text hole made by hand, rather than found.
+ *
+ * A scope hole exists because a prompt asks for one, so it cannot be authored. A
+ * text hole is a place in the prose, and nothing but the author knows where it
+ * goes — so the panel declares it and drops its atom at the caret in the same
+ * act, and the next save finds it exactly as it finds any other.
+ */
+export const withNewTextHole = (
+  holes: readonly ChosenHole[],
+  asked: { name: string; description?: string; text?: string }
+): readonly ChosenHole[] => {
+  const name = asked.name.trim();
+  const description = asked.description?.trim() ?? "";
+  const words = asked.text ?? "";
+  return [
+    ...holes,
+    {
+      name,
+      label: name,
+      kind: "text",
+      ...(description === "" ? {} : { description }),
+      ...(words.trim() === "" ? {} : { text: words })
+    }
+  ];
+};
+
+/** Why a name will not do, or nothing when it will. */
+export const holeNameRefusal = (
+  holes: readonly ChosenHole[],
+  asked: string
+): string | undefined => {
+  const name = asked.trim();
+  if (name === "") return "Give the hole a name.";
+  if (!/^[\w][\w -]*$/.test(name)) return "A hole's name is letters, digits, spaces, hyphens and underscores.";
+  const taken = holes.some((hole) => hole.name.toLocaleLowerCase() === name.toLocaleLowerCase());
+  return taken ? `This template already has a hole called ${name}.` : undefined;
+};
+
+const holeBlockIn = (body: DocumentBody, selection: Selection | undefined) => {
+  const blockId = selection === undefined ? undefined : addressOf(selection.id)?.blockId;
+  const takes = (block: { type: string }) => block.type === "text" || block.type === "prompt";
+  const blocks = body.rows.flatMap((row) => (row.kind === "blocks" ? row.blocks : []));
+  return blocks.find((block) => block.id === blockId && takes(block)) ?? blocks.findLast(takes);
+};
+
+/** The ops that put a text hole's atom where the caret is. */
+export const textHoleInsertion = (
+  body: DocumentBody,
+  selection: Selection | undefined,
+  name: string
+): readonly DocumentOp[] => {
+  const block = holeBlockIn(body, selection);
+  if (block === undefined || !("atoms" in block)) return [];
+  const atom = { id: mint("atom"), kind: "template" as const, name: name.trim() };
+  return [
+    {
+      op: "insert",
+      target: "atom",
+      path: `${block.id}/atoms`,
+      ids: [atom.id],
+      after: block.atoms.at(-1)?.id ?? null,
+      values: [atom]
+    }
+  ];
+};
+
+export const saveAsTemplate = (view: WorkspaceStateModel, resourceId: string, name: string) =>
+  view.singleFlight(["template", view.project, "from-resource", resourceId, name.trim()], () =>
+    createTemplateFromResourceRemote({ target: "document", resourceId, name: name.trim() }).updates(
+      readTemplateLibrary
+    )
+  );
+
+export const openStage = (view: WorkspaceStateModel, templateId: string) =>
+  view.singleFlight(["template", view.project, templateId, "stage"], () =>
+    openTemplateStageRemote({ templateId }).updates(
+      readTemplateLibrary,
+      readTemplate({ templateId }),
+      view.readStore("documents")
+    )
+  );
+
+export const commitStage = (
+  view: WorkspaceStateModel,
+  stage: { readonly stageId: string; readonly templateId: string; readonly baseRevision: number },
+  resourceId: string
+) =>
+  view.singleFlight(["template", view.project, stage.stageId, "commit", stage.baseRevision], () =>
+    commitTemplateStageRemote({ stageId: stage.stageId, baseRevision: stage.baseRevision }).updates(
+      readTemplateLibrary,
+      readTemplate({ templateId: stage.templateId }),
+      readResourceTemplate({ resourceId })
+    )
+  );
+
+export const discardStage = (
+  view: WorkspaceStateModel,
+  stage: { readonly stageId: string; readonly templateId: string },
+  resourceId: string
+) =>
+  view.singleFlight(["template", view.project, stage.stageId, "discard"], () =>
+    discardTemplateStageRemote({ stageId: stage.stageId }).updates(
+      readTemplateLibrary,
+      readTemplate({ templateId: stage.templateId }),
+      readResourceTemplate({ resourceId }),
+      view.readStore("documents")
+    )
+  );
+
+export const updateHoles = (
+  view: WorkspaceStateModel,
+  template: { readonly id: string; readonly revision: number },
+  holes: readonly ChosenHole[],
+  resourceId?: string
+) =>
+  view.singleFlight(
+    ["template", view.project, template.id, "holes", template.revision, JSON.stringify(holes)],
+    () =>
+      updateTemplateRemote({
+        templateId: template.id,
+        baseRevision: template.revision,
+        patch: { holes }
+      }).updates(
+        readTemplateLibrary,
+        readTemplate({ templateId: template.id }),
+        ...(resourceId === undefined ? [] : [readResourceTemplate({ resourceId })])
+      )
+  );
~~~~

### new · `src/lib/app-views/categories/document-editor/procedures/test/unit/templating.test.ts` (+167 / −0)

~~~~diff
@@ -0,0 +1,167 @@
+import assert from "node:assert/strict";
+import { test } from "vitest";
+import type { DocumentBody } from "$representation/data/types/documents/body";
+import { applyOps, invertAll } from "$representation/data/behavior/documents/apply-ops";
+import type { TemplateDetail } from "$capabilities/templates/index.remote";
+import {
+  answersFrom,
+  currentRowId,
+  draftOf,
+  insertionOf,
+  isWholeProject,
+  mergedHoles,
+  ruleOf,
+  withHoleField
+} from "$app-views/categories/document-editor/procedures/templating";
+
+const text = (id: string, display: string, style?: string) => ({
+  id,
+  type: "text" as const,
+  variant: "paragraph" as const,
+  ...(style === undefined ? {} : { style }),
+  atoms: [{ id: `${id}-a`, kind: "literal" as const, text: display }],
+  display,
+  marks: []
+});
+
+const held: DocumentBody = {
+  rows: [
+    { id: "r1", kind: "blocks", blocks: [text("b1", "One")] },
+    { id: "r2", kind: "blocks", blocks: [text("b2", "Two")] }
+  ]
+};
+
+const template: TemplateDetail = {
+  id: "templates:1",
+  name: "Brief",
+  target: "document",
+  availability: "personal",
+  tags: [],
+  createdByName: "Uma",
+  revision: 1,
+  updatedAt: 1,
+  lastUsedAt: null,
+  canEdit: true,
+  canDelete: true,
+  body: {
+    resource: "document",
+    styles: { defaultKey: "body", styles: { body: { name: "Body" }, title: { name: "Title", fontSize: 28 } } },
+    rows: [
+      { id: "t1", kind: "blocks", blocks: [text("tb1", "Heading", "title")] },
+      {
+        id: "t2",
+        kind: "blocks",
+        blocks: [
+          {
+            id: "tp1",
+            type: "prompt",
+            atoms: [{ id: "tp1-a", kind: "literal", text: "Sum up" }],
+            display: "Sum up",
+            marks: [],
+            scope: { include: [{ select: "hole", name: "evidence" }], exclude: [] },
+            state: "idle"
+          }
+        ]
+      }
+    ]
+  },
+  holes: [{ name: "evidence", label: "Evidence", default: { include: [{ select: "kinds", kinds: ["finding"] }], exclude: [] } }]
+};
+
+test("an insertion lands after the row holding the caret, or at the end", () => {
+  assert.equal(currentRowId(held, { kind: "next-letter", id: "b1/atoms/b1-a@0" }), "r1");
+  assert.equal(currentRowId(held, undefined), "r2");
+  assert.equal(currentRowId({ rows: [] }, undefined), null);
+});
+
+test("inserting into a document resolves prompts, mints ids, and brings missing styles", () => {
+  const body: DocumentBody = { ...held, styles: { defaultKey: "body", styles: { body: { name: "Body" } } } };
+  const insertion = insertionOf(body, template, "r1", "resolve");
+  const after = applyOps(body, insertion.ops);
+  assert.deepEqual(after.rows.map((row) => row.id)[0], "r1");
+  assert.equal(after.rows.length, 4);
+  assert.notEqual(after.rows[1].id, "t1");
+  assert.ok(after.rows[1].id.startsWith("#r"));
+  const inserted = after.rows[2];
+  if (inserted.kind !== "blocks" || inserted.blocks[0].type !== "prompt") throw new Error("prompt expected");
+  assert.deepEqual(inserted.blocks[0].scope, { include: [{ select: "kinds", kinds: ["finding"] }], exclude: [] });
+  assert.equal(insertion.firstBlockId, (after.rows[1] as { blocks: { id: string }[] }).blocks[0].id);
+  assert.deepEqual(Object.keys(after.styles?.styles ?? {}), ["body", "title"]);
+  assert.deepEqual(applyOps(after, invertAll(insertion.ops)), body);
+});
+
+test("inserting into a stage keeps hole terms", () => {
+  const kept = insertionOf(held, template, null, "keep");
+  const after = applyOps(held, kept.ops);
+  const first = after.rows[1];
+  if (first.kind !== "blocks" || first.blocks[0].type !== "prompt") throw new Error("prompt expected");
+  assert.deepEqual(first.blocks[0].scope, { include: [{ select: "hole", name: "evidence" }], exclude: [] });
+});
+
+test("a hole without a default resolves to the whole project on insert", () => {
+  const insertion = insertionOf(held, { ...template, holes: [{ name: "evidence", label: "Evidence" }] }, "r2", "resolve");
+  const after = applyOps(held, insertion.ops);
+  const row = after.rows[3];
+  if (row.kind !== "blocks" || row.blocks[0].type !== "prompt") throw new Error("prompt expected");
+  assert.deepEqual(row.blocks[0].scope, { include: [{ select: "project" }], exclude: [] });
+});
+
+test("holes are edited by name and merged without repeats", () => {
+  const declared = [{ name: "incident_evidence", label: "Incident evidence" }];
+
+  const described = withHoleField(declared, "incident_evidence", { description: "  What happened  " });
+  assert.equal(described[0].description, "What happened");
+  const cleared = withHoleField(described, "incident_evidence", { description: "" });
+  assert.equal("description" in cleared[0], false);
+  const ruled = withHoleField(declared, "incident_evidence", { default: { include: [{ select: "project" }], exclude: [] } });
+  assert.deepEqual(ruled[0].default, { include: [{ select: "project" }], exclude: [] });
+
+  const merged = mergedHoles(declared, [{ name: "incident_evidence", label: "Other" }, { name: "models", label: "Models" }]);
+  assert.deepEqual(merged.map((hole) => hole.name), ["incident_evidence", "models"]);
+  assert.deepEqual(merged[0], declared[0]);
+});
+
+test("a default is read as prose, in the words every surface uses", () => {
+  assert.equal(ruleOf(undefined), "Everything in the project");
+  assert.equal(isWholeProject(draftOf(undefined)), true);
+  assert.equal(ruleOf({ include: [{ select: "kinds", kinds: ["finding", "document"] }], exclude: [] }), "Findings, Documents");
+  assert.equal(
+    ruleOf({ include: [{ select: "project" }], exclude: [{ select: "kinds", kinds: ["slides"] }] }),
+    "Everything in the project, minus Slide decks"
+  );
+  assert.equal(ruleOf({ include: [], exclude: [] }), "Nothing");
+
+  const names = { sets: new Map([["resourceSets:1", "Winter filings"]]) };
+  const named = { include: [{ select: "set" as const, setId: "resourceSets:1" as never }], exclude: [] };
+  assert.equal(ruleOf(named, names), "Winter filings");
+  assert.equal(ruleOf(named), "A chosen group");
+});
+
+test("an answer is a rule the caller built, and a hole nobody touched is absent", () => {
+  assert.deepEqual(answersFrom({ evidence: undefined }), {});
+
+  const answers = answersFrom({
+    evidence: { include: [{ select: "set", setId: "resourceSets:1" as never }], exclude: [] }
+  });
+  assert.deepEqual(answers, {
+    evidence: { include: [{ select: "set", setId: "resourceSets:1" }], exclude: [] }
+  });
+
+  const insertion = insertionOf(held, template, "r2", "resolve", answers);
+  const after = applyOps(held, insertion.ops);
+  const row = after.rows[3];
+  if (row.kind !== "blocks" || row.blocks[0].type !== "prompt") throw new Error("prompt expected");
+  assert.deepEqual(row.blocks[0].scope, { include: [{ select: "set", setId: "resourceSets:1" }], exclude: [] });
+});
+
+test("a rule that excludes anything is sent as built, for the server to store", () => {
+  const answers = answersFrom({
+    evidence: {
+      include: [{ select: "project" }],
+      exclude: [{ select: "resources", refs: [{ kind: "document", id: "documents:2" }] }]
+    }
+  });
+  assert.deepEqual(answers.evidence.exclude, [
+    { select: "resources", refs: [{ kind: "document", id: "documents:2" }] }
+  ]);
+});
~~~~

## The slide-deck editor's Templates panel

### changed · `src/lib/app-views/categories/slide-deck-editor/context/comments.svelte` (+6 / −1)

~~~~diff
@@ -1,5 +1,6 @@
 <script lang="ts">
   import { startThread } from "$capabilities/comments/index.remote";
+  import { readResourceTemplate } from "$capabilities/templates/index.remote";
   import { Panel, PanelButton, PanelChoice, PanelEmpty, PanelNote, PanelQuote, PanelSection } from "$authored-components/panel";
   import { Textarea } from "$vendored-components/textarea";
   import {
@@ -30,6 +31,8 @@
   const threadRows = tableQuery("commentThreads");
   const commentRows = tableQuery("comments");
   const userRows = tableQuery("users");
+  const templateQuery = $derived(deckId === undefined ? undefined : readResourceTemplate({ resourceId: deckId }));
+  const workingCopy = $derived(templateQuery?.ready === true && templateQuery.current.stage !== null);
 
   const threads = $derived(
     rowsOf(threadRows, "commentThreads").filter(
@@ -113,7 +116,9 @@
     <PanelChoice label="Show" value={chip} options={chips} flush fill onchange={(value) => (wanted = value)} />
   {/snippet}
 
-  {#if body}
+  {#if body && workingCopy}
+    <PanelNote tone="gap">A template's working copy takes no comments; they never travel with a template.</PanelNote>
+  {:else if body}
     <div class="flex flex-col gap-2 px-3 pb-2">
       <Textarea
         placeholder="Write a comment on {subject}…"
~~~~

### changed · `src/lib/app-views/categories/slide-deck-editor/context/templates.svelte` (+700 / −3)

~~~~diff
@@ -1,8 +1,705 @@
 <script lang="ts">
-  import { Panel, PanelEmpty, PanelNote } from "$authored-components/panel";
+  import { onDestroy } from "svelte";
+
+  import { OverlayModal } from "$authored-components/overlay";
+  import {
+    Panel,
+    PanelBanner,
+    PanelButton,
+    PanelChip,
+    PanelEditableText,
+    PanelEmpty,
+    PanelInput,
+    PanelNote,
+    PanelRow,
+    PanelSearch,
+    PanelSection
+  } from "$authored-components/panel";
+  import { ScopeBuilder } from "$authored-components/scope-builder";
+  import { TemplateAnswers as TemplateAnswerList } from "$authored-components/template-answers";
+  import { slideIndexOf } from "$app-views/categories/slide-deck-editor/procedures/deck";
+  import { slideSignal } from "$app-views/categories/slide-deck-editor/procedures/selecting";
+  import {
+    answerRowsOf,
+    answersFrom,
+    builderView,
+    missingIn,
+    wordsFrom,
+    commitStage,
+    deckTemplatesIn,
+    detailIn,
+    discardStage,
+    draftOf,
+    holeNameRefusal,
+    insertionOf,
+    mergedHoles,
+    offeringOf,
+    openStage,
+    projectResources,
+    resourceSets,
+    resourceTemplate,
+    resourcesIn,
+    ruleOf,
+    saveAsTemplate,
+    scopeNamesOf,
+    setsIn,
+    stageIn,
+    templateDetail,
+    templateLibrary,
+    termFor,
+    textHoleInsertion,
+    updateHoles,
+    withHoleField,
+    withNewTextHole,
+    withTerm,
+    withWholeProject,
+    withoutTerm,
+    type ChosenHole,
+    type OfferSource,
+    type ScopeDraft,
+    type ScopeSide,
+    type TemplateAnswers,
+    type TemplateDetail,
+    type TemplateHole,
+    type TemplateLibraryItem
+  } from "$app-views/categories/slide-deck-editor/procedures/templating";
+  import { readStore, workspaceState, type SlideDeckRuntime } from "$model/client/workspace-state";
+
+  const view = workspaceState();
+  let live = true;
+  onDestroy(() => {
+    live = false;
+  });
+
+  const deckId = $derived(view.active.resourceId);
+  let runtime = $state<SlideDeckRuntime | undefined>(undefined);
+  $effect(() => {
+    runtime = deckId === undefined ? undefined : view.slideDeckRuntime(deckId);
+  });
+
+  const body = $derived(runtime?.body);
+  const decksQuery = readStore("slideDecks");
+  const title = $derived.by(() => {
+    if (!decksQuery.ready) return undefined;
+    const found = decksQuery.current;
+    if (found?.kind !== "table" || found.table !== "slideDecks") return undefined;
+    return found.rows.find((deck) => deck._id === deckId)?.title;
+  });
+  const current = $derived(body === undefined ? undefined : body.slides[slideIndexOf(body, view.active.focus ?? undefined)]);
+  const position = $derived(body === undefined || current === undefined ? 0 : slideIndexOf(body, current.id) + 1);
+
+  const library = templateLibrary();
+  const sets = resourceSets();
+  const index = projectResources();
+  const setItems = $derived(setsIn(sets.ready ? sets.current : undefined));
+  const catalogue = $derived(resourcesIn(index.ready ? index.current : undefined));
+  const setNames = $derived(scopeNamesOf(setItems, catalogue));
+  const offering = $derived(offeringOf(setItems, catalogue));
+  const resourceQuery = $derived(deckId === undefined ? undefined : resourceTemplate(deckId));
+  const resource = $derived(resourceQuery?.ready ? resourceQuery.current : undefined);
+  const stage = $derived(stageIn(resource));
+  const detailQuery = $derived(templateDetail(stage?.templateId));
+  const template = $derived(detailIn(detailQuery?.ready ? detailQuery.current : undefined));
+  const templates = $derived(deckTemplatesIn(library.ready ? library.current : undefined));
+  const currentRevision = $derived(template?.revision ?? stage?.currentRevision ?? null);
+
+  let query = $state("");
+  let nameDraft = $state("");
+  let pending = $state<string | undefined>(undefined);
+  let actionError = $state<string | undefined>(undefined);
+  let notice = $state<readonly string[]>([]);
+  let defaultFor = $state<TemplateHole | undefined>(undefined);
+  let defaultOpen = $state(false);
+  let draft = $state<ScopeDraft>(draftOf(undefined));
+  let insertFor = $state<TemplateDetail | undefined>(undefined);
+  let insertOpen = $state(false);
+  let answerOpen = $state(false);
+  let choices = $state<Record<string, ScopeDraft | undefined>>({});
+  let texts = $state<Record<string, string | undefined>>({});
+  let answering = $state<TemplateHole | undefined>(undefined);
+  let makeOpen = $state(false);
+  let holeName = $state("");
+  let holeDescription = $state("");
+  let holeText = $state("");
+
+  const askRows = $derived(answerRowsOf(insertFor?.holes ?? [], choices, texts, setNames));
+  const askBlocked = $derived(
+    missingIn(askRows).length === 0 ? undefined : `${missingIn(askRows).join(", ")} still needs words.`
+  );
+
+  const shown = $derived(
+    templates.filter((item) => item.name.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()))
+  );
+
+  const fail = (error: unknown) => {
+    if (live) actionError = error instanceof Error ? error.message : String(error);
+  };
+
+  const run = async (key: string, work: () => Promise<void>) => {
+    if (pending !== undefined) return;
+    pending = key;
+    actionError = undefined;
+    try {
+      await work();
+    } catch (error) {
+      fail(error);
+    } finally {
+      if (live) pending = undefined;
+    }
+  };
+
+  const settled = async (): Promise<boolean> => {
+    if (runtime === undefined) return false;
+    await runtime.flush();
+    if (runtime.pending > 0) {
+      actionError = "The deck has changes that are not saved yet. Save them first.";
+      return false;
+    }
+    return true;
+  };
+
+  const show = (slideId: string) => {
+    if (deckId === undefined) return;
+    view.open({ category: "slide-deck-editor", resourceId: deckId, focus: slideId });
+    view.inspect("slide-deck-editor.slide", slideSignal(slideId).selection);
+  };
+
+  const save = () =>
+    run("save", async () => {
+      if (deckId === undefined || stage === undefined || currentRevision === null) return;
+      if (!(await settled())) return;
+      const result = await commitStage(
+        view,
+        { stageId: stage.stageId, templateId: stage.templateId, baseRevision: currentRevision },
+        deckId
+      );
+      if (!live) return;
+      if (!result.accepted) {
+        actionError = result.detail;
+        return;
+      }
+      notice = result.dropped.length === 0 ? ["Saved to the template."] : ["Saved to the template.", ...result.dropped];
+    });
+
+  const discard = () =>
+    run("discard", async () => {
+      if (deckId === undefined || stage === undefined) return;
+      if (!confirm(`Discard the working copy of “${stage.templateName}”? Unsaved edits are lost.`)) return;
+      if (!(await settled())) return;
+      const tab = view.activeId;
+      const result = await discardStage(view, { stageId: stage.stageId, templateId: stage.templateId }, deckId);
+      if (!live) return;
+      if (!result.accepted) {
+        actionError = result.detail;
+        return;
+      }
+      view.close(tab);
+    });
+
+  const saveAs = (slideId?: string) =>
+    run("save-as", async () => {
+      const name = nameDraft.trim();
+      if (deckId === undefined || name === "") return;
+      const made = await saveAsTemplate(view, deckId, name, slideId);
+      if (!live) return;
+      if (!made.accepted) {
+        actionError = made.detail;
+        return;
+      }
+      nameDraft = "";
+      notice = [`Saved as the template “${name}”.`, ...made.dropped];
+      const opened = await openStage(view, made.templateId);
+      if (!live) return;
+      if (!opened.accepted) {
+        actionError = opened.detail;
+        return;
+      }
+      view.open({
+        category: "slide-deck-editor",
+        resourceId: opened.resourceId,
+        context: "slide-deck-editor.templates"
+      });
+    });
+
+  const edit = (item: TemplateLibraryItem) =>
+    run(`edit:${item.id}`, async () => {
+      const result = await openStage(view, item.id);
+      if (!live) return;
+      if (!result.accepted) {
+        actionError = result.detail;
+        return;
+      }
+      view.open({
+        category: "slide-deck-editor",
+        resourceId: result.resourceId,
+        context: "slide-deck-editor.templates"
+      });
+    });
+
+  const place = async (
+    detail: TemplateDetail,
+    answers: TemplateAnswers,
+    words: Readonly<Record<string, string>> = {}
+  ) => {
+    if (body === undefined || runtime === undefined) return;
+    const insertion = insertionOf(
+      body,
+      detail,
+      current?.id ?? null,
+      stage === undefined ? "resolve" : "keep",
+      answers,
+      words
+    );
+    if (insertion.ops.length === 0) {
+      notice = ["That template has no slides to insert."];
+      return;
+    }
+    runtime.apply(insertion.ops);
+    if (insertion.firstSlideId !== undefined) show(insertion.firstSlideId);
+    if (stage !== undefined && template !== undefined) {
+      const merged = mergedHoles(template.holes, detail.holes);
+      if (merged.length !== template.holes.length) {
+        const result = await updateHoles(view, template, merged, deckId);
+        if (live && !result.accepted) actionError = result.detail;
+      }
+    }
+    notice = [`Inserted “${detail.name}”.`];
+  };
+
+  const insert = (item: TemplateLibraryItem) =>
+    run(`insert:${item.id}`, async () => {
+      if (body === undefined || runtime === undefined) return;
+      const detail = detailIn(await templateDetail(item.id));
+      if (detail === undefined) {
+        actionError = "That template could not be read.";
+        return;
+      }
+      if (stage === undefined && detail.holes.length > 0) {
+        insertFor = detail;
+        choices = {};
+        texts = {};
+        answering = undefined;
+        insertOpen = true;
+        return;
+      }
+      await place(detail, {});
+    });
+
+  const confirmInsert = () => {
+    const detail = insertFor;
+    if (detail === undefined) return;
+    void run(`place:${detail.id}`, () => place(detail, answersFrom(choices), wordsFrom(texts)));
+  };
+
+  const changeHoles = (next: readonly ChosenHole[]) =>
+    run("holes", async () => {
+      if (template === undefined) return;
+      const result = await updateHoles(view, template, next, deckId);
+      if (live && !result.accepted) actionError = result.detail;
+    });
+
+  const openDefault = (hole: TemplateHole) => {
+    defaultFor = hole;
+    draft = draftOf(hole.default);
+    defaultOpen = true;
+  };
+
+  const confirmDefault = () => {
+    if (template === undefined || defaultFor === undefined) return;
+    void changeHoles(withHoleField(template.holes, defaultFor.name, { default: draft }));
+  };
+
+  const openMake = () => {
+    holeName = "";
+    holeDescription = "";
+    holeText = "";
+    makeOpen = true;
+  };
+
+  /**
+   * Declaring the hole and dropping its atom are one act, because a hole nothing
+   * in the deck's text asks for is a hole that fills nothing.
+   */
+  const confirmMake = () =>
+    void run("make-hole", async () => {
+      if (template === undefined || body === undefined || runtime === undefined) return;
+      const name = holeName.trim();
+      const ops = textHoleInsertion(body, view.selection, name);
+      if (ops.length === 0) {
+        actionError = "Select some text first — that is where the hole goes.";
+        return;
+      }
+      const result = await updateHoles(
+        view,
+        template,
+        withNewTextHole(template.holes, { name, description: holeDescription, text: holeText }),
+        deckId
+      );
+      if (!live) return;
+      if (!result.accepted) {
+        actionError = result.detail;
+        return;
+      }
+      runtime.apply(ops);
+      makeOpen = false;
+      notice = [`Added the hole “${name}”.`];
+    });
+
+  /**
+   * The builder is its own modal rather than a second face of the ask modal.
+   * Swapping one modal's title, body and confirm while it is open replaces the
+   * footer under the pointer, and the press lands on a button that has gone.
+   */
+  const openAnswer = (name: string) => {
+    const hole = insertFor?.holes.find((candidate) => candidate.name === name);
+    if (hole === undefined) return;
+    answering = hole;
+    draft = draftOf(choices[name] ?? hole.default);
+    insertOpen = false;
+    answerOpen = true;
+  };
+
+  const confirmAnswer = () => {
+    if (answering !== undefined) choices = { ...choices, [answering.name]: draft };
+    answering = undefined;
+    answerOpen = false;
+    insertOpen = true;
+  };
+
+  const cancelAnswer = () => {
+    answering = undefined;
+    insertOpen = true;
+  };
+
+  /** Inside the ask, Default means the template's own suggestion, not the floor. */
+  const resetAnswering = () => {
+    if (answering !== undefined) clearAnswer(answering.name);
+    answering = undefined;
+    answerOpen = false;
+    insertOpen = true;
+  };
+
+  const writeText = (name: string, words: string) => {
+    texts = { ...texts, [name]: words };
+  };
+
+  const clearAnswer = (name: string) => {
+    const { [name]: _chosen, ...restChoices } = choices;
+    const { [name]: _typed, ...restTexts } = texts;
+    choices = restChoices;
+    texts = restTexts;
+  };
+
+  /** Every builder edits this one draft, because only one is ever open. */
+  const view$ = $derived(builderView(draft, offering));
+
+  const addTerm = (side: ScopeSide, source: string, key: string) => {
+    const term = termFor(source as OfferSource, key);
+    if (term !== undefined) draft = withTerm(draft, side, term);
+  };
+
+  const dropTerm = (side: ScopeSide, key: string) => {
+    draft = withoutTerm(draft, side, key);
+  };
+
+  const setMode = (whole: boolean) => {
+    draft = whole ? withWholeProject() : { include: [], exclude: [] };
+  };
+
+  const clearScope = () => {
+    draft = { include: [], exclude: [] };
+  };
+
+  const makeBlocked = $derived(holeNameRefusal(template?.holes ?? [], holeName));
+  const busy = $derived(pending !== undefined || body === undefined);
+  const unnamed = $derived(nameDraft.trim() === "");
+  const scopeBlocked = $derived(
+    draft.include.length === 0
+      ? "Include something, or choose everything in the project."
+      : undefined
+  );
 </script>
 
 <Panel title="Templates">
-  <PanelEmpty title="Slide templates are not built yet. This panel will offer the deck's own layouts as starting points, and the project's slide-deck templates behind them." />
-  <PanelNote>Not built yet · <span class="font-mono">slide-deck-editor.templates</span></PanelNote>
+  {#snippet actions()}
+    {#if deckId !== undefined && stage !== undefined}
+      <PanelButton label="Save" tone="primary" disabled={busy} title="Write these slides back to the template" onclick={save} />
+      <PanelButton label="Discard" tone="danger" disabled={busy} title="Remove this copy and close it" onclick={discard} />
+    {/if}
+  {/snippet}
+
+  {#if deckId === undefined}
+    <PanelEmpty title="Open a deck to work with templates" />
+  {:else}
+    {#if actionError}
+      <PanelBanner title="That did not happen" tone="attention">{actionError}</PanelBanner>
+    {/if}
+    {#if notice.length > 0}
+      <div class="notice">
+        {#each notice as line (line)}
+          <PanelNote>{line}</PanelNote>
+        {/each}
+      </div>
+    {/if}
+
+    {#if resourceQuery === undefined || !resourceQuery.ready}
+      <PanelNote>Reading this deck…</PanelNote>
+    {:else if stage !== undefined}
+      <div class="after-verbs">
+        <PanelSection title="Holes" count={template?.holes.length} chevron="end">
+          <div class="make">
+            <PanelButton
+              label="Create hole"
+              disabled={busy || template === undefined}
+              title="Name a text hole and drop it into the selected text"
+              onclick={openMake}
+            />
+          </div>
+          {#if template === undefined}
+            <PanelNote>Reading the template…</PanelNote>
+          {:else}
+            {#each template.holes as hole (hole.name)}
+              <article class="hole">
+                <header>
+                  <PanelChip tone="accent-1">{hole.name}</PanelChip>
+                  <span class="hole-label">{hole.label}</span>
+                </header>
+                <PanelEditableText
+                  value={hole.description ?? ""}
+                  label={`Description for ${hole.label}`}
+                  placeholder="What this hole stands for"
+                  multiline
+                  disabled={busy}
+                  onchange={(next) => changeHoles(withHoleField(template.holes, hole.name, { description: next }))}
+                />
+                {#if hole.kind === "text"}
+                  <PanelEditableText
+                    value={hole.text ?? ""}
+                    label={`Default words for ${hole.label}`}
+                    placeholder="What it says when nobody says otherwise"
+                    multiline
+                    disabled={busy}
+                    onchange={(next) => changeHoles(withHoleField(template.holes, hole.name, { text: next }))}
+                  />
+                {:else}
+                  <div class="scope">
+                    <PanelButton
+                      label="Default scope"
+                      disabled={busy}
+                      title={`${ruleOf(hole.default, setNames)} — change what ${hole.label} selects by default`}
+                      onclick={() => openDefault(hole)}
+                    />
+                  </div>
+                {/if}
+              </article>
+            {/each}
+          {/if}
+        </PanelSection>
+      </div>
+    {:else}
+      <div class="save">
+        <PanelInput label="Template name" placeholder={title ?? "Template name"} flush bind:value={nameDraft} onenter={() => saveAs()} />
+        <div class="save-actions">
+          <PanelButton label="Save deck" tone="primary" disabled={busy || unnamed} title={unnamed ? "Give the template a name first" : "Copy the whole deck into a new template and open it"} onclick={() => saveAs()} />
+          <PanelButton label="Save slide" disabled={busy || unnamed || current === undefined} title={unnamed ? "Give the template a name first" : `Copy slide ${position} into a new template and open it`} onclick={() => saveAs(current?.id)} />
+        </div>
+      </div>
+    {/if}
+
+    <div class="after-holes">
+    <PanelSection title="List" chevron="end" flush>
+      {#if library.error}
+        <PanelBanner title="Templates unavailable" tone="danger">
+          {library.error instanceof Error ? library.error.message : String(library.error)}
+        </PanelBanner>
+      {:else if !library.ready}
+        <PanelNote>Reading the library…</PanelNote>
+      {:else if templates.length === 0}
+        <PanelEmpty title="No slide deck templates yet" action="Save this deck or a slide as one to start" />
+      {:else}
+        <PanelSearch placeholder="Search templates…" matched={shown.length} flush bind:value={query}>
+          {#each shown as item (item.id)}
+            <div class="item">
+              <PanelRow title={item.name}>
+                <span class="item-title">{item.name}</span>
+                <span class="item-sub">{item.holeCount} {item.holeCount === 1 ? "hole" : "holes"} · revision {item.revision}</span>
+                <span class="item-actions">
+                  <PanelButton label="Insert" tone="ghost" disabled={busy} title={`Insert “${item.name}” after slide ${position}`} onclick={() => insert(item)} />
+                  <PanelButton label="Edit" tone="ghost" disabled={busy} title={`Edit “${item.name}” in the editor`} onclick={() => edit(item)} />
+                </span>
+              </PanelRow>
+            </div>
+          {/each}
+        </PanelSearch>
+      {/if}
+    </PanelSection>
+    </div>
+  {/if}
 </Panel>
+
+<OverlayModal
+  bind:open={insertOpen}
+  title={`Insert “${insertFor?.name ?? "the template"}”`}
+  description="Every hole this template asks for. Open one to read what it means."
+  confirm="Insert"
+  width="wide"
+  blocked={askBlocked}
+  onconfirm={confirmInsert}
+>
+  <TemplateAnswerList
+    rows={askRows}
+    onscope={openAnswer}
+    ontext={writeText}
+    onreset={clearAnswer}
+  />
+</OverlayModal>
+
+<OverlayModal
+  bind:open={answerOpen}
+  title={`What ${answering?.label ?? "the hole"} selects here`}
+  description="For this copy only. Nothing here changes the template."
+  confirm="Use this"
+  width="wide"
+  blocked={scopeBlocked}
+  onconfirm={confirmAnswer}
+  oncancel={cancelAnswer}
+>
+  <ScopeBuilder
+    {...view$}
+    resettable
+    onmode={setMode}
+    onadd={addTerm}
+    ondrop={dropTerm}
+    onclear={clearScope}
+    onreset={resetAnswering}
+  />
+</OverlayModal>
+
+<OverlayModal
+  bind:open={defaultOpen}
+  title={`Default scope for ${defaultFor?.label ?? "the hole"}`}
+  description="What it selects until whoever places the template says otherwise."
+  confirm="Set the default scope"
+  width="wide"
+  blocked={scopeBlocked}
+  onconfirm={confirmDefault}
+>
+  <ScopeBuilder {...view$} onmode={setMode} onadd={addTerm} ondrop={dropTerm} onclear={clearScope} />
+</OverlayModal>
+
+<OverlayModal
+  bind:open={makeOpen}
+  title="Create a hole"
+  description="A place in the deck's text that whoever places this template fills in with words."
+  confirm="Create"
+  blocked={makeBlocked}
+  onconfirm={confirmMake}
+>
+  <div class="making">
+    <PanelInput label="Name" placeholder="subject_line" flush bind:value={holeName} />
+    <PanelInput label="Description" placeholder="What this hole stands for" flush bind:value={holeDescription} />
+    <PanelInput label="Default words" placeholder="What it says when nobody says otherwise" flush bind:value={holeText} />
+  </div>
+</OverlayModal>
+
+<style>
+
+  .notice {
+    display: flex;
+    flex-direction: column;
+    gap: calc(var(--token-spacing-unit) * 1);
+    margin-bottom: calc(var(--token-spacing-unit) * 2);
+  }
+
+  .save {
+    display: flex;
+    flex-direction: column;
+    align-items: stretch;
+    gap: calc(var(--token-spacing-unit) * 1);
+    margin-bottom: calc(var(--token-spacing-unit) * 2);
+    padding: 0 calc(var(--token-spacing-unit) * 3);
+  }
+
+  .save-actions {
+    display: flex;
+    gap: calc(var(--token-spacing-unit) * 1);
+  }
+
+  .after-verbs {
+    margin-top: calc(var(--token-spacing-unit) * 2);
+    padding-top: calc(var(--token-spacing-unit) * 1);
+    border-top: 1px solid var(--token-border-subtle);
+  }
+
+  .after-holes {
+    margin-top: calc(var(--token-spacing-unit) * 2);
+    padding-top: calc(var(--token-spacing-unit) * 1);
+    border-top: 1px solid var(--token-border-subtle);
+  }
+
+  .make {
+    display: flex;
+    margin-bottom: calc(var(--token-spacing-unit) * 1.5);
+  }
+
+  .making {
+    display: flex;
+    flex-direction: column;
+    gap: calc(var(--token-spacing-unit) * 2);
+  }
+
+  .hole {
+    display: flex;
+    flex-direction: column;
+    gap: calc(var(--token-spacing-unit) * 1.5);
+    padding: calc(var(--token-spacing-unit) * 2);
+    border: 1px solid var(--token-border-subtle);
+    border-radius: var(--token-radius-control);
+    background: var(--token-surface-elevated);
+  }
+
+  .hole + .hole {
+    margin-top: calc(var(--token-spacing-unit) * 1.5);
+  }
+
+  .hole header {
+    display: flex;
+    flex-wrap: wrap;
+    align-items: center;
+    gap: calc(var(--token-spacing-unit) * 1.5);
+  }
+
+  .hole-label {
+    color: var(--token-ink-primary);
+    font-size: var(--token-text-body-sm);
+    font-weight: 600;
+    line-height: var(--token-text-body-sm-leading);
+  }
+
+  .scope {
+    display: flex;
+  }
+
+  .item + .item {
+    border-top: 1px solid var(--token-border-subtle);
+  }
+
+  .item-title {
+    color: var(--token-ink-primary);
+    font-size: var(--token-text-body-sm);
+    line-height: var(--token-text-body-sm-leading);
+    white-space: normal;
+  }
+
+  .item-sub {
+    color: var(--token-ink-muted);
+    font-size: var(--token-text-caption);
+    line-height: var(--token-text-caption-leading);
+  }
+
+  .item-actions {
+    display: flex;
+    gap: calc(var(--token-spacing-unit) * 1);
+    margin-top: calc(var(--token-spacing-unit) * 1);
+  }
+</style>
~~~~

### changed · `src/lib/app-views/categories/slide-deck-editor/inspector/threads.svelte` (+8 / −1)

~~~~diff
@@ -1,6 +1,7 @@
 <script lang="ts">
   import { startThread } from "$capabilities/comments/index.remote";
-  import { Panel, PanelButton, PanelCrumbs, PanelEmpty, PanelQuote, PanelSection } from "$authored-components/panel";
+  import { readResourceTemplate } from "$capabilities/templates/index.remote";
+  import { Panel, PanelButton, PanelCrumbs, PanelEmpty, PanelNote, PanelQuote, PanelSection } from "$authored-components/panel";
   import { Textarea } from "$vendored-components/textarea";
   import {
     ago,
@@ -46,6 +47,8 @@
 
   const inThread = (thread: CommentThread) => remarksOf(comments, thread._id);
   const subject = $derived(element ? labelOf(element) : `Slide ${position}`);
+  const templateQuery = $derived(deckId === undefined ? undefined : readResourceTemplate({ resourceId: deckId }));
+  const workingCopy = $derived(templateQuery?.ready === true && templateQuery.current.stage !== null);
 
   let composing = $state("");
   let posting = $state(false);
@@ -82,6 +85,9 @@
       }}
     />
   {/snippet}
+  {#if workingCopy}
+    <PanelNote tone="gap">A template's working copy takes no comments; they never travel with a template.</PanelNote>
+  {:else}
   <div class="flex flex-col gap-1.5 px-3 pb-2">
     <Textarea
       bind:ref={box}
@@ -99,6 +105,7 @@
       <PanelButton label={posting ? "Posting…" : "Comment"} tone="primary" disabled={posting || composing.trim() === ""} title="Start a thread on {subject}" onclick={() => void post()} />
     </div>
   </div>
+  {/if}
 
   <section aria-labelledby="slide-thread-open" class="flex flex-col">
     <div class="text-ink-secondary flex items-center gap-1.5 px-3 py-1.5 text-start">
~~~~

### changed · `src/lib/app-views/categories/slide-deck-editor/procedures/scene.ts` (+3 / −3)

~~~~diff
@@ -4,7 +4,7 @@ import type {
   TableCell,
   TextBlock
 } from "$representation/data/types/content/content-block";
-import { rangeOf } from "$representation/data/behavior/content/positions";
+import { displayOfAtom, rangeOf } from "$representation/data/behavior/content/positions";
 import type {
   AspectRatio,
   Dash,
@@ -134,8 +134,8 @@ export const runsOf = (block: TextSceneBlock): Run[] => {
   let offset = 0;
   const formulaRanges: [number, number][] = [];
   for (const atom of block.atoms) {
-    const length = atom.kind === "literal" ? atom.text.length : atom.lastResolvedDisplay.length;
-    if (atom.kind === "formula") {
+    const length = displayOfAtom(atom).length;
+    if (atom.kind === "formula" || atom.kind === "template") {
       formulaRanges.push([offset, offset + length]);
       cuts.add(offset);
       cuts.add(offset + length);
~~~~

### new · `src/lib/app-views/categories/slide-deck-editor/procedures/templating.ts` (+418 / −0)

~~~~diff
@@ -0,0 +1,418 @@
+import {
+  readProjectResourceIndex,
+  type ProjectResourceIndex
+} from "$capabilities/project-resources/index.remote";
+import {
+  readResourceSets,
+  type ReadResourceSetsResult,
+  type ResourceSetItem
+} from "$capabilities/resource-sets/index.remote";
+import {
+  commitTemplateStage as commitTemplateStageRemote,
+  createTemplateFromResource as createTemplateFromResourceRemote,
+  discardTemplateStage as discardTemplateStageRemote,
+  openTemplateStage as openTemplateStageRemote,
+  readResourceTemplate,
+  readTemplate,
+  readTemplateLibrary,
+  updateTemplate as updateTemplateRemote,
+  type ReadResourceTemplateResult,
+  type ReadTemplateLibraryResult,
+  type ReadTemplateResult,
+  type ResourceTemplateStage,
+  type TemplateAnswers,
+  type TemplateDetail,
+  type TemplateLibraryItem
+} from "$capabilities/templates/index.remote";
+import { asId } from "$representation/data/behavior/core/id";
+import {
+  narrowed,
+  type ScopeDraft,
+  type ScopeNames,
+  type ScopeOffering
+} from "$representation/data/behavior/core/scope-draft";
+import { applyOps } from "$representation/data/behavior/slide-decks/apply-ops";
+import { withFreshIds, type IdHint } from "$representation/data/behavior/templates/fresh-ids";
+import {
+  fillTemplateAtoms,
+  resolveTemplateScopes
+} from "$representation/data/behavior/templates/scopes";
+import type { TemplatedResourceSet } from "$representation/data/types/core/resource-set";
+import type { SlideDeckBody, SlideLayout } from "$representation/data/types/slide-decks/body";
+import type { SlideDeckOp } from "$representation/data/types/slide-decks/op";
+import type { TemplateHole } from "$representation/data/types/templates/template";
+import { mint, type IdKind } from "$app-views/categories/slide-deck-editor/procedures/ids";
+import { addressOf } from "$app-views/categories/slide-deck-editor/procedures/selecting";
+import type { Selection, WorkspaceStateModel } from "$model/client/workspace-state";
+
+export type { ResourceSetItem } from "$capabilities/resource-sets/index.remote";
+export type {
+  ResourceTemplateStage,
+  TemplateAnswers,
+  TemplateDetail,
+  TemplateLibraryItem
+} from "$capabilities/templates/index.remote";
+export type { TemplatedResourceSet } from "$representation/data/types/core/resource-set";
+export type { TemplateHole } from "$representation/data/types/templates/template";
+
+export {
+  answerRowsOf,
+  missingIn,
+  type AnswerRow
+} from "$representation/data/behavior/templates/answers";
+
+export {
+  PROJECT_KINDS as KINDS,
+  builderView,
+  draftOf,
+  isWholeProject,
+  narrowed,
+  needsRow,
+  ruleWords as ruleOf,
+  termFor,
+  withTerm,
+  withWholeProject,
+  withoutTerm,
+  type OfferSource,
+  type ScopeDraft,
+  type ScopeNames,
+  type ScopeSide
+} from "$representation/data/behavior/core/scope-draft";
+
+export const resourceSets = () => readResourceSets();
+
+export const setsIn = (answer: ReadResourceSetsResult | undefined): readonly ResourceSetItem[] =>
+  answer?.sets ?? [];
+
+export const projectResources = () => readProjectResourceIndex();
+
+export const resourcesIn = (
+  answer: ProjectResourceIndex | undefined
+): readonly { readonly id: string; readonly kind: string; readonly name: string }[] =>
+  (answer?.resources ?? []).map((item) => ({ id: item.id, kind: item.kind, name: item.name }));
+
+/** What the builder and every sentence read a set or a resource by. */
+export const scopeNamesOf = (
+  sets: readonly ResourceSetItem[],
+  resources: readonly { readonly id: string; readonly name: string }[]
+): ScopeNames => ({
+  sets: new Map(sets.map((set) => [set.id, set.name])),
+  resources: new Map(resources.map((resource) => [resource.id, resource.name]))
+});
+
+/** What the builder is handed for a hole's default, or for an answer. */
+export const offeringOf = (
+  sets: readonly ResourceSetItem[],
+  resources: readonly { readonly id: string; readonly kind: string; readonly name: string }[]
+): ScopeOffering => ({
+  sets: sets.map((set) => ({ id: set.id, name: set.name, set: set.set })),
+  resources
+});
+
+/**
+ * The answers a caller chose, as rules.
+ *
+ * A hole nobody touched is absent, which is what makes the template's own
+ * default apply. Everything present is sent as built; the server decides
+ * whether it needs a row.
+ */
+/** The words typed for each text parameter, with the untouched ones left out. */
+export const wordsFrom = (
+  texts: Readonly<Record<string, string | undefined>>
+): Readonly<Record<string, string>> =>
+  Object.fromEntries(
+    Object.entries(texts).flatMap(([name, words]) =>
+      words === undefined || words.trim() === "" ? [] : [[name, words] as const]
+    )
+  );
+
+export const answersFrom = (
+  choices: Readonly<Record<string, ScopeDraft | undefined>>
+): TemplateAnswers =>
+  Object.fromEntries(
+    Object.entries(choices).flatMap(([name, draft]) => {
+      if (draft === undefined) return [];
+      const rule = narrowed(draft);
+      return rule === undefined ? [] : [[name, rule] as const];
+    })
+  );
+
+export const resourceTemplate = (resourceId: string) => readResourceTemplate({ resourceId });
+export const templateLibrary = () => readTemplateLibrary();
+export const templateDetail = (templateId: string | undefined) =>
+  templateId === undefined ? undefined : readTemplate({ templateId });
+
+export const stageIn = (
+  answer: ReadResourceTemplateResult | undefined
+): ResourceTemplateStage | undefined => answer?.stage ?? undefined;
+
+export const detailIn = (answer: ReadTemplateResult | undefined): TemplateDetail | undefined =>
+  answer === null || answer === undefined || "unavailable" in answer ? undefined : answer;
+
+export const deckTemplatesIn = (
+  answer: ReadTemplateLibraryResult | undefined
+): readonly TemplateLibraryItem[] =>
+  (answer?.templates ?? []).filter((item) => item.target === "slides");
+
+const HINT_KIND: Record<IdHint, IdKind> = {
+  slide: "slide",
+  element: "element",
+  layout: "layout",
+  block: "block",
+  cell: "block",
+  row: "block",
+  section: "block",
+  atom: "atom",
+  mark: "atom"
+};
+
+const mintFor = (hint: IdHint): string => mint(HINT_KIND[hint]);
+
+export type Insertion = {
+  readonly body: SlideDeckBody;
+  readonly ops: readonly SlideDeckOp[];
+  readonly firstSlideId: string | undefined;
+};
+
+const none = (body: SlideDeckBody): Insertion => ({ body, ops: [], firstSlideId: undefined });
+
+export const insertionOf = (
+  body: SlideDeckBody,
+  template: TemplateDetail,
+  afterSlideId: string | null,
+  mode: "resolve" | "keep",
+  answers: TemplateAnswers = {},
+  texts: Readonly<Record<string, string>> = {}
+): Insertion => {
+  if (template.body.resource !== "slides") return none(body);
+
+  let source: SlideDeckBody = template.body;
+  if (mode === "resolve") {
+    const resolved = resolveTemplateScopes(template.body, template.holes, answers);
+    if (!resolved.accepted || resolved.body.resource !== "slides") return none(body);
+    const filled = fillTemplateAtoms(resolved.body, texts);
+    if (filled.resource !== "slides") return none(body);
+    source = filled;
+  }
+  if (source.slides.length === 0) return none(body);
+
+  const fresh = withFreshIds({ layouts: source.layouts, slides: source.slides }, mintFor);
+  const ops: SlideDeckOp[] = [];
+
+  const heldKeys = new Set(body.layouts.map((layout) => layout.key));
+  const layouts: SlideLayout[] = fresh.layouts.filter((layout) => !heldKeys.has(layout.key));
+  if (layouts.length > 0) {
+    ops.push({
+      op: "insert",
+      target: "layout",
+      path: "layouts",
+      ids: layouts.map((layout) => layout.id),
+      after: body.layouts.at(-1)?.id ?? null,
+      values: layouts
+    });
+  }
+  for (const [key, style] of Object.entries(source.styles.styles)) {
+    if (key in body.styles.styles) continue;
+    ops.push({ op: "set", path: `styles/styles/${key}`, value: style, was: null });
+  }
+  const anchor = afterSlideId !== null && body.slides.some((slide) => slide.id === afterSlideId)
+    ? afterSlideId
+    : (body.slides.at(-1)?.id ?? null);
+  ops.push({
+    op: "insert",
+    target: "slide",
+    path: "slides",
+    ids: fresh.slides.map((slide) => slide.id),
+    after: anchor,
+    values: fresh.slides
+  });
+
+  return { body: applyOps(body, ops), ops, firstSlideId: fresh.slides[0]?.id };
+};
+
+/**
+ * A hole as the client sends it, which is wider than one as it is stored: a
+ * chosen rule may exclude things and may name particular resources, and the
+ * server turns either into a row before it lands.
+ */
+export type ChosenHole = Omit<TemplateHole, "default"> & { default?: ScopeDraft };
+
+export const withHoleField = (
+  holes: readonly ChosenHole[],
+  name: string,
+  change: { label?: string; description?: string; default?: ScopeDraft; text?: string }
+): readonly ChosenHole[] =>
+  holes.map((hole) => {
+    if (hole.name !== name) return hole;
+    const next: ChosenHole = { name: hole.name, label: change.label ?? hole.label };
+    const description = "description" in change ? change.description : hole.description;
+    const fallback = "default" in change ? change.default : hole.default;
+    const words = "text" in change ? change.text : hole.text;
+    if (hole.kind !== undefined) next.kind = hole.kind;
+    if (description !== undefined && description.trim().length > 0) next.description = description.trim();
+    if (fallback !== undefined) next.default = fallback;
+    if (words !== undefined && words.trim().length > 0) next.text = words;
+    return next;
+  });
+
+export const mergedHoles = (
+  held: readonly ChosenHole[],
+  inserted: readonly ChosenHole[]
+): readonly ChosenHole[] => {
+  const names = new Set(held.map((hole) => hole.name));
+  return [...held, ...inserted.filter((hole) => !names.has(hole.name))];
+};
+
+/**
+ * A text hole made by hand, rather than found.
+ *
+ * A scope hole exists because a prompt asks for one, so it cannot be authored. A
+ * text hole is a place in the prose, and nothing but the author knows where it
+ * goes — so the panel declares it and drops its atom into the selected text in
+ * the same act, and the next save finds it exactly as it finds any other.
+ */
+export const withNewTextHole = (
+  holes: readonly ChosenHole[],
+  asked: { name: string; description?: string; text?: string }
+): readonly ChosenHole[] => {
+  const name = asked.name.trim();
+  const description = asked.description?.trim() ?? "";
+  const words = asked.text ?? "";
+  return [
+    ...holes,
+    {
+      name,
+      label: name,
+      kind: "text",
+      ...(description === "" ? {} : { description }),
+      ...(words.trim() === "" ? {} : { text: words })
+    }
+  ];
+};
+
+/** Why a name will not do, or nothing when it will. */
+export const holeNameRefusal = (
+  holes: readonly ChosenHole[],
+  asked: string
+): string | undefined => {
+  const name = asked.trim();
+  if (name === "") return "Give the hole a name.";
+  if (!/^[\w][\w -]*$/.test(name)) return "A hole's name is letters, digits, spaces, hyphens and underscores.";
+  const taken = holes.some((hole) => hole.name.toLocaleLowerCase() === name.toLocaleLowerCase());
+  return taken ? `This template already has a hole called ${name}.` : undefined;
+};
+
+/**
+ * The block a new text hole's atom lands in: the one the caret is in, else the
+ * one inside the selected element, else the deck's last writable block.
+ */
+const holeBlockIn = (body: SlideDeckBody, selection: Selection | undefined) => {
+  const blocks = body.slides.flatMap((slide) =>
+    slide.elements.flatMap((element) =>
+      element.content.type === "text" || element.content.type === "prompt"
+        ? [{ elementId: element.id, block: element.content.block }]
+        : []
+    )
+  );
+  const held = selection?.id;
+  const caret = held === undefined ? undefined : addressOf(held)?.blockId;
+  return (
+    blocks.find((entry) => entry.block.id === caret) ??
+    blocks.find((entry) => entry.elementId === held) ??
+    blocks.at(-1)
+  );
+};
+
+/** The ops that put a text hole's atom into the selected text. */
+export const textHoleInsertion = (
+  body: SlideDeckBody,
+  selection: Selection | undefined,
+  name: string
+): readonly SlideDeckOp[] => {
+  const held = holeBlockIn(body, selection);
+  if (held === undefined) return [];
+  const atom = { id: mint("atom"), kind: "template" as const, name: name.trim() };
+  return [
+    {
+      op: "insert",
+      target: "atom",
+      path: `${held.block.id}/atoms`,
+      ids: [atom.id],
+      after: held.block.atoms.at(-1)?.id ?? null,
+      values: [atom]
+    }
+  ];
+};
+
+export const saveAsTemplate = (
+  view: WorkspaceStateModel,
+  resourceId: string,
+  name: string,
+  slideId?: string
+) =>
+  view.singleFlight(
+    ["template", view.project, "from-resource", resourceId, slideId ?? null, name.trim()],
+    () =>
+      createTemplateFromResourceRemote({
+        target: "slides",
+        resourceId,
+        name: name.trim(),
+        ...(slideId === undefined ? {} : { slideId })
+      }).updates(readTemplateLibrary)
+  );
+
+export const openStage = (view: WorkspaceStateModel, templateId: string) =>
+  view.singleFlight(["template", view.project, templateId, "stage"], () =>
+    openTemplateStageRemote({ templateId }).updates(
+      readTemplateLibrary,
+      readTemplate({ templateId }),
+      view.readStore("slideDecks")
+    )
+  );
+
+export const commitStage = (
+  view: WorkspaceStateModel,
+  stage: { readonly stageId: string; readonly templateId: string; readonly baseRevision: number },
+  resourceId: string
+) =>
+  view.singleFlight(["template", view.project, stage.stageId, "commit", stage.baseRevision], () =>
+    commitTemplateStageRemote({ stageId: stage.stageId, baseRevision: stage.baseRevision }).updates(
+      readTemplateLibrary,
+      readTemplate({ templateId: stage.templateId }),
+      readResourceTemplate({ resourceId })
+    )
+  );
+
+export const discardStage = (
+  view: WorkspaceStateModel,
+  stage: { readonly stageId: string; readonly templateId: string },
+  resourceId: string
+) =>
+  view.singleFlight(["template", view.project, stage.stageId, "discard"], () =>
+    discardTemplateStageRemote({ stageId: stage.stageId }).updates(
+      readTemplateLibrary,
+      readTemplate({ templateId: stage.templateId }),
+      readResourceTemplate({ resourceId }),
+      view.readStore("slideDecks")
+    )
+  );
+
+export const updateHoles = (
+  view: WorkspaceStateModel,
+  template: { readonly id: string; readonly revision: number },
+  holes: readonly ChosenHole[],
+  resourceId?: string
+) =>
+  view.singleFlight(
+    ["template", view.project, template.id, "holes", template.revision, JSON.stringify(holes)],
+    () =>
+      updateTemplateRemote({
+        templateId: template.id,
+        baseRevision: template.revision,
+        patch: { holes }
+      }).updates(
+        readTemplateLibrary,
+        readTemplate({ templateId: template.id }),
+        ...(resourceId === undefined ? [] : [readResourceTemplate({ resourceId })])
+      )
+  );
~~~~

### new · `src/lib/app-views/categories/slide-deck-editor/procedures/test/unit/templating.test.ts` (+130 / −0)

~~~~diff
@@ -0,0 +1,130 @@
+import { describe, expect, it } from "vitest";
+
+import type { SlideDeckBody } from "$representation/data/types/slide-decks/body";
+import type { TemplateDetail } from "$capabilities/templates/index.remote";
+import {
+  deckTemplatesIn,
+  insertionOf
+} from "$app-views/categories/slide-deck-editor/procedures/templating";
+
+const text = (id: string, display: string) => ({
+  id,
+  type: "text" as const,
+  variant: "paragraph" as const,
+  atoms: [{ id: `${id}-a`, kind: "literal" as const, text: display }],
+  display,
+  marks: []
+});
+
+const deck: SlideDeckBody = {
+  aspectRatio: "16:9",
+  theme: { colors: { text: "ink", accent: "blue" } },
+  styles: { defaultKey: "body", styles: { body: { name: "Body" } } },
+  layouts: [{ id: "l-title", key: "title", name: "Title", locked: [], placeholders: [] }],
+  slides: [
+    { id: "s1", layoutKey: "title", elements: [], notes: [] },
+    { id: "s2", elements: [], notes: [] }
+  ],
+  sections: []
+};
+
+const template = (slides: 1 | 2): TemplateDetail => ({
+  id: "templates:5",
+  name: "Board review",
+  target: "slides",
+  availability: "personal",
+  tags: [],
+  createdByName: "Uma",
+  revision: 1,
+  updatedAt: 1,
+  lastUsedAt: null,
+  canEdit: true,
+  canDelete: true,
+  body: {
+    resource: "slides",
+    aspectRatio: "16:9",
+    theme: { colors: { text: "ink", accent: "red" } },
+    styles: { defaultKey: "body", styles: { body: { name: "Body", fontSize: 20 }, caption: { name: "Caption" } } },
+    layouts: [
+      { id: "tl-title", key: "title", name: "Title (template)", locked: [], placeholders: [] },
+      { id: "tl-brief", key: "brief", name: "Brief", locked: [], placeholders: [] }
+    ],
+    slides: [
+      {
+        id: "ts1",
+        layoutKey: "brief",
+        elements: [
+          {
+            id: "te1",
+            frame: { x: 0.1, y: 0.1, width: 0.5, height: 0.2 },
+            content: {
+              type: "prompt",
+              block: {
+                id: "tp1",
+                type: "prompt",
+                atoms: [{ id: "tp1-a", kind: "literal", text: "Sum up" }],
+                display: "Sum up",
+                marks: [],
+                scope: { include: [{ select: "hole", name: "evidence" }], exclude: [] },
+                state: "idle"
+              }
+            }
+          }
+        ],
+        notes: [text("tn1", "Say this")]
+      },
+      ...(slides === 2 ? [{ id: "ts2", layoutKey: "title", elements: [], notes: [] }] : [])
+    ],
+    sections: []
+  },
+  holes: [{ name: "evidence", label: "Evidence", default: { include: [{ select: "project" }], exclude: [] } }]
+});
+
+describe("inserting a template into a deck", () => {
+  it("appends the slides after the current one with fresh ids, and brings what the deck lacks", () => {
+    const insertion = insertionOf(deck, template(2), "s1", "resolve");
+    const after = insertion.body;
+    expect(after.slides.map((slide) => slide.id).slice(0, 1)).toEqual(["s1"]);
+    expect(after.slides.length).toBe(4);
+    expect(after.slides[1].id).toBe(insertion.firstSlideId);
+    expect(after.slides[1].id.startsWith("slide-")).toBe(true);
+    expect(after.slides[3].id).toBe("s2");
+    expect(after.layouts.map((layout) => layout.key)).toEqual(["title", "brief"]);
+    expect(after.layouts[0].name).toBe("Title");
+    expect(after.slides[2].layoutKey).toBe("title");
+    expect(Object.keys(after.styles.styles)).toEqual(["body", "caption"]);
+    expect(after.styles.styles.body).toEqual({ name: "Body" });
+    const element = after.slides[1].elements[0];
+    expect(element.id.startsWith("el-")).toBe(true);
+    if (element.content.type !== "prompt") throw new Error("prompt expected");
+    expect(element.content.block.scope).toEqual({ include: [{ select: "project" }], exclude: [] });
+    expect(after.slides[1].notes[0].id.startsWith("blk-")).toBe(true);
+  });
+
+  it("puts a one-slide template in, keeping hole terms for a stage", () => {
+    const insertion = insertionOf(deck, template(1), "s2", "keep");
+    expect(insertion.body.slides.length).toBe(3);
+    expect(insertion.body.slides[2].id).toBe(insertion.firstSlideId);
+    const element = insertion.body.slides[2].elements[0];
+    if (element.content.type !== "prompt") throw new Error("prompt expected");
+    expect(element.content.block.scope).toEqual({ include: [{ select: "hole", name: "evidence" }], exclude: [] });
+  });
+
+  it("falls back to the end when the anchor is not in the deck, and does nothing for a document", () => {
+    const insertion = insertionOf(deck, template(1), "gone", "resolve");
+    expect(insertion.body.slides[2].id).toBe(insertion.firstSlideId);
+    const nothing = insertionOf(deck, { ...template(1), body: { resource: "document", rows: [] } }, null, "resolve");
+    expect(nothing.ops).toEqual([]);
+  });
+
+  it("lists only deck templates", () => {
+    const library = {
+      templates: [
+        { ...template(2), id: "a", holeCount: 1 },
+        { ...template(1), id: "b", target: "document" as const, holeCount: 1 }
+      ],
+      unavailable: []
+    };
+    expect(deckTemplatesIn(library).map((item) => item.id)).toEqual(["a"]);
+  });
+});
~~~~

### changed · `src/lib/app-views/categories/slide-deck-editor/procedures/typing.ts` (+2 / −3)

~~~~diff
@@ -5,14 +5,13 @@ import type {
   PromptBlock,
   TextBlock
 } from "$representation/data/types/content/content-block";
-import { endAt, rangeOf } from "$representation/data/behavior/content/positions";
+import { displayOfAtom, endAt, rangeOf } from "$representation/data/behavior/content/positions";
 import type { SlideDeckOp } from "$representation/data/types/slide-decks/op";
 import { mint } from "$app-views/categories/slide-deck-editor/procedures/ids";
 
 type EditableTextBlock = TextBlock | PromptBlock;
 
-const lengthOf = (atom: Atom): number =>
-  atom.kind === "literal" ? atom.text.length : atom.lastResolvedDisplay.length;
+const lengthOf = (atom: Atom): number => displayOfAtom(atom).length;
 
 export const replaced = (block: EditableTextBlock, from: number, to: number, insert: string): SlideDeckOp[] => {
   const start = Math.min(from, to);
~~~~

### changed · `src/lib/app-views/categories/slide-deck-editor/slide-deck-editor.md` (+23 / −1)

~~~~diff
@@ -62,7 +62,7 @@ The registered context keys are the complete rail vocabulary for this editor.
 | `slide-deck-editor.theme` | Edit slide aspect/background, save or remove layouts, and open deck named styles. |
 | `slide-deck-editor.find` | Find or replace text in slide objects, table cells, and speaker notes. |
 | `slide-deck-editor.comments` | Create and browse deck-, slide-, or element-scoped threads. |
-| `slide-deck-editor.templates` | Deferred placeholder; template browsing is not implemented here. |
+| `slide-deck-editor.templates` | Save the deck or one slide as a template, edit a template through this deck, and insert a deck template after the current slide. |
 | `slide-deck-editor.variables` | Deferred placeholder; deck variable management is not implemented here. |
 | `slide-deck-editor.prompts` | List Prompt Blocks across the deck, navigate to their slide, and open their inspector. |
 
@@ -121,6 +121,28 @@ A Prompt Block begins as a standalone text box. `Prompt` appears beside
 outer element ID, frame, paint, order, text, marks, style, and format survive.
 Only its content kind changes from `text` to `prompt`.
 
+### Templates
+
+An ordinary deck opens on a name field with Save deck and Save slide under it.
+Both require a name, both drop what a template may not carry, and both open the
+new template's working copy in its own tab. A slide saved this way is a deck
+template holding one slide, and nothing marks it afterwards.
+
+A working copy shows Save and Discard in the panel's header instead of the name
+field, because the tab title already says which template is open. Its Holes band
+lists every hole: a scope hole is found from the slides' prompt scopes and
+cannot be added by hand; a text hole is made by Create hole, which names it and
+drops its atom into the selected text. Each is a card carrying that name, its
+label, its description, and either default words or a button that opens the
+default-scope modal.
+
+A divider separates the band from a collapsible List section holding every deck
+template, searchable, each row inserting after the current slide or opening the
+template for editing. Inserting brings fresh identifiers and any layouts and
+named styles the deck lacks. A template with holes first asks, in one modal,
+what fills each; inserting into a working copy asks nothing, keeps the hole
+terms, and merges the two hole lists.
+
 ## Inspectors
 
 The registered inspector keys below are all implemented and editor-owned.
~~~~

## Project Overview's Contexts panel

### new · `src/lib/app-views/categories/project-overview/context/contexts.svelte` (+283 / −0)

~~~~diff
@@ -0,0 +1,283 @@
+<script lang="ts">
+  import { onDestroy } from "svelte";
+  import Plus from "@lucide/svelte/icons/plus";
+  import Target from "@lucide/svelte/icons/target";
+
+  import { OverlayModal } from "$authored-components/overlay";
+  import {
+    Panel,
+    PanelBanner,
+    PanelButton,
+    PanelEditableText,
+    PanelEmpty,
+    PanelField,
+    PanelFields,
+    PanelInput,
+    PanelNote,
+    PanelSearch,
+    PanelSection
+  } from "$authored-components/panel";
+  import { ScopeBuilder } from "$authored-components/scope-builder";
+  import {
+    builderView,
+    changeSet,
+    createSet,
+    describeSet,
+    draftOf,
+    narrowed,
+    nextSetName,
+    offeringOf,
+    projectResources,
+    removeSet,
+    renameSet,
+    resourceSets,
+    resourcesIn,
+    ruleOf,
+    scopeNamesOf,
+    setsIn,
+    termFor,
+    withTerm,
+    withWholeProject,
+    withoutTerm,
+    type OfferSource,
+    type ResourceSetItem,
+    type ScopeDraft,
+    type ScopeSide
+  } from "$app-views/categories/project-overview/procedures/contexts";
+  import { workspaceState } from "$model/client/workspace-state";
+
+  const view = workspaceState();
+  let live = true;
+  onDestroy(() => {
+    live = false;
+  });
+
+  const answer = resourceSets();
+  const index = projectResources();
+  const sets = $derived(setsIn(answer.ready ? answer.current : undefined));
+  const catalogue = $derived(resourcesIn(index.ready ? index.current : undefined));
+  const names = $derived(scopeNamesOf(sets, catalogue));
+
+  let query = $state("");
+  let creating = $state(false);
+  let nameDraft = $state("");
+  let draft = $state<ScopeDraft>(withWholeProject());
+  let editing = $state<ResourceSetItem | undefined>(undefined);
+  let builderOpen = $state(false);
+  let pending = $state<string | undefined>(undefined);
+  let actionError = $state<string | undefined>(undefined);
+
+  const shown = $derived(
+    sets.filter((set) => set.name.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()))
+  );
+  const busy = $derived(pending !== undefined);
+
+  const run = async (key: string, work: () => Promise<void>) => {
+    if (pending !== undefined) return;
+    pending = key;
+    actionError = undefined;
+    try {
+      await work();
+    } catch (error) {
+      if (live) actionError = error instanceof Error ? error.message : String(error);
+    } finally {
+      if (live) pending = undefined;
+    }
+  };
+
+  const create = () =>
+    run("create", async () => {
+      const rule = narrowed(draft);
+      if (rule === undefined) return;
+      const name = nameDraft.trim() || nextSetName(sets);
+      await createSet(view, name, rule);
+      if (!live) return;
+      creating = false;
+      nameDraft = "";
+      draft = withWholeProject();
+    });
+
+  const change = (item: ResourceSetItem) =>
+    run(`change:${item.id}`, async () => {
+      const rule = narrowed(draft);
+      if (rule === undefined) return;
+      const result = await changeSet(view, item, rule);
+      if (live && !result.accepted) actionError = result.detail;
+    });
+
+  /** One builder, opened either on the set being made or on one that exists. */
+  const openBuilder = (item?: ResourceSetItem) => {
+    editing = item;
+    draft = draftOf(item?.set ?? draft);
+    builderOpen = true;
+  };
+
+  const confirmBuilder = () => {
+    const item = editing;
+    if (item !== undefined) void change(item);
+    editing = undefined;
+  };
+
+  const offering = $derived(offeringOf(sets, catalogue, editing?.id));
+  const view$ = $derived(builderView(draft, offering));
+
+  const addTerm = (side: ScopeSide, source: string, key: string) => {
+    const term = termFor(source as OfferSource, key);
+    if (term !== undefined) draft = withTerm(draft, side, term);
+  };
+
+  const dropTerm = (side: ScopeSide, key: string) => {
+    draft = withoutTerm(draft, side, key);
+  };
+
+  const setMode = (whole: boolean) => {
+    draft = whole ? withWholeProject() : { include: [], exclude: [] };
+  };
+
+  const clearScope = () => {
+    draft = { include: [], exclude: [] };
+  };
+
+  const scopeBlocked = $derived(
+    draft.include.length === 0 ? "Include something, or choose the whole project." : undefined
+  );
+
+  const rename = (item: ResourceSetItem, name: string) =>
+    run(`rename:${item.id}`, async () => {
+      if (name.trim() === "" || name.trim() === item.name) return;
+      const result = await renameSet(view, item, name);
+      if (live && !result.accepted) actionError = result.detail;
+    });
+
+  const describe = (item: ResourceSetItem, description: string) =>
+    run(`describe:${item.id}`, async () => {
+      if (description.trim() === (item.description ?? "")) return;
+      const result = await describeSet(view, item, description);
+      if (live && !result.accepted) actionError = result.detail;
+    });
+
+  const remove = (item: ResourceSetItem) =>
+    run(`remove:${item.id}`, async () => {
+      if (!confirm(`Delete the set “${item.name}”?`)) return;
+      const result = await removeSet(view, item);
+      if (live && !result.accepted) actionError = result.detail;
+    });
+
+  const countOf = (set: ResourceSetItem): string =>
+    set.resolves === 0 ? "matches nothing" : `${set.resolves} ${set.resolves === 1 ? "resource" : "resources"}`;
+</script>
+
+<Panel title="Contexts">
+  {#snippet actions()}
+    <PanelButton label="New set" icon={Plus} tone={creating ? "default" : "primary"} disabled={busy} onclick={() => (creating = !creating)} />
+  {/snippet}
+
+  {#if actionError}
+    <PanelBanner title="That did not happen" tone="attention">{actionError}</PanelBanner>
+  {/if}
+
+  {#if creating}
+    <PanelSection title="New set" chevron="end">
+      <div class="add">
+        <PanelInput label="Set name" placeholder={nextSetName(sets)} flush bind:value={nameDraft} onenter={create} />
+        <PanelButton label="Create" tone="primary" disabled={busy} onclick={create} />
+      </div>
+      <div class="rule">
+        <PanelNote>{ruleOf(draft, names)}.</PanelNote>
+        <PanelButton
+          label="Choose what it selects"
+          disabled={busy}
+          title="Open the builder on this set"
+          onclick={() => openBuilder()}
+        />
+      </div>
+    </PanelSection>
+  {/if}
+
+  {#if answer.error}
+    <PanelBanner title="Sets unavailable" tone="danger">
+      {answer.error instanceof Error ? answer.error.message : String(answer.error)}
+    </PanelBanner>
+  {:else if !answer.ready}
+    <PanelNote>Reading the project's sets…</PanelNote>
+  {:else if sets.length === 0}
+    <PanelEmpty title="No saved sets yet" action="A set is a rule a prompt looks things up in, and what a template variable is answered with" />
+  {:else}
+    <PanelSearch placeholder="Filter sets…" matched={shown.length} total={sets.length} flush bind:value={query}>
+      {#each shown as set (set.id)}
+        <div class="set">
+          <PanelSection title={set.name} count={countOf(set)} open={false} chevron="end">
+            <PanelFields>
+              <PanelField label="Name" stacked>
+                <PanelEditableText value={set.name} label={`Name of ${set.name}`} disabled={busy} onchange={(next) => rename(set, next)} />
+              </PanelField>
+              <PanelField label="Description" stacked>
+                <PanelEditableText value={set.description ?? ""} label={`Description of ${set.name}`} placeholder="What this set is for" multiline disabled={busy} onchange={(next) => describe(set, next)} />
+              </PanelField>
+              <PanelField label="Rule" stacked>{ruleOf(set.set, names)}</PanelField>
+              <PanelField label="Selects now" mono>{countOf(set)}</PanelField>
+              <PanelField label="Created by">{set.createdByName}</PanelField>
+            </PanelFields>
+            {#if set.resolves === 0}
+              <PanelNote tone="gap">A set that matches nothing widens a prompt to the whole project rather than narrowing it to nothing.</PanelNote>
+            {/if}
+            <div class="remove">
+              <PanelButton
+                label="Change what it selects"
+                disabled={busy}
+                title={`Open the builder on “${set.name}”`}
+                onclick={() => openBuilder(set)}
+              />
+              <PanelButton label="Delete set" tone="danger" disabled={busy} title={`Delete “${set.name}” — refused while another set or a template still names it`} onclick={() => remove(set)} />
+            </div>
+          </PanelSection>
+        </div>
+      {/each}
+    </PanelSearch>
+  {/if}
+  <PanelNote>Counts are resolved when this panel reads, never stored. <Target size={12} aria-hidden="true" /></PanelNote>
+</Panel>
+
+<OverlayModal
+  bind:open={builderOpen}
+  title={editing === undefined ? "A set of resources" : `What “${editing.name}” selects`}
+  description="A set is a rule, resolved when it is read. Everything a prompt or a template variable can be answered with is built here."
+  confirm={editing === undefined ? "Use this" : "Save"}
+  width="narrow"
+  blocked={scopeBlocked}
+  onconfirm={confirmBuilder}
+>
+  <ScopeBuilder {...view$} onmode={setMode} onadd={addTerm} ondrop={dropTerm} onclear={clearScope} />
+</OverlayModal>
+
+<style>
+  .add {
+    display: flex;
+    align-items: center;
+    gap: calc(var(--token-spacing-unit) * 1);
+    margin-bottom: calc(var(--token-spacing-unit) * 2);
+  }
+
+  .add > :global(:first-child) {
+    min-width: 0;
+    flex: 1;
+  }
+
+  .set {
+    border-top: 1px solid var(--token-border-subtle);
+  }
+
+  .rule {
+    display: flex;
+    flex-direction: column;
+    align-items: flex-start;
+    gap: calc(var(--token-spacing-unit) * 1);
+    margin: calc(var(--token-spacing-unit) * 2) 0;
+  }
+
+  .remove {
+    display: flex;
+    gap: calc(var(--token-spacing-unit) * 1);
+    margin-top: calc(var(--token-spacing-unit) * 2);
+  }
+</style>
~~~~

### new · `src/lib/app-views/categories/project-overview/procedures/contexts.ts` (+115 / −0)

~~~~diff
@@ -0,0 +1,115 @@
+import {
+  createResourceSet as createResourceSetRemote,
+  readResourceSets,
+  removeResourceSet as removeResourceSetRemote,
+  updateResourceSet as updateResourceSetRemote,
+  type ReadResourceSetsResult,
+  type ResourceSetItem
+} from "$capabilities/resource-sets/index.remote";
+import {
+  readProjectResourceIndex,
+  type ProjectResourceIndex
+} from "$capabilities/project-resources/index.remote";
+import type {
+  ScopeNames,
+  ScopeOffering
+} from "$representation/data/behavior/core/scope-draft";
+import type { ResourceSet } from "$representation/data/types/core/resource-set";
+import type { WorkspaceStateModel } from "$model/client/workspace-state";
+
+export type { ResourceSetItem } from "$capabilities/resource-sets/index.remote";
+export type { ResourceSet } from "$representation/data/types/core/resource-set";
+
+export const resourceSets = () => readResourceSets();
+
+export const setsIn = (answer: ReadResourceSetsResult | undefined): readonly ResourceSetItem[] =>
+  answer?.sets ?? [];
+
+export {
+  PROJECT_KINDS as KINDS,
+  builderView,
+  draftOf,
+  isWholeProject,
+  narrowed,
+  ruleWords as ruleOf,
+  termFor,
+  withTerm,
+  withWholeProject,
+  withoutTerm,
+  type OfferSource,
+  type ScopeDraft,
+  type ScopeNames,
+  type ScopeSide
+} from "$representation/data/behavior/core/scope-draft";
+
+/** What the builder is handed here: the other named sets, and the project. */
+export const offeringOf = (
+  sets: readonly ResourceSetItem[],
+  resources: readonly { readonly id: string; readonly kind: string; readonly name: string }[],
+  self?: string
+): ScopeOffering => ({
+  sets: sets.filter((set) => set.id !== self).map((set) => ({ id: set.id, name: set.name, set: set.set })),
+  resources,
+  ...(self === undefined ? {} : { self })
+});
+
+export const scopeNamesOf = (
+  sets: readonly ResourceSetItem[],
+  resources: readonly { readonly id: string; readonly name: string }[]
+): ScopeNames => ({
+  sets: new Map(sets.map((set) => [set.id, set.name])),
+  resources: new Map(resources.map((resource) => [resource.id, resource.name]))
+});
+
+export const projectResources = () => readProjectResourceIndex();
+
+export const resourcesIn = (
+  answer: ProjectResourceIndex | undefined
+): readonly { readonly id: string; readonly kind: string; readonly name: string }[] =>
+  (answer?.resources ?? []).map((item) => ({ id: item.id, kind: item.kind, name: item.name }));
+
+export const nextSetName = (sets: readonly ResourceSetItem[]): string => {
+  const taken = new Set(sets.map((set) => set.name.toLocaleLowerCase()));
+  let suffix = 1;
+  while (taken.has(`new set ${suffix}`)) suffix += 1;
+  return `New set ${suffix}`;
+};
+
+export const createSet = (view: WorkspaceStateModel, name: string, set: ResourceSet) =>
+  view.singleFlight(["resource-set", view.project, "create", name.trim(), JSON.stringify(set)], () =>
+    createResourceSetRemote({ name: name.trim(), set }).updates(readResourceSets)
+  );
+
+export const renameSet = (view: WorkspaceStateModel, item: ResourceSetItem, name: string) =>
+  view.singleFlight(["resource-set", view.project, item.id, "rename", item.revision, name.trim()], () =>
+    updateResourceSetRemote({
+      setId: item.id,
+      baseRevision: item.revision,
+      patch: { name: name.trim() }
+    }).updates(readResourceSets)
+  );
+
+export const describeSet = (view: WorkspaceStateModel, item: ResourceSetItem, description: string) =>
+  view.singleFlight(
+    ["resource-set", view.project, item.id, "describe", item.revision, description.trim()],
+    () =>
+      updateResourceSetRemote({
+        setId: item.id,
+        baseRevision: item.revision,
+        patch: { description: description.trim() === "" ? null : description.trim() }
+      }).updates(readResourceSets)
+  );
+
+export const changeSet = (view: WorkspaceStateModel, item: ResourceSetItem, set: ResourceSet) =>
+  view.singleFlight(
+    ["resource-set", view.project, item.id, "set", item.revision, JSON.stringify(set)],
+    () =>
+      updateResourceSetRemote({ setId: item.id, baseRevision: item.revision, patch: { set } }).updates(
+        readResourceSets
+      )
+  );
+
+export const removeSet = (view: WorkspaceStateModel, item: ResourceSetItem) =>
+  view.singleFlight(["resource-set", view.project, item.id, "remove", item.revision], () =>
+    removeResourceSetRemote({ setId: item.id, baseRevision: item.revision }).updates(readResourceSets)
+  );
~~~~

### new · `src/lib/app-views/categories/project-overview/procedures/test/unit/contexts.test.ts` (+68 / −0)

~~~~diff
@@ -0,0 +1,68 @@
+import { describe, expect, it } from "vitest";
+
+import {
+  isWholeProject,
+  nextSetName,
+  ruleOf,
+  scopeNamesOf,
+  withTerm,
+  withWholeProject,
+  withoutTerm
+} from "$app-views/categories/project-overview/procedures/contexts";
+
+const emptySet = () => ({ include: [], exclude: [] });
+
+describe("resource set rules", () => {
+  it("reads a rule as a sentence, naming sets and resources it reaches", () => {
+    const names = scopeNamesOf(
+      [
+        {
+          id: "resourceSets:2",
+          name: "Field evidence",
+          set: emptySet(),
+          createdByName: "x",
+          revision: 1,
+          updatedAt: 1,
+          resolves: 0
+        }
+      ],
+      [{ id: "documents:1", name: "Winter readiness brief" }]
+    );
+    expect(ruleOf(emptySet())).toBe("Nothing");
+    expect(ruleOf({ include: [{ select: "project" }], exclude: [{ select: "kinds", kinds: ["slides"] }] })).toBe(
+      "Everything in the project, minus Slide decks"
+    );
+    expect(
+      ruleOf(
+        {
+          include: [
+            { select: "kinds", kinds: ["document", "finding"] },
+            { select: "set", setId: "resourceSets:2" as never },
+            { select: "resources", refs: [{ kind: "document", id: "documents:1" }] }
+          ],
+          exclude: []
+        },
+        names
+      )
+    ).toBe("Documents, Findings, Field evidence and Winter readiness brief");
+  });
+
+  it("builds and unbuilds a rule one term at a time", () => {
+    const findings = withTerm(emptySet(), "include", { select: "kinds", kinds: ["finding"] });
+    expect(ruleOf(findings)).toBe("Findings");
+    expect(isWholeProject(withWholeProject())).toBe(true);
+    expect(withoutTerm(findings, "include", "kinds:finding")).toEqual(emptySet());
+    const narrowed = withTerm(withWholeProject(), "exclude", { select: "kinds", kinds: ["slides"] });
+    expect(ruleOf(narrowed)).toBe("Everything in the project, minus Slide decks");
+    expect(withoutTerm(narrowed, "exclude", "kinds:slides")).toEqual(withWholeProject());
+  });
+
+  it("names a new set after the ones that exist", () => {
+    expect(nextSetName([])).toBe("New set 1");
+    expect(
+      nextSetName([
+        { id: "a", name: "New set 1", set: emptySet(), createdByName: "x", revision: 1, updatedAt: 1, resolves: 0 }
+      ])
+    ).toBe("New set 2");
+  });
+});
~~~~

### changed · `src/lib/app-views/categories/project-overview/project-overview.md` (+25 / −21)

~~~~diff
@@ -84,24 +84,28 @@ since the record stores an actor as a display name —
 
 ### contexts
 
-The project's saved scopes, and what each of them resolves to *now*. A Context is
-a live rule rather than a stored list, which is why the count beside each name is
-the whole point of the row: it is the only thing that says whether the rule still
-means what it meant when it was written. One band, Saved Contexts, under a search
-field.
-
-A Context that resolves to nothing is drawn as a warning, and the note at the
-foot says why: a rule with no members widens retrieval to the whole project
-instead of restricting it to nothing, which is the opposite of what its author
-asked for. Those Contexts are blocked from dispatch. The warning stands in for a
-distinction the data cannot yet make — there is no way to record that an author
-*meant* an empty scope, so an empty result and a deliberate emptiness look the
-same and both get the warning.
-
-What it deliberately does not do: it does not edit a rule. That happens on the
-Context category, and the header control is the way there.
+The project's saved resource sets, and what each of them resolves to *now*. A
+set is a live rule rather than a stored list, which is why the count beside each
+name is the whole point of the row: it is the only thing that says whether the
+rule still means what it meant when it was written. One list under a search
+field; each row opens into its name, description, the rule read as a sentence,
+the count, and the toggles that make the rule — whole project, kinds included,
+kinds excluded.
 
-Routes to `context-editor.context`.
+A set that resolves to nothing says "matches nothing" and carries a note saying
+why that matters: a rule with no members widens a prompt to the whole project
+instead of narrowing it, which is the opposite of what its author asked for.
+There is no way yet to record that an author *meant* an empty scope, so an empty
+result and a deliberate emptiness look the same.
+
+New set is the one control in the header. It opens a name field and the same
+toggles, and creates on Enter. Deleting is refused while another set in this
+project still names the set, and the refusal is said back in the panel.
+
+These sets are what a prompt's scope names, so this panel is where a project's
+scopes are kept.
+
+Routes nowhere: the row is the editor.
 
 ### contexts-library
 
@@ -276,14 +280,14 @@ Personas doing this work are managed.
 
 What is available here, grouped by what comes out of it: Documents, Slide decks,
 Spreadsheets. Grouped that way because the first question about a template is
-what it makes. Each row carries its scope and its variable count as one line,
+what it makes. Each row carries its scope and its hole count as one line,
 because they are one decision — together they say whether the template can be
 used at all.
 
 What it deliberately does not do: a row opens a template and cannot instantiate
-one. There is no Use control, because nothing in a body carries a variable key
-yet; a Use that ran today would hand back a document with the keys still sitting
-in it, which is worse than no Use.
+one. There is no Use control, because nothing in a body carries a hole key yet;
+a Use that ran today would hand back a document with the keys still sitting in
+it, which is worse than no Use.
 
 A note at the foot counts the templates that make a single slide, which has no
 group here yet.
~~~~

## The seeded one-slide template

### changed · `seed/documents.json` (+0 / −4)

~~~~diff
@@ -4,7 +4,6 @@
     "_creationTime": 1785312000000,
     "projectId": "default",
     "title": "Winter readiness brief",
-    "templateId": "templates:2",
     "createdBy": { "kind": "user", "userId": "users:1" },
     "updatedBy": { "kind": "user", "userId": "users:1" },
     "updatedAt": 1788299760000
@@ -14,7 +13,6 @@
     "_creationTime": 1784707200000,
     "projectId": "default",
     "title": "Substation 14 incident write-up",
-    "templateId": "templates:1",
     "createdBy": { "kind": "user", "userId": "users:2" },
     "updatedBy": { "kind": "user", "userId": "users:3" },
     "updatedAt": 1788213600000
@@ -24,7 +22,6 @@
     "_creationTime": 1783497600000,
     "projectId": "default",
     "title": "Interconnect glossary",
-    "templateId": "templates:3",
     "createdBy": { "kind": "user", "userId": "users:3" },
     "updatedBy": { "kind": "user", "userId": "users:3" },
     "updatedAt": 1787954400000
@@ -34,7 +31,6 @@
     "_creationTime": 1788111000000,
     "projectId": "default",
     "title": "Transformer bank replacement decision",
-    "templateId": "templates:4",
     "createdBy": { "kind": "user", "userId": "default-user" },
     "updatedBy": { "kind": "user", "userId": "users:1" },
     "updatedAt": 1788460800000
~~~~

### changed · `seed/resourceSets.json` (+17 / −0)

~~~~diff
@@ -25,5 +25,22 @@
     "createdBy": { "kind": "user", "userId": "users:4" },
     "revision": 1,
     "updatedAt": 1787004000000
+  },
+  {
+    "_id": "resourceSets:3",
+    "_creationTime": 1787000000000,
+    "projectId": "default",
+    "boundTo": {
+      "kind": "hole",
+      "templateId": "templates:1",
+      "hole": "incident_evidence"
+    },
+    "set": {
+      "include": [{ "select": "kinds", "kinds": ["finding", "document", "spreadsheet"] }],
+      "exclude": [{ "select": "resources", "refs": [{ "kind": "document", "id": "documents:3" }] }]
+    },
+    "createdBy": { "kind": "user", "userId": "users:1" },
+    "revision": 1,
+    "updatedAt": 1787004000000
   }
 ]
~~~~

### changed · `seed/slideDecks.json` (+0 / −4)

~~~~diff
@@ -4,7 +4,6 @@
     "_creationTime": 1786435200000,
     "projectId": "default",
     "title": "Board review — Q1 exposure",
-    "templateId": "templates:5",
     "createdBy": { "kind": "user", "userId": "users:1" },
     "updatedBy": { "kind": "user", "userId": "users:2" },
     "updatedAt": 1788296400000
@@ -14,7 +13,6 @@
     "_creationTime": 1782892800000,
     "projectId": "default",
     "title": "Field team briefing",
-    "templateId": "templates:6",
     "createdBy": { "kind": "user", "userId": "users:4" },
     "updatedBy": { "kind": "user", "userId": "users:4" },
     "updatedAt": 1787436000000
@@ -24,7 +22,6 @@
     "_creationTime": 1788448800000,
     "projectId": "default",
     "title": "Executive update — September",
-    "templateId": "templates:7",
     "createdBy": { "kind": "user", "userId": "default-user" },
     "updatedBy": { "kind": "user", "userId": "default-user" },
     "updatedAt": 1788528000000
@@ -34,7 +31,6 @@
     "_creationTime": 1787244300000,
     "projectId": "default",
     "title": "Storm hardening options",
-    "templateId": "templates:8",
     "createdBy": { "kind": "user", "userId": "users:3" },
     "updatedBy": { "kind": "user", "userId": "users:1" },
     "updatedAt": 1788001200000
~~~~

### changed · `seed/spreadsheets.json` (+0 / −2)

~~~~diff
@@ -4,7 +4,6 @@
     "_creationTime": 1785916800000,
     "projectId": "default",
     "title": "Outage minutes by substation",
-    "templateId": "templates:9",
     "createdBy": { "kind": "user", "userId": "users:2" },
     "updatedBy": { "kind": "user", "userId": "users:2" },
     "updatedAt": 1788298200000
@@ -14,7 +13,6 @@
     "_creationTime": 1784102400000,
     "projectId": "default",
     "title": "Hardening cost model",
-    "templateId": "templates:10",
     "createdBy": { "kind": "user", "userId": "users:1" },
     "updatedBy": { "kind": "agent", "taskId": "agentTasks:1" },
     "updatedAt": 1788127200000
~~~~

### changed · `seed/templates.json` (+1524 / −250)

~~~~diff
@@ -2,23 +2,51 @@
   {
     "_id": "templates:1",
     "_creationTime": 1777636800000,
+    "projectId": "default",
     "userId": "default-user",
     "name": "Incident write-up",
     "description": "A calm, evidence-led retrospective for cause, impact, response, and corrective action.",
-    "tags": ["Incident response", "Operations", "Review"],
+    "tags": [
+      "Incident response",
+      "Operations",
+      "Review"
+    ],
     "body": {
       "resource": "document",
       "pageSetup": {
         "paper": "letter",
         "orientation": "portrait",
-        "margins": { "top": 0.8, "right": 0.85, "bottom": 0.8, "left": 0.85 }
+        "margins": {
+          "top": 0.8,
+          "right": 0.85,
+          "bottom": 0.8,
+          "left": 0.85
+        }
       },
       "styles": {
         "defaultKey": "body",
         "styles": {
-          "title": { "name": "Title", "fontSize": 30, "bold": true, "color": "--token-ink-primary", "spaceAfter": 14 },
-          "heading": { "name": "Heading", "fontSize": 16, "bold": true, "color": "--token-ink-primary", "spaceBefore": 16, "spaceAfter": 6 },
-          "body": { "name": "Body", "fontSize": 11, "color": "--token-ink-secondary", "lineHeight": 16.5 }
+          "title": {
+            "name": "Title",
+            "fontSize": 30,
+            "bold": true,
+            "color": "--token-ink-primary",
+            "spaceAfter": 14
+          },
+          "heading": {
+            "name": "Heading",
+            "fontSize": 16,
+            "bold": true,
+            "color": "--token-ink-primary",
+            "spaceBefore": 16,
+            "spaceAfter": 6
+          },
+          "body": {
+            "name": "Body",
+            "fontSize": 11,
+            "color": "--token-ink-secondary",
+            "lineHeight": 16.5
+          }
         }
       },
       "rows": [
@@ -32,7 +60,13 @@
               "variant": "heading",
               "level": 1,
               "style": "title",
-              "atoms": [{ "id": "#tiw-title-a", "kind": "literal", "text": "Incident write-up" }],
+              "atoms": [
+                {
+                  "id": "#tiw-title-a",
+                  "kind": "literal",
+                  "text": "Incident write-up"
+                }
+              ],
               "display": "Incident write-up",
               "marks": []
             }
@@ -48,21 +82,44 @@
               "variant": "heading",
               "level": 2,
               "style": "heading",
-              "atoms": [{ "id": "#tiw-summary-heading-a", "kind": "literal", "text": "Executive summary" }],
+              "atoms": [
+                {
+                  "id": "#tiw-summary-heading-a",
+                  "kind": "literal",
+                  "text": "Executive summary"
+                }
+              ],
               "display": "Executive summary",
               "marks": []
             },
             {
               "id": "#tiw-summary",
               "type": "prompt",
-              "atoms": [{ "id": "#tiw-summary-a", "kind": "literal", "text": "Summarize what happened, the customer impact, and the current operating state." }],
+              "atoms": [
+                {
+                  "id": "#tiw-summary-a",
+                  "kind": "literal",
+                  "text": "Summarize what happened, the customer impact, and the current operating state."
+                }
+              ],
               "display": "Summarize what happened, the customer impact, and the current operating state.",
               "marks": [],
-              "scope": { "include": [{ "select": "variable", "name": "incident_evidence" }], "exclude": [] },
+              "scope": {
+                "include": [
+                  {
+                    "select": "hole",
+                    "name": "incident_evidence"
+                  }
+                ],
+                "exclude": []
+              },
               "state": "idle"
             }
           ],
-          "proportions": [0.3, 0.7]
+          "proportions": [
+            0.3,
+            0.7
+          ]
         },
         {
           "id": "#tiw-row-actions",
@@ -74,7 +131,13 @@
               "variant": "heading",
               "level": 2,
               "style": "heading",
-              "atoms": [{ "id": "#tiw-actions-heading-a", "kind": "literal", "text": "Corrective actions" }],
+              "atoms": [
+                {
+                  "id": "#tiw-actions-heading-a",
+                  "kind": "literal",
+                  "text": "Corrective actions"
+                }
+              ],
               "display": "Corrective actions",
               "marks": []
             },
@@ -83,47 +146,98 @@
               "type": "text",
               "variant": "paragraph",
               "style": "body",
-              "atoms": [{ "id": "#tiw-actions-a", "kind": "literal", "text": "Name the owner, due date, and verification evidence for each action." }],
+              "atoms": [
+                {
+                  "id": "#tiw-actions-a",
+                  "kind": "literal",
+                  "text": "Name the owner, due date, and verification evidence for each action."
+                }
+              ],
               "display": "Name the owner, due date, and verification evidence for each action.",
               "marks": []
             }
           ],
-          "proportions": [0.3, 0.7]
+          "proportions": [
+            0.3,
+            0.7
+          ]
         }
       ]
     },
-    "variables": [
+    "holes": [
       {
         "name": "incident_evidence",
         "label": "Incident evidence",
         "description": "Findings, documents, and operating models that establish the incident timeline.",
-        "default": { "include": [{ "select": "kinds", "kinds": ["finding", "document", "spreadsheet"] }], "exclude": [] }
+        "default": {
+          "include": [
+            {
+              "select": "set",
+              "setId": "resourceSets:3"
+            }
+          ],
+          "exclude": []
+        }
       }
     ],
-    "createdBy": { "kind": "user", "userId": "default-user" },
+    "createdBy": {
+      "kind": "user",
+      "userId": "default-user"
+    },
     "revision": 6,
-    "updatedAt": 1788351300000
+    "updatedAt": 1788351300000,
+    "lastUsedAt": 1788264900000
   },
   {
     "_id": "templates:2",
     "_creationTime": 1778238000000,
+    "projectId": "default",
     "userId": "default-user",
     "name": "Operational readiness brief",
     "description": "A decision-ready brief for expected conditions, exposure, mitigations, and remaining operating gaps.",
-    "tags": ["Operations", "Planning", "Project standard"],
+    "tags": [
+      "Operations",
+      "Planning",
+      "Project standard"
+    ],
     "body": {
       "resource": "document",
       "pageSetup": {
         "paper": "letter",
         "orientation": "portrait",
-        "margins": { "top": 1, "right": 1, "bottom": 1, "left": 1 }
+        "margins": {
+          "top": 1,
+          "right": 1,
+          "bottom": 1,
+          "left": 1
+        }
       },
       "styles": {
         "defaultKey": "body",
         "styles": {
-          "title": { "name": "Brief title", "fontSize": 24, "bold": true, "horizontalAlignment": "center", "color": "--token-ink-primary", "spaceAfter": 18 },
-          "heading": { "name": "Section", "fontSize": 14, "bold": true, "color": "--token-ink-primary", "spaceBefore": 14, "spaceAfter": 6 },
-          "body": { "name": "Brief body", "fontSize": 11, "color": "--token-ink-secondary", "lineHeight": 17.05, "horizontalAlignment": "justify" }
+          "title": {
+            "name": "Brief title",
+            "fontSize": 24,
+            "bold": true,
+            "horizontalAlignment": "center",
+            "color": "--token-ink-primary",
+            "spaceAfter": 18
+          },
+          "heading": {
+            "name": "Section",
+            "fontSize": 14,
+            "bold": true,
+            "color": "--token-ink-primary",
+            "spaceBefore": 14,
+            "spaceAfter": 6
+          },
+          "body": {
+            "name": "Brief body",
+            "fontSize": 11,
+            "color": "--token-ink-secondary",
+            "lineHeight": 17.05,
+            "horizontalAlignment": "justify"
+          }
         }
       },
       "rows": [
@@ -137,7 +251,13 @@
               "variant": "heading",
               "level": 1,
               "style": "title",
-              "atoms": [{ "id": "#trf-title-a", "kind": "literal", "text": "Operational readiness brief" }],
+              "atoms": [
+                {
+                  "id": "#trf-title-a",
+                  "kind": "literal",
+                  "text": "Operational readiness brief"
+                }
+              ],
               "display": "Operational readiness brief",
               "marks": []
             }
@@ -153,21 +273,44 @@
               "variant": "heading",
               "level": 2,
               "style": "heading",
-              "atoms": [{ "id": "#trf-position-heading-a", "kind": "literal", "text": "Expected conditions and exposure" }],
+              "atoms": [
+                {
+                  "id": "#trf-position-heading-a",
+                  "kind": "literal",
+                  "text": "Expected conditions and exposure"
+                }
+              ],
               "display": "Expected conditions and exposure",
               "marks": []
             },
             {
               "id": "#trf-position",
               "type": "prompt",
-              "atoms": [{ "id": "#trf-position-a", "kind": "literal", "text": "Summarize the expected operating conditions, binding constraints, and consequences if the forecast is exceeded." }],
+              "atoms": [
+                {
+                  "id": "#trf-position-a",
+                  "kind": "literal",
+                  "text": "Summarize the expected operating conditions, binding constraints, and consequences if the forecast is exceeded."
+                }
+              ],
               "display": "Summarize the expected operating conditions, binding constraints, and consequences if the forecast is exceeded.",
               "marks": [],
-              "scope": { "include": [{ "select": "variable", "name": "readiness_record" }], "exclude": [] },
+              "scope": {
+                "include": [
+                  {
+                    "select": "hole",
+                    "name": "readiness_record"
+                  }
+                ],
+                "exclude": []
+              },
               "state": "idle"
             }
           ],
-          "proportions": [0.32, 0.68]
+          "proportions": [
+            0.32,
+            0.68
+          ]
         },
         {
           "id": "#trf-row-support",
@@ -179,62 +322,133 @@
               "variant": "heading",
               "level": 2,
               "style": "heading",
-              "atoms": [{ "id": "#trf-support-heading-a", "kind": "literal", "text": "Mitigations, commitments, and gaps" }],
+              "atoms": [
+                {
+                  "id": "#trf-support-heading-a",
+                  "kind": "literal",
+                  "text": "Mitigations, commitments, and gaps"
+                }
+              ],
               "display": "Mitigations, commitments, and gaps",
               "marks": []
             },
             {
               "id": "#trf-support",
               "type": "prompt",
-              "atoms": [{ "id": "#trf-support-a", "kind": "literal", "text": "Separate committed mitigations from residual gaps, then state the owner and decision date for each open action." }],
+              "atoms": [
+                {
+                  "id": "#trf-support-a",
+                  "kind": "literal",
+                  "text": "Separate committed mitigations from residual gaps, then state the owner and decision date for each open action."
+                }
+              ],
               "display": "Separate committed mitigations from residual gaps, then state the owner and decision date for each open action.",
               "marks": [],
-              "scope": { "include": [{ "select": "variable", "name": "supporting_findings" }], "exclude": [] },
+              "scope": {
+                "include": [
+                  {
+                    "select": "hole",
+                    "name": "supporting_findings"
+                  }
+                ],
+                "exclude": []
+              },
               "state": "idle"
             }
           ],
-          "proportions": [0.32, 0.68]
+          "proportions": [
+            0.32,
+            0.68
+          ]
         }
       ]
     },
-    "variables": [
+    "holes": [
       {
         "name": "readiness_record",
         "label": "Readiness record",
         "description": "The forecasts, plans, and operating material that define the readiness posture.",
-        "default": { "include": [{ "select": "project" }], "exclude": [] }
+        "default": {
+          "include": [
+            {
+              "select": "project"
+            }
+          ],
+          "exclude": []
+        }
       },
       {
         "name": "supporting_findings",
         "label": "Supporting findings",
         "description": "Accepted findings that establish constraints, mitigations, and residual gaps.",
-        "default": { "include": [{ "select": "kinds", "kinds": ["finding"] }], "exclude": [] }
+        "default": {
+          "include": [
+            {
+              "select": "kinds",
+              "kinds": [
+                "finding"
+              ]
+            }
+          ],
+          "exclude": []
+        }
       }
     ],
-    "createdBy": { "kind": "user", "userId": "default-user" },
+    "createdBy": {
+      "kind": "user",
+      "userId": "default-user"
+    },
     "revision": 8,
-    "updatedAt": 1788111000000
+    "updatedAt": 1788111000000,
+    "lastUsedAt": 1788024600000
   },
   {
     "_id": "templates:3",
     "_creationTime": 1779361200000,
+    "projectId": "default",
     "userId": "default-user",
     "name": "Technical glossary",
     "description": "A maintained glossary for project terminology, acronyms, definitions, and source notes.",
-    "tags": ["Reference", "Onboarding", "Documentation"],
+    "tags": [
+      "Reference",
+      "Onboarding",
+      "Documentation"
+    ],
     "body": {
       "resource": "document",
       "pageSetup": {
         "paper": "a4",
         "orientation": "portrait",
-        "margins": { "top": 0.75, "right": 0.75, "bottom": 0.75, "left": 0.75 }
+        "margins": {
+          "top": 0.75,
+          "right": 0.75,
+          "bottom": 0.75,
+          "left": 0.75
+        }
       },
       "styles": {
         "defaultKey": "definition",
         "styles": {
-          "title": { "name": "Title", "fontSize": 28, "bold": true, "color": "--token-ink-primary", "spaceAfter": 12 },
-          "term": { "name": "Term", "fontSize": 13, "bold": true, "color": "--token-color-accent-1-text", "spaceBefore": 10 },
-          "definition": { "name": "Definition", "fontSize": 10.5, "color": "--token-ink-secondary", "lineHeight": 15.23 }
+          "title": {
+            "name": "Title",
+            "fontSize": 28,
+            "bold": true,
+            "color": "--token-ink-primary",
+            "spaceAfter": 12
+          },
+          "term": {
+            "name": "Term",
+            "fontSize": 13,
+            "bold": true,
+            "color": "--token-color-accent-1-text",
+            "spaceBefore": 10
+          },
+          "definition": {
+            "name": "Definition",
+            "fontSize": 10.5,
+            "color": "--token-ink-secondary",
+            "lineHeight": 15.23
+          }
         }
       },
       "rows": [
@@ -248,8 +462,24 @@
               "variant": "heading",
               "level": 1,
               "style": "title",
-              "atoms": [{ "id": "#ttg-title-a", "kind": "literal", "text": "Technical glossary" }],
-              "display": "Technical glossary",
+              "atoms": [
+                {
+                  "id": "#ttg-title-a",
+                  "kind": "literal",
+                  "text": "Technical glossary"
+                },
+                {
+                  "id": "#ttg-title-sep",
+                  "kind": "literal",
+                  "text": " · "
+                },
+                {
+                  "id": "#ttg-title-subject",
+                  "kind": "template",
+                  "name": "subject_line"
+                }
+              ],
+              "display": "Technical glossary · {subject_line}",
               "marks": []
             }
           ]
@@ -264,7 +494,13 @@
               "variant": "heading",
               "level": 2,
               "style": "term",
-              "atoms": [{ "id": "#ttg-term-a", "kind": "literal", "text": "Term or acronym" }],
+              "atoms": [
+                {
+                  "id": "#ttg-term-a",
+                  "kind": "literal",
+                  "text": "Term or acronym"
+                }
+              ],
               "display": "Term or acronym",
               "marks": []
             },
@@ -273,12 +509,21 @@
               "type": "text",
               "variant": "paragraph",
               "style": "definition",
-              "atoms": [{ "id": "#ttg-definition-a", "kind": "literal", "text": "Plain-language definition, operational meaning, and source note." }],
+              "atoms": [
+                {
+                  "id": "#ttg-definition-a",
+                  "kind": "literal",
+                  "text": "Plain-language definition, operational meaning, and source note."
+                }
+              ],
               "display": "Plain-language definition, operational meaning, and source note.",
               "marks": []
             }
           ],
-          "proportions": [0.28, 0.72]
+          "proportions": [
+            0.28,
+            0.72
+          ]
         },
         {
           "id": "#ttg-row-review",
@@ -290,56 +535,131 @@
               "variant": "heading",
               "level": 2,
               "style": "term",
-              "atoms": [{ "id": "#ttg-review-heading-a", "kind": "literal", "text": "Consistency review" }],
+              "atoms": [
+                {
+                  "id": "#ttg-review-heading-a",
+                  "kind": "literal",
+                  "text": "Consistency review"
+                }
+              ],
               "display": "Consistency review",
               "marks": []
             },
             {
               "id": "#ttg-review",
               "type": "prompt",
-              "atoms": [{ "id": "#ttg-review-a", "kind": "literal", "text": "Identify terms used inconsistently across the selected source material." }],
+              "atoms": [
+                {
+                  "id": "#ttg-review-a",
+                  "kind": "literal",
+                  "text": "Identify terms used inconsistently across the selected source material."
+                }
+              ],
               "display": "Identify terms used inconsistently across the selected source material.",
               "marks": [],
-              "scope": { "include": [{ "select": "variable", "name": "source_material" }], "exclude": [] },
+              "scope": {
+                "include": [
+                  {
+                    "select": "hole",
+                    "name": "source_material"
+                  }
+                ],
+                "exclude": []
+              },
               "state": "idle"
             }
           ]
         }
       ]
     },
-    "variables": [
+    "holes": [
       {
         "name": "source_material",
         "label": "Source material",
         "description": "Documents and findings whose terminology should be normalized.",
-        "default": { "include": [{ "select": "kinds", "kinds": ["document", "finding"] }], "exclude": [] }
+        "default": {
+          "include": [
+            {
+              "select": "kinds",
+              "kinds": [
+                "document",
+                "finding"
+              ]
+            }
+          ],
+          "exclude": []
+        }
+      },
+      {
+        "name": "subject_line",
+        "label": "Subject line",
+        "description": "The one line at the top that says what this glossary covers.",
+        "kind": "text"
       }
     ],
-    "createdBy": { "kind": "user", "userId": "default-user" },
+    "createdBy": {
+      "kind": "user",
+      "userId": "default-user"
+    },
     "revision": 3,
-    "updatedAt": 1787244300000
+    "updatedAt": 1787244300000,
+    "lastUsedAt": 1787157900000
   },
   {
     "_id": "templates:4",
     "_creationTime": 1780578000000,
+    "projectId": "default",
     "userId": "default-user",
     "name": "Decision memo",
     "description": "A concise decision record that compares alternatives, evidence, trade-offs, and the recommended path.",
-    "tags": ["Decision", "Leadership", "Planning"],
+    "tags": [
+      "Decision",
+      "Leadership",
+      "Planning"
+    ],
     "body": {
       "resource": "document",
       "pageSetup": {
         "paper": "letter",
         "orientation": "portrait",
-        "margins": { "top": 0.7, "right": 0.8, "bottom": 0.7, "left": 0.8 }
+        "margins": {
+          "top": 0.7,
+          "right": 0.8,
+          "bottom": 0.7,
+          "left": 0.8
+        }
       },
       "styles": {
         "defaultKey": "body",
         "styles": {
-          "title": { "name": "Title", "fontSize": 29, "bold": true, "color": "--token-ink-primary", "spaceAfter": 12 },
-          "heading": { "name": "Heading", "fontSize": 15, "bold": true, "color": "--token-ink-primary", "spaceBefore": 14, "spaceAfter": 5 },
-          "body": { "name": "Body", "fontSize": 11, "color": "--token-ink-secondary", "lineHeight": 16.5 },
-          "callout": { "name": "Recommendation", "fontSize": 12, "bold": true, "background": "--token-color-active-surface", "color": "--token-color-active-text" }
+          "title": {
+            "name": "Title",
+            "fontSize": 29,
+            "bold": true,
+            "color": "--token-ink-primary",
+            "spaceAfter": 12
+          },
+          "heading": {
+            "name": "Heading",
+            "fontSize": 15,
+            "bold": true,
+            "color": "--token-ink-primary",
+            "spaceBefore": 14,
+            "spaceAfter": 5
+          },
+          "body": {
+            "name": "Body",
+            "fontSize": 11,
+            "color": "--token-ink-secondary",
+            "lineHeight": 16.5
+          },
+          "callout": {
+            "name": "Recommendation",
+            "fontSize": 12,
+            "bold": true,
+            "background": "--token-color-active-surface",
+            "color": "--token-color-active-text"
+          }
         }
       },
       "rows": [
@@ -353,7 +673,13 @@
               "variant": "heading",
               "level": 1,
               "style": "title",
-              "atoms": [{ "id": "#tdm-title-a", "kind": "literal", "text": "Decision memo" }],
+              "atoms": [
+                {
+                  "id": "#tdm-title-a",
+                  "kind": "literal",
+                  "text": "Decision memo"
+                }
+              ],
               "display": "Decision memo",
               "marks": []
             }
@@ -369,21 +695,44 @@
               "variant": "heading",
               "level": 2,
               "style": "heading",
-              "atoms": [{ "id": "#tdm-context-heading-a", "kind": "literal", "text": "Decision context" }],
+              "atoms": [
+                {
+                  "id": "#tdm-context-heading-a",
+                  "kind": "literal",
+                  "text": "Decision context"
+                }
+              ],
               "display": "Decision context",
               "marks": []
             },
             {
               "id": "#tdm-context",
               "type": "prompt",
-              "atoms": [{ "id": "#tdm-context-a", "kind": "literal", "text": "Explain the decision, its urgency, and the evidence that constrains it." }],
+              "atoms": [
+                {
+                  "id": "#tdm-context-a",
+                  "kind": "literal",
+                  "text": "Explain the decision, its urgency, and the evidence that constrains it."
+                }
+              ],
               "display": "Explain the decision, its urgency, and the evidence that constrains it.",
               "marks": [],
-              "scope": { "include": [{ "select": "variable", "name": "decision_evidence" }], "exclude": [] },
+              "scope": {
+                "include": [
+                  {
+                    "select": "hole",
+                    "name": "decision_evidence"
+                  }
+                ],
+                "exclude": []
+              },
               "state": "idle"
             }
           ],
-          "proportions": [0.3, 0.7]
+          "proportions": [
+            0.3,
+            0.7
+          ]
         },
         {
           "id": "#tdm-row-options",
@@ -395,21 +744,44 @@
               "variant": "heading",
               "level": 2,
               "style": "heading",
-              "atoms": [{ "id": "#tdm-options-heading-a", "kind": "literal", "text": "Alternatives and economics" }],
+              "atoms": [
+                {
+                  "id": "#tdm-options-heading-a",
+                  "kind": "literal",
+                  "text": "Alternatives and economics"
+                }
+              ],
               "display": "Alternatives and economics",
               "marks": []
             },
             {
               "id": "#tdm-options",
               "type": "prompt",
-              "atoms": [{ "id": "#tdm-options-a", "kind": "literal", "text": "Compare feasible alternatives, total cost, reversibility, and delivery risk." }],
+              "atoms": [
+                {
+                  "id": "#tdm-options-a",
+                  "kind": "literal",
+                  "text": "Compare feasible alternatives, total cost, reversibility, and delivery risk."
+                }
+              ],
               "display": "Compare feasible alternatives, total cost, reversibility, and delivery risk.",
               "marks": [],
-              "scope": { "include": [{ "select": "variable", "name": "cost_models" }], "exclude": [] },
+              "scope": {
+                "include": [
+                  {
+                    "select": "hole",
+                    "name": "cost_models"
+                  }
+                ],
+                "exclude": []
+              },
               "state": "idle"
             }
           ],
-          "proportions": [0.3, 0.7]
+          "proportions": [
+            0.3,
+            0.7
+          ]
         },
         {
           "id": "#tdm-row-recommendation",
@@ -420,45 +792,94 @@
               "type": "text",
               "variant": "paragraph",
               "style": "callout",
-              "atoms": [{ "id": "#tdm-recommendation-a", "kind": "literal", "text": "Recommendation: state the path, owner, decision date, and next irreversible step." }],
+              "atoms": [
+                {
+                  "id": "#tdm-recommendation-a",
+                  "kind": "literal",
+                  "text": "Recommendation: state the path, owner, decision date, and next irreversible step."
+                }
+              ],
               "display": "Recommendation: state the path, owner, decision date, and next irreversible step.",
               "marks": [],
-              "format": { "padding": { "x": 12, "y": 10 }, "border": { "color": "--token-color-active-border", "width": 1, "style": "solid" } }
+              "format": {
+                "padding": {
+                  "x": 12,
+                  "y": 10
+                },
+                "border": {
+                  "color": "--token-color-active-border",
+                  "width": 1,
+                  "style": "solid"
+                }
+              }
             }
           ]
         }
       ]
     },
-    "variables": [
+    "holes": [
       {
         "name": "decision_evidence",
         "label": "Decision evidence",
         "description": "The findings and documents that establish why a decision is required.",
-        "default": { "include": [{ "select": "kinds", "kinds": ["finding", "document"] }], "exclude": [] }
+        "default": {
+          "include": [
+            {
+              "select": "kinds",
+              "kinds": [
+                "finding",
+                "document"
+              ]
+            }
+          ],
+          "exclude": []
+        }
       },
       {
         "name": "cost_models",
         "label": "Cost models",
         "description": "The spreadsheets used to compare alternatives and delivery economics.",
-        "default": { "include": [{ "select": "kinds", "kinds": ["spreadsheet"] }], "exclude": [] }
+        "default": {
+          "include": [
+            {
+              "select": "kinds",
+              "kinds": [
+                "spreadsheet"
+              ]
+            }
+          ],
+          "exclude": []
+        }
       }
     ],
-    "createdBy": { "kind": "user", "userId": "default-user" },
+    "createdBy": {
+      "kind": "user",
+      "userId": "default-user"
+    },
     "revision": 4,
-    "updatedAt": 1788448800000
+    "updatedAt": 1788448800000,
+    "lastUsedAt": 1788362400000
   },
   {
     "_id": "templates:5",
     "_creationTime": 1780876800000,
+    "projectId": "default",
     "userId": "default-user",
     "name": "Board review",
     "description": "A disciplined board narrative for performance, risk, decisions, and the next horizon.",
-    "tags": ["Leadership", "Board", "Project standard"],
+    "tags": [
+      "Leadership",
+      "Board",
+      "Project standard"
+    ],
     "body": {
       "resource": "slides",
       "aspectRatio": "16:9",
       "theme": {
-        "background": { "kind": "color", "color": "--token-surface-primary" },
+        "background": {
+          "kind": "color",
+          "color": "--token-surface-primary"
+        },
         "colors": {
           "text": "--token-ink-primary",
           "accent": "--token-color-accent-1-fill",
@@ -469,10 +890,32 @@
       "styles": {
         "defaultKey": "body",
         "styles": {
-          "eyebrow": { "name": "Eyebrow", "fontSize": 13, "fontWeight": 600, "color": "--token-color-accent-1-fill", "spaceAfter": 10 },
-          "title": { "name": "Title", "fontSize": 32, "fontWeight": 600, "color": "--token-ink-primary", "lineHeight": 1.08 },
-          "body": { "name": "Body", "fontSize": 18, "color": "--token-ink-secondary", "lineHeight": 1.35 },
-          "metric": { "name": "Metric", "fontSize": 28, "fontWeight": 600, "color": "--token-ink-primary" }
+          "eyebrow": {
+            "name": "Eyebrow",
+            "fontSize": 13,
+            "fontWeight": 600,
+            "color": "--token-color-accent-1-fill",
+            "spaceAfter": 10
+          },
+          "title": {
+            "name": "Title",
+            "fontSize": 32,
+            "fontWeight": 600,
+            "color": "--token-ink-primary",
+            "lineHeight": 1.08
+          },
+          "body": {
+            "name": "Body",
+            "fontSize": 18,
+            "color": "--token-ink-secondary",
+            "lineHeight": 1.35
+          },
+          "metric": {
+            "name": "Metric",
+            "fontSize": 28,
+            "fontWeight": 600,
+            "color": "--token-ink-primary"
+          }
         }
       },
       "layouts": [
@@ -481,8 +924,26 @@
           "name": "Board brief",
           "locked": [],
           "placeholders": [
-            { "role": "title", "frame": { "x": 0.07, "y": 0.1, "width": 0.86, "height": 0.18 }, "styleKey": "title" },
-            { "role": "body", "frame": { "x": 0.07, "y": 0.35, "width": 0.86, "height": 0.52 }, "styleKey": "body" }
+            {
+              "role": "title",
+              "frame": {
+                "x": 0.07,
+                "y": 0.1,
+                "width": 0.86,
+                "height": 0.18
+              },
+              "styleKey": "title"
+            },
+            {
+              "role": "body",
+              "frame": {
+                "x": 0.07,
+                "y": 0.35,
+                "width": 0.86,
+                "height": 0.52
+              },
+              "styleKey": "body"
+            }
           ]
         }
       ],
@@ -493,7 +954,12 @@
           "elements": [
             {
               "id": "#tboard-title-element",
-              "frame": { "x": 0.07, "y": 0.1, "width": 0.86, "height": 0.18 },
+              "frame": {
+                "x": 0.07,
+                "y": 0.1,
+                "width": 0.86,
+                "height": 0.18
+              },
               "blocks": [
                 {
                   "id": "#tboard-title",
@@ -501,7 +967,13 @@
                   "variant": "heading",
                   "level": 1,
                   "style": "title",
-                  "atoms": [{ "id": "#tboard-title-a", "kind": "literal", "text": "Board review · operating performance" }],
+                  "atoms": [
+                    {
+                      "id": "#tboard-title-a",
+                      "kind": "literal",
+                      "text": "Board review · operating performance"
+                    }
+                  ],
                   "display": "Board review · operating performance",
                   "marks": []
                 }
@@ -511,30 +983,65 @@
             },
             {
               "id": "#tboard-body-element",
-              "frame": { "x": 0.07, "y": 0.35, "width": 0.86, "height": 0.52 },
+              "frame": {
+                "x": 0.07,
+                "y": 0.35,
+                "width": 0.86,
+                "height": 0.52
+              },
               "blocks": [
                 {
                   "id": "#tboard-example",
                   "type": "text",
                   "variant": "paragraph",
                   "style": "body",
-                  "atoms": [{ "id": "#tboard-example-a", "kind": "literal", "text": "Performance is stable, but winter resilience depends on approving the accelerated transformer replacement this quarter." }],
+                  "atoms": [
+                    {
+                      "id": "#tboard-example-a",
+                      "kind": "literal",
+                      "text": "Performance is stable, but winter resilience depends on approving the accelerated transformer replacement this quarter."
+                    }
+                  ],
                   "display": "Performance is stable, but winter resilience depends on approving the accelerated transformer replacement this quarter.",
                   "marks": []
                 },
                 {
                   "id": "#tboard-prompt",
                   "type": "prompt",
-                  "atoms": [{ "id": "#tboard-prompt-a", "kind": "literal", "text": "Synthesize the period into three outcomes, two material risks, and the decisions required from the board." }],
+                  "atoms": [
+                    {
+                      "id": "#tboard-prompt-a",
+                      "kind": "literal",
+                      "text": "Synthesize the period into three outcomes, two material risks, and the decisions required from the board."
+                    }
+                  ],
                   "display": "Synthesize the period into three outcomes, two material risks, and the decisions required from the board.",
                   "marks": [],
-                  "scope": { "include": [{ "select": "variable", "name": "board_evidence" }], "exclude": [] },
+                  "scope": {
+                    "include": [
+                      {
+                        "select": "hole",
+                        "name": "board_evidence"
+                      }
+                    ],
+                    "exclude": []
+                  },
                   "state": "idle"
                 }
               ],
               "overflow": "shrink",
               "fromPlaceholder": "body",
-              "format": { "padding": { "x": 18, "y": 16 }, "border": { "color": "--token-color-active-border", "width": 1, "style": "solid" } }
+              "format": {
+                "padding": {
+                  "x": 18,
+                  "y": 16
+                },
+                "border": {
+                  "color": "--token-color-active-border",
+                  "width": 1,
+                  "style": "solid"
+                }
+              }
             }
           ],
           "notes": [
@@ -542,39 +1049,76 @@
               "id": "#tboard-notes",
               "type": "text",
               "variant": "paragraph",
-              "atoms": [{ "id": "#tboard-notes-a", "kind": "literal", "text": "Lead with the decision, then use operating evidence to explain it." }],
+              "atoms": [
+                {
+                  "id": "#tboard-notes-a",
+                  "kind": "literal",
+                  "text": "Lead with the decision, then use operating evidence to explain it."
+                }
+              ],
               "display": "Lead with the decision, then use operating evidence to explain it.",
               "marks": []
             }
           ]
         }
       ],
-      "sections": [{ "id": "#tboard-section", "name": "Board narrative", "firstSlideId": "#tboard-opening" }]
+      "sections": [
+        {
+          "id": "#tboard-section",
+          "name": "Board narrative",
+          "firstSlideId": "#tboard-opening"
+        }
+      ]
     },
-    "variables": [
+    "holes": [
       {
         "name": "board_evidence",
         "label": "Board evidence",
         "description": "The findings, analyses, and project material that ground the board narrative.",
-        "default": { "include": [{ "select": "kinds", "kinds": ["finding", "analysis", "document", "spreadsheet"] }], "exclude": [] }
+        "default": {
+          "include": [
+            {
+              "select": "kinds",
+              "kinds": [
+                "finding",
+                "analysis",
+                "document",
+                "spreadsheet"
+              ]
+            }
+          ],
+          "exclude": []
+        }
       }
     ],
-    "createdBy": { "kind": "user", "userId": "default-user" },
+    "createdBy": {
+      "kind": "user",
+      "userId": "default-user"
+    },
     "revision": 5,
-    "updatedAt": 1787839200000
+    "updatedAt": 1787839200000,
+    "lastUsedAt": 1787752800000
   },
   {
     "_id": "templates:6",
     "_creationTime": 1780704000000,
+    "projectId": "default",
     "userId": "default-user",
     "name": "Field team briefing",
     "description": "A shift-ready briefing for objectives, hazards, controls, and handoffs.",
-    "tags": ["Operations", "Safety", "Briefing"],
+    "tags": [
+      "Operations",
+      "Safety",
+      "Briefing"
+    ],
     "body": {
       "resource": "slides",
       "aspectRatio": "16:9",
       "theme": {
-        "background": { "kind": "color", "color": "--token-surface-primary" },
+        "background": {
+          "kind": "color",
+          "color": "--token-surface-primary"
+        },
         "colors": {
           "text": "--token-ink-primary",
           "accent": "--token-color-attention-fill",
@@ -585,9 +1129,25 @@
       "styles": {
         "defaultKey": "body",
         "styles": {
-          "title": { "name": "Title", "fontSize": 34, "fontWeight": 650, "color": "--token-ink-primary", "lineHeight": 1.05 },
-          "body": { "name": "Body", "fontSize": 19, "color": "--token-ink-secondary", "lineHeight": 1.35 },
-          "warning": { "name": "Warning", "fontSize": 19, "fontWeight": 600, "color": "--token-color-attention-text" }
+          "title": {
+            "name": "Title",
+            "fontSize": 34,
+            "fontWeight": 650,
+            "color": "--token-ink-primary",
+            "lineHeight": 1.05
+          },
+          "body": {
+            "name": "Body",
+            "fontSize": 19,
+            "color": "--token-ink-secondary",
+            "lineHeight": 1.35
+          },
+          "warning": {
+            "name": "Warning",
+            "fontSize": 19,
+            "fontWeight": 600,
+            "color": "--token-color-attention-text"
+          }
         }
       },
       "layouts": [
@@ -596,8 +1156,26 @@
           "name": "Field plan",
           "locked": [],
           "placeholders": [
-            { "role": "title", "frame": { "x": 0.06, "y": 0.08, "width": 0.88, "height": 0.18 }, "styleKey": "title" },
-            { "role": "body", "frame": { "x": 0.06, "y": 0.31, "width": 0.88, "height": 0.59 }, "styleKey": "body" }
+            {
+              "role": "title",
+              "frame": {
+                "x": 0.06,
+                "y": 0.08,
+                "width": 0.88,
+                "height": 0.18
+              },
+              "styleKey": "title"
+            },
+            {
+              "role": "body",
+              "frame": {
+                "x": 0.06,
+                "y": 0.31,
+                "width": 0.88,
+                "height": 0.59
+              },
+              "styleKey": "body"
+            }
           ]
         }
       ],
@@ -608,7 +1186,12 @@
           "elements": [
             {
               "id": "#tfield-title-element",
-              "frame": { "x": 0.06, "y": 0.08, "width": 0.88, "height": 0.18 },
+              "frame": {
+                "x": 0.06,
+                "y": 0.08,
+                "width": 0.88,
+                "height": 0.18
+              },
               "blocks": [
                 {
                   "id": "#tfield-title",
@@ -616,7 +1199,13 @@
                   "variant": "heading",
                   "level": 1,
                   "style": "title",
-                  "atoms": [{ "id": "#tfield-title-a", "kind": "literal", "text": "Today’s objective, controls, and stop conditions" }],
+                  "atoms": [
+                    {
+                      "id": "#tfield-title-a",
+                      "kind": "literal",
+                      "text": "Today’s objective, controls, and stop conditions"
+                    }
+                  ],
                   "display": "Today’s objective, controls, and stop conditions",
                   "marks": []
                 }
@@ -626,61 +1215,121 @@
             },
             {
               "id": "#tfield-body-element",
-              "frame": { "x": 0.06, "y": 0.31, "width": 0.88, "height": 0.59 },
+              "frame": {
+                "x": 0.06,
+                "y": 0.31,
+                "width": 0.88,
+                "height": 0.59
+              },
               "blocks": [
                 {
                   "id": "#tfield-example",
                   "type": "text",
                   "variant": "paragraph",
                   "style": "warning",
-                  "atoms": [{ "id": "#tfield-example-a", "kind": "literal", "text": "Objective: isolate and inspect Transformer Bank 2. Stop work on unexpected pressure, gas, or protection indications." }],
+                  "atoms": [
+                    {
+                      "id": "#tfield-example-a",
+                      "kind": "literal",
+                      "text": "Objective: isolate and inspect Transformer Bank 2. Stop work on unexpected pressure, gas, or protection indications."
+                    }
+                  ],
                   "display": "Objective: isolate and inspect Transformer Bank 2. Stop work on unexpected pressure, gas, or protection indications.",
                   "marks": []
                 },
                 {
                   "id": "#tfield-prompt",
                   "type": "prompt",
-                  "atoms": [{ "id": "#tfield-prompt-a", "kind": "literal", "text": "Turn the work package into a field-ready brief: sequence, hazards, controls, hold points, owners, and handoff criteria." }],
+                  "atoms": [
+                    {
+                      "id": "#tfield-prompt-a",
+                      "kind": "literal",
+                      "text": "Turn the work package into a field-ready brief: sequence, hazards, controls, hold points, owners, and handoff criteria."
+                    }
+                  ],
                   "display": "Turn the work package into a field-ready brief: sequence, hazards, controls, hold points, owners, and handoff criteria.",
                   "marks": [],
-                  "scope": { "include": [{ "select": "variable", "name": "field_record" }], "exclude": [] },
+                  "scope": {
+                    "include": [
+                      {
+                        "select": "hole",
+                        "name": "field_record"
+                      }
+                    ],
+                    "exclude": []
+                  },
                   "state": "idle"
                 }
               ],
               "overflow": "shrink",
               "fromPlaceholder": "body",
-              "format": { "background": "--token-color-attention-surface", "padding": { "x": 18, "y": 16 } }
+              "format": {
+                "background": "--token-color-attention-surface",
+                "padding": {
+                  "x": 18,
+                  "y": 16
+                }
+              }
             }
           ],
           "notes": []
         }
       ],
-      "sections": [{ "id": "#tfield-section", "name": "Shift brief", "firstSlideId": "#tfield-plan" }]
+      "sections": [
+        {
+          "id": "#tfield-section",
+          "name": "Shift brief",
+          "firstSlideId": "#tfield-plan"
+        }
+      ]
     },
-    "variables": [
+    "holes": [
       {
         "name": "field_record",
         "label": "Field work record",
         "description": "The documents and findings the crew needs for this shift.",
-        "default": { "include": [{ "select": "kinds", "kinds": ["document", "finding"] }], "exclude": [] }
+        "default": {
+          "include": [
+            {
+              "select": "kinds",
+              "kinds": [
+                "document",
+                "finding"
+              ]
+            }
+          ],
+          "exclude": []
+        }
       }
     ],
-    "createdBy": { "kind": "user", "userId": "default-user" },
+    "createdBy": {
+      "kind": "user",
+      "userId": "default-user"
+    },
     "revision": 3,
-    "updatedAt": 1786541400000
+    "updatedAt": 1786541400000,
+    "lastUsedAt": 1786455000000
   },
   {
     "_id": "templates:7",
     "_creationTime": 1787234400000,
+    "projectId": "default",
     "userId": "default-user",
     "name": "Executive update",
     "description": "A concise portfolio update that leads with trajectory, exceptions, and asks.",
-    "tags": ["Leadership", "Executive", "Briefing"],
+    "tags": [
+      "Leadership",
+      "Executive",
+      "Briefing"
+    ],
     "body": {
       "resource": "slides",
       "aspectRatio": "16:9",
       "theme": {
-        "background": { "kind": "color", "color": "--token-surface-primary" },
+        "background": {
+          "kind": "color",
+          "color": "--token-surface-primary"
+        },
         "colors": {
           "text": "--token-ink-primary",
           "accent": "--token-color-intelligence-fill",
@@ -691,9 +1340,25 @@
       "styles": {
         "defaultKey": "body",
         "styles": {
-          "kicker": { "name": "Kicker", "fontSize": 12, "fontWeight": 650, "color": "--token-color-intelligence-fill" },
-          "title": { "name": "Title", "fontSize": 36, "fontWeight": 600, "color": "--token-ink-primary", "lineHeight": 1.05 },
-          "body": { "name": "Body", "fontSize": 18, "color": "--token-ink-secondary", "lineHeight": 1.4 }
+          "kicker": {
+            "name": "Kicker",
+            "fontSize": 12,
+            "fontWeight": 650,
+            "color": "--token-color-intelligence-fill"
+          },
+          "title": {
+            "name": "Title",
+            "fontSize": 36,
+            "fontWeight": 600,
+            "color": "--token-ink-primary",
+            "lineHeight": 1.05
+          },
+          "body": {
+            "name": "Body",
+            "fontSize": 18,
+            "color": "--token-ink-secondary",
+            "lineHeight": 1.4
+          }
         }
       },
       "layouts": [
@@ -702,8 +1367,26 @@
           "name": "Executive summary",
           "locked": [],
           "placeholders": [
-            { "role": "title", "frame": { "x": 0.08, "y": 0.1, "width": 0.84, "height": 0.2 }, "styleKey": "title" },
-            { "role": "body", "frame": { "x": 0.08, "y": 0.38, "width": 0.84, "height": 0.48 }, "styleKey": "body" }
+            {
+              "role": "title",
+              "frame": {
+                "x": 0.08,
+                "y": 0.1,
+                "width": 0.84,
+                "height": 0.2
+              },
+              "styleKey": "title"
+            },
+            {
+              "role": "body",
+              "frame": {
+                "x": 0.08,
+                "y": 0.38,
+                "width": 0.84,
+                "height": 0.48
+              },
+              "styleKey": "body"
+            }
           ]
         }
       ],
@@ -714,7 +1397,12 @@
           "elements": [
             {
               "id": "#texec-title-element",
-              "frame": { "x": 0.08, "y": 0.1, "width": 0.84, "height": 0.2 },
+              "frame": {
+                "x": 0.08,
+                "y": 0.1,
+                "width": 0.84,
+                "height": 0.2
+              },
               "blocks": [
                 {
                   "id": "#texec-title",
@@ -722,7 +1410,13 @@
                   "variant": "heading",
                   "level": 1,
                   "style": "title",
-                  "atoms": [{ "id": "#texec-title-a", "kind": "literal", "text": "Portfolio trajectory · decisions this week" }],
+                  "atoms": [
+                    {
+                      "id": "#texec-title-a",
+                      "kind": "literal",
+                      "text": "Portfolio trajectory · decisions this week"
+                    }
+                  ],
                   "display": "Portfolio trajectory · decisions this week",
                   "marks": []
                 }
@@ -732,61 +1426,127 @@
             },
             {
               "id": "#texec-body-element",
-              "frame": { "x": 0.08, "y": 0.38, "width": 0.84, "height": 0.48 },
+              "frame": {
+                "x": 0.08,
+                "y": 0.38,
+                "width": 0.84,
+                "height": 0.48
+              },
               "blocks": [
                 {
                   "id": "#texec-example",
                   "type": "text",
                   "variant": "paragraph",
                   "style": "body",
-                  "atoms": [{ "id": "#texec-example-a", "kind": "literal", "text": "On plan overall · Transformer procurement at risk · Replacement-window approval due Friday" }],
+                  "atoms": [
+                    {
+                      "id": "#texec-example-a",
+                      "kind": "literal",
+                      "text": "On plan overall · Transformer procurement at risk · Replacement-window approval due Friday"
+                    }
+                  ],
                   "display": "On plan overall · Transformer procurement at risk · Replacement-window approval due Friday",
                   "marks": []
                 },
                 {
                   "id": "#texec-prompt",
                   "type": "prompt",
-                  "atoms": [{ "id": "#texec-prompt-a", "kind": "literal", "text": "Summarize trajectory, meaningful changes since the last update, the top two exceptions, and decisions due in the next seven days." }],
+                  "atoms": [
+                    {
+                      "id": "#texec-prompt-a",
+                      "kind": "literal",
+                      "text": "Summarize trajectory, meaningful changes since the last update, the top two exceptions, and decisions due in the next seven days."
+                    }
+                  ],
                   "display": "Summarize trajectory, meaningful changes since the last update, the top two exceptions, and decisions due in the next seven days.",
                   "marks": [],
-                  "scope": { "include": [{ "select": "variable", "name": "portfolio_record" }], "exclude": [] },
+                  "scope": {
+                    "include": [
+                      {
+                        "select": "hole",
+                        "name": "portfolio_record"
+                      }
+                    ],
+                    "exclude": []
+                  },
                   "state": "idle"
                 }
               ],
               "overflow": "shrink",
               "fromPlaceholder": "body",
-              "format": { "padding": { "x": 18, "y": 16 }, "border": { "color": "--token-color-intelligence-border", "width": 1, "style": "solid" } }
+              "format": {
+                "padding": {
+                  "x": 18,
+                  "y": 16
+                },
+                "border": {
+                  "color": "--token-color-intelligence-border",
+                  "width": 1,
+                  "style": "solid"
+                }
+              }
             }
           ],
           "notes": []
         }
       ],
-      "sections": [{ "id": "#texec-section", "name": "Executive summary", "firstSlideId": "#texec-summary" }]
+      "sections": [
+        {
+          "id": "#texec-section",
+          "name": "Executive summary",
+          "firstSlideId": "#texec-summary"
+        }
+      ]
     },
-    "variables": [
+    "holes": [
       {
         "name": "portfolio_record",
         "label": "Portfolio record",
         "description": "The project findings, analyses, and status material that should shape this update.",
-        "default": { "include": [{ "select": "kinds", "kinds": ["finding", "analysis", "document", "spreadsheet"] }], "exclude": [] }
+        "default": {
+          "include": [
+            {
+              "select": "kinds",
+              "kinds": [
+                "finding",
+                "analysis",
+                "document",
+                "spreadsheet"
+              ]
+            }
+          ],
+          "exclude": []
+        }
       }
     ],
-    "createdBy": { "kind": "user", "userId": "default-user" },
+    "createdBy": {
+      "kind": "user",
+      "userId": "default-user"
+    },
     "revision": 2,
-    "updatedAt": 1788528000000
+    "updatedAt": 1788528000000,
+    "lastUsedAt": 1788441600000
   },
   {
     "_id": "templates:8",
     "_creationTime": 1784505600000,
+    "projectId": "default",
     "userId": "default-user",
     "name": "Options assessment",
     "description": "A decision-oriented comparison of viable paths, economics, tradeoffs, and reversibility.",
-    "tags": ["Planning", "Options", "Review"],
+    "tags": [
+      "Planning",
+      "Options",
+      "Review"
+    ],
     "body": {
       "resource": "slides",
       "aspectRatio": "16:9",
       "theme": {
-        "background": { "kind": "color", "color": "--token-surface-primary" },
+        "background": {
+          "kind": "color",
+          "color": "--token-surface-primary"
+        },
         "colors": {
           "text": "--token-ink-primary",
           "accent": "--token-color-accent-2-fill",
@@ -797,9 +1557,25 @@
       "styles": {
         "defaultKey": "body",
         "styles": {
-          "title": { "name": "Title", "fontSize": 34, "fontWeight": 600, "color": "--token-ink-primary", "lineHeight": 1.05 },
-          "body": { "name": "Body", "fontSize": 18, "color": "--token-ink-secondary", "lineHeight": 1.35 },
-          "label": { "name": "Label", "fontSize": 13, "fontWeight": 650, "color": "--token-color-accent-2-fill" }
+          "title": {
+            "name": "Title",
+            "fontSize": 34,
+            "fontWeight": 600,
+            "color": "--token-ink-primary",
+            "lineHeight": 1.05
+          },
+          "body": {
+            "name": "Body",
+            "fontSize": 18,
+            "color": "--token-ink-secondary",
+            "lineHeight": 1.35
+          },
+          "label": {
+            "name": "Label",
+            "fontSize": 13,
+            "fontWeight": 650,
+            "color": "--token-color-accent-2-fill"
+          }
         }
       },
       "layouts": [
@@ -808,8 +1584,26 @@
           "name": "Option frame",
           "locked": [],
           "placeholders": [
-            { "role": "title", "frame": { "x": 0.07, "y": 0.08, "width": 0.86, "height": 0.18 }, "styleKey": "title" },
-            { "role": "body", "frame": { "x": 0.07, "y": 0.33, "width": 0.86, "height": 0.57 }, "styleKey": "body" }
+            {
+              "role": "title",
+              "frame": {
+                "x": 0.07,
+                "y": 0.08,
+                "width": 0.86,
+                "height": 0.18
+              },
+              "styleKey": "title"
+            },
+            {
+              "role": "body",
+              "frame": {
+                "x": 0.07,
+                "y": 0.33,
+                "width": 0.86,
+                "height": 0.57
+              },
+              "styleKey": "body"
+            }
           ]
         }
       ],
@@ -820,7 +1614,12 @@
           "elements": [
             {
               "id": "#toptions-title-element",
-              "frame": { "x": 0.07, "y": 0.08, "width": 0.86, "height": 0.18 },
+              "frame": {
+                "x": 0.07,
+                "y": 0.08,
+                "width": 0.86,
+                "height": 0.18
+              },
               "blocks": [
                 {
                   "id": "#toptions-title",
@@ -828,7 +1627,13 @@
                   "variant": "heading",
                   "level": 1,
                   "style": "title",
-                  "atoms": [{ "id": "#toptions-title-a", "kind": "literal", "text": "Options assessment · choose a path" }],
+                  "atoms": [
+                    {
+                      "id": "#toptions-title-a",
+                      "kind": "literal",
+                      "text": "Options assessment · choose a path"
+                    }
+                  ],
                   "display": "Options assessment · choose a path",
                   "marks": []
                 }
@@ -838,24 +1643,49 @@
             },
             {
               "id": "#toptions-body-element",
-              "frame": { "x": 0.07, "y": 0.33, "width": 0.86, "height": 0.57 },
+              "frame": {
+                "x": 0.07,
+                "y": 0.33,
+                "width": 0.86,
+                "height": 0.57
+              },
               "blocks": [
                 {
                   "id": "#toptions-evidence-example",
                   "type": "text",
                   "variant": "paragraph",
                   "style": "body",
-                  "atoms": [{ "id": "#toptions-evidence-example-a", "kind": "literal", "text": "Viable paths: covered conductor, selective undergrounding, and targeted rebuild." }],
+                  "atoms": [
+                    {
+                      "id": "#toptions-evidence-example-a",
+                      "kind": "literal",
+                      "text": "Viable paths: covered conductor, selective undergrounding, and targeted rebuild."
+                    }
+                  ],
                   "display": "Viable paths: covered conductor, selective undergrounding, and targeted rebuild.",
                   "marks": []
                 },
                 {
                   "id": "#toptions-evidence-prompt",
                   "type": "prompt",
-                  "atoms": [{ "id": "#toptions-evidence-a", "kind": "literal", "text": "Frame the viable options against outcomes, delivery risk, constraints, and reversibility." }],
+                  "atoms": [
+                    {
+                      "id": "#toptions-evidence-a",
+                      "kind": "literal",
+                      "text": "Frame the viable options against outcomes, delivery risk, constraints, and reversibility."
+                    }
+                  ],
                   "display": "Frame the viable options against outcomes, delivery risk, constraints, and reversibility.",
                   "marks": [],
-                  "scope": { "include": [{ "select": "variable", "name": "option_evidence" }], "exclude": [] },
+                  "scope": {
+                    "include": [
+                      {
+                        "select": "hole",
+                        "name": "option_evidence"
+                      }
+                    ],
+                    "exclude": []
+                  },
                   "state": "idle"
                 },
                 {
@@ -863,159 +1693,603 @@
                   "type": "text",
                   "variant": "paragraph",
                   "style": "body",
-                  "atoms": [{ "id": "#toptions-model-example-a", "kind": "literal", "text": "Decision lens: lifecycle cost, delivery sensitivity, risk reduction, and reversibility." }],
+                  "atoms": [
+                    {
+                      "id": "#toptions-model-example-a",
+                      "kind": "literal",
+                      "text": "Decision lens: lifecycle cost, delivery sensitivity, risk reduction, and reversibility."
+                    }
+                  ],
                   "display": "Decision lens: lifecycle cost, delivery sensitivity, risk reduction, and reversibility.",
                   "marks": []
                 },
                 {
                   "id": "#toptions-model-prompt",
                   "type": "prompt",
-                  "atoms": [{ "id": "#toptions-model-a", "kind": "literal", "text": "Compare lifecycle cost, schedule sensitivity, and the assumptions that could reverse the recommendation." }],
+                  "atoms": [
+                    {
+                      "id": "#toptions-model-a",
+                      "kind": "literal",
+                      "text": "Compare lifecycle cost, schedule sensitivity, and the assumptions that could reverse the recommendation."
+                    }
+                  ],
                   "display": "Compare lifecycle cost, schedule sensitivity, and the assumptions that could reverse the recommendation.",
                   "marks": [],
-                  "scope": { "include": [{ "select": "variable", "name": "option_models" }], "exclude": [] },
+                  "scope": {
+                    "include": [
+                      {
+                        "select": "hole",
+                        "name": "option_models"
+                      }
+                    ],
+                    "exclude": []
+                  },
                   "state": "idle"
                 }
               ],
               "overflow": "shrink",
               "fromPlaceholder": "body",
-              "format": { "padding": { "x": 18, "y": 16 }, "border": { "color": "--token-color-active-border", "width": 1, "style": "solid" } }
+              "format": {
+                "padding": {
+                  "x": 18,
+                  "y": 16
+                },
+                "border": {
+                  "color": "--token-color-active-border",
+                  "width": 1,
+                  "style": "solid"
+                }
+              }
             }
           ],
           "notes": []
         }
       ],
-      "sections": [{ "id": "#toptions-section", "name": "Assessment", "firstSlideId": "#toptions-frame" }]
+      "sections": [
+        {
+          "id": "#toptions-section",
+          "name": "Assessment",
+          "firstSlideId": "#toptions-frame"
+        }
+      ]
     },
-    "variables": [
+    "holes": [
       {
         "name": "option_evidence",
         "label": "Option evidence",
         "description": "The findings and documents that establish feasible choices and constraints.",
-        "default": { "include": [{ "select": "kinds", "kinds": ["finding", "document"] }], "exclude": [] }
+        "default": {
+          "include": [
+            {
+              "select": "kinds",
+              "kinds": [
+                "finding",
+                "document"
+              ]
+            }
+          ],
+          "exclude": []
+        }
       },
       {
         "name": "option_models",
         "label": "Option models",
         "description": "The analyses and spreadsheets that quantify economics and sensitivity.",
-        "default": { "include": [{ "select": "kinds", "kinds": ["analysis", "spreadsheet"] }], "exclude": [] }
+        "default": {
+          "include": [
+            {
+              "select": "kinds",
+              "kinds": [
+                "analysis",
+                "spreadsheet"
+              ]
+            }
+          ],
+          "exclude": []
+        }
       }
     ],
-    "createdBy": { "kind": "user", "userId": "default-user" },
+    "createdBy": {
+      "kind": "user",
+      "userId": "default-user"
+    },
     "revision": 4,
-    "updatedAt": 1785585600000
+    "updatedAt": 1785585600000,
+    "lastUsedAt": 1785499200000
   },
   {
-    "_id": "templates:9",
-    "_creationTime": 1780358400000,
+    "_id": "templates:11",
+    "_creationTime": 1788000000000,
+    "projectId": "default",
     "userId": "default-user",
-    "name": "Outage analysis workbook",
-    "description": "A ready-to-calculate reliability workbook for outage duration, customers affected, and customer-minutes interrupted.",
-    "tags": ["Operations", "Analysis", "Reliability"],
+    "name": "Section divider",
+    "description": "One slide that opens a section: a large title over a one-line lead.",
+    "tags": [
+      "Presentation",
+      "Brand"
+    ],
     "body": {
-      "resource": "spreadsheet",
-      "cells": {
-        "A1": { "value": { "kind": "text", "value": "Outage analysis" }, "merge": "F1", "format": { "background": "--token-color-intelligence-surface", "padding": { "x": 10, "y": 8 } } },
-        "A3": { "value": { "kind": "text", "value": "Event" }, "format": { "background": "--token-surface-secondary" } },
-        "B3": { "value": { "kind": "text", "value": "Start" }, "format": { "background": "--token-surface-secondary" } },
-        "C3": { "value": { "kind": "text", "value": "End" }, "format": { "background": "--token-surface-secondary" } },
-        "D3": { "value": { "kind": "text", "value": "Minutes" }, "format": { "background": "--token-surface-secondary" } },
-        "E3": { "value": { "kind": "text", "value": "Customers" }, "format": { "background": "--token-surface-secondary" } },
-        "F3": { "value": { "kind": "text", "value": "Customer-minutes" }, "format": { "background": "--token-surface-secondary" } },
-        "A4": { "value": { "kind": "text", "value": "Feeder event 01" } },
-        "B4": { "value": { "kind": "text", "value": "08:12" } },
-        "C4": { "value": { "kind": "text", "value": "09:07" } },
-        "D4": { "value": { "kind": "number", "value": 55 }, "format": { "valueFormat": "0" } },
-        "E4": { "value": { "kind": "number", "value": 1240 }, "format": { "valueFormat": "#,##0" } },
-        "F4": { "expression": "D4*E4", "format": { "valueFormat": "#,##0" } },
-        "A6": { "value": { "kind": "text", "value": "Total customer-minutes" } },
-        "F6": { "expression": "SUM(F4:F5)", "format": { "valueFormat": "#,##0" } }
-      },
-      "columnWidths": { "A": 180, "B": 100, "C": 100, "D": 100, "E": 120, "F": 150 },
-      "rowHeights": { "1": 38, "3": 30 },
-      "formatRules": [
-        { "from": "A3", "to": "F3", "style": "header", "format": { "background": "--token-surface-secondary", "border": { "color": "--token-color-active-border", "width": 1, "style": "solid" } } },
-        { "from": "F4", "to": "F20", "format": { "background": "--token-color-intelligence-surface" } }
-      ],
-      "frozenRows": 3,
-      "frozenColumns": 1,
-      "print": {
-        "page": { "paper": "letter", "orientation": "landscape", "margins": { "top": 0.5, "right": 0.5, "bottom": 0.5, "left": 0.5 } },
-        "area": { "from": "A1", "to": "F20" },
-        "repeatRows": "1:3",
-        "scale": "fit-width",
-        "gridlines": false,
-        "headings": false
+      "resource": "slides",
+      "aspectRatio": "16:9",
+      "theme": {
+        "background": {
+          "kind": "color",
+          "color": "--token-surface-primary"
+        },
+        "colors": {
+          "text": "--token-ink-primary",
+          "accent": "--token-color-accent-1-fill",
+          "muted": "--token-ink-muted"
+        },
+        "fontFamily": "IBM Plex Sans"
       },
       "styles": {
         "defaultKey": "body",
         "styles": {
-          "body": { "name": "Body", "fontFamily": "IBM Plex Sans", "fontSize": 12, "color": "--token-ink-primary" },
-          "header": { "name": "Header", "fontFamily": "IBM Plex Sans", "fontSize": 11, "fontWeight": 650, "color": "--token-ink-primary" }
+          "title": {
+            "name": "Title",
+            "fontSize": 40,
+            "fontWeight": 650,
+            "color": "--token-ink-primary",
+            "lineHeight": 1.05
+          },
+          "body": {
+            "name": "Body",
+            "fontSize": 20,
+            "color": "--token-ink-secondary",
+            "lineHeight": 1.35
+          }
+        }
+      },
+      "layouts": [
+        {
+          "id": "#tdiv-layout",
+          "key": "section-divider",
+          "name": "Section divider",
+          "locked": [],
+          "placeholders": [
+            {
+              "role": "title",
+              "frame": {
+                "x": 0.08,
+                "y": 0.34,
+                "width": 0.84,
+                "height": 0.2
+              },
+              "styleKey": "title"
+            },
+            {
+              "role": "lead",
+              "frame": {
+                "x": 0.08,
+                "y": 0.56,
+                "width": 0.84,
+                "height": 0.12
+              },
+              "styleKey": "body"
+            }
+          ]
+        }
+      ],
+      "slides": [
+        {
+          "id": "#tdiv-slide",
+          "layoutKey": "section-divider",
+          "elements": [
+            {
+              "id": "#tdiv-title-element",
+              "frame": {
+                "x": 0.08,
+                "y": 0.34,
+                "width": 0.84,
+                "height": 0.2
+              },
+              "overflow": "shrink",
+              "fromPlaceholder": "title",
+              "content": {
+                "type": "text",
+                "block": {
+                  "id": "#tdiv-title",
+                  "type": "text",
+                  "variant": "heading",
+                  "level": 1,
+                  "style": "title",
+                  "atoms": [
+                    {
+                      "id": "#tdiv-title-a",
+                      "kind": "literal",
+                      "text": "Section title"
+                    }
+                  ],
+                  "display": "Section title",
+                  "marks": []
+                }
+              }
+            },
+            {
+              "id": "#tdiv-lead-element",
+              "frame": {
+                "x": 0.08,
+                "y": 0.56,
+                "width": 0.84,
+                "height": 0.12
+              },
+              "overflow": "shrink",
+              "fromPlaceholder": "lead",
+              "content": {
+                "type": "text",
+                "block": {
+                  "id": "#tdiv-lead",
+                  "type": "text",
+                  "variant": "paragraph",
+                  "style": "body",
+                  "atoms": [
+                    {
+                      "id": "#tdiv-lead-a",
+                      "kind": "literal",
+                      "text": "One line on what this section settles."
+                    }
+                  ],
+                  "display": "One line on what this section settles.",
+                  "marks": []
+                }
+              }
+            }
+          ],
+          "notes": []
+        }
+      ],
+      "sections": []
+    },
+    "holes": [],
+    "createdBy": {
+      "kind": "user",
+      "userId": "default-user"
+    },
+    "revision": 1,
+    "updatedAt": 1788000000000
+  },
+  {
+    "_id": "templates:9",
+    "_creationTime": 1788000000000,
+    "projectId": "default",
+    "userId": "users:1",
+    "name": "Client status note",
+    "description": "A short note to one client about where their work stands.",
+    "tags": [
+      "Operations",
+      "Reporting"
+    ],
+    "body": {
+      "resource": "document",
+      "rows": [
+        {
+          "id": "#csn-row-title",
+          "kind": "blocks",
+          "blocks": [
+            {
+              "id": "#csn-title",
+              "type": "text",
+              "variant": "heading",
+              "level": 1,
+              "style": "title",
+              "atoms": [
+                {
+                  "id": "#csn-title-a",
+                  "kind": "literal",
+                  "text": "Status for "
+                },
+                {
+                  "id": "#csn-title-b",
+                  "kind": "template",
+                  "name": "client_name"
+                }
+              ],
+              "display": "Status for {client_name}",
+              "marks": []
+            }
+          ]
+        },
+        {
+          "id": "#csn-row-period",
+          "kind": "blocks",
+          "blocks": [
+            {
+              "id": "#csn-period",
+              "type": "text",
+              "variant": "paragraph",
+              "atoms": [
+                {
+                  "id": "#csn-period-a",
+                  "kind": "literal",
+                  "text": "Covering "
+                },
+                {
+                  "id": "#csn-period-b",
+                  "kind": "template",
+                  "name": "reporting_period"
+                },
+                {
+                  "id": "#csn-period-c",
+                  "kind": "literal",
+                  "text": "."
+                }
+              ],
+              "display": "Covering {reporting_period}.",
+              "marks": []
+            }
+          ]
+        },
+        {
+          "id": "#csn-row-prompt",
+          "kind": "blocks",
+          "blocks": [
+            {
+              "id": "#csn-prompt",
+              "type": "prompt",
+              "atoms": [
+                {
+                  "id": "#csn-prompt-a",
+                  "kind": "literal",
+                  "text": "Write three paragraphs for "
+                },
+                {
+                  "id": "#csn-prompt-b",
+                  "kind": "template",
+                  "name": "client_name"
+                },
+                {
+                  "id": "#csn-prompt-c",
+                  "kind": "literal",
+                  "text": " on what moved, what is blocked, and what happens next."
+                }
+              ],
+              "display": "Write three paragraphs for {client_name} on what moved, what is blocked, and what happens next.",
+              "marks": [],
+              "scope": {
+                "include": [
+                  {
+                    "select": "hole",
+                    "name": "status_evidence"
+                  }
+                ],
+                "exclude": []
+              },
+              "state": "idle"
+            }
+          ]
+        }
+      ]
+    },
+    "holes": [
+      {
+        "name": "client_name",
+        "label": "Client name",
+        "description": "Who this note is addressed to, exactly as they should see it.",
+        "kind": "text"
+      },
+      {
+        "name": "reporting_period",
+        "label": "Reporting period",
+        "description": "The window this note covers, in whatever words the client uses.",
+        "kind": "text",
+        "text": "the last four weeks"
+      },
+      {
+        "name": "status_evidence",
+        "label": "Status evidence",
+        "description": "The findings and documents this note should be written from.",
+        "default": {
+          "include": [
+            {
+              "select": "kinds",
+              "kinds": [
+                "finding"
+              ]
+            }
+          ],
+          "exclude": []
         }
       }
+    ],
+    "createdBy": {
+      "kind": "user",
+      "userId": "users:1"
     },
-    "variables": [],
-    "createdBy": { "kind": "user", "userId": "default-user" },
-    "revision": 3,
-    "updatedAt": 1784385000000
+    "revision": 1,
+    "updatedAt": 1788000000000
   },
   {
     "_id": "templates:10",
-    "_creationTime": 1779840000000,
-    "userId": "default-user",
-    "name": "Hardening cost model",
-    "description": "A transparent option model for unit cost, contingency, total investment, and annualized benefit.",
-    "tags": ["Finance", "Planning", "Model"],
+    "_creationTime": 1788000000000,
+    "projectId": "default",
+    "userId": "users:1",
+    "name": "Incident one-pager",
+    "description": "One page on a single incident: what happened, what it cost, what changes.",
+    "tags": [
+      "Operations",
+      "Reliability"
+    ],
     "body": {
-      "resource": "spreadsheet",
-      "cells": {
-        "A1": { "value": { "kind": "text", "value": "Hardening cost model" }, "merge": "E1", "format": { "background": "--token-color-accent-2-surface", "padding": { "x": 10, "y": 8 } } },
-        "A3": { "value": { "kind": "text", "value": "Option" }, "format": { "background": "--token-surface-secondary" } },
-        "B3": { "value": { "kind": "text", "value": "Units" }, "format": { "background": "--token-surface-secondary" } },
-        "C3": { "value": { "kind": "text", "value": "Unit cost" }, "format": { "background": "--token-surface-secondary" } },
-        "D3": { "value": { "kind": "text", "value": "Contingency" }, "format": { "background": "--token-surface-secondary" } },
-        "E3": { "value": { "kind": "text", "value": "Total" }, "format": { "background": "--token-surface-secondary" } },
-        "A4": { "value": { "kind": "text", "value": "Covered conductor" } },
-        "B4": { "value": { "kind": "number", "value": 18 }, "format": { "valueFormat": "0" } },
-        "C4": { "value": { "kind": "number", "value": 142000 }, "format": { "valueFormat": "$#,##0" } },
-        "D4": { "value": { "kind": "number", "value": 0.15 }, "format": { "valueFormat": "0%" } },
-        "E4": { "expression": "B4*C4*(1+D4)", "format": { "valueFormat": "$#,##0" } },
-        "A5": { "value": { "kind": "text", "value": "Underground segment" } },
-        "B5": { "value": { "kind": "number", "value": 4 }, "format": { "valueFormat": "0" } },
-        "C5": { "value": { "kind": "number", "value": 890000 }, "format": { "valueFormat": "$#,##0" } },
-        "D5": { "value": { "kind": "number", "value": 0.2 }, "format": { "valueFormat": "0%" } },
-        "E5": { "expression": "B5*C5*(1+D5)", "format": { "valueFormat": "$#,##0" } },
-        "A7": { "value": { "kind": "text", "value": "Portfolio total" } },
-        "E7": { "expression": "SUM(E4:E6)", "format": { "valueFormat": "$#,##0", "background": "--token-color-accent-2-surface" } }
+      "resource": "document",
+      "rows": [
+        {
+          "id": "#iop-row-title",
+          "kind": "blocks",
+          "blocks": [
+            {
+              "id": "#iop-title",
+              "type": "text",
+              "variant": "heading",
+              "level": 1,
+              "style": "title",
+              "atoms": [
+                {
+                  "id": "#iop-title-a",
+                  "kind": "template",
+                  "name": "incident_title"
+                }
+              ],
+              "display": "{incident_title}",
+              "marks": []
+            }
+          ]
+        },
+        {
+          "id": "#iop-row-what",
+          "kind": "blocks",
+          "blocks": [
+            {
+              "id": "#iop-what",
+              "type": "text",
+              "variant": "heading",
+              "level": 2,
+              "style": "heading",
+              "atoms": [
+                {
+                  "id": "#iop-what-a",
+                  "kind": "literal",
+                  "text": "What happened"
+                }
+              ],
+              "display": "What happened",
+              "marks": []
+            }
+          ]
+        },
+        {
+          "id": "#iop-row-what-prompt",
+          "kind": "blocks",
+          "blocks": [
+            {
+              "id": "#iop-what-prompt",
+              "type": "prompt",
+              "atoms": [
+                {
+                  "id": "#iop-what-prompt-a",
+                  "kind": "literal",
+                  "text": "Give the sequence of events, with times, in one paragraph."
+                }
+              ],
+              "display": "Give the sequence of events, with times, in one paragraph.",
+              "marks": [],
+              "scope": {
+                "include": [
+                  {
+                    "select": "hole",
+                    "name": "incident_record"
+                  }
+                ],
+                "exclude": []
+              },
+              "state": "idle"
+            }
+          ]
+        },
+        {
+          "id": "#iop-row-cost",
+          "kind": "blocks",
+          "blocks": [
+            {
+              "id": "#iop-cost",
+              "type": "text",
+              "variant": "heading",
+              "level": 2,
+              "style": "heading",
+              "atoms": [
+                {
+                  "id": "#iop-cost-a",
+                  "kind": "literal",
+                  "text": "What it cost"
+                }
+              ],
+              "display": "What it cost",
+              "marks": []
+            }
+          ]
+        },
+        {
+          "id": "#iop-row-cost-prompt",
+          "kind": "blocks",
+          "blocks": [
+            {
+              "id": "#iop-cost-prompt",
+              "type": "prompt",
+              "atoms": [
+                {
+                  "id": "#iop-cost-prompt-a",
+                  "kind": "literal",
+                  "text": "State the cost, and say which assumption it turns on."
+                }
+              ],
+              "display": "State the cost, and say which assumption it turns on.",
+              "marks": [],
+              "scope": {
+                "include": [
+                  {
+                    "select": "hole",
+                    "name": "cost_models"
+                  }
+                ],
+                "exclude": []
+              },
+              "state": "idle"
+            }
+          ]
+        }
+      ]
+    },
+    "holes": [
+      {
+        "name": "incident_title",
+        "label": "Incident title",
+        "description": "The name this incident is known by, as it should head the page.",
+        "kind": "text"
       },
-      "columnWidths": { "A": 210, "B": 90, "C": 120, "D": 110, "E": 150 },
-      "rowHeights": { "1": 38, "3": 30 },
-      "formatRules": [
-        { "from": "A3", "to": "E3", "style": "header", "format": { "background": "--token-surface-secondary", "border": { "color": "--token-color-active-border", "width": 1, "style": "solid" } } },
-        { "from": "E4", "to": "E20", "format": { "background": "--token-color-accent-2-surface" } }
-      ],
-      "frozenRows": 3,
-      "frozenColumns": 1,
-      "print": {
-        "page": { "paper": "letter", "orientation": "landscape", "margins": { "top": 0.5, "right": 0.5, "bottom": 0.5, "left": 0.5 } },
-        "area": { "from": "A1", "to": "E20" },
-        "repeatRows": "1:3",
-        "scale": "fit-width",
-        "gridlines": false,
-        "headings": false
+      {
+        "name": "incident_record",
+        "label": "Incident record",
+        "description": "Everything the write-up should be grounded in.",
+        "default": {
+          "include": [
+            {
+              "select": "kinds",
+              "kinds": [
+                "finding"
+              ]
+            },
+            {
+              "select": "kinds",
+              "kinds": [
+                "document"
+              ]
+            }
+          ],
+          "exclude": []
+        }
       },
-      "styles": {
-        "defaultKey": "body",
-        "styles": {
-          "body": { "name": "Body", "fontFamily": "IBM Plex Sans", "fontSize": 12, "color": "--token-ink-primary" },
-          "header": { "name": "Header", "fontFamily": "IBM Plex Sans", "fontSize": 11, "fontWeight": 650, "color": "--token-ink-primary" }
+      {
+        "name": "cost_models",
+        "label": "Cost models",
+        "description": "The spreadsheets that put a number on it.",
+        "default": {
+          "include": [
+            {
+              "select": "kinds",
+              "kinds": [
+                "spreadsheet"
+              ]
+            }
+          ],
+          "exclude": []
         }
       }
+    ],
+    "createdBy": {
+      "kind": "user",
+      "userId": "users:1"
     },
-    "variables": [],
-    "createdBy": { "kind": "user", "userId": "default-user" },
-    "revision": 5,
-    "updatedAt": 1782306000000
+    "revision": 1,
+    "updatedAt": 1788000000000
   }
 ]
~~~~

### changed · `seed/templateVersions.json` (+518 / −22)

~~~~diff
@@ -107,7 +107,7 @@
               "scope": {
                 "include": [
                   {
-                    "select": "variable",
+                    "select": "hole",
                     "name": "incident_evidence"
                   }
                 ],
@@ -164,7 +164,7 @@
         }
       ]
     },
-    "variables": [
+    "holes": [
       {
         "name": "incident_evidence",
         "label": "Incident evidence",
@@ -296,7 +296,7 @@
               "scope": {
                 "include": [
                   {
-                    "select": "variable",
+                    "select": "hole",
                     "name": "readiness_record"
                   }
                 ],
@@ -345,7 +345,7 @@
               "scope": {
                 "include": [
                   {
-                    "select": "variable",
+                    "select": "hole",
                     "name": "supporting_findings"
                   }
                 ],
@@ -361,7 +361,7 @@
         }
       ]
     },
-    "variables": [
+    "holes": [
       {
         "name": "readiness_record",
         "label": "Readiness record",
@@ -459,9 +459,19 @@
                   "id": "#ttg-title-a",
                   "kind": "literal",
                   "text": "Technical glossary"
+                },
+                {
+                  "id": "#ttg-title-sep",
+                  "kind": "literal",
+                  "text": " · "
+                },
+                {
+                  "id": "#ttg-title-subject",
+                  "kind": "template",
+                  "name": "subject_line"
                 }
               ],
-              "display": "Technical glossary",
+              "display": "Technical glossary · {subject_line}",
               "marks": []
             }
           ]
@@ -542,7 +552,7 @@
               "scope": {
                 "include": [
                   {
-                    "select": "variable",
+                    "select": "hole",
                     "name": "source_material"
                   }
                 ],
@@ -554,7 +564,7 @@
         }
       ]
     },
-    "variables": [
+    "holes": [
       {
         "name": "source_material",
         "label": "Source material",
@@ -571,6 +581,12 @@
           ],
           "exclude": []
         }
+      },
+      {
+        "name": "subject_line",
+        "label": "Subject line",
+        "description": "The one line at the top that says what this glossary covers.",
+        "kind": "text"
       }
     ],
     "at": 1787244300000
@@ -690,7 +706,7 @@
               "scope": {
                 "include": [
                   {
-                    "select": "variable",
+                    "select": "hole",
                     "name": "decision_evidence"
                   }
                 ],
@@ -739,7 +755,7 @@
               "scope": {
                 "include": [
                   {
-                    "select": "variable",
+                    "select": "hole",
                     "name": "cost_models"
                   }
                 ],
@@ -787,7 +803,7 @@
         }
       ]
     },
-    "variables": [
+    "holes": [
       {
         "name": "decision_evidence",
         "label": "Decision evidence",
@@ -984,7 +1000,7 @@
                   "scope": {
                     "include": [
                       {
-                        "select": "variable",
+                        "select": "hole",
                         "name": "board_evidence"
                       }
                     ],
@@ -1034,7 +1050,7 @@
         }
       ]
     },
-    "variables": [
+    "holes": [
       {
         "name": "board_evidence",
         "label": "Board evidence",
@@ -1210,7 +1226,7 @@
                   "scope": {
                     "include": [
                       {
-                        "select": "variable",
+                        "select": "hole",
                         "name": "field_record"
                       }
                     ],
@@ -1241,7 +1257,7 @@
         }
       ]
     },
-    "variables": [
+    "holes": [
       {
         "name": "field_record",
         "label": "Field work record",
@@ -1415,7 +1431,7 @@
                   "scope": {
                     "include": [
                       {
-                        "select": "variable",
+                        "select": "hole",
                         "name": "portfolio_record"
                       }
                     ],
@@ -1450,7 +1466,7 @@
         }
       ]
     },
-    "variables": [
+    "holes": [
       {
         "name": "portfolio_record",
         "label": "Portfolio record",
@@ -1626,7 +1642,7 @@
                   "scope": {
                     "include": [
                       {
-                        "select": "variable",
+                        "select": "hole",
                         "name": "option_evidence"
                       }
                     ],
@@ -1664,7 +1680,7 @@
                   "scope": {
                     "include": [
                       {
-                        "select": "variable",
+                        "select": "hole",
                         "name": "option_models"
                       }
                     ],
@@ -1699,7 +1715,7 @@
         }
       ]
     },
-    "variables": [
+    "holes": [
       {
         "name": "option_evidence",
         "label": "Option evidence",
@@ -1950,7 +1966,7 @@
         }
       }
     },
-    "variables": [],
+    "holes": [],
     "at": 1784385000000
   },
   {
@@ -2193,7 +2209,487 @@
         }
       }
     },
-    "variables": [],
+    "holes": [],
     "at": 1782306000000
+  },
+  {
+    "_id": "templateVersions:11",
+    "_creationTime": 1788000000000,
+    "templateId": "templates:11",
+    "revision": 1,
+    "name": "Section divider",
+    "description": "One slide that opens a section: a large title over a one-line lead.",
+    "tags": [
+      "Presentation",
+      "Brand"
+    ],
+    "body": {
+      "resource": "slides",
+      "aspectRatio": "16:9",
+      "theme": {
+        "background": {
+          "kind": "color",
+          "color": "--token-surface-primary"
+        },
+        "colors": {
+          "text": "--token-ink-primary",
+          "accent": "--token-color-accent-1-fill",
+          "muted": "--token-ink-muted"
+        },
+        "fontFamily": "IBM Plex Sans"
+      },
+      "styles": {
+        "defaultKey": "body",
+        "styles": {
+          "title": {
+            "name": "Title",
+            "fontSize": 40,
+            "fontWeight": 650,
+            "color": "--token-ink-primary",
+            "lineHeight": 1.05
+          },
+          "body": {
+            "name": "Body",
+            "fontSize": 20,
+            "color": "--token-ink-secondary",
+            "lineHeight": 1.35
+          }
+        }
+      },
+      "layouts": [
+        {
+          "id": "#tdiv-layout",
+          "key": "section-divider",
+          "name": "Section divider",
+          "locked": [],
+          "placeholders": [
+            {
+              "role": "title",
+              "frame": {
+                "x": 0.08,
+                "y": 0.34,
+                "width": 0.84,
+                "height": 0.2
+              },
+              "styleKey": "title"
+            },
+            {
+              "role": "lead",
+              "frame": {
+                "x": 0.08,
+                "y": 0.56,
+                "width": 0.84,
+                "height": 0.12
+              },
+              "styleKey": "body"
+            }
+          ]
+        }
+      ],
+      "slides": [
+        {
+          "id": "#tdiv-slide",
+          "layoutKey": "section-divider",
+          "elements": [
+            {
+              "id": "#tdiv-title-element",
+              "frame": {
+                "x": 0.08,
+                "y": 0.34,
+                "width": 0.84,
+                "height": 0.2
+              },
+              "overflow": "shrink",
+              "fromPlaceholder": "title",
+              "content": {
+                "type": "text",
+                "block": {
+                  "id": "#tdiv-title",
+                  "type": "text",
+                  "variant": "heading",
+                  "level": 1,
+                  "style": "title",
+                  "atoms": [
+                    {
+                      "id": "#tdiv-title-a",
+                      "kind": "literal",
+                      "text": "Section title"
+                    }
+                  ],
+                  "display": "Section title",
+                  "marks": []
+                }
+              }
+            },
+            {
+              "id": "#tdiv-lead-element",
+              "frame": {
+                "x": 0.08,
+                "y": 0.56,
+                "width": 0.84,
+                "height": 0.12
+              },
+              "overflow": "shrink",
+              "fromPlaceholder": "lead",
+              "content": {
+                "type": "text",
+                "block": {
+                  "id": "#tdiv-lead",
+                  "type": "text",
+                  "variant": "paragraph",
+                  "style": "body",
+                  "atoms": [
+                    {
+                      "id": "#tdiv-lead-a",
+                      "kind": "literal",
+                      "text": "One line on what this section settles."
+                    }
+                  ],
+                  "display": "One line on what this section settles.",
+                  "marks": []
+                }
+              }
+            }
+          ],
+          "notes": []
+        }
+      ],
+      "sections": []
+    },
+    "holes": [],
+    "at": 1788000000000
+  },
+  {
+    "_id": "templateVersions:9-1",
+    "_creationTime": 1788000000000,
+    "templateId": "templates:9",
+    "revision": 1,
+    "name": "Client status note",
+    "description": "A short note to one client about where their work stands.",
+    "tags": [
+      "Operations",
+      "Reporting"
+    ],
+    "body": {
+      "resource": "document",
+      "rows": [
+        {
+          "id": "#csn-row-title",
+          "kind": "blocks",
+          "blocks": [
+            {
+              "id": "#csn-title",
+              "type": "text",
+              "variant": "heading",
+              "level": 1,
+              "style": "title",
+              "atoms": [
+                {
+                  "id": "#csn-title-a",
+                  "kind": "literal",
+                  "text": "Status for "
+                },
+                {
+                  "id": "#csn-title-b",
+                  "kind": "template",
+                  "name": "client_name"
+                }
+              ],
+              "display": "Status for {client_name}",
+              "marks": []
+            }
+          ]
+        },
+        {
+          "id": "#csn-row-period",
+          "kind": "blocks",
+          "blocks": [
+            {
+              "id": "#csn-period",
+              "type": "text",
+              "variant": "paragraph",
+              "atoms": [
+                {
+                  "id": "#csn-period-a",
+                  "kind": "literal",
+                  "text": "Covering "
+                },
+                {
+                  "id": "#csn-period-b",
+                  "kind": "template",
+                  "name": "reporting_period"
+                },
+                {
+                  "id": "#csn-period-c",
+                  "kind": "literal",
+                  "text": "."
+                }
+              ],
+              "display": "Covering {reporting_period}.",
+              "marks": []
+            }
+          ]
+        },
+        {
+          "id": "#csn-row-prompt",
+          "kind": "blocks",
+          "blocks": [
+            {
+              "id": "#csn-prompt",
+              "type": "prompt",
+              "atoms": [
+                {
+                  "id": "#csn-prompt-a",
+                  "kind": "literal",
+                  "text": "Write three paragraphs for "
+                },
+                {
+                  "id": "#csn-prompt-b",
+                  "kind": "template",
+                  "name": "client_name"
+                },
+                {
+                  "id": "#csn-prompt-c",
+                  "kind": "literal",
+                  "text": " on what moved, what is blocked, and what happens next."
+                }
+              ],
+              "display": "Write three paragraphs for {client_name} on what moved, what is blocked, and what happens next.",
+              "marks": [],
+              "scope": {
+                "include": [
+                  {
+                    "select": "hole",
+                    "name": "status_evidence"
+                  }
+                ],
+                "exclude": []
+              },
+              "state": "idle"
+            }
+          ]
+        }
+      ]
+    },
+    "holes": [
+      {
+        "name": "client_name",
+        "label": "Client name",
+        "description": "Who this note is addressed to, exactly as they should see it.",
+        "kind": "text"
+      },
+      {
+        "name": "reporting_period",
+        "label": "Reporting period",
+        "description": "The window this note covers, in whatever words the client uses.",
+        "kind": "text",
+        "text": "the last four weeks"
+      },
+      {
+        "name": "status_evidence",
+        "label": "Status evidence",
+        "description": "The findings and documents this note should be written from.",
+        "default": {
+          "include": [
+            {
+              "select": "kinds",
+              "kinds": [
+                "finding"
+              ]
+            }
+          ],
+          "exclude": []
+        }
+      }
+    ],
+    "at": 1788000000000
+  },
+  {
+    "_id": "templateVersions:10-1",
+    "_creationTime": 1788000000000,
+    "templateId": "templates:10",
+    "revision": 1,
+    "name": "Incident one-pager",
+    "description": "One page on a single incident: what happened, what it cost, what changes.",
+    "tags": [
+      "Operations",
+      "Reliability"
+    ],
+    "body": {
+      "resource": "document",
+      "rows": [
+        {
+          "id": "#iop-row-title",
+          "kind": "blocks",
+          "blocks": [
+            {
+              "id": "#iop-title",
+              "type": "text",
+              "variant": "heading",
+              "level": 1,
+              "style": "title",
+              "atoms": [
+                {
+                  "id": "#iop-title-a",
+                  "kind": "template",
+                  "name": "incident_title"
+                }
+              ],
+              "display": "{incident_title}",
+              "marks": []
+            }
+          ]
+        },
+        {
+          "id": "#iop-row-what",
+          "kind": "blocks",
+          "blocks": [
+            {
+              "id": "#iop-what",
+              "type": "text",
+              "variant": "heading",
+              "level": 2,
+              "style": "heading",
+              "atoms": [
+                {
+                  "id": "#iop-what-a",
+                  "kind": "literal",
+                  "text": "What happened"
+                }
+              ],
+              "display": "What happened",
+              "marks": []
+            }
+          ]
+        },
+        {
+          "id": "#iop-row-what-prompt",
+          "kind": "blocks",
+          "blocks": [
+            {
+              "id": "#iop-what-prompt",
+              "type": "prompt",
+              "atoms": [
+                {
+                  "id": "#iop-what-prompt-a",
+                  "kind": "literal",
+                  "text": "Give the sequence of events, with times, in one paragraph."
+                }
+              ],
+              "display": "Give the sequence of events, with times, in one paragraph.",
+              "marks": [],
+              "scope": {
+                "include": [
+                  {
+                    "select": "hole",
+                    "name": "incident_record"
+                  }
+                ],
+                "exclude": []
+              },
+              "state": "idle"
+            }
+          ]
+        },
+        {
+          "id": "#iop-row-cost",
+          "kind": "blocks",
+          "blocks": [
+            {
+              "id": "#iop-cost",
+              "type": "text",
+              "variant": "heading",
+              "level": 2,
+              "style": "heading",
+              "atoms": [
+                {
+                  "id": "#iop-cost-a",
+                  "kind": "literal",
+                  "text": "What it cost"
+                }
+              ],
+              "display": "What it cost",
+              "marks": []
+            }
+          ]
+        },
+        {
+          "id": "#iop-row-cost-prompt",
+          "kind": "blocks",
+          "blocks": [
+            {
+              "id": "#iop-cost-prompt",
+              "type": "prompt",
+              "atoms": [
+                {
+                  "id": "#iop-cost-prompt-a",
+                  "kind": "literal",
+                  "text": "State the cost, and say which assumption it turns on."
+                }
+              ],
+              "display": "State the cost, and say which assumption it turns on.",
+              "marks": [],
+              "scope": {
+                "include": [
+                  {
+                    "select": "hole",
+                    "name": "cost_models"
+                  }
+                ],
+                "exclude": []
+              },
+              "state": "idle"
+            }
+          ]
+        }
+      ]
+    },
+    "holes": [
+      {
+        "name": "incident_title",
+        "label": "Incident title",
+        "description": "The name this incident is known by, as it should head the page.",
+        "kind": "text"
+      },
+      {
+        "name": "incident_record",
+        "label": "Incident record",
+        "description": "Everything the write-up should be grounded in.",
+        "default": {
+          "include": [
+            {
+              "select": "kinds",
+              "kinds": [
+                "finding"
+              ]
+            },
+            {
+              "select": "kinds",
+              "kinds": [
+                "document"
+              ]
+            }
+          ],
+          "exclude": []
+        }
+      },
+      {
+        "name": "cost_models",
+        "label": "Cost models",
+        "description": "The spreadsheets that put a number on it.",
+        "default": {
+          "include": [
+            {
+              "select": "kinds",
+              "kinds": [
+                "spreadsheet"
+              ]
+            }
+          ],
+          "exclude": []
+        }
+      }
+    ],
+    "at": 1788000000000
   }
 ]
~~~~

## Browser evidence

### changed · `test/browser/document-editor.spec.ts` (+8 / −1)

~~~~diff
@@ -724,7 +724,7 @@ test("document context panels are operational and compact", async ({ page }) =>
   await expect(context.getByText(/from edge/i)).toHaveCount(0);
   await expect(context.getByRole("button", { name: /Increase|Decrease/ })).toHaveCount(0);
 
-  for (const name of ["Variables", "Templates"] as const) {
+  for (const name of ["Variables"] as const) {
     await context.getByRole("button", { name, exact: true }).click();
     await expect(context.getByText(`document-editor.${name.toLowerCase()}`, { exact: true })).toBeVisible();
   }
@@ -735,6 +735,13 @@ test("document context panels are operational and compact", async ({ page }) =>
   await expect(context.getByRole("button", { name: "Create and generate" })).toHaveCount(0);
   await expect(context.getByText("No Prompt Blocks yet.", { exact: true })).toBeVisible();
   await expect(context.getByText(/To create one/)).toHaveCount(0);
+
+  await context.getByRole("button", { name: "Templates", exact: true }).click();
+  await expect(context.getByRole("heading", { name: "Templates" })).toBeVisible();
+  await expect(context.getByRole("textbox", { name: "Template name" })).toBeVisible();
+  await expect(context.getByRole("button", { name: "Save", exact: true })).toBeDisabled();
+  await expect(context.getByPlaceholder("Search templates…")).toBeVisible();
+  await expect(context.getByText("Operational readiness brief", { exact: true })).toBeVisible();
 });
 
 test("document named styles mirror the text formatting inspector without metadata clutter", async ({ page }) => {
~~~~

### new · `test/browser/template-features.spec.ts` (+315 / −0)

~~~~diff
@@ -0,0 +1,315 @@
+import { expect, test, type Locator, type Page, type TestInfo } from "@playwright/test";
+
+const unexpected: string[] = [];
+
+const watchDiagnostics = (page: Page) => {
+  page.on("console", (message) => {
+    if (message.type() === "warning" || message.type() === "error") {
+      unexpected.push(`console:${message.type()}: ${message.text()}`);
+    }
+  });
+  page.on("pageerror", (error) => unexpected.push(`pageerror: ${error.message}`));
+  page.on("requestfailed", (request) => {
+    if (request.failure()?.errorText === "net::ERR_ABORTED" && request.url().includes("/__data.json")) {
+      return;
+    }
+    unexpected.push(
+      `requestfailed: ${request.method()} ${request.url()} ${request.failure()?.errorText ?? ""}`
+    );
+  });
+  page.on("response", (response) => {
+    if (response.status() >= 400) unexpected.push(`http:${response.status()}: ${response.url()}`);
+  });
+};
+
+const tabs = (page: Page) => page.getByRole("toolbar", { name: "Open tabs" });
+
+const openDocumentFixture = async (page: Page) => {
+  await page.goto("/app/dev-project", { waitUntil: "networkidle" });
+  const tab = tabs(page).getByRole("button", { name: "Winter readiness brief", exact: true });
+  if ((await tab.count()) > 0) {
+    await tab.click();
+  } else {
+    await tabs(page).getByRole("button", { name: "Overview", exact: true }).click();
+    await page.getByRole("button", { name: "Winter readiness brief", exact: true }).first().dblclick();
+  }
+  await expect(page.locator(".ProseMirror")).toBeVisible();
+  await expect(page.locator(".title-bar h1")).toContainText("Winter readiness brief");
+};
+
+const openDeckFixture = async (page: Page) => {
+  const title = "Board review — Q1 exposure";
+  await page.goto("/app/dev-project", { waitUntil: "networkidle" });
+  const tab = tabs(page).getByRole("button", { name: title, exact: true });
+  if ((await tab.count()) > 0) {
+    await tab.click();
+  } else {
+    await tabs(page).getByRole("button", { name: "Overview", exact: true }).click();
+    await page.getByRole("button", { name: title, exact: true }).first().dblclick();
+  }
+  await expect(page.locator(".area-canvas").getByRole("application", { name: "Slide" })).toBeVisible();
+  await expect(page.locator(".area-title")).toContainText(title);
+};
+
+const templatesPanel = async (page: Page): Promise<Locator> => {
+  const context = page.locator('aside[aria-label="Context"]');
+  await context.getByRole("button", { name: "Templates", exact: true }).click();
+  await expect(context.getByRole("heading", { name: "Templates" })).toBeVisible();
+  return context;
+};
+
+const deleteTemplateFromLibrary = async (page: Page, name: string) => {
+  await tabs(page).getByRole("button", { name: "Templates", exact: true }).click();
+  const row = page.getByRole("button", { name: new RegExp(`^${name}`) }).first();
+  await expect(row).toBeVisible();
+  await row.click();
+  const inspector = page.locator('aside[aria-label="Inspector"][data-inspected="templates.template"]');
+  await expect(inspector).toBeVisible();
+  page.once("dialog", (dialog) => void dialog.accept());
+  await inspector.getByRole("button", { name: "Delete template" }).click();
+  await expect(page.getByRole("button", { name: new RegExp(`^${name}`) })).toHaveCount(0);
+};
+
+test.beforeEach(async ({ page }) => {
+  unexpected.length = 0;
+  watchDiagnostics(page);
+  await page.setViewportSize({ width: 1500, height: 900 });
+});
+
+test.afterEach(async ({}, testInfo: TestInfo) => {
+  expect(unexpected, `unexpected browser diagnostics in ${testInfo.title}`).toEqual([]);
+});
+
+test("inserting a template into a document asks for each hole, shows its default, and takes an answer", async ({ page }) => {
+  await openDocumentFixture(page);
+  const editor = page.locator(".ProseMirror");
+  const before = await editor.innerText();
+
+  const context = await templatesPanel(page);
+  await context.getByTitle("Insert “Technical glossary” after the current row").click();
+
+  const modal = page.getByRole("dialog", { name: "Insert “Technical glossary”" });
+  await expect(modal).toBeVisible();
+
+  // Every hole is listed, with its description and what answers it.
+  await expect(modal.getByText("Source material", { exact: true })).toBeVisible();
+  await expect(modal.getByRole("button", { name: /Documents, Findings/ })).toBeVisible();
+
+  // One of them takes words, so Insert is held until it has some.
+  await expect(modal.locator(".answer.missing")).toHaveCount(1);
+  await modal.getByRole("textbox", { name: "What Subject line says here" }).fill("Winter terms");
+  await expect(modal.locator(".answer.missing")).toHaveCount(0);
+
+  await modal.getByRole("button", { name: /Documents, Findings/ }).click();
+  const builder = page.getByRole("dialog", { name: "What Source material selects here" });
+  await expect(builder).toBeVisible();
+  await builder.getByRole("button", { name: "Sets", exact: true }).click();
+  await builder
+    .locator(".offer")
+    .filter({ hasText: "Winter filings" })
+    .getByRole("button", { name: "Add", exact: true })
+    .click();
+  await expect(builder.getByText("Winter filings").first()).toBeVisible();
+  await builder.getByRole("button", { name: "Use this", exact: true }).click();
+
+  await expect(modal.getByRole("button", { name: /Winter filings/ })).toBeVisible();
+  await modal.getByRole("button", { name: "Insert", exact: true }).click();
+
+  await expect(context.getByText("Inserted “Technical glossary”.", { exact: true })).toBeVisible();
+  // The words filled the template's own atom, so the heading carries them.
+  await expect(editor).toContainText("Technical glossary · Winter terms");
+
+  await editor.click();
+  await page.keyboard.press("ControlOrMeta+z");
+  await expect(editor).not.toContainText("Technical glossary", { timeout: 10_000 });
+  expect(await editor.innerText()).toEqual(before);
+  await expect(page.locator(".title-bar")).toContainText("Saved", { timeout: 10_000 });
+});
+
+test("a document is saved as a template, takes its hole from an inserted prompt, and is saved back", async ({ page }) => {
+  const name = `Browser template ${Date.now()}`;
+  await openDocumentFixture(page);
+
+  const context = await templatesPanel(page);
+  await expect(context.getByRole("button", { name: "Save", exact: true })).toBeDisabled();
+  await context.getByRole("textbox", { name: "Template name" }).fill(name);
+  await context.getByRole("button", { name: "Save", exact: true }).click();
+  await expect(page.locator(".title-bar h1")).toContainText(`Template · ${name}`, { timeout: 15_000 });
+
+  await expect(context.getByRole("button", { name: "Save", exact: true })).toBeVisible();
+  await expect(context.getByRole("textbox", { name: "New variable" })).toHaveCount(0);
+  await expect(context.getByRole("button", { name: "Create hole", exact: true })).toBeVisible();
+  await expect(context.locator(".hole")).toHaveCount(0);
+
+  await context.getByTitle("Insert “Technical glossary” after the current row").click();
+  await expect(context.getByText("Inserted “Technical glossary”.", { exact: true })).toBeVisible();
+  await expect(page.locator(".ProseMirror")).toContainText("Technical glossary");
+
+  const card = context.locator(".hole").filter({ hasText: "Source material" });
+  const scope = card.getByRole("button", { name: "Default scope", exact: true });
+  await expect(scope).toBeVisible();
+  await scope.click();
+
+  const modal = page.getByRole("dialog", { name: "Default scope for Source material" });
+  await expect(modal).toBeVisible();
+  await modal.getByRole("button", { name: "Whole project", exact: true }).click();
+  await modal.getByRole("button", { name: "Set the default scope", exact: true }).click();
+  await expect(scope).toHaveAttribute("title", /^Everything in the project — /);
+
+  await context.getByRole("button", { name: "Save", exact: true }).click();
+  await expect(context.getByText("Saved to the template.", { exact: true })).toBeVisible({ timeout: 15_000 });
+
+  page.once("dialog", (dialog) => void dialog.accept());
+  await context.getByRole("button", { name: "Discard", exact: true }).click();
+  await expect(tabs(page).getByRole("button", { name: `Template · ${name}`, exact: true })).toHaveCount(0, { timeout: 15_000 });
+
+  await deleteTemplateFromLibrary(page, name);
+});
+
+test("Create hole declares a text hole and drops its atom where the caret is", async ({ page }) => {
+  const name = `Browser holes ${Date.now()}`;
+  await openDocumentFixture(page);
+
+  const context = await templatesPanel(page);
+  await context.getByRole("textbox", { name: "Template name" }).fill(name);
+  await context.getByRole("button", { name: "Save", exact: true }).click();
+  await expect(page.locator(".title-bar h1")).toContainText(`Template · ${name}`, { timeout: 15_000 });
+
+  // The caret decides where the hole goes, so put it in the prose first.
+  const editor = page.locator(".ProseMirror");
+  await editor.getByRole("paragraph").first().click();
+
+  await context.getByRole("button", { name: "Create hole", exact: true }).click();
+  const modal = page.getByRole("dialog", { name: "Create a hole" });
+  await expect(modal).toBeVisible();
+
+  await modal.getByRole("textbox", { name: "Name" }).fill("client_name");
+  await modal.getByRole("textbox", { name: "Description" }).fill("Who the note is for");
+  await modal.getByRole("textbox", { name: "Default words" }).fill("Northwind");
+  await modal.getByRole("button", { name: "Create", exact: true }).click();
+
+  await expect(context.getByText("Added the hole “client_name”.", { exact: true })).toBeVisible({
+    timeout: 15_000
+  });
+  const card = context.locator(".hole").filter({ hasText: "client_name" });
+  await expect(card).toBeVisible();
+  await expect(card.getByRole("button", { name: "Default scope", exact: true })).toHaveCount(0);
+  await expect(editor.locator(".document-template-atom")).toContainText("client_name");
+
+  page.once("dialog", (dialog) => void dialog.accept());
+  await context.getByRole("button", { name: "Discard", exact: true }).click();
+  await expect(tabs(page).getByRole("button", { name: `Template · ${name}`, exact: true })).toHaveCount(0, { timeout: 15_000 });
+
+  await deleteTemplateFromLibrary(page, name);
+});
+
+test("one slide is saved as a deck template, and a deck template is inserted into an open copy", async ({ page }) => {
+  const name = `Browser slide ${Date.now()}`;
+  await openDeckFixture(page);
+
+  const context = await templatesPanel(page);
+  await expect(context.getByRole("button", { name: "Save slide", exact: true })).toBeDisabled();
+  await context.getByRole("textbox", { name: "Template name" }).fill(name);
+  await context.getByRole("button", { name: "Save slide", exact: true }).click();
+  await expect(page.locator(".area-title")).toContainText(`Template · ${name}`, { timeout: 15_000 });
+  await expect(context.getByRole("button", { name: "Save", exact: true })).toBeVisible();
+
+  await context.getByTitle(new RegExp("^Insert “Board review” after slide")).click();
+  await expect(context.getByText("Inserted “Board review”.", { exact: true })).toBeVisible();
+
+  page.once("dialog", (dialog) => void dialog.accept());
+  await context.getByRole("button", { name: "Discard", exact: true }).click();
+  await expect(tabs(page).getByRole("button", { name: `Template · ${name}`, exact: true })).toHaveCount(0, { timeout: 15_000 });
+
+  await deleteTemplateFromLibrary(page, name);
+});
+
+test("the project's resource sets are made, counted, and removed from the Contexts panel", async ({ page }) => {
+  const name = `Browser set ${Date.now()}`;
+  await page.goto("/app/dev-project", { waitUntil: "networkidle" });
+  await tabs(page).getByRole("button", { name: "Overview", exact: true }).click();
+
+  const context = page.locator('aside[aria-label="Context"]');
+  await context.getByRole("button", { name: "Context", exact: true }).click();
+  await expect(context.getByRole("heading", { name: "Contexts" })).toBeVisible();
+  await expect(context.getByRole("button", { name: /^Winter filings/ }).first()).toBeVisible();
+
+  await context.getByRole("button", { name: "New set", exact: true }).click();
+  await context.getByRole("textbox", { name: "Set name" }).fill(name);
+  await context.getByRole("button", { name: "Choose what it selects", exact: true }).click();
+
+  const builder = page.getByRole("dialog", { name: "A set of resources" });
+  await expect(builder).toBeVisible();
+  await builder
+    .locator(".offer")
+    .filter({ hasText: "Findings" })
+    .getByRole("button", { name: "Add", exact: true })
+    .click();
+  await expect(builder.getByText("Findings", { exact: true }).first()).toBeVisible();
+  await builder.getByRole("button", { name: "Use this", exact: true }).click();
+
+  await expect(context.getByText("Findings.", { exact: true })).toBeVisible();
+  await context.getByRole("button", { name: "Create", exact: true }).click();
+
+  const made = context.getByRole("button", { name: new RegExp(`^${name}`) }).first();
+  await expect(made).toBeVisible();
+  await expect(made).toContainText("2 resources");
+  await made.click();
+  page.once("dialog", (dialog) => void dialog.accept());
+  await context.getByTitle(new RegExp(`^Delete “${name}”`)).click();
+  await expect(context.getByRole("button", { name: new RegExp(`^${name}`) })).toHaveCount(0);
+});
+
+test("a hole's default is built with an exclusion, stored, and read back as the rule", async ({ page }) => {
+  await page.goto("/app/dev-project", { waitUntil: "networkidle" });
+  await tabs(page).getByRole("button", { name: "Templates", exact: true }).click();
+  await page.getByRole("button", { name: /^Incident write-up/ }).first().click();
+
+  const inspector = page.locator('aside[aria-label="Inspector"][data-inspected="templates.template"]');
+  await expect(inspector).toBeVisible();
+  await inspector.getByText("Incident evidence", { exact: true }).click();
+
+  const scope = inspector.getByRole("button", { name: "Default scope", exact: true }).first();
+  await expect(scope).toBeVisible();
+
+  // The seeded default is a bound row, so the builder opens on the rule it holds.
+  await expect(scope).toHaveAttribute("title", /minus Interconnect glossary/);
+  await scope.click();
+
+  const builder = page.getByRole("dialog", { name: "Default scope for Incident evidence" });
+  await expect(builder).toBeVisible();
+
+  // One term, one row: the stored rule's three kinds are three rows, not one.
+  await expect(builder.locator(".term")).toHaveCount(3);
+
+  await builder.getByRole("button", { name: /^Exclude/ }).click();
+  await expect(builder.locator(".term")).toHaveCount(1);
+  await builder.getByRole("button", { name: "Resources", exact: true }).click();
+  await builder
+    .locator(".offer")
+    .filter({ hasText: "Substation 14 incident write-up" })
+    .getByRole("button", { name: "Add", exact: true })
+    .click();
+  await builder.getByRole("button", { name: "Set the default scope", exact: true }).click();
+
+  await expect(scope).toHaveAttribute(
+    "title",
+    /minus Interconnect glossary and Substation 14 incident write-up/,
+    { timeout: 15_000 }
+  );
+
+  // Put the seeded template back the way the fixture had it.
+  await scope.click();
+  await expect(builder).toBeVisible();
+  await builder.getByRole("button", { name: /^Exclude/ }).click();
+  await builder
+    .locator(".term")
+    .filter({ hasText: "Substation 14 incident write-up" })
+    .getByRole("button", { name: "×" })
+    .click();
+  await builder.getByRole("button", { name: "Set the default scope", exact: true }).click();
+  await expect(scope).not.toHaveAttribute("title", /Substation 14 incident write-up/, {
+    timeout: 15_000
+  });
+  await expect(scope).toHaveAttribute("title", /minus Interconnect glossary/);
+});
~~~~

### new · `test/browser/template-reference.spec.ts` (+115 / −0)

~~~~diff
@@ -0,0 +1,115 @@
+import { expect, test, type Page, type TestInfo } from "@playwright/test";
+
+const routes = [
+  ["system", "/app/dev-project/reference/templates", "How templates work"],
+  ["changes", "/app/dev-project/reference/templates/changes", "What changed"],
+  ["scope", "/app/dev-project/reference/templates/scope", "What a hole selects"]
+] as const;
+
+const unexpected: string[] = [];
+
+const watchDiagnostics = (page: Page) => {
+  page.on("console", (message) => {
+    if (message.type() === "warning" || message.type() === "error") {
+      unexpected.push(`console:${message.type()}: ${message.text()}`);
+    }
+  });
+  page.on("pageerror", (error) => unexpected.push(`pageerror: ${error.message}`));
+  page.on("requestfailed", (request) => {
+    if (request.failure()?.errorText === "net::ERR_ABORTED" && request.url().includes("/__data.json")) return;
+    unexpected.push(`requestfailed: ${request.method()} ${request.url()} ${request.failure()?.errorText ?? ""}`);
+  });
+  page.on("response", (response) => {
+    if (response.status() >= 400) unexpected.push(`http:${response.status()}: ${response.url()}`);
+  });
+};
+
+test.beforeEach(async ({ page }) => {
+  unexpected.length = 0;
+  watchDiagnostics(page);
+});
+
+test.afterEach(async ({}, testInfo: TestInfo) => {
+  expect(unexpected, `unexpected browser diagnostics in ${testInfo.title}`).toEqual([]);
+});
+
+test("both template reference pages load and stay within the narrow viewport", async ({ page }) => {
+  await page.setViewportSize({ width: 390, height: 844 });
+  for (const [, route, heading] of routes) {
+    await page.goto(route, { waitUntil: "networkidle" });
+    await expect(page.getByRole("heading", { level: 1, name: heading })).toBeVisible();
+    expect(
+      await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth),
+      `${route} should not create page-level horizontal overflow`
+    ).toBe(true);
+  }
+});
+
+test("the ledger filters by area without changing what the summary measured", async ({ page }) => {
+  await page.setViewportSize({ width: 1500, height: 900 });
+  await page.goto("/app/dev-project/reference/templates/changes", { waitUntil: "networkidle" });
+
+  const total = await page.locator(".summary div").first().locator("dd").innerText();
+  const rows = page.locator(".ledger tbody tr");
+  await expect(rows).toHaveCount(Number(total));
+
+  await page.getByRole("button", { name: /^Templates capability/ }).click();
+  const shown = await rows.count();
+  expect(shown).toBeGreaterThan(0);
+  expect(shown).toBeLessThan(Number(total));
+  await expect(page.locator(".summary div").first().locator("dd")).toHaveText(total);
+
+  await page.getByRole("button", { name: /^Everything \d+$/ }).click();
+  await expect(rows).toHaveCount(Number(total));
+});
+
+test("the system page carries its diagrams and reaches the change set", async ({ page }) => {
+  await page.setViewportSize({ width: 1500, height: 900 });
+  await page.goto("/app/dev-project/reference/templates", { waitUntil: "networkidle" });
+
+  await expect(page.getByRole("img", { name: /A document becomes a template/ })).toBeVisible();
+  await expect(page.getByRole("img", { name: /pressing Save moves the template's revision once/ })).toBeVisible();
+  await expect(page.getByRole("heading", { level: 2, name: "Two saves, two meanings" })).toBeVisible();
+
+  await page.getByRole("link", { name: "What changed", exact: false }).first().click();
+  await expect(page.getByRole("heading", { level: 1, name: "What changed" })).toBeVisible();
+});
+
+test("the reference pages read in either material, and the choice carries between them", async ({ page }) => {
+  await page.setViewportSize({ width: 1500, height: 900 });
+  await page.goto("/app/dev-project/reference/templates/scope", { waitUntil: "networkidle" });
+
+  const material = page.getByRole("group", { name: "Material" });
+  await expect(material.getByRole("button", { name: "Helios" })).toHaveAttribute("aria-pressed", "true");
+
+  await material.getByRole("button", { name: "Selene" }).click();
+  await expect(page.locator("html")).toHaveAttribute("data-appearance", "selene");
+
+  await page.goto("/app/dev-project/reference/templates", { waitUntil: "networkidle" });
+  await expect(page.locator("html")).toHaveAttribute("data-appearance", "selene");
+  await expect(
+    page.getByRole("group", { name: "Material" }).getByRole("button", { name: "Selene" })
+  ).toHaveAttribute("aria-pressed", "true");
+
+  await page.getByRole("group", { name: "Material" }).getByRole("button", { name: "Helios" }).click();
+  await expect(page.locator("html")).toHaveAttribute("data-appearance", "helios");
+});
+
+test("the scope page carries its mock, its file list and its settled decisions", async ({ page }) => {
+  await page.setViewportSize({ width: 1500, height: 900 });
+  await page.goto("/app/dev-project/reference/templates/scope", { waitUntil: "networkidle" });
+
+  await expect(page.getByRole("heading", { level: 2, name: "The builder" })).toBeVisible();
+  await expect(page.getByText("Insert “Client status note”").first()).toBeVisible();
+  await expect(page.getByText("From", { exact: true }).first()).toBeVisible();
+  await expect(page.getByRole("heading", { level: 2, name: "Two kinds of hole" })).toBeVisible();
+
+  await expect(page.getByRole("heading", { level: 2, name: "Every file it touched" })).toBeVisible();
+  await expect(page.locator("#work tbody tr").first()).toBeVisible();
+
+  const recommended = page.locator("#forks .state.after");
+  await expect(recommended).toHaveCount(8);
+
+  await page.getByRole("link", { name: "How templates work", exact: false }).first().click();
+  await expect(page.getByRole("heading", { level: 1, name: "How templates work" })).toBeVisible();
+});
~~~~

## The reference pages, and the one shared component they moved

### new · `scripts/generate-template-reference-inventory.mjs` (+126 / −0)

~~~~diff
@@ -0,0 +1,126 @@
+#!/usr/bin/env node
+/**
+ * The file ledger behind /app/<project>/reference/templates/changes.
+ *
+ *     node scripts/generate-template-reference-inventory.mjs > \
+ *       src/lib/development-views/template-reference/procedures/inventory.ts
+ *
+ * The baseline is where this branch meets the branch it sits on rather than that
+ * branch's head, so the ledger keeps measuring this work as the base moves on.
+ * `work/derived-output-architecture` is that branch, because prompt blocks live
+ * there; TEMPLATE_FEATURES_BASE names another, and main is the fallback.
+ */
+import { execFileSync } from "node:child_process";
+import { existsSync, readFileSync } from "node:fs";
+import { dirname, resolve } from "node:path";
+import { fileURLToPath } from "node:url";
+
+const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
+
+const git = (...args) => execFileSync("git", args, { cwd: root, encoding: "utf8" });
+const lines = (value) => value.split("\n").filter(Boolean);
+const physicalLines = (buffer) => {
+  if (!buffer?.length) return 0;
+  const text = buffer.toString("utf8");
+  return text.split(/\r?\n/).length - (text.endsWith("\n") ? 1 : 0);
+};
+
+const mergeBase = (ref) => {
+  try {
+    return git("merge-base", "HEAD", ref).trim();
+  } catch {
+    return "";
+  }
+};
+
+const baseline =
+  process.env.TEMPLATE_FEATURES_BASE ??
+  (mergeBase("work/derived-output-architecture") || mergeBase("main"));
+
+const kindOf = (path) => {
+  if (path.includes("development-views/template-reference/") || path.includes("reference/templates")) return "reference";
+  if (path.includes("/test/") || path.includes(".test.") || path.includes("playwright")) return "test";
+  if (path.startsWith("app/seed/")) return "fixture";
+  if (path.startsWith("docs/") || path.endsWith(".md")) return "documentation";
+  if (path.endsWith(".mjs") || path.endsWith("package.json") || path.endsWith("vite.config.ts")) return "configuration";
+  return "production";
+};
+
+const areaOf = (path) => {
+  if (path.includes("development-views/template-reference/") || path.includes("reference/templates")) return "reference";
+  if (path.startsWith("app/seed/") || path.startsWith("app/test/browser/")) return "evidence";
+  if (path.startsWith("docs/")) return "documentation";
+  if (path.includes("/representation/") || path.includes("/model/client/workspace-state/")) return "vocabulary";
+  if (path.includes("/capabilities/templates/")) return "templates";
+  if (path.includes("/capabilities/resource-sets/")) return "sets";
+  if (
+    path.includes("/capabilities/project-resources/") ||
+    path.includes("/capabilities/comments/") ||
+    path.includes("/capabilities/store/")
+  ) return "neighbours";
+  if (path.includes("/categories/templates/")) return "library";
+  if (path.includes("/categories/project-overview/")) return "contexts";
+  if (path.includes("/categories/document-editor/") || path.includes("/categories/slide-deck-editor/")) return "editors";
+  return "cross-cutting";
+};
+
+const status = new Map();
+for (const row of lines(git("diff", "--name-status", "--find-renames", baseline, "--"))) {
+  const [raw, ...names] = row.split("\t");
+  const code = raw[0];
+  const path = code === "R" || code === "C" ? names.at(-1) : names[0];
+  status.set(path, code === "R" || code === "C" ? "A" : code);
+}
+for (const path of lines(git("ls-files", "--others", "--exclude-standard"))) status.set(path, "A");
+
+const numstat = new Map();
+for (const row of lines(git("diff", "--text", "--numstat", baseline, "--"))) {
+  const [added, deleted, path] = row.split("\t");
+  if (added !== "-" && deleted !== "-") numstat.set(path, { added: Number(added) || 0, deleted: Number(deleted) || 0 });
+}
+
+const records = [...status]
+  .filter(([path]) => path.startsWith("app/") && !path.startsWith("app/data/") && !path.endsWith(".log"))
+  .map(([path, change]) => {
+    const absolute = resolve(root, path);
+    const currentBuffer = change === "D" || !existsSync(absolute) ? Buffer.alloc(0) : readFileSync(absolute);
+    let baseBuffer = Buffer.alloc(0);
+    if (change !== "A") {
+      try {
+        baseBuffer = execFileSync("git", ["show", `${baseline}:${path}`], { cwd: root, encoding: "buffer" });
+      } catch {
+        baseBuffer = Buffer.alloc(0);
+      }
+    }
+    const current = physicalLines(currentBuffer);
+    const base = physicalLines(baseBuffer);
+    let delta = numstat.get(path);
+    if (!delta && change === "M") {
+      const patch = git("diff", "--text", "--no-ext-diff", "--unified=0", baseline, "--", path);
+      delta = {
+        added: patch.split("\n").filter((line) => line.startsWith("+") && !line.startsWith("+++")).length,
+        deleted: patch.split("\n").filter((line) => line.startsWith("-") && !line.startsWith("---")).length
+      };
+    }
+    delta ??= { added: change === "A" ? current : 0, deleted: change === "D" ? base : 0 };
+    return {
+      path,
+      status: change,
+      area: areaOf(path),
+      kind: kindOf(path),
+      current,
+      base,
+      added: delta.added,
+      deleted: delta.deleted
+    };
+  })
+  .sort((a, b) => a.path.localeCompare(b.path));
+
+const encoded = records.map((record) => JSON.stringify(record)).join(",\n  ");
+process.stdout.write(
+  `import type { FileRecord } from "$development-views/template-reference/types";\n\n` +
+    `/**\n * Generated by scripts/generate-template-reference-inventory.mjs.\n` +
+    ` * Comparison: ${baseline.slice(0, 7)} (branch point) → worktree.\n */\n` +
+    `export const BASELINE = "${baseline.slice(0, 7)}";\n\n` +
+    `export const FILES: FileRecord[] = [\n  ${encoded}\n];\n`
+);
~~~~

### changed · `src/lib/components/authored/panel/panel-section.svelte` (+13 / −1)

~~~~diff
@@ -70,6 +70,18 @@
   // svelte-ignore state_referenced_locally
   let requested = $state(open);
 
+  /**
+   * The disclosure's body waits for the root to exist before it mounts. A
+   * section that starts open otherwise mounts its content in the tick that
+   * mounts the trigger, and the primitive's measurement watch then reads a
+   * derived belonging to that same tick's effect once the panel is torn down.
+   */
+  let settled = $state(false);
+
+  $effect(() => {
+    settled = true;
+  });
+
   $effect(() => {
     const next = open;
     if (next && !requested) expanded = true;
@@ -101,7 +113,7 @@
     {/if}
   </Collapsible.Trigger>
 
-  {#if expanded}
+  {#if expanded && settled}
     <!--
       Do not mount a closed presence layer just to have the primitive remove it
       in the same tick. Besides doing needless work for every inspector, that
~~~~

### new · `src/lib/components/authored/scope-builder/index.ts` (+9 / −0)

~~~~diff
@@ -0,0 +1,9 @@
+/**
+ * The one place a scope is chosen.
+ *
+ * Four surfaces open it: a variable's default from either editor's Templates
+ * panel or from the library inspector, the answer given while placing a
+ * template, and the Contexts panel's own sets. They differ in what they call it
+ * and what they do with the result, and in nothing else.
+ */
+export { default as ScopeBuilder } from "$authored-components/scope-builder/scope-builder.svelte";
~~~~

### new · `src/lib/components/authored/scope-builder/scope-builder.svelte` (+455 / −0)

~~~~diff
@@ -0,0 +1,455 @@
+<script lang="ts">
+  import { Button } from "$vendored-components/button";
+  import { Input } from "$vendored-components/input";
+  import { traceNode } from "$development-components/trace.svelte";
+
+  /**
+   * One rule, built by hand: what it includes, what it takes back out, and how
+   * many resources that is right now.
+   *
+   * **Every set is a difference**, so both sides are always here — as two tabs
+   * rather than two stacked lists, because a side you are not editing is a list
+   * you are only reading, and reading it is what the sentence underneath is for.
+   *
+   * **A tab is two panes: what you can add, and what is in.** Searching and
+   * holding are different activities and each gets its own surface. Nothing
+   * opens on top of anything: the sources are a row of tabs inside the left
+   * pane, not a menu, because a menu over a modal over a modal is three lids on
+   * one box.
+   *
+   * **The floor is a button, not a term.** Whole project is the common answer
+   * and the thing a parameter falls back to, and Default puts it back to
+   * whatever the template suggested — both sit under the panes where a decision
+   * about the whole rule belongs.
+   *
+   * It is handed rows and offers already in words and answers with the keys it
+   * was given, so it cannot express a rule the vocabulary would refuse.
+   */
+
+  export type ScopeSide = "include" | "exclude";
+
+  export type ScopeRow = { readonly key: string; readonly kind: string; readonly words: string };
+
+  export type ScopeOffer = {
+    readonly key: string;
+    readonly label: string;
+    readonly note?: string;
+    readonly held?: ScopeSide;
+    readonly refused?: string;
+  };
+
+  export type ScopeSource = {
+    readonly key: string;
+    readonly label: string;
+    readonly placeholder?: string;
+    readonly offers: readonly ScopeOffer[];
+  };
+
+  export type ScopePreview = { readonly key: string; readonly label: string; readonly note?: string };
+
+  let {
+    whole,
+    include,
+    exclude,
+    count,
+    preview = [],
+    sources = [],
+    resettable = false,
+    disabled = false,
+    onmode,
+    onadd,
+    ondrop,
+    onclear,
+    onreset
+  }: {
+    /** Whether the rule is the floor: everything the project holds. */
+    whole: boolean;
+    include: readonly ScopeRow[];
+    exclude: readonly ScopeRow[];
+    /** How many resources it selects now. */
+    count: number;
+    /** What those resources are, for the list under the count. */
+    preview?: readonly ScopePreview[];
+    /** Where a term can be added from. A source with no placeholder is not filtered. */
+    sources?: readonly ScopeSource[];
+    /** Whether there is a default to go back to, which only placing a template has. */
+    resettable?: boolean;
+    disabled?: boolean;
+    onmode: (whole: boolean) => void;
+    onadd: (side: ScopeSide, source: string, key: string) => void;
+    ondrop: (side: ScopeSide, key: string) => void;
+    /** Empty both sides, to start again from nothing. */
+    onclear: () => void;
+    onreset?: () => void;
+  } = $props();
+
+  const trace = traceNode("ScopeBuilder", () => ({
+    whole,
+    include: include.length,
+    exclude: exclude.length,
+    count,
+    disabled
+  }));
+
+  let side = $state<ScopeSide>("include");
+  let openSource = $state<string | undefined>(undefined);
+  let query = $state("");
+  let showing = $state(false);
+
+  const current = $derived(sources.find((source) => source.key === openSource) ?? sources[0]);
+  const held = $derived(side === "include" ? include : exclude);
+
+  const shown = $derived(
+    current === undefined
+      ? []
+      : current.offers.filter(
+          (candidate) =>
+            query.trim() === "" ||
+            candidate.label.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase())
+        )
+  );
+</script>
+
+<div {...trace} class="builder">
+  <div class="tabs" role="group" aria-label="Which side to edit">
+    {#each ["include", "exclude"] as const as name (name)}
+      <button
+        type="button"
+        class:on={side === name}
+        aria-pressed={side === name}
+        {disabled}
+        onclick={() => {
+          side = name;
+          query = "";
+        }}
+      >
+        {name === "include" ? "Include" : "Exclude"}
+        <span>{(name === "include" ? include : exclude).length}</span>
+      </button>
+    {/each}
+  </div>
+
+  <div class="panes">
+    <section class="pane" aria-label={`Add to ${side === "include" ? "include" : "exclude"}`}>
+      <header>
+        <b>From</b>
+      </header>
+      <div class="sources" role="group" aria-label="Where to add from">
+        {#each sources as source (source.key)}
+          <Button
+            variant={source.key === current?.key ? "secondary" : "ghost"}
+            size="xs"
+            {disabled}
+            aria-pressed={source.key === current?.key}
+            onclick={() => {
+              openSource = source.key;
+              query = "";
+            }}
+          >
+            {source.label}
+          </Button>
+        {/each}
+      </div>
+      {#if current?.placeholder !== undefined}
+        <Input
+          type="search"
+          bind:value={query}
+          placeholder={current.placeholder}
+          aria-label={current.placeholder}
+          class="text-body-sm h-7 [&::-webkit-search-cancel-button]:hidden"
+        />
+      {/if}
+      <div class="offers">
+        {#each shown.slice(0, 80) as candidate (candidate.key)}
+          <div class="offer">
+            <span class="offer-name">{candidate.label}</span>
+            {#if candidate.note}<small>{candidate.note}</small>{/if}
+            {#if candidate.refused !== undefined}
+              <span class="refused" title={candidate.refused}>Would loop</span>
+            {:else if candidate.held === side}
+              <span class="in">In</span>
+            {:else}
+              <Button
+                variant="outline"
+                size="xs"
+                {disabled}
+                title={`Add ${candidate.label}`}
+                onclick={() => onadd(side, current?.key ?? "", candidate.key)}
+              >
+                Add
+              </Button>
+            {/if}
+          </div>
+        {/each}
+        {#if shown.length === 0}
+          <p class="empty">Nothing matches.</p>
+        {/if}
+      </div>
+    </section>
+
+    <section class="pane" aria-label={side === "include" ? "Included" : "Excluded"}>
+      <header>
+        <b>{side === "include" ? "Included" : "Excluded"}</b>
+      </header>
+      <div class="terms">
+        {#each held as row (row.key)}
+          <div class="term">
+            <code>{row.kind}</code>
+            <span>{row.words}</span>
+            <Button
+              variant="ghost"
+              size="xs"
+              {disabled}
+              title={`Remove ${row.words}`}
+              onclick={() => ondrop(side, row.key)}
+            >
+              ×
+            </Button>
+          </div>
+        {/each}
+        {#if held.length === 0}
+          <p class="empty">
+            {side === "include"
+              ? whole
+                ? "Everything in the project, because nothing narrower is included."
+                : "Nothing is included yet, so this selects nothing."
+              : "Nothing is taken back out."}
+          </p>
+        {/if}
+      </div>
+    </section>
+  </div>
+
+  <div class="foot">
+    <div class="floor">
+      <Button
+        variant={whole ? "secondary" : "outline"}
+        size="xs"
+        {disabled}
+        aria-pressed={whole}
+        title="Select everything the project holds"
+        onclick={() => onmode(true)}
+      >
+        Whole project
+      </Button>
+      {#if resettable && onreset !== undefined}
+        <Button
+          variant="ghost"
+          size="xs"
+          {disabled}
+          title="Go back to what the template suggests"
+          onclick={onreset}
+        >
+          Default
+        </Button>
+      {/if}
+      <Button
+        variant="ghost"
+        size="xs"
+        {disabled}
+        title="Empty both sides and start again"
+        onclick={onclear}
+      >
+        Clear
+      </Button>
+    </div>
+
+    <div class="count">
+      <b>{count}</b>
+      <span>{count === 1 ? "resource" : "resources"}</span>
+      {#if preview.length > 0}
+        <Button variant="ghost" size="xs" onclick={() => (showing = !showing)}>
+          {showing ? "Hide" : "Show"}
+        </Button>
+      {/if}
+    </div>
+  </div>
+
+  {#if showing && preview.length > 0}
+    <ul class="preview">
+      {#each preview as item (item.key)}
+        <li><span>{item.label}</span>{#if item.note}<small>{item.note}</small>{/if}</li>
+      {/each}
+    </ul>
+  {/if}
+</div>
+
+<style>
+  .builder {
+    display: flex;
+    flex-direction: column;
+    gap: calc(var(--token-spacing-unit) * 2);
+    padding: 0 calc(var(--token-spacing-unit) * 3);
+  }
+
+  .tabs {
+    display: flex;
+    gap: calc(var(--token-spacing-unit) * 1);
+    border-bottom: 1px solid var(--token-border-subtle);
+  }
+
+  .tabs button {
+    display: flex;
+    align-items: center;
+    gap: calc(var(--token-spacing-unit) * 1);
+    padding: calc(var(--token-spacing-unit) * 1) calc(var(--token-spacing-unit) * 1.5);
+    border: 0;
+    background: transparent;
+    color: var(--token-ink-secondary);
+    font-size: var(--token-text-body-sm);
+    font-weight: 600;
+    cursor: pointer;
+  }
+
+  .tabs button.on {
+    box-shadow: inset 0 -2px 0 var(--token-color-active-text);
+    color: var(--token-color-active-text);
+  }
+
+  .tabs span {
+    padding: 0 calc(var(--token-spacing-unit) * 1);
+    border-radius: var(--token-radius-control);
+    background: var(--token-surface-work);
+    color: var(--token-ink-muted);
+    font-size: 10px;
+    font-variant-numeric: tabular-nums;
+  }
+
+  .panes {
+    display: grid;
+    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
+    gap: calc(var(--token-spacing-unit) * 2);
+  }
+
+  /**
+   * Both panes are one fixed height, so the modal does not jump as somebody
+   * clicks between Kinds, Sets and Resources looking for what they want.
+   */
+  .pane {
+    display: flex;
+    flex-direction: column;
+    gap: calc(var(--token-spacing-unit) * 1);
+    height: 21rem;
+    padding: calc(var(--token-spacing-unit) * 1.5);
+    border: 1px solid var(--token-border-subtle);
+    border-radius: var(--token-radius-panel);
+    background: var(--token-surface-panel);
+  }
+
+  .pane header b {
+    color: var(--token-ink-muted);
+    font-size: var(--token-text-caption);
+    font-weight: 700;
+    letter-spacing: .08em;
+    text-transform: uppercase;
+  }
+
+  .sources { display: flex; flex-wrap: wrap; gap: calc(var(--token-spacing-unit) * .5); }
+
+  .offers,
+  .terms {
+    display: flex;
+    flex: 1;
+    flex-direction: column;
+    min-height: 0;
+    overflow-y: auto;
+  }
+
+  .terms { gap: calc(var(--token-spacing-unit) * 1); }
+
+  .offer {
+    display: grid;
+    grid-template-columns: minmax(0, 1fr) auto auto;
+    gap: calc(var(--token-spacing-unit) * 1);
+    align-items: center;
+    padding: calc(var(--token-spacing-unit) * .5) 0;
+    border-bottom: 1px solid var(--token-border-subtle);
+  }
+
+  .offer-name,
+  .term span {
+    overflow: hidden;
+    font-size: var(--token-text-body-sm);
+    text-overflow: ellipsis;
+    white-space: nowrap;
+  }
+
+  .offer small { color: var(--token-ink-muted); font-size: 10px; }
+
+  .term {
+    display: grid;
+    grid-template-columns: auto minmax(0, 1fr) auto;
+    gap: calc(var(--token-spacing-unit) * 1);
+    align-items: center;
+    padding-inline-start: calc(var(--token-spacing-unit) * 1);
+    border: 1px solid var(--token-border-subtle);
+    border-radius: var(--token-radius-control);
+    background: var(--token-surface-elevated);
+  }
+
+  .term code {
+    padding: 0 calc(var(--token-spacing-unit) * .5);
+    border-radius: 3px;
+    background: var(--token-surface-work);
+    color: var(--token-ink-muted);
+    font-size: 10px;
+  }
+
+  .empty {
+    margin: 0;
+    color: var(--token-ink-secondary);
+    font-size: var(--token-text-caption);
+    font-style: italic;
+  }
+
+  .in,
+  .refused {
+    padding: 0 calc(var(--token-spacing-unit) * 1);
+    border-radius: var(--token-radius-control);
+    background: var(--token-surface-work);
+    color: var(--token-ink-muted);
+    font-size: 10px;
+  }
+
+  .refused { color: var(--token-color-attention-text); }
+
+  .foot {
+    display: flex;
+    flex-wrap: wrap;
+    align-items: center;
+    justify-content: space-between;
+    gap: calc(var(--token-spacing-unit) * 1);
+  }
+
+  .floor { display: flex; gap: calc(var(--token-spacing-unit) * 1); }
+
+  .count { display: flex; align-items: baseline; gap: calc(var(--token-spacing-unit) * 1); }
+  .count b { font-size: 18px; font-weight: 700; }
+  .count span { color: var(--token-ink-secondary); font-size: var(--token-text-caption); }
+
+  .preview {
+    display: flex;
+    flex-direction: column;
+    gap: calc(var(--token-spacing-unit) * .5);
+    max-height: 10rem;
+    margin: 0;
+    padding: 0;
+    overflow-y: auto;
+    list-style: none;
+  }
+
+  .preview li {
+    display: flex;
+    align-items: baseline;
+    justify-content: space-between;
+    gap: calc(var(--token-spacing-unit) * 1);
+    font-size: var(--token-text-caption);
+  }
+
+  .preview small { color: var(--token-ink-muted); }
+
+  @media (max-width: 44rem) {
+    .panes { grid-template-columns: minmax(0, 1fr); }
+    .pane { min-height: 0; }
+  }
+</style>
~~~~

### new · `src/lib/components/authored/template-answers/index.ts` (+8 / −0)

~~~~diff
@@ -0,0 +1,8 @@
+/**
+ * What placing a template asks for, in one list.
+ *
+ * Insert in either editor and Use in the library all open it, because they are
+ * one act seen from three places: a copy is being made and its parameters need
+ * answers.
+ */
+export { default as TemplateAnswers } from "$authored-components/template-answers/template-answers.svelte";
~~~~

### new · `src/lib/components/authored/template-answers/template-answers.svelte` (+185 / −0)

~~~~diff
@@ -0,0 +1,185 @@
+<script lang="ts">
+  import { Button } from "$vendored-components/button";
+  import { Textarea } from "$vendored-components/textarea";
+  import { traceNode } from "$development-components/trace.svelte";
+
+  /**
+   * Every hole a template asks for, as a name, what it means, and what it
+   * is answered with.
+   *
+   * **All of them, always, and nothing folded away.** A template's holes are
+   * the shape of the thing you are about to make, so the whole list is on screen
+   * and each row reads top to bottom: the name, the sentence whoever made the
+   * template wrote, and the value. Nothing here is a disclosure, because a hole
+   * you have to open to see is a hole you can forget.
+   *
+   * **The list scrolls; the modal does not grow.** A template with twelve
+   * holes and one with two open the same size, so nothing jumps.
+   *
+   * **The value is the control.** Text is a field you type in. A scope is a
+   * block reading what it selects, which opens the builder when pressed. A row
+   * with nothing in it carries a rule down its left edge.
+   */
+
+  export type AnswerRow = {
+    /** The hole's name, and this component's key for it. */
+    readonly key: string;
+    readonly label: string;
+    readonly description?: string;
+    readonly kind: "scope" | "text";
+    /** What it is answered with, read as words. */
+    readonly value: string;
+    /** Whether the caller has said anything, as against taking what was suggested. */
+    readonly answered: boolean;
+    /** Whether it has no answer at all, which only a text hole can be. */
+    readonly missing: boolean;
+  };
+
+  let {
+    rows,
+    disabled = false,
+    onscope,
+    ontext,
+    onreset
+  }: {
+    rows: readonly AnswerRow[];
+    disabled?: boolean;
+    /** Open the builder for one scope hole. */
+    onscope: (key: string) => void;
+    /** The words typed for one text hole. */
+    ontext: (key: string, words: string) => void;
+    /** Put one hole back to what the template suggests. */
+    onreset: (key: string) => void;
+  } = $props();
+
+  const trace = traceNode("TemplateAnswers", () => ({
+    rows: rows.length,
+    missing: rows.filter((row) => row.missing).length
+  }));
+</script>
+
+<div {...trace} class="answers">
+  {#each rows as row (row.key)}
+    <article class="answer" class:missing={row.missing}>
+      <header>
+        <b>{row.label}</b>
+        {#if row.answered}
+          <Button
+            variant="ghost"
+            size="xs"
+            {disabled}
+            title={`Put ${row.label} back to what the template suggests`}
+            onclick={() => onreset(row.key)}
+          >
+            Use the default
+          </Button>
+        {/if}
+      </header>
+
+      <p class="what">
+        {row.description ??
+          (row.kind === "text" ? "Words this template asks for." : "What this hole selects.")}
+      </p>
+
+      {#if row.kind === "text"}
+        <Textarea
+          value={row.value}
+          rows={2}
+          {disabled}
+          aria-label={`What ${row.label} says here`}
+          placeholder={`What ${row.label.toLocaleLowerCase()} says here`}
+          oninput={(event) => ontext(row.key, event.currentTarget.value)}
+        />
+      {:else}
+        <button
+          type="button"
+          class="scope"
+          {disabled}
+          title={`Choose what ${row.label} selects here`}
+          onclick={() => onscope(row.key)}
+        >
+          <span class="tag">{row.answered ? "Chosen" : "Default"}</span>
+          <span class="rule">{row.value}</span>
+        </button>
+      {/if}
+    </article>
+  {/each}
+</div>
+
+<style>
+  .answers {
+    display: flex;
+    flex-direction: column;
+    gap: calc(var(--token-spacing-unit) * 1.5);
+    height: 24rem;
+    padding: 0 calc(var(--token-spacing-unit) * 3);
+    overflow-y: auto;
+  }
+
+  .answer {
+    display: flex;
+    flex-direction: column;
+    gap: calc(var(--token-spacing-unit) * 1);
+    padding: calc(var(--token-spacing-unit) * 1.5);
+    border: 1px solid var(--token-border-subtle);
+    border-inline-start: 3px solid transparent;
+    border-radius: var(--token-radius-control);
+    background: var(--token-surface-elevated);
+  }
+
+  .answer.missing { border-inline-start-color: var(--token-color-danger-text); }
+
+  header {
+    display: flex;
+    align-items: center;
+    justify-content: space-between;
+    gap: calc(var(--token-spacing-unit) * 2);
+  }
+
+  header b {
+    color: var(--token-ink-primary);
+    font-size: var(--token-text-body-sm);
+    font-weight: 600;
+  }
+
+  .what {
+    margin: 0;
+    color: var(--token-ink-secondary);
+    font-size: var(--token-text-caption);
+    line-height: var(--token-text-caption-leading);
+  }
+
+  /* The rule reads to four lines, then scrolls, so one long scope cannot own the modal. */
+  .scope {
+    display: flex;
+    gap: calc(var(--token-spacing-unit) * 1.5);
+    align-items: flex-start;
+    max-height: 5.5rem;
+    padding: calc(var(--token-spacing-unit) * 1) calc(var(--token-spacing-unit) * 1.5);
+    overflow-y: auto;
+    border: 1px solid var(--token-border-subtle);
+    border-radius: var(--token-radius-control);
+    background: var(--token-surface-panel);
+    color: var(--token-ink-primary);
+    font-size: var(--token-text-body-sm);
+    line-height: var(--token-text-body-sm-leading);
+    text-align: start;
+    cursor: pointer;
+  }
+
+  .scope:hover { border-color: var(--token-border-strong); background: var(--token-surface-work); }
+
+  .tag {
+    flex: none;
+    padding: 0 calc(var(--token-spacing-unit) * 1);
+    border-radius: var(--token-radius-control);
+    background: var(--token-color-accent-1-surface);
+    color: var(--token-color-accent-1-text);
+    font-size: 10px;
+    font-weight: 700;
+    letter-spacing: .04em;
+    text-transform: uppercase;
+  }
+
+  .rule { min-width: 0; }
+</style>
~~~~

### changed · `src/lib/development-views/demo/components/demo-index.svelte` (+3 / −3)

~~~~diff
@@ -125,11 +125,11 @@
     },
     {
       href: "/demo/templates",
-      title: "Template library",
-      sub: "The live future state and every boundary behind it",
+      title: "Template reference",
+      sub: "How templates work, and everything that changed",
       icon: Library,
       about:
-        "A live owner-only library in a project-scoped call, beside its data flow, code inventory, access decisions and clearly deferred authoring-session proposal."
+        "Two pages: the model, the three verbs, the working copy and the panels; then the ten systematic changes, the decisions three reviews settled, every file and every check."
     }
   ];
 </script>
~~~~

### new · `src/lib/development-views/template-reference/components/changes-page.svelte` (+285 / −0)

~~~~diff
@@ -0,0 +1,285 @@
+<script lang="ts">
+  import { page } from "$app/state";
+
+  import FileLedger from "$development-views/template-reference/components/file-ledger.svelte";
+  import ReferenceHeader from "$development-views/template-reference/components/reference-header.svelte";
+  import "$development-views/template-reference/components/reference.css";
+  import { DECISIONS, MERGE, MODEL_DELTA, OPEN, SYSTEMATIC, VERIFICATION } from "$development-views/template-reference/procedures/changes";
+  import { BASELINE, FILES } from "$development-views/template-reference/procedures/inventory";
+  import { hrefOf } from "$development-views/template-reference/procedures/navigation";
+
+  let {
+    material,
+    materials = [],
+    onmaterial
+  }: {
+    material?: string;
+    materials?: readonly string[];
+    onmaterial?: (next: string) => void;
+  } = $props();
+
+  const project = $derived(page.params.project ?? "dev-project");
+
+  const app = FILES.filter((file) => file.path.startsWith("app/"));
+  const made = app.filter((file) => file.status === "A").length;
+  const changed = app.filter((file) => file.status === "M").length;
+  const added = app.reduce((sum, file) => sum + file.added, 0);
+  const deleted = app.reduce((sum, file) => sum + file.deleted, 0);
+  const rounds = [...new Set(DECISIONS.map((decision) => decision.round))];
+</script>
+
+<div class="tref">
+  <ReferenceHeader current="changes" {material} {materials} {onmaterial} />
+
+  <main class="tref-page">
+    <header class="tref-mast">
+      <div>
+        <span class="tref-kicker">02 · The audit</span>
+        <h1>What changed</h1>
+        <p class="tref-lede">
+          Fifteen systematic changes, the decisions three reviews settled, every file with its line count, what
+          was run to check the work, and what is still open. Measured against <code>{BASELINE}</code>, the
+          commit this branch sits on, so it keeps saying the same thing as that branch moves on.
+        </p>
+      </div>
+      <div class="tref-facts">
+        <dl>
+          <div><dt>Files under app/</dt><dd>{app.length}</dd></div>
+          <div><dt>Created</dt><dd>{made}</dd></div>
+          <div><dt>Changed</dt><dd>{changed}</dd></div>
+          <div><dt>Lines</dt><dd>+{added.toLocaleString()} / −{deleted.toLocaleString()}</dd></div>
+          <div><dt>Committed</dt><dd>Five commits, on derived outputs</dd></div>
+        </dl>
+      </div>
+    </header>
+
+    <nav class="tref-jumps" aria-label="On this page">
+      <a href="#systematic">Fifteen changes</a>
+      <a href="#model">The model, before and after</a>
+      <a href="#decisions">What the reviews settled</a>
+      <a href="#ledger">Every file</a>
+      <a href="#verification">What was checked</a>
+      <a href="#open">Still open</a>
+      <a href="#merge">Where it sits</a>
+    </nav>
+
+    <section class="tref-section" id="systematic">
+      <div class="tref-section-head">
+        <div><span class="tref-kicker">Before → now</span><h2>Fifteen systematic changes</h2></div>
+        <p>
+          Each is a decision with consequences across several files, written with what it replaced and why,
+          so the page stays useful after the code is familiar.
+        </p>
+      </div>
+
+      {#each SYSTEMATIC as change (change.index)}
+        <article class="tref-change">
+          <span>{change.index}</span>
+          <div>
+            <h3>{change.title}</h3>
+            <p>{change.why}</p>
+          </div>
+          <div class="state before"><span>Before</span><p>{change.before}</p></div>
+          <div class="state after"><span>Now</span><p>{change.now}</p></div>
+        </article>
+      {/each}
+    </section>
+
+    <section class="tref-section" id="model">
+      <div class="tref-section-head">
+        <div><span class="tref-kicker">Representation</span><h2>The model, before and after</h2></div>
+        <p>
+          The vocabulary was meant to move as little as possible. One table, two fields and one term were
+          added; one field was removed from three tables; the template types themselves are untouched.
+        </p>
+      </div>
+
+      <div class="tref-cards">
+        <article class="tref-card">
+          <h3>Added</h3>
+          {#each MODEL_DELTA.added as entry (entry.name)}
+            <p><code>{entry.name}</code> — {entry.note}</p>
+          {/each}
+        </article>
+        <article class="tref-card">
+          <h3>Removed</h3>
+          {#each MODEL_DELTA.removed as entry (entry.name)}
+            <p><code>{entry.name}</code> — {entry.note}</p>
+          {/each}
+        </article>
+        <article class="tref-card">
+          <h3>Deliberately unchanged</h3>
+          {#each MODEL_DELTA.unchanged as entry (entry.name)}
+            <p><code>{entry.name}</code> — {entry.note}</p>
+          {/each}
+        </article>
+      </div>
+
+      <p class="tref-prose">
+        Alongside them, five pure functions were added under <code>representation/data/behavior</code>:
+        resolve a template's prompt scopes through answers then defaults, make a live body portable, mint
+        fresh ids into a fragment, take one slide out of a deck as a deck, and resolve a resource set
+        against a catalogue. They live there because both sides need them — the capability validates with
+        them, the editors insert with them — and because the tree's lint keeps them free of clocks,
+        randomness and stores.
+      </p>
+    </section>
+
+    <section class="tref-section" id="decisions">
+      <div class="tref-section-head">
+        <div><span class="tref-kicker">Review by review</span><h2>What the reviews settled</h2></div>
+        <p>
+          Ten questions were asked and answered across {rounds.length} rounds. Each row is the question, the
+          answer given, and the change it produced — the design record for why the code looks like this.
+        </p>
+      </div>
+
+      <div class="tref-scroll">
+        <table class="tref-table">
+          <thead><tr><th>Round</th><th>Question</th><th>Answer</th><th>What it became</th></tr></thead>
+          <tbody>
+            {#each DECISIONS as decision (decision.question)}
+              <tr>
+                <td>{decision.round}</td>
+                <td>{decision.question}</td>
+                <td>{decision.answer}</td>
+                <td class="muted">{decision.became}</td>
+              </tr>
+            {/each}
+          </tbody>
+        </table>
+      </div>
+    </section>
+
+    <section class="tref-section" id="ledger">
+      <div class="tref-section-head">
+        <div><span class="tref-kicker">The ledger</span><h2>Every file</h2></div>
+        <p>
+          Generated from the working tree against the branch point by
+          <code>scripts/generate-template-reference-inventory.mjs</code>. Filter by area; the counts follow
+          the filter.
+        </p>
+      </div>
+
+      <FileLedger />
+    </section>
+
+    <section class="tref-section" id="verification">
+      <div class="tref-section-head">
+        <div><span class="tref-kicker">Evidence</span><h2>What was checked, and what it said</h2></div>
+        <p>
+          Every command ran in the worktree after the last edit. The browser suite runs against a clean
+          seed with the system Chromium, since the bundled headless shell cannot load its libraries here.
+        </p>
+      </div>
+
+      <div class="tref-scroll">
+        <table class="tref-table">
+          <thead><tr><th>Check</th><th>Command</th><th>Result</th><th></th></tr></thead>
+          <tbody>
+            {#each VERIFICATION as row (row.check)}
+              <tr>
+                <td>{row.check}</td>
+                <td><code>{row.command}</code></td>
+                <td>{row.result}</td>
+                <td><span class="tref-badge" class:clean={row.clean} class:known={!row.clean}>{row.clean ? "clean" : "known"}</span></td>
+              </tr>
+            {/each}
+          </tbody>
+        </table>
+      </div>
+
+      <div class="tref-note">
+        <h4>What the browser run turned up while this was built</h4>
+        <p>
+          The template validator refused a <code>note</code> on a URL link that the vocabulary has allowed
+          since links got notes. An editor names its tab from the workspace's scoped table read, so opening
+          and discarding a working copy now refresh it. An edit that leaves a body alone carries the copy's
+          revision forward, or the next save was refused as stale. And a panel gated on its body unmounted
+          its bands for one frame as a new tab attached, which is why panels are gated on the resource id
+          and a tab can be opened straight onto a named context view.
+        </p>
+      </div>
+    </section>
+
+    <section class="tref-section" id="open">
+      <div class="tref-section-head">
+        <div><span class="tref-kicker">Not settled</span><h2>Still open, each built the recommended way</h2></div>
+        <p>
+          Nothing here blocks the work. Each is a fork that was taken one way so building could continue,
+          with the recommendation written down rather than assumed.
+        </p>
+      </div>
+
+      <div class="tref-cards">
+        {#each OPEN as item (item.title)}
+          <article class="tref-card">
+            <h3>{item.title}</h3>
+            <p>{item.detail}</p>
+            <p class="tref-not">{item.recommendation}</p>
+          </article>
+        {/each}
+      </div>
+    </section>
+
+    <section class="tref-section" id="merge">
+      <div class="tref-section-head">
+        <div><span class="tref-kicker">Already done</span><h2>Where it sits</h2></div>
+        <p>
+          Five commits on <code>work/template-features</code>, sitting on
+          <code>work/derived-output-architecture</code> rather than on main — because that is where
+          prompt blocks are, and a prompt's scope is what a scope hole fills. Everything on this page
+          is measured from there, so the numbers say what this branch adds and nothing else.
+        </p>
+      </div>
+
+      <div class="tref-cards">
+        <article class="tref-card">
+          <h3>Base</h3>
+          <p><code>{MERGE.base}</code> — the head of <code>work/derived-output-architecture</code>, which is itself 21 commits ahead of main.</p>
+        </article>
+        <article class="tref-card">
+          <h3>What the base brought</h3>
+          <p>{MERGE.commits} commits and {MERGE.mainFiles} files since the original branch point: editor stabilization, the editor audit, the withdrawal of header and footer authoring, a pass over the editors' controls, then the semantic overlay, derived outputs and live prompt blocks in both editors.</p>
+        </article>
+        <article class="tref-card">
+          <h3>Files both sides touched</h3>
+          <p>{MERGE.overlap.length} of them, and {MERGE.conflicts.length} ever conflicted. The other {app.length - MERGE.overlap.length} files this branch touches could not.</p>
+        </article>
+      </div>
+
+      <div class="tref-scroll">
+        <table class="tref-table">
+          <thead><tr><th>File</th><th>How it was reconciled</th></tr></thead>
+          <tbody>
+            {#each MERGE.conflicts as row (row.path)}
+              <tr><td><code>{row.path}</code></td><td>{row.note}</td></tr>
+            {/each}
+          </tbody>
+        </table>
+      </div>
+
+      <div class="tref-note success">
+        <h4>The rest merged without a decision</h4>
+        <p>
+          {MERGE.overlap.length - MERGE.conflicts.length} of the {MERGE.overlap.length} were edited on both
+          sides but never on the same lines, across five rebases. Every check was re-run afterwards, and the
+          move onto derived outputs turned up one real defect of its own: the templates validator refused a
+          Prompt Block carrying a named style, which is exactly what a text box keeps when it is converted
+          in place.
+        </p>
+      </div>
+    </section>
+  </main>
+
+  <footer class="tref-footer">
+    <div>
+      <span>Icarus · templates</span>
+      <span>Measured against {BASELINE}</span>
+    </div>
+    <div>
+      <a href={hrefOf(project, "system")}>← How templates work</a>
+      <a href={`/app/${project}`}>Open the app</a>
+    </div>
+  </footer>
+</div>
~~~~

### new · `src/lib/development-views/template-reference/components/diagram-binding.svelte` (+168 / −0)

~~~~diff
@@ -0,0 +1,168 @@
+<script lang="ts">
+  const named = [
+    { field: "name", value: "\"Winter filings\"" },
+    { field: "boundTo", value: "absent" },
+    { field: "set", value: "{ include, exclude }" }
+  ];
+
+  const bound = [
+    { field: "name", value: "absent" },
+    { field: "boundTo", value: "{ hole, templateId, name }" },
+    { field: "set", value: "{ include, exclude }" }
+  ];
+</script>
+
+<div class="binding">
+  <section class="lane">
+    <header><span class="tag named">Named</span><b>A project subject</b></header>
+    <p>Made in Contexts, listed there, offered by every builder, and deleted only when nothing names it.</p>
+    <dl class="row">
+      {#each named as line (line.field)}
+        <div><dt>{line.field}</dt><dd>{line.value}</dd></div>
+      {/each}
+    </dl>
+    <ul>
+      <li>Appears in <code>readResourceSets</code></li>
+      <li>Refuses removal while a set or a hole names it</li>
+      <li>Survives everything that points at it</li>
+    </ul>
+  </section>
+
+  <section class="lane">
+    <header><span class="tag bound">Bound</span><b>A value something holds</b></header>
+    <p>Written by the server when a chosen rule cannot be said inline. Never listed, never named, never reused.</p>
+    <dl class="row">
+      {#each bound as line (line.field)}
+        <div><dt>{line.field}</dt><dd>{line.value}</dd></div>
+      {/each}
+    </dl>
+    <ul>
+      <li>Read only through the id that points at it</li>
+      <li>Removed with its owner</li>
+      <li>Two holes that build the same rule get two rows, and that is correct</li>
+    </ul>
+  </section>
+</div>
+
+<div class="pointers">
+  <div class="from">
+    <code>templates.holes[i].default</code>
+    <small>a template's project-local metadata</small>
+  </div>
+  <div class="arrow" aria-hidden="true">→</div>
+  <div class="term"><code>{"{ select: \"set\", setId }"}</code><small>one term, so it substitutes on either side</small></div>
+  <div class="arrow" aria-hidden="true">→</div>
+  <div class="to bound-to"><b>A bound row</b><small>owner: that hole</small></div>
+
+  <div class="from">
+    <code>documents.body … prompt.scope</code>
+    <small>a placed copy, after Insert or Use</small>
+  </div>
+  <div class="arrow" aria-hidden="true">→</div>
+  <div class="term"><code>{"{ select: \"set\", setId }"}</code><small>the only way a body can name particular resources</small></div>
+  <div class="arrow" aria-hidden="true">→</div>
+  <div class="to bound-to"><b>A bound row</b><small>owner: that resource</small></div>
+
+  <div class="from">
+    <code>Contexts · New set</code>
+    <small>somebody curating the project</small>
+  </div>
+  <div class="arrow" aria-hidden="true">→</div>
+  <div class="term"><code>createResourceSet(name, rule)</code><small>the only door that takes a name</small></div>
+  <div class="arrow" aria-hidden="true">→</div>
+  <div class="to named-to"><b>A named row</b><small>listed, offerable, reusable</small></div>
+</div>
+
+<style>
+  .binding { display: grid; grid-template-columns: repeat(auto-fit, minmax(19rem, 1fr)); gap: 1.25rem; }
+
+  .lane {
+    display: grid;
+    align-content: start;
+    gap: .6rem;
+    padding: 1rem;
+    border: 1px solid var(--token-border-subtle);
+    border-radius: 8px;
+    background: var(--token-surface-elevated);
+  }
+
+  header { display: flex; align-items: center; gap: .5rem; }
+  header b { font-size: 13.5px; }
+
+  .tag {
+    padding: .1rem .4rem;
+    border-radius: 4px;
+    font-family: "IBM Plex Mono", ui-monospace, monospace;
+    font-size: 9px;
+    font-weight: 750;
+    letter-spacing: .08em;
+    text-transform: uppercase;
+  }
+
+  .tag.named { background: var(--token-color-accent-2-surface); color: var(--token-color-accent-2-text); }
+  .tag.bound { background: var(--token-color-accent-1-surface); color: var(--token-color-accent-1-text); }
+
+  .lane > p { margin: 0; color: var(--token-ink-secondary); font-size: 12.5px; }
+
+  .row {
+    display: grid;
+    gap: .2rem;
+    margin: 0;
+    padding: .6rem .7rem;
+    border-radius: 6px;
+    background: var(--token-surface-work);
+  }
+
+  .row div { display: flex; justify-content: space-between; gap: 1rem; }
+
+  dt {
+    color: var(--token-ink-muted);
+    font-family: "IBM Plex Mono", ui-monospace, monospace;
+    font-size: 11px;
+  }
+
+  dd {
+    margin: 0;
+    font-family: "IBM Plex Mono", ui-monospace, monospace;
+    font-size: 11px;
+    text-align: right;
+  }
+
+  .lane ul { margin: 0; padding-left: 1.05rem; color: var(--token-ink-secondary); font-size: 12px; }
+  .lane li { margin-bottom: .2rem; }
+
+  .pointers {
+    display: grid;
+    grid-template-columns: minmax(0, 1.1fr) auto minmax(0, 1.3fr) auto minmax(0, .9fr);
+    gap: .6rem .8rem;
+    align-items: center;
+    margin-top: 1.5rem;
+  }
+
+  .from,
+  .term,
+  .to { display: grid; gap: .1rem; padding: .55rem .7rem; border-radius: 6px; }
+
+  .from { background: var(--token-surface-work); }
+  .term { border: 1px dashed var(--token-border-strong); }
+  .to { background: var(--token-surface-elevated); border: 1px solid var(--token-border-subtle); }
+  .to.bound-to { border-color: var(--token-color-accent-1-text); }
+  .to.named-to { border-color: var(--token-color-accent-2-text); }
+
+  .pointers code {
+    font-family: "IBM Plex Mono", ui-monospace, monospace;
+    font-size: 11px;
+    overflow-wrap: anywhere;
+  }
+
+  .to b { font-size: 12px; }
+  .pointers small { color: var(--token-ink-muted); font-size: 10.5px; }
+  .arrow { color: var(--token-ink-muted); font-size: 15px; text-align: center; }
+
+  @media (max-width: 64rem) {
+    .pointers { grid-template-columns: minmax(0, 1fr); }
+    .arrow { display: none; }
+    .term { margin-left: 1rem; }
+    .to { margin-left: 2rem; }
+  }
+</style>
~~~~

### new · `src/lib/development-views/template-reference/components/diagram-builder.svelte` (+274 / −0)

~~~~diff
@@ -0,0 +1,274 @@
+<script lang="ts">
+  const offers = [
+    { label: "Winter readiness brief", note: "document" },
+    { label: "Substation 14 incident write-up", note: "document" },
+    { label: "Interconnect glossary", note: "document" },
+    { label: "Board review — Q1 exposure", note: "slides" }
+  ];
+</script>
+
+<div class="builder">
+  <figure class="mock">
+    <figcaption>Placing a template asks for everything at once</figcaption>
+    <div class="modal">
+      <header>
+        <b>Insert “Client status note”</b>
+        <p>Every hole this template asks for.</p>
+      </header>
+      <div class="body">
+        <div class="row needs">
+          <b>Client name</b>
+          <p class="what">Who this note is addressed to, exactly as they should see it.</p>
+          <div class="field">What client name says here</div>
+        </div>
+        <div class="row">
+          <b>Reporting period</b>
+          <p class="what">The window this note covers, in whatever words the client uses.</p>
+          <div class="field filled">the last four weeks</div>
+        </div>
+        <div class="row">
+          <b>Status evidence</b>
+          <p class="what">The findings and documents this note should be written from.</p>
+          <div class="scope"><span class="tag">Default</span> Findings</div>
+        </div>
+      </div>
+      <footer>
+        <span class="blocked">Client name still needs words.</span>
+        <span class="ghost">Cancel</span><span class="primary">Insert</span>
+      </footer>
+    </div>
+  </figure>
+
+  <figure class="mock">
+    <figcaption>The builder, on the side being edited</figcaption>
+    <div class="modal">
+      <header>
+        <b>What Source material selects here</b>
+        <p>For this copy only. Nothing here changes the template.</p>
+      </header>
+      <div class="body">
+        <div class="tabs"><span>Include <i>1</i></span><span class="on">Exclude <i>0</i></span></div>
+        <div class="panes">
+          <section class="pane">
+            <b>From</b>
+            <div class="sources"><span>Kinds</span><span>Sets</span><span class="on">Resources</span></div>
+            <div class="search">Search this project…</div>
+            {#each offers as offer (offer.label)}
+              <div class="offer"><span>{offer.label}</span><small>{offer.note}</small><span class="add">Add</span></div>
+            {/each}
+          </section>
+          <section class="pane">
+            <b>Excluded</b>
+            <p class="empty">Nothing is taken back out.</p>
+          </section>
+        </div>
+        <div class="foot">
+          <span class="floor">
+            <span class="add">Whole project</span><span class="ghost">Default</span><span class="ghost">Clear</span>
+          </span>
+          <span class="count"><b>6</b> resources <span class="ghost">Show</span></span>
+        </div>
+      </div>
+      <footer><span class="ghost">Cancel</span><span class="primary">Use this</span></footer>
+    </div>
+  </figure>
+</div>
+
+<ul class="notes">
+  <li>
+    <b>Every hole, always, and nothing folded away.</b> Each row reads top to bottom: the name,
+    the sentence whoever made the template wrote, and the value. A row with nothing in it carries a
+    rule down its left edge, and the confirm says which one is holding it up.
+  </li>
+  <li>
+    <b>The value is the control.</b> Text is a field. A scope is a block reading what it selects, with
+    Default or Chosen beside it, which opens the builder when pressed. Nothing here is a menu, and
+    nothing opens a third lid.
+  </li>
+  <li>
+    <b>The list scrolls; the modal does not grow.</b> A template with twelve holes and one with
+    two open the same size, and both panes of the builder are one fixed height, so nothing jumps as
+    somebody clicks between Kinds, Sets and Resources.
+  </li>
+  <li>
+    <b>One term, one row.</b> A stored rule may hold three kinds in one term; the builder splits them,
+    because what you can take out should be what you put in.
+  </li>
+  <li>
+    <b>The floor is a button.</b> Whole project is the common answer, Default puts a hole back to
+    what the template suggested, and Clear empties both sides to start again.
+  </li>
+</ul>
+
+<style>
+  .builder { display: grid; grid-template-columns: repeat(auto-fit, minmax(21rem, 1fr)); gap: 1.5rem; }
+
+  .mock { margin: 0; }
+
+  figcaption {
+    margin-bottom: .5rem;
+    color: var(--token-ink-muted);
+    font-size: 10.5px;
+    font-weight: 700;
+    letter-spacing: .1em;
+    text-transform: uppercase;
+  }
+
+  .modal {
+    display: grid;
+    border: 1px solid var(--token-border-strong);
+    border-radius: 10px;
+    background: var(--token-surface-canvas);
+    box-shadow: var(--token-shadow-overlay);
+    font-size: 11.5px;
+  }
+
+  header { padding: .8rem .9rem; border-bottom: 1px solid var(--token-border-subtle); }
+  header b { font-size: 12.5px; }
+  header p { margin: .2rem 0 0; color: var(--token-ink-muted); font-size: 11px; }
+
+  .body { display: grid; gap: .6rem; padding: .9rem; }
+
+  .row {
+    display: grid;
+    gap: .3rem;
+    padding: .5rem .55rem;
+    border: 1px solid var(--token-border-subtle);
+    border-inline-start: 3px solid transparent;
+    border-radius: 6px;
+    background: var(--token-surface-elevated);
+  }
+
+  .row.needs { border-inline-start-color: var(--token-color-danger-text); }
+  .row b { font-weight: 650; }
+
+  .what { margin: 0; color: var(--token-ink-secondary); font-size: 10.5px; }
+
+  .field,
+  .search,
+  .scope {
+    padding: .35rem .5rem;
+    border: 1px solid var(--token-border-subtle);
+    border-radius: 6px;
+    background: var(--token-surface-elevated);
+    color: var(--token-ink-muted);
+  }
+
+  .field { min-height: 2rem; }
+  .field.filled { color: var(--token-ink-primary); }
+  .scope { display: flex; gap: .45rem; align-items: center; background: var(--token-surface-panel); color: var(--token-ink-primary); }
+
+  .tag {
+    padding: 0 .3rem;
+    border-radius: 4px;
+    background: var(--token-color-accent-1-surface);
+    color: var(--token-color-accent-1-text);
+    font-size: 8.5px;
+    font-weight: 750;
+    letter-spacing: .06em;
+    text-transform: uppercase;
+  }
+
+  .tabs { display: flex; gap: .5rem; border-bottom: 1px solid var(--token-border-subtle); }
+
+  .tabs span {
+    display: flex;
+    align-items: center;
+    gap: .3rem;
+    padding: .3rem .45rem;
+    color: var(--token-ink-secondary);
+    font-weight: 650;
+  }
+
+  .tabs .on { box-shadow: inset 0 -2px 0 var(--token-color-active-text); color: var(--token-color-active-text); }
+
+  .tabs i {
+    padding: 0 .3rem;
+    border-radius: 4px;
+    background: var(--token-surface-work);
+    color: var(--token-ink-muted);
+    font-size: 9px;
+    font-style: normal;
+  }
+
+  .panes { display: grid; grid-template-columns: 1fr 1fr; gap: .6rem; }
+
+  .pane {
+    display: grid;
+    align-content: start;
+    gap: .35rem;
+    min-height: 9rem;
+    padding: .5rem;
+    border: 1px solid var(--token-border-subtle);
+    border-radius: 8px;
+    background: var(--token-surface-panel);
+  }
+
+  .pane > b {
+    color: var(--token-ink-muted);
+    font-size: 9px;
+    font-weight: 750;
+    letter-spacing: .1em;
+    text-transform: uppercase;
+  }
+
+  .sources { display: flex; gap: .25rem; }
+
+  .sources span {
+    padding: .1rem .35rem;
+    border-radius: 4px;
+    color: var(--token-ink-secondary);
+    font-size: 10px;
+  }
+
+  .sources .on { background: var(--token-color-active-surface); color: var(--token-color-active-text); }
+
+  .offer {
+    display: grid;
+    grid-template-columns: minmax(0, 1fr) auto auto;
+    gap: .35rem;
+    align-items: center;
+    padding: .2rem 0;
+    border-bottom: 1px solid var(--token-border-subtle);
+  }
+
+  .offer > span:first-child { overflow: hidden; font-size: 10.5px; text-overflow: ellipsis; white-space: nowrap; }
+  .offer small { color: var(--token-ink-muted); font-size: 9px; }
+
+  .empty { margin: 0; color: var(--token-ink-muted); font-size: 10px; font-style: italic; }
+
+  .foot { display: flex; align-items: center; justify-content: space-between; gap: .5rem; }
+  .floor { display: flex; gap: .35rem; }
+  .count { display: flex; align-items: baseline; gap: .3rem; color: var(--token-ink-secondary); font-size: 10.5px; }
+  .count b { color: var(--token-ink-primary); font-size: 15px; }
+
+  footer {
+    display: flex;
+    flex-wrap: wrap;
+    align-items: center;
+    justify-content: flex-end;
+    gap: .4rem;
+    padding: .7rem .9rem;
+    border-top: 1px solid var(--token-border-subtle);
+  }
+
+  .blocked { margin-inline-end: auto; color: var(--token-color-attention-text); font-size: 10.5px; }
+
+  .add,
+  .ghost,
+  .primary {
+    padding: .15rem .5rem;
+    border-radius: 5px;
+    font-size: 10px;
+    font-weight: 650;
+    white-space: nowrap;
+  }
+
+  .add,
+  .ghost { border: 1px solid var(--token-border-subtle); color: var(--token-ink-secondary); }
+  .primary { background: var(--token-color-active-text); color: var(--token-surface-canvas); }
+
+  .notes { margin: 1.5rem 0 0; padding-left: 1.1rem; color: var(--token-ink-secondary); font-size: 13px; }
+  .notes li { margin-bottom: .45rem; }
+  .notes b { color: var(--token-ink-primary); }
+</style>
~~~~

### new · `src/lib/development-views/template-reference/components/diagram-difference.svelte` (+128 / −0)

~~~~diff
@@ -0,0 +1,128 @@
+<script lang="ts">
+  const included = [
+    { term: "kinds", reads: "Documents", picks: 12 },
+    { term: "set", reads: "Winter filings", picks: 9 },
+    { term: "resources", reads: "Q3 exposure memo", picks: 1 }
+  ];
+
+  const excluded = [
+    { term: "kinds", reads: "Research threads", picks: 4 },
+    { term: "resources", reads: "Board review", picks: 1 }
+  ];
+</script>
+
+<div class="difference">
+  <section class="lane include">
+    <header><b>Include</b><span>union</span></header>
+    {#each included as term (term.reads)}
+      <div class="term">
+        <code>{term.term}</code>
+        <b>{term.reads}</b>
+        <span>{term.picks}</span>
+      </div>
+    {/each}
+    <footer>17 distinct resources</footer>
+  </section>
+
+  <div class="operator" aria-hidden="true">−</div>
+
+  <section class="lane exclude">
+    <header><b>Exclude</b><span>union</span></header>
+    {#each excluded as term (term.reads)}
+      <div class="term">
+        <code>{term.term}</code>
+        <b>{term.reads}</b>
+        <span>{term.picks}</span>
+      </div>
+    {/each}
+    <footer>5 distinct resources</footer>
+  </section>
+
+  <div class="operator" aria-hidden="true">=</div>
+
+  <section class="lane result">
+    <header><b>Selects</b><span>now</span></header>
+    <div class="count"><b>13</b><span>resources</span></div>
+    <p>Counted when the set is read, never stored. A document made after this was built is already inside it.</p>
+  </section>
+</div>
+
+<style>
+  .difference {
+    display: grid;
+    grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr) auto minmax(0, 1fr);
+    gap: .9rem;
+    align-items: stretch;
+  }
+
+  .lane {
+    display: grid;
+    align-content: start;
+    gap: .4rem;
+    padding: .85rem;
+    border: 1px solid var(--token-border-subtle);
+    border-radius: 8px;
+    background: var(--token-surface-elevated);
+  }
+
+  .lane.exclude { background: var(--token-surface-work); }
+  .lane.result { border-color: var(--token-color-active-text); background: var(--token-color-active-surface); }
+
+  header {
+    display: flex;
+    align-items: baseline;
+    justify-content: space-between;
+    gap: .5rem;
+    padding-bottom: .35rem;
+    border-bottom: 1px solid var(--token-border-subtle);
+  }
+
+  header b { font-size: 10px; font-weight: 750; letter-spacing: .12em; text-transform: uppercase; }
+  header span { color: var(--token-ink-muted); font-size: 10px; }
+
+  .term {
+    display: grid;
+    grid-template-columns: auto minmax(0, 1fr) auto;
+    gap: .5rem;
+    align-items: center;
+    font-size: 12px;
+  }
+
+  .term code {
+    padding: .05rem .3rem;
+    border-radius: 3px;
+    background: var(--token-surface-canvas);
+    color: var(--token-ink-muted);
+    font-family: "IBM Plex Mono", ui-monospace, monospace;
+    font-size: 9.5px;
+  }
+
+  .term b { overflow: hidden; font-weight: 600; text-overflow: ellipsis; white-space: nowrap; }
+  .term span { color: var(--token-ink-muted); font-family: "IBM Plex Mono", ui-monospace, monospace; font-size: 11px; }
+
+  footer {
+    margin-top: .2rem;
+    padding-top: .35rem;
+    border-top: 1px dashed var(--token-border-subtle);
+    color: var(--token-ink-muted);
+    font-size: 11px;
+  }
+
+  .operator {
+    align-self: center;
+    color: var(--token-ink-muted);
+    font-family: "IBM Plex Mono", ui-monospace, monospace;
+    font-size: 18px;
+  }
+
+  .count { display: flex; align-items: baseline; gap: .4rem; }
+  .count b { font-size: 26px; font-weight: 700; letter-spacing: -.02em; }
+  .count span { color: var(--token-ink-secondary); font-size: 12px; }
+
+  .result p { margin: .2rem 0 0; color: var(--token-ink-secondary); font-size: 11.5px; }
+
+  @media (max-width: 60rem) {
+    .difference { grid-template-columns: minmax(0, 1fr); }
+    .operator { justify-self: center; }
+  }
+</style>
~~~~

### new · `src/lib/development-views/template-reference/components/diagram-panel.svelte` (+128 / −0)

~~~~diff
@@ -0,0 +1,128 @@
+<script lang="ts">
+</script>
+
+<div class="panels">
+  <figure class="mock">
+    <figcaption>An ordinary document or deck</figcaption>
+    <div class="panel">
+      <header><b>Templates</b></header>
+      <div class="field"><span class="input">Winter readiness brief</span><span class="button primary">Save</span></div>
+      <div class="hint">The name is required; Save opens the new template's working copy in a new tab.</div>
+      <div class="section">List <em>⌄</em></div>
+      <div class="search">Search templates…</div>
+      <div class="row"><b>Decision memo</b><small>2 holes · revision 4</small><span><span class="button">Insert</span><span class="button">Edit</span></span></div>
+      <div class="row"><b>Technical glossary</b><small>1 hole · revision 3</small><span><span class="button">Insert</span><span class="button">Edit</span></span></div>
+    </div>
+  </figure>
+
+  <figure class="mock">
+    <figcaption>The same panel on a working copy</figcaption>
+    <div class="panel">
+      <header><b>Templates</b><span class="actions"><span class="button primary">Save</span><span class="button danger">Discard</span></span></header>
+      <div class="section">Holes <em>1 ⌄</em></div>
+      <div class="hole">
+        <span class="chip">source_material</span>
+        <b>Source material</b>
+        <span class="description">Documents and findings whose terminology should be normalized.</span>
+        <span class="button wide">Default scope</span>
+      </div>
+      <div class="section">List <em>⌄</em></div>
+      <div class="search">Search templates…</div>
+      <div class="row"><b>Decision memo</b><small>2 holes · revision 4</small><span><span class="button">Insert</span><span class="button">Edit</span></span></div>
+    </div>
+  </figure>
+</div>
+
+<ul class="notes">
+  <li><b>No name field</b> on a working copy — the tab already says <code>Template · name</code>, and Save and Discard sit where it was, above a rule.</li>
+  <li><b>Create hole</b> sits at the top of Holes and makes a text hole: it takes a name, a description and default words, then drops the atom at the caret. A scope hole cannot be made here — that list is what the body's prompts ask for.</li>
+  <li><b>Default scope</b> opens the modal; what it currently selects is on the button's title rather than in its label.</li>
+  <li><b>List</b> is a collapsible section of its own behind a rule, so inserting a template into a template is plainly a different thing from the holes above it.</li>
+</ul>
+
+<style>
+  .panels { display: grid; grid-template-columns: repeat(auto-fit, minmax(19rem, 1fr)); gap: 1.5rem; }
+
+  .mock { margin: 0; }
+
+  figcaption { margin-bottom: .5rem; color: var(--token-ink-muted); font-size: 10.5px; font-weight: 700; letter-spacing: .1em; text-transform: uppercase; }
+
+  .panel {
+    display: grid;
+    gap: .5rem;
+    padding: .7rem;
+    border: 1px solid var(--token-border-subtle);
+    border-radius: 8px;
+    background: var(--token-surface-panel);
+    font-size: 11.5px;
+  }
+
+  header { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: .4rem; padding-bottom: .5rem; border-bottom: 1px solid var(--token-border-subtle); }
+  header b { font-size: 12.5px; }
+  .actions { display: flex; gap: .3rem; }
+
+  .field { display: grid; gap: .35rem; }
+
+  .input {
+    padding: .35rem .5rem;
+    border: 1px solid var(--token-border-strong);
+    border-radius: 5px;
+    background: var(--token-surface-canvas);
+    color: var(--token-ink-primary);
+  }
+
+  .button {
+    display: inline-block;
+    padding: .25rem .55rem;
+    border: 1px solid var(--token-border-subtle);
+    border-radius: 5px;
+    background: var(--token-surface-elevated);
+    color: var(--token-ink-secondary);
+    font-size: 10.5px;
+    font-weight: 650;
+  }
+
+  .button.primary { border-color: var(--token-color-active-text); background: var(--token-color-active-surface); color: var(--token-color-active-text); }
+  .button.danger { border-color: var(--token-color-danger-text); background: var(--token-color-danger-surface); color: var(--token-color-danger-text); }
+  .button.wide { justify-self: start; }
+
+  .hint { color: var(--token-ink-muted); font-size: 10.5px; }
+
+  .section {
+    display: flex;
+    justify-content: space-between;
+    margin-top: .3rem;
+    padding-top: .5rem;
+    border-top: 1px solid var(--token-border-subtle);
+    color: var(--token-ink-secondary);
+    font-size: 10.5px;
+    font-weight: 750;
+    letter-spacing: .08em;
+    text-transform: uppercase;
+  }
+
+  .section em { color: var(--token-ink-muted); font-style: normal; }
+
+  .search { padding: .3rem .5rem; border: 1px solid var(--token-border-subtle); border-radius: 5px; color: var(--token-ink-muted); }
+
+  .row { display: grid; gap: .1rem; padding: .4rem .1rem; border-top: 1px solid var(--token-border-subtle); }
+  .row small { color: var(--token-ink-muted); font-size: 10px; }
+  .row span { display: flex; gap: .3rem; margin-top: .2rem; }
+
+  .hole { display: grid; justify-items: start; gap: .35rem; padding: .5rem; border: 1px solid var(--token-border-subtle); border-radius: 6px; background: var(--token-surface-elevated); }
+  .description { color: var(--token-ink-secondary); }
+
+  .chip {
+    padding: .05rem .35rem;
+    border: 1px solid var(--token-color-accent-1-border);
+    border-radius: 4px;
+    background: var(--token-color-accent-1-surface);
+    color: var(--token-color-accent-1-text);
+    font-family: "IBM Plex Mono", ui-monospace, monospace;
+    font-size: 10px;
+  }
+
+  .notes { max-width: 70ch; margin: 1.4rem 0 0; padding-left: 1.1rem; list-style: disc; color: var(--token-ink-secondary); font-size: 13px; }
+  .notes li { margin-bottom: .35rem; }
+  .notes code { font-family: "IBM Plex Mono", ui-monospace, monospace; font-size: 11.5px; }
+</style>
~~~~

### new · `src/lib/development-views/template-reference/components/diagram-rows.svelte` (+75 / −0)

~~~~diff
@@ -0,0 +1,75 @@
+<script lang="ts">
+</script>
+
+<div class="rows">
+  <section class="group template">
+    <h4>What the template is</h4>
+    <ul>
+      <li><code>templates</code><span>projectId, name, tags, body, holes, revision, lastUsedAt</span></li>
+      <li><code>templateVersions</code><span>one row per revision, never read back yet</span></li>
+    </ul>
+    <p class="writer">Written by <code>createTemplate</code>, <code>createTemplateFromResource</code>, <code>updateTemplate</code>, <code>commitTemplateStage</code>, <code>duplicateTemplate</code>, <code>removeTemplate</code></p>
+  </section>
+
+  <section class="group stage">
+    <h4>What makes a resource a working copy</h4>
+    <ul>
+      <li><code>templateStages</code><span>projectId, templateId, templateRevision, target, resourceId</span></li>
+    </ul>
+    <p class="writer">Written by <code>openTemplateStage</code>, moved by <code>updateTemplate</code> and <code>commitTemplateStage</code>, removed by <code>discardTemplateStage</code> and by deleting the template</p>
+  </section>
+
+  <section class="group resource">
+    <h4>What the editor actually opens</h4>
+    <ul>
+      <li><code>documents · slideDecks</code><span>an ordinary row, titled Template · name</span></li>
+      <li><code>documentSnapshots · slideDeckSnapshots</code><span>the leader body the editor edits</span></li>
+      <li><code>documentChangeSets · slideDeckChangeSets</code><span>the ledger, as for any resource</span></li>
+    </ul>
+    <p class="writer">Written by the document and deck capabilities, which know nothing about templates</p>
+  </section>
+</div>
+
+<p class="left-out">
+  Project Overview, New Tab's recents and the comment picker all read
+  <code>readProjectResourceIndex</code>, which skips any resource a stage row occupies — so a working
+  copy is invisible everywhere except the tab it is open in.
+</p>
+
+<style>
+  .rows { display: grid; grid-template-columns: repeat(auto-fit, minmax(17rem, 1fr)); gap: 1rem; }
+
+  .group {
+    padding: 1.1rem 1.2rem;
+    border: 1px solid var(--token-border-subtle);
+    border-radius: 10px;
+    background: var(--token-surface-elevated);
+  }
+
+  .group.template { border-color: var(--token-color-active-text); background: var(--token-color-active-surface); }
+  .group.stage { border-color: var(--token-color-accent-1-text); background: var(--token-color-accent-1-surface); }
+
+  h4 { margin: 0 0 .7rem; font-size: 12px; letter-spacing: .02em; }
+
+  ul { display: grid; gap: .5rem; margin: 0; padding: 0; list-style: none; }
+
+  li { display: grid; gap: .15rem; }
+
+  li code {
+    justify-self: start;
+    padding: .1rem .35rem;
+    border-radius: 4px;
+    background: var(--token-surface-canvas);
+    font-family: "IBM Plex Mono", ui-monospace, monospace;
+    font-size: 11.5px;
+    font-weight: 650;
+  }
+
+  li span { color: var(--token-ink-secondary); font-size: 11.5px; }
+
+  .writer { margin: .9rem 0 0; padding-top: .7rem; border-top: 1px solid var(--token-border-subtle); color: var(--token-ink-muted); font-size: 11px; }
+  .writer code { font-family: "IBM Plex Mono", ui-monospace, monospace; font-size: 10.5px; }
+
+  .left-out { max-width: 70ch; margin: 1rem 0 0; color: var(--token-ink-secondary); font-size: 13px; }
+  .left-out code { font-family: "IBM Plex Mono", ui-monospace, monospace; font-size: 11.5px; }
+</style>
~~~~

### new · `src/lib/development-views/template-reference/components/diagram-saves.svelte` (+63 / −0)

~~~~diff
@@ -0,0 +1,63 @@
+<script lang="ts">
+  const KEYSTROKES = [200, 250, 300, 350, 400, 450, 500, 620, 670, 720];
+  const FLUSHES = [210, 260, 310, 360, 410, 460, 510, 630, 680, 730];
+</script>
+
+<svg class="saves" viewBox="0 0 980 300" role="img" aria-label="The editor autosaves the working copy continuously; pressing Save moves the template's revision once">
+  <defs>
+    <marker id="tref-tick" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
+      <path d="M 0 0 L 10 5 L 0 10 z" class="head" />
+    </marker>
+  </defs>
+
+  <text x="20" y="28" class="lane-name">You</text>
+  <text x="20" y="48" class="lane-hint">typing, moving blocks</text>
+  <line x1="150" y1="34" x2="940" y2="34" class="rail" marker-end="url(#tref-tick)" />
+  {#each KEYSTROKES as at (at)}
+    <circle cx={at} cy="34" r="4" class="dot" />
+  {/each}
+  <text x="560" y="26" class="press">press Save in the panel</text>
+  <path d="M 560 40 L 560 96" class="press-line" marker-end="url(#tref-tick)" />
+
+  <text x="20" y="128" class="lane-name">The working copy</text>
+  <text x="20" y="148" class="lane-hint">an ordinary resource</text>
+  <line x1="150" y1="134" x2="940" y2="134" class="rail solid" marker-end="url(#tref-tick)" />
+  {#each FLUSHES as at (at)}
+    <rect x={at - 3} y="126" width="6" height="16" rx="2" class="flush" />
+  {/each}
+  <text x="212" y="170" class="note">the editor flushes as you go — this is the save you already know</text>
+
+  <text x="20" y="228" class="lane-name">The template</text>
+  <text x="20" y="248" class="lane-hint">what everyone else uses</text>
+  <line x1="150" y1="234" x2="940" y2="234" class="rail solid" marker-end="url(#tref-tick)" />
+  <rect x="150" y="212" width="410" height="44" rx="8" class="rev" />
+  <text x="170" y="240" class="rev-label">revision 4 · unchanged all this time</text>
+  <rect x="562" y="212" width="378" height="44" rx="8" class="rev next" />
+  <text x="582" y="240" class="rev-label">revision 5 · the copy's body, made portable</text>
+  <path d="M 560 150 L 560 208" class="press-line" marker-end="url(#tref-tick)" />
+
+  <text x="20" y="288" class="note">Two different saves: one keeps your work, one publishes it. Only the second one moves the template.</text>
+</svg>
+
+<style>
+  .saves { display: block; width: 100%; height: auto; }
+
+  .lane-name { fill: var(--token-ink-primary); font: 700 13px/1 "IBM Plex Sans", ui-sans-serif, system-ui, sans-serif; }
+  .lane-hint { fill: var(--token-ink-muted); font: 400 11px/1 "IBM Plex Sans", ui-sans-serif, system-ui, sans-serif; }
+
+  .rail { stroke: var(--token-border-subtle); stroke-width: 2; stroke-dasharray: 4 5; }
+  .rail.solid { stroke-dasharray: none; }
+  .head { fill: var(--token-border-strong); }
+
+  .dot { fill: var(--token-ink-muted); }
+  .flush { fill: var(--token-color-accent-1-text); }
+
+  .press { fill: var(--token-color-active-text); font: 700 12px/1 "IBM Plex Mono", ui-monospace, monospace; }
+  .press-line { fill: none; stroke: var(--token-color-active-text); stroke-width: 2; stroke-dasharray: 5 4; }
+
+  .rev { fill: var(--token-surface-work); stroke: var(--token-border-subtle); }
+  .rev.next { fill: var(--token-color-active-surface); stroke: var(--token-color-active-text); }
+  .rev-label { fill: var(--token-ink-secondary); font: 400 12.5px/1 "IBM Plex Sans", ui-sans-serif, system-ui, sans-serif; }
+
+  .note { fill: var(--token-ink-muted); font: 400 12px/1 "IBM Plex Sans", ui-sans-serif, system-ui, sans-serif; }
+</style>
~~~~

### new · `src/lib/development-views/template-reference/components/diagram-scope.svelte` (+87 / −0)

~~~~diff
@@ -0,0 +1,87 @@
+<script lang="ts">
+</script>
+
+<div class="funnel">
+  <ol>
+    <li class="answer">
+      <span class="rank">1</span>
+      <div>
+        <b>What the person said</b>
+        <p>The answer chosen in the Insert or Use modal, for this copy only. Stored nowhere.</p>
+      </div>
+      <code>answers[name]</code>
+    </li>
+    <li class="fallback">
+      <span class="rank">2</span>
+      <div>
+        <b>Else the hole's default scope</b>
+        <p>Everything in the project, particular kinds, one of the project's named sets — or another hole, expanded the same way.</p>
+      </div>
+      <code>hole.default</code>
+    </li>
+    <li class="floor">
+      <span class="rank">3</span>
+      <div>
+        <b>Else everything in the project</b>
+        <p>A hole with no default, or one that reaches itself. There is always an answer, so a template always resolves.</p>
+      </div>
+      <code>{"{ select: \"project\" }"}</code>
+    </li>
+  </ol>
+  <p class="undeclared">
+    A prompt naming a hole the template does not declare is the one thing that refuses:
+    <code>unsupported-body</code>, with the names, rather than a guess.
+  </p>
+</div>
+
+<style>
+  .funnel { display: grid; gap: 1rem; }
+
+  ol { display: grid; gap: .55rem; margin: 0; padding: 0; list-style: none; }
+
+  li {
+    display: grid;
+    grid-template-columns: 2rem minmax(0, 1fr) auto;
+    gap: 1rem;
+    align-items: center;
+    padding: .9rem 1.1rem;
+    border: 1px solid var(--token-border-subtle);
+    border-radius: 8px;
+    background: var(--token-surface-elevated);
+  }
+
+  li.answer { width: 100%; border-color: var(--token-color-active-text); background: var(--token-color-active-surface); }
+  li.fallback { width: 94%; }
+  li.floor { width: 88%; background: var(--token-surface-work); }
+
+  .rank {
+    display: grid;
+    width: 1.6rem;
+    height: 1.6rem;
+    place-items: center;
+    border-radius: 50%;
+    background: var(--token-ink-primary);
+    color: var(--token-surface-canvas);
+    font: 700 11px/1 "IBM Plex Mono", ui-monospace, monospace;
+  }
+
+  b { display: block; font-size: 13.5px; }
+  p { margin: .15rem 0 0; color: var(--token-ink-secondary); font-size: 12.5px; }
+
+  code {
+    padding: .15rem .4rem;
+    border-radius: 4px;
+    background: var(--token-surface-canvas);
+    color: var(--token-ink-muted);
+    font-family: "IBM Plex Mono", ui-monospace, monospace;
+    font-size: 11px;
+    white-space: nowrap;
+  }
+
+  .undeclared { margin: 0; color: var(--token-ink-muted); font-size: 12.5px; }
+
+  @media (max-width: 52rem) {
+    li { grid-template-columns: 2rem minmax(0, 1fr); width: 100%; }
+    li code { grid-column: 2; justify-self: start; }
+  }
+</style>
~~~~

### new · `src/lib/development-views/template-reference/components/diagram-verbs.svelte` (+79 / −0)

~~~~diff
@@ -0,0 +1,79 @@
+<script lang="ts">
+</script>
+
+<svg class="verbs" viewBox="0 0 1040 360" role="img" aria-label="A document becomes a template; the template makes copies and is edited through a working copy">
+  <defs>
+    <marker id="tref-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
+      <path d="M 0 0 L 10 5 L 0 10 z" class="head" />
+    </marker>
+  </defs>
+
+  <text x="20" y="26" class="note">The template is never edited directly — the editors open documents and decks, so a template is edited through one.</text>
+
+  <g class="box source">
+    <rect x="20" y="140" width="200" height="86" rx="10" />
+    <text x="38" y="174" class="title">A document or deck</text>
+    <text x="38" y="196" class="sub">Something you already have</text>
+    <text x="38" y="214" class="sub">in this project</text>
+  </g>
+
+  <g class="box template">
+    <rect x="430" y="40" width="240" height="104" rx="10" />
+    <text x="450" y="72" class="title">The template</text>
+    <text x="450" y="94" class="sub">A portable body, its holes,</text>
+    <text x="450" y="112" class="sub">and a revision that only moves</text>
+    <text x="450" y="130" class="sub">when the working copy is saved</text>
+  </g>
+
+  <g class="box copy">
+    <rect x="430" y="230" width="240" height="96" rx="10" />
+    <text x="450" y="262" class="title">The working copy</text>
+    <text x="450" y="284" class="sub">An ordinary document or deck,</text>
+    <text x="450" y="302" class="sub">one per template, shared,</text>
+    <text x="450" y="320" class="sub">autosaved like anything else</text>
+  </g>
+
+  <g class="box made">
+    <rect x="840" y="140" width="180" height="86" rx="10" />
+    <text x="858" y="174" class="title">A copy of it, here</text>
+    <text x="858" y="196" class="sub">A new resource, or rows</text>
+    <text x="858" y="214" class="sub">in what you have open</text>
+  </g>
+
+  <path class="line" d="M 220 168 C 300 168 340 100 428 96" marker-end="url(#tref-arrow)" />
+  <text x="234" y="122" class="label">Save as template</text>
+  <text x="234" y="138" class="hint">a copy, made portable</text>
+
+  <path class="line" d="M 672 96 C 760 100 790 166 838 170" marker-end="url(#tref-arrow)" />
+  <text x="690" y="104" class="label">Use · Insert</text>
+  <text x="690" y="120" class="hint">asks what each hole selects</text>
+
+  <path class="line" d="M 500 146 L 500 226" marker-end="url(#tref-arrow)" />
+  <text x="486" y="180" class="label right">Edit</text>
+  <text x="486" y="196" class="hint right">opens the copy</text>
+
+  <path class="line up" d="M 600 226 L 600 150" marker-end="url(#tref-arrow)" />
+  <text x="616" y="180" class="label">Save</text>
+  <text x="616" y="196" class="hint">the copy becomes revision N + 1</text>
+</svg>
+
+<style>
+  .verbs { display: block; width: 100%; height: auto; }
+
+  .box rect { fill: var(--token-surface-elevated); stroke: var(--token-border-strong); stroke-width: 1.5; }
+  .box.template rect { fill: var(--token-color-active-surface); stroke: var(--token-color-active-text); }
+  .box.copy rect { fill: var(--token-color-accent-1-surface); stroke: var(--token-color-accent-1-text); }
+
+  .title { fill: var(--token-ink-primary); font: 700 16px/1 "IBM Plex Sans", ui-sans-serif, system-ui, sans-serif; }
+  .sub { fill: var(--token-ink-secondary); font: 400 12.5px/1 "IBM Plex Sans", ui-sans-serif, system-ui, sans-serif; }
+
+  .label { fill: var(--token-ink-primary); font: 700 12.5px/1 "IBM Plex Mono", ui-monospace, monospace; }
+  .hint { fill: var(--token-ink-muted); font: 400 11.5px/1 "IBM Plex Sans", ui-sans-serif, system-ui, sans-serif; }
+  .right { text-anchor: end; }
+
+  .note { fill: var(--token-ink-muted); font: 400 12px/1 "IBM Plex Sans", ui-sans-serif, system-ui, sans-serif; }
+
+  .line { fill: none; stroke: var(--token-border-strong); stroke-width: 2; }
+  .line.up { stroke: var(--token-color-active-text); }
+  .head { fill: var(--token-border-strong); }
+</style>
~~~~

### new · `src/lib/development-views/template-reference/components/file-ledger.svelte` (+138 / −0)

~~~~diff
@@ -0,0 +1,138 @@
+<script lang="ts">
+  import { FILES } from "$development-views/template-reference/procedures/inventory";
+  import type { Area, FileRecord } from "$development-views/template-reference/types";
+
+  const AREAS: { area: Area; label: string }[] = [
+    { area: "vocabulary", label: "Vocabulary" },
+    { area: "templates", label: "Templates capability" },
+    { area: "sets", label: "Resource sets" },
+    { area: "neighbours", label: "Neighbouring capabilities" },
+    { area: "editors", label: "Editor panels" },
+    { area: "library", label: "Library and inspector" },
+    { area: "contexts", label: "Contexts panel" },
+    { area: "evidence", label: "Seed and browser evidence" },
+    { area: "reference", label: "These pages" },
+    { area: "documentation", label: "Written documentation" },
+    { area: "cross-cutting", label: "Tooling" }
+  ];
+
+  let area = $state<Area | "all">("all");
+
+  const inApp = (file: FileRecord) => file.path.startsWith("app/");
+  const app = FILES.filter(inApp);
+  const shown = $derived(area === "all" ? FILES : FILES.filter((file) => file.area === area));
+  const widest = $derived(Math.max(1, ...shown.map((file) => file.added + file.deleted)));
+
+  const counts = (rows: FileRecord[]) => ({
+    files: rows.length,
+    made: rows.filter((row) => row.status === "A").length,
+    changed: rows.filter((row) => row.status === "M").length,
+    added: rows.reduce((sum, row) => sum + row.added, 0),
+    deleted: rows.reduce((sum, row) => sum + row.deleted, 0)
+  });
+
+  const total = counts(app);
+  const here = $derived(counts(shown));
+</script>
+
+<div class="ledger">
+  <div class="summary">
+    <div><dt>Files under app/</dt><dd>{total.files}</dd></div>
+    <div><dt>Created</dt><dd>{total.made}</dd></div>
+    <div><dt>Changed</dt><dd>{total.changed}</dd></div>
+    <div><dt>Lines added</dt><dd>+{total.added.toLocaleString()}</dd></div>
+    <div><dt>Lines removed</dt><dd>−{total.deleted.toLocaleString()}</dd></div>
+  </div>
+
+  <div class="filters" role="group" aria-label="Filter the ledger by area">
+    <button type="button" class:on={area === "all"} onclick={() => (area = "all")}>
+      Everything <span>{FILES.length}</span>
+    </button>
+    {#each AREAS as entry (entry.area)}
+      {@const rows = FILES.filter((file) => file.area === entry.area)}
+      {#if rows.length > 0}
+        <button type="button" class:on={area === entry.area} onclick={() => (area = entry.area)}>
+          {entry.label} <span>{rows.length}</span>
+        </button>
+      {/if}
+    {/each}
+  </div>
+
+  <p class="showing">
+    Showing {here.files} of {FILES.length} — {here.made} created, {here.changed} changed,
+    <b class="add">+{here.added.toLocaleString()}</b> / <b class="del">−{here.deleted.toLocaleString()}</b> lines.
+  </p>
+
+  <div class="scroll">
+    <table>
+      <thead>
+        <tr><th>File</th><th>Area</th><th>Kind</th><th class="num">Lines</th><th class="num">+</th><th class="num">−</th><th>Change</th></tr>
+      </thead>
+      <tbody>
+        {#each shown as file (file.path)}
+          <tr>
+            <td class="path">{file.path.replace(/^app\//, "")}</td>
+            <td class="muted">{AREAS.find((entry) => entry.area === file.area)?.label ?? file.area}</td>
+            <td class="muted">{file.kind}</td>
+            <td class="num">{file.current.toLocaleString()}</td>
+            <td class="num add">{file.added > 0 ? `+${file.added}` : "—"}</td>
+            <td class="num del">{file.deleted > 0 ? `−${file.deleted}` : "—"}</td>
+            <td>
+              <span class="bar">
+                <i class="add" style={`width: ${Math.max(2, (file.added / widest) * 120)}px`}></i>
+                <i class="del" style={`width: ${Math.max(file.deleted === 0 ? 0 : 2, (file.deleted / widest) * 120)}px`}></i>
+                <em>{file.status === "A" ? "new" : "changed"}</em>
+              </span>
+            </td>
+          </tr>
+        {/each}
+      </tbody>
+    </table>
+  </div>
+</div>
+
+<style>
+  .ledger { display: grid; gap: 1.2rem; margin-top: 2rem; }
+
+  .summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(9rem, 1fr)); gap: 1px; border: 1px solid var(--token-border-subtle); background: var(--token-border-subtle); }
+  .summary div { display: grid; gap: .2rem; padding: .8rem 1rem; background: var(--token-surface-panel); }
+  .summary dt { color: var(--token-ink-muted); font-size: 9.5px; font-weight: 750; letter-spacing: .12em; text-transform: uppercase; }
+  .summary dd { margin: 0; font-family: "IBM Plex Mono", ui-monospace, monospace; font-size: 20px; font-weight: 600; letter-spacing: -.02em; }
+
+  .filters { display: flex; flex-wrap: wrap; gap: .35rem; }
+
+  .filters button {
+    padding: .25rem .6rem;
+    border: 1px solid var(--token-border-subtle);
+    border-radius: 999px;
+    background: var(--token-surface-panel);
+    color: var(--token-ink-secondary);
+    font-size: 11px;
+    font-weight: 650;
+    cursor: pointer;
+  }
+
+  .filters button span { color: var(--token-ink-muted); font-family: "IBM Plex Mono", ui-monospace, monospace; font-size: 10px; }
+  .filters button:hover { border-color: var(--token-border-strong); color: var(--token-ink-primary); }
+  .filters button.on { border-color: var(--token-color-active-text); background: var(--token-color-active-surface); color: var(--token-color-active-text); }
+  .filters button.on span { color: inherit; }
+
+  .showing { margin: 0; color: var(--token-ink-secondary); font-size: 12.5px; }
+
+  .scroll { overflow-x: auto; }
+
+  table { width: 100%; border-collapse: collapse; font-size: 12px; }
+  th, td { padding: .45rem .7rem; border-bottom: 1px solid var(--token-border-subtle); text-align: left; white-space: nowrap; }
+  th { color: var(--token-ink-muted); font-size: 9.5px; font-weight: 750; letter-spacing: .12em; text-transform: uppercase; }
+  .path { font-family: "IBM Plex Mono", ui-monospace, monospace; font-size: 11px; }
+  .muted { color: var(--token-ink-muted); }
+  .num { font-family: "IBM Plex Mono", ui-monospace, monospace; font-variant-numeric: tabular-nums; text-align: right; }
+  .add { color: var(--token-color-success-text); }
+  .del { color: var(--token-color-danger-text); }
+
+  .bar { display: flex; align-items: center; gap: .25rem; }
+  .bar i { display: block; height: 7px; border-radius: 2px; }
+  .bar i.add { background: var(--token-color-success-text); }
+  .bar i.del { background: var(--token-color-danger-text); }
+  .bar em { color: var(--token-ink-muted); font-size: 10px; font-style: normal; }
+</style>
~~~~

### new · `src/lib/development-views/template-reference/components/reference-header.svelte` (+166 / −0)

~~~~diff
@@ -0,0 +1,166 @@
+<script lang="ts">
+  import { page } from "$app/state";
+
+  import { PAGES, hrefOf, type ReferencePage } from "$development-views/template-reference/procedures/navigation";
+
+  let {
+    current,
+    material,
+    materials = [],
+    onmaterial
+  }: {
+    current: ReferencePage["slug"];
+    material?: string;
+    materials?: readonly string[];
+    onmaterial?: (next: string) => void;
+  } = $props();
+
+  const project = $derived(page.params.project ?? "dev-project");
+
+  const NAMES: Record<string, string> = { helios: "Helios", selene: "Selene" };
+</script>
+
+<header class="suite">
+  <span class="brand">
+    <span class="mark">TP</span>
+    <strong>Templates</strong>
+  </span>
+  <nav aria-label="Template reference pages">
+    {#each PAGES as item (item.slug)}
+      <a href={hrefOf(project, item.slug)} aria-current={current === item.slug ? "page" : undefined}>
+        <span>{item.index}</span>
+        <b>{item.label}</b>
+        <small>{item.sub}</small>
+      </a>
+    {/each}
+  </nav>
+  <div class="tail">
+    {#if onmaterial !== undefined && materials.length > 1}
+      <div class="material" role="group" aria-label="Material">
+        {#each materials as name (name)}
+          <button type="button" aria-pressed={material === name} onclick={() => onmaterial(name)}>
+            {NAMES[name] ?? name}
+          </button>
+        {/each}
+      </div>
+    {/if}
+    <a class="live" href={`/app/${project}`}>Open the app <span aria-hidden="true">↗</span></a>
+  </div>
+</header>
+
+<style>
+  .suite {
+    position: sticky;
+    top: 0;
+    z-index: 50;
+    display: grid;
+    grid-template-columns: auto minmax(0, 1fr) auto;
+    align-items: stretch;
+    min-height: 3.5rem;
+    border-bottom: 1px solid var(--token-border-subtle);
+    background: color-mix(in srgb, var(--token-surface-canvas) 92%, transparent);
+    backdrop-filter: blur(14px);
+  }
+
+  .brand {
+    display: flex;
+    align-items: center;
+    gap: .65rem;
+    padding: .65rem 1rem;
+    border-right: 1px solid var(--token-border-subtle);
+  }
+
+  .mark {
+    display: grid;
+    width: 1.75rem;
+    height: 1.75rem;
+    place-items: center;
+    border-radius: 5px;
+    background: var(--token-ink-primary);
+    color: var(--token-surface-canvas);
+    font: 700 9px/1 "IBM Plex Mono", ui-monospace, monospace;
+    letter-spacing: .06em;
+  }
+
+  .brand strong { font-size: 11px; white-space: nowrap; }
+
+  nav { display: flex; min-width: 0; align-items: stretch; overflow-x: auto; scrollbar-width: none; }
+  nav::-webkit-scrollbar { display: none; }
+
+  nav a {
+    display: flex;
+    flex: 0 1 auto;
+    flex-direction: column;
+    justify-content: center;
+    gap: .05rem;
+    min-width: 10rem;
+    padding: .5rem 1rem;
+    border-right: 1px solid var(--token-border-subtle);
+    color: var(--token-ink-muted);
+    text-decoration: none;
+  }
+
+  nav a span { color: var(--token-border-strong); font: 500 8px/1 "IBM Plex Mono", ui-monospace, monospace; }
+  nav a b { font-size: 11.5px; font-weight: 700; white-space: nowrap; }
+  nav a small { font-size: 10px; white-space: nowrap; }
+  nav a:hover { background: var(--token-surface-panel); color: var(--token-ink-primary); }
+
+  nav a[aria-current="page"] {
+    box-shadow: inset 0 -3px 0 var(--token-color-active-text);
+    background: var(--token-color-active-surface);
+    color: var(--token-color-active-text);
+  }
+
+  nav a[aria-current="page"] span { color: inherit; }
+
+  .tail {
+    display: flex;
+    align-items: center;
+    gap: .6rem;
+    padding-inline: .75rem;
+    border-left: 1px solid var(--token-border-subtle);
+  }
+
+  .material {
+    display: flex;
+    gap: .15rem;
+    padding: .15rem;
+    border-radius: var(--token-radius-control);
+    background: var(--token-surface-work);
+  }
+
+  .material button {
+    padding: .25rem .55rem;
+    border: 0;
+    border-radius: calc(var(--token-radius-control) - 1px);
+    background: transparent;
+    color: var(--token-ink-secondary);
+    font: 650 10px/1.4 "IBM Plex Sans", ui-sans-serif, system-ui, sans-serif;
+    cursor: pointer;
+  }
+
+  .material button:hover { background: var(--token-surface-panel); color: var(--token-ink-primary); }
+
+  .material button[aria-pressed="true"] {
+    background: var(--token-color-interactive-surface);
+    color: var(--token-color-interactive-text);
+  }
+
+  .live {
+    display: flex;
+    align-items: center;
+    gap: .45rem;
+    color: var(--token-color-interactive-text);
+    font-size: 10.5px;
+    font-weight: 700;
+    white-space: nowrap;
+    text-decoration: none;
+  }
+
+  .live:hover { text-decoration: underline; }
+
+  @media (max-width: 60rem) {
+    .live { display: none; }
+    nav a small { display: none; }
+  }
+</style>
~~~~

### new · `src/lib/development-views/template-reference/components/reference.css` (+305 / −0)

~~~~diff
@@ -0,0 +1,305 @@
+.tref {
+  --ground: var(--token-surface-canvas);
+  --panel: var(--token-surface-panel);
+  --raised: var(--token-surface-elevated);
+  --work: var(--token-surface-work);
+  --ink: var(--token-ink-primary);
+  --ink-2: var(--token-ink-secondary);
+  --ink-3: var(--token-ink-muted);
+  --rule: var(--token-border-subtle);
+  --rule-strong: var(--token-border-strong);
+  --active: var(--token-color-active-text);
+  --active-soft: var(--token-color-active-surface);
+  --interactive: var(--token-color-interactive-text);
+  --interactive-soft: var(--token-color-interactive-surface);
+  --accent: var(--token-color-accent-1-text);
+  --accent-soft: var(--token-color-accent-1-surface);
+  --accent-2: var(--token-color-accent-2-text);
+  --accent-2-soft: var(--token-color-accent-2-surface);
+  --success: var(--token-color-success-text);
+  --success-soft: var(--token-color-success-surface);
+  --attention: var(--token-color-attention-text);
+  --attention-soft: var(--token-color-attention-surface);
+  --danger: var(--token-color-danger-text);
+  --danger-soft: var(--token-color-danger-surface);
+  min-height: 100vh;
+  background: var(--ground);
+  color: var(--ink);
+  font-family: "IBM Plex Sans", ui-sans-serif, system-ui, sans-serif;
+  font-size: 15px;
+  line-height: 1.55;
+}
+
+.tref-page {
+  width: min(100%, 88rem);
+  margin: 0 auto;
+  padding: 3.5rem 3.5rem 7rem;
+}
+
+.tref code,
+.tref .mono {
+  font-family: "IBM Plex Mono", ui-monospace, monospace;
+}
+
+.tref code {
+  padding: 0 .25em;
+  border-radius: 3px;
+  background: var(--work);
+  font-size: .88em;
+}
+
+.tref-kicker {
+  display: block;
+  margin: 0 0 .7rem;
+  color: var(--accent);
+  font-size: 9px;
+  font-weight: 750;
+  letter-spacing: .14em;
+  text-transform: uppercase;
+}
+
+.tref-mast {
+  display: grid;
+  grid-template-columns: minmax(0, 1.35fr) minmax(16rem, .65fr);
+  gap: 3rem;
+  align-items: end;
+}
+
+.tref-mast h1 {
+  margin: 0 0 .8rem;
+  font-size: clamp(2.4rem, 5vw, 4rem);
+  line-height: .98;
+  letter-spacing: -.045em;
+}
+
+.tref-lede {
+  max-width: 60ch;
+  margin: 0;
+  color: var(--ink-2);
+  font-size: 16px;
+}
+
+.tref-facts {
+  display: grid;
+  gap: .55rem;
+  padding: 1.1rem 1.25rem;
+  border: 1px solid var(--rule);
+  border-radius: 8px;
+  background: var(--panel);
+}
+
+.tref-facts div { display: flex; justify-content: space-between; gap: 1rem; }
+.tref-facts dt { color: var(--ink-3); font-size: 10.5px; letter-spacing: .04em; text-transform: uppercase; }
+.tref-facts dd { margin: 0; font-size: 12px; font-weight: 650; text-align: right; }
+.tref-facts dl { display: contents; margin: 0; }
+
+.tref-jumps {
+  display: flex;
+  flex-wrap: wrap;
+  gap: .4rem;
+  margin-top: 2.5rem;
+  padding-top: 1.2rem;
+  border-top: 1px solid var(--rule);
+}
+
+.tref-jumps a {
+  padding: .3rem .7rem;
+  border: 1px solid var(--rule);
+  border-radius: 999px;
+  color: var(--ink-2);
+  font-size: 11px;
+  font-weight: 600;
+  text-decoration: none;
+}
+
+.tref-jumps a:hover { border-color: var(--rule-strong); color: var(--ink); }
+
+.tref-section { margin-top: 5rem; scroll-margin-top: 5rem; }
+
+.tref-section-head {
+  display: grid;
+  grid-template-columns: minmax(16rem, .8fr) minmax(20rem, 1fr);
+  gap: 2.5rem;
+  align-items: end;
+  padding-bottom: .9rem;
+  border-bottom: 2px solid var(--ink);
+}
+
+.tref-section-head h2 {
+  margin: 0;
+  font-size: clamp(1.7rem, 3vw, 2.6rem);
+  line-height: 1;
+  letter-spacing: -.04em;
+}
+
+.tref-section-head p {
+  max-width: 62ch;
+  margin: 0;
+  color: var(--ink-2);
+  font-size: 13px;
+}
+
+.tref-prose {
+  max-width: 68ch;
+  margin: 1.6rem 0 0;
+  color: var(--ink-2);
+  font-size: 14px;
+}
+
+.tref-prose strong { color: var(--ink); }
+
+.tref-figure {
+  margin: 2rem 0 0;
+  padding: 1.6rem 1.6rem 1.1rem;
+  border: 1px solid var(--rule);
+  border-radius: 10px;
+  background: var(--panel);
+}
+
+.tref-figure figcaption {
+  margin-top: 1rem;
+  padding-top: .8rem;
+  border-top: 1px solid var(--rule);
+  color: var(--ink-3);
+  font-size: 11.5px;
+}
+
+.tref-figure figcaption b { color: var(--ink-2); font-weight: 650; }
+
+.tref-cards {
+  display: grid;
+  grid-template-columns: repeat(auto-fit, minmax(19rem, 1fr));
+  gap: 1px;
+  margin-top: 2rem;
+  border: 1px solid var(--rule);
+  background: var(--rule);
+}
+
+.tref-card {
+  display: flex;
+  flex-direction: column;
+  gap: .5rem;
+  padding: 1.2rem 1.3rem;
+  background: var(--panel);
+}
+
+.tref-card h3 { margin: 0; font-size: 15px; letter-spacing: -.01em; }
+.tref-card h3 span { color: var(--ink-3); font-size: 11px; font-weight: 500; }
+.tref-card p { margin: 0; color: var(--ink-2); font-size: 13px; }
+.tref-card .tref-meta { margin-top: auto; padding-top: .5rem; color: var(--ink-3); font-size: 10.5px; word-break: break-word; }
+.tref-card .tref-not { color: var(--attention); font-size: 12px; }
+.tref-card .tref-not::before { content: "Not "; font-size: 9px; font-weight: 750; letter-spacing: .1em; text-transform: uppercase; }
+
+.tref-scroll { overflow-x: auto; margin-top: 2rem; }
+
+.tref-table { width: 100%; border-collapse: collapse; font-size: 13px; }
+.tref-table th,
+.tref-table td { padding: .7rem .9rem; border-bottom: 1px solid var(--rule); vertical-align: top; text-align: left; }
+.tref-table th { color: var(--ink-3); font-size: 9.5px; font-weight: 750; letter-spacing: .12em; text-transform: uppercase; }
+.tref-table td:first-child { color: var(--ink); font-weight: 600; }
+.tref-table td.muted { color: var(--ink-2); font-weight: 400; }
+.tref-table tbody tr:hover { background: var(--panel); }
+.tref-table .num { font-family: "IBM Plex Mono", ui-monospace, monospace; font-variant-numeric: tabular-nums; text-align: right; }
+
+.tref-lanes {
+  display: grid;
+  grid-template-columns: 3.2rem repeat(4, minmax(0, 1fr));
+  gap: 1px;
+  margin-top: 2rem;
+  border: 1px solid var(--rule);
+  background: var(--rule);
+  font-size: 12.5px;
+}
+
+.tref-lanes > div { padding: .75rem .9rem; background: var(--panel); }
+.tref-lanes .head { background: var(--work); color: var(--ink-3); font-size: 9.5px; font-weight: 750; letter-spacing: .12em; text-transform: uppercase; }
+.tref-lanes .step { background: var(--work); }
+.tref-lanes .step span { display: block; color: var(--ink-3); font-family: "IBM Plex Mono", ui-monospace, monospace; font-size: 10px; }
+.tref-lanes .step b { font-size: 12px; }
+.tref-lanes .rows { color: var(--ink-3); font-size: 11.5px; }
+.tref-lanes .none { color: var(--ink-3); font-style: italic; }
+
+.tref-change {
+  display: grid;
+  grid-template-columns: 2.6rem minmax(14rem, .9fr) minmax(14rem, 1fr) minmax(14rem, 1fr);
+  gap: 1.4rem;
+  padding: 1.5rem 0;
+  border-bottom: 1px solid var(--rule);
+}
+
+.tref-change:first-of-type { border-top: 1px solid var(--rule); }
+.tref-change > span { color: var(--accent); font-family: "IBM Plex Mono", ui-monospace, monospace; font-size: 12px; }
+.tref-change h3 { margin: 0 0 .35rem; font-size: 15px; letter-spacing: -.01em; }
+.tref-change p { margin: 0; color: var(--ink-2); font-size: 13px; }
+.tref-change .state { padding: .7rem .9rem; border-radius: 6px; }
+.tref-change .state span { display: block; margin-bottom: .3rem; font-size: 9px; font-weight: 750; letter-spacing: .12em; text-transform: uppercase; }
+.tref-change .before { background: var(--work); }
+.tref-change .before span { color: var(--ink-3); }
+.tref-change .after { background: var(--success-soft); }
+.tref-change .after span { color: var(--success); }
+
+.tref-note {
+  margin-top: 2rem;
+  padding: 1.1rem 1.3rem;
+  border-left: 3px solid var(--accent);
+  border-radius: 0 8px 8px 0;
+  background: var(--panel);
+}
+
+.tref-note h4 { margin: 0 0 .4rem; font-size: 13px; }
+.tref-note p { max-width: 70ch; margin: 0 0 .5rem; color: var(--ink-2); font-size: 13px; overflow-wrap: anywhere; }
+.tref-note p:last-child { margin-bottom: 0; }
+.tref-note.attention { border-color: var(--attention); }
+.tref-note.success { border-color: var(--success); }
+
+.tref-badge {
+  display: inline-block;
+  padding: .1rem .45rem;
+  border-radius: 4px;
+  font-family: "IBM Plex Mono", ui-monospace, monospace;
+  font-size: 9.5px;
+  font-weight: 700;
+  letter-spacing: .06em;
+  text-transform: uppercase;
+}
+
+.tref-badge.new { background: var(--success-soft); color: var(--success); }
+.tref-badge.changed { background: var(--attention-soft); color: var(--attention); }
+.tref-badge.clean { background: var(--success-soft); color: var(--success); }
+.tref-badge.known { background: var(--attention-soft); color: var(--attention); }
+
+.tref-bar { display: flex; align-items: center; gap: .3rem; }
+.tref-bar i { display: block; height: 6px; border-radius: 2px; }
+.tref-bar .add { background: var(--success); }
+.tref-bar .del { background: var(--danger); }
+
+.tref-footer {
+  display: flex;
+  flex-wrap: wrap;
+  justify-content: space-between;
+  gap: .8rem 2rem;
+  width: min(100%, 88rem);
+  margin: 0 auto;
+  padding: 1.25rem 3.5rem 3rem;
+  border-top: 1px solid var(--rule);
+  color: var(--ink-3);
+  font-size: 10px;
+}
+
+.tref-footer div { display: flex; flex-wrap: wrap; gap: 1rem; }
+.tref-footer a { color: var(--interactive); font-weight: 650; text-decoration: none; }
+.tref-footer a:hover { text-decoration: underline; }
+
+@media (max-width: 68rem) {
+  .tref-mast { grid-template-columns: 1fr; gap: 1.5rem; }
+  .tref-section-head { grid-template-columns: 1fr; gap: .8rem; }
+  .tref-change { grid-template-columns: 2rem 1fr; }
+  .tref-lanes { grid-template-columns: 3rem 1fr; }
+  .tref-lanes .head { display: none; }
+}
+
+@media (max-width: 44rem) {
+  .tref-page { padding: 2.5rem 1rem 5rem; }
+  .tref-section { margin-top: 3.5rem; }
+  .tref-footer { flex-direction: column; padding-right: 1rem; padding-left: 1rem; }
+}
~~~~

### new · `src/lib/development-views/template-reference/components/scope-page.svelte` (+468 / −0)

~~~~diff
@@ -0,0 +1,468 @@
+<script lang="ts">
+  import { page } from "$app/state";
+
+  import DiagramBinding from "$development-views/template-reference/components/diagram-binding.svelte";
+  import DiagramBuilder from "$development-views/template-reference/components/diagram-builder.svelte";
+  import DiagramDifference from "$development-views/template-reference/components/diagram-difference.svelte";
+  import ReferenceHeader from "$development-views/template-reference/components/reference-header.svelte";
+  import "$development-views/template-reference/components/reference.css";
+  import { hrefOf } from "$development-views/template-reference/procedures/navigation";
+  import {
+    DOORS,
+    FORKS,
+    GAPS,
+    KINDS,
+    LIFECYCLE,
+    REFUSALS,
+    RULES,
+    TERMS,
+    WORK
+  } from "$development-views/template-reference/procedures/scope";
+
+  let {
+    material,
+    materials = [],
+    onmaterial
+  }: {
+    material?: string;
+    materials?: readonly string[];
+    onmaterial?: (next: string) => void;
+  } = $props();
+
+  const project = $derived(page.params.project ?? "dev-project");
+
+  const areas = $derived([...new Set(WORK.map((item) => item.area))]);
+  const newFiles = $derived(WORK.filter((item) => item.status === "new").length);
+  const changedFiles = $derived(WORK.length - newFiles);
+</script>
+
+<div class="tref">
+  <ReferenceHeader current="scope" {material} {materials} {onmaterial} />
+
+  <main class="tref-page">
+    <header class="tref-mast">
+      <div>
+        <span class="tref-kicker">03 · Scope</span>
+        <h1>What a hole selects</h1>
+        <p class="tref-lede">
+          A scope hole is an empty place a prompt punched. What fills it is a group of resources, and until this work that group
+          could only be said in the crudest terms: everything, or some kinds, or one of the project's
+          named sets. It can now be built term by term, excluded from, and pointed at particular
+          resources. This page is how it works and every file it touched.
+        </p>
+      </div>
+      <div class="tref-facts">
+        <dl>
+          <div><dt>Stored as</dt><dd>A rule, never members</dd></div>
+          <div><dt>Named</dt><dd>Only when a person names it</dd></div>
+          <div><dt>Built by</dt><dd>One modal, four doors</dd></div>
+          <div><dt>Written by</dt><dd>The server, from a rule</dd></div>
+          <div><dt>Representation</dt><dd>One optional field, one new one</dd></div>
+        </dl>
+      </div>
+    </header>
+
+    <nav class="tref-jumps" aria-label="On this page">
+      <a href="#holes">Two kinds of hole</a>
+      <a href="#why">Why a row at all</a>
+      <a href="#terms">Every term</a>
+      <a href="#difference">A set is a difference</a>
+      <a href="#anonymous">Named, or bound</a>
+      <a href="#builder">The builder</a>
+      <a href="#doors">Where it opens</a>
+      <a href="#lifecycle">What gets written</a>
+      <a href="#rules">Rules and refusals</a>
+      <a href="#work">Every file it touched</a>
+      <a href="#forks">Eight decisions</a>
+      <a href="#missing">What is still missing</a>
+    </nav>
+
+    <section class="tref-section" id="holes">
+      <div class="tref-section-head">
+        <div><span class="tref-kicker">What a template asks for</span><h2>Two kinds of hole</h2></div>
+        <p>
+          A template is a function and these are the places it leaves empty. Both are declared in one
+          list and both carry a name, a label and a description written by whoever made the template.
+          A scope hole is found from the body; a text hole is placed by hand, because only the writer
+          knows where in the prose it belongs.
+        </p>
+      </div>
+
+      <div class="tref-scroll">
+        <table class="tref-table">
+          <thead>
+            <tr><th>Found because</th><th>Kind</th><th>Answered with</th><th>When</th><th>What happens</th></tr>
+          </thead>
+          <tbody>
+            {#each KINDS as kind (kind.opens)}
+              <tr>
+                <td>{kind.where}</td>
+                <td><code>{kind.opens}</code></td>
+                <td>{kind.title}</td>
+                <td class="muted">{kind.confirms}</td>
+                <td class="muted">{kind.writes}</td>
+              </tr>
+            {/each}
+          </tbody>
+        </table>
+      </div>
+
+      <div class="tref-note attention">
+        <h4>A hole is not a variable</h4>
+        <p>
+          A variable in this application is a named value a formula reads, and it has nothing to do
+          with templates. That is why none of this is called one: a template's empty places are
+          holes, the atom that marks a text hole in the prose is a <code>template</code> atom, and it
+          appears nowhere outside a template body and the copy that template is edited through. The
+          word is worth guarding: two unrelated ideas sharing it is how a vocabulary stops being one.
+        </p>
+      </div>
+    </section>
+
+    <section class="tref-section" id="why">
+      <div class="tref-section-head">
+        <div><span class="tref-kicker">The load-bearing fact</span><h2>Why a row, and not a bigger rule</h2></div>
+        <p>
+          The obvious move is to let a hole's default hold a richer rule inline. It does not work, and
+          the reason is already in the code rather than in anyone's opinion.
+        </p>
+      </div>
+
+      <p class="tref-prose">
+        Resolving a template substitutes each hole term for what fills it. A hole term can appear
+        on either side of a prompt's scope: a prompt may say <em>these, and not those</em>. Substituting
+        one term for one term works on both sides. Substituting one term for
+        <em>a difference</em> does not, because a difference on the exclude side is not expressible as a
+        flat difference. So the resolver refuses it, in as many words:
+        <code>a hole answered with exclusions cannot be flattened without changing scope</code>.
+      </p>
+
+      <div class="tref-note">
+        <h4>Which meant, before this, no exclusions anywhere</h4>
+        <p>
+          Neither a hole's default nor an answer given at Insert could exclude anything. A builder
+          mostly about excluding things would have refused on its first use.
+        </p>
+        <p>
+          A stored row fixes it exactly. The difference lives <b>inside</b> the row; the default and the
+          answer hold <b>one</b> term naming it; substitution stays one-for-one and flips sides cleanly.
+          The row is not bookkeeping. It is what makes the feature expressible, and the resolver's refusal
+          is left exactly where it was, now unreachable from either door.
+        </p>
+      </div>
+
+      <p class="tref-prose">
+        The second reason is narrower and just as firm. A template's scope vocabulary has no way to name a
+        particular resource — <code>resources</code> is in the concrete term union and not in the templated
+        one. <b>Pick these three findings</b> is unsayable in a template and sayable in a row. The
+        indirection is the only path from one to the other.
+      </p>
+    </section>
+
+    <section class="tref-section" id="terms">
+      <div class="tref-section-head">
+        <div><span class="tref-kicker">The vocabulary, unchanged</span><h2>Every term a scope can hold</h2></div>
+        <p>
+          Five terms, and where each is allowed. Nothing in this column set moves; what changes is which of
+          them the product can actually produce.
+        </p>
+      </div>
+
+      <div class="tref-scroll">
+        <table class="tref-table">
+          <thead>
+            <tr>
+              <th>select</th>
+              <th>Reads as</th>
+              <th>Picks</th>
+              <th>In a template body</th>
+              <th>In a hole's default</th>
+              <th>In a live resource</th>
+            </tr>
+          </thead>
+          <tbody>
+            {#each TERMS as term (term.select)}
+              <tr>
+                <td><code>{term.select}</code></td>
+                <td>{term.reads}</td>
+                <td class="muted">{term.picks}</td>
+                <td>{term.inABody}</td>
+                <td>{term.inADefault}</td>
+                <td>{term.inALiveResource}</td>
+              </tr>
+            {/each}
+          </tbody>
+        </table>
+      </div>
+    </section>
+
+    <section class="tref-section" id="difference">
+      <div class="tref-section-head">
+        <div><span class="tref-kicker">The arithmetic</span><h2>Every set is a difference</h2></div>
+        <p>
+          Two flat lists of terms. The included ones are unioned, the excluded ones are unioned, and the
+          answer is the first minus the second, computed when the set is read.
+        </p>
+      </div>
+
+      <figure class="tref-figure">
+        <DiagramDifference />
+        <figcaption>
+          <b>Nothing here is new.</b> This is what <code>resolveResourceSet</code> already did, cycle guard
+          and all. What was missing was any surface that could build the left-hand side.
+        </figcaption>
+      </figure>
+    </section>
+
+    <section class="tref-section" id="anonymous">
+      <div class="tref-section-head">
+        <div><span class="tref-kicker">The change of stance</span><h2>Named, or bound</h2></div>
+        <p>
+          A set stopped being a thing people curate and became a value a hole holds. Both still exist,
+          and the only difference between them is whether a person gave it a name.
+        </p>
+      </div>
+
+      <figure class="tref-figure">
+        <DiagramBinding />
+        <figcaption>
+          <b>Two rows in one table.</b> A named row is a project subject: listed, offerable, and protected
+          from deletion while anything names it. A bound row is invisible, owned, and deleted with its
+          owner.
+        </figcaption>
+      </figure>
+
+      <p class="tref-prose">
+        The stance matters because the alternative is worse in a specific way. If every chosen scope had to
+        be named, the Contexts panel would fill with rows called <em>Source material for Readiness brief</em>,
+        each used once, each impossible to delete without reading a refusal, and each offered to the next
+        person who opens a builder. Anonymity is not a shortcut; it is what keeps the named list worth
+        reading.
+      </p>
+    </section>
+
+    <section class="tref-section" id="builder">
+      <div class="tref-section-head">
+        <div><span class="tref-kicker">The thing itself</span><h2>The builder</h2></div>
+        <p>
+          One modal. It edits a rule and knows nothing about templates, holes, or which of its four
+          callers opened it. The mock below is what shipped, drawn rather than screenshotted so it stays
+          readable at any width.
+        </p>
+      </div>
+
+      <figure class="tref-figure">
+        <DiagramBuilder />
+        <figcaption>
+          <b>Two modals, and never a third.</b> The ask lists every hole and holds Insert while any
+          words are missing; a value opens the builder, which is two tabs and, inside one, two panes.
+        </figcaption>
+      </figure>
+    </section>
+
+    <section class="tref-section" id="doors">
+      <div class="tref-section-head">
+        <div><span class="tref-kicker">One modal, four callers</span><h2>Where it opens</h2></div>
+        <p>
+          Two doors set a default, two give an answer, and the fifth is the Contexts panel, which is the
+          same modal with a name field above it.
+        </p>
+      </div>
+
+      <div class="tref-scroll">
+        <table class="tref-table">
+          <thead>
+            <tr><th>Where</th><th>Control</th><th>Title</th><th>Confirms</th><th>What it writes</th></tr>
+          </thead>
+          <tbody>
+            {#each DOORS as door (door.where)}
+              <tr>
+                <td>{door.where}</td>
+                <td><code>{door.opens}</code></td>
+                <td class="muted">{door.title}</td>
+                <td>{door.confirms}</td>
+                <td class="muted">{door.writes}</td>
+              </tr>
+            {/each}
+          </tbody>
+        </table>
+      </div>
+    </section>
+
+    <section class="tref-section" id="lifecycle">
+      <div class="tref-section-head">
+        <div><span class="tref-kicker">Step by step</span><h2>What gets written, and when</h2></div>
+        <p>
+          Nothing is written until the call that was going to be made anyway. The builder itself never
+          talks to the server.
+        </p>
+      </div>
+
+      <div class="tref-lanes">
+        <div class="head"></div>
+        <div class="head">Person</div>
+        <div class="head">Client</div>
+        <div class="head">Capability</div>
+        <div class="head">Rows afterwards</div>
+        {#each LIFECYCLE as step (step.index)}
+          <div class="step"><span>{step.index}</span><b>{step.title}</b></div>
+          <div>{step.person}</div>
+          <div>{step.client}</div>
+          <div>{step.server}</div>
+          <div class="rows">{step.rows}</div>
+        {/each}
+      </div>
+    </section>
+
+    <section class="tref-section" id="rules">
+      <div class="tref-section-head">
+        <div><span class="tref-kicker">What holds</span><h2>Rules, and what gets refused</h2></div>
+        <p>Eight rules. Most are already true; the ones about naming and ownership are the new ones.</p>
+      </div>
+
+      <div class="tref-cards">
+        {#each RULES as rule (rule.rule)}
+          <article class="tref-card">
+            <h3>{rule.rule}</h3>
+            <p>{rule.because}</p>
+          </article>
+        {/each}
+      </div>
+
+      <div class="tref-scroll">
+        <table class="tref-table">
+          <thead><tr><th>When</th><th>The answer</th><th>Where</th></tr></thead>
+          <tbody>
+            {#each REFUSALS as row (row.when)}
+              <tr><td>{row.when}</td><td><code>{row.answer}</code></td><td class="muted">{row.where}</td></tr>
+            {/each}
+          </tbody>
+        </table>
+      </div>
+    </section>
+
+    <section class="tref-section" id="work">
+      <div class="tref-section-head">
+        <div><span class="tref-kicker">What it cost</span><h2>Every file it touched</h2></div>
+        <p>
+          {WORK.length} entries across {areas.length} areas: {newFiles} new and {changedFiles} changed. Paths
+          are relative to <code>app/src/lib</code> unless they say otherwise. A trailing slash is a
+          procedure folder, which is a file, its validator and its tests.
+        </p>
+      </div>
+
+      {#each areas as area (area)}
+        <div class="group">
+          <h3 class="group-head">{area}</h3>
+          <div class="tref-scroll">
+            <table class="tref-table">
+              <thead><tr><th>Path</th><th>Status</th><th>What changes</th></tr></thead>
+              <tbody>
+                {#each WORK.filter((item) => item.area === area) as item (item.path)}
+                  <tr>
+                    <td><code>{item.path}</code></td>
+                    <td><span class="tref-badge {item.status === 'new' ? 'new' : 'changed'}">{item.status}</span></td>
+                    <td class="muted">{item.work}</td>
+                  </tr>
+                {/each}
+              </tbody>
+            </table>
+          </div>
+        </div>
+      {/each}
+
+      <div class="tref-note success">
+        <h4>Three files that do not change, and that is the design working</h4>
+        <p>
+          <code>data/behavior/templates/scopes.ts</code> keeps refusing a difference, and the row is what
+          keeps it from ever seeing one. <code>data/behavior/templates/portable.ts</code> keeps stripping
+          set and resource terms out of a body, because a template is still a function rather than a value.
+          <code>data/types/content/content-block.ts</code> already types a prompt's scope as either a
+          concrete or a templated set, so a body needs no new shape.
+        </p>
+      </div>
+    </section>
+
+    <section class="tref-section" id="forks">
+      <div class="tref-section-head">
+        <div><span class="tref-kicker">Settled</span><h2>Eight decisions, and how each landed</h2></div>
+        <p>
+          Each was open when this was a plan. Three of them landed somewhere other than where the plan
+          expected, and those are the ones worth reading.
+        </p>
+      </div>
+
+      {#each FORKS as fork (fork.index)}
+        <article class="tref-change fork">
+          <span>{fork.index}</span>
+          <div>
+            <h3>{fork.question}</h3>
+            <p>{fork.because}</p>
+          </div>
+          <div class="state after"><span>Built</span>{fork.recommended}</div>
+          <div class="state before"><span>Otherwise</span>{fork.alternative}<em>{fork.cost}</em></div>
+        </article>
+      {/each}
+    </section>
+
+    <section class="tref-section" id="missing">
+      <div class="tref-section-head">
+        <div><span class="tref-kicker">The order of things</span><h2>What is still missing</h2></div>
+        <p>
+          The plan is derived outputs and prompt blocks onto main, then this. That order is right, and
+          these are the pieces each one has to bring for templates to work end to end.
+        </p>
+      </div>
+
+      <div class="tref-scroll">
+        <table class="tref-table">
+          <thead><tr><th>Missing</th><th>What it is</th><th>When</th></tr></thead>
+          <tbody>
+            {#each GAPS as gap (gap.title)}
+              <tr><td>{gap.title}</td><td class="muted">{gap.detail}</td><td>{gap.order}</td></tr>
+            {/each}
+          </tbody>
+        </table>
+      </div>
+
+      <div class="tref-note attention">
+        <h4>One thing the sequence assumes that is not obviously true</h4>
+        <p>
+          Holes are found from prompt scopes. Until prompt blocks exist, the only way a hole comes
+          into being is by inserting a template that already has one, which means a template made on main
+          from a fresh document will have no holes and the builder will have nothing to open on. The
+          order still works, but this piece has to land <b>with</b> prompt blocks rather than after them,
+          or the first thing anyone sees is an empty Holes band.
+        </p>
+      </div>
+    </section>
+  </main>
+
+  <footer class="tref-footer">
+    <div>
+      <span>Icarus · templates</span>
+      <span>work/template-features</span>
+    </div>
+    <div>
+      <a href={hrefOf(project, "system")}>How templates work →</a>
+      <a href={hrefOf(project, "changes")}>What changed →</a>
+      <a href={`/app/${project}`}>Open the app</a>
+    </div>
+  </footer>
+</div>
+
+<style>
+  .group { margin-top: 2.5rem; }
+
+  .group-head {
+    margin: 0;
+    color: var(--token-ink-muted);
+    font-size: 10px;
+    font-weight: 750;
+    letter-spacing: .12em;
+    text-transform: uppercase;
+  }
+
+  .fork .state { display: grid; gap: .15rem; align-content: start; font-size: 12.5px; }
+  .fork .state em { color: var(--token-ink-muted); font-size: 11.5px; font-style: normal; }
+</style>
~~~~

### new · `src/lib/development-views/template-reference/components/system-page.svelte` (+329 / −0)

~~~~diff
@@ -0,0 +1,329 @@
+<script lang="ts">
+  import { page } from "$app/state";
+
+  import DiagramPanel from "$development-views/template-reference/components/diagram-panel.svelte";
+  import DiagramRows from "$development-views/template-reference/components/diagram-rows.svelte";
+  import DiagramSaves from "$development-views/template-reference/components/diagram-saves.svelte";
+  import DiagramScope from "$development-views/template-reference/components/diagram-scope.svelte";
+  import DiagramVerbs from "$development-views/template-reference/components/diagram-verbs.svelte";
+  import ReferenceHeader from "$development-views/template-reference/components/reference-header.svelte";
+  import "$development-views/template-reference/components/reference.css";
+  import { LIFECYCLE, NOUNS, REFUSALS, RULES, STRIPPED, VERBS } from "$development-views/template-reference/procedures/system";
+  import { hrefOf } from "$development-views/template-reference/procedures/navigation";
+
+  let {
+    material,
+    materials = [],
+    onmaterial
+  }: {
+    material?: string;
+    materials?: readonly string[];
+    onmaterial?: (next: string) => void;
+  } = $props();
+
+  const project = $derived(page.params.project ?? "dev-project");
+</script>
+
+<div class="tref">
+  <ReferenceHeader current="system" {material} {materials} {onmaterial} />
+
+  <main class="tref-page">
+    <header class="tref-mast">
+      <div>
+        <span class="tref-kicker">01 · The system</span>
+        <h1>How templates work</h1>
+        <p class="tref-lede">
+          A template is the project's saved original. You keep a copy of something you have, you ask for a
+          copy of it somewhere else, and you change the original by editing a copy of it. Everything below
+          is those three sentences, said precisely.
+        </p>
+      </div>
+      <div class="tref-facts">
+        <dl>
+          <div><dt>Belongs to</dt><dd>One project</dd></div>
+          <div><dt>Edited through</dt><dd>One shared working copy</dd></div>
+          <div><dt>Placed by</dt><dd>Insert · Use</dd></div>
+          <div><dt>Holes come from</dt><dd>Prompt scopes in the body</dd></div>
+          <div><dt>Links back</dt><dd>None, in either direction</dd></div>
+        </dl>
+      </div>
+    </header>
+
+    <nav class="tref-jumps" aria-label="On this page">
+      <a href="#verbs">The three verbs</a>
+      <a href="#saves">Two saves</a>
+      <a href="#nouns">Every word</a>
+      <a href="#rows">Where it lives</a>
+      <a href="#lifecycle">Step by step</a>
+      <a href="#holes">Holes and scope</a>
+      <a href="#portable">What a template may not carry</a>
+      <a href="#panels">The panels</a>
+      <a href="#rules">Rules and refusals</a>
+    </nav>
+
+    <section class="tref-section" id="verbs">
+      <div class="tref-section-head">
+        <div><span class="tref-kicker">The shape of it</span><h2>Three verbs, and nothing else</h2></div>
+        <p>
+          Templates were real before this work; what was missing was a way to edit one, a way to say what a
+          hole selects, and a way to pull one into something already open. All three are the same act
+          seen from different sides: making a copy.
+        </p>
+      </div>
+
+      <figure class="tref-figure">
+        <DiagramVerbs />
+        <figcaption>
+          <b>Read it as a copy machine with one rule:</b> the template's body changes on exactly one arrow.
+          Everything else reads the template or writes somewhere else.
+        </figcaption>
+      </figure>
+
+      <div class="tref-cards">
+        {#each VERBS as verb (verb.name)}
+          <article class="tref-card">
+            <h3>{verb.name}</h3>
+            <p>{verb.gesture}</p>
+            <p><b>Does</b> — {verb.does}</p>
+            <p><b>Leaves</b> — {verb.leaves}</p>
+            <span class="tref-meta">{verb.procedure}</span>
+          </article>
+        {/each}
+      </div>
+    </section>
+
+    <section class="tref-section" id="saves">
+      <div class="tref-section-head">
+        <div><span class="tref-kicker">The question everyone asks</span><h2>Two saves, two meanings</h2></div>
+        <p>
+          The editor already saves. A working copy is an ordinary document, so every keystroke is flushed
+          the way it always is — and none of that reaches the template. The Templates panel's
+          <b>Save</b>, beside Discard, is the separate gesture that says: publish this now.
+        </p>
+      </div>
+
+      <figure class="tref-figure">
+        <DiagramSaves />
+        <figcaption>
+          <b>Yes, you have to press it.</b> The editor's own saving keeps your work safe on the copy;
+          the template moves only when you ask. It is refused while anything is still unflushed, because
+          the server reads the copy's leader snapshot rather than your screen.
+        </figcaption>
+      </figure>
+
+      <p class="tref-prose">
+        The same asymmetry answers the collaboration question. Two people editing a template land in the
+        same working copy and see each other through the editor's ordinary sync; if both press Save to
+        template, the second is refused as <code>stale</code>, re-reads the revision, and saves the copy
+        they both already see. Nothing is silently overwritten and nothing is merged twice.
+      </p>
+    </section>
+
+    <section class="tref-section" id="nouns">
+      <div class="tref-section-head">
+        <div><span class="tref-kicker">Vocabulary</span><h2>Every word, defined once</h2></div>
+        <p>
+          Nine nouns carry the whole feature. Each says what it is, what it is on disk, and — where it
+          matters — what it is not, because most of the confusion is a word doing two jobs.
+        </p>
+      </div>
+
+      <div class="tref-cards">
+        {#each NOUNS as noun (noun.term)}
+          <article class="tref-card">
+            <h3>{noun.term} {#if noun.aka}<span>· also “{noun.aka}”</span>{/if}</h3>
+            <p>{noun.says}</p>
+            {#if noun.not}<p class="tref-not">{noun.not}</p>{/if}
+            <span class="tref-meta">{noun.onDisk}</span>
+          </article>
+        {/each}
+      </div>
+    </section>
+
+    <section class="tref-section" id="rows">
+      <div class="tref-section-head">
+        <div><span class="tref-kicker">On disk</span><h2>Where a template lives</h2></div>
+        <p>
+          Three groups of rows, and the working copy is the only one that needed a new table. The scratch
+          resource is an ordinary document or deck, which is why the editors, the runtime and the change
+          ledger work on it without knowing what it is.
+        </p>
+      </div>
+      <div class="tref-figure"><DiagramRows /></div>
+    </section>
+
+    <section class="tref-section" id="lifecycle">
+      <div class="tref-section-head">
+        <div><span class="tref-kicker">Step by step</span><h2>What happens, in order</h2></div>
+        <p>
+          Each row is one thing a person does. The columns are where the consequence lands: the panel in
+          front of them, the procedure on the server, and the rows that exist afterwards.
+        </p>
+      </div>
+
+      <div class="tref-lanes">
+        <div class="head"></div>
+        <div class="head">Person</div>
+        <div class="head">Editor and panel</div>
+        <div class="head">Capability</div>
+        <div class="head">Rows afterwards</div>
+        {#each LIFECYCLE as step (step.index)}
+          <div class="step"><span>{step.index}</span><b>{step.title}</b></div>
+          <div>{step.person}</div>
+          <div>{step.client}</div>
+          <div>{step.server}</div>
+          <div class="rows">{step.rows}</div>
+        {/each}
+      </div>
+    </section>
+
+    <section class="tref-section" id="holes">
+      <div class="tref-section-head">
+        <div><span class="tref-kicker">Holes and what fills them</span><h2>Holes and scope</h2></div>
+        <p>
+          A scope hole is an empty place a prompt punched. Saving a template declares exactly the names the body's
+          prompt scopes use — which is why the panels let you describe a hole and set its scope, and
+          never let you add or remove one.
+        </p>
+      </div>
+
+      <figure class="tref-figure">
+        <DiagramScope />
+        <figcaption>
+          <b>Resolution, in order.</b> Because the last step always answers, a template can always be
+          placed; the one refusal is a name the template never declared.
+        </figcaption>
+      </figure>
+
+      <div class="tref-note">
+        <h4>Where the names come from today, and where they will come from</h4>
+        <p>
+          A body carries a hole when a prompt's scope holds <code>{"{ select: \"hole\", name }"}</code>.
+          Prompt blocks are not built yet, so today that happens when a template that already has one is
+          inserted into a working copy: the terms are kept as holes and the inserted template's holes
+          join this one's.
+        </p>
+        <p>
+          The agreed shape for when prompt blocks land is pull-based: making a template walks the prompts
+          it found and asks what each one's scope should be, and two prompts may point at the same
+          hole. Nothing about the model here changes when that arrives — it only starts declaring
+          holes on its own.
+        </p>
+      </div>
+
+      <p class="tref-prose">
+        A <b>resource set</b> — “Winter filings”, “Field evidence” — is a named selection of the project's
+        things, made in Project Overview's Contexts panel. Those are the names in the Insert modal's
+        dropdown, offered beside “everything in the project” and the five kinds. A set that a hole's
+        default names cannot be deleted while it does.
+      </p>
+    </section>
+
+    <section class="tref-section" id="portable">
+      <div class="tref-section-head">
+        <div><span class="tref-kicker">Value to function</span><h2>What a template may not carry</h2></div>
+        <p>
+          A template converts a value into a function, so the parts of a body that point at one particular
+          thing are stripped when it becomes a template. This holds inside one project as much as across
+          two: what is removed is the binding, not the shape.
+        </p>
+      </div>
+
+      <div class="tref-scroll">
+        <table class="tref-table">
+          <thead><tr><th>Dropped</th><th>What survives</th></tr></thead>
+          <tbody>
+            {#each STRIPPED as row (row.item)}
+              <tr><td>{row.item}</td><td>{row.keeps}</td></tr>
+            {/each}
+          </tbody>
+        </table>
+      </div>
+
+      <div class="tref-note">
+        <h4>The project-neutral form is a real state, drawn as one</h4>
+        <p>
+          A formula atom in a template keeps its expression and has no <code>formulaId</code>; a prompt keeps
+          its text and has no generated output. The document editor draws an unbound formula with a dashed
+          outline and says so on hover, so a person reading a template can see which parts are waiting to be
+          bound rather than wondering why a number looks stale.
+        </p>
+        <p>
+          Every save says what it dropped, in words — “Dropped 2 links to things in the project.” — so the
+          loss is never silent. Comments are stripped the same way: a working copy refuses to take a thread
+          at all.
+        </p>
+      </div>
+    </section>
+
+    <section class="tref-section" id="panels">
+      <div class="tref-section-head">
+        <div><span class="tref-kicker">What a person sees</span><h2>The Templates panel, both states</h2></div>
+        <p>
+          One panel per editor, in the same place on both rails, in one of two states depending on whether
+          what is open is a template's working copy. Everything is drawn from the shipped panel and overlay
+          vocabularies — no new components exist for any of this.
+        </p>
+      </div>
+
+      <div class="tref-figure"><DiagramPanel /></div>
+
+      <p class="tref-prose">
+        Project Overview carries the third panel, <b>Contexts</b>, where resource sets are made and
+        counted; the templates library carries the fourth surface, the inspector, where a template's name,
+        description, tags and holes are read and Use, Edit, Duplicate and Delete sit in one row.
+      </p>
+    </section>
+
+    <section class="tref-section" id="rules">
+      <div class="tref-section-head">
+        <div><span class="tref-kicker">Invariants</span><h2>Rules that always hold, and every refusal</h2></div>
+        <p>
+          The rules are what the design will not trade away. The refusals are what a person can actually
+          run into, each answered as a value with a reason rather than thrown as an error.
+        </p>
+      </div>
+
+      <div class="tref-cards">
+        {#each RULES as rule (rule.rule)}
+          <article class="tref-card">
+            <h3>{rule.rule}</h3>
+            <p>{rule.because}</p>
+          </article>
+        {/each}
+      </div>
+
+      <div class="tref-scroll">
+        <table class="tref-table">
+          <thead><tr><th>When</th><th>The answer</th><th>Where</th></tr></thead>
+          <tbody>
+            {#each REFUSALS as row (row.when)}
+              <tr><td>{row.when}</td><td><code>{row.answer}</code></td><td class="muted">{row.where}</td></tr>
+            {/each}
+          </tbody>
+        </table>
+      </div>
+
+      <div class="tref-note attention">
+        <h4>Not built yet</h4>
+        <p>
+          Prompt blocks that pick a hole; images stored with a template so they travel; making a new
+          formula instance for a project-neutral atom; and opening a spreadsheet template for editing,
+          which waits on the spreadsheet editor. Each is listed with a recommendation on
+          <a href={hrefOf(project, "changes")}>What changed</a>.
+        </p>
+      </div>
+    </section>
+  </main>
+
+  <footer class="tref-footer">
+    <div>
+      <span>Icarus · templates</span>
+      <span>work/template-features</span>
+    </div>
+    <div>
+      <a href={hrefOf(project, "changes")}>What changed →</a>
+      <a href={`/app/${project}`}>Open the app</a>
+    </div>
+  </footer>
+</div>
~~~~

### new · `src/lib/development-views/template-reference/procedures/changes.ts` (+312 / −0)

~~~~diff
@@ -0,0 +1,312 @@
+import type { Decision, OpenItem, SystematicChange, Verification } from "$development-views/template-reference/types";
+
+export const SYSTEMATIC: SystematicChange[] = [
+  {
+    index: "01",
+    title: "A template belongs to a project",
+    before: "A template had an owner and no project. The library listed what the viewer owned; update, delete and save were owner-only.",
+    now: "templates.projectId is required. Visibility, editing, saving and deletion are the project's; userId records who made it and grants nothing. Every library row reads Project.",
+    why: "Templates are the project's material. The owner-only refusals were the only thing making a shared library impossible.",
+    area: "templates"
+  },
+  {
+    index: "02",
+    title: "A template is edited through a working copy",
+    before: "The templates category had an editor door that printed the session record it was waiting for. A template's body could not be changed at all.",
+    now: "openTemplateStage writes the body into a scratch document or deck and records a templateStages row; the ordinary editor opens on it; the panel's Save writes it back as the next revision; Discard removes it.",
+    why: "The editors work on documents and decks, not on templates. A copy that is an ordinary resource needs no new editor, no new runtime and no new surface.",
+    area: "templates"
+  },
+  {
+    index: "03",
+    title: "One working copy, shared, and it is the only writer",
+    before: "Nothing existed to share. The first pass tracked a copy per person and drew an editing mark.",
+    now: "One stage per template, keyed by template and project. Two people editing land in the same copy and collaborate through the editor's own sync. Nothing records who is editing.",
+    why: "This is a multi-user application: the editors already reconcile concurrent sessions on one resource. Because the copy is the only writer of the body, a template and its copy cannot drift.",
+    area: "templates"
+  },
+  {
+    index: "04",
+    title: "Holes are found, described and scoped",
+    before: "A hole was fixed at seed time with a portable default and no way to change it.",
+    now: "Saving or committing declares every hole name the body's prompt scopes use. The panels show them read-only, with a description and a default scope set through a modal — everything in the project, kinds, or one of the project's sets.",
+    why: "A hole exists because a prompt asks for one. Typing a name that no prompt uses would be a hole nothing fills.",
+    area: "templates"
+  },
+  {
+    index: "05",
+    title: "Placing a template asks what its holes select",
+    before: "Instantiate resolved from the stored defaults and had no way to be told anything.",
+    now: "Insert and Use open one modal listing every hole, its description, and a choice whose first option is the default. The answers win for that copy and are stored nowhere.",
+    why: "Instantiating on its own and instantiating inside something else are the same act. Inserting into a template being edited is the exception: it keeps the holes and merges the holes.",
+    area: "editors"
+  },
+  {
+    index: "06",
+    title: "Resource sets became a subject",
+    before: "The resourceSets table existed, was seeded with two rows, and no capability read or wrote it.",
+    now: "A resource-sets capability of four procedures, and a Contexts panel in Project Overview that makes, renames, changes and deletes sets and counts what each one selects right now.",
+    why: "A prompt's scope, a hole's default and an answer can all name a set. Nothing could say what a set meant.",
+    area: "sets"
+  },
+  {
+    index: "07",
+    title: "A template of one slide",
+    before: "A deck template was the whole deck.",
+    now: "Save slide copies the current slide, its layout, and the deck's theme and styles into a deck template holding that slide alone.",
+    why: "A slide-sized template needed no fourth body kind: everything that draws, validates, stages and inserts a deck already works on it.",
+    area: "templates"
+  },
+  {
+    index: "08",
+    title: "Nothing points back at a template",
+    before: "documents, slideDecks and spreadsheets carried a templateId, deletion detached it, and the library derived recency by joining through it.",
+    now: "The field is gone. A resource made from a template is a copy that knows nothing of where it came from; the template records its own lastUsedAt, which is what recency reads.",
+    why: "Saving a resource as a template is a copy, and making a resource from a template is a copy. Neither side should know about the other.",
+    area: "templates"
+  },
+  {
+    index: "09",
+    title: "Comments do not travel, and cannot be started on a copy",
+    before: "A working copy was an ordinary resource, so it took comment threads like any other.",
+    now: "startThread reads the stage table and refuses a target one of its rows names; both deck comment panels replace their composer with the reason.",
+    why: "If links, images and formula bindings are stripped, a comment — which can mention a person — is one more thing that must not ride along.",
+    area: "neighbours"
+  },
+  {
+    index: "10",
+    title: "The vocabulary gained one table, one field, one term",
+    before: "No representation of a working copy; a templated scope could not name a set; a tab could not be opened onto a named context view.",
+    now: "templateStages; a set term on TemplatedTerm; Target.context; and four pure functions under behavior/templates (resolve scopes, make portable, mint fresh ids, take one slide as a deck) plus resource-set resolution.",
+    why: "Both processes need the same functions — the capability validates with them, the editors insert with them — and behavior is where a lint rule keeps them free of clocks, randomness and stores.",
+    area: "vocabulary"
+  },
+  {
+    index: "11",
+    title: "A panel section waits a tick before it discloses",
+    before: "A section that started open mounted its body in the tick that mounted its heading, and tearing that panel down left the disclosure primitive reading a derived from the destroyed tick.",
+    now: "PanelSection mounts the body once the heading has settled, so switching away from a panel holding an open section no longer warns.",
+    why: "The Templates panel is the first panel whose open section is switched away from under test, and every browser specification fails on a console warning.",
+    area: "cross-cutting"
+  },
+  {
+    index: "12",
+    title: "A scope is built rather than picked",
+    before:
+      "A hole's default and an answer were a short list of toggles: everything, some kinds, or one of the project's named sets. Nothing could exclude anything, and nothing could name a particular resource.",
+    now: "One builder, opened from four places, with two term lists and a live count. A rule that excludes something or names resources is stored as a resourceSets row with no name, bound to the hole that owns it, and what points at it is a single set term.",
+    why: "Resolving a template substitutes one term for what fills it, on either side of a prompt's scope, and a difference cannot be substituted on the excluding side. The row is what makes exclusions expressible at all.",
+    area: "sets"
+  },
+  {
+    index: "13",
+    title: "A template asks for words as well as for resources",
+    before:
+      "A template's only empty place was a prompt's scope. Prose was fixed: a template that wanted a subject line, a client name or a date had to be edited after it was placed.",
+    now: "A template atom is a hole in the prose, declared beside the scope holes and found from the body once it is placed. Placing a template lists every hole as a key and what answers it, opens each one to its description, and refuses while any words are missing.",
+    why: "A template is a function and its empty places are its arguments. Whether they select resources or say words, one list is what the person placing it has to fill.",
+    area: "vocabulary"
+  },
+  {
+    index: "14",
+    title: "A hole is a hole, never a variable",
+    before:
+      "The empty places a template leaves were called variables, in the types, the tables, the capability, the panels and the seed — the same word this application already uses for a named value a formula reads.",
+    now: "TemplateHole, templates.holes, holeCount, holeDescription, hole-in-use, { select: \"hole\" } and a boundTo of kind hole. The Holes band sits above a rule, with Create hole at its top; the formula Variables panel keeps the word it had first.",
+    why: "Two unrelated ideas sharing a word is how a vocabulary stops being one. A template's holes have nothing to do with formula variables, so they no longer read as though they do.",
+    area: "vocabulary"
+  },
+  {
+    index: "15",
+    title: "A text hole is made where it goes",
+    before:
+      "Every hole was found from the body, so a text hole could only appear by inserting a template that already had one. Nothing in the panel could make a place for words.",
+    now: "Create hole, at the top of the Holes band, takes a name, a description and default words, declares the hole and drops its atom at the caret in one act. A scope hole is still found, because a prompt is what asks for one.",
+    why: "Only the writer knows where in the prose a hole belongs, so the panel cannot find it. Declaring without placing would leave a hole nothing fills, which is why the two happen together or not at all.",
+    area: "editors"
+  }
+];
+
+export const DECISIONS: Decision[] = [
+  {
+    round: "First review",
+    question: "Should a slide template be its own kind?",
+    answer: "No. A slide or a set of slides just becomes a slide deck.",
+    became: "deckOfSlide() makes a deck body with one slide; the slide body kind, its validation and its panel toggles were deleted."
+  },
+  {
+    round: "First review",
+    question: "Where does a hole's meaning live?",
+    answer: "In a default that always exists — everything in the project unless the template says otherwise. There is no binding.",
+    became: "TemplateHole.default, the modal that sets it, and the removal of the per-project binding table and its procedure."
+  },
+  {
+    round: "First review",
+    question: "Should we track who is editing a template?",
+    answer: "No — this is a multi-user application and the editors manage the save between them.",
+    became: "One shared stage per template; no viewer field, no editing mark; the panel and library say nothing about who is in it."
+  },
+  {
+    round: "Second review",
+    question: "Are templates bound to the project?",
+    answer: "Yes, and those are the only templates we care about for now.",
+    became: "templates.projectId, project-scoped visibility, no owner-only refusals, and a default that may name one of the project's sets."
+  },
+  {
+    round: "Second review",
+    question: "Should saving keep the working copy open?",
+    answer: "Keep it simple: saving updates the template and the copy stays.",
+    became: "commitTemplateStage leaves the stage; the copy is closed only by Discard."
+  },
+  {
+    round: "Third review",
+    question: "Does a copy inside its own project still drop links, images and set scopes?",
+    answer: "Yes. A template converts a value into a function, so the constraints do not change with where it lives.",
+    became: "The stripping stands, the reasons are written down, and an unbound formula atom keeps its expression and is drawn as project-neutral in the editor."
+  },
+  {
+    round: "Third review",
+    question: "Should Use ask for holes the way Insert does?",
+    answer: "Yes — instantiating on its own or inside something else is still instantiating.",
+    became: "The library inspector's Use opens the same modal and sends the answers to instantiateTemplate."
+  },
+  {
+    round: "Third review",
+    question: "Can a person add or remove a hole?",
+    answer: "No. Holes come from prompt blocks; adding one by hand asks the author to keep a list in step with a body.",
+    became: "The Add field and the Remove button are gone from both panels, and the helpers that minted names were deleted with them."
+  },
+  {
+    round: "Third review",
+    question: "Should a resource point at the template it came from?",
+    answer: "No. Making a template and using one are both copies; neither side should know about the other.",
+    became: "templateId removed from documents, slideDecks and spreadsheets and from the seed; templates.lastUsedAt records use instead."
+  },
+  {
+    round: "Third review",
+    question: "Are comments allowed on a working copy?",
+    answer: "No — if the rest is stripped, comments are stripped too.",
+    became: "startThread refuses a stage target; the deck's two comment panels say so where the composer would be."
+  }
+];
+
+export const VERIFICATION: Verification[] = [
+  { check: "Types", command: "pnpm typecheck", result: "0 errors, 0 warnings across 2,907 files", clean: true },
+  { check: "Structure", command: "pnpm lint", result: "56 checks, 56 clean", clean: true },
+  { check: "Unit", command: "pnpm test", result: "1,031 tests in 116 files, 2 skipped", clean: true },
+  { check: "Category keys", command: "pnpm category-keys -- --check", result: "10 categories and 13 content views in step", clean: true },
+  {
+    check: "Browser",
+    command: "pnpm test:browser, from a clean seed",
+    result: "58 of 58, with 4 skipped — the live-intelligence cases the base branch skips when no credential is configured.",
+    clean: true
+  }
+];
+
+export const OPEN: OpenItem[] = [
+  {
+    title: "Holes from the prompt blocks this branch now sits on",
+    detail:
+      "The base branch has live prompt blocks in both editors, so a scope hole can finally come from a prompt somebody wrote rather than only from an inserted template. Nothing here has been taught to read them yet: a hole still appears when a body already carries a { select: \"hole\" } scope. The agreed shape is pull-based — making a template walks the prompts it found and asks what each one's scope should be, and two prompts may point at the same hole.",
+    recommendation: "Build it against the prompt block that now exists, as the next piece of work."
+  },
+  {
+    title: "Images stored with a template",
+    detail: "An image stored in the project is dropped when a body becomes portable, so a template cannot carry one.",
+    recommendation: "Store the file with the template so it travels; the strip list already names this as the item most likely to change."
+  },
+  {
+    title: "Binding a project-neutral formula",
+    detail: "A formula atom in a template keeps its expression and has no formulaId; the editor draws it unbound. Nothing makes a new formula instance for it when a copy lands.",
+    recommendation: "Belongs to the formula system, which the base does not have yet."
+  },
+  {
+    title: "Where resource sets are managed",
+    detail: "Sets are made and changed in Project Overview's Contexts panel, which the rail already named.",
+    recommendation: "Keep it there until a set needs a screen of its own."
+  },
+  {
+    title: "Inserting a deck template brings layouts",
+    detail: "A deck insert brings any layout and style key the deck lacks, with the deck's own version winning where both have one.",
+    recommendation: "Keep it — a slide without its layout draws wrong."
+  },
+  {
+    title: "A spreadsheet template cannot be opened",
+    detail: "There is no spreadsheet editor to open a working copy in, so the stage target excludes it and the library says why.",
+    recommendation: "Nothing to decide until that editor lands."
+  }
+];
+
+export const MERGE = {
+  base: "1166f8e",
+  commits: 43,
+  mainFiles: 432,
+  overlap: [
+    "app/seed/templates.json",
+    "app/seed/templateVersions.json",
+    "app/src/lib/app-views/categories/document-editor/content/document.svelte",
+    "app/src/lib/app-views/categories/document-editor/procedures/projection.ts",
+    "app/src/lib/app-views/categories/document-editor/procedures/schema.ts",
+    "app/src/lib/app-views/categories/slide-deck-editor/context/comments.svelte",
+    "app/src/lib/app-views/categories/slide-deck-editor/context/templates.svelte",
+    "app/src/lib/app-views/categories/slide-deck-editor/inspector/threads.svelte",
+    "app/src/lib/app-views/categories/slide-deck-editor/procedures/scene.ts",
+    "app/src/lib/app-views/categories/slide-deck-editor/procedures/typing.ts",
+    "app/src/lib/app-views/categories/slide-deck-editor/slide-deck-editor.md",
+    "app/src/lib/capabilities/comments/api/start-thread/start-thread.ts",
+    "app/src/lib/capabilities/comments/comments.md",
+    "app/src/lib/capabilities/comments/test/unit/comments.test.ts",
+    "app/src/lib/capabilities/templates/api/instantiate-template/instantiate-template.ts",
+    "app/src/lib/capabilities/templates/api/shared/validation.ts",
+    "app/src/lib/capabilities/templates/test/unit/templates.test.ts",
+    "app/src/lib/development-views/demo/components/demo-index.svelte",
+    "app/src/lib/model/client/workspace-state/test/unit/workspace-state.test.ts",
+    "app/src/lib/representation/data/behavior/content/positions.ts",
+    "app/src/lib/representation/data/behavior/slide-decks/apply-ops.ts",
+    "app/src/lib/representation/data/behavior/workspace/opening.ts",
+    "app/src/lib/representation/data/types/workspace/tab.ts",
+    "app/test/browser/document-editor.spec.ts"
+  ],
+  conflicts: [
+    {
+      path: "instantiate-template.ts",
+      note: "The base normalizes a document's styles and readies a deck before the leader snapshot is written. Both calls were kept, alongside this branch's scope resolution, and the deck branch took the base's destructuring."
+    },
+    {
+      path: "templates.test.ts",
+      note: "The base asserts the readied deck; this branch asserts lastUsedAt and that no copy carries a template id. Both assertions now stand in the same test."
+    },
+    {
+      path: "slide-deck-editor.md",
+      note: "The base cut the document from 714 lines to 221 and later added a Prompts section. Its rewrite was taken whole each time, and the Templates panel was described again beside it in the same terse register."
+    },
+    {
+      path: "document-editor.spec.ts",
+      note: "Both sides moved one context view out of the same loop to assert it on its own — the base for Prompts, this branch for Templates. The loop now covers Variables alone and both blocks stand under it."
+    },
+    {
+      path: "typing.ts",
+      note: "The base taught the deck's typing to edit a Prompt Block; this branch measured atoms through displayOfAtom so a template atom counts. The editable-block type is the base's and the measurement is this branch's."
+    }
+  ]
+};
+
+export const MODEL_DELTA = {
+  added: [
+    { name: "templateStages", note: "projectId, templateId, templateRevision, target, resourceId, createdBy, updatedAt" },
+    { name: "templates.projectId", note: "required — the project a template belongs to" },
+    { name: "templates.lastUsedAt", note: "optional — when it was last instantiated, which is what recency reads" },
+    { name: "TemplatedTerm { select: \"set\" }", note: "a hole default may name one of the project's sets" },
+    { name: "Target.context", note: "a tab can be opened straight onto a named context view" }
+  ],
+  removed: [
+    { name: "documents.templateId", note: "a copy knows nothing of where it came from" },
+    { name: "slideDecks.templateId", note: "the same" },
+    { name: "spreadsheets.templateId", note: "the same" }
+  ],
+  unchanged: [
+    { name: "TemplateBody", note: "document | slides | spreadsheet, exactly as before" },
+    { name: "TemplateHole", note: "name, label, description?, default? — main's shape" },
+    { name: "resourceSets", note: "the table was already there; only the capability over it is new" }
+  ]
+};
~~~~

### new · `src/lib/development-views/template-reference/procedures/inventory.ts` (+148 / −0)

~~~~diff
@@ -0,0 +1,148 @@
+import type { FileRecord } from "$development-views/template-reference/types";
+
+/**
+ * Generated by scripts/generate-template-reference-inventory.mjs.
+ * Comparison: 1166f8e (branch point) → worktree.
+ */
+export const BASELINE = "1166f8e";
+
+export const FILES: FileRecord[] = [
+  {"path":"app/scripts/generate-template-reference-inventory.mjs","status":"A","area":"cross-cutting","kind":"configuration","current":126,"base":0,"added":126,"deleted":0},
+  {"path":"app/seed/documents.json","status":"M","area":"evidence","kind":"fixture","current":38,"base":42,"added":0,"deleted":4},
+  {"path":"app/seed/resourceSets.json","status":"M","area":"evidence","kind":"fixture","current":46,"base":29,"added":17,"deleted":0},
+  {"path":"app/seed/slideDecks.json","status":"M","area":"evidence","kind":"fixture","current":38,"base":42,"added":0,"deleted":4},
+  {"path":"app/seed/spreadsheets.json","status":"M","area":"evidence","kind":"fixture","current":20,"base":22,"added":0,"deleted":2},
+  {"path":"app/seed/templates.json","status":"M","area":"evidence","kind":"fixture","current":2295,"base":1021,"added":1524,"deleted":250},
+  {"path":"app/seed/templateVersions.json","status":"M","area":"evidence","kind":"fixture","current":2695,"base":2199,"added":518,"deleted":22},
+  {"path":"app/src/lib/app-views/categories/document-editor/content/document.svelte","status":"M","area":"editors","kind":"production","current":954,"base":939,"added":15,"deleted":0},
+  {"path":"app/src/lib/app-views/categories/document-editor/context/templates.svelte","status":"A","area":"editors","kind":"production","current":683,"base":0,"added":683,"deleted":0},
+  {"path":"app/src/lib/app-views/categories/document-editor/procedures/projection.ts","status":"M","area":"editors","kind":"production","current":751,"base":726,"added":33,"deleted":8},
+  {"path":"app/src/lib/app-views/categories/document-editor/procedures/schema.ts","status":"M","area":"editors","kind":"production","current":255,"base":221,"added":37,"deleted":3},
+  {"path":"app/src/lib/app-views/categories/document-editor/procedures/templating.ts","status":"A","area":"editors","kind":"production","current":394,"base":0,"added":394,"deleted":0},
+  {"path":"app/src/lib/app-views/categories/document-editor/procedures/test/unit/templating.test.ts","status":"A","area":"editors","kind":"test","current":167,"base":0,"added":167,"deleted":0},
+  {"path":"app/src/lib/app-views/categories/project-overview/context/contexts.svelte","status":"A","area":"contexts","kind":"production","current":283,"base":0,"added":283,"deleted":0},
+  {"path":"app/src/lib/app-views/categories/project-overview/procedures/contexts.ts","status":"A","area":"contexts","kind":"production","current":115,"base":0,"added":115,"deleted":0},
+  {"path":"app/src/lib/app-views/categories/project-overview/procedures/test/unit/contexts.test.ts","status":"A","area":"contexts","kind":"test","current":68,"base":0,"added":68,"deleted":0},
+  {"path":"app/src/lib/app-views/categories/project-overview/project-overview.md","status":"M","area":"contexts","kind":"documentation","current":622,"base":618,"added":25,"deleted":21},
+  {"path":"app/src/lib/app-views/categories/slide-deck-editor/context/comments.svelte","status":"M","area":"editors","kind":"production","current":175,"base":170,"added":6,"deleted":1},
+  {"path":"app/src/lib/app-views/categories/slide-deck-editor/context/templates.svelte","status":"M","area":"editors","kind":"production","current":705,"base":8,"added":700,"deleted":3},
+  {"path":"app/src/lib/app-views/categories/slide-deck-editor/inspector/threads.svelte","status":"M","area":"editors","kind":"production","current":151,"base":144,"added":8,"deleted":1},
+  {"path":"app/src/lib/app-views/categories/slide-deck-editor/procedures/scene.ts","status":"M","area":"editors","kind":"production","current":333,"base":333,"added":3,"deleted":3},
+  {"path":"app/src/lib/app-views/categories/slide-deck-editor/procedures/templating.ts","status":"A","area":"editors","kind":"production","current":418,"base":0,"added":418,"deleted":0},
+  {"path":"app/src/lib/app-views/categories/slide-deck-editor/procedures/test/unit/templating.test.ts","status":"A","area":"editors","kind":"test","current":130,"base":0,"added":130,"deleted":0},
+  {"path":"app/src/lib/app-views/categories/slide-deck-editor/procedures/typing.ts","status":"M","area":"editors","kind":"production","current":206,"base":207,"added":2,"deleted":3},
+  {"path":"app/src/lib/app-views/categories/slide-deck-editor/slide-deck-editor.md","status":"M","area":"editors","kind":"documentation","current":284,"base":262,"added":23,"deleted":1},
+  {"path":"app/src/lib/app-views/categories/templates/content/editor.svelte","status":"M","area":"library","kind":"production","current":81,"base":50,"added":48,"deleted":17},
+  {"path":"app/src/lib/app-views/categories/templates/content/library.svelte","status":"M","area":"library","kind":"production","current":555,"base":543,"added":33,"deleted":21},
+  {"path":"app/src/lib/app-views/categories/templates/inspector/template.svelte","status":"M","area":"library","kind":"production","current":1413,"base":1185,"added":347,"deleted":119},
+  {"path":"app/src/lib/app-views/categories/templates/procedures/library.svelte.ts","status":"M","area":"library","kind":"production","current":488,"base":356,"added":177,"deleted":45},
+  {"path":"app/src/lib/app-views/categories/templates/procedures/test/unit/library.test.ts","status":"M","area":"library","kind":"test","current":41,"base":25,"added":16,"deleted":0},
+  {"path":"app/src/lib/app-views/categories/templates/templates.md","status":"M","area":"library","kind":"documentation","current":80,"base":109,"added":46,"deleted":75},
+  {"path":"app/src/lib/capabilities/comments/api/start-thread/start-thread.ts","status":"M","area":"neighbours","kind":"production","current":44,"base":36,"added":8,"deleted":0},
+  {"path":"app/src/lib/capabilities/comments/comments.md","status":"M","area":"neighbours","kind":"documentation","current":19,"base":15,"added":4,"deleted":0},
+  {"path":"app/src/lib/capabilities/comments/test/unit/comments.test.ts","status":"M","area":"neighbours","kind":"test","current":137,"base":125,"added":12,"deleted":0},
+  {"path":"app/src/lib/capabilities/project-resources/api/read-project-resource-index/read-project-resource-index.ts","status":"M","area":"neighbours","kind":"production","current":196,"base":196,"added":9,"deleted":9},
+  {"path":"app/src/lib/capabilities/resource-sets/api/create-resource-set/create-resource-set.ts","status":"A","area":"sets","kind":"production","current":25,"base":0,"added":25,"deleted":0},
+  {"path":"app/src/lib/capabilities/resource-sets/api/create-resource-set/validate-create-resource-set.ts","status":"A","area":"sets","kind":"production","current":22,"base":0,"added":22,"deleted":0},
+  {"path":"app/src/lib/capabilities/resource-sets/api/read-resource-sets/read-resource-sets.ts","status":"A","area":"sets","kind":"production","current":10,"base":0,"added":10,"deleted":0},
+  {"path":"app/src/lib/capabilities/resource-sets/api/remove-resource-set/remove-resource-set.ts","status":"A","area":"sets","kind":"production","current":74,"base":0,"added":74,"deleted":0},
+  {"path":"app/src/lib/capabilities/resource-sets/api/remove-resource-set/validate-remove-resource-set.ts","status":"A","area":"sets","kind":"production","current":16,"base":0,"added":16,"deleted":0},
+  {"path":"app/src/lib/capabilities/resource-sets/api/shared/projection.ts","status":"A","area":"sets","kind":"production","current":220,"base":0,"added":220,"deleted":0},
+  {"path":"app/src/lib/capabilities/resource-sets/api/shared/validation.ts","status":"A","area":"sets","kind":"production","current":172,"base":0,"added":172,"deleted":0},
+  {"path":"app/src/lib/capabilities/resource-sets/api/update-resource-set/update-resource-set.ts","status":"A","area":"sets","kind":"production","current":72,"base":0,"added":72,"deleted":0},
+  {"path":"app/src/lib/capabilities/resource-sets/api/update-resource-set/validate-update-resource-set.ts","status":"A","area":"sets","kind":"production","current":41,"base":0,"added":41,"deleted":0},
+  {"path":"app/src/lib/capabilities/resource-sets/index.remote.ts","status":"A","area":"sets","kind":"production","current":39,"base":0,"added":39,"deleted":0},
+  {"path":"app/src/lib/capabilities/resource-sets/resource-sets.md","status":"A","area":"sets","kind":"documentation","current":27,"base":0,"added":27,"deleted":0},
+  {"path":"app/src/lib/capabilities/resource-sets/test/unit/resource-sets.test.ts","status":"A","area":"sets","kind":"test","current":230,"base":0,"added":230,"deleted":0},
+  {"path":"app/src/lib/capabilities/resource-sets/types/resource-sets.ts","status":"A","area":"sets","kind":"production","current":72,"base":0,"added":72,"deleted":0},
+  {"path":"app/src/lib/capabilities/store/store.md","status":"M","area":"neighbours","kind":"documentation","current":50,"base":51,"added":1,"deleted":2},
+  {"path":"app/src/lib/capabilities/templates/api/commit-template-stage/commit-template-stage.ts","status":"A","area":"templates","kind":"production","current":121,"base":0,"added":121,"deleted":0},
+  {"path":"app/src/lib/capabilities/templates/api/commit-template-stage/validate-commit-template-stage.ts","status":"A","area":"templates","kind":"production","current":16,"base":0,"added":16,"deleted":0},
+  {"path":"app/src/lib/capabilities/templates/api/create-template-from-resource/create-template-from-resource.ts","status":"A","area":"templates","kind":"production","current":89,"base":0,"added":89,"deleted":0},
+  {"path":"app/src/lib/capabilities/templates/api/create-template-from-resource/validate-create-template-from-resource.ts","status":"A","area":"templates","kind":"production","current":44,"base":0,"added":44,"deleted":0},
+  {"path":"app/src/lib/capabilities/templates/api/create-template/create-template.ts","status":"M","area":"templates","kind":"production","current":34,"base":33,"added":2,"deleted":1},
+  {"path":"app/src/lib/capabilities/templates/api/discard-template-stage/discard-template-stage.ts","status":"A","area":"templates","kind":"production","current":31,"base":0,"added":31,"deleted":0},
+  {"path":"app/src/lib/capabilities/templates/api/discard-template-stage/validate-discard-template-stage.ts","status":"A","area":"templates","kind":"production","current":8,"base":0,"added":8,"deleted":0},
+  {"path":"app/src/lib/capabilities/templates/api/duplicate-template/duplicate-template.ts","status":"M","area":"templates","kind":"production","current":73,"base":72,"added":2,"deleted":1},
+  {"path":"app/src/lib/capabilities/templates/api/instantiate-template/instantiate-template.ts","status":"M","area":"templates","kind":"production","current":237,"base":173,"added":112,"deleted":48},
+  {"path":"app/src/lib/capabilities/templates/api/instantiate-template/validate-instantiate-template.ts","status":"M","area":"templates","kind":"production","current":22,"base":17,"added":8,"deleted":3},
+  {"path":"app/src/lib/capabilities/templates/api/open-template-stage/open-template-stage.ts","status":"A","area":"templates","kind":"production","current":115,"base":0,"added":115,"deleted":0},
+  {"path":"app/src/lib/capabilities/templates/api/open-template-stage/validate-open-template-stage.ts","status":"A","area":"templates","kind":"production","current":8,"base":0,"added":8,"deleted":0},
+  {"path":"app/src/lib/capabilities/templates/api/read-resource-template/read-resource-template.ts","status":"A","area":"templates","kind":"production","current":48,"base":0,"added":48,"deleted":0},
+  {"path":"app/src/lib/capabilities/templates/api/read-resource-template/validate-read-resource-template.ts","status":"A","area":"templates","kind":"production","current":8,"base":0,"added":8,"deleted":0},
+  {"path":"app/src/lib/capabilities/templates/api/remove-template/remove-template.ts","status":"M","area":"templates","kind":"production","current":106,"base":164,"added":10,"deleted":68},
+  {"path":"app/src/lib/capabilities/templates/api/shared/bodies.ts","status":"M","area":"templates","kind":"production","current":308,"base":462,"added":17,"deleted":171},
+  {"path":"app/src/lib/capabilities/templates/api/shared/holes.ts","status":"A","area":"templates","kind":"production","current":39,"base":0,"added":39,"deleted":0},
+  {"path":"app/src/lib/capabilities/templates/api/shared/projection.ts","status":"M","area":"templates","kind":"production","current":266,"base":283,"added":32,"deleted":49},
+  {"path":"app/src/lib/capabilities/templates/api/shared/scopes.ts","status":"A","area":"templates","kind":"production","current":204,"base":0,"added":204,"deleted":0},
+  {"path":"app/src/lib/capabilities/templates/api/shared/stages.ts","status":"A","area":"templates","kind":"production","current":141,"base":0,"added":141,"deleted":0},
+  {"path":"app/src/lib/capabilities/templates/api/shared/template-rows.ts","status":"M","area":"templates","kind":"production","current":37,"base":36,"added":3,"deleted":2},
+  {"path":"app/src/lib/capabilities/templates/api/shared/validation.ts","status":"M","area":"templates","kind":"production","current":1863,"base":1687,"added":227,"deleted":51},
+  {"path":"app/src/lib/capabilities/templates/api/update-template/update-template.ts","status":"M","area":"templates","kind":"production","current":168,"base":113,"added":81,"deleted":26},
+  {"path":"app/src/lib/capabilities/templates/api/update-template/validate-update-template.ts","status":"M","area":"templates","kind":"production","current":65,"base":61,"added":14,"deleted":10},
+  {"path":"app/src/lib/capabilities/templates/index.remote.ts","status":"M","area":"templates","kind":"production","current":125,"base":73,"added":58,"deleted":6},
+  {"path":"app/src/lib/capabilities/templates/templates.md","status":"M","area":"templates","kind":"documentation","current":153,"base":91,"added":126,"deleted":64},
+  {"path":"app/src/lib/capabilities/templates/test/unit/answers.test.ts","status":"A","area":"templates","kind":"test","current":491,"base":0,"added":491,"deleted":0},
+  {"path":"app/src/lib/capabilities/templates/test/unit/stages.test.ts","status":"A","area":"templates","kind":"test","current":377,"base":0,"added":377,"deleted":0},
+  {"path":"app/src/lib/capabilities/templates/test/unit/templates.test.ts","status":"M","area":"templates","kind":"test","current":1414,"base":1447,"added":89,"deleted":122},
+  {"path":"app/src/lib/capabilities/templates/types/templates.ts","status":"M","area":"templates","kind":"production","current":252,"base":156,"added":118,"deleted":22},
+  {"path":"app/src/lib/components/authored/panel/panel-section.svelte","status":"M","area":"cross-cutting","kind":"production","current":126,"base":114,"added":13,"deleted":1},
+  {"path":"app/src/lib/components/authored/scope-builder/index.ts","status":"A","area":"cross-cutting","kind":"production","current":9,"base":0,"added":9,"deleted":0},
+  {"path":"app/src/lib/components/authored/scope-builder/scope-builder.svelte","status":"A","area":"cross-cutting","kind":"production","current":455,"base":0,"added":455,"deleted":0},
+  {"path":"app/src/lib/components/authored/template-answers/index.ts","status":"A","area":"cross-cutting","kind":"production","current":8,"base":0,"added":8,"deleted":0},
+  {"path":"app/src/lib/components/authored/template-answers/template-answers.svelte","status":"A","area":"cross-cutting","kind":"production","current":185,"base":0,"added":185,"deleted":0},
+  {"path":"app/src/lib/development-views/demo/components/demo-index.svelte","status":"M","area":"cross-cutting","kind":"production","current":153,"base":153,"added":3,"deleted":3},
+  {"path":"app/src/lib/development-views/template-reference/components/changes-page.svelte","status":"A","area":"reference","kind":"reference","current":285,"base":0,"added":285,"deleted":0},
+  {"path":"app/src/lib/development-views/template-reference/components/diagram-binding.svelte","status":"A","area":"reference","kind":"reference","current":168,"base":0,"added":168,"deleted":0},
+  {"path":"app/src/lib/development-views/template-reference/components/diagram-builder.svelte","status":"A","area":"reference","kind":"reference","current":274,"base":0,"added":274,"deleted":0},
+  {"path":"app/src/lib/development-views/template-reference/components/diagram-difference.svelte","status":"A","area":"reference","kind":"reference","current":128,"base":0,"added":128,"deleted":0},
+  {"path":"app/src/lib/development-views/template-reference/components/diagram-panel.svelte","status":"A","area":"reference","kind":"reference","current":128,"base":0,"added":128,"deleted":0},
+  {"path":"app/src/lib/development-views/template-reference/components/diagram-rows.svelte","status":"A","area":"reference","kind":"reference","current":75,"base":0,"added":75,"deleted":0},
+  {"path":"app/src/lib/development-views/template-reference/components/diagram-saves.svelte","status":"A","area":"reference","kind":"reference","current":63,"base":0,"added":63,"deleted":0},
+  {"path":"app/src/lib/development-views/template-reference/components/diagram-scope.svelte","status":"A","area":"reference","kind":"reference","current":87,"base":0,"added":87,"deleted":0},
+  {"path":"app/src/lib/development-views/template-reference/components/diagram-verbs.svelte","status":"A","area":"reference","kind":"reference","current":79,"base":0,"added":79,"deleted":0},
+  {"path":"app/src/lib/development-views/template-reference/components/file-ledger.svelte","status":"A","area":"reference","kind":"reference","current":138,"base":0,"added":138,"deleted":0},
+  {"path":"app/src/lib/development-views/template-reference/components/reference-header.svelte","status":"A","area":"reference","kind":"reference","current":166,"base":0,"added":166,"deleted":0},
+  {"path":"app/src/lib/development-views/template-reference/components/reference.css","status":"A","area":"reference","kind":"reference","current":305,"base":0,"added":305,"deleted":0},
+  {"path":"app/src/lib/development-views/template-reference/components/scope-page.svelte","status":"A","area":"reference","kind":"reference","current":468,"base":0,"added":468,"deleted":0},
+  {"path":"app/src/lib/development-views/template-reference/components/system-page.svelte","status":"A","area":"reference","kind":"reference","current":329,"base":0,"added":329,"deleted":0},
+  {"path":"app/src/lib/development-views/template-reference/procedures/changes.ts","status":"A","area":"reference","kind":"reference","current":312,"base":0,"added":312,"deleted":0},
+  {"path":"app/src/lib/development-views/template-reference/procedures/inventory.ts","status":"A","area":"reference","kind":"reference","current":148,"base":0,"added":148,"deleted":0},
+  {"path":"app/src/lib/development-views/template-reference/procedures/navigation.ts","status":"A","area":"reference","kind":"reference","current":16,"base":0,"added":16,"deleted":0},
+  {"path":"app/src/lib/development-views/template-reference/procedures/scope.ts","status":"A","area":"reference","kind":"reference","current":521,"base":0,"added":521,"deleted":0},
+  {"path":"app/src/lib/development-views/template-reference/procedures/system.ts","status":"A","area":"reference","kind":"reference","current":223,"base":0,"added":223,"deleted":0},
+  {"path":"app/src/lib/development-views/template-reference/template-reference.svelte","status":"A","area":"reference","kind":"reference","current":5,"base":0,"added":5,"deleted":0},
+  {"path":"app/src/lib/development-views/template-reference/types.ts","status":"A","area":"reference","kind":"reference","current":129,"base":0,"added":129,"deleted":0},
+  {"path":"app/src/lib/model/client/workspace-state/methods/open.ts","status":"M","area":"vocabulary","kind":"production","current":56,"base":46,"added":10,"deleted":0},
+  {"path":"app/src/lib/model/client/workspace-state/methods/shared/mint-view.ts","status":"M","area":"vocabulary","kind":"production","current":9,"base":5,"added":5,"deleted":1},
+  {"path":"app/src/lib/model/client/workspace-state/test/unit/workspace-state.test.ts","status":"M","area":"vocabulary","kind":"test","current":1096,"base":1073,"added":23,"deleted":0},
+  {"path":"app/src/lib/representation/data/behavior/content/positions.ts","status":"M","area":"vocabulary","kind":"production","current":76,"base":68,"added":9,"deleted":1},
+  {"path":"app/src/lib/representation/data/behavior/core/resource-set.ts","status":"A","area":"vocabulary","kind":"production","current":45,"base":0,"added":45,"deleted":0},
+  {"path":"app/src/lib/representation/data/behavior/core/scope-draft.ts","status":"A","area":"vocabulary","kind":"production","current":439,"base":0,"added":439,"deleted":0},
+  {"path":"app/src/lib/representation/data/behavior/core/test/unit/resource-set.test.ts","status":"A","area":"vocabulary","kind":"test","current":46,"base":0,"added":46,"deleted":0},
+  {"path":"app/src/lib/representation/data/behavior/core/test/unit/scope-draft.test.ts","status":"A","area":"vocabulary","kind":"test","current":194,"base":0,"added":194,"deleted":0},
+  {"path":"app/src/lib/representation/data/behavior/documents/apply-ops.ts","status":"M","area":"vocabulary","kind":"production","current":463,"base":462,"added":2,"deleted":1},
+  {"path":"app/src/lib/representation/data/behavior/slide-decks/apply-ops.ts","status":"M","area":"vocabulary","kind":"production","current":324,"base":324,"added":2,"deleted":2},
+  {"path":"app/src/lib/representation/data/behavior/templates/answers.ts","status":"A","area":"vocabulary","kind":"production","current":62,"base":0,"added":62,"deleted":0},
+  {"path":"app/src/lib/representation/data/behavior/templates/deck-of-slide.ts","status":"A","area":"vocabulary","kind":"production","current":18,"base":0,"added":18,"deleted":0},
+  {"path":"app/src/lib/representation/data/behavior/templates/fresh-ids.ts","status":"A","area":"vocabulary","kind":"production","current":71,"base":0,"added":71,"deleted":0},
+  {"path":"app/src/lib/representation/data/behavior/templates/portable.ts","status":"A","area":"vocabulary","kind":"production","current":103,"base":0,"added":103,"deleted":0},
+  {"path":"app/src/lib/representation/data/behavior/templates/scopes.ts","status":"A","area":"vocabulary","kind":"production","current":216,"base":0,"added":216,"deleted":0},
+  {"path":"app/src/lib/representation/data/behavior/templates/test/unit/answers.test.ts","status":"A","area":"vocabulary","kind":"test","current":104,"base":0,"added":104,"deleted":0},
+  {"path":"app/src/lib/representation/data/behavior/templates/test/unit/deck-of-slide.test.ts","status":"A","area":"vocabulary","kind":"test","current":36,"base":0,"added":36,"deleted":0},
+  {"path":"app/src/lib/representation/data/behavior/templates/test/unit/fresh-ids.test.ts","status":"A","area":"vocabulary","kind":"test","current":81,"base":0,"added":81,"deleted":0},
+  {"path":"app/src/lib/representation/data/behavior/templates/test/unit/portable.test.ts","status":"A","area":"vocabulary","kind":"test","current":97,"base":0,"added":97,"deleted":0},
+  {"path":"app/src/lib/representation/data/behavior/templates/test/unit/scopes.test.ts","status":"A","area":"vocabulary","kind":"test","current":109,"base":0,"added":109,"deleted":0},
+  {"path":"app/src/lib/representation/data/behavior/workspace/opening.ts","status":"M","area":"vocabulary","kind":"production","current":168,"base":164,"added":5,"deleted":1},
+  {"path":"app/src/lib/representation/data/types/content/content-block.ts","status":"M","area":"vocabulary","kind":"production","current":145,"base":130,"added":16,"deleted":1},
+  {"path":"app/src/lib/representation/data/types/core/resource-set.ts","status":"M","area":"vocabulary","kind":"production","current":32,"base":40,"added":16,"deleted":24},
+  {"path":"app/src/lib/representation/data/types/templates/template.ts","status":"M","area":"vocabulary","kind":"production","current":71,"base":86,"added":12,"deleted":27},
+  {"path":"app/src/lib/representation/data/types/workspace/tab.ts","status":"M","area":"vocabulary","kind":"production","current":55,"base":54,"added":1,"deleted":0},
+  {"path":"app/src/lib/representation/store/tables.ts","status":"M","area":"vocabulary","kind":"production","current":698,"base":684,"added":26,"deleted":12},
+  {"path":"app/src/routes/app/[project]/reference/templates/+page.svelte","status":"M","area":"reference","kind":"reference","current":14,"base":5,"added":11,"deleted":2},
+  {"path":"app/src/routes/app/[project]/reference/templates/changes/+page.svelte","status":"A","area":"reference","kind":"reference","current":14,"base":0,"added":14,"deleted":0},
+  {"path":"app/src/routes/app/[project]/reference/templates/scope/+page.svelte","status":"A","area":"reference","kind":"reference","current":14,"base":0,"added":14,"deleted":0},
+  {"path":"app/test/browser/document-editor.spec.ts","status":"M","area":"evidence","kind":"test","current":884,"base":877,"added":8,"deleted":1},
+  {"path":"app/test/browser/template-features.spec.ts","status":"A","area":"evidence","kind":"test","current":315,"base":0,"added":315,"deleted":0},
+  {"path":"app/test/browser/template-reference.spec.ts","status":"A","area":"evidence","kind":"test","current":115,"base":0,"added":115,"deleted":0}
+];
~~~~

### new · `src/lib/development-views/template-reference/procedures/navigation.ts` (+16 / −0)

~~~~diff
@@ -0,0 +1,16 @@
+export type ReferencePage = { slug: "system" | "changes" | "scope"; index: string; label: string; sub: string };
+
+export const PAGES: ReferencePage[] = [
+  { slug: "system", index: "01", label: "How templates work", sub: "The model, the verbs, the panels" },
+  { slug: "changes", index: "02", label: "What changed", sub: "Every file, decision and check" },
+  { slug: "scope", index: "03", label: "What a hole selects", sub: "The scope builder, and what it cost" }
+];
+
+const PATHS: Record<ReferencePage["slug"], string> = {
+  system: "",
+  changes: "/changes",
+  scope: "/scope"
+};
+
+export const hrefOf = (project: string, slug: ReferencePage["slug"]): string =>
+  `/app/${project}/reference/templates${PATHS[slug]}`;
~~~~

### new · `src/lib/development-views/template-reference/procedures/scope.ts` (+521 / −0)

~~~~diff
@@ -0,0 +1,521 @@
+import type {
+  LifecycleStep,
+  Refusal,
+  Rule,
+  ScopeDoor,
+  ScopeFork,
+  ScopeGap,
+  ScopeTerm,
+  ScopeWork
+} from "$development-views/template-reference/types";
+
+export const TERMS: ScopeTerm[] = [
+  {
+    select: "project",
+    reads: "Everything in the project",
+    picks: "Every resource the project holds when the scope is read, including ones made after it was chosen.",
+    inABody: "Yes",
+    inADefault: "Yes",
+    inALiveResource: "Yes"
+  },
+  {
+    select: "kinds",
+    reads: "Documents, Findings",
+    picks: "Every resource whose kind matches one named, by prefix, so naming a kind names its subkinds.",
+    inABody: "Yes",
+    inADefault: "Yes",
+    inALiveResource: "Yes"
+  },
+  {
+    select: "set",
+    reads: "The row's name, or the rule it holds when it has none",
+    picks: "Whatever that row's rule picks, followed recursively, with a cycle contributing nothing.",
+    inABody: "Stripped when a template is made",
+    inADefault: "Yes, and this is the change",
+    inALiveResource: "Yes"
+  },
+  {
+    select: "resources",
+    reads: "These three, and nothing else",
+    picks: "Exactly the rows named, and only while they still exist.",
+    inABody: "Stripped when a template is made",
+    inADefault: "Not in the vocabulary",
+    inALiveResource: "Yes"
+  },
+  {
+    select: "hole",
+    reads: "Whatever source_material holds",
+    picks: "The answer given for that hole, else its default, else the whole project.",
+    inABody: "Yes",
+    inADefault: "Yes, one hole may defer to another",
+    inALiveResource: "No"
+  }
+];
+
+export const KINDS: ScopeDoor[] = [
+  {
+    where: "A prompt's scope names it",
+    opens: "scope",
+    title: "A group of resources",
+    confirms: "Always answered: what the caller chose, else the default, else the whole project",
+    writes: "Built in the scope builder, and stored as a row when it excludes or names resources"
+  },
+  {
+    where: "A template atom in the prose names it",
+    opens: "text",
+    title: "Words",
+    confirms: "What the caller typed, else the hole's own default words, else nothing — which is the only thing that holds a placement up",
+    writes: "The atom becomes a literal, and the block's display follows"
+  }
+];
+
+export const DOORS: ScopeDoor[] = [
+  {
+    where: "Templates panel · a hole card on a working copy",
+    opens: "Default scope",
+    title: "Default scope for Source material",
+    confirms: "Set the default scope",
+    writes: "updateTemplate with a rule; the server stores a row if the rule needs one"
+  },
+  {
+    where: "Templates library · the inspector's hole list",
+    opens: "Default scope",
+    title: "Default scope for Source material",
+    confirms: "Set the default scope",
+    writes: "The same procedure, from the other door"
+  },
+  {
+    where: "Insert · one row per hole in the ask modal",
+    opens: "Change",
+    title: "What Source material selects here",
+    confirms: "Use this",
+    writes: "Nothing yet; the rule is held until Insert is pressed"
+  },
+  {
+    where: "Use in the library · the same ask modal",
+    opens: "Change",
+    title: "What Source material selects here",
+    confirms: "Use this",
+    writes: "Nothing yet; the rule is held until Use is pressed"
+  },
+  {
+    where: "Project Overview · Contexts panel",
+    opens: "New set, or a set's Edit",
+    title: "A set of resources",
+    confirms: "Create · Save",
+    writes: "createResourceSet or updateResourceSet with a name, which makes the row a project subject"
+  }
+];
+
+export const LIFECYCLE: LifecycleStep[] = [
+  {
+    index: "1",
+    title: "Open",
+    person: "Presses Default scope on a hole, or Change beside a hole in the ask modal",
+    client: "The builder opens on the rule that is there now, which is the whole project when nothing was chosen",
+    server: "Nothing. It reads the project's resource index and the project's named sets, both already loaded",
+    rows: "None"
+  },
+  {
+    index: "2",
+    title: "Build",
+    person: "Adds kinds, named sets or particular resources to Include, and the same to Exclude",
+    client: "Each addition appends one term to one of two flat lists. Nothing nests and nothing is ordered",
+    server: "Nothing",
+    rows: "None"
+  },
+  {
+    index: "3",
+    title: "Count",
+    person: "Reads how many resources the rule selects right now, and can open the list",
+    client: "resolveResourceSet over the project index and the named sets, on every change",
+    server: "Nothing",
+    rows: "None"
+  },
+  {
+    index: "4",
+    title: "Confirm a default",
+    person: "Presses Set the default scope",
+    client: "Sends the rule as it stands, with no id and no name",
+    server: "updateTemplate stores a bound row when the rule needs one and rewrites the default as a single set term",
+    rows: "templates at N+1, and resourceSets +1 or one row at its next revision"
+  },
+  {
+    index: "5",
+    title: "Confirm an answer",
+    person: "Presses Use this, then Insert or Use",
+    client: "Holds the rule beside the hole's name until the placing call",
+    server: "instantiateTemplate does the same normalisation, owning each row it writes to the resource it makes",
+    rows: "The new resource, plus one row per answer that needs one"
+  },
+  {
+    index: "6",
+    title: "Forget",
+    person: "Deletes the template, or the prompt that asked for the hole",
+    client: "Nothing",
+    server: "removeTemplate deletes the rows its holes own, the way it already discards the stage",
+    rows: "resourceSets −1 per bound row"
+  }
+];
+
+export const RULES: Rule[] = [
+  {
+    rule: "A set stores the rule that selects its members, never the members.",
+    because:
+      "A list captured on save means the project as it was, and starts decaying immediately. A rule resolved when it is read already contains the document made this morning."
+  },
+  {
+    rule: "A row with a name is a project subject. A row without one is bound to whatever points at it.",
+    because:
+      "Naming is the whole difference. A named set is something people curate and reuse. A bound set is a value a hole happens to hold, and asking someone to name it is asking them to file something they never wanted to keep."
+  },
+  {
+    rule: "A bound row has exactly one owner and dies with it.",
+    because:
+      "It exists to give one rule an id. Deleting the template, the hole or the resource that points at it leaves nothing that could read it again."
+  },
+  {
+    rule: "The caller sends a rule. The server decides whether it needs a row.",
+    because:
+      "Two doors set a default and two more give an answer. If each client wrote its own row first, every one of them would need the same normalisation, and each would be a separate round trip that can half-fail."
+  },
+  {
+    rule: "Include, then exclude. The difference is computed when the set is read.",
+    because:
+      "Every set is a difference, so both lists exist even though the exclude list is usually empty."
+  },
+  {
+    rule: "The whole project, and a bare list of kinds, need no row.",
+    because:
+      "They are the common case, they are already expressible inline, and writing rows for them would fill the table with rows that say nothing."
+  },
+  {
+    rule: "A template's body never names a set or a resource. It names a hole.",
+    because:
+      "That is what makes a template a function rather than a value. Portability already strips both, and this work does not change it."
+  },
+  {
+    rule: "A hole's default may name a set, because a template belongs to a project.",
+    because:
+      "The default is project-local metadata rather than body. When a template is later taken out of its project, the default is one more thing the strip removes."
+  }
+];
+
+export const REFUSALS: Refusal[] = [
+  {
+    when: "A set is added to itself, or to a set that already reaches it",
+    answer: "The builder refuses the addition and says which set closes the loop",
+    where: "The shared draft, before the write; updateResourceSet already refuses it as corrupt"
+  },
+  {
+    when: "A named set is deleted while a set or a template hole names it",
+    answer: "in-use, naming what holds it",
+    where: "removeResourceSet, which already walks templates.holes"
+  },
+  {
+    when: "A rule names a set from another project",
+    answer: "unsupported-body, naming the set",
+    where: "instantiateTemplate, which already checks this; updateTemplate gains the same check"
+  },
+  {
+    when: "A rule is sent with both a name and an owner, or with neither",
+    answer: "named-bound-set",
+    where: "The resource-sets validator"
+  },
+  {
+    when: "An answer names a resource the project does not hold",
+    answer: "unknown-resource, naming it",
+    where: "validateInstantiateTemplate"
+  },
+  {
+    when: "A prompt names a hole the template does not declare",
+    answer: "unsupported-body, with the names",
+    where: "Unchanged"
+  },
+  {
+    when: "A hole is answered with a raw difference that reached resolution",
+    answer: "unsupported-body, as today",
+    where: "resolveTemplateScopes, which should now be unreachable from either door"
+  }
+];
+
+export const WORK: ScopeWork[] = [
+  {
+    path: "representation/store/tables.ts",
+    status: "changed",
+    area: "vocabulary",
+    work: "name is optional and boundTo is added; NamedResourceSetFields became ResourceSetFields, because a row is no longer necessarily named."
+  },
+  {
+    path: "representation/data/types/core/resource-set.ts",
+    status: "changed",
+    area: "vocabulary",
+    work: "One added union, BoundTo: a template's hole, or a placed resource's. Neither term union moved."
+  },
+  {
+    path: "representation/data/behavior/core/scope-draft.ts",
+    status: "new",
+    area: "vocabulary",
+    work: "The whole of it: the two lists, the kinds vocabulary, whether a rule needs a row, which addition would close a cycle, what a rule selects now, the sentence, and the rows and offers the builder is handed."
+  },
+  {
+    path: "representation/data/behavior/core/test/unit/scope-draft.test.ts",
+    status: "new",
+    area: "vocabulary",
+    work: "Sixteen cases: the floor, the replacements, the two doors out, the cycle, the count, and the view."
+  },
+  {
+    path: "capabilities/resource-sets/api/shared/validation.ts",
+    status: "changed",
+    area: "sets",
+    work: "boundToOf admits an owner and refuses anything else. The existing size limits stand."
+  },
+  {
+    path: "capabilities/resource-sets/api/shared/projection.ts",
+    status: "changed",
+    area: "sets",
+    work: "A stored row carries a name or an owner and never both or neither; the listing keeps to named rows, which is what every offer list wants."
+  },
+  {
+    path: "capabilities/templates/api/shared/scopes.ts",
+    status: "new",
+    area: "templates",
+    work: "The one place a rule becomes a term: inline when it can be, a written row when it cannot, the owner's row rewritten rather than repeated, and a stored default read back as the rule it holds."
+  },
+  {
+    path: "capabilities/templates/api/shared/validation.ts",
+    status: "changed",
+    area: "templates",
+    work: "A chosen default is validated wider than a stored one, because it may exclude things and name resources until the server normalises it."
+  },
+  {
+    path: "capabilities/templates/api/shared/projection.ts",
+    status: "changed",
+    area: "templates",
+    work: "A hole's default naming a bound row is expanded into that row's rule, so the builder opens on what somebody built. A named set is left alone."
+  },
+  {
+    path: "capabilities/templates/api/shared/stages.ts",
+    status: "changed",
+    area: "templates",
+    work: "Discarding a working copy takes the rows that copy owns."
+  },
+  {
+    path: "capabilities/templates/api/update-template/",
+    status: "changed",
+    area: "templates",
+    work: "Each default is normalised against its own hole, a set from another project is refused, and a hole that disappears takes its row with it."
+  },
+  {
+    path: "capabilities/templates/api/instantiate-template/",
+    status: "changed",
+    area: "templates",
+    work: "The resource is minted first so an answer that needs a row has an owner; the answers are normalised, the scopes resolved, and a refusal rolls back exactly what was written."
+  },
+  {
+    path: "capabilities/templates/api/remove-template/",
+    status: "changed",
+    area: "templates",
+    work: "Deleting a template deletes the rows its holes own."
+  },
+  {
+    path: "capabilities/templates/test/unit/answers.test.ts",
+    status: "changed",
+    area: "templates",
+    work: "Six cases: the row written, the row cleared, the row rewritten, a default naming resources, an answer that excludes, and a foreign set refused."
+  },
+  {
+    path: "components/authored/scope-builder/",
+    status: "new",
+    area: "cross-cutting",
+    work: "The builder, and its barrel. It is handed rows, offers, a sentence and a count, and answers with the keys it was given; nothing under components/ may reach the vocabulary itself."
+  },
+  {
+    path: "app-views/categories/document-editor/procedures/templating.ts",
+    status: "changed",
+    area: "editors",
+    work: "The local kind list, ruleOf, ruleFrom and the answer options went; what stays re-exports the shared draft and turns chosen rules into answers."
+  },
+  {
+    path: "app-views/categories/document-editor/context/templates.svelte",
+    status: "changed",
+    area: "editors",
+    work: "The toggle modal is the builder; the ask modal lists each hole's rule with Change and Use the default beside it, and the builder opens as a modal of its own."
+  },
+  {
+    path: "app-views/categories/slide-deck-editor/procedures/templating.ts",
+    status: "changed",
+    area: "editors",
+    work: "The same removal, so the twin is no longer a second copy of the vocabulary."
+  },
+  {
+    path: "app-views/categories/slide-deck-editor/context/templates.svelte",
+    status: "changed",
+    area: "editors",
+    work: "The same two replacements."
+  },
+  {
+    path: "app-views/categories/templates/procedures/library.svelte.ts",
+    status: "changed",
+    area: "library",
+    work: "The third byte-identical copy went the same way."
+  },
+  {
+    path: "app-views/categories/templates/inspector/template.svelte",
+    status: "changed",
+    area: "library",
+    work: "Default scope and Use open the builder, and the rule under the button is the shared sentence."
+  },
+  {
+    path: "app-views/categories/project-overview/procedures/contexts.ts",
+    status: "changed",
+    area: "contexts",
+    work: "The fourth copy, which had drifted, is gone; the panel now reads the same words as everything else."
+  },
+  {
+    path: "app-views/categories/project-overview/context/contexts.svelte",
+    status: "changed",
+    area: "contexts",
+    work: "The kind toggles are replaced by the builder, so a named set can finally exclude something and name a particular resource."
+  },
+  {
+    path: "app-views/categories/*/procedures/test/unit/",
+    status: "changed",
+    area: "evidence",
+    work: "Three suites lost the tests for their own copies and now check what they still own."
+  },
+  {
+    path: "seed/resourceSets.json · seed/templates.json",
+    status: "changed",
+    area: "evidence",
+    work: "A bound row owned by a seeded template's hole, holding an exclusion, so every panel has one to draw before anyone builds one."
+  },
+  {
+    path: "test/browser/template-features.spec.ts",
+    status: "changed",
+    area: "evidence",
+    work: "Answering through the builder on insert, building a named set through it in Contexts, and a default built with an exclusion, stored, and read back."
+  }
+];
+
+export const FORKS: ScopeFork[] = [
+  {
+    index: "1",
+    question: "Does a row have to be named?",
+    recommended: "No, and that is how it is built. name is optional; a row without one carries an owner instead.",
+    because:
+      "Anonymity was the point of the change. A synthesised name would appear in every offer list and in the Contexts panel, and somebody would eventually rename it.",
+    alternative: "Keep name required, generate one, and filter bound rows out of every list by their owner.",
+    cost: "The projection now refuses a row that carries both or neither, which is the rule stated once."
+  },
+  {
+    index: "2",
+    question: "Does every chosen scope write a row?",
+    recommended:
+      "No, and the line landed narrower than planned: a row is written only when the rule excludes something or names particular resources.",
+    because:
+      "Those are exactly the two things a template's vocabulary cannot say. Kinds and named sets are already sayable inline, so writing rows for them would fill the table with rows that add an indirection and nothing else.",
+    alternative: "Always write a row, so there is one code path and one place to look.",
+    cost: "One predicate, needsRow, named once and tested on its own."
+  },
+  {
+    index: "3",
+    question: "How does a bound row know what owns it?",
+    recommended:
+      "An explicit boundTo, and it names the hole on both sides: a template's hole, or a placed resource's.",
+    because:
+      "One resource may answer several holes, so the owner has to be the pair rather than the resource. Ownership is a fact worth storing; a sweep has to be written, scheduled and trusted.",
+    alternative: "No owner, and a collector that removes rows nothing reaches.",
+    cost: "One column, and three procedures that already delete things delete these too."
+  },
+  {
+    index: "4",
+    question: "Who turns a rule into a row: the client or the server?",
+    recommended: "The server, inside the call that was going to be made anyway.",
+    because:
+      "There are four doors. A client-side write would repeat the same normalisation four times and put a second round trip in front of every save, which can half-fail.",
+    alternative: "The client writes the row, then sends its id.",
+    cost:
+      "Instantiation mints its resource before resolving, because an answer's row is owned by the resource being made, and a refusal rolls back what it wrote."
+  },
+  {
+    index: "5",
+    question: "Does the Contexts panel keep its own editor?",
+    recommended: "No. It opens the same builder, and it gained exclusions and particular resources by doing so.",
+    because:
+      "Two editors for one rule is how the two drift, and they already had: four copies of the same prose, one of which said Selects nothing where the others said Nothing.",
+    alternative: "Leave Contexts alone and build only for templates.",
+    cost: "One panel changed, and a fourth copy of the vocabulary deleted."
+  },
+  {
+    index: "6",
+    question: "Can the builder save what you built as a named set?",
+    recommended: "Not yet, as recommended.",
+    because:
+      "It is an update to a row that already exists, so it stays cheap to add, and offering it invites naming at the moment somebody is trying not to name anything.",
+    alternative: "Offer it, so a rule somebody rebuilds twice can be kept.",
+    cost: "Nothing was lost by waiting."
+  },
+  {
+    index: "7",
+    question: "Where does the builder live?",
+    recommended:
+      "components/authored/scope-builder, with every piece of arithmetic in representation behavior — and the split is stricter than planned.",
+    because:
+      "Nothing under components/ may reach representation at all, not even for a type. So the builder is handed rows, offers, a sentence and a count, and answers with the keys it was given. It is the better shape: the component cannot express a rule the vocabulary would refuse.",
+    alternative: "A component under the templates category that the others import.",
+    cost: "One function, builderView, that the four callers pass straight through."
+  },
+  {
+    index: "8",
+    question: "Where does the live count come from?",
+    recommended: "The project resource index, resolved in the client on every change.",
+    because: "It is already loaded, the arithmetic is pure, and a count that lags the toggle is worse than no count.",
+    alternative: "A server procedure that counts.",
+    cost: "Each of the four surfaces reads the index it was already entitled to."
+  }
+];
+
+export const GAPS: ScopeGap[] = [
+  {
+    title: "Derived outputs have to be made, not carried",
+    detail:
+      "A template body drops derived-output ids, so a placed copy has prompts with nowhere to put an answer. Instantiation has to create the outputs the body implies, the way it already mints fresh ids for everything else.",
+    order: "Lands with derived outputs, before any of this is useful end to end"
+  },
+  {
+    title: "A prompt block is what declares a hole",
+    detail:
+      "Today a hole appears only because a body already carries a hole scope, which happens when a template with one is inserted into a working copy. The agreed shape is pull-based: making a template walks the prompts it found and asks what each one's scope should be, and two prompts may share a hole.",
+    order: "Lands with prompt blocks. The builder is the modal that step opens"
+  },
+  {
+    title: "A prompt block that loads a template",
+    detail:
+      "The last integration: a prompt naming a template pulls it in and fills its holes with nobody opening a modal.",
+    order: "After both, and it needs nothing this plan does not already build"
+  },
+  {
+    title: "The scope vocabulary has four copies",
+    detail:
+      "ruleOf, ruleFrom, termWords, the kind list and the answer options are byte-identical in the document editor, the deck editor and the library, and a fourth, drifted copy sits in Contexts. The builder would be a fifth.",
+    order: "Done. All four now read one module, and the drifted copy is gone"
+  },
+  {
+    title: "A resource picker needs the index inside an editor",
+    detail:
+      "Naming a particular resource means listing the project's resources from a panel, which today only Project Overview does.",
+    order: "Done. All four surfaces read the index, and the count comes from it"
+  },
+  {
+    title: "Taking a template out of its project",
+    detail:
+      "A default naming a set is project-local. Moving a template elsewhere has to strip defaults the way the body strip already removes set terms.",
+    order: "Deferred on purpose, with the rest of the cross-project question"
+  },
+  {
+    title: "A spreadsheet template cannot be opened",
+    detail: "openTemplateStage refuses one, because the spreadsheet editor is not on this branch.",
+    order: "Unchanged by this work"
+  }
+];
~~~~

### new · `src/lib/development-views/template-reference/procedures/system.ts` (+223 / −0)

~~~~diff
@@ -0,0 +1,223 @@
+import type { LifecycleStep, Noun, Refusal, Rule, Verb } from "$development-views/template-reference/types";
+
+export const NOUNS: Noun[] = [
+  {
+    term: "Template",
+    says: "A saved original that belongs to one project: a name, tags, a body, and a list of holes. Every write makes a new revision and keeps the last one as a version.",
+    onDisk: "templates (projectId, userId, name, tags, body, holes, revision, lastUsedAt) · templateVersions",
+    not: "a resource — it cannot be opened in an editor; its working copy can"
+  },
+  {
+    term: "Body",
+    says: "The template's content, in the same shape a document, deck or spreadsheet has. A template of one slide is a deck body holding that slide, its layout, and the theme and styles it is drawn with.",
+    onDisk: "TemplateBody: document | slides | spreadsheet",
+    not: "a fourth kind — a one-slide template is a deck template afterwards"
+  },
+  {
+    term: "Portable",
+    aka: "project-neutral",
+    says: "What a body must be to live in a template: nothing in it points at one particular thing in the project. A template turns a value into a function, so the pointers go and the shapes stay.",
+    onDisk: "portableBodyOf() strips, bodyOf() refuses what survived wrongly",
+    not: "lossless — the save says what it dropped, in words"
+  },
+  {
+    term: "Hole",
+    says: "A hole in the body that a prompt's scope names. It carries the name the scope uses, a label, a description, and a default scope. It exists because the body names it.",
+    onDisk: "TemplateHole { name, label, description?, default? }",
+    not: "something you type in by hand — nothing in the panels adds or removes one"
+  },
+  {
+    term: "Default scope",
+    says: "What a hole selects when nobody says otherwise: everything in the project, particular kinds, or one of the project's named sets. A hole with none means everything in the project.",
+    onDisk: "TemplatedResourceSet on the hole",
+    not: "an answer — it is what the template suggests, not what one use decided"
+  },
+  {
+    term: "Answer",
+    says: "What one person picks for one hole at the moment they insert or use the template. It wins over the default for that copy only.",
+    onDisk: "nothing — answers are passed to instantiate and never stored",
+    not: "a binding — no row remembers it"
+  },
+  {
+    term: "Working copy",
+    aka: "stage",
+    says: "The document or deck through which a template is edited: a real resource holding the template's body, plus a row saying which template it stands for and which revision it came from. One per template, shared by everyone in the project.",
+    onDisk: "templateStages + an ordinary documents / slideDecks row titled Template · name",
+    not: "a use of the template, and not something the project's lists show"
+  },
+  {
+    term: "Resource set",
+    says: "A named selection of the project's things: everything, some kinds, named resources, or another set, minus exclusions. Made in Project Overview's Contexts panel.",
+    onDisk: "resourceSets (projectId, name, description?, set, revision)",
+    not: "a template concept — a prompt's scope, a default and an answer can all name one"
+  },
+  {
+    term: "Revision",
+    says: "A counter on the template that every write advances. A save sends the revision it read and is refused as stale if the template moved first.",
+    onDisk: "templates.revision, mirrored on the stage as templateRevision",
+    not: "a version history you can restore from yet — templateVersions keeps the rows, nothing reads them back"
+  }
+];
+
+export const VERBS: Verb[] = [
+  {
+    name: "Save as a template",
+    gesture: "Name the open document, deck or current slide in the Templates panel, press Save",
+    does: "Copies the body, makes it portable, stores it as a template of this project at revision 1, and opens its working copy in a new tab",
+    leaves: "The thing you saved from, untouched — it never learns a template was made from it",
+    procedure: "createTemplateFromResource"
+  },
+  {
+    name: "Edit",
+    gesture: "Double-click in the library, Edit in the inspector, Edit on a panel row",
+    does: "Opens the template's working copy in its editor, making the copy if the project has none yet",
+    leaves: "One working copy per template, shared — a second person editing lands in the same one",
+    procedure: "openTemplateStage"
+  },
+  {
+    name: "Save",
+    gesture: "The Templates panel's header, beside Discard, while a working copy is open",
+    does: "Flushes the editor, reads the copy's body, makes it portable, and writes it as the template's next revision",
+    leaves: "The working copy open, so saving twice is ordinary",
+    procedure: "commitTemplateStage"
+  },
+  {
+    name: "Discard",
+    gesture: "The Templates panel, after a confirm",
+    does: "Deletes the working copy and everything on it, then closes the tab",
+    leaves: "The template at its last saved revision",
+    procedure: "discardTemplateStage"
+  },
+  {
+    name: "Insert",
+    gesture: "Insert on a row of the Templates panel",
+    does: "Asks what each hole should select, then copies the template's saved body into the open resource after the current row or slide, with fresh ids",
+    leaves: "An ordinary edit — undo removes it, and later changes to the template never reach it",
+    procedure: "insertionOf + runtime.apply"
+  },
+  {
+    name: "Use",
+    gesture: "Use in the library's inspector",
+    does: "Asks the same way Insert does, then makes a whole new document, deck or spreadsheet from the template and opens it",
+    leaves: "A resource with no reference back to the template; the template records that it was used",
+    procedure: "instantiateTemplate"
+  },
+  {
+    name: "Delete",
+    gesture: "Delete in the library's inspector, after a confirm",
+    does: "Removes the template, its versions and its working copy, at the revision the inspector read",
+    leaves: "Everything ever made from it, untouched",
+    procedure: "removeTemplate"
+  }
+];
+
+export const LIFECYCLE: LifecycleStep[] = [
+  {
+    index: "01",
+    title: "Make",
+    person: "Names the open document, deck or current slide and presses Save",
+    client: "Sends the resource id and the name, then opens a new tab straight onto the copy's Templates panel",
+    server: "Reads the leader snapshot, makes the body portable, stamps the project, declares the holes the body names, says what it dropped",
+    rows: "templates at 1 · templateVersions 1 · templateStages staged at 1 · a scratch row titled Template · name"
+  },
+  {
+    index: "02",
+    title: "Open",
+    person: "Presses Edit on a template",
+    client: "The ordinary editor opens on the scratch resource; the panel shows Save and Discard in its header, then the holes",
+    server: "Returns the template's working copy, or writes the body at revision N into a new scratch row and records the stage",
+    rows: "Nothing new on a resume; otherwise a stage row and a scratch row at N"
+  },
+  {
+    index: "03",
+    title: "Edit",
+    person: "Types, moves blocks, changes layouts — alone or beside someone else",
+    client: "Runtime ops against the scratch resource, flushed and rebased exactly as for any document",
+    server: "Nothing template-shaped: the document and deck capabilities, as usual",
+    rows: "The scratch resource's snapshots and change sets move. The template does not."
+  },
+  {
+    index: "04",
+    title: "Describe",
+    person: "Opens a hole, writes what it stands for, sets its default scope",
+    client: "Writes the whole hole list at the revision the panel read; the body is untouched",
+    server: "updateTemplate makes revision N+1 and carries the working copy to N+1, so this never makes the next save stale",
+    rows: "templates at N+1 · templateVersions N+1 · templateStages staged at N+1"
+  },
+  {
+    index: "05",
+    title: "Save",
+    person: "Presses Save in the Templates panel",
+    client: "await runtime.flush(), then refuses while anything is pending or failed — the server reads the leader snapshot",
+    server: "Makes the copy's body portable, validates it, writes revision N+1, moves the stage to N+1, says what was dropped",
+    rows: "templates at N+1 · templateVersions N+1 · stage staged at N+1 · the scratch row stays"
+  },
+  {
+    index: "06",
+    title: "Insert or Use",
+    person: "Answers each hole in one modal, or leaves every default",
+    client: "Insert builds ops from the template's saved body with fresh ids and the scopes filled in; Use sends the answers to the server",
+    server: "instantiateTemplate resolves the scopes, writes the new resource, and records the template's last use",
+    rows: "Ops on the open resource, or a new resource with no reference back"
+  },
+  {
+    index: "07",
+    title: "Discard",
+    person: "Presses Discard and confirms",
+    client: "Flushes, asks, and closes the tab only after the server answers",
+    server: "Removes the stage row and the scratch row with its snapshots and change sets",
+    rows: "The template keeps its last saved revision; no stage"
+  }
+];
+
+export const RULES: Rule[] = [
+  {
+    rule: "A template belongs to one project",
+    because: "Its library, its working copy and everyone who may edit it are that project's. Nothing crosses projects."
+  },
+  {
+    rule: "Only the working copy writes a template's body",
+    because: "There is no second path, so a template and its copy cannot drift apart and nothing needs to be pulled back."
+  },
+  {
+    rule: "Insert and Use are copies",
+    because: "What lands is its own from the first moment. No resource carries a reference to a template, so a later change reaches nothing."
+  },
+  {
+    rule: "A template is portable, inside its project too",
+    because: "It turns a value into a function: what pointed at one particular thing is stripped and the holes fill the scopes."
+  },
+  {
+    rule: "A scope hole is found, a text hole is placed",
+    because: "A scope hole exists because a prompt's scope names it, so nothing in the panels adds or removes one. A text hole is a place in the prose, and only the writer knows where it goes: Create hole names it and drops its atom at the caret in one act."
+  },
+  {
+    rule: "A working copy takes no comments",
+    because: "Comments do not travel with a template, so the capability refuses a thread on one and the panels say so."
+  },
+  {
+    rule: "Every write is compare-and-swap",
+    because: "A save sends the revision it read; a stale one is refused and the panel re-reads rather than overwriting."
+  }
+];
+
+export const REFUSALS: Refusal[] = [
+  { when: "A template in another project", answer: "not-found", where: "read, update, remove, instantiate, open" },
+  { when: "A save whose base revision is behind", answer: "stale", where: "commitTemplateStage, updateTemplate, removeTemplate" },
+  { when: "A spreadsheet template asked to open for editing", answer: "unsupported-body", where: "openTemplateStage" },
+  { when: "A body naming a hole the template does not declare", answer: "unsupported-body, with the names", where: "instantiateTemplate" },
+  { when: "An answer naming a set this project does not hold", answer: "unsupported-body, with the ids", where: "instantiateTemplate" },
+  { when: "A hole list that drops a name the body still uses", answer: "hole-in-use, with the names", where: "updateTemplate" },
+  { when: "A resource set another set or a template default still names", answer: "in-use, naming which", where: "removeResourceSet" },
+  { when: "A comment thread on a working copy", answer: "refused before anything is written", where: "startThread" },
+  { when: "A save while the editor still holds unflushed work", answer: "refused in the panel, before the request", where: "the Templates panel" }
+];
+
+export const STRIPPED: { item: string; keeps: string }[] = [
+  { item: "A formula's id", keeps: "the expression — the atom is drawn unbound until a formula is made for it again" },
+  { item: "A prompt's generated output id", keeps: "the prompt, its text and its scope" },
+  { item: "Links to people, personas and resources", keeps: "the marked text, and a link to a URL with its note" },
+  { item: "Images stored in the project", keeps: "the image block, and an image at a URL" },
+  { item: "Scope terms naming a set or particular resources", keeps: "the whole-project and kind terms, and the holes" },
+  { item: "Ranges into another spreadsheet, and values that reference a resource", keeps: "the cell, emptied" }
+];
~~~~

### new · `src/lib/development-views/template-reference/template-reference.svelte` (+5 / −0)

~~~~diff
@@ -0,0 +1,5 @@
+<script lang="ts">
+  import SystemPage from "$development-views/template-reference/components/system-page.svelte";
+</script>
+
+<SystemPage />
~~~~

### new · `src/lib/development-views/template-reference/types.ts` (+129 / −0)

~~~~diff
@@ -0,0 +1,129 @@
+export type Area =
+  | "vocabulary"
+  | "templates"
+  | "sets"
+  | "neighbours"
+  | "editors"
+  | "library"
+  | "contexts"
+  | "evidence"
+  | "reference"
+  | "documentation"
+  | "cross-cutting";
+
+export type FileKind = "production" | "test" | "fixture" | "documentation" | "reference" | "configuration";
+
+export type FileRecord = {
+  path: string;
+  status: "A" | "M" | "D";
+  area: Area;
+  kind: FileKind;
+  current: number;
+  base: number;
+  added: number;
+  deleted: number;
+};
+
+export type Noun = {
+  term: string;
+  aka?: string;
+  says: string;
+  onDisk: string;
+  not?: string;
+};
+
+export type Verb = {
+  name: string;
+  gesture: string;
+  does: string;
+  leaves: string;
+  procedure: string;
+};
+
+export type Rule = {
+  rule: string;
+  because: string;
+};
+
+export type Refusal = {
+  when: string;
+  answer: string;
+  where: string;
+};
+
+export type LifecycleStep = {
+  index: string;
+  title: string;
+  person: string;
+  client: string;
+  server: string;
+  rows: string;
+};
+
+export type SystematicChange = {
+  index: string;
+  title: string;
+  before: string;
+  now: string;
+  why: string;
+  area: Area;
+};
+
+export type Decision = {
+  round: string;
+  question: string;
+  answer: string;
+  became: string;
+};
+
+export type Verification = {
+  check: string;
+  command: string;
+  result: string;
+  clean: boolean;
+};
+
+export type OpenItem = {
+  title: string;
+  detail: string;
+  recommendation: string;
+};
+
+export type ScopeTerm = {
+  select: string;
+  reads: string;
+  picks: string;
+  inABody: string;
+  inADefault: string;
+  inALiveResource: string;
+};
+
+export type ScopeDoor = {
+  where: string;
+  opens: string;
+  title: string;
+  confirms: string;
+  writes: string;
+};
+
+export type ScopeWork = {
+  path: string;
+  status: "new" | "changed";
+  area: Area;
+  work: string;
+};
+
+export type ScopeFork = {
+  index: string;
+  question: string;
+  recommended: string;
+  because: string;
+  alternative: string;
+  cost: string;
+};
+
+export type ScopeGap = {
+  title: string;
+  detail: string;
+  order: string;
+};
~~~~

### changed · `src/routes/app/[project]/reference/templates/+page.svelte` (+11 / −2)

~~~~diff
@@ -1,5 +1,14 @@
 <script lang="ts">
-  import TemplateLibraryDemo from "$development-views/template-library-demo/template-library-demo.svelte";
+  import SystemPage from "$development-views/template-reference/components/system-page.svelte";
+  import {
+    APPEARANCES,
+    appearance,
+    type Appearance
+  } from "$surfaces/top-bar/effects/apply-appearance.svelte";
 </script>
 
-<TemplateLibraryDemo />
+<SystemPage
+  material={appearance.current}
+  materials={APPEARANCES}
+  onmaterial={(next) => (appearance.current = next as Appearance)}
+/>
~~~~

### new · `src/routes/app/[project]/reference/templates/changes/+page.svelte` (+14 / −0)

~~~~diff
@@ -0,0 +1,14 @@
+<script lang="ts">
+  import ChangesPage from "$development-views/template-reference/components/changes-page.svelte";
+  import {
+    APPEARANCES,
+    appearance,
+    type Appearance
+  } from "$surfaces/top-bar/effects/apply-appearance.svelte";
+</script>
+
+<ChangesPage
+  material={appearance.current}
+  materials={APPEARANCES}
+  onmaterial={(next) => (appearance.current = next as Appearance)}
+/>
~~~~

### new · `src/routes/app/[project]/reference/templates/scope/+page.svelte` (+14 / −0)

~~~~diff
@@ -0,0 +1,14 @@
+<script lang="ts">
+  import ScopePage from "$development-views/template-reference/components/scope-page.svelte";
+  import {
+    APPEARANCES,
+    appearance,
+    type Appearance
+  } from "$surfaces/top-bar/effects/apply-appearance.svelte";
+</script>
+
+<ScopePage
+  material={appearance.current}
+  materials={APPEARANCES}
+  onmaterial={(next) => (appearance.current = next as Appearance)}
+/>
~~~~

