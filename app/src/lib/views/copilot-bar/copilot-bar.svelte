<script lang="ts">
  import { tick } from "svelte";
  import ArrowUp from "@lucide/svelte/icons/arrow-up";

  import { clientModel } from "$model/client";

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

  /** Placeholder personas. The picker is real; the list is not. */
  const PERSONAS = ["Generalist", "Analyst", "Editor"];

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
    <div class="controls">
      <span class="mark">Copilot</span>

      <label class="field">
        <span class="sr-only">Mode</span>
        <select bind:value={mode} title={MODES.find((entry) => entry.id === mode)?.hint}>
          {#each MODES as entry (entry.id)}
            <option value={entry.id}>{entry.label}</option>
          {/each}
        </select>
      </label>

      <label class="field">
        <span class="sr-only">Persona</span>
        <select bind:value={persona}>
          {#each PERSONAS as name (name)}
            <option value={name}>{name}</option>
          {/each}
        </select>
      </label>

      <span class="spacer"></span>

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
    background-color: var(--token-surface-elevated);
    box-shadow: var(--token-shadow-overlay);
  }

  .controls {
    display: flex;
    align-items: center;
    gap: calc(var(--token-spacing-unit) * 1);
    /* The bar starts at 48px: this row plus one line of composer. */
    height: calc(var(--token-spacing-unit) * 8);
    padding-inline: calc(var(--token-spacing-unit) * 2.5);
    border-bottom: 1px solid var(--token-border-subtle);
  }

  .mark {
    font-size: var(--token-text-caption);
    font-weight: 600;
    letter-spacing: 0.04em;
    color: var(--token-color-intelligence-text);
  }

  .spacer {
    flex: 1;
  }

  .field select {
    height: calc(var(--token-spacing-unit) * 6);
    padding-inline: calc(var(--token-spacing-unit) * 1.5);
    border: 1px solid transparent;
    border-radius: var(--token-radius-control);
    background: none;
    font: inherit;
    font-size: var(--token-text-caption);
    color: var(--token-ink-secondary);
    cursor: pointer;
  }

  .field select:hover {
    border-color: var(--token-border-subtle);
    background-color: var(--token-surface-panel-hover);
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

  textarea {
    width: 100%;
    min-height: calc(var(--token-spacing-unit) * 6);
    max-height: 88px;
    resize: none;
    overflow-y: auto;
    padding: calc(var(--token-spacing-unit) * 2) calc(var(--token-spacing-unit) * 2.5);
    border: none;
    background: none;
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

  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip-path: inset(50%);
    white-space: nowrap;
  }
</style>
