<script lang="ts">
  import { PanelChip } from "$lib/unique-components/panel";

  /**
   * What the agent ran to produce the message above it, and what came back.
   *
   * **The claim comes before the machinery.** That is the Research
   * specification's ordering and the reason this sits under the prose rather
   * than over it: a reader who believes the answer never looks, and a reader who
   * does not needs the calls in the same message rather than in a panel they
   * have to go and find.
   *
   * **A call that found nothing is an outcome, not an error.** It gets a neutral
   * chip and its own sentence, because on a thin turn it is the most informative
   * line on the screen — it says the answer is thin because the material is
   * thin, which is a completely different problem from a broken tool. Painting
   * it red would send someone looking for a fault that is not there.
   *
   * **Every row says what it got, not only that it ran.** A name and a duration
   * are a receipt. "4 regions across 3 sources" is the part anyone can act on,
   * and it is the half a chip-only rendering drops.
   */
  let {
    calls
  }: {
    calls: readonly {
      /** The tool, verbatim and in mono — it is a name someone would retype. */
      name: string;
      outcome: "success" | "nothing" | "failed";
      /** What came back, in words. Never a bare status repeated. */
      result: string;
      duration: string;
    }[];
  } = $props();

  /** Whole class names are `PanelChip`'s business; these are its role words. */
  const TONE = { success: "success", nothing: "neutral", failed: "danger" } as const;
  const WORD = { success: "Success", nothing: "Found nothing", failed: "Failed" } as const;
</script>

<ul class="border-border-subtle rounded-control m-0 flex list-none flex-col gap-1.5 border p-2">
  <!--
    Keyed by position, not by name. A name is not unique — two `resource.read`
    calls in one turn, or a retried retrieval, are the ordinary case — and a
    duplicate key is a runtime crash rather than a rendering oddity. The list is
    fixed within a message and never reorders, so the index is the honest key.
  -->
  {#each calls as call, index (index)}
    <li class="flex flex-wrap items-baseline gap-x-2 gap-y-1">
      <code class="text-mono text-ink-primary shrink-0 font-mono">{call.name}</code>
      <PanelChip tone={TONE[call.outcome]}>{WORD[call.outcome]}</PanelChip>
      <span class="text-caption text-ink-secondary min-w-0 flex-1">{call.result}</span>
      <span class="text-caption text-ink-muted shrink-0 tabular-nums">{call.duration}</span>
    </li>
  {/each}
</ul>
