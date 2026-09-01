<script lang="ts">
  import Moon from "@lucide/svelte/icons/moon";
  import Sun from "@lucide/svelte/icons/sun";

  import {
    DARK_THEME,
    LIGHT_THEME,
    applyTheme,
    storedTheme,
    type ThemeName
  } from "$surfaces/top-bar/effects/apply-theme.svelte";

  /**
   * The top bar — always visible, never route-dependent. The first rung of the
   * disclosure ladder, and the two ends of it are the two ends of this row: who
   * you are looking at on the left, how the whole application looks on the
   * right.
   *
   * **Light and dark are which chromatic theme is active.** Celestial reads from
   * the light end of every ramp and cyberpunk from the dark end, so one
   * attribute on `<html>` re-aims every slot at once and no surface below has to
   * know the polarity changed.
   *
   * The choice lives in this component rather than in the client model: it is
   * about the page, not about the work, so it belongs with the thing that
   * persists it and dies with the frame it is written on.
   */
  let theme = $state<ThemeName>(storedTheme());

  applyTheme(() => theme);

  const dark = $derived(theme === DARK_THEME);

  /**
   * The glyph names the appearance you are in; the accessible name names what
   * pressing it does. A button's name has to be its action — "Sun" tells a
   * screen-reader user nothing about where the press goes — and a glyph that
   * showed the destination would put a moon on screen in the dark, next to every
   * other surface already saying the same thing.
   */
  const destination = $derived(dark ? "Switch to the light theme" : "Switch to the dark theme");
</script>

<header class="top-bar">
  <span class="wordmark">ICARUS</span>

  <button
    type="button"
    class="theme"
    title={destination}
    aria-label={destination}
    onclick={() => (theme = dark ? LIGHT_THEME : DARK_THEME)}
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
    border-bottom: 1px solid var(--token-border-subtle);
  }

  .wordmark {
    font-size: var(--token-text-label);
    font-weight: 600;
    letter-spacing: 0.08em;
    color: var(--token-ink-secondary);
  }

  /* The far end, held there by the margin rather than by a spacer element, so
   * anything added to this row lands between the two rather than displacing
   * one. */
  .theme {
    display: flex;
    margin-inline-start: auto;
    align-items: center;
    justify-content: center;
    border-radius: var(--token-radius-control);
    padding: calc(var(--token-spacing-unit) * 1.5);
    color: var(--token-ink-muted);
  }

  .theme:hover {
    background-color: var(--token-surface-panel-hover);
    color: var(--token-ink-primary);
  }
</style>
