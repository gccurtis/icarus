<script lang="ts">
  import { StatusDot } from '$lib/components';
</script>

<footer
  class="surface-panel flex h-status shrink-0 items-center gap-3 border-t border-border px-3 text-caption text-muted"
>
  <span class="flex items-center gap-1.5"><StatusDot tone="success" size={7} /> Synced</span>
  <span class="ml-auto font-mono">Taurus</span>
</footer>
