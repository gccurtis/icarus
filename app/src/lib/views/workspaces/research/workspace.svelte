<script lang="ts">
  import Bot from "@lucide/svelte/icons/bot";
  import Globe from "@lucide/svelte/icons/globe";
  import Library from "@lucide/svelte/icons/library";
  import Plus from "@lucide/svelte/icons/plus";
  import Send from "@lucide/svelte/icons/send";
  import X from "@lucide/svelte/icons/x";

  import { PanelChip, PanelQuote } from "$authored-components/panel";
  import {
    ScreenAction,
    ScreenCard,
    ScreenDecision,
    ScreenEmpty,
    ScreenGroup,
    ScreenNote,
    ScreenSurface
  } from "$authored-components/screen";
  import { Button } from "$vendored-components/button";
  import * as Select from "$vendored-components/select";
  import { Textarea } from "$vendored-components/textarea";
  import { AGENTS, actorName } from "$capabilities/cast";
  import {
    acceptedIn,
    currentTurn,
    proposedIn,
    searchScope,
    sourcesForTurn,
    thread,
    threadsIn,
    traceIn,
    type ResearchThread
  } from "$capabilities/research";
  import { viewState } from "$model/client/view-state";

  const view = viewState();

  /**
   * One line of enquiry: the turn you are on, and what it produced.
   *
   * **A thread is a tab.** It is a thing you open, work in and close — like a
   * document and unlike a library — so it is keyed by its own id in the frame's
   * strip, several are open at once, and closing one is closing a tab. A private
   * strip inside this screen would be a second answer to a question the frame
   * already answers.
   *
   * **Which threads exist is the rail's business; which are open is the frame's.**
   * The context panel lists every thread in the project and opening one mints or
   * activates its tab. A list of threads is a map, and a map belongs in the panel
   * that holds maps rather than in a centre of its own.
   *
   * The screen is anchored to a single turn rather than scrolled through all of
   * them; earlier turns are the History view in the context panel, not scrollback
   * here.
   *
   * **The tracks are 1.35fr and 1fr because the judgment is made across them.**
   * Accepting a finding is decided while reading the answer, so the two have to
   * be readable at once — but the answer is prose at a reading measure and a
   * finding is a title and a line, so the answer gets the larger share and the
   * findings column stays a column rather than becoming a second body of text.
   *
   * **The ask band is `auto`, the answer's two are `1fr` each.** The layout
   * table gives the ask one band and the answer two; a prompt is two lines, and
   * giving it a literal third of the plane would be a hole above the thing that
   * matters. Proportion is kept where it is load-bearing: whatever height the
   * ask does not want, the answer takes.
   *
   * **The Copilot's composer is disabled on this screen.** This is already a
   * conversation with an agent, and the composer at the foot is the one place to
   * say the next thing.
   *
   * A proposed finding has no state in the real model yet — proposed, accepted
   * and dismissed live only in the mock door — so the decision made here is held
   * in view state and says so as a verdict on the card rather than by claiming a
   * write. A decided proposal stays where it was: a card that vanished on Accept
   * would leave the reader unable to check what they had just done.
   */
  /**
   * Which thread this is.
   *
   * `resourceId`, because it is what makes two threads two tabs — the same field
   * a document tab is keyed by, for the same reason. The fallback is the
   * isolation test's, where a panel is rendered with an empty prop bag.
   */
  const threadId = $derived(view.active.resourceId ?? "th-feeder");

  const everyThread = $derived(threadsIn(view.project).current);

  /**
   * A new thread is a real one from the library, chosen for having no tab yet.
   *
   * Nothing creates a thread, so inventing an id would put a row in the strip
   * that no door can answer for.
   */
  const startThread = () => {
    const open = new Set(
      view.tabs.filter((tab) => tab.screen === "research").map((tab) => tab.resourceId)
    );
    const fresh = everyThread.find((row: ResearchThread) => !open.has(row.id));
    if (fresh) view.open({ screen: "research", resourceId: fresh.id });
  };

  const it = $derived(thread(threadId).current);
  const turn = $derived(currentTurn(threadId).current);
  const scope = $derived(searchScope(threadId).current);
  const sources = $derived(sourcesForTurn(turn.id).current);
  const trace = $derived(traceIn(threadId).current.find((section) => section.turnId === turn.id));

  /**
   * The persona is the thread's, not the turn's. The control sets it for
   * everything the thread will do next; there is no per-turn switch.
   */
  let chosenAgent = $state<string | undefined>(undefined);
  const agent = $derived(chosenAgent ?? it.agent);

  /** Accept and Dismiss, held here: the model has nowhere to put either yet. */
  let decided = $state<Record<string, "accepted" | "dismissed">>({});

  /** Everything this turn proposed, decided or not, and what the thread has
   * accepted. Neither band is filtered by the decision: it is carried on the
   * card instead. */
  const proposed = $derived(proposedIn(turn.id).current);
  const accepted = $derived(acceptedIn(threadId).current);

  /** The decision as a word. The band holds all three, so `proposed` — the state
   * of one nothing has been done to yet — is worth saying rather than assuming. */
  const VERDICT = {
    proposed: { label: "Proposed", tone: "pending" },
    accepted: { label: "Accepted", tone: "accepted" },
    dismissed: { label: "Dismissed", tone: "dismissed" }
  } as const;

  let next = $state("");
  let useContext = $state(true);
  let useWeb = $state(true);

  const BEARING_TONE = {
    Supports: "success",
    Contradicts: "danger",
    Neutral: "neutral"
  } as const;

  /** The result reads as a sentence; inside a chip beside two other facts it reads as a fragment. */
  const unpunctuated = (result: string): string => result.replace(/\.$/, "");

  const isSelected = (kind: string, id: string): boolean =>
    view.selection?.kind === kind && view.selection.id === id;
</script>

<ScreenSurface wide>
  <div class="board">
    <!--
      The thread's name, what job it has, and who is answering. The mode chip is
      the job named, and it is not a control: what a thread is for is chosen when
      it starts.
    -->
    <div class="area-header flex flex-wrap items-center gap-2">
      <h1 class="text-h3 leading-h3 m-0 me-1 font-semibold tracking-tight">{it.title}</h1>
      <PanelChip>{it.mode}</PanelChip>
      <Select.Root
        type="single"
        value={agent}
        onValueChange={(chosen: string) => (chosenAgent = chosen)}
      >
        <Select.Trigger size="sm" aria-label="Answering as" class="text-caption w-auto gap-1.5">
          <Bot class="text-ink-muted size-3.5" aria-hidden="true" />
          {actorName(agent)}
        </Select.Trigger>
        <Select.Content>
          {#each AGENTS as persona (persona.id)}
            <Select.Item value={persona.id} label={persona.name}>{persona.name}</Select.Item>
          {/each}
        </Select.Content>
      </Select.Root>
      <span class="ms-auto">
        <ScreenAction label="New thread" icon={Plus} onclick={startThread} />
      </span>
    </div>

    <!-- The prompt, as a card, with what it was allowed to look at. -->
    <div class="area-ask flex min-h-0 flex-col gap-2">
      <div class="border-border-subtle bg-surface-panel rounded-panel flex flex-col gap-2 border p-3">
        <span class="text-caption text-ink-muted">
          You asked · <span class="tabular-nums">{turn.at}</span>
        </span>
        <p class="text-body text-ink-primary m-0 max-w-prose">{turn.prompt}</p>
        <div class="flex flex-wrap gap-1">
          <PanelChip>{scope.name}</PanelChip>
          {#if scope.web}
            <PanelChip>Web</PanelChip>
          {/if}
        </div>
      </div>

      <ScreenNote tone="gap">
        Those chips are the thread's scope as it stands now, not the scope this turn ran under.
        Per-request scope is not stored, so reopening an earlier turn cannot show what it could
        actually see.
      </ScreenNote>
    </div>

    <!--
      The reply, its citations, then the trace — in that order, so the claim
      comes before the machinery.
    -->
    <div class="area-answer flex min-h-0 flex-col gap-4 overflow-y-auto">
      <p class="text-body text-ink-primary m-0 max-w-prose">{turn.answer}</p>

      <ScreenGroup label="Stands on" count={String(sources.length)}>
        <div class="flex flex-col gap-2">
          {#each sources as source (source.id)}
            <PanelQuote
              source={`${source.title} · ${source.locator}`}
              sourceLabel="Source"
              onopen={() =>
                view.inspect("research.source", { kind: "source", id: source.id })}
            >
              {source.excerpt}
            </PanelQuote>
          {/each}
        </div>
      </ScreenGroup>

      {#if trace}
        <ScreenGroup label="How it was produced" count={String(trace.calls.length)}>
          <div class="flex flex-wrap gap-1.5">
            {#each trace.calls as call (call.id)}
              <!--
                A call that found nothing is an outcome rather than an error, and
                it is the most informative chip on the screen when an answer came
                back thin — so it is toned, and the other two are not.
              -->
              <button
                type="button"
                class="text-start"
                onclick={() =>
                  view.inspect("research.tool-call", { kind: "tool-call", id: call.id })}
              >
                <PanelChip tone={call.outcome === "Nothing found" ? "attention" : "neutral"}>
                  <span class="font-mono">{call.name}</span>
                  · {unpunctuated(call.result)} · <span class="tabular-nums">{call.duration}</span>
                </PanelChip>
              </button>
            {/each}
          </div>
        </ScreenGroup>
      {/if}
    </div>

    <!--
      What the answer produced, decided one at a time. A finding is a conclusion
      you accept, not a passage you copied — which is why the derivation is on
      the card and why one of these reads *Inference* rather than pretending a
      source says it outright.
    -->
    <div class="area-findings flex min-h-0 flex-col gap-4 overflow-y-auto">
      <ScreenGroup label="Proposed here" count={String(proposed.length)}>
        <div class="flex flex-col gap-2">
          {#each proposed as found (found.id)}
            {@const decision = decided[found.id] ?? "proposed"}
            <ScreenDecision
              title={found.title}
              meta={found.derivation}
              verdict={VERDICT[decision]}
              selected={isSelected("finding", found.id)}
              onselect={() =>
                view.inspect("research.proposed-finding", {
                  kind: "finding",
                  id: found.id
                })}
            >
              <div class="flex flex-col gap-1.5">
                <span>{found.body}</span>
                <span class="flex flex-wrap gap-1">
                  {#each found.standingOn as standing (standing.sourceId)}
                    <PanelChip>{standing.title}</PanelChip>
                  {/each}
                  {#each found.bearsOn as bearing (bearing.id)}
                    <PanelChip tone={BEARING_TONE[bearing.bearing]}>
                      {bearing.ref} · {bearing.bearing}
                    </PanelChip>
                  {/each}
                </span>
              </div>

              <!--
                The controls change with the decision rather than going away: a
                dismissed finding can be accepted after all, which is the reason
                the card is still here.
              -->
              {#snippet actions()}
                {#if decision !== "accepted"}
                  <Button size="xs" onclick={() => (decided[found.id] = "accepted")}>Accept</Button>
                  <!-- Edit opens the proposal's lens: a proposal is editable, an acceptance is not. -->
                  <Button
                    size="xs"
                    variant="outline"
                    onclick={() =>
                      view.inspect("research.proposed-finding", {
                        kind: "finding",
                        id: found.id
                      })}
                  >
                    Edit
                  </Button>
                {/if}
                {#if decision !== "dismissed"}
                  <Button
                    size="xs"
                    variant="ghost"
                    onclick={() => (decided[found.id] = "dismissed")}
                  >
                    Dismiss
                  </Button>
                {/if}
              {/snippet}
            </ScreenDecision>
          {:else}
            <ScreenEmpty title="This turn proposed nothing">
              An answer that produced no conclusion is a result, not a failure — the trace beside it
              says what was read to get there.
            </ScreenEmpty>
          {/each}
        </div>
      </ScreenGroup>

      <ScreenGroup label="Accepted in this thread" count={String(accepted.length)}>
        <div class="flex flex-col gap-2">
          {#each accepted as found (found.id)}
            <ScreenCard
              title={found.title}
              sub={found.derivation}
              selected={isSelected("finding", found.id)}
              onselect={() =>
                view.inspect("research.accepted-finding", {
                  kind: "finding",
                  id: found.id
                })}
            >
              <span class="text-body-sm text-ink-secondary">{found.body}</span>
              <span class="flex flex-wrap items-center gap-1">
                <!-- Accepted is retrievable project-wide and proposed is not. That is the whole difference. -->
                <PanelChip tone="success">In the lattice</PanelChip>
                {#if found.acceptedBy}
                  <span class="text-caption text-ink-muted">
                    {found.acceptedBy}{found.acceptedAt ? ` · ${found.acceptedAt}` : ""}
                  </span>
                {/if}
              </span>
            </ScreenCard>
          {/each}
        </div>
      </ScreenGroup>
    </div>

    <!-- The next question, framed by what the thread already is. -->
    <div class="area-composer flex flex-col gap-2">
      <div class="flex flex-wrap items-center gap-2">
        <PanelChip>{it.mode} mode</PanelChip>
        {#if it.anchor}
          <span class="text-caption text-ink-muted">
            anchored to {it.anchor.ref} · {it.anchor.text}
          </span>
        {/if}
      </div>

      <div class="border-border-subtle bg-surface-panel rounded-panel flex flex-col gap-2 border p-2">
        <Textarea
          bind:value={next}
          rows={2}
          placeholder="Ask the next question…"
          aria-label="Ask the next question"
          class="text-body-sm min-h-0 border-none bg-transparent shadow-none focus-visible:ring-0"
        />
        <div class="flex flex-wrap items-center gap-1.5">
          <Button
            size="xs"
            variant={useContext ? "default" : "outline"}
            title={scope.name}
            onclick={() => (useContext = !useContext)}
          >
            <Library aria-hidden="true" />
            Context
          </Button>
          <Button
            size="xs"
            variant={useWeb ? "default" : "outline"}
            onclick={() => (useWeb = !useWeb)}
          >
            <Globe aria-hidden="true" />
            Web
          </Button>
          <Button size="sm" class="ms-auto" disabled={next.trim() === ""} onclick={() => (next = "")}>
            <Send aria-hidden="true" />
            Ask
          </Button>
        </div>
      </div>
    </div>
  </div>
</ScreenSurface>

<style>
  /**
   * The specification's layout table, as `grid-template-areas`. The board fills
   * the surface rather than growing with its content: the composer belongs at
   * the foot of the screen, and the answer and the findings scroll inside their
   * own regions so that neither pushes it off.
   */
  .board {
    display: grid;
    flex: 1 1 auto;
    min-height: 0;
    gap: calc(var(--token-spacing-unit) * 4);
    grid-template-columns: 1.35fr 1fr;
    grid-template-rows: auto auto minmax(0, 1fr) minmax(0, 1fr) auto;
    grid-template-areas:
      "header   header"
      "ask      findings"
      "answer   findings"
      "answer   findings"
      "composer composer";
  }

  .area-header {
    grid-area: header;
  }
  .area-ask {
    grid-area: ask;
  }
  .area-answer {
    grid-area: answer;
  }
  .area-findings {
    grid-area: findings;
  }
  .area-composer {
    grid-area: composer;
  }

  /*
    One column below the width where a reading measure and a column of cards
    stop fitting side by side. The order is the order of the turn — what you
    asked, what came back, what it produced — with the composer still last.
  */
  @media (max-width: 60rem) {
    .board {
      flex: 0 0 auto;
      grid-template-columns: 1fr;
      grid-template-rows: none;
      grid-template-areas:
        "header"
        "ask"
        "answer"
        "findings"
        "composer";
    }

    /* Nothing scrolls inside a region once the surface itself is the scroll. */
    .area-answer,
    .area-findings {
      overflow-y: visible;
    }
  }
</style>
