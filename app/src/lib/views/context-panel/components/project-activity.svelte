<script lang="ts">
  import type { Tab } from "$model/client";
  import { clientModel } from "$model/client";
  import {
    Panel,
    PanelButton,
    PanelRow,
    PanelSearch,
    PanelSection
  } from "$lib/unique-components/panel";
  import ChevronDown from "@lucide/svelte/icons/chevron-down";
  import FileText from "@lucide/svelte/icons/file-text";
  import Presentation from "@lucide/svelte/icons/presentation";
  import Quote from "@lucide/svelte/icons/quote";
  import Zap from "@lucide/svelte/icons/zap";

  /**
   * What has happened in the project, newest first.
   *
   * The record. Everything an actor did, in order, with no judgment about
   * whether it matters — that judgment is what Mentions and Health are for.
   *
   * The three filters sit in the action row rather than inside the list, because
   * they narrow every section at once.
   */
  let { tab }: { tab: Tab } = $props();

  // svelte-ignore state_referenced_locally
  void tab;

  const { workbench } = clientModel();
  const inspectActivity = () => workbench.inspect("project.activity");
</script>

<Panel title="Activity">
  {#snippet actions()}
    <PanelButton label="Today" icon={ChevronDown} />
    <PanelButton label="Anyone" icon={ChevronDown} />
    <PanelButton label="Any target" icon={ChevronDown} />
  {/snippet}

  <!--
    Two days, one stream: the sections are when, not what, so the filter owns
    both of them.
  -->
  <PanelSearch placeholder="Search activity" matched={4} total={17} flush>
    <PanelSection title="Today" flush>
      <PanelRow
        title="Ana Reyes edited Q3 Resilience Memo"
        meta="4m"
        icon={FileText}
        onselect={inspectActivity}
      />
      <PanelRow
        title="Nightly filing digest started a task"
        meta="3h"
        icon={Zap}
        onselect={inspectActivity}
      />
      <PanelRow
        title="Tomas Kaur created Board Update"
        meta="5h"
        icon={Presentation}
        onselect={inspectActivity}
      />
    </PanelSection>

    <!--
      A day with many events collapses into one digest row rather than a wall.
      What threshold turns a day into a digest is unsettled — see the spec.
    -->
    <PanelSection title="Yesterday · 14 events" open={false} flush>
      <PanelRow
        title="Grid Analyst accepted 6 findings"
        sub="Digest — expand to see each"
        meta="1d"
        icon={Quote}
        onselect={inspectActivity}
      />
    </PanelSection>
  </PanelSearch>
</Panel>
