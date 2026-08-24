<script lang="ts">
  import ArrowUpRight from "@lucide/svelte/icons/arrow-up-right";

  import {
    Panel,
    PanelActor,
    PanelButton,
    PanelChoice,
    PanelCrumbs,
    PanelEditableText,
    PanelField,
    PanelFields,
    PanelNote,
    PanelSection
  } from "$lib/unique-components/panel";
  import { AGENTS, actorName } from "$mock-capabilities/cast";
  import { project } from "$mock-capabilities/project";
  import { searchScope, thread, type ThreadMode } from "$mock-capabilities/research";
  import { isInspectionKey, viewState } from "$model/client/view-state";

  /**
   * The line of enquiry itself: its job, its agent, its scope.
   *
   * `docs/screen-panel-views/inspector/research/thread.md` is the specification.
   * Three things define what kind of enquiry a thread is — the mode, the anchor
   * it answers to, and how many turns it has taken — and they sit above the
   * agent, because the agent is how the job gets done rather than what the job
   * is.
   *
   * **The agent is set once, for the whole thread.** There is no per-turn
   * persona switch and the section says so, because an absence nobody names
   * reads as an omission.
   *
   * **Open is in the action row.** This lens is reached from the map of threads
   * and from anything that cites one, and a description of a line of enquiry
   * with no way onto it is a dead end.
   */
  let { threadId = "th-feeder" }: { threadId?: string } = $props();

  const view = viewState();

  const record = $derived(thread(threadId).current);
  const scope = $derived(searchScope(threadId).current);
  const persona = $derived(AGENTS.find((candidate) => candidate.id === record.agent));

  /** Edited in place: the title is the only thing here a reader changes by typing. */
  let renamed = $state<string | undefined>(undefined);
  const title = $derived(renamed ?? record.title);

  let mode = $state<ThreadMode | undefined>(undefined);
  const chosenMode = $derived(mode ?? record.mode);

  const MODES = [
    { value: "Discover", label: "Discover" },
    { value: "Question", label: "Question" },
    { value: "Hypothesis", label: "Hypothesis" }
  ] as const;
</script>

<Panel title={title}>
  {#snippet crumbs()}
    <PanelCrumbs
      trail={[{ label: project().current.name, key: "project.project" }, { label: title }]}
      onnavigate={(key) => {
        if (isInspectionKey(key)) view.inspect(key, { kind: "project", id: view.project });
      }}
    />
  {/snippet}

  {#snippet actions()}
    <!-- A thread is a tab keyed by itself, so this mints one or activates the one already open. -->
    <PanelButton
      label="Open thread"
      icon={ArrowUpRight}
      tone="primary"
      onclick={() => view.open({ screen: "research", resourceId: threadId })}
    />
  {/snippet}

  <PanelSection title="Thread" flush>
    <PanelFields>
      <PanelField label="Title" stacked>
        <PanelEditableText label="Title" value={title} onchange={(next) => (renamed = next)} />
      </PanelField>
    </PanelFields>

    <!--
      The three jobs, shown rather than hidden: which one this is is the first
      thing a reader wants, and a trigger would cost a click to say it.
    -->
    <PanelChoice
      label="Mode"
      value={chosenMode}
      options={MODES}
      onchange={(next) => (mode = next as ThreadMode)}
    />

    <PanelFields>
      {#if record.anchor}
        <PanelField label="Anchor" mono>{record.anchor.ref}</PanelField>
      {/if}
      <PanelField label="Turns" mono>{record.turns}</PanelField>
    </PanelFields>

    <PanelNote tone="gap">
      Whether the mode can change once turns exist is unsettled. A Discover
      thread that becomes a Question thread has to acquire an anchor from
      somewhere.
    </PanelNote>
  </PanelSection>

  <PanelSection title="Agent" flush>
    <PanelFields>
      <PanelField label="Runs as" stacked>
        <PanelActor
          name={actorName(record.agent)}
          kind="agent"
          role={persona?.purpose}
          onselect={() =>
            view.inspect("agents.persona", { kind: "agent", id: record.agent })}
        />
      </PanelField>

      <!-- What it can look up, and what it may do. Both are the thread's, not the turn's. -->
      <PanelField label="Scope">{scope.name} · {scope.resources}</PanelField>
      <PanelField label="Web">{scope.web ? "on" : "off"}</PanelField>
      <PanelField label="Tools">{record.toolsAllowed} allowed</PanelField>
    </PanelFields>

    {#if scope.unbounded}
      <PanelNote tone="gap">
        The set resolves to nothing, so this thread searches everything. An
        unbounded scope is the one that never announces itself.
      </PanelNote>
    {/if}

    <PanelNote>
      Every turn in the thread runs as this agent. There is no per-message
      persona switch.
    </PanelNote>
  </PanelSection>

  <PanelNote>
    Research has no Copilot dock. The whole screen is the conversation, so a
    second composer floating over it would be two ways to say the same thing.
  </PanelNote>
</Panel>
