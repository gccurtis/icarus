<script lang="ts">
  import type { Snippet } from "svelte";

  import { cn } from "$vendored-components/utils";
  import { traceNode } from "$development-components/trace.svelte";

  /**
   * One label and its value, inside a `Fields` block.
   *
   * The value is a snippet rather than a string because half of them are not
   * strings: a chip, a link to an actor, a toggle, an avatar and a name. A
   * component taking `value: string` would be a component every second caller
   * has to work around.
   *
   * **`mono` is for values you would retype.** An identifier, an address, a
   * timestamp, a number — anything where the difference between two characters
   * matters and proportional type hides it. Not for emphasis.
   *
   * **`stacked` is for values that are longer than the column.** A flank is
   * narrow and its label column takes a third of it, so a title or a
   * description set beside its label wraps to three lines and reads as a
   * paragraph with a word stuck to its left. Stacking puts the label above and
   * gives the value the full width, which is what every editable field in the
   * specifications does.
   */
  let {
    label,
    mono = false,
    stacked = false,
    children
  }: {
    label: string;
    /** Set the value in mono with tabular figures. */
    mono?: boolean;
    /** Put the label above the value, and give the value the full width. */
    stacked?: boolean;
    children: Snippet;
  } = $props();

  // Two roots — a `dt` and a `dd` — so the marker goes on the first of them.
  const trace = traceNode("PanelField", () => ({ label, mono, stacked }));
</script>

<!--
  The label carries its own text as a title. A five-rem column truncates
  "Display name" and "Project work", and a truncated label with no way to
  recover it is a field whose meaning is gone.
-->
<dt {...trace}
  title={stacked ? undefined : label}
  class={cn("text-caption text-ink-muted truncate", stacked && "col-span-2")}
>
  {label}
</dt>
<dd
  class={cn(
    "text-body-sm text-ink-primary m-0 min-w-0",
    stacked && "col-span-2 -mt-1",
    mono && "font-mono text-mono tabular-nums"
  )}
>
  {@render children()}
</dd>
