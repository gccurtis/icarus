<script lang="ts">
  import BookOpen from "@lucide/svelte/icons/book-open";
  import ImageIcon from "@lucide/svelte/icons/image";

  import {
    Panel,
    PanelActor,
    PanelButton,
    PanelChoice,
    PanelEditableText,
    PanelField,
    PanelFields,
    PanelNote,
    PanelRow,
    PanelSection
  } from "$authored-components/panel";
  import { Separator } from "$vendored-components/separator";
  import {
    behaviourOf,
    lookupScopeOf,
    modelBindingOf,
    persona,
    toolsFor,
    type BehaviourSection,
    type ToolPermission
  } from "$capabilities/agents";
  import { viewState } from "$model/client/view-state";

  /**
   * A persona: who the agent is, what it has done, and what it may see and do.
   *
   * `docs/screen-panel-views/inspector/agents/persona.md` is the specification.
   * A profile rather than a form — the picture and the name, then the record,
   * then the configuration, because that is the order the questions come in.
   *
   * **Delete is absent rather than drawn and disabled.** Every task and every
   * conversation this persona ran is labelled with its name, so a hard deletion
   * would break those labels, and a disabled button would imply a tombstone
   * policy exists and is merely unmet.
   */
  let { personaId = "grid-analyst" }: { personaId?: string } = $props();

  const view = viewState();

  const profile = $derived(persona(personaId).current);
  const behaviour = $derived(behaviourOf(personaId).current);
  const scope = $derived(lookupScopeOf(personaId).current);
  const tools = $derived(toolsFor(personaId).current);
  const binding = $derived(modelBindingOf(personaId).current);

  /**
   * Every edit is held here rather than written back: the door is a read, and an
   * edit that vanished on the next read would be worse than one that is plainly
   * local.
   */
  let renamed = $state<string | undefined>(undefined);
  let redescribed = $state<string | undefined>(undefined);
  let availableIn = $state<string | undefined>(undefined);

  const name = $derived(renamed ?? profile.name);
  const describes = $derived(redescribed ?? profile.describes);

  const AVAILABLE = [
    { value: "Project", label: "Project" },
    { value: "Shared", label: "Shared" },
    { value: "Personal", label: "Personal" }
  ] as const;

  const written = $derived(behaviour.filter((entry: BehaviourSection) => entry.text.trim() !== ""));

  /** The five names, then how many of them carry anything. */
  const names = $derived(behaviour.map((entry: BehaviourSection) => entry.name).join(" · "));
  const howMany = $derived(
    written.length === behaviour.length
      ? "all five written"
      : `${written.length} of ${behaviour.length} written`
  );

  const allowed = $derived(tools.filter((tool: ToolPermission) => tool.allowed));
</script>

<Panel title={name}>
  <!--
    The head of the lens carries the picture, and no `onselect`: this actor is
    the subject of the panel and cannot be navigated to from inside itself.
  -->
  <PanelActor name={name} kind="agent" role={describes} size="head" />

  <PanelFields>
    <PanelField label="Name" stacked>
      <PanelEditableText label="Name" value={name} onchange={(next: string) => (renamed = next)} />
    </PanelField>
    <PanelField label="Describes" stacked>
      <PanelEditableText
        label="Describes"
        value={describes}
        multiline
        onchange={(next: string) => (redescribed = next)}
      />
    </PanelField>
    <PanelField label="Picture">
      <PanelButton
        label="Choose"
        icon={ImageIcon}
        disabled
        title="There is nowhere to keep an image yet"
      />
    </PanelField>
  </PanelFields>

  <PanelNote tone="gap">
    Where an avatar image is stored is unsettled, and whether a persona can have
    a generated one with it. Initials stand in until it is.
  </PanelNote>

  <!-- Its own block rather than the one above: the gap note there is about the
       picture, and a field between the two would read as belonging to it. -->
  <PanelFields>
    <PanelField label="Available in" stacked>
      <PanelChoice
        label="Available in"
        value={availableIn ?? profile.scope}
        options={AVAILABLE}
        flush
        onchange={(next: string) => (availableIn = next)}
      />
    </PanelField>
  </PanelFields>

  <!-- What it has done, before how it is configured: two personas with similar
       prose are told apart by their record. -->
  <PanelSection title="Record" flush>
    <PanelFields>
      <PanelField label="Tasks" mono>{profile.record.tasks}</PanelField>
      <PanelField label="Findings" mono>{profile.record.findings}</PanelField>
    </PanelFields>
    <PanelNote tone="gap">
      Nothing in the model aggregates per persona. These two numbers are counted
      for this panel, and no other screen can be made to agree with them yet.
    </PanelNote>
  </PanelSection>

  <PanelSection title="Behaviour" flush>
    <PanelFields>
      <PanelField label="Sections" stacked>{names} — {howMany}</PanelField>
    </PanelFields>
    <PanelNote>A summary. The five are read and written in the Behaviour view.</PanelNote>
  </PanelSection>

  <PanelSection title="Can look up" flush>
    <PanelRow
      title={scope.name}
      sub="Everything this agent may search"
      meta={`${scope.contains}`}
      icon={BookOpen}
      onselect={() =>
        view.inspect("agents.what-it-can-look-up", { kind: "persona", id: personaId })}
    />
  </PanelSection>

  <!-- Configuration rather than the reason the panel was opened, so it arrives shut. -->
  <PanelSection title="May do" open={false} flush>
    <PanelFields>
      <PanelField label="Tools">{allowed.length} of {tools.length} allowed</PanelField>
      <PanelField label="Model" mono>{binding.name}</PanelField>
    </PanelFields>
  </PanelSection>

  <!-- Last and separated, and it holds a sentence rather than a control. -->
  <Separator />

  <PanelSection title="Removal" flush>
    <PanelNote>There is no Delete here, and no disabled one either.</PanelNote>
    <PanelNote tone="gap">
      Gated on a dependency and tombstone policy: {profile.record.tasks} tasks and
      {profile.record.conversations} conversations are attributed to this persona
      by name, and hard deletion would break every one of those labels.
    </PanelNote>
  </PanelSection>
</Panel>
