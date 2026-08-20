<script lang="ts">
  import type { Tab } from "$model/client";
  import { ScreenPlaceholder } from "$lib/unique-components/screen";

  /**
   * The deck editor's workspace: one region, and that region is a Fabric canvas.
   *
   * Editing a slide, editing a layout and choosing a new slide are all states of
   * this one editor — the framework does not change between them, only what it is
   * showing.
   */
  let { tab }: { tab: Tab } = $props();

  // svelte-ignore state_referenced_locally
  void tab;
</script>

<ScreenPlaceholder framework="Fabric — not yet installed">
  The adapter spike has to prove three things before this is real: IME and text
  alignment inside a nested editor, nested hit testing, and stable reconciliation
  against remote changes. On top of it Icarus adds layouts with locked content and
  placeholders, frames as fractions of the slide so a deck survives a change of
  aspect ratio, and duplication that mints new IDs for every identified
  descendant.
</ScreenPlaceholder>
