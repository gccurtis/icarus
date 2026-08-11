<script lang="ts">
  import { MessageSquarePlus } from '@lucide/svelte';
  import { Button } from '$lib/components';
  import { setPanel } from '$data/workspace';
</script>

<!-- Always the last control in a text lens: commenting hands off to the context rail. -->
<div class="border-t border-border pt-3">
  <Button
    size="sm"
    variant="ghost"
    class="px-2"
    onclick={() => setPanel('context', { section: 'comments' })}
  >
    <MessageSquarePlus class="size-3.5" />
    Add comment
  </Button>
</div>
