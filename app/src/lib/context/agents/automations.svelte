<script lang="ts">
  import Copy from "@lucide/svelte/icons/copy";
  import FolderOpen from "@lucide/svelte/icons/folder-open";
  import Play from "@lucide/svelte/icons/play";
  import Plus from "@lucide/svelte/icons/plus";
  import Workflow from "@lucide/svelte/icons/workflow";

  import {
    Panel,
    PanelButton,
    PanelNote,
    PanelRow,
    PanelSearch,
    PanelSection
  } from "$lib/unique-components/panel";
  import { automationGroup, automationsIn, type AutomationRow } from "$mock-capabilities/agents";
  import { mockWorkbench } from "$mock-models/workbench.svelte";

  /**
   * Every standing rule in this project, by state.
   *
   * `docs/screen-panel-views/context/agents/automations.md` is the
   * specification. The order is what needs attention: broken, live, dormant.
   *
   * **A broken rule carries its reason on the row.** The reason is almost always
   * a configuration failure elsewhere — a persona missing a tool, a connector
   * unauthenticated — which makes the row fixable rather than merely reported.
   *
   * **A live rule is summarised by its trigger**, because that is what
   * distinguishes two rules that both ask an agent for something.
   */
  const rules = $derived(automationsIn(mockWorkbench.project.id).current);

  let search = $state("");
  let selectedId = $state<string | undefined>(undefined);

  /** A dispatch is a fact about this session, not a state of the rule. */
  let dispatched = $state(false);

  const shown = $derived(
    rules.filter((rule: AutomationRow) =>
      rule.name.toLowerCase().includes(search.trim().toLowerCase())
    )
  );

  const inGroup = (group: "not working" | "on" | "off"): readonly AutomationRow[] =>
    shown.filter((rule: AutomationRow) => automationGroup(rule) === group);

  /** What qualifies the rule: the failure, the trigger, or how dormant it is. */
  const qualifier = (rule: AutomationRow): string => {
    const group = automationGroup(rule);
    if (group === "not working") return rule.lastFire.why ?? rule.lastFire.fault ?? "Cannot dispatch";
    if (group === "off") return rule.lastFire.result === "Never" ? "Never fired" : rule.when;
    return rule.when;
  };

  const open = (id: string) => {
    selectedId = id;
    mockWorkbench.inspect("agents.automation", { kind: "automation", id });
  };
</script>

<Panel title="Automations">
  {#snippet actions()}
    <PanelButton
      label="New"
      icon={Plus}
      tone="primary"
      onclick={() =>
        mockWorkbench.inspect("agents.automation", { kind: "automation", id: "new" })}
    />
    <PanelButton
      label="Open"
      icon={FolderOpen}
      disabled={selectedId === undefined}
      title={selectedId === undefined ? "Choose a rule first" : "Open the chosen rule"}
      onclick={() => selectedId && open(selectedId)}
    />
    <PanelButton
      label="Run now"
      icon={Play}
      disabled={selectedId === undefined}
      title={selectedId === undefined
        ? "Choose a rule first"
        : "Dispatches using the saved rule, not an edited one"}
      onclick={() => (dispatched = true)}
    />
    <PanelButton
      label="Duplicate"
      icon={Copy}
      disabled={selectedId === undefined}
      title={selectedId === undefined
        ? "Choose a rule first"
        : "The copy is left off, so it cannot fire before it has been read"}
      onclick={() => selectedId && open(selectedId)}
    />
  {/snippet}

  {#if dispatched}
    <PanelNote>Dispatched using the saved configuration, not an edited one.</PanelNote>
  {/if}

  <PanelSearch
    placeholder="Search Automations"
    matched={shown.length}
    total={rules.length}
    bind:value={search}
    flush
  >
    <PanelSection title="Not working" count={inGroup("not working").length} flush>
      {#each inGroup("not working") as rule (rule.id)}
        <PanelRow
          title={rule.name}
          sub={qualifier(rule)}
          icon={Workflow}
          tone="danger"
          titleTone="danger"
          selected={rule.id === selectedId}
          onselect={() => open(rule.id)}
        />
      {/each}
    </PanelSection>

    <PanelSection title="On" count={inGroup("on").length} flush>
      {#each inGroup("on") as rule (rule.id)}
        <PanelRow
          title={rule.name}
          sub={qualifier(rule)}
          icon={Workflow}
          tone="active"
          selected={rule.id === selectedId}
          onselect={() => open(rule.id)}
        />
      {/each}
    </PanelSection>

    <PanelSection title="Off" count={inGroup("off").length} flush>
      {#each inGroup("off") as rule (rule.id)}
        <PanelRow
          title={rule.name}
          sub={qualifier(rule)}
          icon={Workflow}
          selected={rule.id === selectedId}
          onselect={() => open(rule.id)}
        />
      {/each}
    </PanelSection>
  </PanelSearch>
</Panel>
