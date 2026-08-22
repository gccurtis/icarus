<script lang="ts">
  import ChevronDown from "@lucide/svelte/icons/chevron-down";
  import ChevronRight from "@lucide/svelte/icons/chevron-right";
  import Minus from "@lucide/svelte/icons/minus";
  import Plus from "@lucide/svelte/icons/plus";
  import SearchIcon from "@lucide/svelte/icons/search";

  import { PanelChip } from "$lib/unique-components/panel";
  import {
    ScreenCell,
    ScreenEmpty,
    ScreenFilters,
    ScreenGroup,
    ScreenHeader,
    ScreenNote,
    ScreenRow,
    ScreenSurface,
    ScreenTable
  } from "$lib/unique-components/screen";
  import { Button } from "$lib/simple-components/button";
  import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger
  } from "$lib/simple-components/collapsible";
  import { Input } from "$lib/simple-components/input";
  import { ToggleGroup, ToggleGroupItem } from "$lib/simple-components/toggle-group";
  import { kindLabel } from "$mock-capabilities/library";
  import {
    context,
    contentsOf,
    includeTerms,
    retrievabilityOf,
    searchIn,
    takeOutTerms,
    type ResolvedResource,
    type ScopeTerm,
    type SearchHit,
    type TermRule
  } from "$mock-capabilities/scope";
  import { viewState, type InspectionKey } from "$model/client/view-state";

  const view = viewState();

  /**
   * Context — one Context: what goes in, what comes out, and what survives.
   *
   * `docs/screen-panel-views/screens/context/workspace-one-context.md` is the
   * specification.
   *
   * **Two halves with a minus between them, not a tree.** The nested expression
   * editor is gone. Include and Take out are the same shape side by side, and
   * the operator is a region of its own — an `auto` track between two `1fr`
   * ones — because without the sign the screen reads as "things in" and "other
   * things in" rather than as a subtraction.
   *
   * **The halves take one row each and the result takes two.** What survives is
   * a table someone reads down; the two halves are two or three terms apiece and
   * a taller band would be empty space arguing for its own importance.
   *
   * **Every row says why it is there.** *In because* is what makes a Context
   * debuggable, and a connector-sourced file says which connector it came
   * through — the connector record itself is never retrievable content.
   *
   * **Include's total is arithmetic, not a sum.** The two include terms overlap,
   * so adding them would say 282; what is true is that 211 survive and 37 were
   * taken out, which puts 248 on the way in. The screen is drawn as that sum and
   * the numbers have to hold across every panel that shows any part of it.
   */
  let {
    /** Which Context this is. View state on the screen, so only a parent knows it. */
    contextId = "cx-drafts"
  }: { contextId?: string } = $props();

  const record = $derived(context(contextId).current);
  const include = $derived(includeTerms(contextId).current);
  const takeOut = $derived(takeOutTerms(contextId).current);
  const contents = $derived(contentsOf(contextId).current);
  const reach = $derived(retrievabilityOf(contextId).current);

  const figure = (value: number): string => value.toLocaleString("en-GB");

  const takenOut = $derived(
    takeOut.reduce((sum: number, term: ScopeTerm) => sum + term.matches, 0)
  );
  const goingIn = $derived(record.contains + takenOut);

  /**
   * Which lens a term opens. A term named by hand has none in the
   * specification's inspector table, so it is drawn but is not a target.
   */
  const LENS: Partial<Record<TermRule, InspectionKey>> = {
    everything: "scope.include-everything",
    context: "scope.include-context",
    kind: "scope.take-out-kind"
  };

  /* ---------------- what that leaves ---------------- */

  let search = $state("");
  let kinds = $state<string[]>([]);

  const kindsPresent = $derived([...new Set(contents.map((row: ResolvedResource) => row.kind))]);

  const shown = $derived(
    contents
      .filter((row: ResolvedResource) => kinds.length === 0 || kinds.includes(row.kind))
      .filter((row: ResolvedResource) =>
        row.name.toLowerCase().includes(search.trim().toLowerCase())
      )
  );

  /* ---------------- try a search ---------------- */

  let testing = $state(false);
  let query = $state("");
  /** Results appear only once a retrieval has been run: this is a test, not a list. */
  let ran = $state(false);

  const hits = $derived(searchIn(contextId, query).current);
  /** The scope as it stood when the search ran, recorded with the result. */
  const manifest = $derived(hits.at(0)?.searched);
</script>

{#snippet termBody(term: ScopeTerm)}
  <span class="flex min-w-0 flex-col gap-0.5">
    <span class="text-body-sm text-ink-primary">{term.label}</span>
    <span class="text-caption text-ink-muted">{term.what}</span>
  </span>
  <span class="flex shrink-0 items-center gap-2">
    {#if term.unsaved}
      <PanelChip tone="attention">Unsaved</PanelChip>
    {/if}
    <span class="text-body-sm text-ink-secondary tabular-nums">{figure(term.matches)}</span>
  </span>
{/snippet}

{#snippet half(terms: readonly ScopeTerm[])}
  <div class="flex flex-col gap-2">
    {#each terms as term (term.id)}
      {@const lens = LENS[term.rule]}
      {#if lens}
        <button
          type="button"
          class="border-border-subtle bg-surface-panel hover:bg-surface-panel-hover rounded-panel flex w-full items-center justify-between gap-3 border p-3 text-start"
          onclick={() => view.inspect(lens, { kind: "term", id: term.id })}
        >
          {@render termBody(term)}
        </button>
      {:else}
        <div
          class="border-border-subtle bg-surface-panel rounded-panel flex w-full items-center justify-between gap-3 border p-3"
        >
          {@render termBody(term)}
        </div>
      {/if}
    {/each}
  </div>
{/snippet}

<ScreenSurface wide>
  <div class="board">
    <div class="area-screen-header">
      <ScreenHeader title={record.name} about={record.inPlainWords}>
        {#snippet actions()}
          <PanelChip tone={record.state === "saved" ? "success" : "attention"}>
            {record.state === "saved" ? "Saved" : `${record.unsaved} unsaved`}
          </PanelChip>
          <PanelChip>{figure(record.contains)} resources</PanelChip>
          <Button variant="outline" size="sm">Duplicate</Button>
          <!-- Gated on a reverse-dependency query that does not exist; the title says so. -->
          <Button variant="outline" size="sm" disabled title={record.deleteBlocked}>Delete</Button>
        {/snippet}
      </ScreenHeader>
    </div>

    <div class="area-include">
      <ScreenGroup label="Include" tone="success" count="{figure(goingIn)} resources">
        {#snippet actions()}
          <Button variant="outline" size="xs" onclick={() => view.selectContext("scope.add")}>
            <Plus aria-hidden="true" />
            Add
          </Button>
        {/snippet}
        {@render half(include)}
      </ScreenGroup>
    </div>

    <!--
      The operator, not a control. It is a region because it carries the meaning:
      the two halves are a subtraction, and the sign is the only thing on the
      screen that says so.
    -->
    <div class="area-minus" role="separator" aria-label="minus">
      <Minus class="text-ink-muted size-6" aria-hidden="true" />
    </div>

    <div class="area-take-out">
      <ScreenGroup label="Take out" tone="danger" count="{figure(takenOut)} resources">
        {#snippet actions()}
          <Button variant="outline" size="xs" onclick={() => view.selectContext("scope.add")}>
            <Plus aria-hidden="true" />
            Add
          </Button>
        {/snippet}
        {@render half(takeOut)}
      </ScreenGroup>
    </div>

    <div class="area-what-that-leaves">
      <ScreenGroup
        label="What that leaves"
        count="{figure(record.contains)} resources, as of now"
      >
        <div class="flex flex-col gap-3">
          <ScreenFilters placeholder="Search what this Context leaves" bind:value={search}>
            <ToggleGroup type="multiple" bind:value={kinds} variant="outline" size="sm">
              {#each kindsPresent as kind (kind)}
                <ToggleGroupItem value={kind}>{kindLabel(kind)}</ToggleGroupItem>
              {/each}
            </ToggleGroup>
          </ScreenFilters>

          {#if shown.length === 0}
            <ScreenEmpty
              kind="no-matches"
              title="Nothing in this Context matches"
              onclear={() => {
                search = "";
                kinds = [];
              }}
            >
              The scope still resolves to {figure(record.contains)} resources — the filter is what emptied
              this table.
            </ScreenEmpty>
          {:else}
            <ScreenTable columns={["Name", "Kind", "In because", "Updated"]}>
              {#each shown as row (row.id)}
                <ScreenRow selected={view.selection?.id === row.id}>
                  <ScreenCell
                    name={row.name}
                    onselect={() =>
                      view.inspect("scope.resolved-resource", {
                        kind: "resource",
                        id: row.id
                      })}
                  />
                  <ScreenCell>{kindLabel(row.kind)}</ScreenCell>
                  <!--
                    Which term put it here, and the connector it came through
                    where it came through one. A connector expands to the files
                    it synced; the connector record is never content itself.
                  -->
                  <ScreenCell>
                    {row.inBecause}{row.via === undefined ? "" : ` · via ${row.via}`}
                  </ScreenCell>
                  <ScreenCell num>{row.updated}</ScreenCell>
                </ScreenRow>
              {/each}
            </ScreenTable>
          {/if}

          <ScreenNote meta="{shown.length} of {figure(record.contains)} shown">
            A Context is live, so this list changes as the project does.
          </ScreenNote>
        </div>
      </ScreenGroup>
    </div>

    <!--
      The only region that answers the question a Context exists for. Collapsed,
      because it is a test someone chooses to run rather than a reading of the
      scope.
    -->
    <div class="area-try-a-search">
      <Collapsible bind:open={testing}>
        <CollapsibleTrigger
          class="text-caption text-ink-muted flex items-center gap-1.5 font-semibold tracking-wide uppercase"
        >
          {#if testing}
            <ChevronDown class="size-3.5" aria-hidden="true" />
          {:else}
            <ChevronRight class="size-3.5" aria-hidden="true" />
          {/if}
          Try a search
        </CollapsibleTrigger>
        <CollapsibleContent class="flex flex-col gap-3 pt-3">
          <form
            class="flex flex-wrap items-center gap-2"
            onsubmit={(event: SubmitEvent) => {
              event.preventDefault();
              ran = true;
            }}
          >
            <Input
              bind:value={query}
              placeholder="What would an agent find in here?"
              aria-label="What would an agent find in here?"
              class="max-w-96 flex-1"
            />
            <Button type="submit" variant="outline" size="sm">
              <SearchIcon aria-hidden="true" />
              Search
            </Button>
          </form>

          {#if ran}
            <ScreenTable columns={["Source", "What came back", "Relevance", "Density"]}>
              {#each hits as hit (hit.id)}
                <ScreenRow selected={view.selection?.id === hit.id}>
                  <ScreenCell
                    name="{hit.source}{hit.page === undefined ? '' : ` · page ${hit.page}`}"
                    onselect={() =>
                      view.inspect("scope.search-result", { kind: "hit", id: hit.id })}
                  />
                  <!-- The retrieved region, verbatim: a paraphrase is not what an agent gets. -->
                  <ScreenCell>
                    <span class="text-body-sm text-ink-secondary italic">{hit.passage}</span>
                  </ScreenCell>
                  <ScreenCell num>{hit.relevance.toFixed(2)}</ScreenCell>
                  <ScreenCell num>{hit.density.toFixed(2)}</ScreenCell>
                </ScreenRow>
              {/each}
            </ScreenTable>
          {:else}
            <ScreenEmpty title="Nothing has been searched yet" icon={SearchIcon}>
              Run a retrieval against this scope to see what an agent reading it would actually get
              back.
            </ScreenEmpty>
          {/if}

          <ScreenNote meta={manifest === undefined ? undefined : `searched at ${manifest.at}`}>
            {figure(reach.indexed)} of {figure(reach.contains)} resources have indexed material. The
            other {figure(reach.nothingIndexed)} are here, but nothing in them can be retrieved yet.
          </ScreenNote>
        </CollapsibleContent>
      </Collapsible>
    </div>
  </div>
</ScreenSurface>

<style>
  /**
   * The layout table from the specification, as `grid-template-areas`. Three
   * tracks — `1fr auto 1fr` — because the two halves are the same kind of thing
   * and the operator between them is one glyph wide.
   *
   * The bands are proportional rather than fixed, and the proportions are the
   * repeated labels: the halves take two rows, what survives takes two, and the
   * retrieval test takes one because it is collapsed until it is wanted.
   */
  .board {
    display: grid;
    gap: calc(var(--token-spacing-unit) * 5);
    grid-template-columns: 1fr auto 1fr;
    grid-template-areas:
      "screen-header    screen-header    screen-header"
      "include          minus            take-out"
      "include          minus            take-out"
      "what-that-leaves what-that-leaves what-that-leaves"
      "what-that-leaves what-that-leaves what-that-leaves"
      "try-a-search     try-a-search     try-a-search";
    align-content: start;
  }

  .area-screen-header {
    grid-area: screen-header;
  }
  .area-include {
    grid-area: include;
  }
  .area-minus {
    display: flex;
    grid-area: minus;
    align-items: center;
    justify-content: center;
  }
  .area-take-out {
    grid-area: take-out;
  }
  .area-what-that-leaves {
    grid-area: what-that-leaves;
  }
  .area-try-a-search {
    grid-area: try-a-search;
  }

  /*
   * One column below the width where two halves stop being readable side by
   * side. The order is the arithmetic, not the importance: Include, the sign,
   * Take out — a subtraction read downward is still a subtraction, and moving
   * the sign out from between them would leave two lists.
   */
  @media (max-width: 60rem) {
    .board {
      grid-template-columns: 1fr;
      grid-template-areas:
        "screen-header"
        "include"
        "minus"
        "take-out"
        "what-that-leaves"
        "try-a-search";
    }
  }
</style>
