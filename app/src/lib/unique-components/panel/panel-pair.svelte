<script lang="ts">
  import X from "@lucide/svelte/icons/x";

  import { Button } from "$lib/simple-components/button";
  import { traceNode } from "$lib/trace/trace.svelte";
  import PanelEditableText from "$lib/unique-components/panel/panel-editable-text.svelte";

  /**
   * One pair inside a `PanelPairs` block: a name the reader chose, its value,
   * and the way to take it away again.
   *
   * Three cells with no wrapper of their own, so they sit directly in the
   * parent's grid and every pair's value starts at the same x — the same reason
   * `PanelField` emits a bare `dt` and `dd` rather than a row.
   *
   * **Both halves are single-click.** A pair is a thing the reader made and came
   * back to change; making them hunt for a second click on their own data is the
   * wrong default here, whatever it is for a title in a list.
   *
   * **Removing is not an edit and does not confirm here.** A pair is cheap to
   * retype, and a dialog over a two-word row costs more than the mistake. A
   * caller for whom that is wrong passes no `onremove` and offers its own.
   */
  let {
    name,
    value,
    placeholder = "Empty",
    mono = true,
    onrename,
    onchange,
    onremove
  }: {
    name: string;
    value: string;
    placeholder?: string;
    /** Names are identifiers far more often than not, so mono is the default. */
    mono?: boolean;
    onrename?: (next: string) => void;
    onchange?: (next: string) => void;
    /** Absent means this pair cannot be removed — a required one, say. */
    onremove?: () => void;
  } = $props();

  // Three roots — the two cells and the remove cell — so the marker goes on the first.
  const trace = traceNode("PanelPair", () => ({ name, value, placeholder, mono }));
</script>

<span {...trace} class="min-w-0">
  <PanelEditableText
    value={name}
    label="Name of this pair"
    placeholder="Name"
    mono
    activate="click"
    onchange={onrename}
  />
</span>

<span class="min-w-0">
  <PanelEditableText
    {value}
    {placeholder}
    {mono}
    label={`Value of ${name}`}
    activate="click"
    onchange={onchange}
  />
</span>

{#if onremove}
  <Button
    variant="ghost"
    size="icon-xs"
    onclick={onremove}
    aria-label={`Remove ${name}`}
    title={`Remove ${name}`}
    class="text-ink-muted hover:text-danger-text hover:bg-danger-surface size-5"
  >
    <X aria-hidden="true" />
  </Button>
{:else}
  <span class="size-5"></span>
{/if}
