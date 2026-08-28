<script lang="ts">
  import ArrowRight from "@lucide/svelte/icons/arrow-right";
  import Plug from "@lucide/svelte/icons/plug";
  import ScanText from "@lucide/svelte/icons/scan-text";
  import Workflow from "@lucide/svelte/icons/workflow";

  import { Panel, PanelButton, PanelNote, PanelRow, PanelSection } from "$authored-components/panel";
  import { health, type HealthIssue } from "$capabilities/project";
  import { viewState } from "$model/client/view-state";

  /**
   * Health — only the things that genuinely cannot proceed.
   *
   * `docs/screen-panel-views/context/project/health.md` is the specification.
   * Machine problems are kept out of Mentions so that a person addressing you and
   * a token expiring never compete for the same attention. Nothing derived is
   * listed: a prompt block and a formula both read their value when they run, so
   * neither can fall behind and neither is ever a problem.
   *
   * **Empty is the normal state**, and it is said in one line rather than as three
   * empty sections — a panel of headings with nothing under them reads as a panel
   * that has not loaded.
   */
  let { onopen }: { onopen?: () => void } = $props();

  const view = viewState();

  const problems = $derived(health().current);

  /** The three kinds of blockage, in the order the specification bands them. */
  const GROUPS: readonly HealthIssue["group"][] = ["Connectors", "Extraction", "Automations"];

  const ICON = { Connectors: Plug, Extraction: ScanText, Automations: Workflow };

  const LENS = {
    Connectors: "project.connector",
    Extraction: "project.file",
    Automations: "agents.automation"
  } as const;

  const SELECTED = { Connectors: "connector", Extraction: "file", Automations: "automation" };
</script>

<Panel title="Health">
  {#snippet actions()}
    <PanelButton
      label="Open Automations"
      icon={ArrowRight}
      disabled={onopen === undefined}
      title="Automations, on the Agents screen"
      onclick={onopen}
    />
  {/snippet}

  {#if problems.length === 0}
    <PanelNote>Nothing in this project is blocked.</PanelNote>
  {:else}
    {#each GROUPS as group (group)}
      {@const rows = problems.filter((issue) => issue.group === group)}
      <!--
        A section stays on screen with nothing in it, because its absence and its
        emptiness say different things: one is a state of the world, the other is
        a panel that did not answer. No door names a connector that is syncing
        yet, so what is listed here is only what cannot.
      -->
      <PanelSection title={group} count={rows.length} flush>
        {#each rows as issue (issue.id)}
          <PanelRow
            title={issue.title}
            sub={issue.detail}
            icon={ICON[group]}
            tone={issue.tone}
            titleTone={issue.tone}
            onselect={() =>
              view.inspect(LENS[group], { kind: SELECTED[group], id: issue.id })}
          />
        {/each}

        {#if rows.length === 0}
          <PanelNote>Nothing here is blocked.</PanelNote>
        {/if}
      </PanelSection>
    {/each}
  {/if}
</Panel>
