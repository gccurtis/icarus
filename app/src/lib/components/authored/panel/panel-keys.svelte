<script lang="ts">
  import * as Kbd from "$lib/components/vendor/kbd";
  import { cn } from "$lib/components/vendor/utils";
  import { traceNode } from "$components/development/trace.svelte";

  type Modifier = "mod" | "ctrl" | "alt" | "shift";
  type Platform = "apple" | "other";

  /**
   * A keyboard shortcut, drawn beside the thing it does.
   *
   * The design law is *no secret essentials*: a shortcut accelerates a path that
   * is already visible and never replaces one. A shortcut nobody can see is
   * exactly the failure that law names, and this is the word that stops it — the
   * chord printed next to the control it duplicates, so the fast way is a thing
   * you are told rather than a thing you find out.
   *
   * **Not `PanelChip` or `PanelCode`.** A chip is a tinted state and a code
   * block is an expression; both would draw the characters and neither would
   * know what they mean. Keycaps have to be `<kbd>` to be keycaps, and a chord
   * is a structure — modifiers, then one key — rather than a run of text.
   *
   * **The chord arrives as parts, never as a string.** A caller writing
   * `"Cmd+K"` has already made the platform decision, and made it wrong on Linux
   * for every reader who is not on a Mac. `mod` is the platform's own accelerator
   * — ⌘ on Apple hardware, Ctrl everywhere else — and it is resolved here, once,
   * instead of in two hundred panels.
   *
   * **The order is the platform's, not the caller's.** Apple writes ⌃⌥⇧⌘ and
   * everywhere else writes Ctrl Alt Shift, so the modifiers are sorted rather
   * than printed in the order they were passed. A chord written two ways in two
   * panels is a chord the reader has to check twice.
   *
   * **The glyphs are decoration and the words are the content.** ⌘⇧K is read
   * aloud as nothing useful, so the visible keycaps are hidden from assistive
   * technology and the spoken form — "Command Shift K" — sits beside them.
   */
  let {
    action,
    mods = [],
    key,
    platform,
    flush = false
  }: {
    /**
     * What the shortcut does. Present when this stands as its own line; absent
     * when the chord sits inside something that already names it — a row's
     * `control` snippet, a menu item, a button's tooltip.
     */
    action?: string;
    /** The modifiers held, in any order. `mod` is the platform's accelerator. */
    mods?: readonly Modifier[];
    /** The one key pressed: `k`, `Enter`, `/`. A single letter is capitalised. */
    key: string;
    /** Forces the rendering, for a screenshot or a test. Detected otherwise. */
    platform?: Platform;
    /** Drop the panel gutter. Only meaningful with `action`. */
    flush?: boolean;
  } = $props();

  // Two roots: the marker goes on the labelled one, since the bare chord's root is a component.
  const trace = traceNode("PanelKeys", () => ({ action, mods, key, platform, flush }));

  /** Apple prints ⌃⌥⇧⌘; everything else leads with its accelerator. */
  const ORDER: Record<Platform, readonly Modifier[]> = {
    apple: ["ctrl", "alt", "shift", "mod"],
    other: ["mod", "ctrl", "alt", "shift"]
  };

  const GLYPH: Record<Platform, Record<Modifier, string>> = {
    apple: { mod: "⌘", ctrl: "⌃", alt: "⌥", shift: "⇧" },
    other: { mod: "Ctrl", ctrl: "Ctrl", alt: "Alt", shift: "Shift" }
  };

  const SPOKEN: Record<Platform, Record<Modifier, string>> = {
    apple: { mod: "Command", ctrl: "Control", alt: "Option", shift: "Shift" },
    other: { mod: "Control", ctrl: "Control", alt: "Alt", shift: "Shift" }
  };

  /**
   * Starts at the majority platform and corrects after mount. Detecting during
   * render would make the server draw one chord and the browser another, and a
   * keycap that changes under the reader is worse than one that is briefly the
   * common case.
   */
  let detected = $state<Platform>("other");

  $effect(() => {
    detected = /Mac|iPhone|iPad|iPod/i.test(navigator.userAgent) ? "apple" : "other";
  });

  const target = $derived<Platform>(platform ?? detected);
  const held = $derived(ORDER[target].filter((modifier) => mods.includes(modifier)));
  const cap = $derived(key.length === 1 ? key.toUpperCase() : key);

  /**
   * Off Apple hardware `mod` and `ctrl` are the same key, so a chord asking for
   * both would print "Ctrl Ctrl". The set collapses them back to one.
   */
  const caps = $derived([...new Set(held.map((modifier) => GLYPH[target][modifier])), cap]);
  const spoken = $derived(
    [...new Set(held.map((modifier) => SPOKEN[target][modifier])), cap].join(" ")
  );
</script>

{#snippet chord()}
  <Kbd.Group class="gap-0.5">
    <span class="sr-only">{spoken}</span>
    {#each caps as glyph, index (index)}
      <Kbd.Root
        aria-hidden="true"
        class="text-caption border-border-subtle bg-surface-canvas text-ink-secondary rounded-control h-4 min-w-4 border px-1"
      >
        {glyph}
      </Kbd.Root>
    {/each}
  </Kbd.Group>
{/snippet}

{#if action}
  <div {...trace} class={cn("flex items-center gap-2 py-0.5", flush ? "px-0" : "px-3")}>
    <span class="text-caption text-ink-secondary min-w-0 truncate">{action}</span>
    <span class="ms-auto shrink-0">{@render chord()}</span>
  </div>
{:else}
  {@render chord()}
{/if}
