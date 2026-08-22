<script lang="ts">
  import Plus from "@lucide/svelte/icons/plus";

  import { PanelActor, PanelChip } from "$lib/unique-components/panel";
  import {
    ScreenAction,
    ScreenCard,
    ScreenCards,
    ScreenEmpty,
    ScreenFilters,
    ScreenHeader,
    ScreenSurface
  } from "$lib/unique-components/screen";
  import { ToggleGroup, ToggleGroupItem } from "$lib/simple-components/toggle-group";
  import { personasIn, type PersonaRow } from "$mock-capabilities/agents";
  import { viewState } from "$model/client/view-state";

  const view = viewState();

  /**
   * Personas — all personas, entered from the Personas view.
   *
   * `docs/screen-panel-views/screens/personas/workspace-library.md` is the
   * specification. One column, three bands: who the screen is for, what narrows
   * it, and the agents themselves.
   *
   * **Cards rather than a table**, because an agent is recognised by its face and
   * its record rather than read off a row — the same reason Templates and
   * Analyses are card grids.
   *
   * **The work chip is the identifying detail.** Two agents with similar prose
   * are told apart by what they have done, so `41 tasks · 2 running` sits on the
   * card rather than behind it. The aggregate is the door's; counting tasks in
   * the browser would stop being true after the first page of them.
   */
  const personas = $derived(personasIn(view.project).current);

  let search = $state("");
  /** `all`, or one of the two scopes a persona can have. */
  let scope = $state("all");
  let opened = $state<string | undefined>(undefined);

  const shown = $derived(
    personas
      .filter((row: PersonaRow) => {
        const needle = search.trim().toLowerCase();
        return (
          needle === "" ||
          row.name.toLowerCase().includes(needle) ||
          row.describes.toLowerCase().includes(needle)
        );
      })
      .filter((row: PersonaRow) => scope === "all" || scope === "" || row.scope === scope)
  );
</script>

<ScreenSurface>
  <div class="board">
    <div class="area-header">
      <ScreenHeader
        title="Personas"
        about="Reusable agent behaviour. Provider credentials and deployment setup stay outside project data."
      >
        {#snippet actions()}
          <ScreenAction label="New Persona" icon={Plus} />
        {/snippet}
      </ScreenHeader>
    </div>

    <div class="area-filters">
      <ScreenFilters
        placeholder="Search personas"
        matched={shown.length}
        total={personas.length}
        bind:value={search}
      >
        <ToggleGroup type="single" bind:value={scope} variant="outline" size="sm">
          <ToggleGroupItem value="all">All</ToggleGroupItem>
          <ToggleGroupItem value="This project">This project</ToggleGroupItem>
          <ToggleGroupItem value="Everywhere">Everywhere</ToggleGroupItem>
        </ToggleGroup>
      </ScreenFilters>
    </div>

    <div class="area-personas">
      {#if shown.length === 0}
        <ScreenEmpty
          kind="no-matches"
          title="No agent matches"
          onclear={() => {
            search = "";
            scope = "all";
          }}
        >
          Nothing available here is described that way, or lives in that scope.
        </ScreenEmpty>
      {:else}
        <ScreenCards min="16rem">
          {#each shown as row (row.id)}
            <ScreenCard
              title={row.name}
              sub={row.describes}
              selected={opened === row.id}
              onselect={() => {
                opened = row.id;
                view.inspect("agents.persona", { kind: "persona", id: row.id });
              }}
            >
              <!--
                The face alone: the card's title already carries the name, and
                the fallback's role colour is what says agent rather than person.
                No target on it, because the card it sits in is the target.
              -->
              {#snippet thumb()}<PanelActor name={row.name} kind="agent" size="face" />{/snippet}
              <!--
                What it has done, and — separately toned — what it is doing. A
                record counts what has happened; what is happening now is a state
                beside it, and the two read differently on purpose.
              -->
              <span class="flex flex-wrap items-center gap-1">
                <PanelChip>{row.tasks} tasks</PanelChip>
                {#if row.running > 0}
                  <PanelChip tone="active">{row.running} running</PanelChip>
                {/if}
              </span>
            </ScreenCard>
          {/each}
        </ScreenCards>
      {/if}
    </div>
  </div>
</ScreenSurface>

<style>
  /**
   * The specification's layout table, as `grid-template-areas`. One track: each
   * band is the full width, and the only sub-division on the screen is the card
   * grid's own, which the plane's width decides rather than this.
   *
   * `personas` is written across two rows exactly as the table has it — the band
   * that takes whatever the other two leave. On a scrolling plane the rows are
   * content-height, so the doubling states the proportion rather than reserving
   * a measure.
   */
  .board {
    display: grid;
    gap: calc(var(--token-spacing-unit) * 4);
    grid-template-columns: 1fr;
    grid-template-areas:
      "header"
      "filters"
      "personas"
      "personas";
    align-content: start;
  }

  .area-header {
    grid-area: header;
  }
  .area-filters {
    grid-area: filters;
  }
  .area-personas {
    grid-area: personas;
    min-width: 0;
  }

  /* Already one column; the card grid drops to one card across on its own. */
  @media (max-width: 60rem) {
    .board {
      gap: calc(var(--token-spacing-unit) * 3);
    }
  }
</style>
