# Inspector Components

Lives at `src/lib/views/inspector/components/components.md`. This is the one
document for the complete recursive component tree. Nested component directories
do not carry their own Markdown files.

## Component Tree

```text
inspector.svelte
├── copilot                          components/copilot.svelte
├── text-selection                   components/text-selection.svelte
├── next-text                        components/next-text.svelte
├── project                          components/project.svelte
├── mention                          components/mention.svelte
├── resource                         components/resource.svelte
├── research-thread                  components/research-thread.svelte
├── activity                         components/activity.svelte
├── people                           components/people.svelte
├── file                             components/file.svelte
├── connector                        components/connector.svelte
├── variable                         components/variable.svelte
├── person                           components/person.svelte
├── newtab-document                  components/newtab-document.svelte
├── newtab-deck                      components/newtab-deck.svelte
├── newtab-spreadsheet               components/newtab-spreadsheet.svelte
├── newtab-recent                    components/newtab-recent.svelte
├── newtab-template                  components/newtab-template.svelte
├── newtab-upload                    components/newtab-upload.svelte
└── newtab-connector                 components/newtab-connector.svelte
```

At most one renders, chosen by the inspection key. The nothing-selected and
no-view-yet states are plain markup in the root rather than components, because
neither has anything to hold.

## Inventory

Maintained by `pnpm new-view-part`; only the block between the markers is
rewritten. Every authored component appears here, and each meaningful one is
described under Subtree Contracts below.

<!-- generated:inventory:start -->
- [`activity.svelte`](activity.svelte)
- [`connector.svelte`](connector.svelte)
- [`copilot.svelte`](copilot.svelte)
- [`file.svelte`](file.svelte)
- [`mention.svelte`](mention.svelte)
- [`newtab-connector.svelte`](newtab-connector.svelte)
- [`newtab-deck.svelte`](newtab-deck.svelte)
- [`newtab-document.svelte`](newtab-document.svelte)
- [`newtab-recent.svelte`](newtab-recent.svelte)
- [`newtab-spreadsheet.svelte`](newtab-spreadsheet.svelte)
- [`newtab-template.svelte`](newtab-template.svelte)
- [`newtab-upload.svelte`](newtab-upload.svelte)
- [`next-text.svelte`](next-text.svelte)
- [`people.svelte`](people.svelte)
- [`person.svelte`](person.svelte)
- [`project.svelte`](project.svelte)
- [`research-thread.svelte`](research-thread.svelte)
- [`resource.svelte`](resource.svelte)
- [`text-selection.svelte`](text-selection.svelte)
- [`variable.svelte`](variable.svelte)
<!-- generated:inventory:end -->

## Subtree Contracts

### Lenses built on the panel vocabulary

Seventeen of the twenty — everything under `project.`, `actor.` and `newtab.` —
are built from `$lib/unique-components/panel`, and share one contract:

- **Inputs:** `None`. The inspection key is the whole address: a project resource
  and a person are found by a project-scoped query, not by reading the active
  tab. That is what makes them reachable from every screen.
- **Outputs:** `None` directly. Each writes inspections through the workbench —
  a breadcrumb navigates to an ancestor, a "who" link opens an actor — which is
  a model call rather than a callback to the root.
- **Owned children:** `None`
- **Behavior delegated to the view root:** routing the key, and the width.
- **Focus behavior:** ordinary tab order. No lens takes focus or restores it.
- **Layout and overflow:** each fills the zone and owns its own scroll, because
  `Panel` pins the trail and the title row and scrolls everything under them.
- **Accessibility:** a `Breadcrumb` landmark where the thing has ancestors, then
  headings per section with `bits-ui` disclosures under them.

**All are fixtures.** Every value is a project-scoped query no capability can
answer yet. What is real is the routing, the breadcrumbs, and the writes: each
lens reaches other lenses by key, so clicking through them exercises the
vocabulary the specifications describe.

| Component | Renders | Reached from |
| --- | --- | --- |
| [`project.svelte`](project.svelte) | The project: identity, membership, dates | Settings, and every breadcrumb root |
| [`mention.svelte`](mention.svelte) | One comment addressed to you, and its anchor | The mentions feed, the Mentions view, a person's Between you |
| [`resource.svelte`](resource.svelte) | Any first-class thing: identity, provenance, relationships | The work table, the Resources view |
| [`research-thread.svelte`](research-thread.svelte) | A line of enquiry, and the way into the Research tab | The work table |
| [`activity.svelte`](activity.svelte) | One recorded event: actor, action, target, time | The Activity view |
| [`people.svelte`](people.svelte) | Everybody at once, rather than one person | The presence overflow chip |
| [`file.svelte`](file.svelte) | An external file, and whether text came out of it | The work table, Resources, Health |
| [`connector.svelte`](connector.svelte) | A connection: scope, delivery, sync state | Needs attention, Resources, Health |
| [`variable.svelte`](variable.svelte) | One project variable: name, key, type, value | The Variables view |
| [`person.svelte`](person.svelte) | A person's project profile, and writing to them | Any avatar, any "who" link |
| [`newtab-document.svelte`](newtab-document.svelte) | What a document will be, before it exists | The Document pill, the Create view |
| [`newtab-deck.svelte`](newtab-deck.svelte) | What a deck will be: aspect ratio and first slide | The Slide deck pill |
| [`newtab-spreadsheet.svelte`](newtab-spreadsheet.svelte) | What a spreadsheet will be — the shortest of the three | The Spreadsheet pill |
| [`newtab-recent.svelte`](newtab-recent.svelte) | Something that exists, and opening it without duplicating a tab | The Recent shelf and view |
| [`newtab-template.svelte`](newtab-template.svelte) | A template, its shape, and what it will ask for | The template shelf and view |
| [`newtab-upload.svelte`](newtab-upload.svelte) | Files on their way in | Bring in → Upload |
| [`newtab-connector.svelte`](newtab-connector.svelte) | Connecting a system, or repairing a connection | Bring in → connectors |

### `person`

Called out because it is the one that belongs to no screen. An actor is
inspectable from wherever it is named, so this lens is reached from a table cell
on one screen and an avatar on another, and it must not assume either.

It is also the one that says what it cannot do: writing to a person needs a
project-level comment with no resource anchor, and every current `Comment`
anchors to a resource. The composer is drawn and the send is disabled, with the
reason in the panel rather than in a comment here.

### Lenses that predate the panel vocabulary

`copilot`, `text-selection` and `next-text` take the fields of the inspection
they render and lay themselves out. They are unconverted, which is why the root
has two shapes — `.lens` for a panel, `.content` for a padded scroller — and the
two converge when these three are rewritten.

## Key Selection

- **Key:** `InspectionKey`, from `$model/client`. An opaque namespaced string.
- **Selected by:** [`inspector.svelte`](../inspector.svelte), which reads
  `workbench.inspectedNode`.

Routing is in two parts, and the split is the design:

| Key | Renders | How it is routed |
| --- | --- | --- |
| `undefined` | Nothing selected | root markup |
| `project.*`, `actor.*`, `newtab.*` | The lens for that key | `LENSES`, a map from the whole key |
| `copilot.*` | [`copilot.svelte`](copilot.svelte) | family, then member |
| `block.text-selection` | [`text-selection.svelte`](text-selection.svelte) | exact key, plus view state |
| `block.next-text` | [`next-text.svelte`](next-text.svelte) | exact key, plus view state |
| anything else | The key, named | root fallback |

**A map for the self-contained lenses, branches for the rest.** A `project` or
`actor` key is the whole address, so those lenses take no props and a map is
exactly right. A `block` or `document` key is a *label* whose detail lives in the
active tab's view state, and a `copilot` key's detail lives on the copilot
object — those need different reads, which a single map cannot express without
every component taking `any`.

The fallback names the key. That is the honest rendering of "some surface
produced a label and this panel has no view for it", and it is the trade for the
model not owning this vocabulary.

## Tree Invariants

- **No lens fetches anything.** When capabilities arrive the fetch belongs to the
  lens that needs it, not to the root — the root's job is to decide which one
  renders.
- **A lens writes inspections, never view state.** Navigating a breadcrumb or
  opening an actor sets a key through the workbench. Nothing here edits the thing
  it is inspecting.
- **The panel owns the scroll.** A lens never wraps itself in a scroller, because
  pinning the trail and the title row is a decision only `Panel` can make.
