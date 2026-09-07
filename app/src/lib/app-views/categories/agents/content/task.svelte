<script lang="ts">
  import { onDestroy, onMount } from "svelte";
  import Check from "@lucide/svelte/icons/check";
  import CircleCheck from "@lucide/svelte/icons/circle-check";
  import Square from "@lucide/svelte/icons/square";
  import Workflow from "@lucide/svelte/icons/workflow";

  import { PanelActor, PanelChip } from "$authored-components/panel";
  import {
    ScreenCell,
    ScreenComposer,
    ScreenEmpty,
    ScreenGroup,
    ScreenItem,
    ScreenList,
    ScreenNote,
    ScreenRow,
    ScreenTable
  } from "$authored-components/screen";
  import { Button } from "$vendored-components/button";
  import * as RadioGroup from "$vendored-components/radio-group";
  import * as Tabs from "$vendored-components/tabs";
  import { Textarea } from "$vendored-components/textarea";
  import Grants from "$app-views/categories/agents/components/grants.svelte";
  import ScrollWell from "$app-views/categories/agents/components/scroll-well.svelte";
  import NameInput from "$app-views/categories/agents/components/name-input.svelte";
  import PersonaPicker from "$app-views/categories/agents/components/persona-picker.svelte";
  import RemoteState from "$app-views/categories/agents/components/remote-state.svelte";
  import SurfaceBand from "$app-views/categories/agents/components/surface-band.svelte";
  import SurfaceHead from "$app-views/categories/agents/components/surface-head.svelte";
  import ThreadFeed from "$app-views/categories/agents/components/thread-feed.svelte";
  import {
    STATE_LABEL,
    STATE_TONE,
    agentsLibrary,
    answerTaskQuestion,
    createTask,
    inspectPersona,
    inspectTask,
    isNew,
    messageOf,
    openAutomation,
    openTask,
    presetPersonaOf,
    sendTaskMessage,
    showLibrary,
    taskDetail,
    typeLabelOf,
    updateTask
  } from "$app-views/categories/agents/procedures/library.svelte";
  import { elapsed, relativeTime } from "$app-views/categories/agents/procedures/time";
  import { isOpen, orderedTools, type TaskQuestion } from "$app-views/categories/agents/procedures/vocabulary";
  import type { UpdateTaskPatch } from "$capabilities/agents/index.remote";
  import { workspaceState } from "$model/client/workspace-state";

  const view = workspaceState();
  const focus = $derived(view.active.focus);
  const fresh = $derived(isNew(focus));
  const detail = $derived(fresh ? undefined : taskDetail(focus));
  const library = agentsLibrary();

  let live = true;
  onDestroy(() => {
    live = false;
  });
  let now = $state(Date.now());
  onMount(() => {
    const timer = setInterval(() => (now = Date.now()), 15_000);
    return () => clearInterval(timer);
  });

  const answer = $derived(library.ready ? library.current : undefined);
  const personas = $derived(answer?.personas ?? []);
  const task = $derived(
    detail !== undefined && detail.ready ? (detail.current ?? undefined) : undefined
  );

  let claimed = $state<string>();
  $effect(() => {
    if (task === undefined || claimed === task.id) return;
    claimed = task.id;
    inspectTask(view, task.id);
  });

  let pending = $state<string>();
  let actionError = $state<string>();

  const save = async (label: string, patch: UpdateTaskPatch) => {
    if (task === undefined) return;
    pending = label;
    actionError = undefined;
    try {
      const result = await updateTask(view, task, patch);
      if (live && !result.accepted) actionError = result.detail;
    } catch (error) {
      if (live) actionError = messageOf(error);
    } finally {
      pending = undefined;
    }
  };

  let message = $state("");
  const send = async (text: string) => {
    if (task === undefined) return;
    pending = "message";
    actionError = undefined;
    try {
      const result = await sendTaskMessage(view, task.id, text);
      if (!live) return;
      if (result.accepted) message = "";
      else actionError = result.detail;
    } catch (error) {
      if (live) actionError = messageOf(error);
    } finally {
      pending = undefined;
    }
  };

  const OTHER = "other";
  let picked = $state<Record<string, string>>({});
  let other = $state<Record<string, string>>({});
  let chosenTab = $state<string>();

  const questions = $derived(task?.questions ?? []);
  const ordered = $derived([
    ...questions.filter(isOpen),
    ...questions.filter((question) => !isOpen(question))
  ]);
  const activeTab = $derived(chosenTab ?? ordered[0]?.id ?? "");
  const current = $derived(ordered.find((question) => question.id === activeTab));

  const choiceOf = (question: TaskQuestion): string | undefined =>
    (question.options ?? []).length === 0 ? OTHER : picked[question.id];

  const replyOf = (question: TaskQuestion): string => {
    const choice = choiceOf(question);
    if (choice === undefined) return "";
    return choice === OTHER ? (other[question.id] ?? "").trim() : choice;
  };

  const settle = async (question: TaskQuestion, reply: { answer: string } | { reject: true }) => {
    if (task === undefined) return;
    pending = "answer";
    actionError = undefined;
    try {
      const result = await answerTaskQuestion(view, task.id, question.id, reply);
      if (!live) return;
      if (result.accepted) {
        picked = { ...picked, [question.id]: "" };
        other = { ...other, [question.id]: "" };
      } else actionError = result.detail;
    } catch (error) {
      if (live) actionError = messageOf(error);
    } finally {
      pending = undefined;
    }
  };

  const STEP_WORD = { pending: "Waiting", active: "Running", done: "Done" } as const;
  const percentLabel = $derived(
    task === undefined || task.progress.percent === null ? "—" : `${task.progress.percent}%`
  );
  const instructionEditable = $derived(task !== undefined && task.state === "running" && task.plan.length === 0);

  let draftPersona = $state<string | undefined>(undefined);
  let draftTitle = $state("");
  let draftInstruction = $state("");
  let draftTools = $state<string | undefined>(undefined);
  const chosenPersonaId = $derived(draftPersona ?? presetPersonaOf(focus) ?? personas[0]?.id);
  const chosenPersona = $derived(personas.find((candidate) => candidate.id === chosenPersonaId));
  const newTools = $derived(draftTools ?? (chosenPersona?.tools ?? []).join(","));
  const split = (joined: string) =>
    joined
      .split(",")
      .map((entry) => entry.trim())
      .filter((entry) => entry !== "");

  const create = async () => {
    if (chosenPersona === undefined || draftTitle.trim() === "" || draftInstruction.trim() === "") return;
    pending = "create";
    actionError = undefined;
    try {
      const result = await createTask(view, {
        personaId: chosenPersona.id,
        title: draftTitle.trim(),
        instruction: draftInstruction.trim(),
        tools: orderedTools(split(newTools))
      });
      if (!live) return;
      if (result.accepted) openTask(view, result.id);
      else actionError = result.detail;
    } catch (error) {
      if (live) actionError = messageOf(error);
    } finally {
      pending = undefined;
    }
  };
</script>

<div class="surface">
  <RemoteState
    ready={library.ready && (fresh || (detail !== undefined && detail.ready))}
    error={library.error !== undefined
      ? messageOf(library.error)
      : detail?.error !== undefined
        ? messageOf(detail.error)
        : undefined}
    what="The task"
    onretry={() => {
      void library.refresh();
      void detail?.refresh();
    }}
  >
    {#if fresh}
      <SurfaceBand kicker="New task" onback={() => showLibrary(view)} />
      <div class="body">
        <SurfaceHead>
          <h2 class="heading">Ask a persona to do something once</h2>
          <p class="text-caption text-ink-muted m-0">
            The task starts when it is created. A runner picks it up, writes its plan and reports outputs here.
          </p>
          {#snippet actions()}
            <Button
              variant="default"
              size="sm"
              disabled={pending !== undefined || chosenPersona === undefined || draftTitle.trim() === "" || draftInstruction.trim() === ""}
              onclick={create}
            >
              {pending === "create" ? "Creating…" : "Create and start"}
            </Button>
          {/snippet}
        </SurfaceHead>

        {#if actionError}
          <ScreenNote tone="gap">{actionError}</ScreenNote>
        {/if}

        <div class="pair">
          <ScreenGroup label="Ask">
            <div class="stack">
              <input
                class="field"
                bind:value={draftTitle}
                placeholder="Name the task"
                aria-label="Task name"
              />
              <Textarea
                bind:value={draftInstruction}
                rows={6}
                placeholder="What to ask, in full. It is sent verbatim."
                aria-label="Instruction"
              />
            </div>
          </ScreenGroup>

          <div class="stack">
            <ScreenGroup label="Persona">
              <PersonaPicker
                value={chosenPersonaId}
                onchange={(id) => {
                  draftPersona = id;
                  draftTools = undefined;
                }}
              />
            </ScreenGroup>

            <Grants
              label="Allowed"
              personaId={chosenPersonaId}
              chosen={newTools}
              onchange={(next) => (draftTools = next)}
            />
          </div>
        </div>
      </div>
    {:else if task === undefined}
      <div class="p-6">
        <ScreenEmpty title="That task is not in this project">
          It may have been removed, or it belongs to another project.
        </ScreenEmpty>
        <Button variant="outline" size="sm" onclick={() => showLibrary(view)}>Back to the library</Button>
      </div>
    {:else}
      <SurfaceBand kicker="Task" onback={() => showLibrary(view)} />

      <div class="body work">
        <div class="top">
        <SurfaceHead>
          <NameInput
            value={task.title}
            label="Task name"
            placeholder="Name the task"
            onsave={(next) => save("title", { title: next })}
          />
          <div class="chips">
            <PanelChip tone="neutral">{typeLabelOf(task)}</PanelChip>
            <PanelChip tone={STATE_TONE[task.state]}>{STATE_LABEL[task.state]}</PanelChip>
            {#if task.openQuestions > 0}
              <PanelChip tone="attention">
                {task.openQuestions} {task.openQuestions === 1 ? "question" : "questions"} for you
              </PanelChip>
            {/if}
            <span class="text-caption text-ink-muted">
              Started {relativeTime(task.startedAt, now)} by {task.startedByName}
              · {task.finishedAt === null
                ? elapsed(task.startedAt, now)
                : `took ${elapsed(task.startedAt, task.finishedAt)}`}
              {#if task.reviewedByName}· reviewed by {task.reviewedByName}{/if}
              {#if pending !== undefined}· saving {pending}…{/if}
            </span>
          </div>
          {#snippet actions()}
            {#if task.origin.kind === "automation"}
              <Button variant="outline" size="sm" onclick={() => openAutomation(view, (task.origin as { automationId: string }).automationId)}>
                <Workflow aria-hidden="true" />
                Open automation
              </Button>
            {/if}
            {#if task.state === "running"}
              <Button
                variant="outline"
                size="sm"
                disabled={pending !== undefined}
                onclick={() => save("stop", { state: "finished" })}
              >
                <Square aria-hidden="true" />
                Stop
              </Button>
            {:else if task.state === "review"}
              <Button
                variant="default"
                size="sm"
                disabled={pending !== undefined}
                onclick={() => save("review", { state: "finished" })}
              >
                <CircleCheck aria-hidden="true" />
                Mark reviewed
              </Button>
            {/if}
          {/snippet}
        </SurfaceHead>

        {#if actionError}
          <ScreenNote tone="gap">{actionError}</ScreenNote>
        {/if}
        </div>

        <div class="asked">
          {#if instructionEditable}
            <textarea
              class="instruction"
              rows="3"
              value={task.instruction}
              aria-label="Instruction"
              title="Editable until a runner picks the task up"
              onchange={(event) => {
                const next = event.currentTarget.value.trim();
                if (next !== "" && next !== task.instruction) void save("instruction", { instruction: next });
              }}
            ></textarea>
          {:else}
            <blockquote class="instruction">{task.instruction}</blockquote>
          {/if}
          <button type="button" class="fact" onclick={() => inspectPersona(view, task.personaId)}>
            <PanelActor name={task.personaName} kind="agent" size="row" />
          </button>
        </div>

        <div class="split">
          <ScreenGroup label="Plan" fill>
            {#if task.plan.length === 0}
              <ScreenEmpty title="No plan yet">
                {task.state === "running"
                  ? "The runner writes the plan when it picks the task up."
                  : "This task finished without a plan on record."}
              </ScreenEmpty>
            {:else}
              <ScreenTable columns={["Step", percentLabel]} scroll>
                {#each task.plan as step, index (step.id)}
                  <ScreenRow>
                    <ScreenCell>
                      <span class="step" class:done={step.state === "done"}>
                        <span class="step-title">{index + 1}. {step.title}</span>
                        {#if step.note}
                          <span class="step-note">{step.note}</span>
                        {/if}
                      </span>
                    </ScreenCell>
                    <ScreenCell num>
                      <span class="state {step.state}">{STEP_WORD[step.state]}</span>
                    </ScreenCell>
                  </ScreenRow>
                {/each}
              </ScreenTable>
            {/if}
          </ScreenGroup>

          <ScreenGroup label="Questions" fill tone={task.openQuestions > 0 ? "attention" : "default"}>
            {#if questions.length === 0}
              <ScreenEmpty title="Nothing asked">
                When {task.personaName} needs a decision from you it asks here and waits.
              </ScreenEmpty>
            {:else}
              <Tabs.Root
                value={activeTab}
                onValueChange={(next: string) => (chosenTab = next)}
                class="asking"
              >
                <div class="asking-head">
                  <span class="asking-label">Asked by {task.personaName}</span>
                  <Tabs.List variant="line" class="ms-auto">
                    {#each ordered as question, index (question.id)}
                      <Tabs.Trigger value={question.id} class={isOpen(question) ? "text-attention-text" : undefined}>
                        {index + 1}
                      </Tabs.Trigger>
                    {/each}
                  </Tabs.List>
                </div>

                {#each ordered as question (question.id)}
                  {@const waiting = isOpen(question)}
                  {@const options = question.options ?? []}
                  <Tabs.Content value={question.id} class="asking-body">
                    {#if waiting}
                      <div class="asking-scroll">
                      <p class="question">{question.text}</p>
                      <span class="text-caption text-ink-muted">
                        Asked {relativeTime(question.askedAt, now)} · waiting on you
                      </span>
                      {#if options.length > 0}
                        <RadioGroup.Root
                          value={picked[question.id] ?? ""}
                          aria-label="Answer"
                          onValueChange={(next: string) => (picked = { ...picked, [question.id]: next })}
                        >
                          {#each options as option, index (option)}
                            <label class="option">
                              <RadioGroup.Item value={option} id="{question.id}-{index}" />
                              <span>{option}</span>
                            </label>
                          {/each}
                          <label class="option">
                            <RadioGroup.Item value={OTHER} id="{question.id}-other" />
                            <span>Something else</span>
                          </label>
                        </RadioGroup.Root>
                      {/if}
                      {#if choiceOf(question) === OTHER}
                        <Textarea
                          rows={4}
                          placeholder="Your answer, in your own words"
                          aria-label="Your answer"
                          value={other[question.id] ?? ""}
                          oninput={(event) => (other = { ...other, [question.id]: event.currentTarget.value })}
                        />
                      {/if}
                      </div>
                      <div class="decide">
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={pending !== undefined}
                          title="Hand the decision back to the agent"
                          onclick={() => settle(question, { reject: true })}
                        >
                          Reject
                        </Button>
                        <Button
                          size="sm"
                          disabled={pending !== undefined || replyOf(question) === ""}
                          onclick={() => settle(question, { answer: replyOf(question) })}
                        >
                          Answer
                        </Button>
                      </div>
                    {:else}
                      <div class="asking-scroll">
                      <p class="question">{question.text}</p>
                      <span class="text-caption text-ink-muted">
                        Asked {relativeTime(question.askedAt, now)}
                      </span>
                      {#if options.length > 0}
                        <ul class="settled-options">
                          {#each options as option (option)}
                            <li class:chosen={option === question.answer}>
                              {#if option === question.answer}
                                <Check size={14} aria-hidden="true" />
                              {/if}
                              <span>{option}</span>
                            </li>
                          {/each}
                        </ul>
                      {/if}
                      {#if question.rejectedAt !== undefined}
                        <p class="answer">Handed back to the agent to decide.</p>
                        <span class="text-caption text-ink-muted">
                          By {question.answeredByName ?? "someone"} {relativeTime(question.rejectedAt, now)}
                        </span>
                      {:else}
                        <p class="answer">{question.answer}</p>
                        <span class="text-caption text-ink-muted">
                          Answered by {question.answeredByName ?? "someone"}
                          {question.answeredAt === undefined ? "" : relativeTime(question.answeredAt, now)}
                        </span>
                      {/if}
                      </div>
                    {/if}
                  </Tabs.Content>
                {/each}
              </Tabs.Root>
            {/if}
          </ScreenGroup>
        </div>

        <div class="split">
          <ScreenGroup label="Outputs" fill count={task.outputs.length === 0 ? "0" : undefined}>
            {#if task.outputs.length === 0}
              <ScreenEmpty title="Nothing yet">
                {task.state === "running"
                  ? "Outputs appear as the agent produces them, not at the end."
                  : "This task produced nothing it wanted to keep."}
              </ScreenEmpty>
            {:else}
              <ScrollWell label="Outputs">
                <ScreenList label="Outputs">
                  {#each task.outputs as output (output.id)}
                    <ScreenItem
                      title={output.title}
                      excerpt={output.detail}
                      meta={output.refName ?? relativeTime(output.at, now)}
                    />
                  {/each}
                </ScreenList>
              </ScrollWell>
            {/if}
          </ScreenGroup>

          <Grants label="Allowed" owner={task.id} disabled={pending !== undefined} />
        </div>

        <ScreenGroup label="Thread" fill>
          <div class="thread">
            <ScrollWell label="Conversation">
              <ThreadFeed taskId={task.id} />
            </ScrollWell>
            {#if task.state === "finished"}
              <p class="text-caption text-ink-muted m-0">Finished. Nothing reads this thread any more.</p>
            {:else}
              <ScreenComposer
                label="Message the agent"
                placeholder="Steer it, correct it, or add what it should know"
                bind:value={message}
                onsend={send}
              >
                {#snippet scope()}
                  <span class="sr-only">Goes to {task.personaName} on this task.</span>
                {/snippet}
              </ScreenComposer>
            {/if}
          </div>
        </ScreenGroup>
      </div>
    {/if}
  </RemoteState>
</div>

<style>
  .surface {
    display: flex;
    height: 100%;
    min-height: 0;
    flex-direction: column;
  }

  .heading {
    margin: 0;
    font-size: var(--token-text-h3);
    font-weight: var(--token-weight-strong);
    letter-spacing: var(--token-tracking-heading);
    line-height: var(--token-text-h3-leading);
  }

  .chips {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: calc(var(--token-spacing-unit) * 2);
  }

  .body {
    display: flex;
    min-height: 0;
    flex: 1;
    flex-direction: column;
    gap: calc(var(--token-spacing-unit) * 6);
    overflow-y: auto;
    padding: calc(var(--token-spacing-unit) * 6);
    scrollbar-width: none;
  }

  .body.work {
    display: grid;
    grid-template-rows: auto auto minmax(20rem, 5fr) minmax(11rem, 3fr) minmax(22rem, 6fr);
  }

  .top {
    display: flex;
    flex-direction: column;
    gap: calc(var(--token-spacing-unit) * 3);
  }

  .asked {
    display: flex;
    max-width: 80ch;
    flex-direction: column;
    align-items: flex-start;
    gap: calc(var(--token-spacing-unit) * 3);
  }

  .instruction {
    width: 100%;
    margin: 0;
    padding: 0 0 0 calc(var(--token-spacing-unit) * 3);
    border: 0;
    border-left: 2px solid var(--token-border-strong);
    border-radius: 0;
    background: transparent;
    color: var(--token-ink-primary);
    font: inherit;
    font-size: var(--token-text-body);
    line-height: var(--token-text-body-leading);
    outline: none;
    resize: vertical;
    white-space: pre-wrap;
  }

  textarea.instruction:focus {
    border-left-color: var(--token-color-interactive-border);
  }

  .fact {
    display: inline-flex;
    align-items: center;
    margin: calc(var(--token-spacing-unit) * -1);
    padding: var(--token-spacing-unit);
    border: 0;
    border-radius: var(--token-radius-control);
    background: transparent;
    cursor: pointer;
  }

  .fact:hover {
    background: var(--token-surface-panel-hover);
  }

  .split {
    --head: calc(var(--token-spacing-unit) * 10);

    display: grid;
    min-height: 0;
    grid-template-columns: minmax(0, 2fr) minmax(26rem, 3fr);
    gap: calc(var(--token-spacing-unit) * 6);
    align-items: stretch;
  }

  .split :global(thead th) {
    height: var(--head);
  }

  .pair {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: calc(var(--token-spacing-unit) * 6);
    align-items: start;
  }

  .stack {
    display: flex;
    flex-direction: column;
    gap: calc(var(--token-spacing-unit) * 4);
  }

  .step {
    display: flex;
    min-height: calc(var(--token-spacing-unit) * 9);
    flex-direction: column;
    justify-content: center;
    gap: calc(var(--token-spacing-unit) * 0.5);
  }

  .step-title {
    color: var(--token-ink-primary);
    font-size: var(--token-text-body-sm);
    line-height: var(--token-text-body-sm-leading);
  }

  .step.done .step-title {
    color: var(--token-ink-secondary);
  }

  .step-note {
    color: var(--token-ink-muted);
    font-size: var(--token-text-caption);
    line-height: var(--token-text-caption-leading);
  }

  .state {
    font-size: var(--token-text-caption);
  }

  .state.done {
    color: var(--token-color-success-text);
  }

  .state.active {
    color: var(--token-color-attention-text);
  }

  .state.pending {
    color: var(--token-ink-muted);
  }

  :global(.asking) {
    min-height: 0;
    flex: 1;
    overflow: hidden;
    border: 1px solid var(--token-border-subtle);
    border-radius: var(--token-radius-panel);
    background: var(--token-surface-elevated);
    gap: 0;
  }

  .asking-head {
    display: flex;
    min-height: var(--head);
    align-items: center;
    gap: calc(var(--token-spacing-unit) * 3);
    padding: 0 calc(var(--token-spacing-unit) * 3);
    border-bottom: 1px solid var(--token-border-subtle);
    background: var(--token-surface-panel-hover);
  }

  .asking-label {
    color: var(--token-ink-muted);
    font-size: var(--token-text-caption);
    font-weight: var(--token-weight-semibold);
    letter-spacing: var(--token-tracking-wide);
    text-transform: uppercase;
  }

  :global(.asking-body) {
    display: flex;
    min-height: 0;
    flex-direction: column;
    gap: calc(var(--token-spacing-unit) * 3);
    overflow: hidden;
    padding: calc(var(--token-spacing-unit) * 4);
  }

  .asking-scroll {
    display: flex;
    min-height: 0;
    flex: 1;
    flex-direction: column;
    gap: calc(var(--token-spacing-unit) * 3);
    overflow-y: auto;
    scrollbar-color: var(--token-border-strong) transparent;
    scrollbar-width: thin;
  }

  .question {
    max-width: 70ch;
    margin: 0;
    color: var(--token-ink-primary);
    font-size: var(--token-text-body);
    line-height: var(--token-text-body-leading);
  }

  .option {
    display: flex;
    max-width: 70ch;
    align-items: start;
    gap: calc(var(--token-spacing-unit) * 2);
    color: var(--token-ink-primary);
    cursor: pointer;
    font-size: var(--token-text-body-sm);
    line-height: var(--token-text-body-sm-leading);
  }

  .settled-options {
    display: flex;
    flex-direction: column;
    gap: calc(var(--token-spacing-unit) * 1);
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .settled-options li {
    display: flex;
    align-items: start;
    gap: calc(var(--token-spacing-unit) * 2);
    padding-left: calc(var(--token-spacing-unit) * 5);
    color: var(--token-ink-muted);
    font-size: var(--token-text-body-sm);
    line-height: var(--token-text-body-sm-leading);
    text-indent: calc(var(--token-spacing-unit) * -5);
  }

  .settled-options li.chosen {
    color: var(--token-color-success-text);
  }

  .decide {
    display: flex;
    justify-content: flex-end;
    gap: calc(var(--token-spacing-unit) * 2);
  }

  .answer {
    max-width: 70ch;
    margin: 0;
    padding-left: calc(var(--token-spacing-unit) * 3);
    border-left: 2px solid var(--token-border-strong);
    color: var(--token-ink-secondary);
    font-size: var(--token-text-body-sm);
    line-height: var(--token-text-body-sm-leading);
    white-space: pre-wrap;
  }

  .thread {
    display: flex;
    min-height: 0;
    max-width: 108ch;
    flex: 1;
    flex-direction: column;
    gap: calc(var(--token-spacing-unit) * 3);
  }

  .thread :global(form) {
    border-color: var(--token-border-strong);
    background: var(--token-surface-elevated);
    box-shadow: var(--token-shadow-panel);
  }

  .thread :global(form textarea) {
    background: var(--token-surface-elevated);
  }

  .thread :global(form [data-slot="kbd-group"]) {
    display: none;
  }

  .field {
    height: calc(var(--token-spacing-unit) * 8);
    padding: 0 calc(var(--token-spacing-unit) * 2);
    border: 1px solid var(--token-border-subtle);
    border-radius: var(--token-radius-control);
    background: var(--token-surface-panel);
    color: var(--token-ink-primary);
    font: inherit;
    font-size: var(--token-text-body-sm);
  }

  @media (max-width: 72rem) {
    .split,
    .pair {
      grid-template-columns: 1fr;
    }
  }
</style>
