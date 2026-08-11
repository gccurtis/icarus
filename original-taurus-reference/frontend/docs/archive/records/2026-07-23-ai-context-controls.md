# AI Context controls and audit view

## Made working-context sources explicit and independently selectable

```ts
export type AiContextSourceId = 'document' | 'selection' | 'knowledge' | 'sources' | 'web';

export const aiContextSourceOptions: AiContextSource[] = [
  { id: 'document', label: 'Document', detail: 'The open document and its current content' },
  {
    id: 'selection',
    label: 'Current selection',
    detail: 'Only the text or block selected in the editor'
  },
  {
    id: 'knowledge',
    label: 'All knowledge',
    detail: 'Relevant resources across this project'
  },
  {
    id: 'sources',
    label: 'Linked sources',
    detail: 'References already connected to this document'
  },
  {
    id: 'web',
    label: 'Web',
    detail: 'Public web results when the request needs current information'
  }
];

export type AiAgentState = {
  // Existing chat, plan, and mode fields omitted here.
  contextSourceIds: AiContextSourceId[];
  excludedContextItemIds: string[];
};
```

The former optional-reference vocabulary obscured whether the current document was included and used an unclear “Project knowledge” label. The mock session model now names the five user-facing sources directly and separately tracks item-level exclusions, preserving a UI-friendly boundary for the future Omega contract.

## Rebuilt Context as one quiet accordion instead of nested bordered disclosures

```svelte
<details class="context-disclosure group overflow-hidden rounded-control border border-border bg-panel/50">
  <summary
    class="dur-micro flex min-h-10 cursor-pointer list-none items-center gap-2 px-2.5 py-2 text-label text-secondary transition-colors hover:bg-work hover:text-primary"
  >
    <BookOpen class="size-3.5 shrink-0 text-intel" />
    <span class="font-medium">Context</span>
    <span class="min-w-0 flex-1"></span>
    <ChevronDown
      class="dur-small size-3.5 shrink-0 text-muted transition-transform group-open:rotate-180"
    />
  </summary>

  <div class="space-y-2.5 border-t border-border px-2.5 py-2.5">
    <button
      type="button"
      onclick={() => (managingContext = true)}
      aria-label="Open current context"
      class="dur-micro flex min-h-9 w-full items-center justify-center rounded-control border border-border px-2 text-center text-label font-medium text-secondary transition-colors hover:border-action/40 hover:text-action active:border-action active:bg-action/5 active:text-action"
    >
      Current context
    </button>

    {@render contextSourceGrid()}
  </div>
</details>
```

One boundary now communicates one disclosure, eliminating the prior double-border/card stack. Current context sits first inside the expanded accordion as a centered outline button with no count, fill, or directional icon. File and folder attachment controls remain below the source choices without explanatory mock clutter because the enclosing AI surface already carries the Mock status.

## Kept source selection legible without turning it into visual decoration

```svelte
<label
  class="dur-micro flex min-h-9 w-full cursor-pointer items-center gap-1.5 rounded-control border border-transparent px-2 py-1.5 text-caption font-medium transition-colors hover:border-border {selected
    ? 'text-action'
    : 'text-secondary hover:text-primary'}"
>
  <input
    type="checkbox"
    checked={selected}
    onchange={() => toggleAiContextSource(source.id)}
    aria-label={source.label}
    class="peer sr-only"
  />
  <span
    class="dur-micro flex size-3.5 shrink-0 items-center justify-center rounded-[4px] border bg-transparent transition-colors peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-focus {selected
      ? 'border-action/70'
      : 'border-border'}"
  >
    {#if selected}
      <Check class="size-2 text-action" />
    {/if}
  </span>
  {@render contextSourceIcon(source.id)}
  <span class="min-w-0 leading-tight">{source.label}</span>
</label>
```

Selected sources use action blue only on the small transparent checkbox, icon, and label. They do not gain a white or colored surface, and their row border follows the same rule as every unselected source: transparent at rest and visible only on hover. Descriptions moved to keyboard-accessible tooltips so the compact labels remain calm at the inspector’s minimum width.

## Added a searchable in-panel audit of resolved context

```svelte
{#if managingContext}
  <div class="sticky top-0 z-10 -mx-3 flex items-center gap-2 border-b border-border bg-panel px-3 pb-3">
    <button onclick={closeContextManager} aria-label="Back to AI Agent">
      <ArrowLeft class="size-4" />
    </button>
    <div class="min-w-0 flex-1">
      <p class="truncate text-body-sm font-medium text-primary">Current context</p>
      <p class="text-caption text-muted">What Taurus can use in the next request</p>
    </div>
  </div>

  <Input
    bind:value={contextQuery}
    size="sm"
    type="search"
    placeholder="Search current context…"
    aria-label="Search current context"
  />

  <!-- Source controls and typed, removable included-item rows follow. -->
{/if}
```

Opening Current context temporarily replaces the inspector body rather than creating a modal or nested disclosure. It repeats the source controls, searches included item names and types, distinguishes Taurus resources from selections, linked files, and live web context, and supports item removal. The local `managingContext` state overlays the existing chat/plan view, so Back restores the exact prior AI Agent view instead of resetting navigation.

## Gave Recent chats a restrained hover affordance

```svelte
<button
  onclick={() => selectAiChat(chat.id)}
  aria-label={`Open chat: ${chat.title}`}
  class="dur-micro group flex w-full items-start gap-2 rounded-control border border-transparent px-2 py-2.5 text-left transition-colors hover:border-border hover:text-primary"
>
```

Chat rows previously changed almost imperceptibly on hover. A transparent resting border now becomes the standard subtle border without adding a white fill, matching the demure context-source interaction and preserving the panel’s low-contrast resting state.

## Reconciled the authoritative style and backend-facing records

```md
Working context is explicit and inspectable. Its source controls are Document,
Current selection, All knowledge, Linked sources, and Web; files and directories
may be attached separately.
```

The authoritative AI surface specification, frontend/backend discrepancy, and high-priority backend request now describe the implemented source vocabulary, item-level audit/removal behavior, hover-only borders, and web context. Keeping these documents synchronized makes the mock intentional and gives Omega an accurate target instead of leaving the interface and contract narrative to drift.
