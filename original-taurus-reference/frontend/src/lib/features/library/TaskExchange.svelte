<script lang="ts">
  import type { TaskLine } from './agents-mock';

  // The one exchange grammar: a bounded, quietly-scrolling transcript where you
  // are `action` and the agent is `intel`, per the color roles. Shared by the
  // Task lens (which reads it beside the working list) and the Agent lens (which
  // reads it as the conversation the bar continues) so one conversation does not
  // acquire two appearances depending on which tab you opened.
  //
  // Bounded on purpose: an exchange must never push the rest of a panel off
  // screen, so it scrolls inside its own frame the way every other panel list
  // does.
  let {
    transcript,
    max = 'max-h-56'
  }: {
    transcript: TaskLine[];
    /** Height cap as a utility class — the Agent lens can afford more room. */
    max?: string;
  } = $props();
</script>

<div
  class="quiet-scroll {max} space-y-2 overflow-y-auto rounded-control border border-border bg-work p-2.5"
>
  {#each transcript as line, i (i)}
    <p class="text-caption {line.author === 'you' ? 'text-primary' : 'text-secondary'}">
      <span class="font-medium {line.author === 'you' ? 'text-action' : 'text-intel'}">
        {line.author === 'you' ? 'You' : 'Agent'}
      </span>
      — {line.body}
    </p>
  {/each}
</div>

<style>
  .quiet-scroll {
    scrollbar-width: none;
  }
  .quiet-scroll::-webkit-scrollbar {
    display: none;
  }
</style>
