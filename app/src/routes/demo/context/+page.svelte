<script lang="ts">
  import Review from "$development-views/review/review.svelte";

  /**
   * The context panel, one view at a time.
   *
   * The glob is here rather than in the view because `import.meta.glob` needs a
   * literal pattern — a variable would give the bundler nothing to resolve. So
   * the three routes differ by exactly this line, and the view is the same.
   */
  const modules = import.meta.glob("$lib/app-views/panels/context/**/*.svelte");
</script>

<Review kind="context" {modules} />
