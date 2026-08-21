<script lang="ts">
  import Bot from "@lucide/svelte/icons/bot";
  import MessagesSquare from "@lucide/svelte/icons/messages-square";

  import { PanelActor, PanelChip, PanelLink } from "$lib/unique-components/panel";
  import {
    ScreenBar,
    ScreenCell,
    ScreenGroup,
    ScreenNote,
    ScreenRow,
    ScreenStat,
    ScreenStats,
    ScreenSurface,
    ScreenTable
  } from "$lib/unique-components/screen";
  import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger
  } from "$lib/simple-components/accordion";
  import {
    automationsIn,
    behaviourOf,
    conversationsBy,
    lookupScopeOf,
    modelBindingOf,
    persona,
    toolsFor,
    workBy,
    type ConversationRow,
    type ToolPermission,
    type WorkItem
  } from "$mock-capabilities/agents";
  import { people } from "$mock-capabilities/project";
  import { mockWorkbench } from "$mock-models/workbench.svelte";

  /**
   * Personas — one persona, entered from Open or Edit.
   *
   * `docs/screen-panel-views/screens/personas/workspace-profile.md` is the
   * specification. A profile, not a form: who it is, then what it has done, then
   * how it is configured — because the record is what tells you whether to trust
   * an agent, and configuration only matters once you do.
   *
   * **The tracks are 3fr and 2fr.** The left column holds the five behaviour
   * sections, which are paragraphs and need a reading measure; the right holds
   * a scope and six tool names, which are one line each. Splitting them evenly
   * would set prose in a half-width column to make room for a list of
   * identifiers.
   *
   * **Behaviour and Context never share a column.** One is text sent on every
   * call and the other is material the agent retrieves — the distinction is the
   * rule this screen keeps, so it is spatial as well as stated: prompt material
   * on the left, retrievable material directly opposite it.
   *
   * **The record leads and includes what failed.** A record that only counts
   * successes is not a record.
   */
  let {
    personaId = "grid-analyst",
    onback = () => {}
  }: {
    personaId?: string;
    onback?: () => void;
  } = $props();

  const profile = $derived(persona(personaId).current);
  const record = $derived(profile.record);
  const sections = $derived(behaviourOf(personaId).current);
  const lookup = $derived(lookupScopeOf(personaId).current);
  const tools = $derived(toolsFor(personaId).current);
  const binding = $derived(modelBindingOf(personaId).current);
  const tasks = $derived(workBy(personaId).current);
  const chats = $derived(conversationsBy(personaId).current);

  const allowed = $derived(tools.filter((tool: ToolPermission) => tool.allowed));
  const web = $derived(tools.find((tool: ToolPermission) => tool.id === "web.search"));

  /** The first section is open; the reader's choice replaces that from then on. */
  let picked = $state<string | undefined>(undefined);
  const openSection = $derived(picked ?? (sections.length > 0 ? sections[0].id : ""));

  /**
   * Who dispatched a piece of work. A person and an Automation are different
   * situations, so the row resolves the name to one of the shared actor lenses
   * rather than printing it.
   */
  type Dispatcher = { kind: "person" | "automation"; id: string; name: string };

  const everyone = $derived(people().current);
  const rules = $derived(automationsIn(mockWorkbench.project.id).current);

  const dispatcherOf = (name: string): Dispatcher => {
    const person = everyone.find((candidate) => candidate.name === name);
    if (person) return { kind: "person", id: person.id, name };
    const rule = rules.find((candidate) => candidate.name === name);
    if (rule) return { kind: "automation", id: rule.id, name };
    return { kind: "person", id: name, name };
  };

  /** A task and a conversation in one shape: both are work this agent did. */
  type Done = {
    id: string;
    title: string;
    startedBy: Dispatcher;
    when: string;
    result: string;
    tone: "neutral" | "active" | "danger";
    /** Plain text where the result is a yield rather than a state. */
    chip: boolean;
    conversation: boolean;
  };

  const RESULT: Record<WorkItem["state"], { word: string; tone: Done["tone"]; chip: boolean }> = {
    running: { word: "Running", tone: "active", chip: true },
    waiting: { word: "Waiting", tone: "active", chip: true },
    failed: { word: "Failed", tone: "danger", chip: true },
    completed: { word: "", tone: "neutral", chip: false }
  };

  const done = $derived<Done[]>([
    ...tasks.map((task: WorkItem): Done => {
      const shape = RESULT[task.state];
      return {
        id: task.id,
        title: task.title,
        startedBy: dispatcherOf(task.startedBy),
        when: task.when,
        result: shape.chip ? `${shape.word} · ${task.detail}` : task.detail,
        tone: shape.tone,
        chip: shape.chip,
        conversation: false
      };
    }),
    ...chats.map(
      (chat: ConversationRow): Done => ({
        id: chat.id,
        title: chat.title,
        startedBy: dispatcherOf(chat.startedBy),
        when: chat.age,
        result: `Conversation · ${chat.turns} turns`,
        tone: "neutral",
        chip: false,
        conversation: true
      })
    )
  ]);

  /** What the record counts, against what this table can list. */
  const recorded = $derived(record.tasks + record.conversations);

  const openActor = (who: Dispatcher) =>
    mockWorkbench.inspect(
      who.kind === "person" ? "collaboration.person" : "agents.automation",
      { kind: who.kind, id: who.id }
    );
</script>

<ScreenSurface wide>
  <div class="board">
    <div class="area-screen-header">
      <ScreenBar title={profile.name} {onback} backLabel="Back to library">
        {#snippet meta()}
          <PanelChip>Saved · revision {profile.revision}</PanelChip>
        {/snippet}
      </ScreenBar>
    </div>

    <!--
      Picture, name, description, and the three facts that qualify everything
      below: where it can be used, what runs it, and how much it may do.
    -->
    <div class="area-profile flex flex-wrap items-start justify-between gap-3">
      <PanelActor name={profile.name} kind="agent" role={profile.describes} size="head" />
      <div class="flex flex-wrap items-center gap-1">
        <PanelChip tone={profile.scope === "Everywhere" ? "accent-1" : "neutral"}>
          {profile.scope}
        </PanelChip>
        <PanelChip>
          <span class="font-mono">{binding.name}</span>
        </PanelChip>
        <PanelChip>{allowed.length} tools</PanelChip>
      </div>
    </div>

    <div class="area-record">
      <ScreenGroup label="Record">
        <ScreenStats label="What this agent has done">
          <ScreenStat value={String(record.tasks)} label="tasks run" />
          <ScreenStat value={String(record.running)} label="running now" />
          <!-- Failed is here on purpose, and is the one figure that is toned. -->
          <ScreenStat
            value={String(record.failed)}
            label="failed"
            tone={record.failed > 0 ? "danger" : "default"}
          />
          <ScreenStat value={String(record.findings)} label="findings accepted" />
        </ScreenStats>
      </ScreenGroup>
    </div>

    <div class="area-how-it-behaves">
      <ScreenGroup label="How it behaves">
        <div class="border-border-subtle rounded-panel border px-3">
          <Accordion
            type="single"
            value={openSection}
            onValueChange={(next: string) => (picked = next)}
          >
            {#each sections as section (section.id)}
              {@const written = section.text !== ""}
              <AccordionItem value={section.id} class="border-border-subtle">
                <AccordionTrigger>
                  <span class="flex flex-wrap items-center gap-2">
                    <span class="text-body-sm text-ink-primary">{section.name}</span>
                    <PanelChip tone={written ? "neutral" : "inactive"}>
                      {written ? "written" : "not written"}
                    </PanelChip>
                  </span>
                </AccordionTrigger>
                <AccordionContent>
                  <div class="flex flex-col gap-1.5">
                    <p class="text-caption text-ink-muted m-0">{section.purpose}</p>
                    {#if written}
                      <p class="text-body-sm text-ink-secondary m-0 max-w-prose">{section.text}</p>
                      <span class="text-caption text-ink-muted tabular-nums">
                        {section.characters} characters, on every call
                      </span>
                    {:else}
                      <p class="text-body-sm text-ink-muted m-0">
                        Empty, and left out of the prompt entirely.
                      </p>
                    {/if}
                    <span class="text-body-sm">
                      <PanelLink
                        label="What this section is for"
                        onselect={() =>
                          mockWorkbench.inspect("agents.behaviour-section", {
                            kind: "behaviour",
                            id: section.id
                          })}
                      />
                    </span>
                  </div>
                </AccordionContent>
              </AccordionItem>
            {/each}
          </Accordion>
        </div>

        <ScreenNote>
          All of it is prompt text and costs context on every call. What it can look things up in
          is separate material, and is beside this rather than under it.
        </ScreenNote>
      </ScreenGroup>
    </div>

    <!--
      Retrievable material, directly opposite the prompt material. The qualifier
      on the scope row is the whole point: a scope is searched, not included.
    -->
    <div class="area-what-it-can-look-up">
      <ScreenGroup label="What it can look up">
        <div class="border-border-subtle rounded-panel flex flex-col overflow-hidden border">
          <button
            type="button"
            class="border-border-subtle hover:bg-surface-panel-hover flex flex-col gap-0.5 border-b px-3 py-2 text-start"
            onclick={() =>
              mockWorkbench.inspect("agents.what-it-can-look-up", {
                kind: "scope",
                id: lookup.id
              })}
          >
            <span class="text-body-sm text-ink-primary">{lookup.name}</span>
            <span class="text-caption text-ink-muted">
              {lookup.contains} resources · not pasted into the prompt
            </span>
          </button>
          <button
            type="button"
            class="hover:bg-surface-panel-hover flex items-center justify-between gap-2 px-3 py-2 text-start"
            onclick={() =>
              mockWorkbench.inspect("agents.tool", { kind: "tool", id: "web.search" })}
          >
            <span class="text-body-sm text-ink-primary">The web</span>
            <PanelChip tone={web?.allowed ? "success" : "inactive"}>
              {web?.allowed ? "Allowed" : "Not allowed"}
            </PanelChip>
          </button>
        </div>
      </ScreenGroup>
    </div>

    <!--
      Allowed and denied in one list, so a denial is a row rather than an
      absence — the refusals are as visible as the grants.
    -->
    <div class="area-what-it-may-do">
      <ScreenGroup label="What it may do">
        <div class="border-border-subtle rounded-panel flex flex-col overflow-hidden border">
          {#each tools as tool (tool.id)}
            <button
              type="button"
              class="border-border-subtle hover:bg-surface-panel-hover flex items-center justify-between gap-2 border-b px-3 py-2 text-start last:border-b-0"
              onclick={() => mockWorkbench.inspect("agents.tool", { kind: "tool", id: tool.id })}
            >
              <span class="text-body-sm text-ink-primary font-mono">{tool.id}</span>
              <PanelChip tone={tool.allowed ? "success" : "inactive"}>
                {tool.allowed ? "Allowed" : "Not allowed"}
              </PanelChip>
            </button>
          {/each}
        </div>
      </ScreenGroup>
    </div>

    <div class="area-everything-it-has-done">
      <ScreenGroup label="Everything it has done" count={`${done.length} of ${recorded}`}>
        <ScreenTable columns={["Task", "Started by", "When", "Result"]}>
          {#each done as row (row.id)}
            <ScreenRow>
              <ScreenCell
                name={row.title}
                icon={row.conversation ? MessagesSquare : Bot}
                onselect={() =>
                  mockWorkbench.inspect("copilot.task", {
                    kind: row.conversation ? "conversation" : "task",
                    id: row.id
                  })}
              />
              <ScreenCell>
                <PanelActor
                  name={row.startedBy.name}
                  kind={row.startedBy.kind}
                  onselect={() => openActor(row.startedBy)}
                />
              </ScreenCell>
              <ScreenCell num>{row.when}</ScreenCell>
              <ScreenCell>
                {#if row.chip}
                  <PanelChip tone={row.tone}>{row.result}</PanelChip>
                {:else}
                  {row.result}
                {/if}
              </ScreenCell>
            </ScreenRow>
          {/each}
        </ScreenTable>

        <ScreenNote>
          Tasks and conversations together, because both are work this agent did. The record above
          counts everything; this lists what the door will hand back.
        </ScreenNote>
      </ScreenGroup>
    </div>
  </div>
</ScreenSurface>

<style>
  /**
   * The specification's layout table, as `grid-template-areas`. Two tracks, 3fr
   * and 2fr: prose on the left and one-line rows on the right.
   *
   * `how-it-behaves` runs down three rows against the right column's one and
   * two, exactly as the table has it — five sections of prompt text are simply
   * taller than a scope and a permission list, and the table at the foot spans
   * both columns because the record in full is the widest thing on the screen.
   */
  .board {
    display: grid;
    gap: calc(var(--token-spacing-unit) * 4);
    grid-template-columns: 3fr 2fr;
    grid-template-areas:
      "screen-header          screen-header"
      "profile                profile"
      "record                 record"
      "how-it-behaves         what-it-can-look-up"
      "how-it-behaves         what-it-may-do"
      "how-it-behaves         what-it-may-do"
      "everything-it-has-done everything-it-has-done"
      "everything-it-has-done everything-it-has-done";
    align-content: start;
  }

  .area-screen-header {
    grid-area: screen-header;
  }
  .area-profile {
    grid-area: profile;
  }
  .area-record {
    grid-area: record;
  }
  .area-how-it-behaves {
    grid-area: how-it-behaves;
    min-width: 0;
  }
  .area-what-it-can-look-up {
    grid-area: what-it-can-look-up;
    min-width: 0;
  }
  .area-what-it-may-do {
    grid-area: what-it-may-do;
    min-width: 0;
  }
  .area-everything-it-has-done {
    grid-area: everything-it-has-done;
    min-width: 0;
  }

  /*
    One column below the width where a 2fr track stops holding a tool name on
    one line. The profile's order is the argument the screen makes — who, then
    what it has done, then how it is set up — so the fallback keeps it.
  */
  @media (max-width: 60rem) {
    .board {
      grid-template-columns: 1fr;
      grid-template-areas:
        "screen-header"
        "profile"
        "record"
        "how-it-behaves"
        "what-it-can-look-up"
        "what-it-may-do"
        "everything-it-has-done";
    }
  }
</style>
