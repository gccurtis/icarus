<script lang="ts">
  import * as Select from "$vendored-components/select";
  import { traceNode } from "$development-components/trace.svelte";

  /**
   * A value chosen from a fixed set.
   *
   * The second of the three value editors, and the one to reach for whenever the
   * answer is one of a known list — a type, a role, a permission, a format.
   * `PanelEditableText` would accept anything typed into it, which for a closed
   * set means accepting a value the model will reject.
   *
   * `simple-components/select` unmodified underneath, so the listbox semantics,
   * the typeahead and the keyboard are bits-ui's. What this adds is the panel's
   * width and a flat `options` list, because a panel select is never a grouped
   * one — at 300px a grouped listbox is a menu.
   */
  let {
    value,
    label,
    options,
    placeholder = "Choose…",
    mixed = false,
    disabled = false,
    onchange
  }: {
    value: string;
    /** What is being chosen. The accessible name of the control. */
    label: string;
    options: readonly { value: string; label: string }[];
    placeholder?: string;
    /**
     * Several things are selected and they do not agree.
     *
     * Distinct from empty, and the distinction matters: empty means nobody has
     * answered, mixed means everybody has and the answers differ. Drawing the
     * second as the first is how a multiple selection quietly loses three
     * values to whichever one the panel happened to read.
     */
    mixed?: boolean;
    disabled?: boolean;
    onchange?: (next: string) => void;
  } = $props();

  // The root is a component rather than an element, so this marks no DOM.
  const trace = traceNode("PanelSelect", () => ({
    value,
    label,
    options,
    placeholder,
    mixed,
    disabled
  }));

  const chosen = $derived(mixed ? undefined : options.find((option) => option.value === value));
</script>

<Select.Root
  type="single"
  {value}
  {disabled}
  onValueChange={(next: string) => onchange?.(next)}
>
  <Select.Trigger size="sm" aria-label={label} class="text-body-sm w-full">
    {#if mixed}
      <span class="text-ink-muted italic">Mixed</span>
    {:else}
      {chosen?.label ?? placeholder}
    {/if}
  </Select.Trigger>
  <Select.Content>
    {#each options as option (option.value)}
      <Select.Item value={option.value} label={option.label}>{option.label}</Select.Item>
    {/each}
  </Select.Content>
</Select.Root>
