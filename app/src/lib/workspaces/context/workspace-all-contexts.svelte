<script lang="ts">
  import Layers from "@lucide/svelte/icons/layers";

  import {
    ScreenAction,
    ScreenCell,
    ScreenEmpty,
    ScreenFilters,
    ScreenHeader,
    ScreenNote,
    ScreenRow,
    ScreenSurface,
    ScreenTable
  } from "$lib/unique-components/screen";
  import { contexts, type ContextRow } from "$mock-capabilities/scope";
  import { mockWorkbench } from "$mock-models/workbench.svelte";

  /**
   * Context — all Contexts: every saved scope, with what each resolves to right
   * now.
   *
   * `docs/screen-panel-views/screens/context/workspace-all-contexts.md` is the
   * specification. Four bands down one column, and the table gets two of the
   * five rows because it is the screen — identity, then what narrows it, then
   * every scope, then the one line the zero-count row makes necessary.
   *
   * **The rule, in words, is generated rather than typed.** It is what makes the
   * table scannable, and it comes off the definition through the same renderer
   * the inspector uses, so a scope cannot describe itself one way here and
   * another way in the lens.
   *
   * **Contains and Retrievable are two columns, never a ratio.** The gap between
   * them is the difference between a scope that looks right and one that works,
   * and a percentage hides which of the two a reader is looking at.
   */
  let {
    /** Enter the one-Context state. Only a parent knows where that lives. */
    onopen = () => {}
  }: { onopen?: (contextId: string) => void } = $props();

  const all = $derived(contexts().current);

  let search = $state("");

  const shown = $derived(
    all.filter((row: ContextRow) => {
      const needle = search.trim().toLowerCase();
      return (
        needle === "" ||
        row.name.toLowerCase().includes(needle) ||
        row.inWords.toLowerCase().includes(needle)
      );
    })
  );

  /** The warning is about a scope that matches nothing, so it appears with one. */
  const anyEmpty = $derived(shown.some((row: ContextRow) => row.contains === 0));

  const open = (row: ContextRow) => {
    onopen(row.id);
    mockWorkbench.inspect("scope.context", { kind: "context", id: row.id });
  };
</script>

<ScreenSurface>
  <div class="board">
    <div class="area-header">
      <ScreenHeader
        title="Context"
        about="Saved scopes. Each is a live rule — what matches it today is what an agent can look at today."
      >
        {#snippet actions()}
          <ScreenAction label="New Context" icon={Layers} />
        {/snippet}
      </ScreenHeader>
    </div>

    <div class="area-filters">
      <ScreenFilters
        placeholder="Search Contexts"
        matched={shown.length}
        total={all.length}
        bind:value={search}
      />
    </div>

    <div class="area-contexts">
      {#if shown.length === 0}
        <ScreenEmpty
          kind="no-matches"
          title="No Context matches"
          icon={Layers}
          onclear={() => (search = "")}
        >
          Nothing saved here has that in its name, or in the rule it stands for.
        </ScreenEmpty>
      {:else}
        <ScreenTable
          columns={["Name", "The rule, in words", "Contains", "Retrievable", "Used by"]}
        >
          {#each shown as row (row.id)}
            <ScreenRow selected={mockWorkbench.selection?.id === row.id}>
              <ScreenCell name={row.name} onselect={() => open(row)} />
              <ScreenCell>{row.inWords}</ScreenCell>
              <ScreenCell num>{row.contains}</ScreenCell>
              <ScreenCell num>{row.retrievable}</ScreenCell>
              <!--
                Only consumers the backend can query truthfully, which is why the
                column is partial by construction and why Delete stays gated.
              -->
              <ScreenCell>{row.usedBy}</ScreenCell>
            </ScreenRow>
          {/each}
        </ScreenTable>
      {/if}
    </div>

    {#if anyEmpty}
      <div class="area-warning">
        <ScreenNote tone="gap">
          A Context matching nothing cannot be used to narrow a search: an empty scope currently
          means the whole project, so it would widen the search rather than narrow it.
        </ScreenNote>
      </div>
    {/if}
  </div>
</ScreenSurface>

<style>
  /**
   * The layout table from the specification, as `grid-template-areas`. One
   * track, because five columns of a table want every pixel the plane has.
   *
   * `contexts` is written twice because the table writes it twice: it takes two
   * rows to the one each of the others gets. The bands are proportional rather
   * than fixed — the surface owns the scroll, so a band's share comes from the
   * rows it spans and from what is in it.
   */
  .board {
    display: grid;
    gap: calc(var(--token-spacing-unit) * 4);
    grid-template-columns: 1fr;
    grid-template-areas:
      "header"
      "filters"
      "contexts"
      "contexts"
      "warning";
    align-content: start;
  }

  .area-header {
    grid-area: header;
  }
  .area-filters {
    grid-area: filters;
  }
  .area-contexts {
    grid-area: contexts;
  }
  .area-warning {
    grid-area: warning;
  }

  /*
   * There is no one-column fallback to write: the specification's table has a
   * single track, so this grid is already the narrow form. The table inside it
   * scrolls sideways rather than the page doing so, which is the registry's.
   */
</style>
