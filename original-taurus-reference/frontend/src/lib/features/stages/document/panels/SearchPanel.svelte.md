# src/lib/features/stages/document/panels/SearchPanel.svelte — breakdown

Companion to [SearchPanel.svelte](SearchPanel.svelte). Provides live whole-document
search, navigation, and replacement through the editor-session boundary.

## Script — search state and derived results

### Query/replace state, regex validation, and live match results

```svelte
<script lang="ts">
  import { ChevronDown } from '@lucide/svelte';
  import { Badge, Button, Input, toast } from '$lib/components';
  import { cn } from '$lib/utils';
  import type { SearchResult } from '../editor/session';
  import { editorSession } from '../editor/session';

  let query = $state('');
  let replacement = $state('');
  let replaceOpen = $state(false);
  let matchCase = $state(false);
  let wholeWord = $state(false);
  let useRegex = $state(false);

  const regexError = $derived.by(() => {
    if (!useRegex || !query) return '';
    try {
      new RegExp(query);
      return '';
    } catch {
      return 'Check the regular expression syntax.';
    }
  });

  const results = $derived.by(() =>
    regexError
      ? []
      : ($editorSession?.actions.searchText(query, { matchCase, wholeWord, useRegex }) ?? [])
  );

```

Imports the editor session and its `SearchResult` type plus UI primitives. State
holds the query, replacement text, the replace-disclosure flag, and the three match
toggles. `regexError` validates the pattern only in regex mode; `results` derives
live matches from the session’s `searchText` action (empty when the regex is
invalid).

## Script — focus, replace, and label helpers

### Navigate to, replace, and label matches through session actions

```svelte
  function focus(result: SearchResult) {
    $editorSession?.actions.focusSearchResult(result);
  }

  function replace(resultsToReplace: SearchResult[]) {
    const count = $editorSession?.actions.replaceSearchResults(resultsToReplace, replacement) ?? 0;
    if (count) toast(`Replaced ${count} ${count === 1 ? 'match' : 'matches'}.`, { tone: 'success' });
  }

  function replaceNext() {
    const next = results[0];
    if (!next) return;
    focus(next);
    replace([next]);
  }

  function kindLabel(kind: string) {
    return kind.replace('heading_', 'Heading ').replace('_', ' ');
  }
</script>

```

`focus` scrolls to a result, `replace` applies the replacement to a set of matches
and toasts the count, `replaceNext` focuses and replaces the first match, and
`kindLabel` turns a block kind into a readable label. All navigation and
replacement are real session actions, so the panel has no direct editor dependency.

## Markup — query input and replace disclosure

### The search field and the collapsible replace controls

```svelte
<div class="space-y-3">
  <section class="space-y-2.5">
    <Input bind:value={query} size="sm" placeholder="Search this document…" aria-label="Search document" />

    <div>
      <Button
        size="sm"
        variant="secondary"
        class="px-2.5"
        aria-expanded={replaceOpen}
        onclick={() => (replaceOpen = !replaceOpen)}
      >
        Replace
        <ChevronDown
          class={`size-3.5 transition-transform ${replaceOpen ? 'rotate-180' : ''}`}
        />
      </Button>
    </div>

    {#if replaceOpen}
      <div class="space-y-1.5">
        <Input
          bind:value={replacement}
          size="sm"
          placeholder="Replace with…"
          aria-label="Replacement text"
        />
        <div class="grid grid-cols-2 gap-1.5">
          <Button
            size="sm"
            variant="secondary"
            disabled={!query || results.length === 0}
            onclick={replaceNext}
          >
            Replace next
          </Button>
          <Button
            size="sm"
            variant="ghost"
            disabled={!query || results.length === 0}
            onclick={() => replace(results)}
          >
            Replace all
          </Button>
        </div>
      </div>
    {/if}

```

The query input sits above a Replace disclosure button; expanding it reveals the
replacement input and the Replace next / Replace all actions (disabled without a
query or matches).

## Markup — match options and regex error

### Case / whole-word / regex toggles and the invalid-pattern alert

```svelte
    <div class="flex gap-1.5 border-t border-border pt-2">
      <button
        type="button"
        aria-label="Match case"
        title="Match uppercase and lowercase exactly"
        aria-pressed={matchCase}
        onclick={() => (matchCase = !matchCase)}
        class={cn(
          'dur-micro flex-1 rounded-control border px-2 py-1 text-center text-caption transition-colors',
          matchCase
            ? 'border-action/40 bg-action/8 text-action'
            : 'border-border text-muted hover:bg-elevated hover:text-primary'
        )}
      >
        Match case
      </button>
      <button
        type="button"
        aria-label="Whole word"
        title="Match complete words only"
        aria-pressed={wholeWord}
        onclick={() => (wholeWord = !wholeWord)}
        class={cn(
          'dur-micro flex-1 rounded-control border px-2 py-1 text-center text-caption transition-colors',
          wholeWord
            ? 'border-action/40 bg-action/8 text-action'
            : 'border-border text-muted hover:bg-elevated hover:text-primary'
        )}
      >
        Whole word
      </button>
      <button
        type="button"
        title="Interpret the search as a regular expression"
        aria-pressed={useRegex}
        onclick={() => (useRegex = !useRegex)}
        class={cn(
          'dur-micro flex-1 rounded-control border px-2 py-1 text-center text-caption transition-colors',
          useRegex
            ? 'border-action/40 bg-action/8 text-action'
            : 'border-border text-muted hover:bg-elevated hover:text-primary'
        )}
      >
        Regex
      </button>
    </div>
    {#if regexError}
      <p class="text-caption text-danger" role="alert">{regexError}</p>
    {/if}
  </section>

```

A divider separates the compact match-option toggles — case, whole word, and regex
— each an `aria-pressed` button styled via `cn`, with an invalid-expression alert
announced below before the runtime is called.

## Markup — results list

### Match count, empty/populated states, and per-result replace

```svelte
  <section class="border-t border-border pt-3">
    <div class="mb-2 flex items-center justify-between">
      <h3 class="text-label font-medium text-primary">Results</h3>
      {#if query}
        <Badge
          tone="neutral"
          aria-label={`${results.length} ${results.length === 1 ? 'match' : 'matches'}`}
        >
          {results.length}
        </Badge>
      {/if}
    </div>

    {#if !query}
      <p class="text-body-sm text-muted">Search across every block in this document.</p>
    {:else if results.length === 0}
      <p class="text-body-sm text-muted">No matches found.</p>
    {:else}
      <ol class="space-y-1.5">
        {#each results as result (result.id)}
          <li class="rounded-control border border-border bg-work hover:border-border-strong">
            <button
              type="button"
              class="w-full px-2.5 py-2 text-left"
              onclick={() => focus(result)}
              aria-label={`Go to match in block ${result.block}`}
            >
              <span class="flex items-center justify-between gap-2">
                <span class="truncate text-caption font-medium capitalize text-secondary">
                  {kindLabel(result.kind)} · {result.block}
                </span>
                <span class="rounded-control bg-attention/12 px-1.5 py-0.5 text-caption text-attention">
                  {result.match}
                </span>
              </span>
              <span class="mt-1 block text-caption leading-relaxed text-muted">{result.preview}</span>
            </button>
            {#if replaceOpen}
              <div class="border-t border-border px-2 py-1">
                <Button
                  size="sm"
                  variant="ghost"
                  class="h-6 px-1.5 text-caption"
                  onclick={() => replace([result])}
                >
                  Replace this
                </Button>
              </div>
            {/if}
          </li>
        {/each}
      </ol>
    {/if}
  </section>
</div>
```

The results section shows a count badge and loading/empty/populated states; each
match row navigates on click and, when the Replace disclosure is open, exposes a
per-result Replace this action.
