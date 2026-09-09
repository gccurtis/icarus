<script lang="ts">
  import { onDestroy, onMount } from "svelte";
  import Plus from "@lucide/svelte/icons/plus";
  import SquareArrowOutUpRight from "@lucide/svelte/icons/square-arrow-out-up-right";

  import { ScreenAction, ScreenBanner, ScreenEmpty, ScreenSurface } from "$authored-components/screen";
  import { Button } from "$vendored-components/button";
  import Composer from "$app-views/categories/research/components/composer.svelte";
  import {
    MODE_LABEL,
    SCOPE_LABEL,
    askQuestion,
    chosenThread,
    createThread,
    currentTurn,
    draftFor,
    keepDraft,
    inspectTurn,
    messageOf,
    openThread,
    setPersona,
    stopTurn,
    threadDetail,
    threadList,
    turnById
  } from "$app-views/categories/research/procedures/chat.svelte";
  import { since } from "$app-views/categories/research/procedures/time";
  import { workspaceState } from "$model/client/workspace-state";

  const view = workspaceState();

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

  let now = $state(Date.now());
  let mounted = true;
  onDestroy(() => {
    mounted = false;
  });
  onMount(() => {
    const timer = setInterval(() => (now = Date.now()), 10_000);
    return () => clearInterval(timer);
  });

  let claimed = $state<string>();
  $effect(() => {
    const id = newest?.id;
    if (id === undefined || claimed === id) return;
    claimed = id;
    inspectTurn(view, id);
  });

  const chat = $derived(threads.find((row) => row.id === threadId));
  const running = $derived(
    turns.find((row) => row.state === "running" || row.state === "queued")
  );
  const live = $derived(running !== undefined);

  let text = $state("");
  /**
   * The half-written question follows the chat, not the surface.
   *
   * `held` is which chat the field currently belongs to. Until it agrees with
   * the open chat the field has not been restored yet, and saving what is in it
   * would overwrite the draft with the empty string it starts at.
   */
  let held = $state<string>();
  $effect(() => {
    const id = threadId;
    if (held === id) return;
    if (held !== undefined) keepDraft(held, text);
    held = id;
    text = draftFor(id);
  });
  $effect(() => {
    if (held !== threadId) return;
    keepDraft(threadId, text);
  });
  onDestroy(() => keepDraft(held, text));
  let scope = $state("project");
  /** "kind id" of the chosen resource, empty when the whole project is in scope. */
  let resource = $state("");

  /** What the composer is showing, as the capability takes it. */
  const chosenScope = (): { kind: "project" } | { kind: "resource"; ref: { kind: string; id: string } } =>
    scope === "project" || resource === ""
      ? { kind: "project" }
      : {
          kind: "resource",
          ref: { kind: resource.slice(0, resource.indexOf(" ")), id: resource.slice(resource.indexOf(" ") + 1) }
        };
  let pending = $state(false);
  let stopping = $state(false);
  let asking = $state<string>();
  let failure = $state<string>();

  const send = async (written: string) => {
    if (threadId === undefined || pending || live) return;
    asking = written;
    text = "";
    pending = true;
    failure = undefined;
    try {
      const result = await askQuestion(view, threadId, written, chosenScope());
      if (!mounted) return;
      if (result.accepted) {
        // The centre follows the turn that was just made, whatever was pinned.
        claimed = result.turnId;
        inspectTurn(view, result.turnId);
      } else {
        failure = result.detail;
        text = written;
      }
    } catch (error) {
      if (mounted) failure = messageOf(error);
    } finally {
      if (mounted) {
        pending = false;
        stopping = false;
        asking = undefined;
      }
    }
  };

  const stop = async () => {
    if (threadId === undefined || !(pending || live)) return;
    const already = stopping;
    stopping = true;
    try {
      const result = await stopTurn(view, threadId);
      if (mounted && !result.accepted && already) failure = result.detail;
    } catch (error) {
      if (mounted) failure = messageOf(error);
    }
  };

  const choosePersona = async (personaId: string) => {
    if (threadId === undefined) return;
    try {
      await setPersona(view, threadId, personaId === "" ? null : personaId);
    } catch (error) {
      if (mounted) failure = messageOf(error);
    }
  };

  const start = async () => {
    pending = true;
    try {
      const made = await createThread(view);
      if (mounted) openThread(view, made.threadId);
    } catch (error) {
      if (mounted) failure = messageOf(error);
    } finally {
      if (mounted) pending = false;
    }
  };
</script>

<ScreenSurface>
  {#if !list.ready}
    <ScreenEmpty title="Loading" />
  {:else if threadId === undefined}
    <ScreenEmpty title="No chats yet">
      <Button onclick={start} disabled={pending}>Start a chat</Button>
    </ScreenEmpty>
  {:else}
    <div class="plane">
      <div class="asked">
        {#if asking !== undefined}
          <p class="meta">
            <span>just now</span>
            <span aria-hidden="true">·</span>
            <span>
              {scope === "project" || resource === ""
                ? SCOPE_LABEL.project
                : (resources.find((entry) => `${entry.kind} ${entry.id}` === resource)?.name ??
                  SCOPE_LABEL.resource)}
            </span>
            <span aria-hidden="true">·</span>
            <span>Explore</span>
            {#if chat?.personaName}
              <span aria-hidden="true">·</span>
              <span>{chat.personaName}</span>
            {/if}
          </p>
          <h1>{asking}</h1>
        {:else if turn !== undefined}
          <p class="meta">
            <span>{since(turn.askedAt, now)}</span>
            <span aria-hidden="true">·</span>
            <span>
              {turn.scope.kind === "project"
                ? SCOPE_LABEL.project
                : (resources.find(
                    (entry) =>
                      turn.scope.kind === "resource" &&
                      entry.kind === turn.scope.ref.kind &&
                      entry.id === turn.scope.ref.id
                  )?.name ?? SCOPE_LABEL.resource)}
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

        {#if pending || live}
          <p class="working">
            <span class="pulse" aria-hidden="true"></span>
            {stopping || turn?.stopRequested === true
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
          bind:value={text}
          mode="explore"
          {scope}
          pending={pending || live}
          stopping={stopping || turn?.stopRequested === true}
          persona={chat?.personaId ?? ""}
          personaIds={personas.map((entry) => entry.id).join("\n")}
          personaNames={personas.map((entry) => entry.name).join("\n")}
          resourceIds={resources.map((entry) => `${entry.kind} ${entry.id}`).join("\n")}
          resourceNames={resources.map((entry) => entry.name).join("\n")}
          {resource}
          onsend={send}
          onstop={stop}
          onpersona={choosePersona}
          onscope={(chosen) => {
            scope = chosen === "project" ? "project" : "resource";
            resource = chosen === "project" ? "" : chosen;
          }}
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
