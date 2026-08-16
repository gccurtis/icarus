<script lang="ts">
  import { tick } from "svelte";
  import ArrowUp from "@lucide/svelte/icons/arrow-up";

  import { clientModel } from "$model/client";
  import * as Select from "$lib/simple-components/select";

  /**
   * A persistent place to describe the next move, floating over the work surface.
   *
   * Activation makes two model calls deliberately: `inspect()` records what the
   * user is looking at, `resize()` opens the panel. Folding the second into the
   * first would make every future caller of `inspect()` a layout change.
   *
   * Mode and persona are local state until a capability can act on them.
   */
  const { workbench } = clientModel();

  const MODES = [
    { id: "ask", label: "Ask", hint: "Answer against the current context" },
    { id: "plan", label: "Plan", hint: "Turn an outcome into a reviewable sequence" },
    { id: "action", label: "Action", hint: "Make the change directly" }
  ] as const;

  type Mode = (typeof MODES)[number]["id"];

  /** Placeholder personas, long enough to exercise scrolling. */
  const PERSONAS = [
    "Generalist",
    "Analyst",
    "Editor",
    "Researcher",
    "Summariser",
    "Critic",
    "Archivist",
    "Planner",
    "Reviewer",
    "Translator"
  ];

  /** Three rows, then it scrolls. The class is how the stylesheet reaches the
   *  portalled menu. */
  const MENU = "copilot-menu max-h-[5rem] min-w-32";

  let mode = $state<Mode>("ask");
  let persona = $state(PERSONAS[0]);
  let prompt = $state("");
  let focused = $state(false);
  let composer = $state<HTMLTextAreaElement>();

  const inspectingCopilot = $derived(workbench.currentInspection?.kind === "copilot");
  const inspectorOpen = $derived(!workbench.panels.inspectorCollapsed);

  /** Solid when in use. That includes the inspector showing the copilot — the
   *  bar and that panel are one surface. */
  const active = $derived(focused || (inspectingCopilot && inspectorOpen));

  const activate = () => {
    workbench.inspect([{ kind: "copilot" }]);
    if (workbench.panels.inspectorCollapsed) workbench.resize({ inspectorCollapsed: false });
  };

  /** Four lines, then it scrolls inside itself, so the bottom edge stays put. */
  const MAX_HEIGHT = 88;

  const grow = () => {
    if (!composer) return;
    composer.style.height = "auto";
    composer.style.height = `${Math.min(composer.scrollHeight, MAX_HEIGHT)}px`;
  };

  const submit = (event: SubmitEvent) => {
    event.preventDefault();
    if (!prompt.trim()) return;
    // Nothing dispatches yet — no agent capability exists. What is real is where
    // the result will land, so activation happens and the prompt clears.
    activate();
    prompt = "";
    void tick().then(grow);
  };

  const onkeydown = (event: KeyboardEvent) => {
    if (event.key === "Enter" && !event.shiftKey && !event.isComposing) {
      submit(event as unknown as SubmitEvent);
    }
  };
</script>

<!--
  The wrapper takes no pointer events so the translucent gutter around the bar
  does not swallow clicks meant for the work underneath; only the bar itself is
  hit-testable.
-->
<div class="dock" data-active={active ? "" : undefined}>
  <form
    class="bar"
    aria-label="Copilot"
    onsubmit={submit}
    onfocusin={() => {
      focused = true;
      activate();
    }}
    onfocusout={(event) => {
      const form = event.currentTarget;
      if (!(event.relatedTarget instanceof Node) || !form.contains(event.relatedTarget)) {
        focused = false;
      }
    }}
  >
    <!--
      Both menus open upward. A menu that drops down from this row lands on the
      composer, so choosing a mode covers the sentence the choice is about — and
      this bar is anchored to the bottom of the viewport, where there is nothing
      below it to open into anyway.
    -->
    <div class="controls">
      <!--
        Intent on the left, wearing the intelligence role — the same violet the
        rest of the application uses for derived work. It is the one choice that
        changes what the whole bar does, so it reads as a mode switch rather than
        as another field.

        Both triggers hide the registry's chevron and let their border carry the
        affordance instead. Two arrows in a 32px row are clutter that says the
        same thing the border already says, and the registry component is
        consumed rather than edited — so the icon is hidden from here, where the
        decision belongs, rather than removed from a component every other
        surface shares.
      -->
      <div class="control intent">
        <Select.Root type="single" bind:value={mode}>
          <Select.Trigger size="sm" aria-label="Mode">
            {MODES.find((entry) => entry.id === mode)?.label}
          </Select.Trigger>
          <Select.Content side="top" align="start" class={MENU}>
            {#each MODES as entry (entry.id)}
              <Select.Item value={entry.id} label={entry.label}>{entry.label}</Select.Item>
            {/each}
          </Select.Content>
        </Select.Root>
      </div>

      <!--
        Who is answering, centred. `max-h` is what makes the list scroll rather
        than run off the top of the viewport: this bar sits at the bottom and the
        menu opens upward, so an unbounded list of personas would grow straight
        past the frame with its far end unreachable.
      -->
      <div class="control who">
        <Select.Root type="single" bind:value={persona}>
          <Select.Trigger size="sm" aria-label="Persona">{persona}</Select.Trigger>
          <Select.Content side="top" align="center" class={MENU}>
            {#each PERSONAS as name (name)}
              <Select.Item value={name} label={name}>{name}</Select.Item>
            {/each}
          </Select.Content>
        </Select.Root>
      </div>

      <button type="submit" class="send" disabled={!prompt.trim()} aria-label="Send {mode}">
        <ArrowUp size={14} aria-hidden="true" />
      </button>
    </div>

    <textarea
      bind:this={composer}
      bind:value={prompt}
      oninput={grow}
      {onkeydown}
      rows="1"
      aria-label="Copilot prompt"
      placeholder="Describe the next move"
    ></textarea>
  </form>
</div>

<style>
  .dock {
    position: absolute;
    inset-inline: 0;
    bottom: calc(var(--token-spacing-unit) * 4);
    display: flex;
    justify-content: center;
    padding-inline: calc(var(--token-spacing-unit) * 4);
    pointer-events: none;
    z-index: 20;
    opacity: 0.65;
    transition: opacity var(--token-motion-panel, 200ms) ease;
  }

  .dock:hover,
  .dock[data-active] {
    opacity: 1;
  }

  .bar {
    pointer-events: auto;
    width: 100%;
    max-width: 44rem;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    border: 1px solid var(--token-border-subtle);
    border-radius: var(--token-radius-overlay);
    box-shadow: var(--token-shadow-overlay);
  }

  /* The controls take the panel plane and the composer the raised one, so the
   * row reads as chrome and the composer as the surface you type on. */
  /* Three columns, so the persona is centred against the bar rather than
   * against what is left over beside the mode and the send button. */
  .controls {
    display: grid;
    grid-template-columns: 1fr auto 1fr;
    align-items: center;
    /* The bar starts at 48px: this row plus one line of composer. */
    height: calc(var(--token-spacing-unit) * 8);
    padding-inline: calc(var(--token-spacing-unit) * 2.5);
    background-color: var(--token-surface-panel);
    border-bottom: 1px solid var(--token-border-subtle);
  }

  .controls > :first-child {
    justify-self: start;
  }

  .controls > :last-child {
    justify-self: end;
  }

  /* Styled here, not through the class prop: `twMerge` does not know
   * `text-caption` conflicts with the registry's `text-sm`, so it keeps both and
   * the larger one wins. */
  .control :global([data-slot="select-trigger"]) {
    height: calc(var(--token-spacing-unit) * 6);
    padding-inline: calc(var(--token-spacing-unit) * 1.5);
    border: 0;
    background: none;
    box-shadow: none;
    font-size: var(--token-text-caption);
    line-height: var(--token-text-caption-leading);
    transition: color var(--token-motion-control, 120ms) ease;
  }

  .control :global([data-slot="select-trigger"] svg) {
    display: none;
  }

  /* Hover paints rather than recolours: a shape under the pointer says "target"
   * where shifting ink could read as a state change. */
  .control :global([data-slot="select-trigger"]:hover) {
    background-color: var(--token-surface-panel-hover);
  }

  .intent :global([data-slot="select-trigger"]) {
    /* Intent is the one choice that changes what the bar does, so it carries the
     * intelligence role — as ink alone, not as a filled chip. */
    color: var(--token-color-intelligence-text);
    font-weight: 600;
  }

  .intent :global([data-slot="select-trigger"]:hover) {
    background-color: var(--token-color-intelligence-surface);
  }

  /* Muted only while the bar is resting. The dock already fades to 65%, and a
   * greyed label beside text you are typing reads as disabled. */
  .who :global([data-slot="select-trigger"]) {
    color: var(--token-ink-muted);
  }

  .dock:hover .who :global([data-slot="select-trigger"]),
  .dock[data-active] .who :global([data-slot="select-trigger"]) {
    color: var(--token-ink-primary);
  }

  .send {
    display: flex;
    align-items: center;
    justify-content: center;
    /* 24px square — the minimum target, and the row is only 32px tall. */
    width: calc(var(--token-spacing-unit) * 6);
    height: calc(var(--token-spacing-unit) * 6);
    border: none;
    border-radius: var(--token-radius-control);
    background-color: var(--token-color-interactive-fill);
    color: var(--token-color-interactive-on-fill);
    cursor: pointer;
  }

  .send:disabled {
    opacity: 0.3;
    cursor: default;
  }

  /* The raised plane, so the place you type is distinct from the chrome above
   * it. `.bar` carries no background of its own; these two halves are the whole
   * of it. */
  textarea {
    width: 100%;
    background-color: var(--token-surface-elevated);
    min-height: calc(var(--token-spacing-unit) * 6);
    max-height: 88px;
    resize: none;
    overflow-y: auto;
    padding: calc(var(--token-spacing-unit) * 2) calc(var(--token-spacing-unit) * 2.5);
    border: none;
    font: inherit;
    font-size: var(--token-text-body-sm);
    line-height: var(--token-text-body-sm-leading);
    color: var(--token-ink-primary);
    outline: none;
    scrollbar-width: none;
  }

  textarea::placeholder {
    color: var(--token-ink-muted);
  }

  /* Global because the menu renders in a portal; `.copilot-menu` is the scope. */
  :global(.copilot-menu [data-slot="select-item"]) {
    font-size: var(--token-text-caption);
    line-height: var(--token-text-caption-leading);
  }

  /* The registry's scroll buttons go. They auto-scrolled on hover at the menu's
   * edges, and took 24 of its 80 pixels to do what the viewport already does
   * natively. */
  :global(.copilot-menu [data-slot="select-scroll-up-button"]),
  :global(.copilot-menu [data-slot="select-scroll-down-button"]) {
    display: none;
  }
</style>
