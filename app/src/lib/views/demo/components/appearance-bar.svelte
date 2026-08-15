<script lang="ts">
  import {
    applyAppearance,
    SETS,
    storedAppearance,
    THEMES,
    type SetName,
    type ThemeName
  } from "$views/demo/effects/apply-appearance.svelte";
  import { Label } from "$lib/simple-components/label";
  import * as Select from "$lib/simple-components/select";

  const initial = storedAppearance();
  let theme = $state<ThemeName>(initial.theme);
  let set = $state<SetName>(initial.set);

  applyAppearance(() => ({ theme, set }));

  const LABELS: Record<string, string> = {
    celestial: "Celestial — light",
    cyberpunk: "Cyberpunk — dark",
    "blue-primary": "Blue primary",
    "cyan-primary": "Cyan primary",
    "pink-primary": "Pink primary"
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

  <div class="flex items-center gap-2">
    <Label for="set">Semantic set</Label>
    <Select.Root type="single" bind:value={set}>
      <Select.Trigger id="set" class="w-44">{LABELS[set]}</Select.Trigger>
      <Select.Content>
        {#each SETS as name (name)}
          <Select.Item value={name}>{LABELS[name]}</Select.Item>
        {/each}
      </Select.Content>
    </Select.Root>
  </div>
</div>
