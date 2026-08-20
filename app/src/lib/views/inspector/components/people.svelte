<script lang="ts">
  import { clientModel } from "$model/client";
  import {
    Panel,
    PanelCrumbs,
    PanelNote,
    PanelRow,
    PanelSection
  } from "$lib/unique-components/panel";
  import Eye from "@lucide/svelte/icons/eye";
  import User from "@lucide/svelte/icons/user";

  /**
   * Everybody at once, rather than one person — what you get when you click
   * "+4 more" instead of a face.
   *
   * A roster, not a profile. Every row from here opens the person lens.
   */
  const { workbench } = clientModel();
  const inspectPerson = () => workbench.inspect("actor.person");
</script>

<Panel title="People">
  {#snippet crumbs()}
    <PanelCrumbs
      trail={[{ label: "Project", key: "project.self" }, { label: "People" }]}
      onnavigate={(key) => workbench.inspect(key)}
    />
  {/snippet}

  <PanelSection title="Here now" count={3} flush>
    <PanelRow title="Ana Reyes" sub="Q3 Resilience Memo · you" icon={Eye} onselect={inspectPerson} />
    <PanelRow title="Tomas Kaur" sub="page 3" icon={Eye} onselect={inspectPerson} />
    <PanelRow title="Mira Jain" sub="Outage Cost Model" icon={Eye} onselect={inspectPerson} />
  </PanelSection>

  <PanelSection title="Everyone" count={7} flush>
    <PanelRow title="Ana Reyes" sub="Owner" icon={User} onselect={inspectPerson} />
    <PanelRow title="Mira Jain" sub="Owner" icon={User} onselect={inspectPerson} />
    <PanelRow title="Tomas Kaur" sub="Editor" icon={User} onselect={inspectPerson} />
    <PanelRow title="+4 more" sub="3 editors · 1 viewer" icon={User} onselect={inspectPerson} />
  </PanelSection>

  <PanelSection title="Note">
    <PanelNote tone="gap">
      Presence requires an ephemeral collaboration channel. It is never inferred
      from lastSeenAt and never from Activity — both would report someone as
      present who closed the tab an hour ago.
    </PanelNote>
  </PanelSection>
</Panel>
