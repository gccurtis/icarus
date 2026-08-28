<script lang="ts">
  import MessagesSquare from "@lucide/svelte/icons/messages-square";

  import ThreadAbout from "$views/development/thread-demo/components/thread-about.svelte";
  import ThreadComposer from "$views/development/thread-demo/components/thread-composer.svelte";
  import ThreadTurn from "$views/development/thread-demo/components/thread-turn.svelte";
  import TurnFinding from "$views/development/thread-demo/components/turn-finding.svelte";
  import TurnTools from "$views/development/thread-demo/components/turn-tools.svelte";
  import { PanelProgress, PanelQuote } from "$authored-components/panel";
  import {
    ScreenEmpty,
    ScreenGroup,
    ScreenHeader,
    ScreenNote,
    ScreenSurface
  } from "$authored-components/screen";

  /**
   * A message thread that works, and an argument about what a thread has to
   * carry.
   *
   * **The replies are four fixed samples on a timer. Nothing is running.** No
   * model is called, no request leaves the page, and typing the same thing twice
   * gets the same reply — which is stated on the page, in every message, and
   * again in the composer, because a page that looked like it was thinking would
   * be lying about the only thing on it.
   *
   * **Each sample exists to show one thing a thread cannot do without.** A claim
   * with the passage it rests on and a way back to it; the calls behind the
   * claim, including one that found nothing; a message that arrives unfinished
   * and amends itself in place; and a conclusion worth keeping, decided on its
   * own. Four samples, four needs, and the page says which is which rather than
   * hoping the reader infers it.
   *
   * **The panel on the right is half the point.** Research is, in the user's
   * words, largely a thread plus the information that supports it — so the
   * thread here is beside its subject, and the panel's counts move when a
   * finding is accepted in the middle of the plane. A thread with nothing next
   * to it is a transcript.
   *
   * **On feeds.** The page takes a position and the view document argues it at
   * length: there is no `Feed` component to build, because Activity and Mentions
   * are already `PanelRow` inside `PanelSection` and needed no new word. The one
   * difference between a feed and a thread that is not density is that a feed
   * row is a finished event and a thread message is not — which is exactly what
   * the third sample demonstrates.
   */
  type Source = { name: string; kind: string };

  type Message = {
    id: string;
    author: string;
    actor: "person" | "agent";
    at: string;
    body: string;
    /** The passages a claim rests on, each with a way back to the original. */
    citations?: { text: string; source: string; sourceLabel: string }[];
    /** The steps taken to produce the claim above them. */
    calls?: { name: string; outcome: "success" | "nothing" | "failed"; result: string; duration: string }[];
    /** Work under way with no known extent. Cleared when it finishes. */
    running?: { label: string; detail: string };
    /** Said out loud when the message has changed since it arrived. */
    amended?: string;
    finding?: {
      title: string;
      body: string;
      basis: string;
      standingOn: string[];
      state: "proposed" | "accepted" | "dismissed";
    };
    /** What this turn read. Feeds the panel's ledger. */
    sources?: Source[];
    /** The demo's annotation. Page apparatus; a real message has none. */
    note?: string;
  };

  const YOU = "Ana Reyes";
  const AGENT = "Grid Analyst";

  /**
   * The four samples, in the order they make sense read cold.
   *
   * They are templates rather than messages: sending copies one, because a
   * finding carries a decision and two copies of the same reply must be
   * decidable separately.
   */
  const SAMPLES: readonly Omit<Message, "id" | "at">[] = [
    {
      author: AGENT,
      actor: "agent",
      body: "No study dated after the reconductoring appears in either index. The 2019 study is the most recent one on file, and it was written against the pre-reconductoring fault current.",
      citations: [
        {
          text: "Coordination study of record: 2019-04-11. No subsequent study is registered against this feeder.",
          source: "feeder-12-relay.pdf · p.7",
          sourceLabel: "Source"
        },
        {
          text: "Reconductoring of the Feeder 12 tie completed 2024-08-30. No coordination filing follows it in this docket.",
          source: "nerc.gov/docket/2024-882",
          sourceLabel: "Source"
        }
      ],
      sources: [
        { name: "feeder-12-relay.pdf", kind: "p.7" },
        { name: "nerc.gov/docket/2024-882", kind: "Web" }
      ],
      note: "Sample 1 of 4 — a claim carrying the passage it rests on, and a way back to it."
    },
    {
      author: AGENT,
      actor: "agent",
      body: "Both trips are in the relay log. The 8 January trip cleared on the first reclose; the 22 January trip locked out after three. I could not find a matching entry in the outage management export.",
      calls: [
        {
          name: "lattice.retrieve",
          outcome: "success",
          result: "4 regions across 3 sources",
          duration: "1.2 s"
        },
        {
          name: "resource.read",
          outcome: "success",
          result: "feeder-12-relay.pdf, pages 6–9",
          duration: "0.3 s"
        },
        {
          name: "oms.export.search",
          outcome: "nothing",
          result: "No sufficiently relevant material for Feeder 12 in the January export",
          duration: "0.9 s"
        }
      ],
      sources: [{ name: "feeder-12-relay.pdf", kind: "pages 6–9" }],
      note: "Sample 2 of 4 — the work behind the claim. The third call found nothing, which is an outcome and not an error; on a thin turn it is the most useful line here."
    },
    {
      author: AGENT,
      actor: "agent",
      body: "Started. The connector streams the set rather than counting it first, so I cannot say how many reports there are until it finishes.",
      running: { label: "Reading field reports", detail: "extent unknown" },
      sources: [],
      note: "Sample 3 of 4 — a message that is not finished. Give it a few seconds and watch the message rather than the thread: it changes in place, nothing is appended."
    },
    {
      author: AGENT,
      actor: "agent",
      body: "That supports a conclusion, and it is a conclusion rather than a quotation — no report says it in these words.",
      finding: {
        title: "No coordination study exists after the 2024 reconductoring",
        body: "Neither the filings index nor the Commission's public docket lists a coordination study dated after the 2024 reconductoring, which raised available fault current on the tie by roughly 18%.",
        basis: "Inference — no single source states this. It follows from two absences and one measured change.",
        standingOn: ["feeder-12-relay.pdf · p.7", "nerc.gov/docket/2024-882"],
        state: "proposed"
      },
      sources: [
        { name: "feeder-12-relay.pdf", kind: "p.7" },
        { name: "nerc.gov/docket/2024-882", kind: "Web" }
      ],
      note: "Sample 4 of 4 — something worth keeping, decided on its own. Accepting it moves Accepted in the panel, because that is where a decision has to be visible."
    }
  ];

  /** What the sample that is still running says once it has finished. */
  const FINISHED = {
    body: "Done. 41 reports, 6 of which mention Feeder 12. Two describe the same tie switch operating out of sequence.",
    sources: [{ name: "Field reports 2024–25", kind: "6 of 41 mention Feeder 12" }],
    note: "Sample 3 of 4, finished — the same message, amended. No second message was added, and the id has not changed."
  };

  const SEED = "seed-running";
  /** Not state: an id counter is never rendered, and nothing reacts to it. */
  let sequence = 0;
  const mint = () => `m-${(sequence += 1)}`;

  /** Clock time. Only ever called from an event or a timer, never during render. */
  const clock = () => new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  let messages = $state<Message[]>([
    {
      id: mint(),
      author: YOU,
      actor: "person",
      at: "10:21",
      body: "Was the coordination study ever redone after the 2024 reconductoring?"
    },
    { ...structuredClone(SAMPLES[0]), id: mint(), at: "10:21" },
    {
      id: mint(),
      author: YOU,
      actor: "person",
      at: "10:24",
      body: "What did the relay actually record on the two January trips?"
    },
    { ...structuredClone(SAMPLES[1]), id: mint(), at: "10:24" },
    {
      id: mint(),
      author: YOU,
      actor: "person",
      at: "10:26",
      body: "Then start a pass over all the 2024–25 field reports for the same feeder."
    },
    { ...structuredClone(SAMPLES[2]), id: SEED, at: "10:26" }
  ]);

  let draft = $state("");
  let pending = $state(false);
  let opened = $state<string | null>(null);
  /** Which sample the next send takes. Starts on the one the seed has not shown. */
  let cursor = $state(3);
  /** Bumped by a clear, so a timer from the old thread cannot land in the new one. */
  let era = 0;

  const settle = (id: string) => {
    const message = messages.find((entry) => entry.id === id);
    if (!message?.running) return;
    message.running = undefined;
    message.body = FINISHED.body;
    message.sources = structuredClone(FINISHED.sources);
    message.note = FINISHED.note;
    message.amended = `Amended in place at ${clock()} — same message, same id.`;
  };

  /**
   * The seeded running message finishes shortly after the page opens, so the
   * indeterminate form is visible on arrival and still resolves. A bar that
   * never ends is the one loading state worse than none.
   *
   * Nothing reactive is read synchronously, so this runs once; the mutation
   * happens inside the timer, outside the tracking scope.
   */
  $effect(() => {
    const timer = setTimeout(() => settle(SEED), 6000);
    return () => clearTimeout(timer);
  });

  const send = () => {
    const text = draft.trim();
    if (!text || pending) return;

    messages.push({ id: mint(), author: YOU, actor: "person", at: clock(), body: text });
    draft = "";
    pending = true;

    const sample = SAMPLES[cursor % SAMPLES.length];
    cursor += 1;

    const mine = era;
    setTimeout(() => {
      if (mine !== era) return;
      const landed: Message = { ...structuredClone(sample), id: mint(), at: clock() };
      messages.push(landed);
      pending = false;
      if (landed.running) setTimeout(() => mine === era && settle(landed.id), 4000);
    }, 1200);
  };

  const decide = (id: string, state: "accepted" | "dismissed") => {
    const message = messages.find((entry) => entry.id === id);
    if (!message?.finding) return;
    message.finding.state = state;
  };

  const clear = () => {
    era += 1;
    messages = [];
    pending = false;
    draft = "";
    opened = null;
    // The empty state promises that the first reply cites a source, so the
    // rotation has to go back to the first sample. Without this, clearing on a
    // fresh page and sending gives the fourth — the one moment the promise is
    // read is the one moment it was wrong.
    cursor = 0;
  };

  let title = $state("Why did Feeder 12 fail twice?");

  const newest = $derived([...messages].reverse().find((message) => message.actor === "agent"));
  const turnSources = $derived(newest?.sources ?? []);
  const findings = $derived(
    messages
      .map((message) => message.finding)
      .filter((one): one is NonNullable<typeof one> => one !== undefined)
  );
  const accepted = $derived(findings.filter((one) => one.state === "accepted").length);
  const proposed = $derived(findings.filter((one) => one.state === "proposed").length);
  const sourcesUsed = $derived(
    new Set(messages.flatMap((message) => (message.sources ?? []).map((source) => source.name))).size
  );

  /** Scrolls the foot of the thread into view when a message lands, not on mount. */
  let tail = $state<HTMLElement | null>(null);
  let counted = -1;
  $effect(() => {
    const length = messages.length;
    const first = counted === -1;
    const grew = length > counted;
    counted = length;
    if (first || !grew) return;
    tail?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  });
</script>

<svelte:head>
  <title>A thread — Icarus</title>
</svelte:head>

<div class="flex h-full min-h-0">
  <div class="flex min-w-0 flex-1 flex-col">
    <ScreenSurface class="flex-1">
      <a href="/demo/vocabulary" class="text-caption text-interactive-text w-fit hover:underline">
        ← Composition vocabulary
      </a>

      <ScreenHeader
        title="A thread"
        about="A working message thread, and an argument about what a thread has to carry. Type something and send it — the reply is one of four fixed samples, and each sample is here to show one thing a thread cannot do without."
      />

      <ScreenNote tone="gap" meta="4 samples · 1.2 s timer">
        Nothing is running. <code class="text-mono font-mono">$messages</code> exists
        and defines what a message is, but nothing in it is callable — a message is
        written by whichever capability owns the thread, and no thread table exists
        to hold one yet. So the replies are four fixed samples on a
        <code class="text-mono font-mono">setTimeout</code>, served in rotation. Send
        the same thing twice and you get different samples; send it five times and
        the first one comes back.
      </ScreenNote>

      <ScreenGroup label="The thread" count={`${messages.length} messages`}>
        {#if messages.length === 0}
          <ScreenEmpty title="Nothing asked yet" icon={MessagesSquare}>
            A thread starts when someone asks something. Use the composer below —
            the first sample cites a source.
          </ScreenEmpty>
        {:else}
          <div class="flex flex-col gap-5">
            {#each messages as message (message.id)}
              <ThreadTurn
                author={message.author}
                actor={message.actor}
                at={message.at}
                note={message.note}
              >
                <p class="text-body-sm text-ink-primary m-0 max-w-prose whitespace-pre-wrap">
                  {message.body}
                </p>

                {#if message.citations}
                  <!--
                    PanelQuote carries the panel vocabulary's 12px gutter, which
                    on the plane reads as the indent a block quotation wants. It
                    is inherited rather than chosen, and worth knowing about.
                  -->
                  {#each message.citations as citation (citation.source)}
                    <PanelQuote
                      source={citation.source}
                      sourceLabel={citation.sourceLabel}
                      onopen={() => (opened = citation.source)}
                    >
                      {citation.text}
                    </PanelQuote>
                  {/each}
                {/if}

                {#if message.calls}
                  <TurnTools calls={message.calls} />
                {/if}

                {#if message.running}
                  <PanelProgress
                    label={message.running.label}
                    detail={message.running.detail}
                    tone="intelligence"
                  />
                {/if}

                {#if message.amended}
                  <p class="text-caption text-attention-text m-0">{message.amended}</p>
                {/if}

                {#if message.finding}
                  <TurnFinding
                    title={message.finding.title}
                    body={message.finding.body}
                    basis={message.finding.basis}
                    standingOn={message.finding.standingOn}
                    state={message.finding.state}
                    onaccept={() => decide(message.id, "accepted")}
                    ondismiss={() => decide(message.id, "dismissed")}
                    onopen={(source) => (opened = source)}
                  />
                {/if}
              </ThreadTurn>
            {/each}

            {#if pending}
              <!-- Indeterminate, and labelled as what it is: a timer, not a mind. -->
              <div class="ms-2.5 ps-4">
                <PanelProgress label="Composing a sample reply" detail="canned · 1.2 s timer" />
              </div>
            {/if}
          </div>
        {/if}

        <div bind:this={tail} aria-hidden="true"></div>
      </ScreenGroup>

      {#if opened}
        <ScreenNote tone="gap" meta="No inspector on this page">
          Opening <strong class="text-ink-primary font-medium">{opened}</strong> would
          select it in the inspector — the passage, its locator, and what else in the
          project rests on it. There is no inspector here, so the reference reports the
          click and stops. That it is a target at all is the part worth keeping: a
          citation naming a file it cannot open is a footnote in a product that holds
          the file.
        </ScreenNote>
      {/if}

      <ScreenGroup label="What a thread has to carry">
        <div class="text-body-sm text-ink-secondary flex max-w-prose flex-col gap-3">
          <p class="m-0">
            <strong class="text-ink-primary font-medium">A claim, and the passage it rests on.</strong>
            Not a footnote — a reference that opens. The four samples above put the
            source inside the quotation rather than under it, because a fragment
            floating next to a link is a link whose subject has to be guessed.
          </p>
          <p class="m-0">
            <strong class="text-ink-primary font-medium">The work behind the claim, in the same message.</strong>
            What ran, and what it got. A call that found nothing is an outcome rather
            than an error, and on a weak turn it is the only line that explains the
            turn. Pushing the trace into a side panel makes the reader go and ask;
            putting it above the answer makes them read the machinery first.
          </p>
          <p class="m-0">
            <strong class="text-ink-primary font-medium">A message that is not finished.</strong>
            Work with no known extent is <em>unknown</em>, which is a state, not zero —
            a determinate bar sitting at nothing looks the same as work that never
            started and as work that has quietly died. The message then has to be able
            to change after it arrived, which is the requirement with the widest blast
            radius on this page.
          </p>
          <p class="m-0">
            <strong class="text-ink-primary font-medium">Something worth keeping, decided on its own.</strong>
            The only part of a thread meant to outlive it. Accept and dismiss belong to
            the finding rather than the message, because one reply can propose three and
            a reader should not have to take all of them or none.
          </p>
          <p class="m-0">
            <strong class="text-ink-primary font-medium">The thing it is about, beside it.</strong>
            The column on the right is not decoration. The same list of messages without
            it is a transcript; with it, it is a piece of work with a subject, a scope
            and an output.
          </p>
        </div>
      </ScreenGroup>

      <ScreenGroup label="What this page does not do, and a real thread must">
        <div class="text-body-sm text-ink-secondary flex max-w-prose flex-col gap-3">
          <p class="m-0">
            <strong class="text-ink-primary font-medium">Streaming.</strong> Every reply
            here arrives whole. A reply that arrives in pieces is the amend-in-place case
            at a hundred times the rate, and it decides whether a message can be rendered
            once and left alone.
          </p>
          <p class="m-0">
            <strong class="text-ink-primary font-medium">Failure.</strong> No sample
            fails. A reply that errors is a message and belongs in the thread beside the
            question it failed, not in a toast that disappears.
          </p>
          <p class="m-0">
            <strong class="text-ink-primary font-medium">Editing, and what it does to a
            reply that quoted you.</strong> Nothing here can be changed after it is sent.
            The moment it can, every quotation of it has a truth problem.
          </p>
          <p class="m-0">
            <strong class="text-ink-primary font-medium">Branching.</strong> Research's
            own History view says it plainly: selecting an earlier turn and asking
            something new has no defined relationship to the turns after it. A thread
            that can be re-entered in the middle is a tree, and nothing here is shaped
            for one.
          </p>
          <p class="m-0">
            <strong class="text-ink-primary font-medium">A read watermark.</strong>
            Mentions cannot store <em>unread</em> today. A thread has the same problem in
            a stronger form — it needs to know not just whether you have seen it, but how
            far down.
          </p>
          <p class="m-0">
            <strong class="text-ink-primary font-medium">More than two people.</strong>
            Every decision on this page holds for two participants and none of them has
            been tested against five, or against quoting one message inside another.
          </p>
        </div>
      </ScreenGroup>

      <ScreenGroup label="Is a feed a different component?">
        <div class="text-body-sm text-ink-secondary flex max-w-prose flex-col gap-3">
          <p class="m-0">
            A feed is a list of messages in time order. So is a thread. The specifications
            already have two feeds — <em>Activity</em>, every event in the project newest
            first as actor-verb-target grouped by day, and <em>Mentions</em>, the subset a
            person addressed to you with enough of the comment to decide whether to open
            it. Both are already built out of <code class="text-mono font-mono">PanelRow</code>
            inside <code class="text-mono font-mono">PanelSection</code>, and neither
            needed a new word to exist.
          </p>
          <p class="m-0">
            <strong class="text-ink-primary font-medium">So the first answer is that
            there is no Feed component to build</strong>, because the feed was never the
            missing piece. A feed is a query plus a row, and we have the row.
          </p>
          <p class="m-0">
            Three differences survive inspection and only one of them is structural.
            <strong class="text-ink-primary font-medium">Density is not.</strong> A feed
            row is one line because a feed's job is triage in a 300px column; a thread
            message is the thing itself at a reading measure. Same record, two renderings
            — and one component with a <code class="text-mono font-mono">dense</code> prop
            would be two disjoint halves sharing a name.
            <strong class="text-ink-primary font-medium">Origin is a field, not a type.</strong>
            Every feed row says where it came from — "Mira Jain <em>on Q3 Resilience
            Memo</em>" — and no thread message does, because in a thread the where is the
            page. That is one optional property on the record.
          </p>
          <p class="m-0">
            <strong class="text-ink-primary font-medium">The structural one is
            mutability.</strong> An Activity row is an event: "Ana Reyes edited Q3
            Resilience Memo — 4m" is finished the moment it is written and will never say
            anything else. A thread message is not finished. The third sample above
            arrives unfinished and rewrites itself in place; the fourth carries a decision
            that changes what the message says when you take it. A feed is append-only. A
            thread is append-and-amend, and that is a different data structure rather than
            a different stylesheet.
          </p>
          <p class="m-0">
            <strong class="text-ink-primary font-medium">A feed is a selection you watch;
            a thread is a container you are in — and the tell is the composer.</strong>
            You cannot append to Activity, because there is no <em>here</em> for a new row
            to belong to. The field at the foot of this page is not furniture; it is the
            thing that makes the list a thread.
          </p>
          <p class="m-0">
            <strong class="text-ink-primary font-medium">What to build, then:</strong> not
            <code class="text-mono font-mono">Feed</code>, and not
            <code class="text-mono font-mono">Thread</code> as a single component either. A
            message <em>record</em> — id, time, actor, body, an optional origin, and its
            parts — ordered by time; a <em>row</em> renderer for triage, which is the
            <code class="text-mono font-mono">PanelRow</code> we already have; and a
            <em>turn</em> renderer for reading, which is what this page's
            <code class="text-mono font-mono">thread-turn</code> is a first draft of.
            Grouping — by day for Activity, by turn for Research — is a prop over one
            ordered list, not a second component.
          </p>
        </div>
      </ScreenGroup>

      <ScreenNote tone="gap" meta="Needs deciding before anything is built">
        Research's own specification says its workspace is "anchored to one turn, not
        scrolled through all of them", with earlier turns living in the History panel.
        This page is the other shape: one scrolling thread. They are not compatible, and
        both have a case — anchoring keeps an answer and its findings readable side by
        side without a wall of scrollback, while scrolling makes "what did we establish
        three turns ago" answerable without leaving the middle of the screen. It should
        be settled deliberately rather than by whichever gets built first.
      </ScreenNote>
    </ScreenSurface>

    <ThreadComposer
      bind:value={draft}
      {pending}
      scope={["Field reports 2024–25", "Web"]}
      onsend={send}
    />
  </div>

  <div class="border-border-subtle bg-surface-panel w-75 shrink-0 border-s">
    <ThreadAbout
      {title}
      turns={messages.length}
      {accepted}
      {proposed}
      {sourcesUsed}
      sources={turnSources}
      {pending}
      onrename={(next) => (title = next)}
      onclear={clear}
      onopen={(what) => (opened = what)}
    />
  </div>
</div>
