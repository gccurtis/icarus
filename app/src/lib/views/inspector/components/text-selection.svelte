<script lang="ts">
  /**
   * The `document-text-selection` inspection.
   *
   * It receives ids and offsets and nothing else, which is the model's contract
   * rather than an omission here: an inspection names what was selected and
   * whoever renders it fetches whatever it needs. A carried payload would be a
   * copy of text that lives elsewhere and may have changed since — the same
   * reason an inspection is never persisted.
   *
   * **The fetch is the missing half.** Turning a block id and two offsets into
   * the text itself needs a document capability, which does not exist. What this
   * shows is the identity it was handed; the controls that act on a selection —
   * style, weight, comment — arrive with the thing that can apply them.
   */
  let { anchor, from, to }: { anchor?: string; from: number; to: number } = $props();
</script>

<div class="inspection">
  <h2 class="heading">Text selection</h2>
  <dl class="fields">
    <dt>Block</dt>
    <dd><code>{anchor ?? "—"}</code></dd>
    <dt>Characters</dt>
    <dd><code>{from}–{to}</code></dd>
    <dt>Length</dt>
    <dd><code>{to - from}</code></dd>
  </dl>
  <p class="note">The text itself is fetched, not carried. That fetch needs a document capability.</p>
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
