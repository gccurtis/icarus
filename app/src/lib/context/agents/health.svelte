<script lang="ts">
  import CircleCheck from "@lucide/svelte/icons/circle-check";
  import CircleSlash from "@lucide/svelte/icons/circle-slash";
  import TriangleAlert from "@lucide/svelte/icons/triangle-alert";

  import { Panel, PanelNote, PanelRow, PanelSection } from "$lib/unique-components/panel";
  import { automationHealth, type HealthRow } from "$mock-capabilities/agents";
  import { mockWorkbench } from "$mock-models/workbench.svelte";

  /**
   * The state of every rule in one place — the view Project Overview's Health
   * links into.
   *
   * `docs/screen-panel-views/context/agents/health.md` is the specification.
   * Three groups, and the middle one is the reason the view exists: a rule that
   * has never run is not broken, but it is not working either.
   *
   * **There is no timeline here and there will not be one.** No run table, no
   * retry model, no history beyond the last fire — so this shows a state and an
   * approximate count, and the tilde in front of the count is load-bearing.
   */
  const rows = $derived(automationHealth(mockWorkbench.project.id).current);

  /** The three groups, in the order the specification bands them. */
  const GROUPS: readonly HealthRow["group"][] = ["Not working", "Never fired", "Working"];

  const ICON = {
    "Not working": TriangleAlert,
    "Never fired": CircleSlash,
    Working: CircleCheck
  };

  const TONE = {
    "Not working": "danger",
    "Never fired": "attention",
    Working: "success"
  } as const;

  /** Why it is in this group: the fault, the dormancy, or how often it dispatches. */
  const qualifier = (row: HealthRow): string =>
    row.group === "Working" ? `~${row.firedAbout} times` : (row.reason ?? row.lastFired);
</script>

<Panel title="Health">
  {#each GROUPS as group (group)}
    {@const listed = rows.filter((row: HealthRow) => row.group === group)}
    <!--
      A group stays on screen with nothing in it: its emptiness is an answer
      about the project, while its absence would read as a panel that did not
      load.
    -->
    <PanelSection title={group} count={listed.length} flush>
      {#each listed as row (row.id)}
        <PanelRow
          title={row.name}
          sub={qualifier(row)}
          meta={row.lastFired}
          icon={ICON[group]}
          tone={TONE[group]}
          titleTone={group === "Not working" ? "danger" : undefined}
          onselect={() =>
            mockWorkbench.inspect("agents.last-fired", { kind: "automation", id: row.id })}
        />
      {/each}

      {#if listed.length === 0}
        <PanelNote>No rule is in this state.</PanelNote>
      {/if}
    </PanelSection>
  {/each}

  <PanelNote tone="gap">
    There is no run table to count, so the fire count is approximate and the last
    fire is the whole history.
  </PanelNote>
</Panel>
