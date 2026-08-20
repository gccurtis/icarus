<script lang="ts">
  import type { Tab } from "$model/client";
  import { clientModel } from "$model/client";
  import {
    Panel,
    PanelButton,
    PanelNote,
    PanelRow,
    PanelSection
  } from "$lib/unique-components/panel";
  import CircleCheck from "@lucide/svelte/icons/circle-check";
  import Clock from "@lucide/svelte/icons/clock";
  import Sparkles from "@lucide/svelte/icons/sparkles";
  import TriangleAlert from "@lucide/svelte/icons/triangle-alert";
  import User from "@lucide/svelte/icons/user";

  /**
   * Agent work in this project, grouped by state.
   *
   * The same rows the Copilot shows, at project scope rather than in the bar,
   * and every one of them opens the shared task lens. The order is by what needs
   * you first, not by time.
   */
  let { tab }: { tab: Tab } = $props();

  // svelte-ignore state_referenced_locally
  void tab;

  const { workbench } = clientModel();
  const inspectTask = () => workbench.inspect("copilot.task");
</script>

<Panel title="Tasks">
  {#snippet actions()}
    <PanelButton label="Manage Personas" icon={User} />
  {/snippet}

  <PanelSection title="Waiting" count={1} flush>
    <PanelRow
      title="Confirm filing deadline"
      sub="Filing Editor · waiting"
      icon={Clock}
      tone="attention"
      onselect={inspectTask}
    />
  </PanelSection>

  <PanelSection title="Running" count={1} flush>
    <PanelRow
      title="Summarise overnight outage reports"
      sub="Grid Analyst · step 3 of 5"
      icon={Sparkles}
      tone="active"
      onselect={inspectTask}
    />
  </PanelSection>

  <PanelSection title="Failed" count={1} flush>
    <PanelRow
      title="Rebuild substation crosswalk"
      sub="Grid Analyst · tool error"
      icon={TriangleAlert}
      tone="danger"
      onselect={inspectTask}
    />
  </PanelSection>

  <PanelSection title="Recently completed" count={2} open={false} flush>
    <PanelRow
      title="Extract 2024 storm precedents"
      meta="2h"
      icon={CircleCheck}
      tone="success"
      onselect={inspectTask}
    />
    <PanelRow
      title="Draft board talking points"
      meta="1d"
      icon={CircleCheck}
      tone="success"
      onselect={inspectTask}
    />
  </PanelSection>

  <PanelNote tone="gap">
    An unqualified <code>waiting</code> status says only Waiting. No Reply or Resume
    until the task model records why it is blocked.
  </PanelNote>
</Panel>
