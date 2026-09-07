<script lang="ts">
</script>

<div class="funnel">
  <ol>
    <li class="answer">
      <span class="rank">1</span>
      <div>
        <b>What the person said</b>
        <p>The answer chosen in the Insert or Use modal, for this copy only. Stored nowhere.</p>
      </div>
      <code>answers[name]</code>
    </li>
    <li class="fallback">
      <span class="rank">2</span>
      <div>
        <b>Else the variable's default scope</b>
        <p>Everything in the project, particular kinds, one of the project's named sets — or another variable, expanded the same way.</p>
      </div>
      <code>variable.default</code>
    </li>
    <li class="floor">
      <span class="rank">3</span>
      <div>
        <b>Else everything in the project</b>
        <p>A variable with no default, or one that reaches itself. There is always an answer, so a template always resolves.</p>
      </div>
      <code>{"{ select: \"project\" }"}</code>
    </li>
  </ol>
  <p class="undeclared">
    A prompt naming a variable the template does not declare is the one thing that refuses:
    <code>unsupported-body</code>, with the names, rather than a guess.
  </p>
</div>

<style>
  .funnel { display: grid; gap: 1rem; }

  ol { display: grid; gap: .55rem; margin: 0; padding: 0; list-style: none; }

  li {
    display: grid;
    grid-template-columns: 2rem minmax(0, 1fr) auto;
    gap: 1rem;
    align-items: center;
    padding: .9rem 1.1rem;
    border: 1px solid var(--token-border-subtle);
    border-radius: 8px;
    background: var(--token-surface-elevated);
  }

  li.answer { width: 100%; border-color: var(--token-color-active-text); background: var(--token-color-active-surface); }
  li.fallback { width: 94%; }
  li.floor { width: 88%; background: var(--token-surface-work); }

  .rank {
    display: grid;
    width: 1.6rem;
    height: 1.6rem;
    place-items: center;
    border-radius: 50%;
    background: var(--token-ink-primary);
    color: var(--token-surface-canvas);
    font: 700 11px/1 "IBM Plex Mono", ui-monospace, monospace;
  }

  b { display: block; font-size: 13.5px; }
  p { margin: .15rem 0 0; color: var(--token-ink-secondary); font-size: 12.5px; }

  code {
    padding: .15rem .4rem;
    border-radius: 4px;
    background: var(--token-surface-canvas);
    color: var(--token-ink-muted);
    font-family: "IBM Plex Mono", ui-monospace, monospace;
    font-size: 11px;
    white-space: nowrap;
  }

  .undeclared { margin: 0; color: var(--token-ink-muted); font-size: 12.5px; }

  @media (max-width: 52rem) {
    li { grid-template-columns: 2rem minmax(0, 1fr); width: 100%; }
    li code { grid-column: 2; justify-self: start; }
  }
</style>
