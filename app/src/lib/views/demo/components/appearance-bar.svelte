<script lang="ts">
  import {
    applyAppearance,
    storedAppearance,
    THEMES,
    type ThemeName
  } from "$views/demo/effects/apply-appearance.svelte";
  import { Label } from "$lib/simple-components/label";
  import * as Select from "$lib/simple-components/select";

  const initial = storedAppearance();
  let theme = $state<ThemeName>(initial.theme);

  applyAppearance(() => ({ theme }));

  const LABELS: Record<string, string> = {
    celestial: "Celestial — light",
    cyberpunk: "Cyberpunk — dark"
  };
</script>

<div
  class="bg-surface-panel border-border-subtle sticky top-0 z-10 flex flex-wrap items-center gap-6 border-b px-4 py-3"
>
  <span class="text-label text-ink-secondary font-semibold tracking-wide">APPEARANCE</span>

  <div class="flex items-center gap-2">
    <Label for="theme">Theme</Label>
    <Select.Root type="single" bind:value={theme}>
      <Select.Trigger id="theme" class="w-48">{LABELS[theme]}</Select.Trigger>
      <Select.Content>
        {#each THEMES as name (name)}
          <Select.Item value={name}>{LABELS[name]}</Select.Item>
        {/each}
      </Select.Content>
    </Select.Root>
  </div>
</div>
