<script lang="ts">
  import Check from "@lucide/svelte/icons/check";

  import { ScreenEmpty, ScreenGroup } from "$authored-components/screen";
  import { Button } from "$vendored-components/button";
  import * as RadioGroup from "$vendored-components/radio-group";
  import * as Tabs from "$vendored-components/tabs";
  import { Textarea } from "$vendored-components/textarea";
  import type { TaskState } from "$app-views/categories/agents/content/task.state.svelte";
  import { relativeTime } from "$app-views/categories/agents/procedures/time";
  import {
    isOpen,
    type TaskQuestion
  } from "$app-views/categories/agents/procedures/vocabulary";
  import type { TaskDetail } from "$capabilities/agents/index.remote";

  type Props = {
    task: TaskDetail;
    surface: TaskState;
    now: number;
    onsettle: (question: TaskQuestion, reply: { answer: string } | { reject: true }) => void;
  };

  let { task, surface, now, onsettle }: Props = $props();
  const OTHER = "other";
  const ordered = $derived([
    ...task.questions.filter(isOpen),
    ...task.questions.filter((question) => !isOpen(question))
  ]);
  const activeTab = $derived(surface.chosenTab ?? ordered[0]?.id ?? "");
  const choiceOf = (question: TaskQuestion): string | undefined =>
    (question.options ?? []).length === 0 ? OTHER : surface.picked[question.id];
  const replyOf = (question: TaskQuestion): string => {
    const choice = choiceOf(question);
    if (choice === undefined) return "";
    return choice === OTHER ? (surface.other[question.id] ?? "").trim() : choice;
  };
</script>

<ScreenGroup
  label="Questions"
  fill
  tone={task.openQuestions > 0 ? "attention" : "default"}
>
  {#if task.questions.length === 0}
    <ScreenEmpty title="Nothing asked">
      When {task.personaName} needs a decision from you it asks here and waits.
    </ScreenEmpty>
  {:else}
    <Tabs.Root
      value={activeTab}
      onValueChange={(next: string) => (surface.chosenTab = next)}
      class="asking"
    >
      <div class="asking-head">
        <span class="asking-label">Asked by {task.personaName}</span>
        <Tabs.List variant="line" class="ms-auto">
          {#each ordered as question, index (question.id)}
            <Tabs.Trigger
              value={question.id}
              class={isOpen(question) ? "text-attention-text" : undefined}
            >
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
                  value={surface.picked[question.id] ?? ""}
                  aria-label="Answer"
                  onValueChange={(next: string) =>
                    (surface.picked = { ...surface.picked, [question.id]: next })}
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
                  value={surface.other[question.id] ?? ""}
                  oninput={(event) =>
                    (surface.other = {
                      ...surface.other,
                      [question.id]: event.currentTarget.value
                    })}
                />
              {/if}
            </div>
            <div class="decide">
              <Button
                variant="outline"
                size="sm"
                disabled={surface.busy !== undefined}
                title="Hand the decision back to the agent"
                onclick={() => onsettle(question, { reject: true })}
              >
                Reject
              </Button>
              <Button
                size="sm"
                disabled={surface.busy !== undefined || replyOf(question) === ""}
                onclick={() => onsettle(question, { answer: replyOf(question) })}
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

<style>
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
    gap: var(--token-spacing-unit);
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
</style>
