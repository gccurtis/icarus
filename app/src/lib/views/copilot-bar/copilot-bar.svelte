<script lang="ts">
  import { tick } from "svelte";
  import ArrowUp from "@lucide/svelte/icons/arrow-up";

  import { clientModel } from "$model/client";
  import * as Select from "$lib/simple-components/select";

  /**
   * The copilot bar — a persistent place to describe the next move, anchored at
   * the bottom of the work surface.
   *
   * It is not a help input and not a detached chat product. From anywhere real
   * work happens, a user can say what they want next, watch the result in the
   * inspector, and carry on without leaving the surface they were on. That is
   * why it floats over the work rather than occupying a zone of the frame.
   *
   * **Two model calls on activation, deliberately separate.** Focusing the
   * composer inspects the copilot *and* opens the inspector if it was shut.
   * Opening is not a consequence of inspecting: `inspect()` records what the
   * user is looking at and nothing else, and a model method that also moved
   * panels would make every future caller of `inspect()` a layout change. The
   * bar wants both, so the bar asks for both.
   *
   * Opening a collapsed panel is all it does — a panel already open is left at
   * whatever width its user chose, because a composer that resized the
   * inspector every time it took focus would be fighting the person using it.
   *
   * **Mode and persona are local state.** Neither survives a reload, and neither
   * should until something can act on them: a mode nobody dispatches on is a
   * label, and persisting a label costs a storage version. They move to the
   * workbench when a capability gives them consequences.
   */
  const { workbench } = clientModel();

  const MODES = [
    { id: "ask", label: "Ask", hint: "Answer against the current context" },
    { id: "plan", label: "Plan", hint: "Turn an outcome into a reviewable sequence" },
    { id: "action", label: "Action", hint: "Make the change directly" }
  ] as const;

  type Mode = (typeof MODES)[number]["id"];

  /**
   * Placeholder personas. The picker and its scrolling are real; the list is
   * not — it is long on purpose, because a picker that only ever holds three
   * entries never proves it can hold thirty.
   */
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

  /**
   * Three rows and then it scrolls. A menu tall enough to show everything is a
   * wall of options over the work surface; three is enough to see that it is a
   * list and that there is more below it.
   *
   * The class is also the hook this component's stylesheet uses to reach the
   * items, which render in a portal and so are outside its own tree.
   */
  const MENU = "copilot-menu max-h-[5rem] min-w-32";

  let mode = $state<Mode>("ask");
  let persona = $state(PERSONAS[0]);
  let prompt = $state("");
  let focused = $state(false);
  let composer = $state<HTMLTextAreaElement>();

  const inspectingCopilot = $derived(workbench.currentInspection?.kind === "copilot");
  const inspectorOpen = $derived(!workbench.panels.inspectorCollapsed);

  /**
   * Solid when it is being used, translucent when it is not. "Being used"
   * includes the inspector showing the copilot, because the bar and that panel
   * are one surface: dimming the bar while its own panel is open would read as
   * the two being unrelated.
   */
  const active = $derived(focused || (inspectingCopilot && inspectorOpen));

  const activate = () => {
    workbench.inspect([{ kind: "copilot" }]);
    if (workbench.panels.inspectorCollapsed) workbench.resize({ inspectorCollapsed: false });
  };

  /**
   * Four lines, then it scrolls inside itself. Growing without a ceiling would
   * walk the bar up over the work it is meant to sit beneath, and the bottom
   * edge staying put is what keeps the submit control where the hand left it.
   */
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

  /* The controls take the panel plane and the composer keeps the raised one, so
   * the row of choices reads as chrome and the place you type reads as the
   * surface you are typing on. `surface-panel` is the same plane the bars and
   * both flanks use, which is what keeps this bar part of the frame rather than
   * a card floating in front of it. */
  /**
   * Three columns rather than a flex row with a spacer: the persona sits in the
   * middle column, so it is centred against the *bar* and not against whatever
   * happens to be left over after the mode and the send button. The two outer
   * columns are equal, which is what keeps it centred as the mode label changes
   * width between Ask, Plan, and Action.
   */
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

  /**
   * The two pickers, styled here rather than through the class prop.
   *
   * The registry trigger is a bordered field at `text-sm` — correct for a form,
   * wrong for chrome. Overriding it with utilities does not work reliably:
   * `twMerge` does not know that this system's `text-caption` conflicts with
   * Tailwind's `text-sm`, so it keeps both and the larger one wins. Reaching the
   * element from this stylesheet is unambiguous, and it puts the bar's whole
   * appearance in one place instead of half here and half in a prop.
   *
   * What is left is a label that happens to be clickable: no border, no fill, no
   * chevron. The affordance is the ink moving on hover, which is the quietest
   * thing that still says a control is there.
   */
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

  .intent :global([data-slot="select-trigger"]) {
    /* Intent is the one choice that changes what the bar does, so it carries the
     * intelligence role — as ink alone, not as a filled chip. */
    color: var(--token-color-intelligence-text);
    font-weight: 600;
  }

  .who :global([data-slot="select-trigger"]) {
    color: var(--token-ink-muted);
  }

  .who :global([data-slot="select-trigger"]:hover) {
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

  /**
   * Menu rows, at the same caption size as the triggers that open them.
   *
   * Genuinely global, because the menu renders in a portal and is not in this
   * component's tree at all. `.copilot-menu` is the scope: it travels with the
   * portalled element, so the rule reaches these rows and no other Select in the
   * application.
   */
  :global(.copilot-menu [data-slot="select-item"]) {
    font-size: var(--token-text-caption);
    line-height: var(--token-text-caption-leading);
  }
</style>
