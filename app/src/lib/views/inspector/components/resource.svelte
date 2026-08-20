<script lang="ts">
  import { clientModel } from "$model/client";
  import {
    Panel,
    PanelActions,
    PanelButton,
    PanelCrumbs,
    PanelField,
    PanelFields,
    PanelLink,
    PanelNote,
    PanelRow,
    PanelSection
  } from "$lib/unique-components/panel";
  import ChevronRight from "@lucide/svelte/icons/chevron-right";
  import FlaskConical from "@lucide/svelte/icons/flask-conical";
  import Presentation from "@lucide/svelte/icons/presentation";

  /**
   * Any first-class thing in the project: what it is, who is in it, where it came
   * from, what it touches.
   *
   * Kind-specific detail belongs to the screen that owns the kind. This lens is
   * about identity and relationships, which is what every kind has in common.
   */
  const { workbench } = clientModel();
  const inspectPerson = () => workbench.inspect("actor.person");
</script>

<Panel title="Q3 Resilience Memo">
  {#snippet crumbs()}
    <PanelCrumbs
      trail={[{ label: "Project", key: "project.self" }, { label: "Q3 Resilience Memo" }]}
      onnavigate={(key) => workbench.inspect(key)}
    />
  {/snippet}

  <PanelSection title="Identity">
    <PanelFields>
      <PanelField label="Title" stacked>Q3 Resilience Memo</PanelField>
      <PanelField label="Kind">Document</PanelField>
      <PanelField label="ID" mono>d_7fk2…9aq</PanelField>
    </PanelFields>
    <PanelActions>
      <PanelButton label="Open" icon={ChevronRight} tone="primary" />
      <PanelButton label="Duplicate" />
    </PanelActions>
  </PanelSection>

  <PanelSection title="Editing now">
    <PanelNote>Ana Reyes and Tomas Kaur. Click either to write to them.</PanelNote>
    <PanelActions>
      <PanelButton label="Ana Reyes" tone="ghost" onclick={inspectPerson} />
      <PanelButton label="Tomas Kaur" tone="ghost" onclick={inspectPerson} />
    </PanelActions>
  </PanelSection>

  <PanelSection title="Provenance" open={false}>
    <PanelFields>
      <PanelField label="Created by"><PanelLink label="Ana Reyes" onselect={inspectPerson} /></PanelField>
      <PanelField label="Updated by"><PanelLink label="Ana Reyes" onselect={inspectPerson} /></PanelField>
      <PanelField label="From template">Regulatory filing shell</PanelField>
      <PanelField label="Updated" mono>4 minutes ago</PanelField>
    </PanelFields>
    <PanelNote tone="gap">
      Not every kind stores an updating actor. Updated by falls back to the latest
      attributable Activity, then to an em dash, and never guesses.
    </PanelNote>
  </PanelSection>

  <PanelSection title="Relationships" open={false} flush>
    <PanelRow title="Linked question · Why did Feeder 12 fail twice?" icon={FlaskConical} />
    <PanelRow title="Cited by · Board Update — October" icon={Presentation} />
  </PanelSection>

  <PanelSection title="Actions" open={false}>
    <PanelActions>
      <PanelButton label="Open" />
      <PanelButton label="Duplicate" />
      <PanelButton
        label="Delete"
        tone="danger"
        title="Gated on the same reverse-dependency query as deleting a Context"
      />
    </PanelActions>
  </PanelSection>
</Panel>
