<script lang="ts">
  import * as ToggleGroup from "$vendored-components/toggle-group";
  import { cn } from "$vendored-components/utils";
  import { traceNode } from "$development-components/trace.svelte";

  /**
   * Several independent on-or-off options, as one row.
   *
   * `PanelChoice` picks exactly one, which is right for a scope and wrong for a
   * mark: bold and italic are not alternatives, and a control that made them
   * mutually exclusive would be lying about the text it describes. `PanelToggle`
   * is one switch with a name beside it, which is right for one option and
   * absurd for six stacked down a flank.
   *
   * A mark is the case in between — a set whose members are independent, short
   * enough to name in a word, and read as a group. Bold, italic, underline,
   * strikethrough, code. Locked and hidden on a layer. Header row and banded rows
   * on a table.
   *
   * `simple-components/toggle-group` in multiple mode underneath, so each item
   * carries its own pressed state and arrow-key movement across the row comes
   * with it.
   *
   * **Mixed is a third state and is drawn as one.** Where a selection spans text
   * that is partly bold, the option is neither on nor off: it is struck through
   * with a dashed edge, because a mark shown on would claim every character
   * carries it. Pressing it sets all of them, which is how a mixed state
   * resolves.
   */
  let {
    label,
    value = $bindable<string[]>([]),
    options,
    mixed = [],
    disabled = false,
    flush = false,
    onchange
  }: {
    /** What this set of marks applies to. The group's accessible name. */
    label: string;
    /** The marks that are on. */
    value?: string[];
    options: readonly { value: string; label: string }[];
    /** Marks that some of the selection carries and some does not. */
    mixed?: readonly string[];
    disabled?: boolean;
    /** Drop the panel gutter, for a row already inside a padded region. */
    flush?: boolean;
    onchange?: (next: string[]) => void;
  } = $props();

  // The marker is forwarded through `ToggleGroup.Root` onto the element it renders.
  const trace = traceNode("PanelMarks", () => ({ label, value, options, mixed, disabled, flush }));
</script>

<ToggleGroup.Root
  {...trace}
  type="multiple"
  bind:value
  {disabled}
  aria-label={label}
  onValueChange={(next: string[]) => onchange?.(next)}
  class={cn("flex flex-wrap justify-start gap-1", flush ? "px-0" : "px-3")}
>
  {#each options as option (option.value)}
    <ToggleGroup.Item
      value={option.value}
      title={mixed.includes(option.value) ? `${option.label} — some of the selection` : option.label}
      class={cn(
        "text-caption border-border-subtle bg-surface-panel text-ink-secondary rounded-control",
        "data-[state=on]:border-active-border data-[state=on]:bg-active-surface data-[state=on]:text-active-text",
        "h-auto min-w-0 border px-1.5 py-0.5 font-normal",
        /* Neither on nor off: the dashes are what say "some of it does". */
        mixed.includes(option.value) && "border-dashed opacity-70"
      )}
    >
      {option.label}
    </ToggleGroup.Item>
  {/each}
</ToggleGroup.Root>
