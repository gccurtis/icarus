<script lang="ts">
  import { MessageSquare } from '@lucide/svelte';
  import { Badge } from '$lib/components';
  import { aiAgent, selectAiChat } from '$data/ai-agent';
  import { modeName, modeTones, relTime } from './helpers';

  // The Recent chats list: loading / error / empty states, then one row per
  // chat with its fixed-mode badge and relative freshness.
</script>

<section aria-labelledby="ai-chats-heading">
  <div class="flex items-center justify-between gap-2 pb-1">
    <p id="ai-chats-heading" class="text-caption font-medium text-secondary">Recent chats</p>
    <span class="text-caption text-muted">{$aiAgent.chats.length}</span>
  </div>
  {#if $aiAgent.status === 'loading' && !$aiAgent.chats.length}
    <p class="rounded-control border border-dashed border-border px-2.5 py-3 text-caption text-muted">
      Loading chats…
    </p>
  {:else if $aiAgent.status === 'error'}
    <p class="rounded-control border border-danger/30 bg-danger/5 px-2.5 py-3 text-caption text-danger">
      {$aiAgent.error ?? 'Could not load chats.'}
    </p>
  {:else if !$aiAgent.chats.length}
    <p class="rounded-control border border-dashed border-border px-2.5 py-3 text-caption text-muted">
      No chats yet. Ask, act, or plan from the bar to start one.
    </p>
  {:else}
    <div class="space-y-1">
      {#each $aiAgent.chats as chat (chat.id)}
        <button
          onclick={() => selectAiChat(chat.id)}
          aria-label={`Open chat: ${chat.title}`}
          class="dur-micro group flex w-full items-start gap-2 rounded-control border border-transparent px-2 py-2.5 text-left transition-colors hover:border-border hover:text-primary"
        >
          <MessageSquare class="mt-0.5 size-3.5 shrink-0 text-muted group-hover:text-intel" />
          <span class="min-w-0 flex-1">
            <span class="flex items-center gap-1.5">
              <span class="truncate text-label font-medium text-secondary">{chat.title}</span>
              <Badge tone={modeTones[chat.mode]} class="shrink-0 px-1 py-0">
                {modeName(chat.mode)}
              </Badge>
            </span>
          </span>
          <span class="shrink-0 text-caption text-muted">{relTime(chat.updatedAt)}</span>
        </button>
      {/each}
    </div>
  {/if}
</section>
