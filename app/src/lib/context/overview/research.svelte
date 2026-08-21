<script lang="ts">
  import Globe from "@lucide/svelte/icons/globe";
  import Plus from "@lucide/svelte/icons/plus";
  import Search from "@lucide/svelte/icons/search";

  import {
    Panel,
    PanelActor,
    PanelButton,
    PanelEditableText,
    PanelField,
    PanelFields,
    PanelLink,
    PanelNote,
    PanelRow,
    PanelSection
  } from "$lib/unique-components/panel";
  import { persona } from "$mock-capabilities/agents";
  import { PEOPLE } from "$mock-capabilities/cast";
  import { searchScope, thread } from "$mock-capabilities/research";
  import { mockWorkbench } from "$mock-models/workbench.svelte";

  /**
   * The thread: what it is for, who is asking, what it can see, what it has
   * produced.
   *
   * `docs/screen-panel-views/context/overview/research.md` is the specification.
   * The first rail entry and the default, so it answers "what is this line of
   * enquiry" before you read any single turn.
   *
   * **The agent is the thread's, not the turn's.** There is no per-turn switch,
   * and the section says so — which is also why the Copilot is off on this
   * screen: the thread already is a conversation with an agent.
   */
  let { threadId = "th-feeder" }: { threadId?: string } = $props();

  const it = $derived(thread(threadId).current);
  const asking = $derived(persona(it.agent).current);
  const scope = $derived(searchScope(threadId).current);

  let titleDraft = $state("");

  const author = $derived(PEOPLE.find((person) => person.name === it.createdBy));
</script>

<Panel title="Overview">
  {#snippet actions()}
    <!-- A new enquiry starts from the thread library, where the existing ones are. -->
    <PanelButton
      label="New thread"
      icon={Plus}
      tone="primary"
      onclick={() => mockWorkbench.selectContext("threads")}
    />
  {/snippet}

  <PanelFields>
    <PanelField label="Title" stacked>
      <PanelEditableText
        value={titleDraft || it.title}
        label="Thread title"
        onchange={(next: string) => (titleDraft = next)}
      />
    </PanelField>
    <PanelField label="Job">{it.job}</PanelField>
    {#if it.anchor}
      <PanelField label="Anchored to" stacked>
        <PanelLink
          label="{it.anchor.ref} · {it.anchor.text}"
          title="Open what this thread is anchored to"
          onselect={() =>
            mockWorkbench.inspect(
              it.mode === "Hypothesis" ? "research.hypothesis" : "research.question",
              { kind: it.mode.toLowerCase(), id: it.anchor?.ref ?? "" }
            )}
        />
      </PanelField>
    {/if}
    <PanelField label="Turns" mono>{it.turns}</PanelField>
  </PanelFields>

  <PanelSection title="Asking">
    <PanelActor
      name={asking.name}
      kind="agent"
      role={asking.describes}
      onselect={() =>
        mockWorkbench.inspect("agents.persona", { kind: "persona", id: asking.id })}
    />
    <PanelNote>
      Set once for the whole thread — there is no per-turn switch. The Copilot is
      off on this screen because this is already a conversation with an agent.
    </PanelNote>
  </PanelSection>

  <PanelSection title="Looking in" flush>
    <PanelRow
      title={scope.name}
      sub="{scope.indexed} of {scope.resources} retrievable"
      meta={String(scope.resources)}
      icon={Search}
      onselect={() => mockWorkbench.selectContext("context")}
    />
    {#if scope.web}
      <PanelRow
        title="The web"
        sub="Used when a turn asks for it"
        icon={Globe}
        tone="intelligence"
      />
    {/if}
  </PanelSection>

  <!-- What a thread is for, so it is a section rather than a footnote. -->
  <PanelSection title="Produced">
    <PanelFields>
      <PanelField label="Accepted" mono>{it.accepted}</PanelField>
      <PanelField label="Proposed" mono>{it.proposed}</PanelField>
      <PanelField label="Sources used" mono>{it.sources}</PanelField>
    </PanelFields>
    <PanelNote tone="gap">
      A proposed finding has no state in the model. Proposed, accepted and
      dismissed must exist before this count can be real.
    </PanelNote>
  </PanelSection>

  <PanelSection title="Attribution" open={false}>
    <PanelFields>
      <PanelField label="Started by">
        {#if author}
          <PanelLink
            label={it.createdBy}
            title="{it.createdBy} — person"
            onselect={() =>
              mockWorkbench.inspect("collaboration.person", { kind: "person", id: author.id })}
          />
        {:else}
          {it.createdBy}
        {/if}
      </PanelField>
      <PanelField label="Updated" mono>{it.updated}</PanelField>
    </PanelFields>
  </PanelSection>
</Panel>
