# Commands

A design record for the command system: one client model object holding every
action the application can perform without an argument, the chords bound to
them, and the overlay that lists them.

Nothing here is built yet. This document is the thinking; the object's own
`commands.md` is the artifact, and it is written against
[the model standard](../app/docs/model-directory/model-directory.md) when the
directory lands.

## The naming collision, first

`--palette-*` already means colour in this repository, and
`views/demo/components/palette.svelte` renders those ramps. A second "palette"
meaning the command overlay would put two unrelated things behind one word in a
codebase that is careful about exactly this.

So the overlay is the **command bar**. "Command palette" stays available as
prose for people who know the term from other tools, but no identifier uses it.

## What a command is

A command is **the zero-argument subset of things the application can do.**

That is the whole boundary, and it is what stops the registry becoming an RPC
layer. A keystroke cannot supply an argument, so anything that needs one is a
model method; a command may wrap a method with a fixed argument, and two
commands may wrap the same method with different ones. `document.open` taking a
document id is not a command. `tab.close` is.

## The shape

```ts
export const COMMAND_IDS = [
  "command-bar.open",
  "tab.close",
  "tab.next",
  "tab.previous"
] as const;

export type CommandId = (typeof COMMAND_IDS)[number];

export const isCommandId = (value: string): value is CommandId =>
  (COMMAND_IDS as readonly string[]).includes(value);

/** A command's two halves. Neither takes an argument. */
export type Command = {
  enabled(): boolean;
  run(): void;
};
```

The registry is `Record<CommandId, Command>` — total, so a new id fails to
compile until it has a definition. Same reasoning as `CONTEXTS_BY_KIND`: there
is no partial map to leave a hole in, and no registry file to keep in step with
the union.

`COMMAND_IDS` is a frozen value rather than only a type because bindings
persist, and a stored id written by an older build has to be checked before it
is trusted. `isCommandId` drops what no longer exists — drift, not a defect,
matching how a stored resource kind is treated.

## Why `enabled` is separate from `run`

The tempting shape is one function that checks internally whether it should do
anything. It fails on the surface the whole system exists for: **a bar cannot
grey out what it cannot ask about.**

Disabled commands are shown greyed rather than hidden, so the bar teaches what
the application can do. That decision is what forces the split — with the check
inside `run`, the only way to learn whether "Close tab" applies is to run it,
and the list becomes a menu of items that silently do nothing.

`run` still refuses a disabled command, by throwing. That matches
`workbench.close()` throwing for a permanent tab: the caller must not offer what
it cannot do, and the throw is a tripwire for a caller that skipped the check
rather than a control path. The dispatcher tests `enabled` first.

## Neither half takes arguments

Both close over the model at construction:

```ts
"tab.close": {
  enabled: () => !workbench.active.permanent,
  run: () => workbench.close(workbench.activeId)
}
```

This is why enablement needs no context parameter. `enabled()` reads
`workbench.active`, which is `$state`, so a `$derived` in the bar that maps
`ids` through `enabled` re-runs when the active tab changes. Live greying falls
out of runes rather than being wired.

A `CommandContext` parameter only earns its keep the day enablement depends on
something outside the model graph — which DOM element has focus, say. It does
not today, and adding it later is a change to the registry rather than to the
consumers.

## Labels belong to the view

`CommandId` carries no label, no description, and no keywords, for the reason
`ContextId` carries none: rewording or translating display copy must not change
what a chord points at.

The command bar view holds `Record<CommandId, { label, description, keywords }>`
— total, so a new id fails to compile until it can be shown. The same split the
tab bar and the workspace already make.

No icons. The bar is a text list.

## Chords

The normal form is a string:

```text
$mod+k          $mod+shift+k          alt+k
```

`$mod` resolves to `Control` everywhere and `Meta` on Mac, which is the one
platform branch in the system. Modifiers appear in the fixed order
`$mod`, `alt`, `shift`, so one chord has exactly one spelling and the map cannot
hold two keys meaning the same gesture.

Every default binding uses `$mod` alone. Alt and shift exist in the format
because the binding editor captures whatever the user presses, not because
anything ships bound to them.

### Where the DOM boundary sits

The model defines the format and builds a chord from parts. It never sees a
`KeyboardEvent`:

```ts
// model
chordOf({ mod: true, alt: false, shift: false, key: "k" }) // "$mod+k"
```

The view converts an event into those parts and asks. One function serves both
the dispatcher and the editor's capture field, and the model stays testable with
no DOM — which is the same reason it exposes stable keys instead of components.

This is also where [tinykeys](https://github.com/jamiebuilds/tinykeys) drops in
later if the format outgrows hand-matching. It would replace the view half and
leave the model untouched.

## Bindings

Stored one direction, chord to command:

```ts
readonly bindings: Readonly<Record<Chord, CommandId>>;
bind(chord: Chord, id: CommandId): void;
unbind(chord: Chord): void;
bindingsFor(id: CommandId): readonly Chord[];
```

Chord-to-command is the direction dispatch needs and the direction the
uniqueness constraint lives in — one chord cannot mean two things. The editor
wants the other direction, so `bindingsFor` derives it; a command may have
several chords, and storing command-to-chords would make the conflict check a
scan.

`bind` replaces whatever held the chord and does not throw. Rebinding an
occupied chord is an ordinary thing to want, and the editor is expected to call
`bindings[chord]` first and say what it would displace. This is `reorder`
clamping rather than `close` throwing — a user gesture, not a caller error.

### No chord is reserved

Any gesture can be bound, including ones a browser uses for itself. The
dispatcher calls `preventDefault` on every chord it matched, so a bound
`$mod+s` takes the keystroke from the browser's save dialog.

A fixed list of forbidden chords would be wrong the moment this runs as its own
desktop shell holding a single browser process, where none of them are spoken
for. What is reserved is a property of the environment, not of the command
system, and this object has no way to learn it today. When there is something to
ask — a shell marker, a value from the server process — the editor gains a
warning, not a refusal.

### Defaults are not persisted

Only bindings the user set are written. A chord left at its default stores
nothing and follows a later change to the defaults, exactly as a tab nobody
dragged follows a later change to `DEFAULTS`.

Which is why unbinding a default has to be stored as a fact rather than as an
absence — an absent entry means "use the default", so removing the entry would
restore the chord the user just cleared. A cleared chord stores `null`, and the
effective map is defaults with the stored overrides applied over them.

### Storage

A second section on the persisted document:

```ts
/** Overrides only. `null` is a chord the user cleared. */
export type PersistedBindings = Readonly<Record<string, string | null>>;

export interface ClientStorage {
  readonly workbench: PersistedWorkbench | undefined;
  saveWorkbench(value: PersistedWorkbench): void;
  readonly bindings: PersistedBindings | undefined;   // new
  saveBindings(value: PersistedBindings): void;       // new
}
```

Bare `string` on both sides, because the storage types depend on nothing and a
stored value is whatever an older build wrote. Reading validates each id through
`isCommandId` and drops the rest.

No `STORAGE_VERSION` bump. An added optional section is readable by both
directions — an old document simply lacks it.

## What the object owns

The command bar's open state lives here, not in a view and not on a tab. It has
to: `command-bar.open` is itself a command, so the thing a command toggles must
be reachable from the registry. And it is not per-tab, so folding it into the
workbench would be the surface `workbench.md` warns about.

```ts
export type CommandsModel = {
  readonly ids: readonly CommandId[];
  enabled(id: CommandId): boolean;
  run(id: CommandId): void;

  readonly bindings: Readonly<Record<Chord, CommandId>>;
  bind(chord: Chord, id: CommandId): void;
  unbind(chord: Chord): void;
  bindingsFor(id: CommandId): readonly Chord[];

  readonly open: boolean;
  show(): void;
  hide(): void;
  toggle(): void;
};
```

The registry closes over the definition instance, so it is built after the
definition exists rather than beside it — that is the one construction-order
constraint in the object.

It does not own what a command is called, what a chord renders as, or which
element has focus. All three are the view's.

## Directory

Sibling of `workbench`, built after it:

```ts
// buildClientModel
workbench: createWorkbench(store),
commands: createCommands(workbench, store)
```

```text
model/client/commands/
├── commands.md
├── index.ts
├── types.ts
├── definition.svelte.ts
├── constructor.ts
├── methods/
│   ├── methods.md
│   ├── bind.ts
│   ├── bindings-for.ts
│   ├── chord-of.ts
│   ├── enabled.ts
│   ├── registry/
│   │   ├── registry.md
│   │   ├── registry.ts
│   │   └── restore-bindings.ts
│   ├── run.ts
│   └── unbind.ts
└── test/
    └── unit/
```

`registry/` sits under `methods/` rather than at the object root because the
root holds what the object *is* and everything it *does* lives below — including
a module no consumer calls by name. `methods.md` names the constructor as its
caller.

It is a directory rather than a file from the start because it gains a sibling
per command family, and `restore-bindings.ts` is already a second module.

Scaffolding is `pnpm new-model-object -- client commands --definition reactive
--depends workbench,storage`, which writes the six files and edits the three
that join it to the root.

## The views

Two, both siblings under `views/`:

- **`command-bar/`** — the overlay. Reads `commands`, holds the display copy
  map, renders every id with `enabled(id)` deciding the greyed state. Built on
  the already-vendored `simple-components/command` parts.
- **`shortcuts/`** — the binding editor. Lists commands with their chords, and
  adds one by selecting a command and pressing the gesture.

Dispatch is an effect at the application frame, per the view standard's rule
that global listeners are effects:

```text
views/app/effects/dispatch-commands.svelte.ts
```

It converts the event to chord parts, looks up the binding, checks `enabled`,
calls `run`, and calls `preventDefault` when it matched. `app.md`'s "Keyboard
model: none of its own" stops being true and is updated with it.

The bar renders inside the frame as a centred overlay rather than in one of the
six grid zones — it belongs to no zone and dims all of them.

## Switching colours from the bar costs more than it looks

The demo can change theme today, so making it a command reads as free. It is
not, and the reason is structural rather than effortful.

Appearance currently lives in
`views/demo/effects/apply-appearance.svelte.ts` — a demo view effect writing
`data-theme` and one localStorage key. The demo is at `/demo`, outside `/app`,
and **the client model is only initialized by the `/app` layout**. `/demo` has
no client instance, so it cannot reach a command registry at all. Its own
invariant says so directly: *no section reads the client model or calls a
capability.*

So an `appearance.next-theme` command needs a small `appearance` client model
object owning the theme and persisting it, and it would apply in `/app` only.
The demo keeps its own local switcher, and the two mechanisms coexist —
deliberately, because the demo is the styling reference and must render without
an application around it.

That object is genuinely small. It is just not the same object as this one, and
it is not a prerequisite: `command-bar.open`, `tab.close`, and the binding
editor are complete without it.

## Not in the first version

- **Focus scoping** — one chord meaning different things per zone. The registry
  is flat and `enabled` is the only gate. Scoping arrives as a field on a
  context object, and every consumer is unaffected.
- **Conflict resolution beyond replacement.** `bind` displaces; nothing
  arbitrates priority.
- **Per-kind registries.** `COMMANDS_BY_KIND` mirrors `CONTEXTS_BY_KIND` if the
  flat list plus `enabled` stops being readable. It is not yet.
- **Command arguments**, permanently. See the boundary at the top.
