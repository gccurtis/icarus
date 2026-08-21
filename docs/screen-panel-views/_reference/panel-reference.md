# {{Panel name}}

| Selecting … | What it is | Sections |
| --- | --- | --- |
| {{what you clicked, or what the rail entry is}} | {{what it represents, and what you should be able to do and see}} | {{the sections it holds, in order}} |

{{what this panel is for, and why it is this panel rather than its neighbour}}

## Data

| Source | Kind | Provides |
| --- | --- | --- |
| {{`workbench.<accessor>`, or another field of the client model}} | Model | {{what it answers}} |
| {{`capabilities.<name>.<door>`}} | Capability | {{the entity it returns}} |
| {{a value no source above can supply}} | Prop | {{why it cannot come from a source}} |

The project is not among them. It is read from `/app/[project]` once and carried
on the client model, so a panel that took it would be offering a second answer to
a question already settled.

## Layout

The panel top to bottom, one row per label. A row with no label is furniture
between regions.

| Label | Components |
| --- | --- |
| {{region}} | {{the components in it, in order}} |
| {{region}} | {{the components in it, in order}} |

{{anything the table cannot say — a region present only in some states, a region
pinned while its neighbour scrolls. Delete if there is none}}

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
