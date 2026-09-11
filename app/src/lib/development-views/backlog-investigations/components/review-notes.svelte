<script lang="ts">
  import Clipboard from "@lucide/svelte/icons/clipboard";
  import { persistReviewResponses } from "$development-views/backlog-investigations/effects/review-storage.svelte";
  import type { ReviewDecision } from "$development-views/backlog-investigations/types";

  let { decisions }: { decisions: readonly ReviewDecision[] } = $props();
  let notes = $state<Record<string, string>>({});
  let copyState = $state<"idle" | "copied" | "failed">("idle");
  let persistenceReady = $state(false);

  persistReviewResponses({
    ids: () => decisions.map((decision) => decision.id),
    read: () => notes,
    write: (value) => (notes = value),
    ready: () => persistenceReady,
    setReady: (value) => (persistenceReady = value)
  });

  const reviewText = (): string => decisions
    .map((decision) => `## ${decision.id} — ${decision.title}\n\n${notes[decision.id]?.trim() || "No response yet."}`)
    .join("\n\n");

  const copyReview = async () => {
    try {
      await navigator.clipboard.writeText(reviewText());
      copyState = "copied";
    } catch {
      copyState = "failed";
    }
    window.setTimeout(() => (copyState = "idle"), 1600);
  };
</script>

<section class="review" id="review" aria-labelledby="review-title">
  <header>
    <div><span>Owner review</span><h2 id="review-title">Nothing blocks the investigations. Four choices shape implementation.</h2></div>
    <p>The recommendations are complete enough to build from. Use these fields only where you want to override or sharpen the proposed direction; responses save only in this browser until you copy them.</p>
  </header>

  <div class="review-list">
    {#each decisions as decision (decision.id)}
      <article>
        <span>{decision.id}</span>
        <h3>{decision.title}</h3>
        <p>{decision.context}</p>
        <dl><dt>Recommendation</dt><dd>{decision.recommendation}</dd><dt>Changes if overridden</dt><dd>{decision.effect}</dd></dl>
        <label for={`review-${decision.id}`}>Your direction</label>
        <textarea id={`review-${decision.id}`} bind:value={notes[decision.id]} placeholder="Agree, change the direction, or add constraints…"></textarea>
      </article>
    {/each}
  </div>

  <button type="button" onclick={copyReview}><Clipboard size={14} aria-hidden="true" />{copyState === "copied" ? "Copied" : copyState === "failed" ? "Copy failed" : "Copy review responses"}</button>
</section>
