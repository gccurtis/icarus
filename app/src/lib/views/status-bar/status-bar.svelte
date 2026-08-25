<script lang="ts">
  import { tick } from "svelte";
  import ArrowUp from "@lucide/svelte/icons/arrow-up";
  import AtSign from "@lucide/svelte/icons/at-sign";

  import * as Select from "$lib/simple-components/select";
  import { VIEWER } from "$mock-capabilities/cast";
  import { mentionsForViewer, type PersonComment } from "$mock-capabilities/collaboration";
  import { subject as subjectDoor } from "$mock-capabilities/naming";
  import { clientModel } from "$model/client";
  import { viewState } from "$model/client/view-state";
  import type { Mode } from "$model/client/copilot";

  /**
   * The bar across the foot of the application. Three parts, and the middle one
   * is the Copilot.
   *
   * **Its columns are the frame's columns.** Left sits under the context panel,
   * the composer under the work surface, right under the inspector — so the
   * Copilot is under the thing it is talking about rather than centred over a
   * layout it has nothing to do with. This is why the widths are read from the
   * frame's own custom properties instead of being thirds.
   *
   * **The Copilot sits in a row rather than floating over the work.** A bar
   * hovering over the surface covers the bottom of every screen and has to be
   * translucent to be bearable, which makes the one always-available input in
   * the application also the one that is hardest to read. A row of its own costs
   * 8px more than the status bar already takes and covers nothing.
   *
   * **Left is about the work, right is about you.** A resource's state and a
   * person's attention are different kinds of fact, and putting them at opposite
   * ends is what stops the bar becoming a single run of unrelated chips.
   */
  const { copilot } = clientModel();
  const view = viewState();

  // ------------------------------------------------------------ the work ----

  /**
   * What is on the surface, and nothing about which screen is showing it.
   *
   * The screen has a tab two rows up; naming it again here would spend the one
   * always-visible line on the least surprising fact in the application. What
   * the tab strip cannot say is which *thing* a permanent tab is on, because it
   * moves between subjects without ever minting a tab — the Agents tab on a
   * persona is exactly the case a tab label cannot describe.
   *
   * `resourceId` first, because a tab that holds an identified thing is named by
   * it; `focus` otherwise, which is where a permanent tab keeps its subject.
   */
  const subjectId = $derived(view.active.resourceId ?? view.active.focus);

  const on = $derived(subjectId === undefined ? undefined : subjectDoor(subjectId).current);

  // ----------------------------------------------------------------- you ----

  const mentions = $derived(mentionsForViewer().current);
  const unresolved = $derived(mentions.filter((c: PersonComment) => !c.resolved));

  // ------------------------------------------------------------- copilot ----

  /** Display copy for the model's three modes. The ids are the model's. */
  const MODES = [
    { id: "ask", label: "Ask" },
    { id: "plan", label: "Plan" },
    { id: "act", label: "Act" }
  ] as const satisfies readonly { id: Mode; label: string }[];

  const PERSONAS = ["Generalist", "Analyst", "Editor", "Researcher", "Critic"];

  /** The class is how the stylesheet reaches the portalled menu. */
  const MENU = "copilot-menu max-h-[7rem] min-w-32";

  let composer = $state<HTMLTextAreaElement>();

  const mode = $derived(copilot.mode);
  const persona = $derived(copilot.personaId ?? PERSONAS[0]);
  const prompt = $derived(copilot.draft);

  /**
   * The whole of the `copilot.focus` command on this side: the model counts
   * requests and the bar acts on a number it has not seen before. A boolean
   * would have to be reset by whoever consumed it, which means the model holding
   * a flag about a DOM operation it cannot observe.
   */
  let acted = $state(0);

  $effect(() => {
    if (copilot.focusRequests === acted) return;
    acted = copilot.focusRequests;
    composer?.focus();
  });

  /**
   * Engaging the composer opens the Copilot's lens. Two calls deliberately:
   * `inspect()` records what is being looked at, `resize()` moves a panel, and
   * folding the second into the first would make every future caller of
   * `inspect()` a layout change.
   */
  const activate = () => {
    view.inspect("copilot.home");
    if (view.frame.inspectorCollapsed) view.resize({ inspectorCollapsed: false });
  };

  /** Three lines, then it scrolls inside itself, so the bar's height is bounded. */
  const MAX_HEIGHT = 66;

  const grow = () => {
    if (!composer) return;
    composer.style.height = "auto";
    composer.style.height = `${Math.min(composer.scrollHeight, MAX_HEIGHT)}px`;
  };

  const submit = (event: SubmitEvent) => {
    event.preventDefault();
    if (copilot.blocked) return;

    // ── FORWARD DECLARATION ──────────────────────────────────────────────
    // No agent capability exists, so nothing is dispatched. `sent` is past
    // tense and belongs after the mutation resolves, so a refusal would leave
    // the draft in the composer. Until then the message goes where addressed.
    copilot.sent(copilot.destination);

    activate();
    void tick().then(grow);
  };

  const onkeydown = (event: KeyboardEvent) => {
    if (event.key === "Enter" && !event.shiftKey && !event.isComposing) {
      submit(event as unknown as SubmitEvent);
    }
  };
</script>

<footer class="status-bar">
  <!--
    What is on the work surface. Never a control except for the subject, which
    opens what it names — a status bar that acted on things would be a toolbar.
  -->
  <div class="part start">
    {#if on}
      <span class="subject" title={on.name}>{on.name}</span>
      {#if on.kind}
        <span class="sep" aria-hidden="true">·</span>
        <span class="label">{on.kind}</span>
      {/if}
    {:else}
      <span class="label">Nothing open</span>
    {/if}
  </div>

  <div class="copilot">
  <form
    class="bar"
    aria-label="Copilot"
    onsubmit={submit}
    onfocusin={activate}
  >
    <!--
      Both menus open upward, into the space above the bar. A menu dropping from
      this row would land off the bottom of the viewport.
    -->
    <div class="control intent">
      <Select.Root
        type="single"
        value={mode}
        onValueChange={(next) => copilot.setMode(next as Mode)}
      >
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

    <textarea
      bind:this={composer}
      value={prompt}
      oninput={(event) => {
        copilot.write(event.currentTarget.value);
        grow();
      }}
      {onkeydown}
      rows="1"
      aria-label="Copilot prompt"
      placeholder="Describe the next move"
    ></textarea>

    <div class="control who">
      <Select.Root
        type="single"
        value={persona}
        onValueChange={(next) => copilot.selectPersona(next)}
      >
        <Select.Trigger size="sm" aria-label="Persona">{persona}</Select.Trigger>
        <Select.Content side="top" align="center" class={MENU}>
          {#each PERSONAS as name (name)}
            <Select.Item value={name} label={name}>{name}</Select.Item>
          {/each}
        </Select.Content>
      </Select.Root>
    </div>

    <button
      type="submit"
      class="send"
      disabled={copilot.blocked !== undefined}
      title={copilot.blocked ?? "Send"}
      aria-label="Send {mode}"
    >
      <ArrowUp size={13} aria-hidden="true" />
    </button>
  </form>
  </div>

  <!--
    You: what is addressed to you, and who you are. The count is a button
    because an unanswered mention is the one thing here worth acting on.
  -->
  <div class="part end">
    <!--
      Named, because a lens is about something. Opening this without saying
      which mention would leave whatever was last selected as the subject, and
      the panel would answer about a row nobody pointed at.
    -->
    <button
      type="button"
      class="mentions"
      class:waiting={unresolved.length > 0}
      disabled={unresolved.length === 0}
      title={unresolved.length === 0
        ? "Nothing addressed to you"
        : `${unresolved.length} unresolved mentions`}
      onclick={() =>
        unresolved[0] &&
        view.inspect("collaboration.mention", { kind: "comment", id: unresolved[0].id })}
    >
      <AtSign size={12} aria-hidden="true" />
      <span class="tabular-nums">{unresolved.length}</span>
    </button>
    <span class="sep" aria-hidden="true">·</span>
    <span class="label">{VIEWER.name}</span>
  </div>
</footer>

<style>
  /**
   * The frame's own columns. `--app-context` and `--app-inspector` are set by the
   * frame from the active tab, so the three parts track the panels as they are
   * dragged — the composer stays exactly as wide as the work surface.
   */
  .status-bar {
    display: grid;
    height: 100%;
    grid-template-columns: var(--app-context) 1fr var(--app-inspector);
    align-items: center;
    background-color: var(--token-surface-panel);
    border-top: 1px solid var(--token-border-subtle);
  }

  .part {
    display: flex;
    min-width: 0;
    align-items: center;
    gap: calc(var(--token-spacing-unit) * 1.5);
    padding-inline: calc(var(--token-spacing-unit) * 3);
    font-size: var(--token-text-caption);
    color: var(--token-ink-muted);
  }

  .end {
    justify-content: flex-end;
  }

  .label {
    white-space: nowrap;
  }

  .subject {
    overflow: hidden;
    color: var(--token-ink-secondary);
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .sep {
    color: var(--token-border-strong);
  }

  .mentions {
    display: flex;
    align-items: center;
    gap: calc(var(--token-spacing-unit) * 0.75);
    border-radius: var(--token-radius-control);
    padding-inline: calc(var(--token-spacing-unit) * 1);
  }

  .mentions:hover {
    background-color: var(--token-surface-panel-hover);
    color: var(--token-ink-primary);
  }

  /* The one place in the bar that raises its voice, and only when something is
     actually waiting. */
  .mentions.waiting {
    color: var(--token-color-attention-text);
  }

  /**
   * The composer grows UPWARD out of the row rather than making the row taller.
   *
   * The bar is a fixed band in the frame's grid, and a band that resized as
   * someone typed would reflow the whole work surface mid-sentence. So the cell
   * is the anchor and the form is absolutely placed against its bottom edge: at
   * rest it is exactly the row, and past one line it grows over the work rather
   * than pushing at it.
   */
  .copilot {
    position: relative;
    min-width: 0;
    height: 100%;
    border-inline: 1px solid var(--token-border-subtle);
  }

  .bar {
    position: absolute;
    inset-inline: 0;
    bottom: 0;
    display: flex;
    align-items: flex-end;
    gap: calc(var(--token-spacing-unit) * 1.5);
    background-color: var(--token-surface-panel);
    padding-inline: calc(var(--token-spacing-unit) * 2);
    padding-block-end: calc(var(--token-spacing-unit) * 1);
  }

  .bar textarea {
    min-width: 0;
    flex: 1;
    max-height: 66px;
    /* 24px at rest: the row is 32 and the block padding takes the rest. A
       line-height in the rule rather than on the token scale, because this is
       the one place a caption has to sit inside a fixed band. */
    line-height: calc(var(--token-spacing-unit) * 6);
    font-size: var(--token-text-caption);
    color: var(--token-ink-primary);
    background: transparent;
    border: none;
    resize: none;
    field-sizing: content;
  }

  .bar textarea:focus {
    outline: none;
  }

  .bar textarea::placeholder {
    color: var(--token-ink-muted);
  }

  /*
    The two selects wear the bar's scale rather than the registry's. A control
    sized for a form is half again the height of this row.
  */
  .control :global(button) {
    height: calc(var(--token-spacing-unit) * 6);
    border: none;
    background: transparent;
    padding-inline: calc(var(--token-spacing-unit) * 1.5);
    font-size: var(--token-text-caption);
    color: var(--token-ink-secondary);
  }

  .control :global(button:hover) {
    color: var(--token-ink-primary);
  }

  /* The chevron says what the border already says, in a row with no space for
     either. Hidden from here, where the decision belongs, rather than removed
     from a registry component every other surface shares. */
  .control :global(button > svg:last-child) {
    display: none;
  }

  .intent :global(button) {
    color: var(--token-color-intelligence-text);
  }

  .send {
    display: flex;
    height: calc(var(--token-spacing-unit) * 6);
    width: calc(var(--token-spacing-unit) * 6);
    flex-shrink: 0;
    align-items: center;
    justify-content: center;
    border-radius: var(--token-radius-control);
    background-color: var(--token-color-intelligence-surface);
    color: var(--token-color-intelligence-text);
  }

  .send:disabled {
    opacity: 0.4;
  }

  /* Below the width where three parts stop being three parts. The composer keeps
     the whole row; what is on the surface and what is waiting for you both fit
     in the frame's own bars. */
  @media (max-width: 60rem) {
    .status-bar {
      grid-template-columns: 1fr;
    }

    .part {
      display: none;
    }

    .copilot {
      border-inline: none;
    }
  }
</style>
