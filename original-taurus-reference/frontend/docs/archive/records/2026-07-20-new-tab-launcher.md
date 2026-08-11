# Change record — 2026-07-20 — New-tab launcher stage

The "+" now opens a **new-tab launcher** instead of a blank editor: ways to start a
resource (create carousel, Create-with-AI, templates) plus the full resource table.
Picking anything resolves the blank tab into that resource in place.

## Tab model: new vs resource + resolve-in-place

```ts
export type Tab = { id: string; title: string; closeable: boolean; kind?: 'new' | 'resource' };
export function resolveTab(id: string, title: string): void { /* new → resource, in place */ }
```

**Why:** there was no way to tell a blank "+" tab from a resource tab — both rendered the
generic placeholder. **How:** `Tab` gains a `kind` discriminator; `openTab()` with no
title now makes a `new` tab (the launcher) instead of a "Document N", and `resolveTab`
turns that blank tab into a resource tab in place when the launcher picks something
(browser-style). `WorkSurface` routes `tab.kind === 'new'` to the new stage.

## NewTabStage + shared extractions

```svelte
<!-- NewTabStage: CreateResourceRow + "Create with AI" + Templates carousel + ResourceTable -->
```

**Why:** the launcher reuses Overview's pieces but adds start-from-template and
start-from-AI. **How:** new [`NewTabStage`](../../../src/lib/features/stages/NewTabStage.svelte)
composes the shared create carousel, an intel-toned **Create with AI** button, a mock
**Templates** carousel, and the resource table — every action resolves the tab in place.
To avoid divergence, two things were extracted and now shared with Overview:
- [`kinds.ts`](../../../src/lib/features/stages/kinds.ts) — the `kindMeta` map (icon/tone/label per kind).
- [`CreateResourceRow.svelte`](../../../src/lib/features/stages/CreateResourceRow.svelte) — the create carousel (emits `oncreate(kind)`).

Overview was refactored to use both (its inline carousel + local `kindMeta` removed).

## Create with AI (mock) + backend request

```svelte
<AiCreateDialog bind:open={aiOpen} oncreate={fromAi} />
```

**Why:** the user wants an AI path to spin up a resource from a description. **How:**
[`AiCreateDialog`](../../../src/lib/features/stages/AiCreateDialog.svelte) is a modal
(describe + pick type + Generate), **badged Mock** — it seeds a titled placeholder since
no model is wired. Filed [backend-requests/ai-generation.md](../backend-requests/ai-generation.md)
(generate a resource from a prompt + kind) and indexed it. Templates are client-side
mock presets for now.

## Notes

- No "recents" — per the design call, the launcher relies on the resource table's
  recency sort rather than tracking opens.
- The AI section is framed as *create a new resource* to stay distinct from the
  floating Quarterback bar (which coordinates the *current* resource).
