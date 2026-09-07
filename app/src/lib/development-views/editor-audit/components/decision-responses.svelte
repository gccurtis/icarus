<script lang="ts">
  import { onMount } from "svelte";
  import Check from "@lucide/svelte/icons/check";
  import Copy from "@lucide/svelte/icons/copy";

  import DecisionCard from "$development-views/editor-audit/components/decision-card.svelte";
  import { DECISIONS } from "$development-views/editor-audit/procedures/decisions";

  const STORAGE_KEY = "icarus.editor-audit.responses.v1";

  let answers = $state<Record<string, string>>({});
  let storageStatus = $state("Loading saved responses…");
  let copyStatus = $state("");
  let touchedBeforeLoad = false;

  const completed = $derived(
    DECISIONS.filter(
      (decision) => decision.decision !== undefined || (answers[decision.id] ?? "").trim().length > 0
    ).length
  );

  onMount(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      const restored = stored === null ? {} : JSON.parse(stored);
      answers = touchedBeforeLoad ? { ...restored, ...answers } : restored;
      if (touchedBeforeLoad) localStorage.setItem(STORAGE_KEY, JSON.stringify(answers));
      storageStatus = "Responses save automatically in this browser.";
    } catch {
      answers = {};
      storageStatus = "Browser storage is unavailable; copy your responses before leaving.";
    }
  });

  const update = (id: string, answer: string) => {
    touchedBeforeLoad = true;
    answers = { ...answers, [id]: answer };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(answers));
      storageStatus = "Saved in this browser.";
    } catch {
      storageStatus = "Could not save locally; copy your responses before leaving.";
    }
    copyStatus = "";
  };

  const handoff = () => DECISIONS.map((decision) => {
    const recommended = decision.options.find((held) => held.id === decision.recommendation.optionId);
    const chosen = decision.options.find((held) => held.id === decision.decision?.optionId);
    const answer = (answers[decision.id] ?? "").trim();
    return [
      `## ${decision.id} — ${decision.question}`,
      `Recommended: ${recommended?.label ?? decision.recommendation.optionId}`,
      ...(decision.decision === undefined
        ? []
        : [
            `Recorded: ${chosen?.label ?? decision.decision.optionId} · ${decision.decision.recordedAt}`,
            decision.decision.direction
          ]),
      "",
      answer.length > 0 ? `Follow-up: ${answer}` : "[No follow-up]"
    ].join("\n");
  }).join("\n\n");

  const copyAll = async () => {
    try {
      await navigator.clipboard.writeText(handoff());
      copyStatus = "Copied. Paste the responses into our chat so I can apply them.";
    } catch {
      copyStatus = "Copy was blocked by the browser. Select and copy each response directly.";
    }
  };
</script>

<div class="decision-intro">
  <div>
    <strong>{completed} of {DECISIONS.length} decisions recorded</strong>
    <span>{storageStatus}</span>
  </div>
  <button type="button" onclick={() => void copyAll()}>
    <Copy size={15} aria-hidden="true" /> Copy decision record
  </button>
</div>

<p class="decision-handoff">
  The recorded directions are source-controlled below. These fields remain available for amendments or added
  constraints; they stay local to your browser and do not silently change the record or send a message.
</p>

{#if copyStatus.length > 0}
  <p class="copy-status" aria-live="polite"><Check size={14} aria-hidden="true" />{copyStatus}</p>
{/if}

<div class="decision-list">
  {#each DECISIONS as decision (decision.id)}
    <DecisionCard
      brief={decision}
      answer={answers[decision.id] ?? ""}
      onanswer={(answer) => update(decision.id, answer)}
    />
  {/each}
</div>
