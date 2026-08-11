# Application shell

> Status: conceptual reference. This describes the product geometry and interaction roles, not a frozen component tree.

The Taurus shell should make a sophisticated workspace feel immediately legible. It surrounds the active work without competing with it and gives every major region one cognitive job.

## Spatial model

| Region | Question it answers | Responsibility |
| --- | --- | --- |
| Top bar | Where am I globally? | Project identity, account, application-level actions, and settings. |
| Tab strip | What is open? | Permanent destinations and open resource instances, with clear active and closeable states. |
| Left context rail | What exists around this work? | Outline, resources, references, history, personas, and view-specific context. |
| Center work surface | Where do I think and produce? | The active document, workbook, deck, board, chat, knowledge view, or project surface. |
| Right inspector | What can I change about this? | Controls and information for the current selection or focused mode. |
| AI Quarterback Surface | How do I coordinate the next move? | Ask, generate, edit, delegate, and review in the scope of the current work. |
| Status surface | Is the system healthy and current? | Quiet connection, synchronization, resolution, and review state. |

The center is sacred. Chrome should orient, inspect, and coordinate; it should not crowd the user's work.

## Navigation model

Taurus is project-first. A user enters a project, then moves among durable resources and project-level destinations.

- Permanent destinations may include Project Overview, Resources, Knowledge, Agents, or other stable project views.
- Opening a resource creates or activates a resource tab.
- Permanent destinations must not look closeable; resource tabs must communicate that they represent open instances.
- Switching tabs should restore useful workspace state without pretending transient selection, focus, menus, or unfinished input are canonical backend data.
- New Tab is a launcher for create, open, and search—not an empty marketing screen.

One browser tab may initially correspond to one frontend attachment or workspace instance. Treat that as an incremental simplification, not a permanent product law.

## Context and inspection

The left side is a map. Stable icons remain recognizable; expanding the rail reveals labels and view-specific detail. Universal context should stay in predictable positions, while resource-specific context follows it.

The right side is a lens. It names the current selection and shows only controls relevant to that object. With no selection, it provides an intentional default rather than becoming a generic settings drawer. Destructive controls appear last and are clearly separated.

The inspector may temporarily shift into Quarterback configuration when the user focuses the coordination surface. Leaving that mode should restore the prior work context where possible.

## Disclosure rules

Primary actions and current state stay visible. Secondary actions belong under clear labels such as Insert, Arrange, Review, Share, Export, or More. Rare configuration may move into a detail view. No essential action should exist only behind right-click, a shortcut, a hidden gesture, or an unlabeled icon.

The shell should answer three questions within seconds:

1. Where am I?
2. What is active or selected?
3. What is the next plausible action?

## State language

Use explicit language for meaningful state: Loading, Resolving, Stale, Needs review, Applied, Failed, Offline, or Synced. Color may reinforce these states but cannot carry them alone. Every error should explain what happened, whether work was preserved, and what the user can do next.

## Alpha/Omega boundary

Alpha owns layout, navigation mechanics, selection, focus, menus, panel state, temporary drafts, optimistic presentation, retries, and conflict presentation.

Omega owns canonical projects, resources, document revisions, workspace records, permissions, validation, provenance, accepted derived outputs, and authoritative conflict decisions. Alpha renders Omega truth and turns user action into explicit product intent; it does not invent a second source of durable truth.

## Incremental build order

The smallest honest vertical is:

1. enter or select a project;
2. render the shell and Project Overview;
3. create or open a document in a resource tab;
4. edit and synchronize the document;
5. inspect the current selection;
6. expose a reduced AI Quarterback Surface with explicit mode, scope, and result state.

Additional resource families should reuse the shell's cognitive roles without forcing every editor into the same internal design.

## Primary sources

- [Taurus Shell Chrome View Functions — Index & Shared Contracts](https://app.notion.com/p/393b6410e502812a8e58ffe4739a8e68)
- [Taurus Interaction & Disclosure System](https://app.notion.com/p/392b6410e50281cea6abf648c701eb27)
- [Taurus Omega — Product Vision & Architecture Synthesis](https://app.notion.com/p/3a0b6410e5028116840ade3f8c41da41)
- [SOL X 15 — Workspace Shell, Navigation & Responsive Geometry](https://app.notion.com/p/39ab6410e502815993f9c185aaa5ff4b)
- [SOL X 25 — Workspace, Tabs, Selection & Inspector](https://app.notion.com/p/39ab6410e502815181b3d2823db55262)
