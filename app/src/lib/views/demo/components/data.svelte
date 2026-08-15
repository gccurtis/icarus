<script lang="ts">
  import SectionHeading from "$views/demo/components/section-heading.svelte";
  import { Badge } from "$lib/simple-components/badge";
  import * as Carousel from "$lib/simple-components/carousel";
  import * as Shelf from "$lib/unique-components/carousel-shelf";
  import { Label } from "$lib/simple-components/label";
  import * as Pagination from "$lib/simple-components/pagination";
  import { Slider } from "$lib/simple-components/slider";
  import * as Table from "$lib/simple-components/table";

  // Carousel geometry, live-adjustable. A card has its own size and the window
  // has its own; how many cards are visible is the quotient, not a setting.
  let cardWidth = $state([180]);
  let cardHeight = $state([120]);
  let windowWidth = $state([560]);

  const GAP = 12;
  const visible = $derived(
    Math.max(1, Math.floor((windowWidth[0] + GAP) / (cardWidth[0] + GAP)))
  );

  // Enough cards to overflow any reasonable window, so the frame's overhang is
  // visible at both ends without resizing anything.
  const SHELF = [
    { name: "revenue", state: "Applied", tone: "default", note: "Q3 close", value: "1.24M" },
    { name: "headcount", state: "Applied", tone: "default", note: "Q3 close", value: "312" },
    { name: "churn", state: "Review", tone: "secondary", note: "Awaiting sign-off", value: "2.1%" },
    { name: "runway", state: "Applied", tone: "default", note: "Q3 close", value: "18mo" },
    { name: "cac", state: "Stale", tone: "outline", note: "Source changed", value: "$412" },
    { name: "nps", state: "Review", tone: "secondary", note: "Awaiting sign-off", value: "47" },
    { name: "arr", state: "Applied", tone: "default", note: "Q3 close", value: "14.9M" },
    { name: "burn", state: "Rejected", tone: "destructive", note: "Failed validation", value: "—" },
  ] as const;

  const ROWS = [
    { source: "annual-report.pdf", state: "Applied", confidence: "0.92" },
    { source: "interview-03.md", state: "Needs review", confidence: "0.61" },
    { source: "filings/2025-q4", state: "Stale", confidence: "0.88" },
    { source: "press-release.html", state: "Failed", confidence: "—" },
  ];

  const BADGE: Record<string, string> = {
    Applied: "bg-success-surface text-success-text border-success-border",
    "Needs review": "bg-attention-surface text-attention-text border-attention-border",
    Stale: "bg-attention-surface text-attention-text border-attention-border",
    Failed: "bg-danger-surface text-danger-text border-danger-border",
  };
</script>

<section class="flex flex-col gap-4">
  <SectionHeading title="Data" source="system/typography/component.md → tabular figures" />

  <h3 class="text-h4 font-semibold">Table</h3>
  <p class="text-body-sm text-ink-secondary max-w-[70ch]">
    Dense reading. Numbers are tabular so columns stay aligned as values change, and every state
    pairs its colour with copy — remove the colour and the table still reads.
  </p>
  <Table.Root>
    <Table.Header>
      <Table.Row>
        <Table.Head>Source</Table.Head>
        <Table.Head>State</Table.Head>
        <Table.Head class="text-right">Confidence</Table.Head>
      </Table.Row>
    </Table.Header>
    <Table.Body>
      {#each ROWS as row (row.source)}
        <Table.Row>
          <Table.Cell class="font-mono">{row.source}</Table.Cell>
          <Table.Cell>
            <Badge variant="outline" class={BADGE[row.state]}>{row.state}</Badge>
          </Table.Cell>
          <Table.Cell class="text-right font-mono tabular-nums">{row.confidence}</Table.Cell>
        </Table.Row>
      {/each}
    </Table.Body>
  </Table.Root>

  <h3 class="text-h4 font-semibold">Pagination</h3>
  <Pagination.Root count={100} perPage={10}>
    {#snippet children({ pages, currentPage })}
      <Pagination.Content>
        <Pagination.Item><Pagination.PrevButton /></Pagination.Item>
        {#each pages as page (page.key)}
          {#if page.type === "ellipsis"}
            <Pagination.Item><Pagination.Ellipsis /></Pagination.Item>
          {:else}
            <Pagination.Item>
              <Pagination.Link {page} isActive={currentPage === page.value}>
                {page.value}
              </Pagination.Link>
            </Pagination.Item>
          {/if}
        {/each}
        <Pagination.Item><Pagination.NextButton /></Pagination.Item>
      </Pagination.Content>
    {/snippet}
  </Pagination.Root>

  <h3 class="text-h4 font-semibold">Carousel</h3>
  <p class="text-body-sm text-ink-secondary max-w-[70ch]">
    Side-by-side comparison across a set. The card carries its own dimensions and the window carries
    its own; how many are visible falls out of the arithmetic rather than being configured. The
    component's default is <code class="font-mono">basis-full</code> — one card per window — which
    <code class="font-mono">basis-auto</code> replaces with a fixed card size.
  </p>

  <div class="grid max-w-md gap-3 sm:grid-cols-3">
    <div class="flex flex-col gap-1">
      <Label for="card-w">Card width</Label>
      <Slider type="multiple" bind:value={cardWidth} min={80} max={320} step={4} />
      <span class="text-caption text-ink-muted font-mono tabular-nums">{cardWidth[0]}px</span>
    </div>
    <div class="flex flex-col gap-1">
      <Label for="card-h">Card height</Label>
      <Slider type="multiple" bind:value={cardHeight} min={60} max={240} step={4} />
      <span class="text-caption text-ink-muted font-mono tabular-nums">{cardHeight[0]}px</span>
    </div>
    <div class="flex flex-col gap-1">
      <Label for="window-w">Window width</Label>
      <Slider type="multiple" bind:value={windowWidth} min={200} max={880} step={8} />
      <span class="text-caption text-ink-muted font-mono tabular-nums">{windowWidth[0]}px</span>
    </div>
  </div>

  <p class="text-caption text-ink-muted">
    Showing <span class="font-mono tabular-nums">{visible}</span>
    card{visible === 1 ? "" : "s"} at a time
  </p>

  <!-- Inline styles rather than utilities: these values are runtime state, and
       Tailwind can only generate classes it can read in the source. -->
  <div style="width: {windowWidth[0]}px" class="max-w-full">
    <Carousel.Root opts={{ align: "start" }}>
      <Carousel.Content style="margin-left: -{GAP}px">
        {#each [1, 2, 3, 4, 5, 6, 7, 8] as slide (slide)}
          <Carousel.Item class="basis-auto" style="padding-left: {GAP}px">
            <div
              style="width: {cardWidth[0]}px; height: {cardHeight[0]}px"
              class="bg-surface-panel border-border-subtle rounded-panel flex items-center justify-center border"
            >
              <span class="text-h3 font-mono tabular-nums">{slide}</span>
            </div>
          </Carousel.Item>
        {/each}
      </Carousel.Content>
      <Carousel.Previous />
      <Carousel.Next />
    </Carousel.Root>
  </div>

  <h3 class="text-h4 mt-2 font-semibold">Carousel shelf</h3>
  <p class="text-body-sm text-ink-secondary max-w-[70ch]">
    The same set, recessed. The well takes the darker plane and the cards take the raised one, so
    they read as sitting <em>in</em> the page rather than on it. The frame overhangs the cards on
    every side: a card passes under the edge instead of stopping at it. The track loops, so the
    buttons never dead-end — drag it, arrow through it, or use the controls on the frame.
  </p>

  <Shelf.Root>
    {#each SHELF as item (item.name)}
      <Shelf.Item class="flex h-full w-56 flex-col gap-2 p-4">
        <div class="flex items-start justify-between gap-2">
          <span class="text-label font-mono">{item.name}</span>
          <Badge variant={item.tone}>{item.state}</Badge>
        </div>
        <span class="text-caption text-ink-muted">{item.note}</span>
        <span class="text-h3 mt-auto font-mono tabular-nums">{item.value}</span>
      </Shelf.Item>
    {/each}
  </Shelf.Root>
</section>
