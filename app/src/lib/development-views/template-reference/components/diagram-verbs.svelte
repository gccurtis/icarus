<script lang="ts">
</script>

<svg class="verbs" viewBox="0 0 1040 360" role="img" aria-label="A document becomes a template; the template makes copies and is edited through a working copy">
  <defs>
    <marker id="tref-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
      <path d="M 0 0 L 10 5 L 0 10 z" class="head" />
    </marker>
  </defs>

  <text x="20" y="26" class="note">The template is never edited directly — the editors open documents and decks, so a template is edited through one.</text>

  <g class="box source">
    <rect x="20" y="140" width="200" height="86" rx="10" />
    <text x="38" y="174" class="title">A document or deck</text>
    <text x="38" y="196" class="sub">Something you already have</text>
    <text x="38" y="214" class="sub">in this project</text>
  </g>

  <g class="box template">
    <rect x="430" y="40" width="240" height="104" rx="10" />
    <text x="450" y="72" class="title">The template</text>
    <text x="450" y="94" class="sub">A portable body, its holes,</text>
    <text x="450" y="112" class="sub">and a revision that only moves</text>
    <text x="450" y="130" class="sub">when the working copy is saved</text>
  </g>

  <g class="box copy">
    <rect x="430" y="230" width="240" height="96" rx="10" />
    <text x="450" y="262" class="title">The working copy</text>
    <text x="450" y="284" class="sub">An ordinary document or deck,</text>
    <text x="450" y="302" class="sub">one per template, shared,</text>
    <text x="450" y="320" class="sub">autosaved like anything else</text>
  </g>

  <g class="box made">
    <rect x="840" y="140" width="180" height="86" rx="10" />
    <text x="858" y="174" class="title">A copy of it, here</text>
    <text x="858" y="196" class="sub">A new resource, or rows</text>
    <text x="858" y="214" class="sub">in what you have open</text>
  </g>

  <path class="line" d="M 220 168 C 300 168 340 100 428 96" marker-end="url(#tref-arrow)" />
  <text x="234" y="122" class="label">Save as template</text>
  <text x="234" y="138" class="hint">a copy, made portable</text>

  <path class="line" d="M 672 96 C 760 100 790 166 838 170" marker-end="url(#tref-arrow)" />
  <text x="690" y="104" class="label">Use · Insert</text>
  <text x="690" y="120" class="hint">asks what each hole selects</text>

  <path class="line" d="M 500 146 L 500 226" marker-end="url(#tref-arrow)" />
  <text x="486" y="180" class="label right">Edit</text>
  <text x="486" y="196" class="hint right">opens the copy</text>

  <path class="line up" d="M 600 226 L 600 150" marker-end="url(#tref-arrow)" />
  <text x="616" y="180" class="label">Save</text>
  <text x="616" y="196" class="hint">the copy becomes revision N + 1</text>
</svg>

<style>
  .verbs { display: block; width: 100%; height: auto; }

  .box rect { fill: var(--token-surface-elevated); stroke: var(--token-border-strong); stroke-width: 1.5; }
  .box.template rect { fill: var(--token-color-active-surface); stroke: var(--token-color-active-text); }
  .box.copy rect { fill: var(--token-color-accent-1-surface); stroke: var(--token-color-accent-1-text); }

  .title { fill: var(--token-ink-primary); font: 700 16px/1 "IBM Plex Sans", ui-sans-serif, system-ui, sans-serif; }
  .sub { fill: var(--token-ink-secondary); font: 400 12.5px/1 "IBM Plex Sans", ui-sans-serif, system-ui, sans-serif; }

  .label { fill: var(--token-ink-primary); font: 700 12.5px/1 "IBM Plex Mono", ui-monospace, monospace; }
  .hint { fill: var(--token-ink-muted); font: 400 11.5px/1 "IBM Plex Sans", ui-sans-serif, system-ui, sans-serif; }
  .right { text-anchor: end; }

  .note { fill: var(--token-ink-muted); font: 400 12px/1 "IBM Plex Sans", ui-sans-serif, system-ui, sans-serif; }

  .line { fill: none; stroke: var(--token-border-strong); stroke-width: 2; }
  .line.up { stroke: var(--token-color-active-text); }
  .head { fill: var(--token-border-strong); }
</style>
