# {{Screen}} — {{workspace name}}

| Workspace | What it is for | Regions |
| --- | --- | --- |
| {{which state of the centre this is}} | {{what the person is doing here}} | {{the regions it holds, in order}} |

{{how the centre is banded, and why in that order}}

## Data

| Source | Kind | Provides |
| --- | --- | --- |
| {{`tab.viewState`, or another field of the client model}} | Model | {{what it answers}} |
| {{`capabilities.<name>.<door>`}} | Capability | {{the entity it returns}} |
| {{a value no source above can supply}} | Prop | {{why it cannot come from a source}} |

The project is not among them. It is read from `/app/[project]` once and carried
on the client model, so a workspace that took it would be offering a second
answer to a question already settled.

## Layout

The centre as a grid. The header row is `grid-template-columns`, written the way
it will be written in CSS; a label repeated in adjacent cells is one region
spanning them, across for width and down for height. Rows are proportional bands
rather than fixed heights.

| {{track}} | {{track}} |
| --- | --- |
| {{region}} | {{region}} |
| {{region}} | {{region}} |

{{why the tracks are those proportions, and anything the table cannot say — a
region present only in some states, a region pinned while its neighbour scrolls.
Delete if there is none}}

## {{Region}}

{{what this region is, and why it sits where it does}}

**Example** — {{sample content, concrete enough to judge the density by}}

**Nests** — {{the other regions this one contains, by label. Delete this line if
it contains none}}

### Structure

- {{`Component`}} — {{what it is here for, and how many}}
  - {{`Component`}} — {{what it holds, nested inside}}

### Props

{{what each component is given, named as the component names it}}

### Behavior

{{what a click, hover, drag or keypress does, and what results}}
