<script lang="ts">
  import type { Tab } from "$model/client";
  import { clientModel } from "$model/client";
  import {
    Panel,
    PanelNote,
    PanelRow,
    PanelSearch,
    PanelSection
  } from "$lib/unique-components/panel";
  import Eye from "@lucide/svelte/icons/eye";
  import Link2 from "@lucide/svelte/icons/link-2";
  import Sparkles from "@lucide/svelte/icons/sparkles";
  import User from "@lucide/svelte/icons/user";
  import Zap from "@lucide/svelte/icons/zap";

  /**
   * Everything that can appear as "who did this".
   *
   * A person, an agent, an Automation and a connector are all actors and all
   * inspectable. Only a person can be written to, which the panel says at the
   * foot rather than leaving to be discovered.
   */
  let { tab }: { tab: Tab } = $props();

  // svelte-ignore state_referenced_locally
  void tab;

  const { workbench } = clientModel();
  const inspectPerson = () => workbench.inspect("actor.person");

  const EVERYONE = [
    { name: "Ana Reyes", role: "Owner" },
    { name: "Mira Jain", role: "Owner" },
    { name: "Tomas Kaur", role: "Editor" },
    { name: "Devi Rao", role: "Editor" },
    { name: "Sam Oyelaran", role: "Editor" },
    { name: "Priya Nandi", role: "Editor" },
    { name: "Jon Alder", role: "Viewer" }
  ];
</script>

<Panel title="People">
  <!--
    The three sections are kinds of actor, not three subjects, so one filter
    owns all of them. The note stays outside: it is the panel speaking about the
    list rather than a part of the list, and filtering must never hide it.
  -->
  <PanelSearch placeholder="Search people" matched={14} total={14} flush>
    <PanelSection title="Here now" count={3} flush>
      <PanelRow title="Ana Reyes" sub="Q3 Resilience Memo · you" icon={Eye} onselect={inspectPerson} />
      <PanelRow title="Tomas Kaur" sub="Q3 Resilience Memo · page 3" icon={Eye} onselect={inspectPerson} />
      <PanelRow title="Mira Jain" sub="Outage Cost Model" icon={Eye} onselect={inspectPerson} />
    </PanelSection>

    <PanelSection title="Everyone" count={7} flush>
      {#each EVERYONE as person (person.name)}
        <PanelRow title={person.name} sub={person.role} icon={User} onselect={inspectPerson} />
      {/each}
    </PanelSection>

    <!--
      The non-human actors, in one section because they share the property of
      being able to act without a person present.
    -->
    <PanelSection title="Agents and machinery" count={4} flush>
      <PanelRow title="Grid Analyst" sub="Persona · 41 tasks" icon={Sparkles} tone="intelligence" />
      <PanelRow title="Filing Editor" sub="Persona · 18 tasks" icon={Sparkles} tone="intelligence" />
      <PanelRow title="Nightly filing digest" sub="Automation" icon={Zap} />
      <PanelRow title="SharePoint — Ops Reports" sub="Connector" icon={Link2} />
    </PanelSection>
  </PanelSearch>

  <PanelNote>
    Anything that can appear as “who did this” is here and can be inspected. Only
    a person can be written to.
  </PanelNote>
</Panel>
