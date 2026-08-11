<script lang="ts">
  import { Badge } from '$lib/components';

  let { class: className = '' }: { class?: string } = $props();
</script>

<Badge tone="attention" class={className}>Mock</Badge>
