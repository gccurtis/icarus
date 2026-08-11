---
title: "Design - Interaction & Disclosure System"
notion_page_id: "e12b6939dbc444698aca18d4162bab10"
notion_url: "https://app.notion.com/e12b6939dbc444698aca18d4162bab10"
project: "Taurus Yesod"
role: "Primary"
format: "Document"
created: "2026-07-13 08:58:20Z"
mirrored_at: "2026-07-30"
mirrored_from_notion: true
---

# Design - Interaction & Disclosure System

> Source mirror. Preserve this page as planning evidence; use the agent-facing execution packet when one exists.

<callout icon="✦" color="blue_bg">
	**Reviewed and retained — specialized interaction and disclosure authority.** This page supplements the four governing Yesod design documents and is active design guidance.
</callout>
# Mandate
Taurus must be extraordinarily easy to use despite being structurally powerful. The interaction model is built around **disclosure and arrangement**: show the user the right surface at the right time, and group secondary controls under abstractions the user can understand.
The operative word is **intuitiveness**. A user should not need to know Taurus-specific internals to create, edit, inspect, prompt, review, or recover work. The interface should remain easy to stay with over sustained use: disclosure reduces visual competition and repeated cognitive effort, not merely first-session complexity.
# Spatial model
The Taurus shell already defines the core geometry. The design system assigns a cognitive role to each region:
## Left context panel: “What exists around this work?”
Use for orientation, navigation, references, resources, personas, outline, sections, slides, layers, history, extracted data, and knowledge traces. The left panel should help the user understand context without modifying the selected object directly.
## Middle work surface: “Where do I think and produce?”
Use for document editing, grids, slides, boards, chat streams, project overview, agents, and knowledge views. This is the primary mental field. Do not crowd it with persistent secondary controls.
## Right inspector: “What can I change about this?”
Use for selection-specific controls. The inspector must reflect the active selection: paragraph, cell, formula, prompt block, shape, chart, message, row, task, persona, member, file, or activity entry. Nothing selected means a clear default state.
## AI Quarterback Surface: “How do I coordinate the next move?”
Use for generation, knowledge queries, targeted edits, agentic tasks, prompt-block creation, review, and cross-resource workflow coordination. When focused, it causes the inspector to take over with mode, scope, persona, verification, result target, prompt settings, and response history.
# Disclosure ladder
Every feature should be placed on the shallowest level where it belongs.
1. **Always visible** — primary task actions, current selection, critical status, create/open/prompt entry points.
2. **Context or inspector** — actions relevant to the active tab or selected object.
3. **Dropdown/popover** — grouped secondary actions under a clear noun or verb: Insert, Arrange, Share, Export, Review, Agent, More.
4. **Detail view/modal** — complex configuration, irreversible action confirmation, sharing/membership, task detail, persona editing.
5. **Advanced settings** — rarely used, specialized, or dangerous options. Avoid more than two hidden levels before reaching them.
# Grouping rule
Hide a group of controls only when all three are true:
- The group has a clear name a user can predict before opening it.
- The controls are not required for the most common task path.
- The hidden controls share one abstraction rather than merely sharing low usage.
Good groups: **Arrange**, **Share**, **Review changes**, **Prompt settings**, **Export**, **Insert**, **Formula**, **Agent task**, **Page settings**.
Bad groups: **Misc**, **Advanced** as a first-level label, unlabeled kebab menus for common work, icon-only drawers whose contents cannot be predicted.
# Required visible paths
The following must always have a visible primary route somewhere in the shell, context panel, inspector, or prompt surface:
- Create a resource.
- Open/search resources.
- Insert or configure a prompt block.
- See what is selected.
- Change the selected object's primary settings.
- Review agent changes.
- Undo, revert, or roll back where applicable.
- Understand whether content is live, pending, stale, failed, or resolved.
- Share or inspect membership for a project.
- See connection/sync status.
Right-click and hotkeys may accelerate these actions, but they cannot be the only route.
# Inspector behavior
The inspector must behave like a reliable lens:
- It changes because the user selected something, focused the prompt bar, or entered a detail mode.
- It names the current state at the top.
- It shows only controls relevant to the selection.
- It exposes destructive actions last and visually separates them.
- It gives live status for derived content: prompt block resolved/stale/resolving/failed, formula valid/error, agent change accepted/pending/rejected.
- It should never become a generic settings bin.
# Context panel behavior
The context panel must behave like a map:
- Icon rail items are stable and consistently ordered.
- Every icon has a tooltip and a visible label when the content rail is open.
- Universal views such as Personas and Resources are always present.
- View-specific context appears after universal views in a predictable order.
- The content rail restores the active tab's selected context view when switching tabs.
- Collapse keeps the icon rail visible; collapsed context should not erase orientation.
# AI Quarterback disclosure
The AI Quarterback Surface is the command-and-coordination layer, not a chat widget pasted onto every screen. It stays compact until the user focuses it, then discloses operational controls through the inspector.
A command should resolve into one of five modes:
- **Ask** — return an answer or create a prompt block.
- **Generate** — insert content into the current resource.
- **Edit selection** — transform the selected range/object.
- **Delegate** — create an agent task with persona, scope, and verification settings.
- **Review** — inspect pending agent changes, stale prompt blocks, failed operations, or derived work requiring judgment.
The AI Quarterback Surface can remain compact by default. On focus, the inspector takeover should disclose mode, scope, persona, verification, result target, response history, and routing. The user should know what Taurus is about to do before it acts.
# Selection and state clarity
Every selectable thing must have a clear selected state. For dense editors, use a combination of outline, background, handle, row/column highlight, or inspector title. Color alone is insufficient.
State vocabulary:
- **Idle** — available but not active.
- **Hover** — will respond if clicked.
- **Focus** — receives keyboard input.
- **Selected** — is the current object of inspection.
- **Active** — is currently being used or is the chosen mode.
- **Pending** — submitted but not confirmed.
- **Resolving** — waiting on formula/knowledge/agent computation.
- **Applied** — confirmed by truth layer or backend.
- **Rejected** — failed or refused, with explanation and recovery path.
# Menus and dropdowns
Use dropdowns for secondary grouped actions. A dropdown must have a visible trigger, a label with information scent, keyboard navigation, and a stable order. It should not be the only place to perform the main task.
# Search as rescue
Every complex surface should have a search or command-rescue path. Search is not a substitute for good disclosure, but it prevents the user from becoming trapped.
# Design review checklist
Before accepting a screen:
- Can a new user identify the main task without reading documentation?
- Are common actions visible?
- Are hidden controls grouped under names the user understands?
- Does the inspector match the selection exactly?
- Is any essential action only available through right-click, hotkey, or gesture?
- Can the user recover from mistakes?
- Does the interface prefer recognition over recall?
# Research basis
NN/g's progressive disclosure guidance supports showing important options first and disclosing specialized options on request. NN/g's recognition-over-recall guidance supports visible cues and choices rather than requiring users to retrieve commands from memory. W3C COGA guidance reinforces clear purpose, clear hierarchy, findability, mistake prevention, focus, and reduced memory reliance.
# AI Quarterback Surface correction
The bottom prompt bar is the AI Quarterback Surface. It directs work across the active resource, the project, and the agent system. This language supersedes any framing of the bar as passive help.
# Build-level disclosure rules
These are implementation constraints for the first front-end build.
```plain text
max hidden depth for common action      1 layer
max hidden depth for rare action        2 layers
minimum dropdown width                  220px
standard dropdown item height           32px
compact dropdown item height            28px
inspector section default gap           16px
inspector field gap                     8px
context rail item height                32px
context icon target                     32px inside 44px rail
```
# Always-visible action classes
These actions need a visible path in the shell, surface, context panel, inspector, or AI Quarterback Surface:
- Create or open a resource.
- Search resources.
- Inspect the current selection.
- Change the current selection's primary properties.
- Coordinate the next move from the AI Quarterback Surface.
- Insert or inspect a prompt block.
- Resolve, refresh, or review live derived work.
- Review and revert agent-produced changes.
- See sync, resolving, failed, and review-needed states.
# Hidden-action rules
A hidden action is acceptable only when its trigger has strong information scent. Use labels such as Insert, Arrange, Review, Share, Export, Formula, Agent, and More only when the contents match the label.
Do not hide a primary workflow behind an unlabeled icon, right-click menu, hover-only control, or keyboard shortcut.

