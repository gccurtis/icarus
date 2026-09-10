<script lang="ts">
  import { Button } from "$vendored-components/button";
  import { Input } from "$vendored-components/input";
  import { traceNode } from "$development-components/trace.svelte";

  /**
   * One rule, built by hand: what it includes, what it takes back out, and how
   * many resources that is right now.
   *
   * **Every set is a difference**, so both sides are always here — as two tabs
   * rather than two stacked lists, because a side you are not editing is a list
   * you are only reading, and reading it is what the sentence underneath is for.
   *
   * **A tab is two panes: what you can add, and what is in.** Searching and
   * holding are different activities and each gets its own surface. Nothing
   * opens on top of anything: the sources are a row of tabs inside the left
   * pane, not a menu, because a menu over a modal over a modal is three lids on
   * one box.
   *
   * **The floor is a button, not a term.** Whole project is the common answer
   * and the thing a parameter falls back to, and Default puts it back to
   * whatever the template suggested — both sit under the panes where a decision
   * about the whole rule belongs.
   *
   * It is handed rows and offers already in words and answers with the keys it
   * was given, so it cannot express a rule the vocabulary would refuse.
   */

  export type ScopeSide = "include" | "exclude";

  export type ScopeRow = {
    readonly key: string;
    readonly kind: string;
    readonly words: string;
    readonly note: string | null;
  };

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
    count,
    preview = [],
    sources = [],
    resettable = false,
    disabled = false,
    onmode,
    onadd,
    ondrop,
    onclear,
    onreset
  }: {
    /** Whether the rule is the floor: everything the project holds. */
    whole: boolean;
    include: readonly ScopeRow[];
    exclude: readonly ScopeRow[];
    /** How many resources it selects now. */
    count: number;
    /** What those resources are, for the list under the count. */
    preview?: readonly ScopePreview[];
    /** Where a term can be added from. A source with no placeholder is not filtered. */
    sources?: readonly ScopeSource[];
    /** Whether there is a default to go back to, which only placing a template has. */
    resettable?: boolean;
    disabled?: boolean;
    onmode: (whole: boolean) => void;
    onadd: (side: ScopeSide, source: string, key: string) => void;
    ondrop: (side: ScopeSide, key: string) => void;
    /** Empty both sides, to start again from nothing. */
    onclear: () => void;
    onreset?: () => void;
  } = $props();

  const trace = traceNode("ScopeBuilder", () => ({
    whole,
    include: include.length,
    exclude: exclude.length,
    count,
    disabled
  }));

  let side = $state<ScopeSide>("include");
  let openSource = $state<string | undefined>(undefined);
  let query = $state("");
  let showing = $state(false);

  const current = $derived(sources.find((source) => source.key === openSource) ?? sources[0]);
  const held = $derived(side === "include" ? include : exclude);

  const shown = $derived(
    current === undefined
      ? []
      : current.offers.filter(
          (candidate) =>
            query.trim() === "" ||
            `${candidate.label} ${candidate.note ?? ""}`
              .toLocaleLowerCase()
              .includes(query.trim().toLocaleLowerCase())
        )
  );
</script>

<div {...trace} class="builder">
  <div class="tabs" role="group" aria-label="Which side to edit">
    {#each ["include", "exclude"] as const as name (name)}
      <button
        type="button"
        class:on={side === name}
        aria-pressed={side === name}
        {disabled}
        onclick={() => {
          side = name;
          query = "";
        }}
      >
        {name === "include" ? "Include" : "Exclude"}
        <span>{(name === "include" ? include : exclude).length}</span>
      </button>
    {/each}
  </div>

  <div class="panes">
    <section class="pane" aria-label={`Add to ${side === "include" ? "include" : "exclude"}`}>
      <header>
        <b>From</b>
      </header>
      <div class="sources" role="group" aria-label="Where to add from">
        {#each sources as source (source.key)}
          <Button
            variant={source.key === current?.key ? "secondary" : "ghost"}
            size="xs"
            {disabled}
            aria-pressed={source.key === current?.key}
            onclick={() => {
              openSource = source.key;
              query = "";
            }}
          >
            {source.label}
          </Button>
        {/each}
      </div>
      {#if current?.placeholder !== undefined}
        <Input
          type="search"
          bind:value={query}
          placeholder={current.placeholder}
          aria-label={current.placeholder}
          class="text-body-sm h-7 [&::-webkit-search-cancel-button]:hidden"
        />
      {/if}
      <div class="offers">
        {#each shown.slice(0, 80) as candidate (candidate.key)}
          <div class="offer">
            <span class="offer-name">{candidate.label}</span>
            {#if candidate.note}<small>{candidate.note}</small>{/if}
            {#if candidate.refused !== undefined}
              <span class="refused" title={candidate.refused}>Would loop</span>
            {:else if candidate.held === side}
              <span class="in">In</span>
            {:else}
              <Button
                variant="outline"
                size="xs"
                {disabled}
                title={`Add ${candidate.label}`}
                onclick={() => onadd(side, current?.key ?? "", candidate.key)}
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

    <section class="pane" aria-label={side === "include" ? "Included" : "Excluded"}>
      <header>
        <b>{side === "include" ? "Included" : "Excluded"}</b>
      </header>
      <div class="terms">
        {#each held as row (row.key)}
          <div class="term">
            <code>{row.kind}</code>
            <div class="term-label">
              <span>{row.words}</span>
              {#if row.note}<small>{row.note}</small>{/if}
            </div>
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
        {#if held.length === 0}
          <p class="empty">
            {side === "include"
              ? whole
                ? "Everything in the project, because nothing narrower is included."
                : "Nothing is included yet, so this selects nothing."
              : "Nothing is taken back out."}
          </p>
        {/if}
      </div>
    </section>
  </div>

  <div class="foot">
    <div class="floor">
      <Button
        variant={whole ? "secondary" : "outline"}
        size="xs"
        {disabled}
        aria-pressed={whole}
        title="Select everything the project holds"
        onclick={() => onmode(true)}
      >
        Whole project
      </Button>
      {#if resettable && onreset !== undefined}
        <Button
          variant="ghost"
          size="xs"
          {disabled}
          title="Go back to what the template suggests"
          onclick={onreset}
        >
          Default
        </Button>
      {/if}
      <Button
        variant="ghost"
        size="xs"
        {disabled}
        title="Empty both sides and start again"
        onclick={onclear}
      >
        Clear
      </Button>
    </div>

    <div class="count">
      <b>{count}</b>
      <span>{count === 1 ? "resource" : "resources"}</span>
      {#if preview.length > 0}
        <Button variant="ghost" size="xs" onclick={() => (showing = !showing)}>
          {showing ? "Hide" : "Show"}
        </Button>
      {/if}
    </div>
  </div>

  {#if showing && preview.length > 0}
    <ul class="preview">
      {#each preview as item (item.key)}
        <li><span>{item.label}</span>{#if item.note}<small>{item.note}</small>{/if}</li>
      {/each}
    </ul>
  {/if}
</div>

<style>
  .builder {
    display: flex;
    flex-direction: column;
    gap: calc(var(--token-spacing-unit) * 2);
    padding: 0 calc(var(--token-spacing-unit) * 3);
  }

  .tabs {
    display: flex;
    gap: calc(var(--token-spacing-unit) * 1);
    border-bottom: 1px solid var(--token-border-subtle);
  }

  .tabs button {
    display: flex;
    align-items: center;
    gap: calc(var(--token-spacing-unit) * 1);
    padding: calc(var(--token-spacing-unit) * 1) calc(var(--token-spacing-unit) * 1.5);
    border: 0;
    background: transparent;
    color: var(--token-ink-secondary);
    font-size: var(--token-text-body-sm);
    font-weight: 600;
    cursor: pointer;
  }

  .tabs button.on {
    box-shadow: inset 0 -2px 0 var(--token-color-active-text);
    color: var(--token-color-active-text);
  }

  .tabs span {
    padding: 0 calc(var(--token-spacing-unit) * 1);
    border-radius: var(--token-radius-control);
    background: var(--token-surface-work);
    color: var(--token-ink-muted);
    font-size: 10px;
    font-variant-numeric: tabular-nums;
  }

  .panes {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
    gap: calc(var(--token-spacing-unit) * 2);
  }

  /**
   * Both panes are one fixed height, so the modal does not jump as somebody
   * clicks between Kinds, Sets and Resources looking for what they want.
   */
  .pane {
    display: flex;
    flex-direction: column;
    gap: calc(var(--token-spacing-unit) * 1);
    height: 21rem;
    padding: calc(var(--token-spacing-unit) * 1.5);
    border: 1px solid var(--token-border-subtle);
    border-radius: var(--token-radius-panel);
    background: var(--token-surface-panel);
  }

  .pane header b {
    color: var(--token-ink-muted);
    font-size: var(--token-text-caption);
    font-weight: 700;
    letter-spacing: .08em;
    text-transform: uppercase;
  }

  .sources { display: flex; flex-wrap: wrap; gap: calc(var(--token-spacing-unit) * .5); }

  .offers,
  .terms {
    display: flex;
    flex: 1;
    flex-direction: column;
    min-height: 0;
    overflow-y: auto;
  }

  .terms { gap: calc(var(--token-spacing-unit) * 1); }

  .offer {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto auto;
    gap: calc(var(--token-spacing-unit) * 1);
    align-items: center;
    padding: calc(var(--token-spacing-unit) * .5) 0;
    border-bottom: 1px solid var(--token-border-subtle);
  }

  .offer-name,
  .term-label span {
    overflow: hidden;
    font-size: var(--token-text-body-sm);
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .offer small { color: var(--token-ink-muted); font-size: 10px; }

  .term-label {
    display: flex;
    min-width: 0;
    flex-direction: column;
  }

  .term-label small {
    overflow: hidden;
    color: var(--token-ink-muted);
    font-size: 10px;
    text-overflow: ellipsis;
    white-space: nowrap;
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

  .empty {
    margin: 0;
    color: var(--token-ink-secondary);
    font-size: var(--token-text-caption);
    font-style: italic;
  }

  .in,
  .refused {
    padding: 0 calc(var(--token-spacing-unit) * 1);
    border-radius: var(--token-radius-control);
    background: var(--token-surface-work);
    color: var(--token-ink-muted);
    font-size: 10px;
  }

  .refused { color: var(--token-color-attention-text); }

  .foot {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: calc(var(--token-spacing-unit) * 1);
  }

  .floor { display: flex; gap: calc(var(--token-spacing-unit) * 1); }

  .count { display: flex; align-items: baseline; gap: calc(var(--token-spacing-unit) * 1); }
  .count b { font-size: 18px; font-weight: 700; }
  .count span { color: var(--token-ink-secondary); font-size: var(--token-text-caption); }

  .preview {
    display: flex;
    flex-direction: column;
    gap: calc(var(--token-spacing-unit) * .5);
    max-height: 10rem;
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
    font-size: var(--token-text-caption);
  }

  .preview small { color: var(--token-ink-muted); }

  @media (max-width: 44rem) {
    .panes { grid-template-columns: minmax(0, 1fr); }
    .pane { min-height: 0; }
  }
</style>
