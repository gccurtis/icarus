<script lang="ts">
  import type { Snippet } from "svelte";

  import { PanelActor } from "$authored-components/panel";

  /**
   * One message in a thread: who said it, when, and everything it carries.
   *
   * **No bubbles, and no alignment flip.** Both sides get the same frame at the
   * same width. The messages here are not one-liners — a reply arrives with a
   * quotation, a list of calls, a bar for work still running and a decision to
   * take, and a right-aligned bubble hands half the measure back for nothing. A
   * thread in this application is closer to a document you can add to than to a
   * chat, and the rendering should not argue otherwise.
   *
   * **The rail is what makes a multi-part message legible.** An agent's turn is
   * regularly four blocks tall, and with nothing running down its left edge the
   * reader cannot see where one message stops and the next one's name starts.
   * It is the cheapest answer available and it is doing real work, which is why
   * it is here rather than left as a spacing decision in the caller.
   *
   * **The actor is not a link here, and everywhere else it is.** `PanelActor`'s
   * rule is that a face is always a way in; the exception it names is an actor
   * who is already the subject. In a two-party thread both actors are the
   * subject, they are repeated on every message, and turning forty repetitions
   * of the same two names into forty targets is noise. The way in lives once, in
   * the panel beside the thread.
   */
  let {
    author,
    actor = "person",
    at,
    note,
    children
  }: {
    author: string;
    /** Colours the face. With the name, it is what tells the two sides apart. */
    actor?: "person" | "agent";
    /** Clock time, not an age. A thread is read in the order it happened. */
    at: string;
    /**
     * The demo's own annotation, inside the message rather than beside it.
     *
     * This page's replies are four fixed samples on a timer and nothing is
     * running, so each one says which sample it is. It is page apparatus, and a
     * real thread has no such prop.
     */
    note?: string;
    children: Snippet;
  } = $props();
</script>

<article class="flex min-w-0 flex-col gap-1.5">
  <div class="flex min-w-0 items-center gap-2">
    <PanelActor name={author} kind={actor} />
    <span class="text-caption text-ink-muted shrink-0 tabular-nums">{at}</span>
  </div>

  <!--
    10px is the centre of PanelActor's 20px face, so the rail hangs from the
    avatar rather than from the text beside it.
  -->
  <div class="border-border-subtle ms-2.5 flex min-w-0 flex-col gap-2 border-s py-1 ps-4">
    {@render children()}

    {#if note}
      <p class="text-caption text-ink-muted m-0 max-w-prose italic">{note}</p>
    {/if}
  </div>
</article>
