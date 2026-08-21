<script lang="ts">
  import type { Component } from "svelte";

  import * as Avatar from "$lib/simple-components/avatar";
  import { cn } from "$lib/simple-components/utils";

  /**
   * Events on a rail, in the order they happened.
   *
   * An activity feed, a thread's history, a connector's sync record. Always
   * retrospective: these occurred, in this order, and nothing about them is
   * going to change.
   *
   * **A list of `PanelRow`s cannot say "and then".** A row list has no ordering
   * cue, so a feed read from the bottom up reads exactly like one read from the
   * top down and the order has to be taken on trust from the times at the
   * right-hand end. The rail is the ordering, and it is the reason this is an
   * `<ol>` as well: the sequence is the content rather than a way of arranging
   * it.
   *
   * **The time is a string the caller has already phrased.** "4 minutes ago",
   * "14:02", "3 March". A component that formatted it would be a second opinion
   * about the reader's locale and about whether relative or absolute is honest
   * here, and it has grounds for neither. `PanelProgress` leaves `detail` to the
   * caller for the same reason.
   *
   * **The rail stops at the last entry.** A line running on past the final event
   * promises another one under it, which is the one thing a feed that has
   * reached its end must not say.
   */

  type Tone = "default" | "success" | "danger" | "attention" | "active" | "intelligence";

  type Entry = {
    /** Stable across refreshes: this is the each block's key. */
    id: string;
    /** What happened, as a line. Wraps — it is a sentence, not a title to scan. */
    what: string;
    /** The qualifier under it: a fragment, a target, a reason. */
    detail?: string;
    /** Already phrased. See above. */
    time: string;
    /**
     * Who did it, drawn as a face on the rail. The name still belongs in `what`
     * — the marker is a mark, and a mark is not a label.
     */
    actor?: string;
    /** For an event nobody performed: a sync, an expiry, a threshold crossed. */
    icon?: Component<{ size?: number | string; "aria-hidden"?: boolean | "true" | "false" }>;
    /** Colours the marker where the words already carry it. Never the only cue. */
    tone?: Tone;
    /** Opens what the event was about. */
    onselect?: () => void;
  };

  let {
    entries,
    label,
    size = "row",
    flush = false,
    empty = "Nothing has happened yet."
  }: {
    /**
     * In reading order, and never sorted here: `time` is a phrase by the time it
     * arrives, and sorting would mean parsing it back into a moment.
     */
    readonly entries: readonly Entry[];
    /**
     * What this is a feed of. The list's accessible name.
     *
     * Not drawn. A visible heading over a feed is `PanelSection`'s, which is
     * also where the count belongs.
     */
    label: string;
    /**
     * `row` in a flank, `head` on a plane.
     *
     * A size rather than a `ScreenTimeline` beside this one, on the argument
     * `PanelSentence` makes: one feed drawn by two components is two ways to
     * read one history, and they drift.
     */
    size?: "row" | "head";
    /** Drop the panel gutter, for a timeline inside an already-padded region. */
    flush?: boolean;
    /** What an empty feed says. An empty `<ol>` draws nothing and reads as a fault. */
    empty?: string;
  } = $props();

  const MARK: Record<Tone, string> = {
    default: "text-ink-muted",
    success: "text-success-text",
    danger: "text-danger-text",
    attention: "text-attention-text",
    active: "text-active-text",
    intelligence: "text-intelligence-text"
  };

  /**
   * Two letters, the way `PanelActor` cuts them. Not `PanelActor` itself: that
   * word is a face *and* the name beside it at 40px, and here the name is in the
   * line and the face is a 20px node on a rail.
   */
  const initials = (name: string): string =>
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((word) => word[0]?.toUpperCase() ?? "")
      .join("");

  const marker = $derived(size === "head" ? "size-6" : "size-5");
  const glyph = $derived(size === "head" ? 14 : 12);
  const line = $derived(size === "head" ? "text-body" : "text-body-sm");
</script>

{#if entries.length === 0}
  <p class={cn("text-caption text-ink-muted m-0", flush ? "px-0" : "px-3")}>{empty}</p>
{:else}
  <ol aria-label={label} class={cn("m-0 flex list-none flex-col p-0", flush ? "px-0" : "px-3")}>
    {#each entries as entry, index (entry.id)}
      {@const last = index === entries.length - 1}
      {@const tone = MARK[entry.tone ?? "default"]}
      {@const Icon = entry.icon}
      <li class="flex gap-2">
        <!--
          The marker column is hidden from assistive technology: the face repeats
          a name the line already says, and the connector is the drawing of an
          order the `<ol>` states outright.
        -->
        <span class={cn("flex flex-col items-center gap-1", tone)} aria-hidden="true">
          {#if entry.actor}
            <Avatar.Root
              class={cn("border-border-subtle bg-surface-panel shrink-0 border", marker)}
            >
              <Avatar.Fallback class="text-ink-secondary bg-transparent text-[0.5rem] font-medium">
                {initials(entry.actor)}
              </Avatar.Fallback>
            </Avatar.Root>
          {:else if Icon}
            <span
              class={cn(
                "border-border-subtle bg-surface-panel flex shrink-0 items-center justify-center rounded-full border",
                marker
              )}
            >
              <Icon size={glyph} aria-hidden="true" />
            </span>
          {:else}
            <span class={cn("flex shrink-0 items-center justify-center", marker)}>
              <span class="size-1.5 rounded-full bg-current"></span>
            </span>
          {/if}

          {#if !last}
            <span class="bg-border-subtle w-px flex-1"></span>
          {/if}
        </span>

        <div class={cn("flex min-w-0 flex-1 flex-col", !last && "pb-3")}>
          <div class="flex items-baseline justify-between gap-2">
            {#if entry.onselect}
              <button
                type="button"
                onclick={entry.onselect}
                class={cn("text-ink-primary min-w-0 flex-1 text-start hover:underline", line)}
              >
                {entry.what}
              </button>
            {:else}
              <p class={cn("text-ink-primary m-0 min-w-0 flex-1", line)}>{entry.what}</p>
            {/if}
            <span class="text-caption text-ink-muted shrink-0 tabular-nums">{entry.time}</span>
          </div>

          {#if entry.detail}
            <p class="text-caption text-ink-muted m-0">{entry.detail}</p>
          {/if}
        </div>
      </li>
    {/each}
  </ol>
{/if}
