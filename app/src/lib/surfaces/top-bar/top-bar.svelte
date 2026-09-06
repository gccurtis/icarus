<script lang="ts">
  import Moon from "@lucide/svelte/icons/moon";
  import Sun from "@lucide/svelte/icons/sun";

  import { appearance } from "$surfaces/top-bar/effects/apply-appearance.svelte";

  const dark = $derived(appearance.current === "selene");

  const destination = $derived(dark ? "Switch to Celestial Helios" : "Switch to Celestial Selene");
</script>

<header class="top-bar">
  <span class="wordmark">ICARUS</span>

  <button
    type="button"
    class="appearance"
    title={destination}
    aria-label={destination}
    onclick={() => (appearance.current = dark ? "helios" : "selene")}
  >
    {#if dark}
      <Moon size={16} aria-hidden="true" />
    {:else}
      <Sun size={16} aria-hidden="true" />
    {/if}
  </button>
</header>

<style>
  .top-bar {
    height: 100%;
    display: flex;
    align-items: center;
    gap: var(--token-spacing-unit);
    padding-inline: calc(var(--token-spacing-unit) * 3);
    background-color: var(--token-surface-panel);
    border-bottom: var(--token-hairline) solid var(--token-border-subtle);
  }

  .wordmark {
    font-size: var(--token-text-label);
    font-weight: var(--token-weight-strong);
    letter-spacing: var(--token-tracking-caps);
    color: var(--token-ink-secondary);
  }

  .appearance {
    display: flex;
    margin-inline-start: auto;
    align-items: center;
    justify-content: center;
    border-radius: var(--token-radius-control);
    padding: calc(var(--token-spacing-unit) * 1.5);
    color: var(--token-ink-muted);
    transition: background-color var(--token-motion-micro) var(--token-ease-standard);
  }

  .appearance:hover {
    background-color: var(--token-surface-panel-hover);
    color: var(--token-ink-primary);
  }
</style>
