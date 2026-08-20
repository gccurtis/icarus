<script lang="ts">
  import type { Snippet } from "svelte";
  import Plus from "@lucide/svelte/icons/plus";

  import { Button } from "$lib/simple-components/button";
  import * as DropdownMenu from "$lib/simple-components/dropdown-menu";
  import { cn } from "$lib/simple-components/utils";

  /**
   * A place something can be put.
   *
   * **An empty zone says what belongs in it**, rather than sitting blank. That
   * is the specifications' line, and it is the difference between a surface that
   * teaches its own use and one you have to be shown: "drop a field to filter by
   * it" is an instruction, an empty dashed rectangle is a riddle.
   *
   * **Every zone has an add menu**, for the same reason every `Draggable` has
   * one — nothing here is drag-only. The zone's menu is the other end of the
   * same path: reach the thing and choose where it goes, or reach the place and
   * choose what goes in it. Which end a person starts from is theirs to pick.
   *
   * **It highlights only for something it accepts.** A zone that lights up for
   * every drag says yes and then refuses, which is worse than never lighting up:
   * the highlight is the only promise a drag ever gets.
   */
  let {
    label,
    empty,
    count = 0,
    accepts = () => true,
    additions = [],
    ondrop,
    onadd,
    children
  }: {
    /** Names the zone: "X — across", "Filters", "Colour". */
    label: string;
    /** What belongs here, said as an instruction. Shown when nothing is in it. */
    empty: string;
    /**
     * How many things are in it. A number rather than an inspection of
     * `children`, because a snippet is defined whether or not it renders
     * anything — a zone asked "do you have children?" answers yes while drawing
     * nothing, and the instruction that should have been there never appears.
     */
    count?: number;
    /** Whether this zone takes that item. Refusing early is kinder than after. */
    accepts?: (id: string) => boolean;
    /** What can be added from here, for the path that starts at the place. */
    additions?: readonly { value: string; label: string }[];
    ondrop?: (id: string) => void;
    onadd?: (value: string) => void;
    /** What is already in the zone. Drawn only when `count` says there is any. */
    children?: Snippet;
  } = $props();

  let over = $state(false);

  const idOf = (event: DragEvent) =>
    event.dataTransfer?.getData("application/x-icarus-item") ?? "";

  /**
   * `dragover` has to be cancelled for a drop to be allowed at all, which is the
   * one piece of HTML5 drag-and-drop nobody guesses. Cancelling only what is
   * accepted is what makes the cursor say no before the drop rather than after.
   */
  const over_ = (event: DragEvent) => {
    // The id is unreadable during dragover in most browsers, so acceptance is
    // decided on the type being present; the id is checked again on drop.
    if (!event.dataTransfer?.types.includes("application/x-icarus-item")) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    over = true;
  };

  const drop = (event: DragEvent) => {
    over = false;
    const id = idOf(event);
    if (!id || !accepts(id)) return;
    event.preventDefault();
    ondrop?.(id);
  };
</script>

<div
  role="group"
  aria-label={label}
  ondragover={over_}
  ondragleave={() => (over = false)}
  ondrop={drop}
  class={cn(
    "rounded-panel flex min-h-16 flex-col gap-2 border border-dashed p-3 transition-colors",
    over
      ? "border-interactive-border bg-interactive-surface"
      : "border-border-strong bg-surface-elevated"
  )}
>
  <div class="flex items-center gap-2">
    <span class="text-caption text-ink-muted font-semibold tracking-wide uppercase">
      {label}
    </span>
    {#if onadd && additions.length > 0}
      <DropdownMenu.Root>
        <DropdownMenu.Trigger>
          {#snippet child({ props })}
            <Button
              {...props}
              variant="ghost"
              size="icon-xs"
              class="text-ink-muted ms-auto size-5"
              title={`Add to ${label}`}
              aria-label={`Add to ${label}`}
            >
              <Plus aria-hidden="true" />
            </Button>
          {/snippet}
        </DropdownMenu.Trigger>
        <DropdownMenu.Content align="end">
          {#each additions as addition (addition.value)}
            <DropdownMenu.Item onSelect={() => onadd?.(addition.value)}>
              {addition.label}
            </DropdownMenu.Item>
          {/each}
        </DropdownMenu.Content>
      </DropdownMenu.Root>
    {/if}
  </div>

  <div class="flex flex-wrap items-center gap-1">
    {#if count > 0 && children}
      {@render children()}
    {:else}
      <span class="text-caption text-ink-muted italic">{empty}</span>
    {/if}
  </div>
</div>
