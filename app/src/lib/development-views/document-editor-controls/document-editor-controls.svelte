<script lang="ts">
  import {
    PanelColorPicker,
    PanelControlGroup,
    PanelControlRow,
    PanelMarks,
    PanelNumber
  } from "$authored-components/panel";

  const widths = [
    { label: "Narrow", value: 280 },
    { label: "Default", value: 360 },
    { label: "Expanded", value: 500 }
  ] as const;
  const marks = [
    { value: "bold", label: "Bold" },
    { value: "italic", label: "Italic" },
    { value: "underline", label: "Underline" },
    { value: "strikethrough", label: "Strikethrough" }
  ];
  const colors = [
    { value: "ink", label: "Ink", token: "var(--token-ink-primary)" },
    { value: "muted", label: "Muted", token: "var(--token-ink-muted)" },
    { value: "accent", label: "Accent", token: "var(--token-color-accent-1-fill)" },
    { value: "attention", label: "Attention", token: "var(--token-color-attention-fill)" },
    { value: "", label: "None", token: "transparent" }
  ];

  let selected = $state(["bold"]);
  let foreground = $state("ink");
  let background = $state("");
  let indent = $state(0);
  let custom = $state(false);
</script>

<svelte:head>
  <title>Document editor controls — Icarus</title>
</svelte:head>

<main class="controls-demo">
  <header>
    <p>Document editor · shared instruments</p>
    <h1>One behavior at every inspector width</h1>
    <span>Resize behavior is visible here without opening or mutating a document.</span>
  </header>

  <div class="matrix">
    {#each widths as width (width.value)}
      <section style={`width: ${width.value}px`}>
        <div class="width-label"><b>{width.label}</b><span>{width.value}px</span></div>
        <div class="panel">
          <PanelMarks
            label="Formatting"
            value={selected}
            options={marks}
            flush
            onchange={(next) => (selected = next)}
          />

          <div class="color-row">
            <div><span>Color</span><PanelColorPicker compact label="Color" value={foreground} options={colors.filter((color) => color.value !== "")} onchange={(next) => (foreground = next)} oncustom={() => (custom = true)} /></div>
            <div><span>Background</span><PanelColorPicker compact label="Background" value={background} options={colors} onchange={(next) => (background = next)} oncustom={() => (custom = true)} /></div>
          </div>

          <PanelControlGroup flush>
            <PanelControlRow label="Indent" detail="Block indentation in points">
              <PanelNumber label="Indent" value={indent} min={0} max={144} unit="pt" flush onchange={(next) => (indent = next)} />
            </PanelControlRow>
          </PanelControlGroup>

          {#if custom}
            <p class="custom-note" role="status">The custom-colour detail screen is the next routed surface.</p>
          {/if}
        </div>
      </section>
    {/each}
  </div>
</main>

<style>
  .controls-demo {
    min-height: 100vh;
    padding: calc(var(--token-spacing-unit) * 8);
    background: var(--token-surface-canvas);
    color: var(--token-ink-primary);
  }

  header {
    max-width: 56rem;
    margin: 0 auto calc(var(--token-spacing-unit) * 8);
  }

  header p,
  .width-label {
    color: var(--token-color-active-text);
    font-family: var(--token-font-mono);
    font-size: var(--token-text-caption);
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  h1 {
    margin: calc(var(--token-spacing-unit) * 2) 0;
    font-size: var(--token-text-h1);
  }

  header span {
    color: var(--token-ink-secondary);
  }

  .matrix {
    display: flex;
    align-items: flex-start;
    justify-content: center;
    gap: calc(var(--token-spacing-unit) * 6);
    overflow-x: auto;
    padding-bottom: calc(var(--token-spacing-unit) * 4);
  }

  section {
    flex: 0 0 auto;
  }

  .width-label {
    display: flex;
    justify-content: space-between;
    margin-bottom: calc(var(--token-spacing-unit) * 2);
  }

  .width-label span {
    color: var(--token-ink-muted);
  }

  .panel {
    display: flex;
    flex-direction: column;
    gap: calc(var(--token-spacing-unit) * 3);
    padding: calc(var(--token-spacing-unit) * 3);
    border: 1px solid var(--token-border-subtle);
    border-radius: var(--token-radius-panel);
    background: var(--token-surface-panel);
    box-shadow: var(--token-shadow-panel);
  }

  .color-row {
    display: flex;
    gap: calc(var(--token-spacing-unit) * 3);
  }

  .color-row > div {
    display: flex;
    align-items: center;
    gap: calc(var(--token-spacing-unit) * 1.5);
  }

  .color-row > div > span {
    flex: 0 0 auto;
    color: var(--token-ink-muted);
    font-size: var(--token-text-caption);
  }

  .custom-note {
    margin: 0;
    color: var(--token-color-intelligence-text);
    font-size: var(--token-text-caption);
  }

  @media (max-width: 72rem) {
    .matrix {
      justify-content: flex-start;
    }
  }
</style>
