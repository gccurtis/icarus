<script lang="ts">
  import type { Snippet } from "svelte";

  import * as Avatar from "$lib/components/vendor/avatar";
  import { Button } from "$lib/components/vendor/button";
  import * as DropdownMenu from "$lib/components/vendor/dropdown-menu";
  import { cn } from "$lib/components/vendor/utils";
  import { traceNode } from "$components/development/trace.svelte";

  /**
   * Several actors at once, as faces rather than as a list.
   *
   * Presence is the case: who is here now, in a strip narrow enough to sit in a
   * header. `PanelActor` is one person with their name and their role beside
   * them, which is right when the panel is about them and wrong when the answer
   * is "these four".
   *
   * **The overflow is a control, not a label.** A "+3" that cannot be pressed
   * hides three people behind a number, which is the one thing this shape must
   * not do — it exists to say who, and three of the who are then unreachable.
   *
   * **Order carries no meaning and must not appear to.** Presence has no
   * ranking, so the caller's order is passed through untouched and nothing here
   * sorts, promotes, or marks a first.
   *
   * **`present` is drawn as a halo, and never as the only sign.** Colour alone
   * cannot carry a fact, so every face names its own standing in its title and
   * the overflow says it again in words — the ring is the glance, not the claim.
   *
   * **The overflow is a menu or a destination, never both.** `overflow` opens
   * the rest here, under the chip that hid them; `onoverflow` sends the reader
   * to a panel that holds more than a menu can. Pass one.
   */
  let {
    actors,
    limit = 4,
    label = "Here now",
    onselect,
    onoverflow,
    overflow
  }: {
    actors: readonly {
      id: string;
      name: string;
      kind?: "person" | "agent" | "automation";
      /** Here now. Absent and false are the same claim: not that we know of. */
      present?: boolean;
    }[];
    /** How many faces before the rest become a count. */
    limit?: number;
    /** Names the group, since a strip of initials says nothing on its own. */
    label?: string;
    onselect?: (id: string) => void;
    /** Opens the full list somewhere else. Required in spirit whenever anyone is hidden. */
    onoverflow?: () => void;
    /** The rest, opened under the chip. `DropdownMenu` items. */
    overflow?: Snippet;
  } = $props();

  const trace = traceNode("PanelFaces", () => ({ actors, limit, label }));

  const shown = $derived(actors.slice(0, limit));
  const hidden = $derived(Math.max(0, actors.length - limit));

  const KIND = {
    person: "bg-surface-panel text-ink-secondary border-border-subtle",
    agent: "bg-intelligence-surface text-intelligence-text border-intelligence-border",
    automation: "bg-accent-2-surface text-accent-2-text border-accent-2-border"
  };

  const initials = (name: string) =>
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((word) => word[0]?.toUpperCase() ?? "")
      .join("");
</script>

<div {...trace} class="flex items-center gap-1 px-3" role="group" aria-label={label}>
  <Avatar.Group class="-space-x-1.5">
    {#each shown as actor (actor.id)}
      <!--
        The ring is what keeps overlapping faces apart, so presence changes its
        colour rather than adding a second ring: a dot in a corner would be
        covered by the next face in the stack.

        Important, and it has to be: `Avatar.Group` paints a blanket ring on
        every child through a descendant selector, which outranks anything a
        single face can say about itself.
      -->
      <Avatar.Root
        class={cn(
          "size-5 border ring-2",
          actor.present ? "ring-success-fill!" : "ring-surface-panel!",
          KIND[actor.kind ?? "person"],
          onselect && "cursor-pointer"
        )}
        title={actor.present ? `${actor.name} · here now` : actor.name}
        onclick={() => onselect?.(actor.id)}
      >
        <Avatar.Fallback class="bg-transparent text-[0.5rem] font-medium">
          {initials(actor.name)}
        </Avatar.Fallback>
      </Avatar.Root>
    {/each}
  </Avatar.Group>

  {#if hidden > 0}
    <!--
      The chip is the same button either way, and the trigger's own props are
      spread last so the menu's click, keys and `aria-expanded` land on the
      element a keyboard actually reaches.
    -->
    {#snippet chip(trigger: Record<string, unknown> = {})}
      <Button
        variant="ghost"
        size="xs"
        class="text-caption text-ink-muted h-5 px-1"
        title={`${hidden} more`}
        onclick={onoverflow}
        {...trigger}
      >
        +{hidden}
      </Button>
    {/snippet}

    {#if overflow}
      <DropdownMenu.Root>
        <DropdownMenu.Trigger>
          {#snippet child({ props })}
            {@render chip(props)}
          {/snippet}
        </DropdownMenu.Trigger>
        <DropdownMenu.Content align="end" class="w-56">
          {@render overflow()}
        </DropdownMenu.Content>
      </DropdownMenu.Root>
    {:else}
      {@render chip()}
    {/if}
  {/if}
</div>
