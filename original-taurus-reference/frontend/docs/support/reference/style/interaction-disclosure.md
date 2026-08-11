# Interaction and disclosure

Taurus should expose the right surface at the right time and group secondary capability under abstractions a user can predict. Power should not require knowledge of internal architecture.

## Disclosure ladder

1. **Always visible:** primary task actions, current selection, critical state, create/open, and AI Agent entry.
2. **Context or inspector:** actions relevant to the active resource or selected object.
3. **Dropdown or popover:** secondary groups with clear names such as Insert, Arrange, Share, Export, or Review.
4. **Detail view or modal:** complex configuration, sharing, membership, task detail, and consequential confirmation.
5. **Advanced settings:** rare, specialized, or dangerous options.

Common actions should not be more than one hidden layer deep; rare actions should not require a maze.

## Grouping test

Hide a set of controls only when:

- its parent label is predictable before opening;
- it is not required for the primary path;
- the controls share one coherent abstraction.

“Arrange,” “Review changes,” and “Prompt settings” are useful groups. “Misc,” an unlabeled kebab for common work, or an unpredictable icon drawer are not.

## Visible paths

The interface needs a discoverable route to create and open resources, search, inspect selection, change primary properties, coordinate work, insert or inspect live objects, review agent changes, recover or revert, understand current state, and see synchronization status.

Right-click, gestures, slash commands, command search, and hotkeys may accelerate these paths but cannot be the sole route.

## State clarity

Differentiate Idle, Hover, Focus, Selected, Active, Pending, Resolving, Applied, and Rejected. Dense editors should combine outline, background, handle, row/column highlight, label, or inspector title. Color alone is insufficient.

## Search as rescue

Search and command discovery prevent users from becoming trapped, but they do not excuse weak navigation or hidden primary actions.

Source: [Taurus Interaction & Disclosure System](https://app.notion.com/p/392b6410e50281cea6abf648c701eb27)
