<script lang="ts">
  /**
   * Shown when the session has no inspection at all.
   *
   * Distinct from inspecting `{ kind: "empty" }`, which means the caret is
   * somewhere with nothing to inspect *yet* and can still be offered insert
   * affordances. This one means nothing is focused.
   *
   * A named state with its own copy, rather than a blank panel: a state without
   * a name is a state that has not been designed.
   */
</script>

<p class="nothing">Nothing selected.</p>

<style>
  .nothing {
    font-size: var(--token-text-body-sm);
    color: var(--token-ink-muted);
  }
</style>
