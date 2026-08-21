<script lang="ts">
  import ArrowUpRight from "@lucide/svelte/icons/arrow-up-right";

  import {
    Panel,
    PanelActions,
    PanelActor,
    PanelButton,
    PanelCrumbs,
    PanelField,
    PanelFields,
    PanelNote,
    PanelSection
  } from "$lib/unique-components/panel";
  import { AGENTS, PEOPLE, type Agent, type Person } from "$mock-capabilities/cast";
  import { connectors, recentItem, type ConnectorRow } from "$mock-capabilities/library";
  import { mockWorkbench } from "$mock-models/workbench.svelte";

  /**
   * Something that already exists, and the way to open it.
   *
   * `docs/screen-panel-views/inspector/library/recent-item.md` is the
   * specification. The only lens in the launcher whose subject is real: the
   * other New Tab lenses describe a thing that does not exist yet, and this one
   * describes a thing that does.
   *
   * **Open is inert.** Deduping against open tabs, transferring the draft and
   * closing the launcher is one atomic step in the tab model, which no door here
   * has — so the sentence under the button is what carries the promise.
   */
  let { resourceId = "r-memo" }: { resourceId?: string } = $props();

  const item = $derived(recentItem(resourceId).current);

  /**
   * Who touched it last, resolved to something inspectable. The record carries a
   * name, and a name is all three kinds of actor at once — a person, an agent,
   * or the connector that delivered the file — so the cast decides which.
   */
  const actor = $derived.by(() => {
    const person = PEOPLE.find((candidate: Person) => candidate.name === item.updatedBy);
    if (person) return { kind: "person" as const, lens: "collaboration.person", id: person.id };

    const agent = AGENTS.find((candidate: Agent) => candidate.name === item.updatedBy);
    if (agent) return { kind: "agent" as const, lens: "agents.persona", id: agent.id };

    const connector = connectors().current.find(
      (candidate: ConnectorRow) => candidate.name === item.updatedBy
    );
    return {
      kind: "connector" as const,
      lens: "library.connect",
      id: connector?.id ?? item.updatedBy
    };
  });
</script>

<Panel title={item.title}>
  {#snippet crumbs()}
    <PanelCrumbs
      trail={[{ label: "New tab" }, { label: "Recent" }, { label: item.title }]}
      onnavigate={(key: string) => mockWorkbench.inspect(key)}
    />
  {/snippet}

  <PanelSection title="Identity" flush>
    <PanelFields>
      <PanelField label="Title" stacked>{item.title}</PanelField>
      <PanelField label="Kind">{item.kind}</PanelField>
      <PanelField label="Updated">{item.updated}</PanelField>
      <PanelField label="Updated by">
        <PanelActor
          name={item.updatedBy}
          kind={actor.kind}
          onselect={() => mockWorkbench.inspect(actor.lens, { kind: actor.kind, id: actor.id })}
        />
      </PanelField>
    </PanelFields>
  </PanelSection>

  <PanelSection title="Open" flush>
    <PanelActions>
      <PanelButton label="Open" icon={ArrowUpRight} tone="primary" />
    </PanelActions>
    <PanelNote>{item.openNote}</PanelNote>
  </PanelSection>
</Panel>
