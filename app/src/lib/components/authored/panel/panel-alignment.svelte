<!-- Shared by the selection, caret, and named-style lenses. -->
<script lang="ts">
  import { onMount } from "svelte";
  import AlignCenter from "@lucide/svelte/icons/align-center";
  import AlignJustify from "@lucide/svelte/icons/align-justify";
  import AlignLeft from "@lucide/svelte/icons/align-left";
  import AlignRight from "@lucide/svelte/icons/align-right";

  import * as ToggleGroup from "$vendored-components/toggle-group";

  type HorizontalAlignment = "start" | "center" | "end" | "justify";

  const ALIGNMENTS: readonly { value: HorizontalAlignment; label: string }[] = [
    { value: "start", label: "Left" },
    { value: "center", label: "Centre" },
    { value: "end", label: "Right" },
    { value: "justify", label: "Justify" }
  ];

  let {
    value,
    mixed = false,
    onchange
  }: {
    value: HorizontalAlignment;
    mixed?: boolean;
    onchange?: (next: HorizontalAlignment) => void;
  } = $props();

  const ICONS = {
    start: AlignLeft,
    center: AlignCenter,
    end: AlignRight,
    justify: AlignJustify
  };

  let selected = $state("");
  let current = "";
  let active = false;
  onMount(() => {
    active = true;
    return () => {
      active = false;
    };
  });
  $effect(() => {
    const next = mixed ? "" : value;
    selected = next;
    current = next;
  });
</script>

<ToggleGroup.Root
  type="single"
  bind:value={selected}
  aria-label="Alignment"
  class="flex w-full flex-nowrap gap-1"
  onValueChange={(next: string) => {
    if (!active || !next || next === current) return;
    current = next;
    onchange?.(next as HorizontalAlignment);
  }}
>
  {#each ALIGNMENTS as choice (choice.value)}
    {@const Icon = ICONS[choice.value]}
    <ToggleGroup.Item
      value={choice.value}
      title={choice.label}
      aria-label={choice.label}
      class="text-caption border-border-subtle bg-surface-panel text-ink-secondary rounded-control data-[state=on]:border-active-border data-[state=on]:bg-active-surface data-[state=on]:text-active-text min-h-7 min-w-0 flex-1 border px-1 py-1 font-normal"
    >
      <Icon size={14} aria-hidden="true" />
    </ToggleGroup.Item>
  {/each}
</ToggleGroup.Root>
