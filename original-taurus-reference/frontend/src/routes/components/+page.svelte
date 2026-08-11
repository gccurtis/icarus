<script lang="ts">
  import {
    Sun,
    Moon,
    Search,
    Plus,
    Settings,
    Trash2,
    Bell,
    ChevronDown,
    Sparkles,
    Info,
    Inbox
  } from '@lucide/svelte';
  import {
    Button,
    IconButton,
    Spinner,
    Badge,
    Chip,
    StatusDot,
    StatePill,
    Kbd,
    Divider,
    Avatar,
    Code,
    Skeleton,
    Field,
    Input,
    Textarea,
    Select,
    Checkbox,
    Switch,
    RadioGroup,
    Slider,
    SegmentedControl,
    Card,
    Stat,
    Progress,
    Table,
    KeyValue,
    Alert,
    Banner,
    Tooltip,
    Modal,
    Drawer,
    Popover,
    Menu,
    Toaster,
    Tabs,
    Accordion,
    Breadcrumbs,
    Pagination,
    Stepper,
    Toolbar,
    InspectorSection,
    PromptBlock,
    QuarterbackBar,
    EmptyState,
    toast
  } from '$lib/components';

  let theme = $state<'celestial' | 'eclipse'>('celestial');
  function toggleTheme() {
    theme = theme === 'celestial' ? 'eclipse' : 'celestial';
    document.documentElement.dataset.theme = theme;
  }

  let sw = $state(true);
  let cb = $state(true);
  let radio = $state('resolve');
  let slider = $state(40);
  let seg = $state('list');
  let tab = $state('overview');
  let sel = $state('');
  let input = $state('');
  let modalOpen = $state(false);
  let drawerOpen = $state(false);
  let page = $state(2);
  let qb = $state('');

  const tones = ['neutral', 'action', 'intel', 'focus', 'attention', 'success', 'danger'] as const;
</script>

<svelte:head><title>Components · Taurus Alpha</title></svelte:head>

<Toaster />

<div class="min-h-screen bg-canvas text-primary">
  <header class="surface-panel sticky top-0 z-30 flex h-topbar items-center justify-between px-5">
    <div class="flex items-center gap-2.5">
      <span class="size-2.5 rounded-full bg-focus"></span>
      <span class="text-label font-semibold tracking-tight">Taurus Alpha</span>
      <span class="text-caption font-mono text-muted">component library</span>
    </div>
    <Button variant="secondary" size="sm" onclick={toggleTheme}>
      {#if theme === 'celestial'}<Moon class="size-4" /> Eclipse{:else}<Sun class="size-4" /> Celestial{/if}
    </Button>
  </header>

  <main class="mx-auto max-w-5xl space-y-12 px-5 py-10">
    <!-- Buttons -->
    <section class="space-y-4">
      <h2 class="text-h4 font-semibold">Buttons</h2>
      <div class="flex flex-wrap items-center gap-3">
        <Button>Primary</Button>
        <Button variant="secondary">Secondary</Button>
        <Button variant="outline">Outline</Button>
        <Button variant="ghost">Ghost</Button>
        <Button variant="danger">Danger</Button>
        <Button variant="success">Success</Button>
        <Button loading>Loading</Button>
        <Button disabled>Disabled</Button>
      </div>
      <div class="flex flex-wrap items-center gap-3">
        <Button size="sm">Small</Button>
        <Button size="md">Medium</Button>
        <Button size="lg">Large</Button>
        <Button><Plus class="size-4" /> With icon</Button>
        <IconButton label="Search"><Search class="size-4" /></IconButton>
        <IconButton label="Settings" variant="secondary"><Settings class="size-4" /></IconButton>
        <Spinner size={20} />
      </div>
    </section>

    <!-- Badges, chips, status -->
    <section class="space-y-4">
      <h2 class="text-h4 font-semibold">Badges &amp; status</h2>
      <div class="flex flex-wrap items-center gap-2">
        {#each tones as t}<Badge tone={t}>{t}</Badge>{/each}
      </div>
      <div class="flex flex-wrap items-center gap-2">
        <Chip tone="action" onremove={() => toast('Removed chip')}>Removable</Chip>
        <Chip tone="intel">Persona</Chip>
        <Chip>Plain</Chip>
      </div>
      <div class="flex flex-wrap items-center gap-3">
        <StatePill state="idle" />
        <StatePill state="resolving" />
        <StatePill state="running" />
        <StatePill state="needs-review" />
        <StatePill state="applied" />
        <StatePill state="failed" />
      </div>
      <div class="flex items-center gap-3 text-body-sm text-secondary">
        Press <Kbd>⌘</Kbd> <Kbd>K</Kbd> to search
      </div>
    </section>

    <!-- Forms -->
    <section class="space-y-4">
      <h2 class="text-h4 font-semibold">Forms</h2>
      <div class="grid gap-5 sm:grid-cols-2">
        <Field label="Project name" hint="Shown in the resource header">
          {#snippet children({ id, describedby })}
            <Input {id} aria-describedby={describedby} bind:value={input} placeholder="Taurus Omega" />
          {/snippet}
        </Field>
        <Field label="Environment">
          {#snippet children({ id })}
            <Select
              {id}
              bind:value={sel}
              placeholder="Choose…"
              options={[
                { value: 'dev', label: 'Development' },
                { value: 'stage', label: 'Staging' },
                { value: 'prod', label: 'Production' }
              ]}
            />
          {/snippet}
        </Field>
        <Field label="Notes" class="sm:col-span-2">
          {#snippet children({ id })}
            <Textarea {id} placeholder="Describe the change…" />
          {/snippet}
        </Field>
      </div>
      <div class="flex flex-wrap items-center gap-6">
        <Switch bind:checked={sw} label="Live sync" />
        <Checkbox bind:checked={cb} label="Require review" />
        <SegmentedControl
          bind:value={seg}
          segments={[
            { value: 'list', label: 'List' },
            { value: 'board', label: 'Board' },
            { value: 'graph', label: 'Graph' }
          ]}
        />
      </div>
      <div class="grid gap-5 sm:grid-cols-2">
        <RadioGroup
          bind:value={radio}
          options={[
            { value: 'ask', label: 'Ask' },
            { value: 'resolve', label: 'Resolve' },
            { value: 'delegate', label: 'Delegate' }
          ]}
        />
        <div class="flex flex-col justify-center gap-2">
          <span class="text-label text-muted">Threshold · {slider}%</span>
          <Slider bind:value={slider} />
        </div>
      </div>
    </section>

    <!-- Data -->
    <section class="space-y-4">
      <h2 class="text-h4 font-semibold">Data &amp; display</h2>
      <div class="grid gap-4 sm:grid-cols-3">
        <Stat label="Throughput" value="1.24k" delta="+12%" deltaTone="success" />
        <Stat label="Latency" value="84ms" delta="-3ms" deltaTone="success" />
        <Stat label="Errors" value="7" delta="+2" deltaTone="danger" />
      </div>
      <div class="grid gap-4 sm:grid-cols-2">
        <Card>
          {#snippet header()}Recent runs{/snippet}
          <Table
            columns={[
              { key: 'name', label: 'Task' },
              { key: 'state', label: 'State' },
              { key: 'ms', label: 'ms', align: 'right' }
            ]}
            rows={[
              { name: 'ingest', state: 'applied', ms: 120 },
              { name: 'resolve', state: 'resolving', ms: 84 },
              { name: 'verify', state: 'failed', ms: 12 }
            ]}
          />
        </Card>
        <Card>
          {#snippet header()}Details{/snippet}
          <KeyValue
            rows={[
              { key: 'Engine', value: 'Taurus Omega' },
              { key: 'Version', value: '0.0.1' },
              { key: 'Region', value: 'us-east' }
            ]}
          />
        </Card>
      </div>
      <div class="flex items-center gap-4">
        <Avatar name="Gabriel Curtis" />
        <Avatar name="Taurus Omega" size="lg" />
        <Code>pnpm dev</Code>
        <Progress value={64} label="Indexing" class="max-w-xs" />
      </div>
      <div class="flex items-center gap-3">
        <Skeleton class="h-9 w-9 rounded-full" rounded="rounded-full" />
        <div class="flex-1 space-y-2">
          <Skeleton class="h-3 w-1/2" />
          <Skeleton class="h-3 w-1/3" />
        </div>
      </div>
    </section>

    <!-- Feedback -->
    <section class="space-y-4">
      <h2 class="text-h4 font-semibold">Feedback &amp; overlays</h2>
      <Banner tone="action" dismissible ondismiss={() => toast('Dismissed')}>
        A new Omega contract is available.
      </Banner>
      <div class="grid gap-4 sm:grid-cols-2">
        <Alert tone="attention" title="Needs review">
          {#snippet icon()}<Info class="size-4" />{/snippet}
          Three live objects are stale and require human judgment.
        </Alert>
        <Alert tone="success" title="Applied">
          {#snippet icon()}<Sparkles class="size-4" />{/snippet}
          The agent's change was accepted into the document.
        </Alert>
      </div>
      <div class="flex flex-wrap items-center gap-3">
        <Button onclick={() => (modalOpen = true)}>Open modal</Button>
        <Button variant="secondary" onclick={() => (drawerOpen = true)}>Open drawer</Button>
        <Tooltip content="Coordinate this document">
          <Button variant="outline">Hover me</Button>
        </Tooltip>
        <Popover>
          {#snippet trigger()}<Button variant="ghost">Popover <ChevronDown class="size-4" /></Button>{/snippet}
          <p class="text-body-sm text-secondary">Any content can live in a popover.</p>
        </Popover>
        <Menu
          items={[
            { label: 'Insert', onselect: () => toast('Insert') },
            { label: 'Arrange', onselect: () => toast('Arrange') },
            { divider: true },
            { label: 'Delete', danger: true, onselect: () => toast('Deleted', { tone: 'danger' }) }
          ]}
        >
          {#snippet trigger()}<Button variant="secondary">Menu <ChevronDown class="size-4" /></Button>{/snippet}
        </Menu>
        <Button variant="ghost" onclick={() => toast('Saved', { tone: 'success' })}>
          <Bell class="size-4" /> Toast
        </Button>
      </div>
    </section>

    <!-- Navigation -->
    <section class="space-y-4">
      <h2 class="text-h4 font-semibold">Navigation &amp; disclosure</h2>
      <Breadcrumbs
        items={[
          { label: 'Resources', href: '#' },
          { label: 'Documents', href: '#' },
          { label: 'Taurus Omega' }
        ]}
      />
      <Tabs
        bind:value={tab}
        tabs={[
          { value: 'overview', label: 'Overview' },
          { value: 'activity', label: 'Activity' },
          { value: 'settings', label: 'Settings' }
        ]}
      >
        {#snippet children(active)}
          <p class="text-body-sm text-secondary">Showing the <b>{active}</b> panel.</p>
        {/snippet}
      </Tabs>
      <Accordion
        items={[
          { id: 'a', title: 'What is the work surface?', content: 'The calm, legible center of every screen.' },
          { id: 'b', title: 'What is the inspector?', content: 'A precise lens on the selected object.' },
          { id: 'c', title: 'What is the Quarterback?', content: 'The persistent coordination layer.' }
        ]}
      />
      <Stepper steps={[{ label: 'Scope' }, { label: 'Review' }, { label: 'Apply' }]} current={1} />
      <Pagination bind:page total={8} />
    </section>

    <!-- Taurus surfaces -->
    <section class="space-y-4">
      <h2 class="text-h4 font-semibold">Taurus surfaces</h2>
      <Toolbar>
        {#snippet start()}
          <IconButton label="New"><Plus class="size-4" /></IconButton>
          <IconButton label="Search"><Search class="size-4" /></IconButton>
          <Divider orientation="vertical" class="mx-1 h-5" />
          <SegmentedControl
            bind:value={seg}
            segments={[
              { value: 'list', label: 'List' },
              { value: 'board', label: 'Board' }
            ]}
          />
        {/snippet}
        {#snippet end()}
          <IconButton label="Settings"><Settings class="size-4" /></IconButton>
        {/snippet}
      </Toolbar>

      <div class="grid gap-4 sm:grid-cols-2">
        <PromptBlock label="Summarize" state="resolving">
          {#snippet actions()}
            <Button size="sm" variant="secondary">Inspect</Button>
            <Button size="sm" variant="ghost">Cancel</Button>
          {/snippet}
          summarize(selection) → 3 key points
        </PromptBlock>

        <div class="surface-panel rounded-panel">
          <InspectorSection title="Object">
            <KeyValue rows={[{ key: 'Type', value: 'Document' }, { key: 'Owner', value: 'You' }]} />
          </InspectorSection>
          <InspectorSection title="Sync">
            <div class="flex items-center gap-2 text-body-sm text-secondary">
              <StatusDot tone="focus" pulse /> Connected
            </div>
          </InspectorSection>
        </div>
      </div>

      <QuarterbackBar bind:value={qb} onsend={(v) => toast(v || 'Coordinating…', { tone: 'intel' })} />

      <EmptyState title="No references yet" description="Insert a live object to get started.">
        {#snippet icon()}<Inbox class="size-8" />{/snippet}
        {#snippet action()}<Button size="sm"><Plus class="size-4" /> Add reference</Button>{/snippet}
      </EmptyState>
    </section>
  </main>
</div>

<Modal bind:open={modalOpen} title="Coordinate document">
  <p>Choose how Taurus should route this work. Nothing is applied until you review it.</p>
  {#snippet footer()}
    <Button variant="ghost" onclick={() => (modalOpen = false)}>Cancel</Button>
    <Button onclick={() => { modalOpen = false; toast('Delegated', { tone: 'intel' }); }}>Delegate</Button>
  {/snippet}
</Modal>

<Drawer bind:open={drawerOpen} title="Inspector">
  <InspectorSection title="Properties">
    <KeyValue rows={[{ key: 'Name', value: 'Taurus Omega' }, { key: 'State', value: 'Applied' }]} />
  </InspectorSection>
  <InspectorSection title="History">
    <p class="text-body-sm text-secondary">Reversible, attributable change log.</p>
  </InspectorSection>
</Drawer>
