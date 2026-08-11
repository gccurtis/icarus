# src/lib/features/stages/document/panels/InfoPanel.svelte — breakdown

Companion to [InfoPanel.svelte](InfoPanel.svelte). Presents the useful document
identity, timestamps, and compact live metrics in the document context rail.

## Script — imports and state

### Lifecycle helpers, UI components, and the inline title-edit state

```svelte
<script lang="ts">
  import { onDestroy, onMount, tick } from 'svelte';
  import { Badge, IdentityHoverCard, toast } from '$lib/components';
  import { isApiError } from '$data/api';
  import { documentEditRelative, documentEditStamp } from '$data/time';
  import { resolveFromUserId, getIdentityProfile } from '$data/identity-directory';
  import type { IdentityProfile } from '$data/identity-directory';
  import { editorSession } from '../editor/session';

  let now = $state(Date.now());
  let clock: ReturnType<typeof setInterval> | null = null;
  let editingTitle = $state(false);
  let titleDraft = $state('');
  let renaming = $state(false);
  let titleInput = $state<HTMLInputElement>();

```

Imports Svelte lifecycle helpers, UI components, the API error guard, the shared
time formatters, and the identity-directory resolvers. Local state covers the live
`now` clock and its interval handle plus the inline title-edit fields
(`editingTitle`, `titleDraft`, `renaming`, `titleInput`).

## Script — derived metadata and creator profile

### Derive name/timestamps and resolve the real creator identity

```svelte
  const currentName = $derived($editorSession?.name ?? '');
  const createdIso = $derived($editorSession?.createdAt ?? '');
  const createdAt = $derived(Date.parse(createdIso));
  const createdRelative = $derived(documentEditRelative(createdAt, now));
  const createdStamp = $derived(documentEditStamp(createdAt));

  // Resolve the real creator's profile from the document's creatorId/creatorName.
  let creatorProfile = $state<IdentityProfile | null>(null);
  $effect(() => {
    const id = $editorSession?.creatorId;
    const name = $editorSession?.creatorName ?? '';
    if (id) void resolveFromUserId(id, name).then((profile) => (creatorProfile = profile));
    else creatorProfile = null;
  });
  const creator = $derived(creatorProfile ?? getIdentityProfile($editorSession?.creatorName ?? ''));

```

Derived values read the document name and creation timestamp from the editor
session and format it as both a relative phrase (refreshed by `now`) and an exact
stamp. An effect resolves the real creator profile from the session’s
`creatorId`/`creatorName` via `resolveFromUserId`, with `getIdentityProfile` as the
synchronous fallback.

## Script — title editing actions

### Begin, cancel, commit, and key-handle the inline rename

```svelte
  async function beginTitleEdit() {
    if (renaming) return;
    titleDraft = currentName;
    editingTitle = true;
    await tick();
    titleInput?.focus();
    titleInput?.select();
  }

  function cancelTitleEdit() {
    editingTitle = false;
    titleDraft = currentName;
  }

  async function commitTitle() {
    if (!editingTitle || renaming || !$editorSession) return;
    const next = titleDraft.trim();
    if (!next || next === currentName) {
      cancelTitleEdit();
      return;
    }
    renaming = true;
    try {
      await $editorSession.actions.renameDocument(next);
      editingTitle = false;
    } catch (error) {
      cancelTitleEdit();
      toast(isApiError(error) ? error.message : 'Could not rename the document.', {
        tone: 'danger'
      });
    } finally {
      renaming = false;
    }
  }

  function onTitleKeydown(event: KeyboardEvent) {
    if (event.key === 'Enter') {
      event.preventDefault();
      void commitTitle();
    } else if (event.key === 'Escape') {
      event.preventDefault();
      cancelTitleEdit();
    }
  }

```

The title-edit actions mirror the top bar’s canonical rename path:
`beginTitleEdit` focuses and selects the input, `commitTitle` calls
`renameDocument` (guarding against empty/unchanged names and toasting on failure),
`cancelTitleEdit` restores the draft, and `onTitleKeydown` maps Enter to commit and
Escape to cancel.

## Script — clock lifecycle

### Tick the relative-time clock while mounted

```svelte
  onMount(() => {
    clock = setInterval(() => (now = Date.now()), 30000);
  });
  onDestroy(() => {
    if (clock) clearInterval(clock);
  });
</script>

```

`onMount` starts a 30-second interval that advances `now` so relative times stay
fresh; `onDestroy` clears it.

## Markup — metric snippet

### A reusable label/value metric row

```svelte
{#snippet metric(label: string, value: number)}
  <div class="flex items-center justify-between gap-4 py-1.5" aria-label={`${label}: ${value}`}>
    <dt class="text-caption text-muted">{label}</dt>
    <dd class="text-caption font-medium tabular-nums text-secondary">{value}</dd>
  </div>
{/snippet}

```

A reusable `metric` snippet renders one label/value row with an accessible label
and tabular figures.

## Markup — editable title

### Inline-editable document name (double-click / Enter / F2)

```svelte
{#if $editorSession}
  <div>
    <section class="pb-3">
      {#if editingTitle}
        <input
          bind:this={titleInput}
          bind:value={titleDraft}
          onkeydown={onTitleKeydown}
          onblur={() => void commitTitle()}
          disabled={renaming}
          aria-label="Rename document from Info"
          class="-ml-1 h-7 w-full border-0 border-b border-border bg-transparent px-1 text-body-sm font-medium text-primary outline-none"
        />
      {:else}
        <button
          type="button"
          ondblclick={() => void beginTitleEdit()}
          onkeydown={(event) => {
            if (event.key === 'Enter' || event.key === 'F2') {
              event.preventDefault();
              void beginTitleEdit();
            }
          }}
          aria-label={`Document name in Info: ${currentName}. Double-click to rename`}
          title="Double-click to rename"
          class="-ml-1 block max-w-full truncate rounded-control px-1 py-0.5 text-left text-body-sm font-medium text-primary hover:bg-elevated"
        >
          {currentName}
        </button>
      {/if}
    </section>

```

The title renders as a button that enters inline editing on double-click (or
Enter/F2), swapping to a bound input while editing.

## Markup — creation metadata and metrics

### Real creator attribution, exact stamp, and the words/chars metrics

```svelte
    <section
      class="border-t border-border py-2.5"
      aria-label={`Created ${createdRelative} by ${creator.name}`}
    >
      <p class="flex flex-wrap items-center gap-x-1 text-caption text-secondary">
        <span class="text-muted">Created</span>
        <time datetime={createdIso} title={createdStamp}>{createdRelative}</time>
        <span class="text-muted">by</span>
        <IdentityHoverCard
          profile={creator}
          showAvatar={false}
          showName
          portalled
          class="-mx-0.5 font-medium"
        />
      </p>
      <div class="mt-0.5">
        <time datetime={createdIso} class="text-caption text-muted">{createdStamp}</time>
      </div>
    </section>

    <dl aria-label="Document metrics" class="border-y border-border py-1">
      {@render metric('Words', $editorSession.words)}
      {@render metric('Characters', $editorSession.chars)}
    </dl>
  </div>
{/if}
```

Creation metadata is one compact relative sentence naming the real creator (via an
`IdentityHoverCard`, `portalled`) with the exact stamp beneath — the Mock badge is
gone now that Omega supplies attribution. Below, only truthful metrics remain:
words and characters from the live session model. The Pages metric left with
pagination (workstream B) — the document renders as one continuous flow, so a page
count no longer describes anything real.
