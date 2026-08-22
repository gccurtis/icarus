<script lang="ts">
  import type { Snippet } from "svelte";
  import GripVertical from "@lucide/svelte/icons/grip-vertical";

  import { Button } from "$lib/simple-components/button";
  import * as DropdownMenu from "$lib/simple-components/dropdown-menu";
  import { cn } from "$lib/simple-components/utils";
  import { traceNode } from "$lib/trace/trace.svelte";

  /**
   * Something you can pick up and put somewhere.
   *
   * **Nothing is drag-only.** That is the specifications' rule, in those words,
   * and it is the reason this component takes `destinations` rather than just
   * firing drag events: the same list that dragging targets is rendered as a
   * menu on the item itself. A drag is a shortcut for people who can make one,
   * and the menu is the path for everyone else — a keyboard, a screen reader, a
   * touch device, a tremor, a trackpad someone finds unreliable.
   *
   * Declaring the destinations once is what keeps the two honest. A component
   * that emitted `ondragstart` and left the keyboard path to the caller would
   * get a keyboard path in the first surface and none in the fourth.
   *
   * **A thing is undraggable or it has a defined result** — also the
   * specifications'. An item with no destinations is not drawn with a grip, is
   * not `draggable`, and offers no menu, because a handle that lifts something
   * with nowhere to go is a promise the surface cannot keep.
   *
   * The transfer is HTML5's, which is what makes a drag work *between* two
   * independent surfaces — a panel list on the flank and a zone in the middle
   * do not share a component, a store, or a parent, and a pointer-tracking
   * implementation would need them to.
   */
  let {
    id,
    label,
    destinations = [],
    disabled = false,
    onplace,
    onreceive,
    children
  }: {
    /** What is being moved. Travels in the drag, and comes back to `DropZone`. */
    id: string;
    /** Names it in the menu and to assistive technology. */
    label: string;
    /** Where it may go. Empty means it does not move, and is drawn that way. */
    destinations?: readonly { value: string; label: string }[];
    disabled?: boolean;
    /** Called by the menu and by a drop alike, so both paths land in one place. */
    onplace?: (destination: string) => void;
    /**
     * Another item was dropped onto this one — which is how a list reorders.
     *
     * Reordering and moving-to-a-zone are the same gesture with a different
     * target, so they are the same component: an item is a `DropZone` for other
     * items when its list has an order worth changing. Giving reordering its own
     * word would mean two ways to pick something up.
     *
     * The menu is still the path that has to work, and for a list it is the
     * ordinary pair — pass "Move up" and "Move down" as `destinations`.
     */
    onreceive?: (id: string) => void;
    children: Snippet;
  } = $props();

  const trace = traceNode("Draggable", () => ({ id, label, destinations, disabled }));

  const movable = $derived(!disabled && destinations.length > 0 && onplace !== undefined);

  let lifted = $state(false);
  let receiving = $state(false);

  /**
   * `dragover` has to be cancelled for a drop to be allowed at all — the one
   * piece of HTML5 drag-and-drop nobody guesses. The dragged id is unreadable
   * during dragover in most browsers, so self is excluded with `lifted` rather
   * than by comparing ids.
   */
  const enter = (event: DragEvent) => {
    if (!onreceive || lifted) return;
    if (!event.dataTransfer?.types.includes("application/x-icarus-item")) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    receiving = true;
  };

  const receive = (event: DragEvent) => {
    receiving = false;
    if (!onreceive || lifted) return;
    const dragged = event.dataTransfer?.getData("application/x-icarus-item");
    if (!dragged || dragged === id) return;
    event.preventDefault();
    // Stop the drop here: an item inside a zone must not also land in the zone.
    event.stopPropagation();
    onreceive(dragged);
  };

  const start = (event: DragEvent) => {
    if (!movable) return;
    // Both a private type and text/plain: the first is what `DropZone` reads and
    // will not collide with a drag from elsewhere in the browser, the second is
    // what makes the drag legible if it lands somewhere that is not ours.
    event.dataTransfer?.setData("application/x-icarus-item", id);
    event.dataTransfer?.setData("text/plain", label);
    if (event.dataTransfer) event.dataTransfer.effectAllowed = "move";
    lifted = true;
  };
</script>

<!--
  A group rather than a bare div: this is a labelled composite — the content and
  the menu that moves it — and a drag handler on an unnamed element is a gesture
  with nothing to announce.
-->
<div
  {...trace}
  role="group"
  draggable={movable}
  aria-label={movable ? `${label} — draggable` : label}
  ondragstart={start}
  ondragend={() => {
    lifted = false;
    receiving = false;
  }}
  ondragover={enter}
  ondragleave={() => (receiving = false)}
  ondrop={receive}
  class={cn(
    "rounded-control flex items-center gap-1 border border-transparent",
    movable && "hover:border-border-subtle hover:bg-surface-panel-hover cursor-grab",
    lifted && "opacity-40",
    /* The insertion line, on the edge the item would arrive at. */
    receiving && "border-t-active-border rounded-t-none border-t-2"
  )}
>
  {#if movable}
    <GripVertical class="text-ink-muted size-3.5 shrink-0" aria-hidden="true" />
  {/if}

  <div class="min-w-0 flex-1">{@render children()}</div>

  {#if movable}
    <DropdownMenu.Root>
      <DropdownMenu.Trigger>
        {#snippet child({ props })}
          <Button
            {...props}
            variant="ghost"
            size="icon-xs"
            class="text-ink-muted size-5 shrink-0"
            title={`Put ${label} somewhere`}
            aria-label={`Put ${label} somewhere`}
          >
            ⋯
          </Button>
        {/snippet}
      </DropdownMenu.Trigger>
      <DropdownMenu.Content align="end">
        {#each destinations as destination (destination.value)}
          <DropdownMenu.Item onSelect={() => onplace?.(destination.value)}>
            {destination.label}
          </DropdownMenu.Item>
        {/each}
      </DropdownMenu.Content>
    </DropdownMenu.Root>
  {/if}
</div>
