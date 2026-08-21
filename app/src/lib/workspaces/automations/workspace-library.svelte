<script lang="ts">
  import Plus from "@lucide/svelte/icons/plus";

  import { PanelChip } from "$lib/unique-components/panel";
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
  import { Switch } from "$lib/simple-components/switch";
  import { ToggleGroup, ToggleGroupItem } from "$lib/simple-components/toggle-group";
  import { automationGroup, automationsIn, type AutomationRow } from "$mock-capabilities/agents";
  import { mockWorkbench } from "$mock-models/workbench.svelte";

  /**
   * Automations — all automations, the screen's default state.
   *
   * `docs/screen-panel-views/screens/automations/workspace-library.md` is the
   * specification. One column, four bands: who this screen is for, what narrows
   * it, every rule, and the sentence that qualifies the last column.
   *
   * **A row is a sentence read left to right** — switch, name, when, do this,
   * last fired, result — so the table itself says *when X, do Y* without anyone
   * opening a rule.
   *
   * **The switch is a column, not a menu item.** Turning a rule off is the safe
   * removal, and it has to be one click from the list. It writes to a local
   * override rather than to the door, because a mock has nothing to write to —
   * `automationGroup` is then asked about the *effective* state, so a rule
   * switched off here drops into Off rather than staying where it was stored.
   *
   * **`Never` is an em dash in Result, not a chip.** A rule that has not fired
   * has no result, and tinting one would invent an outcome.
   */
  const rules = $derived(automationsIn(mockWorkbench.project.id).current);

  let search = $state("");
  /**
   * `all`, or one of the three states `automationGroup` answers with. Not named
   * `state`: a variable by that name makes `$state` read as its store value.
   */
  let band = $state("all");
  let opened = $state<string | undefined>(undefined);

  /** What the switches have been set to here, over what the door stored. */
  let switched = $state<Record<string, boolean>>({});

  const isOn = (rule: AutomationRow): boolean => switched[rule.id] ?? rule.enabled;

  const shown = $derived(
    rules
      .filter((rule: AutomationRow) => {
        const needle = search.trim().toLowerCase();
        return (
          needle === "" ||
          rule.name.toLowerCase().includes(needle) ||
          rule.when.toLowerCase().includes(needle) ||
          rule.does.toLowerCase().includes(needle)
        );
      })
      .filter((rule: AutomationRow) => {
        if (band === "all" || band === "") return true;
        // Asked of the effective rule, so the switch above moves the row.
        return automationGroup({ ...rule, enabled: isOn(rule) }) === band;
      })
  );
</script>

<ScreenSurface>
  <div class="board">
    <div class="area-header">
      <ScreenHeader
        title="Automations"
        about="A run is a dispatch. Success means the task was created — what it then does is the task's own story."
      >
        {#snippet actions()}
          <ScreenAction label="New Automation" icon={Plus} />
        {/snippet}
      </ScreenHeader>
    </div>

    <div class="area-filters">
      <ScreenFilters
        placeholder="Search automations"
        matched={shown.length}
        total={rules.length}
        bind:value={search}
      >
        <ToggleGroup type="single" bind:value={band} variant="outline" size="sm">
          <ToggleGroupItem value="all">All</ToggleGroupItem>
          <ToggleGroupItem value="on">On</ToggleGroupItem>
          <ToggleGroupItem value="off">Off</ToggleGroupItem>
          <ToggleGroupItem value="not working">Not working</ToggleGroupItem>
        </ToggleGroup>
      </ScreenFilters>
    </div>

    <div class="area-automations">
      {#if shown.length === 0}
        <ScreenEmpty
          kind="no-matches"
          title="No rule matches"
          onclear={() => {
            search = "";
            band = "all";
          }}
        >
          Nothing in this project fires on that, or is in that state.
        </ScreenEmpty>
      {:else}
        <ScreenTable columns={["On", "Name", "When", "Do this", "Last fired", "Result"]}>
          {#each shown as rule (rule.id)}
            <ScreenRow selected={opened === rule.id}>
              <ScreenCell>
                <Switch
                  checked={isOn(rule)}
                  onCheckedChange={(next: boolean) => (switched[rule.id] = next)}
                  aria-label={`${rule.name} — on`}
                />
              </ScreenCell>
              <ScreenCell
                name={rule.name}
                onselect={() => {
                  opened = rule.id;
                  mockWorkbench.inspect("agents.automation", {
                    kind: "automation",
                    id: rule.id
                  });
                }}
              />
              <ScreenCell>{rule.when}</ScreenCell>
              <ScreenCell>{rule.does}</ScreenCell>
              <ScreenCell num>{rule.lastFire.when}</ScreenCell>
              <ScreenCell>
                {#if rule.lastFire.result === "Never"}
                  <span class="text-ink-muted">—</span>
                {:else}
                  <PanelChip tone={rule.lastFire.result === "Started" ? "success" : "danger"}>
                    {rule.lastFire.result}
                  </PanelChip>
                {/if}
              </ScreenCell>
            </ScreenRow>
          {/each}
        </ScreenTable>
      {/if}
    </div>

    <div class="area-note">
      <ScreenNote>
        Duplicating a rule leaves it off, so a copy cannot fire before it has been read. The last
        result is Started or Couldn't start — an Automation is never itself running, the task it
        made is.
      </ScreenNote>
    </div>
  </div>
</ScreenSurface>

<style>
  /**
   * The specification's layout table, as `grid-template-areas`. One track: every
   * band here is the full width of the plane, and the table is the only one of
   * them with columns of its own.
   *
   * `automations` is written across two rows exactly as the table has it — the
   * band carrying twice the weight of any other. On a plane that scrolls, the
   * rows are content-height rather than fractions, so the doubling is a
   * statement of proportion rather than a reserved measure.
   */
  .board {
    display: grid;
    gap: calc(var(--token-spacing-unit) * 4);
    grid-template-columns: 1fr;
    grid-template-areas:
      "header"
      "filters"
      "automations"
      "automations"
      "note";
    align-content: start;
  }

  .area-header {
    grid-area: header;
  }
  .area-filters {
    grid-area: filters;
  }
  .area-automations {
    grid-area: automations;
    min-width: 0;
  }
  .area-note {
    grid-area: note;
  }

  /*
    Already one column. Below 60rem the six-column table is what stops being
    readable, and it scrolls sideways inside its own frame rather than the bands
    re-ordering — there is no second column here to fold.
  */
  @media (max-width: 60rem) {
    .board {
      gap: calc(var(--token-spacing-unit) * 3);
    }
  }
</style>
