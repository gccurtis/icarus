<script lang="ts">
  import { cn } from '$lib/utils';
  import { editorSession } from '../../editor/session';

  // Shown when the open document has no canonical layout: layout ops still preview
  // locally, but nothing persists. Each panel words it for the controls it owns.
  let {
    message,
    enabled = true,
    class: className = ''
  }: { message: string; enabled?: boolean; class?: string } = $props();

  const unsupported = $derived(!!$editorSession && !$editorSession.supportsCanonicalLayout);
</script>

{#if unsupported && enabled}
  <p
    class={cn(
      'rounded-control border border-attention/30 bg-attention/5 px-2 py-1.5 text-caption text-attention',
      className
    )}
  >
    {message}
  </p>
{/if}
