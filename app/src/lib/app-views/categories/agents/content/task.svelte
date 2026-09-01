<script lang="ts">
  import Bot from "@lucide/svelte/icons/bot";
  import Boxes from "@lucide/svelte/icons/boxes";
  import User from "@lucide/svelte/icons/user";

  import { PanelActor, PanelChip } from "$authored-components/panel";
  import {
    ScreenBar,
    ScreenComposer,
    ScreenEmpty,
    ScreenGroup,
    ScreenItem,
    ScreenList,
    ScreenNote,
    ScreenStat,
    ScreenStats,
    ScreenSurface
  } from "$authored-components/screen";
  import {
    chatIn,
    personasIn,
    resultsOf,
    task as taskDoor,
    type PersonaRow,
    type TaskRow,
    type TaskTurn
  } from "$capabilities/agents";
  import { workspaceState } from "$model/client/workspace-state";

  const view = workspaceState();

  /**
   * One agentic task: what it was asked, how it is going, and how to steer it.
   *
   * **The prompt is on the screen, in full.** A task is only judgeable against
   * what it was actually told, and putting that behind a lens makes every reading
   * of the results a guess. The row's title is this sentence shortened; here it
   * is the sentence.
   *
   * **Configuration left, progress right.** What it was told does not change
   * while it runs; what it has produced changes every minute. Reading down the
   * right-hand column is the thing someone does repeatedly, so it is the column
   * that stays put.
   *
   * **The chat steers rather than converses.** Its turns are interleaved with the
   * agent's own progress notes, because "I stopped because the table changed
   * shape" and "then draft around it" are one conversation.
   */
  const id = $derived(view.active.focus ?? "t-feeder12");

  const it = $derived(taskDoor(id).current);
  const results = $derived(resultsOf(id).current);
  const chat = $derived(chatIn(id).current);
  const personas = $derived(personasIn(view.project).current);

  const persona = $derived(personas.find((row: PersonaRow) => row.id === it.persona));

  const STATE_TONE: Record<TaskRow["state"], "neutral" | "success" | "danger" | "attention"> = {
    running: "attention",
    waiting: "neutral",
    completed: "success",
    failed: "danger"
  };

  const running = $derived(it.state === "running" || it.state === "waiting");

  let message = $state("");

  /**
   * Steering is recorded locally and nothing is dispatched.
   *
   * There is no agent capability, so a turn produces no reply. Saying so in the
   * transcript is better than an input that swallows what was typed.
   */
  let sent = $state<TaskTurn[]>([]);

  const turns = $derived([...chat, ...sent]);

  const send = (text: string) => {
    sent = [...sent, { id: `local-${sent.length}`, from: "you", text, at: "just now" }];
    message = "";
  };
</script>

<ScreenSurface wide>
  <div class="board">
    <div class="area-bar">
      <ScreenBar
        title={it.title}
        backLabel="All agents"
        onback={() => view.showSubscreen("library")}
      >
        {#snippet meta()}
          <PanelChip tone={STATE_TONE[it.state]}>{it.state}</PanelChip>
          {#if it.firedBy}
            <PanelChip tone="accent-1">Automation</PanelChip>
          {/if}
        {/snippet}
      </ScreenBar>
    </div>

    <div class="area-overview flex flex-col gap-3">
      <!--
        What it was asked, verbatim. Quoted rather than paraphrased: the whole
        point of showing it is that it is the thing the results are judged against.
      -->
      <blockquote
        class="border-border-strong text-body text-ink-primary m-0 border-s-2 ps-3 leading-relaxed"
      >
        {it.prompt}
      </blockquote>

      <div class="flex flex-wrap items-center gap-4">
        <button
          type="button"
          class="hover:bg-surface-panel-hover rounded-control -m-1 flex items-center gap-2 p-1"
          onclick={() => persona && view.showSubscreen("persona", persona.id)}
        >
          <PanelActor name={persona?.name ?? "Agent"} kind="agent" size="row" />
          <span class="text-caption text-ink-secondary">{persona?.name ?? "Agent"}</span>
        </button>
        <span class="text-caption text-ink-muted flex items-center gap-1.5">
          <User size={14} aria-hidden="true" />
          Started by {it.startedBy}, {it.started}
        </span>
        {#if it.firedBy}
          <button
            type="button"
            class="text-caption text-ink-secondary hover:text-ink-primary flex items-center gap-1.5"
            onclick={() => view.showSubscreen("automation", it.firedBy)}
          >
            <Bot size={14} aria-hidden="true" />
            Fired by an Automation
          </button>
        {/if}
      </div>
    </div>

    <div class="area-config min-w-0">
      <ScreenGroup label="How it was configured">
        <ScreenList label="Task settings">
          {#each it.settings as setting (setting.id)}
            <ScreenItem
              title={setting.name}
              excerpt={setting.value}
              selected={view.selection?.id === setting.id}
              onselect={() =>
                view.inspect("agents.task-behaviour", { kind: "setting", id: setting.id })}
            >
              {#snippet lead()}<Boxes size={16} aria-hidden="true" />{/snippet}
            </ScreenItem>
          {/each}
        </ScreenList>
      </ScreenGroup>
    </div>

    <div class="area-progress flex min-w-0 flex-col gap-4">
      <ScreenGroup label="Where it is">
        <div class="flex flex-col gap-2">
          <ScreenStats label="Progress">
            <ScreenStat
              value="{Math.round(it.progress * 100)}%"
              label={running ? "Done so far" : "Complete"}
              tone={it.state === "failed" ? "danger" : "default"}
            />
            <ScreenStat value={String(results.length)} label="Results" />
          </ScreenStats>
          <ScreenNote tone={it.state === "failed" ? "gap" : "muted"}>{it.step}</ScreenNote>
        </div>
      </ScreenGroup>

      <ScreenGroup label="What it has produced" count={String(results.length)}>
        {#if results.length === 0}
          <ScreenEmpty title="Nothing yet">
            {running
              ? "Results appear here as they are found, not at the end."
              : "This task finished without producing anything."}
          </ScreenEmpty>
        {:else}
          <ScreenList label="Results">
            {#each results as result (result.id)}
              <ScreenItem
                title={result.title}
                excerpt={result.detail}
                meta={result.resource}
                selected={view.selection?.id === result.id}
                onselect={() =>
                  view.inspect("agents.task-results", { kind: "result", id: result.id })}
              />
            {/each}
          </ScreenList>
        {/if}
      </ScreenGroup>
    </div>

    <div class="area-chat min-w-0">
      <ScreenGroup label="Steer it">
        <div class="flex flex-col gap-3">
          {#if turns.length === 0}
            <ScreenNote tone="muted">
              Nothing said yet. Write below to change what it is doing while it runs.
            </ScreenNote>
          {:else}
            <ScreenList label="Conversation">
              {#each turns as turn (turn.id)}
                <ScreenItem title={turn.from === "you" ? "You" : (persona?.name ?? "Agent")} excerpt={turn.text} meta={turn.at}>
                  {#snippet lead()}
                    {#if turn.from === "you"}
                      <User size={16} aria-hidden="true" />
                    {:else}
                      <Bot size={16} aria-hidden="true" />
                    {/if}
                  {/snippet}
                </ScreenItem>
              {/each}
            </ScreenList>
          {/if}

          <ScreenComposer
            label="Steer this task"
            placeholder={running ? "Change what it is doing" : "This task has stopped"}
            sendLabel="Send"
            bind:value={message}
            onsend={send}
          >
            {#snippet scope()}
              <span class="text-caption text-ink-muted">
                Goes to {persona?.name ?? "the agent"}. Nothing is dispatched yet.
              </span>
            {/snippet}
          </ScreenComposer>
        </div>
      </ScreenGroup>
    </div>
  </div>
</ScreenSurface>

<style>
  /**
   * Configuration and progress side by side, chat below both. The chat is the
   * full width because a turn is a sentence and a sentence wants a measure, and
   * because it is the one band that grows as the task runs.
   */
  .board {
    display: grid;
    gap: calc(var(--token-spacing-unit) * 5);
    grid-template-columns: 2fr 3fr;
    grid-template-areas:
      "bar      bar"
      "overview overview"
      "config   progress"
      "chat     chat";
    align-content: start;
  }

  .area-bar {
    grid-area: bar;
  }
  .area-overview {
    grid-area: overview;
    max-width: 70ch;
  }
  .area-config {
    grid-area: config;
  }
  .area-progress {
    grid-area: progress;
  }
  .area-chat {
    grid-area: chat;
    max-width: 80ch;
  }

  @media (max-width: 64rem) {
    .board {
      grid-template-columns: 1fr;
      grid-template-areas:
        "bar"
        "overview"
        "progress"
        "config"
        "chat";
    }
  }
</style>
