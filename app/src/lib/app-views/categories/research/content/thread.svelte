<script lang="ts">
  import Plus from "@lucide/svelte/icons/plus";
  import SquareArrowOutUpRight from "@lucide/svelte/icons/square-arrow-out-up-right";

  import { ScreenAction, ScreenBanner, ScreenEmpty, ScreenSurface } from "$authored-components/screen";
  import { Button } from "$vendored-components/button";
  import Composer from "$app-views/categories/research/components/composer.svelte";
  import { ThreadState } from "$app-views/categories/research/content/thread.state.svelte";
  import { askQuestion } from "$app-views/categories/research/procedures/ask-question";
  import {
    chosenThread,
    currentTurn,
    threadDetail,
    threadList,
    turnById
  } from "$app-views/categories/research/procedures/chat";
  import { createThread } from "$app-views/categories/research/procedures/create-thread";
  import { startClock } from "$app-views/categories/research/procedures/effects/clock.svelte";
  import { keepDraftWithChat } from "$app-views/categories/research/procedures/effects/draft.svelte";
  import { followNewestTurn } from "$app-views/categories/research/procedures/effects/newest.svelte";
  import { refreshThreadWhenShown } from "$app-views/categories/research/procedures/effects/refresh-thread.svelte";
  import { releaseThread } from "$app-views/categories/research/procedures/effects/release.svelte";
  import { setPersona } from "$app-views/categories/research/procedures/set-persona";
  import { stopTurn } from "$app-views/categories/research/procedures/stop-turn";
  import { since } from "$app-views/categories/research/procedures/time";
  import { MODE_LABEL, SCOPE_LABEL } from "$app-views/categories/research/procedures/vocabulary";
  import { workspaceState } from "$model/client/workspace-state";

  const view = workspaceState();
  const surface = new ThreadState(view);

  const list = threadList();
  const threads = $derived(list.ready ? list.current.threads : []);
  const personas = $derived(list.ready ? list.current.personas : []);
  const resources = $derived(list.ready ? list.current.resources : []);
  const threadId = $derived(chosenThread(view, threads));
  const detail = $derived(threadDetail(threadId));
  const answer = $derived(detail !== undefined && detail.ready ? detail.current : undefined);
  const turns = $derived(answer?.turns ?? []);

  const newest = $derived(currentTurn(turns));
  const asked = $derived(
    view.selection?.kind === "turn" ? turnById(turns, view.selection.id) : undefined
  );
  const turn = $derived(asked ?? newest);

  const chat = $derived(threads.find((row) => row.id === threadId));
  const running = $derived(
    turns.find((row) => row.state === "running" || row.state === "queued")
  );
  const live = $derived(running !== undefined);
  const refreshFailure = $derived.by(() => {
    const held = surface.refreshFailure;
    if (held === undefined || held.threadId !== threadId) return undefined;
    return held.message;
  });
  const failure = $derived(surface.failure ?? refreshFailure);

  const clock = startClock();
  releaseThread(surface);
  refreshThreadWhenShown(view, surface, () => threadId, () => detail, () => live);
  keepDraftWithChat(view, surface, () => threadId);
  followNewestTurn(view, surface, () => newest?.id);

  const send = (written: string) => {
    if (threadId === undefined || live) return;
    void askQuestion(view, surface, threadId, written);
  };

  const stop = () => {
    if (threadId === undefined || !(surface.pending || live)) return;
    void stopTurn(view, surface, threadId);
  };

  const choosePersona = (personaId: string) => {
    if (threadId === undefined) return;
    void setPersona(view, surface, threadId, personaId);
  };

  const nameOf = (kind: string, id: string): string =>
    resources.find((entry) => entry.kind === kind && entry.id === id)?.name ?? SCOPE_LABEL.resource;
</script>

<ScreenSurface>
  {#if !list.ready}
    <ScreenEmpty title="Loading" />
  {:else if threadId === undefined}
    <ScreenEmpty title="No chats yet">
      <Button onclick={() => createThread(view, surface)} disabled={surface.pending}>Start a chat</Button>
    </ScreenEmpty>
  {:else}
    <div class="plane">
      <div class="asked">
        {#if surface.asking !== undefined}
          <p class="meta">
            <span>just now</span>
            <span aria-hidden="true">·</span>
            <span>
              {surface.scope === "project" || surface.resource === ""
                ? SCOPE_LABEL.project
                : (resources.find((entry) => `${entry.kind} ${entry.id}` === surface.resource)?.name ??
                  SCOPE_LABEL.resource)}
            </span>
            <span aria-hidden="true">·</span>
            <span>Explore</span>
            {#if chat?.personaName}
              <span aria-hidden="true">·</span>
              <span>{chat.personaName}</span>
            {/if}
          </p>
          <h1>{surface.asking}</h1>
        {:else if turn !== undefined}
          <p class="meta">
            <span>{since(turn.askedAt, clock.now)}</span>
            <span aria-hidden="true">·</span>
            <span>
              {turn.scope.kind === "project"
                ? SCOPE_LABEL.project
                : nameOf(turn.scope.ref.kind, turn.scope.ref.id)}
            </span>
            <span aria-hidden="true">·</span>
            <span>{MODE_LABEL[turn.mode]}</span>
            {#if chat?.personaName}
              <span aria-hidden="true">·</span>
              <span>{chat.personaName}</span>
            {/if}
          </p>
          <h1>{turn.prompt}</h1>
        {:else}
          <p class="meta"><span>New chat</span></p>
          <h1 class="quiet">Ask the project something.</h1>
        {/if}
      </div>

      <div class="answer">
        {#if failure}
          <ScreenBanner title="That did not run" tone="attention">{failure}</ScreenBanner>
        {/if}

        {#if surface.pending || live}
          <p class="working">
            <span class="pulse" aria-hidden="true"></span>
            {surface.stopping || turn?.stopRequested === true
              ? "Wrapping up with what it has"
              : "Reading the project"}
          </p>
        {:else if turn?.state === "cancelled"}
          <p class="quiet">Cancelled. Nothing was kept.</p>
        {:else if turn === undefined}
          <p class="quiet">Nothing asked yet.</p>
        {:else if turn.state === "failed"}
          <ScreenBanner title="That question did not finish" tone="attention">
            {turn.error ?? "The run stopped before it answered."}
          </ScreenBanner>
        {:else}
          {#each turn.blocks as block (block.id)}
            {#if block.type === "text"}
              <p class="said">{block.display}</p>
            {:else if block.type === "table"}
              <figure class="made">
                <div class="made-head">
                  <span>Table</span>
                  <div class="made-actions">
                    <ScreenAction label="Add" icon={Plus} onclick={() => alert("Adding a made thing to a resource is not built yet.")} />
                    <ScreenAction label="Open" icon={SquareArrowOutUpRight} onclick={() => alert("Opening a made thing in Analysis is not built yet.")} />
                  </div>
                </div>
                <table>
                  <tbody>
                    {#each block.rows as row (row.id)}
                      <tr>
                        {#each row.cells as cell (cell.id)}
                          <td>
                            {cell.blocks
                              .flatMap((inner) => (inner.type === "text" ? [inner.display] : []))
                              .join(" ")}
                          </td>
                        {/each}
                      </tr>
                    {/each}
                  </tbody>
                </table>
              </figure>
            {:else if block.type === "image"}
              <figure class="made">
                <div class="made-head">
                  <span>Image</span>
                  <div class="made-actions">
                    <ScreenAction label="Add" icon={Plus} onclick={() => alert("Adding a made thing to a resource is not built yet.")} />
                    <ScreenAction label="Open" icon={SquareArrowOutUpRight} onclick={() => alert("Opening a made thing in Analysis is not built yet.")} />
                  </div>
                </div>
                <p class="quiet">{block.alt}</p>
              </figure>
            {:else}
              <p class="quiet">This answer holds a {block.type}, which the plane cannot draw yet.</p>
            {/if}
          {/each}
        {/if}
      </div>

      <div class="foot">
        <Composer
          bind:value={surface.text}
          mode="explore"
          scope={surface.scope}
          pending={surface.pending || live}
          stopping={surface.stopping || turn?.stopRequested === true}
          persona={chat?.personaId ?? ""}
          personaIds={personas.map((entry) => entry.id).join("\n")}
          personaNames={personas.map((entry) => entry.name).join("\n")}
          resourceIds={resources.map((entry) => `${entry.kind} ${entry.id}`).join("\n")}
          resourceNames={resources.map((entry) => entry.name).join("\n")}
          resource={surface.resource}
          onsend={send}
          onstop={stop}
          onpersona={choosePersona}
          onscope={(chosen) => surface.chooseScope(chosen)}
        />
      </div>
    </div>
  {/if}
</ScreenSurface>

<style>
  .plane {
    display: grid;
    min-height: 0;
    height: 100%;
    grid-template-rows: auto minmax(0, 1fr) auto;
    gap: calc(var(--token-spacing-unit) * 4);
  }

  .asked {
    display: flex;
    min-width: 0;
    flex-direction: column;
    gap: calc(var(--token-spacing-unit) * 1);
  }

  .meta {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: calc(var(--token-spacing-unit) * 1.5);
    margin: 0;
    color: var(--token-ink-muted);
    font-size: var(--token-text-caption);
  }

  .asked h1 {
    max-width: 62ch;
    margin: 0;
    color: var(--token-ink-primary);
    font-size: var(--token-text-h3);
    font-weight: var(--token-weight-medium);
    letter-spacing: var(--token-tracking-heading);
    line-height: var(--token-text-h3-leading);
  }

  .answer {
    display: flex;
    min-height: 0;
    flex-direction: column;
    gap: calc(var(--token-spacing-unit) * 3);
    overflow-y: auto;
    scrollbar-width: thin;
  }

  .said {
    max-width: var(--token-measure-prose);
    margin: 0;
    color: var(--token-ink-primary);
    font-size: var(--token-text-body);
    line-height: var(--token-text-body-leading);
  }

  .quiet {
    margin: 0;
    color: var(--token-ink-muted);
    font-size: var(--token-text-body-sm);
  }

  .working {
    display: flex;
    align-items: center;
    gap: calc(var(--token-spacing-unit) * 2);
    margin: 0;
    color: var(--token-ink-secondary);
    font-size: var(--token-text-body-sm);
  }

  .pulse {
    width: 0.5rem;
    height: 0.5rem;
    border-radius: 999px;
    background: var(--token-color-intelligence-fill);
    animation: thread-pulse 1.4s ease-in-out infinite;
  }

  .made {
    display: flex;
    max-width: var(--token-measure-prose);
    flex-direction: column;
    gap: calc(var(--token-spacing-unit) * 2);
    margin: 0;
    padding: calc(var(--token-spacing-unit) * 3);
    border: 1px solid var(--token-border-subtle);
    border-radius: var(--token-radius-panel);
    background: var(--token-surface-elevated);
  }

  .made-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: calc(var(--token-spacing-unit) * 2);
    color: var(--token-ink-muted);
    font-size: var(--token-text-micro);
    letter-spacing: var(--token-tracking-caps);
    text-transform: uppercase;
  }

  .made-actions {
    display: flex;
    gap: calc(var(--token-spacing-unit) * 1);
  }

  .made table {
    width: 100%;
    border-collapse: collapse;
    font-size: var(--token-text-body-sm);
  }

  .made td {
    padding: calc(var(--token-spacing-unit) * 1.5);
    border-bottom: 1px solid var(--token-border-subtle);
    text-align: start;
  }

  .foot {
    min-width: 0;
  }

  @keyframes thread-pulse {
    0%,
    100% {
      opacity: 0.35;
    }
    50% {
      opacity: 1;
    }
  }
</style>
