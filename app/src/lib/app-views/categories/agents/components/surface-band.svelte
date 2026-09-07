<script lang="ts">
  import ChevronLeft from "@lucide/svelte/icons/chevron-left";

  import { Button } from "$vendored-components/button";

  let {
    kicker,
    backLabel = "Agents",
    onback
  }: {
    kicker: string;
    backLabel?: string;
    onback: () => void;
  } = $props();
</script>

<header class="band">
  <Button variant="ghost" size="xs" class="text-ink-secondary" onclick={onback}>
    <ChevronLeft aria-hidden="true" />
    {backLabel}
  </Button>
  <span class="text-caption text-ink-muted">{kicker}</span>
</header>

<style>
  .band {
    display: flex;
    flex: none;
    align-items: center;
    justify-content: space-between;
    padding: calc(var(--token-spacing-unit) * 1.5) calc(var(--token-spacing-unit) * 6);
    border-bottom: 1px solid var(--token-border-subtle);
    background: var(--token-surface-panel);
  }
</style>
