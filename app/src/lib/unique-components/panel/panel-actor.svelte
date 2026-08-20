<script lang="ts">
  import * as Avatar from "$lib/simple-components/avatar";
  import { cn } from "$lib/simple-components/utils";
  import PanelLink from "$lib/unique-components/panel/panel-link.svelte";

  /**
   * A face, the name beside it, and the one line saying what it is.
   *
   * Neither family could draw a face. `PanelLink` is the current answer to "who"
   * — its own comment says every "who" in the application is one of these — but
   * it renders a text button, so a spec asking for "Grid Analyst, as an avatar
   * that opens the agent" loses the avatar. `PanelRow`'s `icon` slot renders at
   * 14px, and a picture at 14px is a dot. So a persona screen hand-rolled a 56px
   * initials circle, because there was no word for one.
   *
   * `simple-components/avatar` underneath for the circle and its fallback — but
   * the registry knows nothing about whether the circle is clickable or what a
   * missing picture should show, and those are the parts the specifications
   * actually care about.
   *
   * **A face is always a target**, on the same promise `PanelLink` makes for a
   * name: an actor is inspectable from wherever it appears. A face that did
   * nothing would be the only picture in the application that is not a way in.
   *
   * **A person, an agent and an Automation must be tellable apart at a glance.**
   * "A task the agent began and a task an Automation dispatched are different
   * situations" — and by the time the reader has read the label to find out
   * which, the glance has already been spent. The kind is carried by the
   * fallback's role colour, and the label says it too, so it is never colour
   * alone.
   */
  let {
    name,
    kind = "person",
    role,
    src,
    size = "row",
    onselect
  }: {
    name: string;
    /** What is acting. Carried by colour *and* by the role line. */
    kind?: "person" | "agent" | "automation" | "connector";
    /** The one line: "Reads field data and relay logs." Absent inside a row. */
    role?: string;
    /** A real picture. Only people have one; the rest are always initials. */
    src?: string;
    /** `row` sits inside a field or a line of text; `head` heads a lens. */
    size?: "row" | "head";
    /** Absent only where the actor is already the subject of the panel. */
    onselect?: () => void;
  } = $props();

  const KIND: Record<NonNullable<typeof kind>, string> = {
    person: "bg-surface-panel text-ink-secondary border-border-subtle",
    agent: "bg-intelligence-surface text-intelligence-text border-intelligence-border",
    automation: "bg-accent-2-surface text-accent-2-text border-accent-2-border",
    connector: "bg-accent-1-surface text-accent-1-text border-accent-1-border"
  };

  /**
   * Two letters at most. A fallback long enough to need shrinking is a fallback
   * nobody can read, and the name is beside it in every use here anyway.
   */
  const initials = $derived(
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((word) => word[0]?.toUpperCase() ?? "")
      .join("")
  );
</script>

<div class={cn("flex min-w-0 items-center gap-2", size === "head" && "items-start gap-3")}>
  <Avatar.Root class={cn("shrink-0 border", KIND[kind], size === "row" ? "size-5" : "size-10")}>
    {#if src}
      <Avatar.Image {src} alt="" />
    {/if}
    <Avatar.Fallback
      class={cn("bg-transparent font-medium", size === "row" ? "text-[0.5rem]" : "text-body-sm")}
    >
      {initials}
    </Avatar.Fallback>
  </Avatar.Root>

  <div class="flex min-w-0 flex-col">
    {#if onselect}
      <PanelLink label={name} title={`${name} — ${kind}`} onselect={onselect} />
    {:else}
      <span class="text-body-sm text-ink-primary truncate">{name}</span>
    {/if}
    {#if role}
      <span class="text-caption text-ink-muted">{role}</span>
    {/if}
  </div>
</div>
