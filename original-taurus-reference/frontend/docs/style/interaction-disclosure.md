# Interaction and disclosure (authoritative)

> Status: **authoritative — committed stance.** Behavioral discipline for Taurus
> Alpha; no concrete surfaces are implemented yet. Full rationale:
> [reference baseline](../support/reference/style/interaction-disclosure.md).

Taurus exposes the right surface at the right time and groups secondary
capability under abstractions a user can predict. Power must not require
knowledge of internal architecture.

## Disclosure ladder

1. **Always visible:** primary task actions, current selection, critical state,
   create/open, AI Agent entry.
2. **Context or inspector:** actions relevant to the active resource or selected
   object.
3. **Dropdown or popover:** named secondary groups (Insert, Arrange, Share,
   Export, Review).
4. **Detail view or modal:** complex configuration, sharing, membership, task
   detail, consequential confirmation.
5. **Advanced settings:** rare, specialized, or dangerous options.

Common actions stay within one hidden layer at most; rare actions never require a
maze.

## Grouping test

Hide a set of controls only when its parent label is predictable before opening,
it is not required for the primary path, and the controls share one coherent
abstraction. "Arrange," "Review changes," and "Prompt settings" are valid groups;
"Misc," an unlabeled kebab for common work, or an unpredictable icon drawer are
not.

## Visible paths

There must be a discoverable route to create/open resources, search, inspect
selection, change primary properties, coordinate work, insert or inspect live
objects, review agent changes, recover or revert, understand current state, and
see sync status. Right-click, gestures, slash commands, command search, and
hotkeys may **accelerate** these paths but never be their sole route.

## State clarity

Differentiate Idle, Hover, Focus, Selected, Active, Pending, Resolving, Applied,
and Rejected. Dense editors combine outline, background, handle, row/column
highlight, label, or inspector title. Color alone is insufficient (see the
[color usage laws](color-system.md#usage-laws)).

## Search as rescue

Search and command discovery keep users from becoming trapped, but do not excuse
weak navigation or hidden primary actions.
