# src/lib/features/stages/document/panels/NameManagerPanel.svelte — breakdown

Companion to [NameManagerPanel.svelte](NameManagerPanel.svelte). The document context panel
for a project's **named values and formulas**: it lists the names with a live-evaluated value
preview and a search filter, and a creator/editor modal does full CRUD — create or edit a
**Formula** (evaluate + `PUT …/function`) or a literal **Value** (`PUT …/value`), and delete a
name (`DELETE …/:name`) behind an inline confirm. Editing reopens an existing name with its
source; the name itself is fixed because Omega upserts by name — there is no rename.

## Script setup and state

### Open the script, import UI components and the projects data layer

```svelte
<script lang="ts">
  import { FunctionSquare, Search, Trash2, Pencil, Check, X } from '@lucide/svelte';
  import { Badge, Button, IconButton, Input, Modal, toast } from '$lib/components';
  import {
    fetchProjectNames,
    setNameFunction,
    setNameValue,
    deleteProjectName,
    evaluateExpression,
    type NamesEntry
  } from '$data/projects';
  import { workspace } from '$data/workspace';

```

The imports pull in Lucide icons, the shared component library (including the `toast`
helper), the projects data-layer functions this panel calls, the `NamesEntry` type, and the
`workspace` store that identifies the active project. The blank line separates the imports
from the reactive declarations.

### Derive the active project id and declare the panel's reactive state

```svelte
  const projectId = $derived($workspace?.projectId ?? '');

  let filter = $state('');
  let creatorOpen = $state(false);
  let mode = $state<'formula' | 'value'>('formula');
  let formula = $state('');
  let literal = $state('');
  let assignedName = $state('');
  let editingName = $state<string | null>(null);
  let entries = $state<NamesEntry[]>([]);
  let loading = $state(true);
  let evaluating = $state(false);
  let evalResult = $state('');
  let evalError = $state('');
  let pendingDelete = $state<string | null>(null);
  let saving = $state(false);

```

`projectId` derives from the workspace store (empty string when no project is open). The
`$state` fields hold: the list `filter`; the creator modal's open flag and `mode`
(formula/value); the `formula`, `literal`, and `assignedName` inputs; `editingName` (non-null
while editing an existing name); the loaded `entries` and their `loading` flag; the live
evaluation state (`evaluating`, `evalResult`, `evalError`); the name pending delete
confirmation; and the `saving` flag. The blank line separates state from the loader.

## Loading and filtering

### Fetch the project's names, and reload when the active project changes

```svelte
  async function load() {
    if (!projectId) return;
    loading = true;
    try {
      entries = await fetchProjectNames(projectId);
    } catch {
      entries = [];
    } finally {
      loading = false;
    }
  }

  $effect(() => {
    if (projectId) void load();
  });

```

`load` fetches the project's names into `entries`, guarding against an absent project,
resetting to an empty list on failure, and always clearing `loading`. The `$effect` runs
`load` whenever `projectId` changes, so switching projects refreshes the list. The blank line
separates the loader from the derived list.

### Filter entries by the search box and list the creator's mode options

```svelte
  const names = $derived(
    entries.filter((entry) =>
      `${entry.name} ${entry.type} ${displayValue(entry)}`.toLowerCase().includes(filter.toLowerCase())
    )
  );

  const modeOptions = [
    { value: 'formula', label: 'Formula' },
    { value: 'value', label: 'Value' }
  ];

```

`names` is the filtered view rendered in the list: each entry is matched by a lowercased
concatenation of its name, type, and display value against the search `filter`. `modeOptions`
is the static two-way toggle backing the creator modal's Formula/Value switch. The blank line
separates these from the display helpers.

## Display helpers

### Format an entry's value preview and its human-readable type label

```svelte
  function displayValue(entry: NamesEntry): string {
    if (entry.type === 'function') return entry.source ?? '';
    if (entry.type === 'table') return 'table';
    if (entry.value == null) return '—';
    return String(entry.value);
  }

  function typeLabel(type: NamesEntry['type']): string {
    const labels: Record<string, string> = { number: 'Number', text: 'Text', logic: 'Logic', table: 'Table', function: 'Function', null: 'Null' };
    return labels[type] ?? type;
  }

```

`displayValue` produces the preview string shown under each name: a formula shows its source,
a table shows the literal `"table"`, a null value shows an em-dash placeholder, and anything
else is stringified. `typeLabel` maps the raw `type` union to a capitalized label for the
type badge, falling back to the raw value. The blank line separates them from the literal
parser.

### Coerce a value-mode literal string into a JSON boolean, number, or text

```svelte
  // Parse a value-mode literal into the JSON the backend stores: boolean, number, or text.
  function parseLiteral(raw: string): unknown {
    const s = raw.trim();
    if (s === 'true') return true;
    if (s === 'false') return false;
    if (s !== '' && Number.isFinite(Number(s))) return Number(s);
    return raw;
  }

```

`parseLiteral` interprets what the user typed in Value mode: `true`/`false` become booleans, a
finite numeric string becomes a number, and everything else is stored as the original text
(note it returns `raw`, preserving surrounding whitespace for text). The blank line separates
it from the modal actions.

## Creator/editor modal actions

### Open the modal blank for a new name

```svelte
  function openCreate() {
    mode = 'formula';
    formula = '';
    literal = '';
    assignedName = '';
    editingName = null;
    evalResult = '';
    evalError = '';
    creatorOpen = true;
  }

```

`openCreate` resets every creator field to its empty default, clears `editingName` (marking a
create rather than an edit), and opens the modal in Formula mode. The blank line separates it
from the edit opener.

### Open the modal pre-filled to edit an existing name

```svelte
  // Edit an existing name: functions reopen in formula mode with their source; other
  // entries reopen in value mode. The name is fixed (Omega has no rename — it's an upsert).
  function openEdit(entry: NamesEntry) {
    editingName = entry.name;
    assignedName = entry.name;
    evalResult = '';
    evalError = '';
    if (entry.type === 'function') {
      mode = 'formula';
      formula = entry.source ?? '';
      literal = '';
      void handleEvaluate();
    } else {
      mode = 'value';
      literal = entry.value == null ? '' : String(entry.value);
      formula = '';
    }
    creatorOpen = true;
  }

```

`openEdit` seeds the modal from an existing entry: it records `editingName` (which locks the
name input and mode toggle) and chooses the mode from the entry's type. A function reopens in
Formula mode with its source and immediately triggers a live evaluation; anything else reopens
in Value mode with its stringified value. The blank line separates it from the save handler.

### Save the creator: evaluate + persist a formula, or store a literal value

```svelte
  async function saveCreator() {
    const name = assignedName.trim();
    saving = true;
    try {
      if (mode === 'formula') {
        if (!formula.trim()) return;
        const result = await evaluateExpression(projectId, formula);
        evalResult = `${result.value} (${result.type})`;
        evalError = '';
        if (name) {
          await setNameFunction(projectId, name, formula);
          toast(`${editingName ? 'Updated' : 'Created'} formula “${name}”.`, { tone: 'success' });
          void load();
        } else {
          toast('Expression evaluated successfully.', { tone: 'success' });
        }
        creatorOpen = false;
      } else {
        if (!name) return;
        await setNameValue(projectId, name, parseLiteral(literal));
        toast(`${editingName ? 'Updated' : 'Created'} “${name}”.`, { tone: 'success' });
        void load();
        creatorOpen = false;
      }
    } catch (e) {
      const msg = typeof e === 'object' && e !== null && 'message' in e ? String((e as { message: string }).message) : 'Save failed.';
      evalError = msg;
      if (mode === 'value') toast(msg, { tone: 'danger' });
    } finally {
      saving = false;
    }
  }

```

`saveCreator` branches on mode. In Formula mode it always evaluates first (surfacing the
result in the preview); if a name was given it persists the formula and reloads, otherwise it
just reports a successful evaluation without saving — so the modal doubles as a scratch
evaluator. In Value mode it requires a name and stores the parsed literal. Failures set
`evalError` and, in Value mode, raise a danger toast. `saving` is always cleared in `finally`.
The blank line separates it from the delete handler.

### Delete a name after inline confirmation

```svelte
  async function confirmRemove(name: string) {
    try {
      await deleteProjectName(projectId, name);
      pendingDelete = null;
      toast(`Deleted “${name}”.`, { tone: 'success' });
      void load();
    } catch (e) {
      const msg = typeof e === 'object' && e !== null && 'message' in e ? String((e as { message: string }).message) : 'Delete failed.';
      toast(msg, { tone: 'danger' });
    }
  }

```

`confirmRemove` runs after the user confirms the inline "Delete?" prompt: it deletes the name,
clears `pendingDelete`, toasts success, and reloads the list. On error it toasts the failure
message. The blank line separates it from the live evaluator.

### Live-evaluate the current formula for the preview

```svelte
  async function handleEvaluate() {
    if (!formula.trim()) return;
    evaluating = true;
    evalError = '';
    try {
      const result = await evaluateExpression(projectId, formula);
      evalResult = `${result.value} (${result.type})`;
    } catch (e) {
      const msg = typeof e === 'object' && e !== null && 'message' in e ? String((e as { message: string }).message) : 'Evaluation failed.';
      evalError = msg;
      evalResult = '';
    } finally {
      evaluating = false;
    }
  }

```

`handleEvaluate` powers the modal's live Preview: bound to the formula input's `oninput`, it
evaluates the current expression and formats the `value (type)` result, or captures an error
message and clears the stale result. The `evaluating` flag drives the "Evaluating…" state.
The blank line separates it from the final derived flag.

### Disable Save until the active mode has the input it needs

```svelte
  const saveDisabled = $derived(
    saving || (mode === 'formula' ? !formula.trim() : !assignedName.trim())
  );
</script>

```

`saveDisabled` gates the modal's Save/Create button: disabled while saving, and otherwise
requiring a non-empty formula in Formula mode or a non-empty name in Value mode. The
`</script>` tag closes the logic block, and the trailing blank line separates it from the
markup.

## Panel markup

### The panel: new-name button, search box, and the names list

```svelte
<div class="space-y-3">
  <div class="flex items-center justify-between">
    <p class="text-caption text-muted">Named values and formulas</p>
  </div>

  <Button variant="secondary" size="sm" class="w-full" onclick={openCreate}>
    <FunctionSquare class="size-4" />
    New name
  </Button>

  <label class="relative block">
    <Search class="pointer-events-none absolute top-2 left-2.5 size-3.5 text-muted" />
    <Input
      bind:value={filter}
      size="sm"
      class="pl-8"
      placeholder="Search names…"
      aria-label="Search document names"
    />
  </label>

  <section class="border-t border-border pt-3">
    <div class="mb-2 grid grid-cols-[1fr_auto] gap-2 px-2 text-caption font-medium text-muted">
      <span>Name / value preview</span>
      <span>Type</span>
    </div>
    {#if loading}
      <p class="text-caption text-muted">Loading names…</p>
    {:else if names.length === 0}
      <p class="text-body-sm text-muted">{filter ? 'No matching names.' : 'No named values in this project yet.'}</p>
    {:else}
      <ul class="divide-y divide-border overflow-hidden rounded-panel border border-border bg-work">
        {#each names as entry (entry.name)}
          <li class="group px-2.5 py-2.5" title={`Value: ${displayValue(entry)}`}>
            <div class="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
              <span class="truncate font-mono text-label font-medium text-primary">{entry.name}</span>
              {#if pendingDelete === entry.name}
                <span class="flex items-center gap-1">
                  <span class="text-caption text-danger">Delete?</span>
                  <IconButton label="Confirm delete" size="sm" onclick={() => confirmRemove(entry.name)}>
                    <Check class="size-3.5 text-danger" />
                  </IconButton>
                  <IconButton label="Cancel delete" size="sm" onclick={() => (pendingDelete = null)}>
                    <X class="size-3.5" />
                  </IconButton>
                </span>
              {:else}
                <span class="flex items-center gap-1">
                  <span class="hidden items-center gap-1 group-hover:flex">
                    <IconButton label={`Edit ${entry.name}`} size="sm" onclick={() => openEdit(entry)}>
                      <Pencil class="size-3.5" />
                    </IconButton>
                    <IconButton label={`Delete ${entry.name}`} size="sm" onclick={() => (pendingDelete = entry.name)}>
                      <Trash2 class="size-3.5" />
                    </IconButton>
                  </span>
                  <Badge tone="neutral">{typeLabel(entry.type)}</Badge>
                </span>
              {/if}
            </div>
            <p class="mt-1 truncate text-caption text-muted">{displayValue(entry)}</p>
            {#if entry.source}
              <p class="mt-1 hidden truncate font-mono text-caption text-secondary group-hover:block">
                {entry.source}
              </p>
            {/if}
          </li>
        {/each}
      </ul>
    {/if}
  </section>
</div>

```

The panel header labels the section, the secondary Button opens the creator, and the search
`Input` (with an overlaid Search icon) binds `filter`. The `section` renders a two-column
header and then one of three states: a loading line, an empty/no-match message, or the list.
Each list row shows the mono-spaced name; on hover it reveals edit/delete `IconButton`s and a
type `Badge`, and when that row is `pendingDelete` it swaps in an inline "Delete?" confirm
with confirm/cancel buttons. Below the name sits the truncated value preview, plus the formula
source (hover-revealed) when present. The blank line separates the panel from the modal.

## Creator/editor modal

### The modal: mode toggle, formula/value inputs, available-names chips, and live preview

```svelte
<Modal bind:open={creatorOpen} title={editingName ? `Edit “${editingName}”` : 'New name'} size="sm">
  <div class="space-y-3">
    <div class="inline-flex rounded-control border border-border bg-panel p-1">
      {#each modeOptions as opt (opt.value)}
        <button
          type="button"
          disabled={!!editingName}
          onclick={() => (mode = opt.value as 'formula' | 'value')}
          class={'dur-small rounded-[5px] px-3 py-1 text-label font-medium transition-colors disabled:opacity-50 ' +
            (mode === opt.value ? 'bg-work text-primary shadow-panel' : 'text-muted hover:text-secondary')}
        >
          {opt.label}
        </button>
      {/each}
    </div>

    {#if mode === 'formula'}
      <p class="text-body-sm text-muted">
        Compose a formula from document names, then optionally assign its result to a name.
      </p>
      <label class="block">
        <span class="mb-1 block text-caption text-muted">Formula</span>
        <Input bind:value={formula} aria-label="Formula" class="font-mono" oninput={handleEvaluate} />
      </label>
    {:else}
      <p class="text-body-sm text-muted">Assign a literal value (number, text, or true/false) to a name.</p>
      <label class="block">
        <span class="mb-1 block text-caption text-muted">Value</span>
        <Input bind:value={literal} aria-label="Value" class="font-mono" placeholder="e.g. 42 or Hello" />
      </label>
    {/if}

    <label class="block">
      <span class="mb-1 block text-caption text-muted">
        Assign to name {#if mode === 'formula'}<span class="text-muted">(optional)</span>{/if}
      </span>
      <Input
        bind:value={assignedName}
        aria-label="Assign result to name"
        placeholder="e.g. distance_parsecs"
        class="font-mono"
        disabled={!!editingName}
      />
    </label>

    {#if mode === 'formula' && entries.length > 0}
      <div class="rounded-control bg-panel p-3">
        <p class="text-caption text-muted">Available names</p>
        <div class="mt-2 flex flex-wrap gap-1.5">
          {#each entries as entry (entry.name)}
            <button
              type="button"
              class="rounded-control border border-border bg-work px-2 py-1 font-mono text-caption text-secondary hover:border-border-strong"
              onclick={() => (formula += entry.name)}
            >
              {entry.name}
            </button>
          {/each}
        </div>
      </div>
    {/if}

    {#if mode === 'formula'}
      <div class="rounded-control border border-border px-3 py-2">
        <p class="text-caption text-muted">Preview</p>
        {#if evaluating}
          <p class="mt-1 font-mono text-body-sm text-muted">Evaluating…</p>
        {:else if evalError}
          <p class="mt-1 font-mono text-body-sm text-danger">{evalError}</p>
        {:else if evalResult}
          <p class="mt-1 font-mono text-body-sm text-primary">{evalResult}</p>
        {:else}
          <p class="mt-1 text-caption text-muted">Enter a formula to see its result.</p>
        {/if}
      </div>
    {/if}
  </div>
  {#snippet footer()}
    <Button variant="ghost" onclick={() => (creatorOpen = false)}>Cancel</Button>
    <Button variant="secondary" disabled={saveDisabled} onclick={saveCreator}>
      {editingName ? 'Save' : 'Create'}
    </Button>
  {/snippet}
</Modal>
```

The `Modal` binds its open state and titles itself for create vs. edit. Inside, the mode
toggle renders `modeOptions` as segmented buttons (locked while editing). Formula mode shows a
formula `Input` wired to `handleEvaluate` on input; Value mode shows a literal `Input`. The
shared "Assign to name" field is optional-labelled in Formula mode and locked while editing.
When formula mode has existing names, a chip row lets the user append a name into the formula
by click. The Preview box reflects the four live-evaluation states (evaluating, error, result,
empty). The `footer` snippet supplies Cancel and the Save/Create button gated by
`saveDisabled`.
