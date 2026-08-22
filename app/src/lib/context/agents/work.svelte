<script lang="ts">
  import CircleCheck from "@lucide/svelte/icons/circle-check";
  import LoaderCircle from "@lucide/svelte/icons/loader-circle";
  import MessageSquare from "@lucide/svelte/icons/message-square";
  import ShieldCheck from "@lucide/svelte/icons/shield-check";
  import TriangleAlert from "@lucide/svelte/icons/triangle-alert";

  import {
    Panel,
    PanelActions,
    PanelButton,
    PanelNote,
    PanelRow,
    PanelSection
  } from "$lib/unique-components/panel";
  import {
    conversationsBy,
    persona,
    workBy,
    type WorkItem
  } from "$mock-capabilities/agents";
  import { viewState } from "$model/client/view-state";

  const view = viewState();

  /**
   * Everything this agent has done here, by state.
   *
   * `docs/screen-panel-views/context/agents/work.md` is the specification. It is
   * a panel of its own rather than a band on the profile, because what an agent
   * has done is the main evidence about it.
   *
   * **Waiting sits in Running.** A task that is blocked on an input has been
   * dispatched and has not finished, which is the same situation for the person
   * reading this; only the tone separates them.
   *
   * **The sections list what this door holds and count against the record.**
   * A completed list of three under a heading reading 38 is a sample saying so,
   * which is the matched-of-total rule everywhere else in the panel vocabulary.
   */
  let { personaId = "grid-analyst" }: { personaId?: string } = $props();

  const work = $derived(workBy(personaId).current);
  const chats = $derived(conversationsBy(personaId).current);
  const record = $derived(persona(personaId).current.record);

  const running = $derived(
    work.filter((item: WorkItem) => item.state === "running" || item.state === "waiting")
  );
  const failed = $derived(work.filter((item: WorkItem) => item.state === "failed"));
  const completed = $derived(work.filter((item: WorkItem) => item.state === "completed"));

  const counted = (listed: number, total: number): number | string =>
    listed === total ? listed : `${listed} of ${total}`;

  /**
   * A tool that is not permitted is a configuration failure rather than a
   * runtime one, so the section offers the fix instead of a re-run.
   */
  const permissionFailure = $derived(
    failed.some((item: WorkItem) => item.detail.startsWith("Tool not permitted"))
  );

  const openTask = (id: string) => view.inspect("copilot.task", { kind: "task", id });
</script>

<Panel title="Work">
  <PanelSection title="Running" count={counted(running.length, record.running)} flush>
    {#each running as item (item.id)}
      <!-- What started it is on the row: a task the agent began and a task an
           Automation dispatched are different situations. -->
      <PanelRow
        title={item.title}
        sub="{item.detail} · from {item.startedBy}"
        meta={item.when}
        icon={LoaderCircle}
        tone={item.state === "waiting" ? "attention" : "active"}
        onselect={() => openTask(item.id)}
      />
    {/each}
  </PanelSection>

  <PanelSection title="Failed" count={counted(failed.length, record.failed)} flush>
    {#each failed as item (item.id)}
      <PanelRow
        title={item.title}
        sub={item.detail}
        meta={item.when}
        icon={TriangleAlert}
        tone="danger"
        titleTone="danger"
        onselect={() => openTask(item.id)}
      />
    {/each}

    {#if permissionFailure}
      <PanelNote>
        A tool that is not permitted is fixed in Tools, two rail entries away.
        Re-running the task changes nothing until it is.
      </PanelNote>
      <PanelActions>
        <PanelButton
          label="Open Tools"
          icon={ShieldCheck}
          onclick={() => view.selectContext("agents.tools")}
        />
      </PanelActions>
    {/if}
  </PanelSection>

  <PanelSection title="Completed" count={counted(completed.length, record.completed)} flush>
    {#each completed as item (item.id)}
      <PanelRow
        title={item.title}
        sub={item.detail}
        meta={item.when}
        icon={CircleCheck}
        tone="success"
        onselect={() => openTask(item.id)}
      />
    {/each}
  </PanelSection>

  <!--
    Threads sit beside tasks because both are work this agent did. Shut on
    arrival: the question that brings someone here is what ran, not what was
    discussed.
  -->
  <PanelSection
    title="Conversations"
    count={counted(chats.length, record.conversations)}
    open={false}
    flush
  >
    {#each chats as chat (chat.id)}
      <PanelRow
        title={chat.title}
        sub="{chat.turns} turns · from {chat.startedBy}"
        meta={chat.age}
        icon={MessageSquare}
        onselect={() =>
          view.inspect("copilot.conversation", { kind: "conversation", id: chat.id })}
      />
    {/each}
  </PanelSection>
</Panel>
