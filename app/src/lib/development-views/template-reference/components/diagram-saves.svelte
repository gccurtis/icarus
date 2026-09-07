<script lang="ts">
  const KEYSTROKES = [200, 250, 300, 350, 400, 450, 500, 620, 670, 720];
  const FLUSHES = [210, 260, 310, 360, 410, 460, 510, 630, 680, 730];
</script>

<svg class="saves" viewBox="0 0 980 300" role="img" aria-label="The editor autosaves the working copy continuously; pressing Save moves the template's revision once">
  <defs>
    <marker id="tref-tick" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
      <path d="M 0 0 L 10 5 L 0 10 z" class="head" />
    </marker>
  </defs>

  <text x="20" y="28" class="lane-name">You</text>
  <text x="20" y="48" class="lane-hint">typing, moving blocks</text>
  <line x1="150" y1="34" x2="940" y2="34" class="rail" marker-end="url(#tref-tick)" />
  {#each KEYSTROKES as at (at)}
    <circle cx={at} cy="34" r="4" class="dot" />
  {/each}
  <text x="560" y="26" class="press">press Save in the panel</text>
  <path d="M 560 40 L 560 96" class="press-line" marker-end="url(#tref-tick)" />

  <text x="20" y="128" class="lane-name">The working copy</text>
  <text x="20" y="148" class="lane-hint">an ordinary resource</text>
  <line x1="150" y1="134" x2="940" y2="134" class="rail solid" marker-end="url(#tref-tick)" />
  {#each FLUSHES as at (at)}
    <rect x={at - 3} y="126" width="6" height="16" rx="2" class="flush" />
  {/each}
  <text x="212" y="170" class="note">the editor flushes as you go — this is the save you already know</text>

  <text x="20" y="228" class="lane-name">The template</text>
  <text x="20" y="248" class="lane-hint">what everyone else uses</text>
  <line x1="150" y1="234" x2="940" y2="234" class="rail solid" marker-end="url(#tref-tick)" />
  <rect x="150" y="212" width="410" height="44" rx="8" class="rev" />
  <text x="170" y="240" class="rev-label">revision 4 · unchanged all this time</text>
  <rect x="562" y="212" width="378" height="44" rx="8" class="rev next" />
  <text x="582" y="240" class="rev-label">revision 5 · the copy's body, made portable</text>
  <path d="M 560 150 L 560 208" class="press-line" marker-end="url(#tref-tick)" />

  <text x="20" y="288" class="note">Two different saves: one keeps your work, one publishes it. Only the second one moves the template.</text>
</svg>

<style>
  .saves { display: block; width: 100%; height: auto; }

  .lane-name { fill: var(--token-ink-primary); font: 700 13px/1 "IBM Plex Sans", ui-sans-serif, system-ui, sans-serif; }
  .lane-hint { fill: var(--token-ink-muted); font: 400 11px/1 "IBM Plex Sans", ui-sans-serif, system-ui, sans-serif; }

  .rail { stroke: var(--token-border-subtle); stroke-width: 2; stroke-dasharray: 4 5; }
  .rail.solid { stroke-dasharray: none; }
  .head { fill: var(--token-border-strong); }

  .dot { fill: var(--token-ink-muted); }
  .flush { fill: var(--token-color-accent-1-text); }

  .press { fill: var(--token-color-active-text); font: 700 12px/1 "IBM Plex Mono", ui-monospace, monospace; }
  .press-line { fill: none; stroke: var(--token-color-active-text); stroke-width: 2; stroke-dasharray: 5 4; }

  .rev { fill: var(--token-surface-work); stroke: var(--token-border-subtle); }
  .rev.next { fill: var(--token-color-active-surface); stroke: var(--token-color-active-text); }
  .rev-label { fill: var(--token-ink-secondary); font: 400 12.5px/1 "IBM Plex Sans", ui-sans-serif, system-ui, sans-serif; }

  .note { fill: var(--token-ink-muted); font: 400 12px/1 "IBM Plex Sans", ui-sans-serif, system-ui, sans-serif; }
</style>
