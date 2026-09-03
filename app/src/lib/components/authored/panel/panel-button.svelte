<script lang="ts">
  import type { Component } from "svelte";

  import { Button } from "$vendored-components/button";
  import { traceNode } from "$development-components/trace.svelte";

  /**
   * A control in a panel: in the action row under the title, or inside a
   * section beside what it acts on. There is no third place — the frame carries
   * no footer band, because a button below a list of unbounded length is a
   * button nobody finds.
   *
   * **It is `simple-components/button` at its smallest size**, not a button
   * redrawn at panel scale. Everything a control owes the person using it —
   * the press translate, the focus ring, the disabled handling, the icon
   * sizing — is behaviour the registry component already has and a hand-rolled
   * one silently lacks. What this adds is the panel's vocabulary: a tone that
   * means something here, and a label-and-icon shape rather than free children.
   *
   * **A disabled control says why, or is absent.** This component cannot enforce
   * that, but it takes `title` for exactly that purpose, and the specifications
   * that disable a button all carry a reason beside it. A button that is
   * permanently impossible should not be drawn at all.
   */
  let {
    label,
    icon: Icon,
    tone = "default",
    disabled = false,
    title,
    onclick
  }: {
    label: string;
    icon?: Component<{ size?: number | string; "aria-hidden"?: boolean | "true" | "false" }>;
    /** `primary` for the one obvious action; `danger` for a destructive one. */
    tone?: "default" | "primary" | "danger" | "ghost";
    disabled?: boolean;
    /** Why it is disabled, or what it does when that is not obvious. */
    title?: string;
    onclick?: () => void;
  } = $props();

  // The marker is forwarded through `Button` onto the element it renders.
  const trace = traceNode("PanelButton", () => ({ label, tone, disabled, title }));

  /** The panel's four tones, said in the registry's vocabulary. */
  const VARIANT = {
    default: "outline",
    primary: "default",
    danger: "destructive",
    ghost: "ghost"
  } as const;
</script>

<!--
  `xs` is the 24px step: the pointer-target floor, and the only size that leaves
  room for three controls across a panel.
-->
<Button {...trace} variant={VARIANT[tone]} size="xs" {disabled} {title} {onclick}>
  {#if Icon}
    <Icon aria-hidden="true" />
  {/if}
  {label}
</Button>
