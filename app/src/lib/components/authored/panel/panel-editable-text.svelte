<script lang="ts">
  import Pencil from "@lucide/svelte/icons/pencil";

  import { Input } from "$vendored-components/input";
  import { Textarea } from "$vendored-components/textarea";
  import { cn } from "$vendored-components/utils";
  import { traceNode } from "$development-components/trace.svelte";

  /**
   * A value the reader can change, edited where it is shown.
   *
   * The counterpart to every other word in this vocabulary: those all *display*
   * something the model owns, and this is the one that hands it back. A name, a
   * description, a formula, a variable's value — anything whose current text is
   * worth reading in place and worth changing without going somewhere else.
   *
   * **It is a value, not a field.** The label above it and the row around it
   * belong to `PanelField`, exactly as they do for a chip or a link, so an
   * editable value drops into a `PanelFields` block beside read-only ones with
   * no second layout to keep in step.
   *
   * **Single click by default.** A value drawn as editable is a value someone
   * came to change, and asking for a second click to honour the first is a
   * toll on the common case. Double-click is still available, for the narrower
   * situation where the text has another job — a title that is also a target,
   * a cell that is also a selection — and a single click would take that job
   * away.
   *
   * **Every gesture has a keyboard equivalent**, which is the part a
   * double-click-only implementation loses: no one can double-click with a
   * keyboard. The idle state is a button, so Enter, Space and F2 all open it,
   * Escape abandons the edit, and Enter commits — Cmd-Enter when the value is
   * multiline and Enter has to stay a newline.
   *
   * **Committing on blur is deliberate.** Clicking away from a half-typed name
   * and losing it is the worse failure: this is an edit of something that
   * already exists, and the reader's last typed state is the one they meant.
   * Escape is the way to say otherwise, and it is why Escape exists here at all.
   */
  let {
    value,
    label,
    placeholder = "Empty",
    multiline = false,
    mono = false,
    activate = "click",
    mixed = false,
    disabled = false,
    onchange
  }: {
    value: string;
    /** What is being edited. The accessible name of the control. */
    label: string;
    /** Stands in when the value is empty, so an empty value is still a target. */
    placeholder?: string;
    /**
     * Several things are selected and their values differ.
     *
     * Not the same as empty, and the difference is the whole point: empty means
     * nobody has written one, mixed means several have and they disagree. A
     * panel that spelled the second as the first would offer three different
     * titles as one blank field, and typing into it would silently overwrite two
     * values the reader never saw. Editing starts from nothing rather than from
     * one of them, because there is no honest one to start from.
     */
    mixed?: boolean;
    /** A description or a prompt rather than a name. Enter stays a newline. */
    multiline?: boolean;
    /** For values you would retype: an identifier, a key, an expression. */
    mono?: boolean;
    activate?: "click" | "double-click";
    disabled?: boolean;
    /** Absent means read-only, and the value renders as plain text. */
    onchange?: (next: string) => void;
  } = $props();

  // Four roots, one per state, so the marker goes on each that is an element; the
  // two editing branches are registry components and cannot carry it.
  const trace = traceNode("PanelEditableText", () => ({
    value,
    label,
    placeholder,
    multiline,
    mono,
    activate,
    mixed,
    disabled
  }));

  const editable = $derived(!disabled && onchange !== undefined);

  let editing = $state(false);
  let draft = $state("");
  let control = $state<HTMLElement | null>(null);

  const start = () => {
    if (!editable) return;
    // Mixed opens empty. Seeding one of several differing values would present
    // it as the answer, and committing without touching it would apply it to
    // all of them.
    draft = mixed ? "" : value;
    editing = true;
  };

  const commit = () => {
    if (!editing) return;
    editing = false;
    const next = draft.trim();
    if (next !== value) onchange?.(next);
  };

  $effect(() => {
    if (!editing) return;
    const field = control as HTMLInputElement | HTMLTextAreaElement | null;
    field?.focus();
    field?.select();
  });

  const editKey = (event: KeyboardEvent) => {
    if (event.key === "Escape") {
      event.preventDefault();
      editing = false;
      return;
    }
    if (event.key !== "Enter") return;
    // A multiline value keeps Enter as a newline; the modifier is how it commits.
    if (multiline && !(event.metaKey || event.ctrlKey)) return;
    event.preventDefault();
    commit();
  };

  /**
   * The value first, then the gesture. A value in a panel truncates, and a
   * truncated value with no way to recover it is worse than an undiscoverable
   * gesture — so hover text carries both, in that order.
   */
  const hint = $derived(
    activate === "click" ? `Change ${label}` : `Double-click to change ${label}`
  );
  const hover = $derived(value ? `${value}\n${hint}` : hint);

  const openKey = (event: KeyboardEvent) => {
    if (!["Enter", " ", "F2"].includes(event.key)) return;
    event.preventDefault();
    start();
  };
</script>

{#if editing}
  {#if multiline}
    <Textarea
      bind:ref={control}
      bind:value={draft}
      onkeydown={editKey}
      onblur={commit}
      aria-label={label}
      class={cn("text-body-sm min-h-14 w-full", mono && "text-mono font-mono")}
    />
  {:else}
    <Input
      bind:ref={control}
      bind:value={draft}
      onkeydown={editKey}
      onblur={commit}
      aria-label={label}
      class={cn("text-body-sm h-7 w-full", mono && "text-mono font-mono tabular-nums")}
    />
  {/if}
{:else if editable}
  <button
    {...trace}
    type="button"
    onclick={activate === "click" ? start : undefined}
    ondblclick={start}
    onkeydown={openKey}
    title={hover}
    class={cn(
      "group border-transparent hover:border-border-subtle hover:bg-surface-panel-hover flex w-full min-w-0 cursor-text items-start gap-1 rounded-control border px-1 py-0.5 text-start",
      /* -mx-1 keeps the idle text on the same left edge as a read-only value:
         the padding exists for the hover box, not for the text. */
      "-mx-1",
      mono && "text-mono font-mono tabular-nums",
      !mono && "text-body-sm",
      value && !mixed ? "text-ink-primary" : "text-ink-muted italic"
    )}
  >
    <span class={cn("min-w-0 flex-1", multiline ? "whitespace-pre-wrap" : "truncate")}>
      {mixed ? "Mixed" : value || placeholder}
    </span>
    <Pencil
      size={11}
      aria-hidden="true"
      class="text-ink-muted mt-1 shrink-0 opacity-0 transition-opacity group-hover:opacity-100"
    />
  </button>
{:else}
  <span {...trace} class={cn("min-w-0", mono && "text-mono font-mono tabular-nums", !value && "text-ink-muted italic")}>
    {value || placeholder}
  </span>
{/if}
