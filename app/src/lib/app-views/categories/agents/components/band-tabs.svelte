<script lang="ts">
  import * as ToggleGroup from "$vendored-components/toggle-group";

  let {
    label,
    options,
    value,
    onchange
  }: {
    label: string;
    options: string;
    value: string;
    onchange: (next: string) => void;
  } = $props();

  const entries = $derived(options.split(",").map((entry) => entry.trim()));
</script>

<ToggleGroup.Root
  type="single"
  size="sm"
  variant="outline"
  {value}
  aria-label={label}
  onValueChange={(next: string) => {
    if (next !== "") onchange(next);
  }}
>
  {#each entries as entry (entry)}
    <ToggleGroup.Item value={entry} class="text-caption px-3">{entry}</ToggleGroup.Item>
  {/each}
</ToggleGroup.Root>
