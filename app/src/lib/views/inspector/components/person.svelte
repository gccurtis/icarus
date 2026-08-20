<script lang="ts">
  import { clientModel } from "$model/client";
  import {
    Panel,
    PanelActions,
    PanelButton,
    PanelChip,
    PanelCrumbs,
    PanelField,
    PanelFields,
    PanelNote,
    PanelRow,
    PanelSection
  } from "$lib/unique-components/panel";
  import AtSign from "@lucide/svelte/icons/at-sign";
  import ChartColumn from "@lucide/svelte/icons/chart-column";
  import LayoutTemplate from "@lucide/svelte/icons/layout-template";

  /**
   * A person's profile inside this project, and the one place you can write to
   * them.
   *
   * Reachable from every screen — hovering an avatar names them, clicking opens
   * this — which is why it is not part of any one screen's lenses.
   *
   * **Everything here is scoped to the project you are in**, and the panel says
   * so where it matters. A box with someone's name above it reads as private
   * unless told otherwise, and this one is not.
   */
  const { workbench } = clientModel();
</script>

<Panel title="Mira Jain">
  {#snippet crumbs()}
    <PanelCrumbs
      trail={[{ label: "Project", key: "project.self" }, { label: "Mira Jain" }]}
      onnavigate={(key) => workbench.inspect(key)}
    />
  {/snippet}

  <PanelSection title="Person">
    <PanelFields>
      <PanelField label="Presence">Owner · here now, in Outage Cost Model</PanelField>
      <PanelField label="Email">mira.jain@northwind.example</PanelField>
      <PanelField label="Role"><PanelChip tone="interactive">Owner</PanelChip></PanelField>
      <PanelField label="Member since" mono>12 Mar 2026</PanelField>
    </PanelFields>
  </PanelSection>

  <PanelSection title="Message">
    <PanelActions>
      <PanelButton label="Send" icon={AtSign} tone="primary" disabled title="Blocked: see below" />
    </PanelActions>
    <PanelNote>
      This is a comment in Northwind Grid Resilience addressed to Mira. It is not
      email and not a private inbox — it appears in her Mentions here, and anyone
      in the project can read it.
    </PanelNote>
    <PanelNote tone="gap">
      Every current Comment anchors to a resource, so a project-level comment with
      no anchor has nowhere to live. This section is blocked until it exists.
    </PanelNote>
  </PanelSection>

  <!-- What has passed between the two of you, not their whole activity. -->
  <PanelSection title="Between you" count={2} flush>
    <PanelRow
      title="Mentioned you on Q3 Resilience Memo"
      sub="“@ana can you confirm 1,842,000…”"
      meta="2h"
      icon={AtSign}
      onselect={() => workbench.inspect("project.mention")}
    />
    <PanelRow
      title="Mentioned you in Outage Cost Model, C2"
      sub="“@ana corrected total or the old one?”"
      meta="1d"
      icon={AtSign}
      onselect={() => workbench.inspect("project.mention")}
    />
  </PanelSection>

  <PanelSection title="Recently" count={12} open={false} flush>
    <PanelRow
      title="Created Outage minutes by substation"
      meta="3d"
      icon={ChartColumn}
      onselect={() => workbench.inspect("project.activity")}
    />
    <PanelRow
      title="Edited Regulatory filing shell"
      meta="2w"
      icon={LayoutTemplate}
      onselect={() => workbench.inspect("project.activity")}
    />
  </PanelSection>

  <PanelSection title="Access" open={false}>
    <PanelFields>
      <PanelField label="Can">Create, edit, manage membership, archive</PanelField>
      <PanelField label="Change role">Project settings</PanelField>
    </PanelFields>
    <PanelNote>
      Role changes and removal live in project settings rather than turning this
      panel into membership administration.
    </PanelNote>
  </PanelSection>
</Panel>
