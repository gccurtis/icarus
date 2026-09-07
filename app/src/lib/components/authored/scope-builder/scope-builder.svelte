<script lang="ts">
  import { Button } from "$vendored-components/button";
  import { Input } from "$vendored-components/input";
  import { traceNode } from "$development-components/trace.svelte";

  /**
   * One rule, built by hand: what it includes, what it takes back out, and how
   * many resources that is right now.
   *
   * **Every set is a difference**, so both lists are always here and the second
   * is usually empty. Nothing this component can produce is a rule the
   * vocabulary cannot hold, because it never builds one: it is handed rows and
   * offers already in words, and it answers with the keys it was given.
   *
   * **The whole project is a mode rather than a term you add.** It is the common
   * answer and the floor a variable falls back to, so it is one press.
   *
   * **The count is why the modal exists.** A rule with no number beside it is a
   * guess, so the caller resolves it on every change and it sits under the
   * sentence rather than behind a disclosure.
   *
   * What it owns is the disclosure: which side is being added to, which source
   * is open, what is typed in the filter, and whether the preview is showing.
   * Everything else belongs to whoever opened it.
   */

  export type ScopeSide = "include" | "exclude";

  export type ScopeRow = { readonly key: string; readonly kind: string; readonly words: string };

  export type ScopeOffer = {
    readonly key: string;
    readonly label: string;
    readonly note?: string;
    readonly held?: ScopeSide;
    readonly refused?: string;
  };

  export type ScopeSource = {
    readonly key: string;
    readonly label: string;
    readonly placeholder?: string;
    readonly offers: readonly ScopeOffer[];
  };

  export type ScopePreview = { readonly key: string; readonly label: string; readonly note?: string };

  let {
    whole,
    include,
    exclude,
    sentence,
    count,
    preview = [],
    sources = [],
    disabled = false,
    onmode,
    onadd,
    ondrop
  }: {
    /** Whether the rule is the floor: everything the project holds. */
    whole: boolean;
    include: readonly ScopeRow[];
    exclude: readonly ScopeRow[];
    /** The rule as one sentence, the same one every surface shows afterwards. */
    sentence: string;
    /** How many resources it selects now. */
    count: number;
    /** What those resources are, for the list under the count. */
    preview?: readonly ScopePreview[];
    /** Where a term can be added from. A source with no placeholder is not filtered. */
    sources?: readonly ScopeSource[];
    disabled?: boolean;
    onmode: (whole: boolean) => void;
    onadd: (side: ScopeSide, source: string, key: string) => void;
    ondrop: (side: ScopeSide, key: string) => void;
  } = $props();

  const trace = traceNode("ScopeBuilder", () => ({
    whole,
    include: include.length,
    exclude: exclude.length,
    count,
    disabled
  }));

  let adding = $state<ScopeSide | undefined>(undefined);
  let openSource = $state<string | undefined>(undefined);
  let query = $state("");
  let showing = $state(false);

  const current = $derived(sources.find((source) => source.key === openSource) ?? sources[0]);

  const shown = $derived(
    current === undefined
      ? []
      : current.offers.filter(
          (candidate) =>
            query.trim() === "" ||
            candidate.label.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase())
        )
  );

  const rowsOn = (side: ScopeSide) => (side === "include" ? include : exclude);

  const openAdd = (side: ScopeSide) => {
    adding = side;
    openSource = sources[0]?.key;
    query = "";
  };
</script>

<div {...trace} class="builder">
  <div class="modes" role="group" aria-label="What this selects">
    <Button
      variant={whole ? "default" : "outline"}
      size="xs"
      {disabled}
      aria-pressed={whole}
      onclick={() => onmode(true)}
    >
      Everything in the project
    </Button>
    <Button
      variant={whole ? "outline" : "default"}
      size="xs"
      {disabled}
      aria-pressed={!whole}
      onclick={() => onmode(false)}
    >
      Choose what to include
    </Button>
  </div>

  {#if whole}
    <p class="resting">
      Every resource the project holds, now and later. This is also the floor: anything with no
      scope of its own selects exactly this.
    </p>
  {:else}
    {#each ["include", "exclude"] as const as side (side)}
      <section class="list" aria-label={side === "include" ? "Included" : "Excluded"}>
        <header>
          <b>{side === "include" ? "Include" : "Exclude"}</b>
          <Button variant="outline" size="xs" {disabled} onclick={() => openAdd(side)}>
            {side === "include" ? "Add" : "Add an exception"}
          </Button>
        </header>
        {#each rowsOn(side) as row (row.key)}
          <div class="term">
            <code>{row.kind}</code>
            <span>{row.words}</span>
            <Button
              variant="ghost"
              size="xs"
              {disabled}
              title={`Remove ${row.words}`}
              onclick={() => ondrop(side, row.key)}
            >
              ×
            </Button>
          </div>
        {/each}
        {#if rowsOn(side).length === 0}
          <p class="empty">
            {side === "include"
              ? "Nothing is included yet, so this selects nothing."
              : "Nothing is excluded."}
          </p>
        {/if}
      </section>
    {/each}
  {/if}

  <p class="sentence">{sentence}</p>

  <div class="count">
    <b>{count}</b>
    <span>{count === 1 ? "resource right now" : "resources right now"}</span>
    {#if preview.length > 0}
      <Button variant="ghost" size="xs" onclick={() => (showing = !showing)}>
        {showing ? "Hide them" : "Show them"}
      </Button>
    {/if}
  </div>

  {#if showing && preview.length > 0}
    <ul class="preview">
      {#each preview as item (item.key)}
        <li><span>{item.label}</span>{#if item.note}<small>{item.note}</small>{/if}</li>
      {/each}
    </ul>
  {/if}

  {#if adding !== undefined && current !== undefined}
    <section class="adding" aria-label={`Add to ${adding === "include" ? "Include" : "Exclude"}`}>
      <header>
        <b>Add to {adding === "include" ? "Include" : "Exclude"}</b>
        <Button variant="ghost" size="xs" onclick={() => (adding = undefined)}>Done</Button>
      </header>

      <div class="sources" role="group" aria-label="Where to add from">
        {#each sources as source (source.key)}
          <Button
            variant={source.key === current.key ? "secondary" : "ghost"}
            size="xs"
            aria-pressed={source.key === current.key}
            onclick={() => {
              openSource = source.key;
              query = "";
            }}
          >
            {source.label}
          </Button>
        {/each}
      </div>

      {#if current.placeholder !== undefined}
        <Input
          type="search"
          bind:value={query}
          placeholder={current.placeholder}
          aria-label={current.placeholder}
          class="text-body-sm h-7 [&::-webkit-search-cancel-button]:hidden"
        />
      {/if}

      <div class="offers">
        {#each shown.slice(0, 60) as candidate (candidate.key)}
          <div class="offer">
            <span class="offer-name">{candidate.label}</span>
            {#if candidate.note}<small>{candidate.note}</small>{/if}
            {#if candidate.refused !== undefined}
              <span class="refused" title={candidate.refused}>Would loop</span>
            {:else if candidate.held !== undefined}
              <span class="held">{candidate.held === "include" ? "Included" : "Excluded"}</span>
            {:else}
              <Button
                variant="outline"
                size="xs"
                title={`Add ${candidate.label}`}
                onclick={() => onadd(adding as ScopeSide, current.key, candidate.key)}
              >
                Add
              </Button>
            {/if}
          </div>
        {/each}
        {#if shown.length === 0}
          <p class="empty">Nothing matches.</p>
        {/if}
      </div>
    </section>
  {/if}
</div>

<style>
  .builder {
    display: flex;
    flex-direction: column;
    gap: calc(var(--token-spacing-unit) * 2);
    padding: 0 calc(var(--token-spacing-unit) * 3);
  }

  .modes {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: calc(var(--token-spacing-unit) * 1);
  }

  .resting,
  .empty {
    margin: 0;
    color: var(--token-ink-secondary);
    font-size: var(--token-type-caption-size);
  }

  .empty { font-style: italic; }

  .list { display: flex; flex-direction: column; gap: calc(var(--token-spacing-unit) * 1); }

  .list header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: calc(var(--token-spacing-unit) * 1);
  }

  .list header b {
    color: var(--token-ink-muted);
    font-size: var(--token-type-caption-size);
    font-weight: 700;
    letter-spacing: .08em;
    text-transform: uppercase;
  }

  .term {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr) auto;
    gap: calc(var(--token-spacing-unit) * 1);
    align-items: center;
    padding-inline-start: calc(var(--token-spacing-unit) * 1);
    border: 1px solid var(--token-border-subtle);
    border-radius: var(--token-radius-control);
    background: var(--token-surface-elevated);
  }

  .term code {
    padding: 0 calc(var(--token-spacing-unit) * .5);
    border-radius: 3px;
    background: var(--token-surface-work);
    color: var(--token-ink-muted);
    font-size: 10px;
  }

  .term span {
    overflow: hidden;
    font-size: var(--token-type-body-sm-size);
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .sentence {
    margin: 0;
    padding: calc(var(--token-spacing-unit) * 1.5);
    border-inline-start: 2px solid var(--token-color-accent-1-text);
    border-radius: 0 var(--token-radius-control) var(--token-radius-control) 0;
    background: var(--token-color-accent-1-surface);
    color: var(--token-ink-primary);
    font-size: var(--token-type-body-sm-size);
  }

  .count {
    display: flex;
    align-items: baseline;
    gap: calc(var(--token-spacing-unit) * 1);
  }

  .count b { font-size: 20px; font-weight: 700; }
  .count span { color: var(--token-ink-secondary); font-size: var(--token-type-caption-size); }

  .preview {
    display: flex;
    flex-direction: column;
    gap: calc(var(--token-spacing-unit) * .5);
    max-height: 12rem;
    margin: 0;
    padding: 0;
    overflow-y: auto;
    list-style: none;
  }

  .preview li {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: calc(var(--token-spacing-unit) * 1);
    font-size: var(--token-type-caption-size);
  }

  .preview small { color: var(--token-ink-muted); }

  .adding {
    display: flex;
    flex-direction: column;
    gap: calc(var(--token-spacing-unit) * 1);
    padding: calc(var(--token-spacing-unit) * 1.5);
    border: 1px solid var(--token-border-strong);
    border-radius: var(--token-radius-panel);
    background: var(--token-surface-panel);
  }

  .adding header {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .adding header b { font-size: var(--token-type-body-sm-size); }

  .sources { display: flex; gap: calc(var(--token-spacing-unit) * .5); }

  .offers {
    display: flex;
    flex-direction: column;
    max-height: 14rem;
    overflow-y: auto;
  }

  .offer {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto auto;
    gap: calc(var(--token-spacing-unit) * 1);
    align-items: center;
    padding: calc(var(--token-spacing-unit) * .5) 0;
    border-bottom: 1px solid var(--token-border-subtle);
  }

  .offer-name {
    overflow: hidden;
    font-size: var(--token-type-body-sm-size);
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .offer small { color: var(--token-ink-muted); font-size: 10px; }

  .held,
  .refused {
    padding: 0 calc(var(--token-spacing-unit) * 1);
    border-radius: var(--token-radius-control);
    background: var(--token-surface-work);
    color: var(--token-ink-muted);
    font-size: 10px;
  }

  .refused { color: var(--token-color-attention-text); }
</style>
