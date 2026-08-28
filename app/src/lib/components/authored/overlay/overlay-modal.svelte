<script lang="ts">
  import type { Snippet } from "svelte";
  import TriangleAlert from "@lucide/svelte/icons/triangle-alert";
  import X from "@lucide/svelte/icons/x";

  import { Button } from "$vendored-components/button";
  import * as Dialog from "$vendored-components/dialog";
  import { cn } from "$vendored-components/utils";
  import { traceNode } from "$development-components/trace.svelte";

  /**
   * Work that wants the whole screen: building a formula, defining a variable.
   *
   * The counterpart to `OverlayInsertMenu`. A menu is for picking one of a list
   * you can hold in your head; this is for the cases where the answer has to be
   * *constructed* — an expression, a name and a type and a default, a thing with
   * parts that have to agree. Those need room, a title saying what is being
   * built, and a moment at the end where you say yes.
   *
   * **`simple-components/dialog` underneath**, so the focus trap, the scroll
   * lock, the inert background and the labelled-by wiring are bits-ui's. A
   * hand-rolled overlay gets all four wrong in ways nobody notices until a
   * keyboard reaches the page behind it.
   *
   * **Dismissing discards.** That is the decision, and it is stated rather than
   * left to whatever the caller happens to do: `oncancel` means throw the draft
   * away, and nothing here parks it for later. The generous-looking
   * alternative — keep the draft so reopening resumes it — was rejected because
   * a half-built formula surviving against a cell you have since moved on from
   * is a trap rather than a kindness, and because there is nowhere in the model
   * to park it. Where resuming genuinely matters the work belongs to the thing
   * being edited rather than to an overlay, and that is a panel.
   *
   * **Because dismissing discards, it cannot happen by accident.** With
   * `unsaved` set, a click outside never closes — it asks, in the footer — and
   * Escape asks the same question, with a second Escape answering it. A stray
   * click on the plane behind must not destroy ten minutes of expression. With
   * nothing unsaved all three close at once, because there is nothing to lose
   * and a confirmation over nothing is noise. The question lives in the footer
   * rather than in a second dialog on top of this one: nested dialogs fight over
   * the focus trap, and the answer belongs beside the buttons it replaces.
   *
   * **The confirm names its action.** `confirm` is required and there is no
   * default, because a default is how "OK" gets back in. "OK" answers a question
   * nobody asked and leaves the reader to reconstruct what the press will do
   * from the title. "Insert the formula" and "Define the variable" do not.
   *
   * **A blocked confirm says why in the footer, not only in a tooltip.** A
   * tooltip is not a stated reason to anyone on a keyboard or a touch screen, so
   * `blocked` is drawn as text beside the button and tied to it with
   * `aria-describedby`. Confirming closes the modal — if the work cannot be
   * committed, `blocked` says so before the press rather than after it.
   *
   * **The gutter is the panel's gutter.** Header, body and footer share the
   * 12px the panel vocabulary uses, so a `PanelFields` block dropped into the
   * body lines its labels up with the title above it. The body itself carries no
   * horizontal padding for the same reason: what goes in it brings its own.
   */
  let {
    open = $bindable(false),
    title,
    description,
    confirm,
    blocked,
    cancel = "Cancel",
    tone = "default",
    width = "wide",
    unsaved = false,
    onconfirm,
    oncancel,
    children,
    trigger
  }: {
    open?: boolean;
    /** What is being built. The dialog's accessible name. */
    title: string;
    /** One sentence qualifying the title, where the title is not enough. */
    description?: string;
    /** The action, named. "Insert the formula", never "OK". */
    confirm: string;
    /** Why the confirm cannot be pressed. Present disables it and is shown. */
    blocked?: string;
    cancel?: string;
    /** `danger` for a confirm that destroys something. */
    tone?: "default" | "danger";
    /** `wide` builds something; `narrow` asks about one value. */
    width?: "narrow" | "wide";
    /** There is work in here that would be lost. Guards every way out. */
    unsaved?: boolean;
    onconfirm: () => void;
    /** The draft was abandoned — by Cancel, by Escape, or by the ✕. */
    oncancel?: () => void;
    /** The body. `$components/authored/panel` is what goes in it. */
    children: Snippet;
    /** A control that opens it, where the caller has not got its own. */
    /** Rendered through the primitive's child snippet, so it stays one element. */
    trigger?: Snippet<[{ props: Record<string, unknown> }]>;
  } = $props();

  // The root is `Dialog.Root`, a component rather than an element, so nothing marks the DOM.
  const trace = traceNode("OverlayModal", () => ({
    open,
    title,
    description,
    confirm,
    blocked,
    cancel,
    tone,
    width,
    unsaved
  }));

  const uid = $props.id();

  /** The footer is showing the discard question instead of the ordinary pair. */
  let asking = $state(false);
  /** The safe answer, focused when the question appears. */
  let keep = $state<HTMLElement | null>(null);

  const WIDTH = {
    narrow: "sm:max-w-md",
    wide: "sm:max-w-2xl"
  } as const;

  const dismiss = () => {
    asking = false;
    open = false;
    oncancel?.();
  };

  /** Cancel and the ✕ arrive here: leave, or ask first if there is anything to lose. */
  const leave = () => {
    if (unsaved) {
      asking = true;
      return;
    }
    dismiss();
  };

  /** Escape twice is how the question gets answered without reaching for a button. */
  const escaped = () => {
    if (asking) {
      dismiss();
      return;
    }
    leave();
  };

  const commit = () => {
    if (blocked) return;
    open = false;
    onconfirm();
  };

  $effect(() => {
    if (!open) asking = false;
  });

  $effect(() => {
    if (asking) keep?.focus();
  });
</script>

<Dialog.Root bind:open>
  {#if trigger}
    <!-- Through the primitive's child snippet: see OverlayInsertMenu. -->
    <Dialog.Trigger>
      {#snippet child({ props })}
        {@render trigger({ props })}
      {/snippet}
    </Dialog.Trigger>
  {/if}

  <Dialog.Content
    showCloseButton={false}
    onEscapeKeydown={(event: KeyboardEvent) => {
      event.preventDefault();
      escaped();
    }}
    onInteractOutside={(event: PointerEvent) => {
      event.preventDefault();
      leave();
    }}
    class={cn(
      "rounded-overlay border-border-subtle bg-surface-elevated shadow-overlay gap-0 overflow-hidden border p-0",
      WIDTH[width]
    )}
  >
    <Dialog.Header class="border-border-subtle gap-0.5 border-b px-3 py-2.5 pe-10">
      <Dialog.Title class="text-body text-ink-primary font-medium">{title}</Dialog.Title>
      {#if description}
        <Dialog.Description class="text-caption text-ink-muted">
          {description}
        </Dialog.Description>
      {/if}
    </Dialog.Header>

    <!--
      No horizontal padding: the panel vocabulary that goes in here carries the
      gutter, and a second one nested inside the first is 24px of nothing.
    -->
    <div class="flex max-h-[60vh] min-h-0 flex-col gap-1.5 overflow-y-auto py-3">
      {@render children()}
    </div>

    <Dialog.Footer
      class="border-border-subtle bg-surface-panel mx-0 mb-0 flex-row flex-wrap items-center justify-end gap-2 rounded-none px-3 py-2.5"
    >
      {#if asking}
        <p class="text-caption text-ink-secondary m-0 me-auto">
          Close this and lose what you have typed?
        </p>
        <Button bind:ref={keep} variant="outline" size="sm" onclick={() => (asking = false)}>
          Keep editing
        </Button>
        <Button variant="destructive" size="sm" onclick={dismiss}>Discard</Button>
      {:else}
        {#if blocked}
          <p
            id={uid + "-blocked"}
            class="text-caption text-attention-text m-0 me-auto flex items-center gap-1.5"
          >
            <TriangleAlert size={13} aria-hidden="true" class="shrink-0" />
            {blocked}
          </p>
        {/if}
        <Button variant="outline" size="sm" onclick={leave}>{cancel}</Button>
        <Button
          variant={tone === "danger" ? "destructive" : "default"}
          size="sm"
          disabled={Boolean(blocked)}
          title={blocked}
          aria-describedby={blocked ? uid + "-blocked" : undefined}
          onclick={commit}
        >
          {confirm}
        </Button>
      {/if}
    </Dialog.Footer>

    <!--
      Our own ✕ rather than the registry's, which is a `Dialog.Close` and would
      close straight past the question. Every way out has to be the same way out.
    -->
    <Button
      variant="ghost"
      size="icon-sm"
      onclick={leave}
      title="Close"
      aria-label="Close"
      class="text-ink-muted absolute end-1.5 top-1.5"
    >
      <X aria-hidden="true" />
    </Button>
  </Dialog.Content>
</Dialog.Root>
