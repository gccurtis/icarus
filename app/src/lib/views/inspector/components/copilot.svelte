<script lang="ts">
  /**
   * The `copilot` inspection: the assistant's own panel.
   *
   * The clearest case that an inspection is not a thing inside a resource.
   * Nothing on the work surface is selected here — what is under inspection is
   * the copilot itself, and this is where its conversations, its running work,
   * and the active exchange live.
   *
   * The `home` member is search and running work with no conversation open —
   * with nothing open. Submitting from the bar with no chat open is how one gets
   * created, so there is no New chat control to add.
   *
   * **A fixture.** No agent capability exists, so nothing here is fetched and
   * nothing is sent. What is real is the shape and the route into it: the bar
   * inspects `copilot`, the inspector resolves that label, and this renders.
   */
  let { member }: { member: string } = $props();

  const RUNNING = [
    { id: "t1", label: "Summarising interview-03", state: "Running" },
    { id: "t2", label: "Reconcile Q3 figures", state: "Needs review" }
  ];

  const RECENT = [
    { id: "c1", label: "Where did the churn number come from?" },
    { id: "c2", label: "Draft the runway section" }
  ];
</script>

<div class="copilot">
  {#if member !== "home"}
    <h2 class="heading">Chat</h2>
    <p class="note">Showing <code>{member}</code>.</p>
    <p class="note">Turns render here once an agent capability can supply them.</p>
  {:else}
    <h2 class="heading">Copilot</h2>

    <label class="search">
      <span class="sr-only">Search conversations</span>
      <input type="search" placeholder="Search conversations" />
    </label>

    <section class="group" aria-label="Running work">
      <h3 class="label">Running</h3>
      <ul class="rows">
        {#each RUNNING as task (task.id)}
          <li><span class="row-label">{task.label}</span><span class="state">{task.state}</span></li>
        {/each}
      </ul>
    </section>

    <section class="group" aria-label="Recent conversations">
      <h3 class="label">Recent</h3>
      <ul class="rows">
        {#each RECENT as chat (chat.id)}
          <li><span class="row-label">{chat.label}</span></li>
        {/each}
      </ul>
    </section>
  {/if}
</div>

<style>
  .copilot {
    display: flex;
    flex-direction: column;
    gap: calc(var(--token-spacing-unit) * 3);
  }

  .heading {
    font-size: var(--token-text-label);
    font-weight: 600;
    color: var(--token-color-intelligence-text);
    margin: 0;
  }

  .label {
    font-size: var(--token-text-caption);
    font-weight: 600;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: var(--token-ink-muted);
    margin: 0 0 var(--token-spacing-unit);
  }

  .note {
    font-size: var(--token-text-body-sm);
    color: var(--token-ink-muted);
    margin: 0;
  }

  input {
    width: 100%;
    min-height: calc(var(--token-spacing-unit) * 8);
    padding-inline: calc(var(--token-spacing-unit) * 2);
    border: 1px solid var(--token-border-subtle);
    border-radius: var(--token-radius-control);
    background-color: var(--token-surface-canvas);
    font: inherit;
    font-size: var(--token-text-body-sm);
    color: var(--token-ink-primary);
  }

  .rows {
    display: flex;
    flex-direction: column;
    gap: var(--token-spacing-unit);
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .rows li {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: calc(var(--token-spacing-unit) * 2);
    min-height: calc(var(--token-spacing-unit) * 7);
    padding: calc(var(--token-spacing-unit) * 1) calc(var(--token-spacing-unit) * 2);
    border: 1px solid transparent;
    border-radius: var(--token-radius-control);
    font-size: var(--token-text-body-sm);
  }

  .rows li:hover {
    border-color: var(--token-border-subtle);
  }

  .row-label {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .state {
    flex-shrink: 0;
    font-size: var(--token-text-caption);
    color: var(--token-ink-muted);
  }

  code {
    font-family: var(--token-font-mono);
    font-size: var(--token-text-mono);
  }

  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip-path: inset(50%);
    white-space: nowrap;
  }
</style>
