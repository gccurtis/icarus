<script lang="ts">
  /**
   * The `document-next-text` inspection: a caret with text about to be typed.
   *
   * This is the case that shows the inspector is a control surface rather than a
   * mirror. Nothing is selected, so a mirror would have nothing to show — but
   * what a user sets here is what the editor applies to each subsequent
   * keypress, and none of that typing changes the inspection.
   *
   * The controls that would set it need an editor to apply them, so what is here
   * is the identity it was handed.
   */
  let { blockId }: { blockId: string } = $props();
</script>

<div class="inspection">
  <h2 class="heading">Caret</h2>
  <dl class="fields">
    <dt>Block</dt>
    <dd><code>{blockId}</code></dd>
  </dl>
  <p class="note">Nothing is selected. What is set here would apply to what is typed next.</p>
</div>

<style>
  .inspection {
    display: flex;
    flex-direction: column;
    gap: calc(var(--token-spacing-unit) * 3);
  }

  .heading {
    font-size: var(--token-text-label);
    font-weight: 600;
    color: var(--token-ink-secondary);
    margin: 0;
  }

  .fields {
    display: grid;
    grid-template-columns: auto 1fr;
    gap: var(--token-spacing-unit) calc(var(--token-spacing-unit) * 3);
    margin: 0;
    font-size: var(--token-text-body-sm);
  }

  dt {
    color: var(--token-ink-muted);
  }

  dd {
    margin: 0;
  }

  .note {
    font-size: var(--token-text-caption);
    color: var(--token-ink-muted);
    margin: 0;
  }

  code {
    font-family: var(--token-font-mono);
    font-size: var(--token-text-mono);
    color: var(--token-ink-primary);
  }
</style>
