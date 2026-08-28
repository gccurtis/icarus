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
  } from "$components/authored/panel";
  import {
    AGENTS,
    PEOPLE,
    type Agent,
    type Person,
    type ResourceKind
  } from "$capabilities/cast";
  import { connectors, recentItem, type ConnectorRow } from "$capabilities/library";
  import { openingFor } from "$capabilities/opening";
  import { isInspectionKey, viewState } from "$model/client/view-state";

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

  const view = viewState();

  const item = $derived(recentItem(resourceId).current);

  /**
   * Open means the thing itself. Where each kind goes is
   * [`openingFor`](../../mock-capabilities/opening.ts)'s to answer; nothing means
   * no screen holds it, which for a recent entry cannot happen — every kind that
   * reaches this list is one a screen shows.
   */
  const open = () => {
    const target = openingFor(item.kind as ResourceKind, item.id, item.title);
    if (target) view.open(target);
  };

  /**
   * Who touched it last, resolved to something inspectable. The record carries a
   * name, and a name is all three kinds of actor at once — a person, an agent,
   * or the connector that delivered the file — so the cast decides which.
   */
  const actor = $derived.by(() => {
    const person = PEOPLE.find((candidate: Person) => candidate.name === item.updatedBy);
    if (person) return { kind: "person" as const, lens: "collaboration.person" as const, id: person.id };

    const agent = AGENTS.find((candidate: Agent) => candidate.name === item.updatedBy);
    if (agent) return { kind: "agent" as const, lens: "agents.persona" as const, id: agent.id };

    const connector = connectors().current.find(
      (candidate: ConnectorRow) => candidate.name === item.updatedBy
    );
    return {
      kind: "connector" as const,
      lens: "library.connect" as const,
      id: connector?.id ?? item.updatedBy
    };
  });
</script>

<Panel title={item.title}>
  {#snippet crumbs()}
    <PanelCrumbs
      trail={[{ label: "New tab" }, { label: "Recent" }, { label: item.title }]}
      onnavigate={(key: string) => {
        if (isInspectionKey(key)) view.inspect(key);
      }}
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
          onselect={() => view.inspect(actor.lens, { kind: actor.kind, id: actor.id })}
        />
      </PanelField>
    </PanelFields>
  </PanelSection>

  <PanelSection title="Open" flush>
    <PanelActions>
      <PanelButton
        label="Open"
        icon={ArrowUpRight}
        tone="primary"
        onclick={open}
      />
    </PanelActions>
    <PanelNote>{item.openNote}</PanelNote>
  </PanelSection>
</Panel>
