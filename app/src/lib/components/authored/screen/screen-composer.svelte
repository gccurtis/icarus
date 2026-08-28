<script lang="ts">
  import type { Snippet } from "svelte";
  import Send from "@lucide/svelte/icons/send";

  import { Button } from "$lib/components/vendor/button";
  import { Kbd, KbdGroup } from "$lib/components/vendor/kbd";
  import { Textarea } from "$lib/components/vendor/textarea";
  import { cn } from "$lib/components/vendor/utils";
  import { traceNode } from "$components/development/trace.svelte";

  /**
   * Where a person writes the thing that gets sent.
   *
   * **Not the Copilot's bar.** That one belongs to no tab: it lives in the middle
   * of the status bar, rises out of the status row when it opens, and is
   * deliberately disabled on Research — because that screen is already a
   * conversation with an agent, and a second composer floating over it would be
   * two ways to say the same thing. This is the composer a screen owns, at the
   * foot of the screen, and it is the reason the floating one can be switched
   * off.
   *
   * **Not `PanelEditableText`.** That hands back a value that is already on the
   * screen beside it — a name, a description, a formula — so it is a panel row
   * wide, it commits on blur, and Escape puts the old text back. None of that
   * makes sense for something that does not exist yet. This grows as it is
   * written, keeps what is in it until it is sent, and has a send.
   *
   * **The scope is required.** A request states what it will be able to see
   * where the request is written; the specifications are consistent about it,
   * and a composer that hides its scope is the thing they are avoiding. So
   * `scope` is not optional — a composer whose message can see nothing has to
   * say that too, rather than saying nothing.
   *
   * **Enter or modifier-Enter is the caller's, and whichever it is, it is shown.**
   * The default is modifier-Enter: a question on the plane runs to several lines,
   * and a bare Enter that sends turns every paragraph break into an accidental
   * send. `submit="enter"` belongs to a composer whose messages are one line.
   * Either way the keycaps sit beside the send control, because a keystroke
   * nobody is told about is a keystroke nobody uses — and the one that is not
   * bound has to stay a newline.
   *
   * **It does not clear itself.** Sending can fail, and a composer that emptied
   * itself the moment the button was pressed would lose what someone wrote. The
   * caller owns `value`, and clears it when the send has actually happened.
   */
  let {
    label,
    value = $bindable(""),
    placeholder,
    rows = 2,
    sendLabel = "Send",
    submit = "modifier-enter",
    onsend,
    about,
    scope
  }: {
    /** What is being written. The field's accessible name. */
    label: string;
    value?: string;
    placeholder?: string;
    /** The height it starts at. It grows from there as it is written. */
    rows?: number;
    /** The send control's word: "Send", "Ask", "Reply". */
    sendLabel?: string;
    /**
     * Which keystroke sends, and therefore which one is a newline.
     *
     * `modifier-enter` — Ctrl-Enter or Cmd-Enter sends, Enter breaks the line.
     * `enter` — Enter sends, Shift-Enter breaks the line.
     */
    submit?: "enter" | "modifier-enter";
    /** Given the trimmed text. Never called with an empty message. */
    onsend: (message: string) => void;
    /**
     * What this message is part of: the mode it is in, the turn it answers, who
     * it is addressed to. Above the field, because it frames what is about to be
     * written rather than qualifying it afterwards.
     */
    about?: Snippet;
    /**
     * What the message will be able to see: a Context, the web, an attachment,
     * an addressee. Beside the send control, where it is read on the way to it.
     */
    scope: Snippet;
  } = $props();

  const trace = traceNode("ScreenComposer", () => ({
    label,
    value,
    placeholder,
    rows,
    sendLabel,
    submit
  }));

  /**
   * Which modifier to draw. `Ctrl` on a Mac is wrong and `⌘` everywhere else is
   * worse, and both keys are accepted regardless of what is shown.
   */
  let apple = $state(false);
  $effect(() => {
    apple = /mac|iphone|ipad/i.test(navigator.userAgent);
  });

  const caps = $derived(submit === "enter" ? ["Enter"] : [apple ? "⌘" : "Ctrl", "Enter"]);
  const shortcut = $derived(submit === "enter" ? "Enter" : "Control+Enter Meta+Enter");

  const written = $derived(value.trim());

  const send = () => {
    if (written === "") return;
    onsend(written);
  };

  const typed = (event: KeyboardEvent) => {
    /* An IME composition ends on Enter. Sending there would send a half-word. */
    if (event.key !== "Enter" || event.isComposing) return;

    const sends =
      submit === "enter"
        ? !event.shiftKey && !event.ctrlKey && !event.metaKey && !event.altKey
        : event.ctrlKey || event.metaKey;
    if (!sends) return;

    event.preventDefault();
    send();
  };
</script>

<!--
  A form, so the send control is a submit and the browser's own semantics carry
  the press. The focus ring belongs to the whole composer rather than to the
  field inside it: the frame is what a reader sees as the control, and a ring
  drawn around the textarea alone leaves the scope row outside the thing that
  looks focused.
-->
<form
  {...trace}
  class={cn(
    "border-border-subtle bg-surface-panel rounded-panel flex flex-col gap-2 border p-2",
    "focus-within:border-interactive-border focus-within:ring-interactive-border/40 focus-within:ring-1"
  )}
  onsubmit={(event: SubmitEvent) => {
    event.preventDefault();
    send();
  }}
>
  {#if about}
    <div class="flex flex-wrap items-center gap-2 px-1">{@render about()}</div>
  {/if}

  <Textarea
    bind:value
    {rows}
    {placeholder}
    aria-label={label}
    onkeydown={typed}
    class="text-body-sm max-h-48 min-h-0 resize-none border-none bg-transparent px-1 shadow-none focus-visible:ring-0"
  />

  <div class="flex flex-wrap items-center gap-1.5">
    {@render scope()}

    <div class="ms-auto flex items-center gap-2">
      <!--
        The keystroke, drawn. It is the only place the choice between Enter and
        modifier-Enter is discoverable, and the reader has to know which of the
        two is still a newline before they trust the field with a paragraph.
      -->
      <KbdGroup>
        {#each caps as cap (cap)}
          <Kbd>{cap}</Kbd>
        {/each}
      </KbdGroup>

      <Button type="submit" size="sm" disabled={written === ""} aria-keyshortcuts={shortcut}>
        <Send aria-hidden="true" />
        {sendLabel}
      </Button>
    </div>
  </div>
</form>
