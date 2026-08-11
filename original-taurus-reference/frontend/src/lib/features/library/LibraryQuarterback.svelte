<script lang="ts">
  import { CornerDownRight } from '@lucide/svelte';
  import { QuarterbackBar } from '$lib/components';
  import { cn } from '$lib/utils';
  import type { AiMode } from '$data/ai-agent';
  import { personalityById, type AgentTask } from './agents-mock';
  import {
    assistant,
    openAssistant,
    personaOptions,
    placeholdersFor,
    setAssistantMode,
    setAssistantWeb,
    setDraftPersonality,
    submitLibraryPrompt,
    type LibrarySpace
  } from './library-assistant';

  // The library's AI composer: bottom-anchored over the work surface, the same
  // shape AND the same control set as the workspace dock — mode, persona, web,
  // send. There is one QuarterbackBar in this app; the library passes it library
  // data rather than growing a second bar with fewer controls.
  let {
    space,
    assetName,
    task = null,
    onstarted
  }: {
    space: LibrarySpace;
    assetName: string;
    /** Agents only: the selected task, which the send addresses instead of
     *  starting a new agent. */
    task?: AgentTask | null;
    /** Agents only: the id of the task the turn started, so the console can
     *  select it. Null everywhere else — those turns start nothing. */
    onstarted?: (taskId: string | null) => void;
  } = $props();

  let value = $state('');
  let focused = $state(false);
  const active = $derived(focused || $assistant.open);

  /** Who this send reaches. On Agents that is either the selected task's agent or
   *  a new one, and the two are indistinguishable from the text alone. */
  const target = $derived(
    task ? (personalityById(task.personalityId)?.name ?? 'this agent') : null
  );

  function send(prompt: string, mode: AiMode) {
    // Submit FIRST, then notify. `onstarted?.(submitLibraryPrompt(…))` looks
    // equivalent and is not: an optional call skips evaluating its arguments
    // when the callee is nullish, so on Context and Templates — which pass no
    // `onstarted` — the turn was silently never submitted.
    const startedTaskId = submitLibraryPrompt(space, prompt, mode, assetName, task?.id ?? null);
    onstarted?.(startedTaskId);
    value = '';
  }
</script>

<!-- Bottom-anchored: extra input lines expand toward the work above. -->
<div
  class={cn(
    'pointer-events-none absolute bottom-4 left-1/2 z-20 w-full max-w-3xl -translate-x-1/2 px-4 transition-opacity duration-200',
    active ? 'opacity-100' : 'opacity-65 hover:opacity-100'
  )}
>
  <QuarterbackBar
    bind:value
    mode={$assistant.mode}
    {active}
    personas={personaOptions}
    personaId={$assistant.draft.personalityId}
    web={$assistant.web}
    placeholders={placeholdersFor(space, target)}
    class="pointer-events-auto"
    onsend={send}
    onmodechange={setAssistantMode}
    onpersonachange={setDraftPersonality}
    onwebchange={setAssistantWeb}
    onactivate={openAssistant}
    onfocuschange={(f) => (focused = f)}
  >
    <!-- The bar's `leading` slot, kept alongside the AI mark rather than
         replacing it. Per the AI surface spec, before a material action the user
         must know WHERE THE RESULT GOES — and on Agents that is the one thing the
         text cannot tell them: continuing a running agent and starting a fresh
         one look identical in the composer. The placeholder says it too, but a
         placeholder disappears the moment you type. -->
    {#snippet leading()}
      <span
        data-ai-agent-mark
        class="shrink-0 text-caption font-semibold tracking-wide text-muted">AI</span
      >
      {#if space === 'agents'}
        <!-- Not "Analyst · this task": the persona picker two controls along
             already names the agent, and the bar should not say it twice. The
             destination and the persona are different facts — "to this task, as
             Analyst" — so each control carries one of them. -->
        <span
          class="flex min-w-0 max-w-[9rem] items-center gap-1 text-caption text-muted"
          title={target ? `Continues the selected task, run by ${target}` : 'Starts a new agent'}
        >
          <CornerDownRight class="size-3 shrink-0 text-intel" />
          <span class="truncate">{target ? 'This task' : 'New agent'}</span>
        </span>
      {/if}
    {/snippet}
  </QuarterbackBar>
</div>
