<script lang="ts">
  import { BookOpen, ChevronDown } from '@lucide/svelte';
  import ContextSources from './ContextSources.svelte';
  import ContextAttachments from './ContextAttachments.svelte';

  // The collapsible Context disclosure shown above the chat list and the
  // transcript: the door into the Current-context manager, the sources grid,
  // and the chat's attachments.
  let { onmanage }: { onmanage: () => void } = $props();
</script>

<details class="context-disclosure group overflow-hidden rounded-control border border-border bg-panel/50">
  <summary
    class="dur-micro flex min-h-10 cursor-pointer list-none items-center gap-2 px-2.5 py-2 text-label text-secondary transition-colors hover:bg-work hover:text-primary"
  >
    <BookOpen class="size-3.5 shrink-0 text-intel" />
    <span class="font-medium">Context</span>
    <span class="min-w-0 flex-1"></span>
    <ChevronDown
      class="dur-small size-3.5 shrink-0 text-muted transition-transform group-open:rotate-180"
    />
  </summary>

  <div class="space-y-2.5 border-t border-border px-2.5 py-2.5">
    <button
      type="button"
      onclick={onmanage}
      aria-label="Open current context"
      class="dur-micro flex min-h-9 w-full items-center justify-center rounded-control border border-border px-2 text-center text-label font-medium text-secondary transition-colors hover:border-action/40 hover:text-action active:border-action active:bg-action/5 active:text-action"
    >
      Current context
    </button>

    <ContextSources />
    <ContextAttachments />
  </div>
</details>

<style>
  .context-disclosure summary::-webkit-details-marker,
  details > summary::-webkit-details-marker {
    display: none;
  }
</style>
