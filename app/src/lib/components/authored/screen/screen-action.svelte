<script lang="ts">
  import type { Component } from "svelte";

  import { Button } from "$vendored-components/button";
  import { traceNode } from "$development-components/trace.svelte";

  /**
   * The control in a screen's header: the one thing this screen makes.
   *
   * Six workspaces wrote the same hundred-character class string, byte for byte,
   * to get it — New template, New Persona, New Automation, New thread, and two
   * more. Every one of them declined `PanelButton` and hand-wrote 32px, which is
   * the whole argument for this being a separate word: `PanelButton` is pinned
   * at 24px because that is "the only size that leaves room for three controls
   * across a panel", and a plane has no such constraint.
   *
   * **32px rather than the panel's 24**, so a screen's action never reads as a
   * panel control that wandered out onto the plane.
   *
   * **The interactive role is reserved for the one thing the screen makes**, and
   * a screen can have only one. That is the reason this is a component rather
   * than a `PanelButton` variant: `ScreenHeader` takes a snippet, and nothing in
   * a snippet stops a screen from growing three equally-loud primary actions.
   * Anything else a header needs is a `PanelButton` beside this one.
   *
   * **Always an icon and a label, never either alone.** An icon-only control at
   * the top of a screen is a guess, and a label-only one loses the row.
   */
  let {
    label,
    icon: Icon,
    disabled = false,
    title,
    onclick
  }: {
    /** What it makes, as a verb phrase: "New template", not "Add". */
    label: string;
    icon: Component<{ size?: number | string; "aria-hidden"?: boolean | "true" | "false" }>;
    disabled?: boolean;
    title?: string;
    onclick?: () => void;
  } = $props();

  // `Button` forwards its rest props, so the marker lands on the element it renders.
  const trace = traceNode("ScreenAction", () => ({ label, disabled, title }));
</script>

<Button
  {...trace}
  size="default"
  {disabled}
  {title}
  {onclick}
  class="border-interactive-border bg-interactive-surface text-interactive-text hover:bg-interactive-surface-hover text-body-sm rounded-control border font-normal"
>
  <Icon aria-hidden="true" />
  {label}
</Button>
