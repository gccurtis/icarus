<script lang="ts">
  import type { Tab } from "$model/client";
  import { clientModel } from "$model/client";
  import {
    Panel,
    PanelButton,
    PanelNote,
    PanelRow,
    PanelSearch,
    PanelSection
  } from "$lib/unique-components/panel";
  import Calendar from "@lucide/svelte/icons/calendar";
  import Database from "@lucide/svelte/icons/database";
  import Plus from "@lucide/svelte/icons/plus";
  import Sigma from "@lucide/svelte/icons/sigma";
  import Type from "@lucide/svelte/icons/type";
  import Wrench from "@lucide/svelte/icons/wrench";

  /**
   * The project's Name Manager: every named table, value and function.
   *
   * Offered on every screen that can hold a formula, because that is where a
   * formula is written. A variable is stored as a *value*, not an expression —
   * what this shows is exactly what a formula will get when it runs, which is
   * why nothing here is ever stale and no section carries a refresh.
   */
  let { tab }: { tab: Tab } = $props();

  // svelte-ignore state_referenced_locally
  void tab;

  const { workbench } = clientModel();
  const inspectVariable = () => workbench.inspect("project.variable");
</script>

<Panel title="Variables">
  <!--
    Making a variable is what this panel is for, so it is the first thing under
    the title rather than the last thing under the list.
  -->
  {#snippet actions()}
    <PanelButton label="New variable" icon={Plus} tone="primary" />
  {/snippet}

  <PanelSearch placeholder="Search variables" matched={7} total={7} flush>
    <PanelSection title="Tables" count={2} flush>
      <PanelRow
        title="outageEvents"
        sub="4,182 rows · 13 fields"
        icon={Database}
        onselect={inspectVariable}
      />
      <PanelRow title="substations" sub="41 rows · 8 fields" icon={Database} onselect={inspectVariable} />
    </PanelSection>

    <PanelSection title="Values" count={3} flush>
      <PanelRow
        title="hardeningBudget"
        sub="number · 46,000,000"
        icon={Sigma}
        onselect={inspectVariable}
      />
      <PanelRow title="filingDeadline" sub="date · 14 Nov 2026" icon={Calendar} onselect={inspectVariable} />
      <PanelRow title="filingParty" sub="text · Northwind Power" icon={Type} onselect={inspectVariable} />
    </PanelSection>

    <PanelSection title="Functions" count={2} flush>
      <PanelRow title="avoidedMinutes(t)" sub="table → table" icon={Wrench} onselect={inspectVariable} />
      <PanelRow title="costPerMinute(t)" sub="table → number" icon={Wrench} onselect={inspectVariable} />
    </PanelSection>
  </PanelSearch>

  <PanelNote>
    Values are stored, not formulas — a formula reads the value when it runs, so
    what you see here is what a formula will get.
  </PanelNote>
</Panel>
