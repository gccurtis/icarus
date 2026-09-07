<script lang="ts">
  import type { DecisionBrief } from "$development-views/editor-audit/types";

  let {
    brief,
    answer,
    onanswer
  }: {
    brief: DecisionBrief;
    answer: string;
    onanswer: (answer: string) => void;
  } = $props();

  const recommended = $derived(
    brief.options.find((option) => option.id === brief.recommendation.optionId)
  );
  const decided = $derived(
    brief.options.find((option) => option.id === brief.decision?.optionId)
  );
  const resolved = $derived(brief.decision !== undefined || answer.trim().length > 0);
</script>

<details class="decision-card" open={brief.id === "DEC-05"}>
  <summary>
    <span class="decision-id">{brief.id}</span>
    <span class="decision-kind">{brief.kind}</span>
    <strong>{brief.question}</strong>
    <span class:answered={resolved} class="answer-state">
      {brief.decision !== undefined ? "Decision recorded" : answer.trim().length > 0 ? "Answered" : "Your input needed"}
    </span>
  </summary>

  <div class="decision-body">
    <section class="decision-stakes" aria-labelledby="{brief.id}-why">
      <h3 id="{brief.id}-why">Why this needs you</h3>
      <p>{brief.stakes}</p>
    </section>

    <section class="decision-context" aria-labelledby="{brief.id}-context">
      <h3 id="{brief.id}-context">Grounding</h3>
      {#each brief.context as paragraph (paragraph)}
        <p>{paragraph}</p>
      {/each}
    </section>

    <section class="decision-recommendation" aria-labelledby="{brief.id}-recommendation">
      <span>Recommendation</span>
      <h3 id="{brief.id}-recommendation">{recommended?.label}</h3>
      <p>{brief.recommendation.rationale}</p>
    </section>

    {#if brief.decision !== undefined}
      <section class="decision-recorded" aria-labelledby="{brief.id}-decision">
        <span>Decision recorded · {brief.decision.recordedAt}</span>
        <h3 id="{brief.id}-decision">{decided?.label ?? brief.decision.optionId}</h3>
        <p>{brief.decision.direction}</p>
      </section>
    {/if}

    <section class="decision-criteria" aria-labelledby="{brief.id}-criteria">
      <h3 id="{brief.id}-criteria">What matters in this decision</h3>
      <p>The comparison below uses these criteria; together they define what I optimized for.</p>
      <ul>
        {#each brief.criteria as criterion (criterion.id)}
          <li><strong>{criterion.label}</strong><span>{criterion.explanation}</span></li>
        {/each}
      </ul>
    </section>

    <section class="decision-alternatives" aria-labelledby="{brief.id}-alternatives">
      <h3 id="{brief.id}-alternatives">Alternatives and tradeoffs</h3>
      <div class="table-wrap decision-table-wrap">
        <table class="decision-table">
          <thead>
            <tr>
              <th>Alternative</th>
              {#each brief.criteria as criterion (criterion.id)}<th>{criterion.label}</th>{/each}
            </tr>
          </thead>
          <tbody>
            {#each brief.options as option (option.id)}
              <tr
                class:recommended={option.id === brief.recommendation.optionId}
                class:decided={option.id === brief.decision?.optionId}
              >
                <th>
                  <span>{option.label}</span>
                  {#if option.id === brief.recommendation.optionId}<small>Recommended</small>{/if}
                  {#if option.id === brief.decision?.optionId}<small class="recorded">Decided</small>{/if}
                  <p>{option.summary}</p>
                </th>
                {#each brief.criteria as criterion (criterion.id)}
                  <td>{option.tradeoffs[criterion.id]}</td>
                {/each}
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    </section>

    <section class="decision-answer" aria-labelledby="{brief.id}-answer">
      <div>
        <h3 id="{brief.id}-answer">{brief.decision === undefined ? "Your direction" : "Amendment or added constraint"}</h3>
        <p>{brief.decision === undefined ? "Name an alternative, approve the recommendation, or describe a different rule and anything I should preserve." : "Use this only to amend the recorded direction or add a constraint; local notes do not silently change the source decision record."}</p>
      </div>
      <textarea
        aria-label="Response to: {brief.question}"
        placeholder={brief.decision === undefined ? "My decision is…\n\nThe important constraint is…" : "Amendment or additional constraint…"}
        value={answer}
        oninput={(event) => onanswer(event.currentTarget.value)}
      ></textarea>
    </section>
  </div>
</details>
