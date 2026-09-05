# Interaction — theory

> **Committed stance.** Discipline rather than values. What a component must
> implement is [component](component.md).

The system exposes the right surface at the right time and groups secondary
capability under abstractions a user can predict. **Power must not require
knowledge of internal architecture.** A user should never need to know how the
domain model is decomposed in order to find the control that acts on it.

## Disclosure ladder

1. **Always visible** — primary task actions, current selection, critical state,
   create and open, the entry point for derived work.
2. **Context or inspector** — actions relevant to the active resource or the
   selected object.
3. **Dropdown or popover** — named secondary groups: Insert, Arrange, Share,
   Export, Review.
4. **Drawer, detail view, or modal** — object detail, side-by-side comparison,
   complex configuration, consequential confirmation.
5. **Advanced settings** — rare, specialized, or dangerous options.

Common actions stay within **one hidden layer at most**. Rare actions never
require a maze.

Rung 4 splits by intent, and the split is not cosmetic — a drawer is a place to
work beside what you were doing, a modal is an interruption that must earn
itself. The distinction is ultimately a claim about where things live, so it
belongs to a layout module — which does not currently exist. Until one does,
the two sentences above are the whole specification.

## Grouping test

Hide a set of controls only when all three hold:

1. Its parent label is predictable **before** opening it.
2. It is not required for the primary path.
3. The controls share one coherent abstraction.

"Arrange", "Review changes", and "Prompt settings" pass. "Misc", an unlabeled
kebab covering common work, and an unpredictable icon drawer fail.

## Visible paths

Each of the following needs a discoverable route operable by both mouse and
keyboard. No item here may live only behind a shortcut, a gesture, a slash
command, or a right-click:

- create, open, and inspect the primary objects;
- search across everything in scope;
- inspect the current selection and change its primary properties;
- coordinate work that spans more than one object;
- insert and inspect live objects;
- inspect the provenance of derived content — what produced it, from what, when;
- refresh, detach, or revert a live binding;
- review derived and agentic changes, and accept or revert them;
- recover from a mistake;
- understand current state and see synchronization status.

Accelerators — right-click, gestures, slash commands, command search, hotkeys —
**accelerate these paths and never replace them.** A path that exists only as an
accelerator does not exist for most users.

## Progressive depth

Depth is the point of a system like this. The rule is not to hide it but to order
it:

- **The default view answers the common question.** A derived value shows its
  result and its confidence, not its full production chain.
- **One step reaches the supporting material.** The inputs behind a result, the
  origin behind an input, the run that produced them.
- **Full lineage is always reachable, never mandatory.** A user who wants to
  audit a value back to its origin can. A user who does not is never made to walk
  past it.

Depth that cannot be skipped is not depth; it is friction.

## State clarity

Differentiate every state a surface can be in, and never with color alone. The
complete vocabulary and the required cues are in
[the state matrix](component.md#state-matrix).

## Search as rescue

Search and command discovery keep users from becoming trapped. They are a safety
net, not a substitute: their existence never excuses weak navigation or a hidden
primary action. If search is the fastest route to a common task, the navigation
is wrong.
