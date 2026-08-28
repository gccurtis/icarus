<script lang="ts">
  import SendHorizontal from "@lucide/svelte/icons/send-horizontal";

  import { Textarea } from "$lib/components/vendor/textarea";
  import { PanelChip } from "$components/authored/panel";
  import { ScreenAction } from "$components/authored/screen";

  /**
   * The next message, at the foot of the thread.
   *
   * **This is the component that makes the list a thread.** A feed and a thread
   * are both messages in time order; the difference is that one of them has a
   * "here" for a new message to belong to. Everything else — density, grouping,
   * an origin line — is a prop. This is not.
   *
   * **It is `simple-components/textarea`, not a div with `contenteditable` and
   * not a bare input.** A composer is a text field that grows, and the registry
   * field already has the focus ring, the disabled treatment, the placeholder
   * colour and `field-sizing: content`. The height following the text is the one
   * behaviour people notice immediately when it is missing, and it costs nothing
   * here because it is already there.
   *
   * **Enter sends and Shift-Enter is a newline**, which is the convention every
   * comparable surface keeps and therefore the one people arrive with. The
   * composition guard matters more than it looks: for anyone typing through an
   * IME, Enter commits the candidate word, and a composer that read that as a
   * send would fire a half-written message on nearly every line.
   *
   * **The send control is `ScreenAction`, at 32px.** A composer sits on the
   * plane rather than in a 300px panel, so `PanelButton`'s 24px would read as a
   * panel control that had wandered out. `ScreenAction`'s rule is that a screen
   * has one of these, for the one thing it makes — here that is a message, so
   * the header has none.
   *
   * **A disabled send says why.** There are two reasons it can be off and they
   * want different sentences: nothing typed, or a reply already on its way.
   */
  let {
    value = $bindable(""),
    pending = false,
    scope,
    onsend
  }: {
    value?: string;
    /** A reply is outstanding. Sending again would interleave two turns. */
    pending?: boolean;
    /** What this thread can look at, as the thread's own chips. */
    scope: readonly string[];
    onsend: () => void;
  } = $props();

  const ready = $derived(value.trim().length > 0 && !pending);

  const hint = $derived(
    pending
      ? "A sample reply is already on its way"
      : value.trim().length === 0
        ? "Type something to send"
        : "Send this message"
  );

  const key = (event: KeyboardEvent) => {
    if (event.key !== "Enter" || event.shiftKey) return;
    // Mid-composition Enter is the IME accepting a candidate, not a send.
    if (event.isComposing) return;
    event.preventDefault();
    if (ready) onsend();
  };
</script>

<div class="border-border-subtle bg-surface-panel shrink-0 border-t">
  <!-- The same measure the thread above is set on, so the field lines up under it. -->
  <div class="mx-auto flex w-full max-w-5xl flex-col gap-2 px-6 pt-4 pb-5">
    <Textarea
      bind:value
      onkeydown={key}
      placeholder="Ask the next question…"
      aria-label="The next message in this thread"
      class="text-body-sm bg-surface-canvas min-h-16 resize-none"
    />

    <div class="flex flex-wrap items-center gap-2">
      {#each scope as chip (chip)}
        <PanelChip tone="inactive">{chip}</PanelChip>
      {/each}
      <!--
        The reason a disabled send is disabled has to be visible text, not a
        `title`. The registry's button carries `disabled:pointer-events-none`, so
        a disabled one is never hit-tested and its tooltip can never appear — a
        reason nobody can reach is the same as no reason.
      -->
      <span class="text-caption text-ink-muted">
        {ready ? "Enter sends · Shift-Enter is a newline" : hint}
      </span>
      <div class="ms-auto">
        <ScreenAction
          label="Send"
          icon={SendHorizontal}
          disabled={!ready}
          title={hint}
          onclick={onsend}
        />
      </div>
    </div>
  </div>
</div>
