<script lang="ts" module>
  /**
   * One thing the menu can put into what you are writing.
   *
   * `unavailable` is a sentence rather than a boolean on purpose: a disabled
   * control says why, or is absent, and a `disabled: true` field is how a
   * greyed-out row with no explanation gets written.
   */
  export type InsertEntry = {
    /** What is handed back to `oninsert`. Stable, and unique in the list. */
    value: string;
    /** What it is called — the identifier, as it will be typed. */
    label: string;
    /** What it does, in one line. Truncated in the row, whole in the foot. */
    description?: string;
    /** A short right-hand tag: a return type, a unit, a kind. */
    hint?: string;
    /** Puts it under a heading. Groups appear in the order first named. */
    group?: string;
    /** Words someone might search for that are in neither name nor description. */
    keywords?: readonly string[];
    /** Why it cannot be inserted here. Present means the row is not selectable. */
    unavailable?: string;
  };
</script>

<script lang="ts">
  import type { Snippet } from "svelte";
  import { computeCommandScore } from "bits-ui";

  import * as Command from "$vendored-components/command";
  import * as Popover from "$vendored-components/popover";
  import { cn } from "$vendored-components/utils";
  import { traceNode } from "$development-components/trace.svelte";

  /**
   * A filtered list that puts something into what you are writing.
   *
   * The `=` that starts a formula and the `@` that reaches for a variable are
   * the same shape: a list beside the caret, narrowed as you type, and picking
   * one *inserts* rather than navigates. That last word is the whole difference
   * from a dropdown menu — nothing here takes you anywhere, so nothing here
   * needs a destination, and the caret you came from is where you end up.
   *
   * **`simple-components/command` inside `simple-components/popover`**, which is
   * exactly what `command` is for. A hand-rolled filtered list loses the arrow
   * keys, the wrap-around, the aria-activedescendant wiring and the scroll into
   * view, and loses them quietly — the list still looks right.
   *
   * **Filtering ranks names first and prose second.** A match against the label
   * always outranks a match against a description or a keyword, because someone
   * typing `min` wants `avoidedMinutes` and not the nine formulas whose
   * descriptions happen to say "minimum". But the description is searched, and
   * that is not a compromise: `avoidedMinutes(t)` is unfindable by anyone who
   * does not already know its name, and the words they will actually type —
   * "carbon", "saved", "travel" — exist only in the description. Name-only
   * filtering was rejected for that; it makes a menu that works for the person
   * who wrote the formulas.
   *
   * **The highlighted entry's description is repeated in full at the foot.** A
   * description truncated to one line in a 320px row is not a description, and
   * the user asked for descriptions specifically. The foot is `aria-hidden`
   * because the row already carries the same text and a screen reader should not
   * hear it twice.
   *
   * **An empty list is a sentence, never a blank.** Two sentences, in fact,
   * because there are two emptinesses: nothing was ever here, and nothing
   * matches what you typed. The second quotes the query back, so the reader can
   * see the typo they cannot see in the input.
   *
   * **The menu takes focus.** What the caret gesture really wants is for the
   * editor to keep focus and forward its arrow keys, and that is not what this
   * does — it moves focus into its own filter field. Saying so plainly rather
   * than implying otherwise: it needs an editor that forwards keys and there is
   * not one yet. Returning focus to the caret after an insert is the caller's,
   * for the same reason — only the caller knows where the caret was.
   */
  let {
    open = $bindable(false),
    entries,
    label,
    placeholder = "Type to narrow",
    empty = "There is nothing to insert here yet.",
    anchor = null,
    side = "bottom",
    align = "start",
    mono = false,
    oninsert,
    trigger
  }: {
    open?: boolean;
    entries: readonly InsertEntry[];
    /** What the menu inserts — its accessible name. "Insert a formula". */
    label: string;
    placeholder?: string;
    /** The sentence for a menu with nothing in it at all. */
    empty?: string;
    /**
     * What the menu is placed against — the element standing at the caret.
     *
     * Either this or `trigger` has to be given. A menu opened by typing `=` has
     * no button to hang from, and a menu opened from a toolbar has no caret, so
     * the component takes both rather than pretending one covers the other.
     */
    anchor?: HTMLElement | null;
    side?: "top" | "bottom";
    align?: "start" | "center" | "end";
    /** Set the entry names in mono. True for formulas; usually false for names. */
    mono?: boolean;
    /** The entry's `value`. Inserting is the caller's — this only chooses. */
    oninsert: (value: string) => void;
    /** A control that opens the menu, for the toolbar case. */
    /** Rendered through the primitive's child snippet, so it stays one element. */
    trigger?: Snippet<[{ props: Record<string, unknown> }]>;
  } = $props();

  // The root is `Popover.Root`, a component rather than an element, so nothing marks the DOM.
  const trace = traceNode("OverlayInsertMenu", () => ({
    open,
    entries,
    label,
    placeholder,
    empty,
    side,
    align,
    mono
  }));

  let search = $state("");
  let highlighted = $state("");

  const byValue = $derived(new Map(entries.map((entry) => [entry.value, entry] as const)));

  /** The foot band's subject: whichever entry the arrow keys are resting on. */
  const resting = $derived(byValue.get(highlighted));

  /**
   * Half the range for names and a fixed quarter for prose, so every label match
   * sorts above every description match no matter how weak. Returning the raw
   * score for both would let a strong prose hit bury a weak but correct name.
   */
  const rank = (value: string, query: string) => {
    const entry = byValue.get(value);
    if (!entry) return 0;
    const onName = computeCommandScore(entry.label, query);
    if (onName > 0) return 0.5 + onName / 2;
    const prose = [entry.description ?? "", ...(entry.keywords ?? [])].join(" ");
    return prose.toLowerCase().includes(query.toLowerCase()) ? 0.25 : 0;
  };

  /** Headings in the order they are first named, and everything ungrouped first. */
  const sections = $derived.by(() => {
    const order: string[] = [];
    const held = new Map<string, InsertEntry[]>();
    for (const entry of entries) {
      const key = entry.group ?? "";
      if (!held.has(key)) {
        held.set(key, []);
        order.push(key);
      }
      held.get(key)?.push(entry);
    }
    // Ungrouped first: a heading-less block trailing a headed one reads as if it

    // belonged to that heading. Sort is stable, so named groups keep their order.

    order.sort((a, b) => (a === "" ? -1 : b === "" ? 1 : 0));

    return order.map((key) => ({ key, heading: key || undefined, entries: held.get(key) ?? [] }));
  });

  const insert = (entry: InsertEntry) => {
    if (entry.unavailable !== undefined) return;
    oninsert(entry.value);
    open = false;
  };

  /* A menu reopened at a new caret starts from nothing. Keeping the last query
     would filter the new position by the old question. */
  $effect(() => {
    if (!open) search = "";
  });
</script>

<Popover.Root bind:open>
  {#if trigger}
    <!--
      Through the primitive's own child snippet. Rendering the caller's trigger
      inside `Popover.Trigger`'s button nests a button in a button — invalid
      HTML that the browser un-nests during hydration, taking the trigger's
      behaviour with it. The primitive hands its props out for exactly this.
    -->
    <Popover.Trigger>
      {#snippet child({ props })}
        {@render trigger({ props })}
      {/snippet}
    </Popover.Trigger>
  {/if}

  <Popover.Content
    customAnchor={anchor}
    {side}
    {align}
    sideOffset={6}
    class="rounded-overlay border-border-subtle bg-surface-elevated shadow-overlay w-80 gap-0 overflow-hidden border p-0"
  >
    <Command.Root
      {label}
      bind:value={highlighted}
      filter={rank}
      loop
      class="rounded-none! bg-transparent p-0"
    >
      <Command.Input bind:value={search} {placeholder} />

      <Command.List class="max-h-64">
        <Command.Empty class="text-caption text-ink-muted px-3 py-6 text-center">
          {#if search}
            Nothing here matches “{search}”. Try fewer letters, or a word from
            what it does.
          {:else}
            {empty}
          {/if}
        </Command.Empty>

        {#each sections as section (section.key)}
          <!-- An explicit value: an unheaded group would otherwise be identified
               by a generated id that changes underneath the filter. -->
          <Command.Group value={section.key || "ungrouped"} heading={section.heading}>
            {#each section.entries as entry (entry.value)}
              <Command.Item
                value={entry.value}
                disabled={Boolean(entry.unavailable)}
                onSelect={() => insert(entry)}
                class="data-selected:bg-active-surface items-start gap-2 px-2 py-1.5"
              >
                <span class="flex min-w-0 flex-1 flex-col">
                  <span
                    class={cn(
                      "text-ink-primary truncate",
                      mono ? "text-mono font-mono" : "text-body-sm"
                    )}
                  >
                    {entry.label}
                  </span>
                  {#if entry.unavailable}
                    <span title={entry.unavailable} class="text-caption text-attention-text truncate">
                      {entry.unavailable}
                    </span>
                  {:else if entry.description}
                    <span title={entry.description} class="text-caption text-ink-muted truncate">{entry.description}</span>
                  {/if}
                </span>
                {#if entry.hint}
                  <Command.Shortcut class="text-caption text-ink-muted tracking-normal">
                    {entry.hint}
                  </Command.Shortcut>
                {/if}
              </Command.Item>
            {/each}
          </Command.Group>
        {/each}
      </Command.List>

      {#if resting?.description}
        <p
          aria-hidden="true"
          class="border-border-subtle text-caption text-ink-secondary m-0 border-t px-3 py-2"
        >
          {resting.description}
        </p>
      {/if}
    </Command.Root>
  </Popover.Content>
</Popover.Root>
