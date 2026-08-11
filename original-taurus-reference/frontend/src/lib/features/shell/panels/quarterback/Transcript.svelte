<script lang="ts">
  import { aiAgent } from '$data/ai-agent';

  // The conversation transcript: author-tinted message blocks plus the live
  // "Working…" indicator while a turn is in flight.
</script>

{#if $aiAgent.messages.length}
  <div class="space-y-4" aria-live="polite">
    {#each $aiAgent.messages as message (message.id)}
      <div
        class="border-l-2 {message.author === 'agent'
          ? 'border-intel/50'
          : 'border-border-strong'} pl-3"
      >
        <p
          class="text-caption font-medium {message.author === 'agent'
            ? 'text-intel'
            : 'text-secondary'}"
        >
          {message.author === 'agent' ? 'Taurus' : 'You'}
        </p>
        <p class="mt-1 whitespace-pre-wrap text-body-sm text-secondary">{message.body}</p>
      </div>
    {/each}
  </div>
{/if}

{#if $aiAgent.sending}
  <p class="text-caption text-muted" aria-live="polite">Working…</p>
{/if}
