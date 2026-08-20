<script lang="ts">
  import * as Avatar from "$lib/simple-components/avatar";
  import { Button } from "$lib/simple-components/button";
  import { cn } from "$lib/simple-components/utils";

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
   */
  let {
    actors,
    limit = 4,
    label = "Here now",
    onselect,
    onoverflow
  }: {
    actors: readonly { id: string; name: string; kind?: "person" | "agent" | "automation" }[];
    /** How many faces before the rest become a count. */
    limit?: number;
    /** Names the group, since a strip of initials says nothing on its own. */
    label?: string;
    onselect?: (id: string) => void;
    /** Opens the full list. Required in spirit whenever anyone is hidden. */
    onoverflow?: () => void;
  } = $props();

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

<div class="flex items-center gap-1 px-3" role="group" aria-label={label}>
  <Avatar.Group class="-space-x-1.5">
    {#each shown as actor (actor.id)}
      <Avatar.Root
        class={cn(
          "ring-surface-panel size-5 border ring-2",
          KIND[actor.kind ?? "person"],
          onselect && "cursor-pointer"
        )}
        title={actor.name}
        onclick={() => onselect?.(actor.id)}
      >
        <Avatar.Fallback class="bg-transparent text-[0.5rem] font-medium">
          {initials(actor.name)}
        </Avatar.Fallback>
      </Avatar.Root>
    {/each}
  </Avatar.Group>

  {#if hidden > 0}
    <Button
      variant="ghost"
      size="xs"
      class="text-caption text-ink-muted h-5 px-1"
      onclick={onoverflow}
      title={`${hidden} more`}
    >
      +{hidden}
    </Button>
  {/if}
</div>
