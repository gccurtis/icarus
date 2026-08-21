<script lang="ts">
  import CircleAlert from "@lucide/svelte/icons/circle-alert";
  import CircleCheck from "@lucide/svelte/icons/circle-check";
  import Clock from "@lucide/svelte/icons/clock";
  import Loader from "@lucide/svelte/icons/loader";
  import MessageSquare from "@lucide/svelte/icons/message-square";

  import {
    Panel,
    PanelNote,
    PanelRow,
    PanelSearch,
    PanelSection
  } from "$lib/unique-components/panel";
  import { actorName } from "$mock-capabilities/cast";
  import {
    conversationsIn,
    tasksIn,
    type TaskState,
    type TaskSummary
  } from "$mock-capabilities/copilot";
  import { mockWorkbench } from "$mock-models/workbench.svelte";

  /**
   * The Copilot, opened — everything in flight and everything recent, in one list.
   *
   * `docs/screen-panel-views/inspector/copilot/home.md` is the specification. The
   * Copilot rises out of the middle of the status bar and takes the inspector over
   * while it is open; this is what the inspector shows until something inside it is
   * picked.
   *
   * **The order is by what needs you, not by time.** What has stopped, what is
   * broken, what is moving, what you were talking about, what is finished. Every
   * state is carried by an icon *and* by the words on the row, never by colour
   * alone.
   *
   * **The search contains the sections rather than sitting above them**, so what it
   * filters is answered by the markup: all five bands are inside it, and a band
   * that matches nothing while a query is typed goes quiet rather than repeating
   * the panel's own "nothing matches".
   */
  const projectId = $derived(mockWorkbench.project.id);

  const waiting = $derived(tasksIn(projectId, "waiting").current);
  const broken = $derived(tasksIn(projectId, "failed").current);
  const running = $derived(tasksIn(projectId, "running").current);
  const finished = $derived(tasksIn(projectId, "completed").current);
  const chats = $derived(conversationsIn(projectId).current);

  let search = $state("");

  const query = $derived(search.trim().toLowerCase());

  const matches = (...fields: readonly string[]): boolean =>
    query === "" || fields.some((field: string) => field.toLowerCase().includes(query));

  const shownTasks = (band: readonly TaskSummary[]): readonly TaskSummary[] =>
    band.filter((task: TaskSummary) => matches(task.title, actorName(task.agent), task.detail));

  const shownChats = $derived(chats.filter((chat) => matches(chat.title, actorName(chat.agent))));

  const total = $derived(
    waiting.length + broken.length + running.length + finished.length + chats.length
  );

  const matched = $derived(
    shownTasks(waiting).length +
      shownTasks(broken).length +
      shownTasks(running).length +
      shownTasks(finished).length +
      shownChats.length
  );

  const ICON = {
    waiting: Clock,
    running: Loader,
    failed: CircleAlert,
    completed: CircleCheck
  };

  const TONE = {
    waiting: "attention",
    running: "active",
    failed: "danger",
    completed: "success"
  } as const;
</script>

{#snippet band(
  title: string,
  state: TaskState,
  rows: readonly TaskSummary[],
  empty: string,
  open: boolean
)}
  <PanelSection {title} count={rows.length} {open} flush>
    <!--
      A done row carries no agent line: finished work says what it was and when,
      and nothing about who is still on it.
    -->
    {#each rows as task (task.id)}
      <PanelRow
        title={task.title}
        sub={state === "completed" ? undefined : `${actorName(task.agent)} · ${task.detail}`}
        meta={task.age}
        icon={ICON[state]}
        tone={TONE[state]}
        onselect={() => mockWorkbench.inspect("copilot.task", { kind: "task", id: task.id })}
      />
    {/each}

    <!-- Only when nothing is being searched for: under a query, `PanelSearch` says it once for the whole panel. -->
    {#if rows.length === 0 && query === ""}
      <PanelNote>{empty}</PanelNote>
    {/if}
  </PanelSection>
{/snippet}

<Panel title="Copilot">
  <PanelSearch
    placeholder="Search conversations and tasks"
    {matched}
    {total}
    empty="No conversation or task by that name."
    bind:value={search}
    flush
  >
    {@render band("Waiting", "waiting", shownTasks(waiting), "Nothing is waiting on you.", true)}
    {@render band("Not working", "failed", shownTasks(broken), "Nothing has failed.", true)}
    {@render band("Running", "running", shownTasks(running), "Nothing is running.", true)}

    <PanelSection title="Recent conversations" count={shownChats.length} flush>
      {#each shownChats as chat (chat.id)}
        <PanelRow
          title={chat.title}
          sub={actorName(chat.agent)}
          meta={chat.lastActive}
          icon={MessageSquare}
          onselect={() =>
            mockWorkbench.inspect("copilot.conversation", { kind: "conversation", id: chat.id })}
        />
      {/each}

      {#if shownChats.length === 0 && query === ""}
        <PanelNote>You have not talked to an agent here yet.</PanelNote>
      {/if}
    </PanelSection>

    <!-- Shut, because finished work is reference rather than attention. -->
    {@render band("Done", "completed", shownTasks(finished), "Nothing finished recently.", false)}
  </PanelSearch>
</Panel>
