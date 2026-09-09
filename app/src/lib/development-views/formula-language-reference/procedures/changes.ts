import type { Card, Grid } from "$development-views/formula-language-reference/types";

export type Group = {
  readonly title: string;
  readonly detail: string;
  readonly files: Grid;
};

const columns = ["Path", "Lines", "State", "What it does, and why it is there"];

export const GROUPS: readonly Group[] = [
  {
    title: "The language",
    detail:
      "A new domain in the representation, declared in configuration/representation.yaml as reaching content and core and nothing else. It is where the whole language lives, and it is the reason the language can be said to belong to the project rather than to the spreadsheet.",
    files: {
      columns,
      mono: [0],
      rows: [
        ["data/types/formulas/expression.ts", "57", "new", "Expression, Address and Slice. What a formula is once it has been read, with ids in it and no A1 anywhere"],
        ["data/types/formulas/refusal.ts", "40", "new", "The twelve error tokens, the origin a refusal carries, and Answer. Declared as types so the vocabulary is closed"],
        ["data/types/formulas/resolver.ts", "17", "new", "Two questions a caller answers: a name, and an id. The only thing the engine knows about the world"],
        ["data/behavior/formulas/tokens.ts", "38", "new", "One sticky pattern. A character nothing matches refuses rather than being skipped"],
        ["data/behavior/formulas/parse.ts", "240", "new", "Precedence climbing, the slice and query grammars, and the four postfixes. Refuses #ERROR! rather than guessing"],
        ["data/behavior/formulas/evaluate.ts", "165", "new", "The walk. Built-in, then variable, then id, then #NAME?, and the ring guard that makes ! safe"],
        ["data/behavior/formulas/slicing.ts", "118", "new", "Positional and semantic slicing over every shape, including the rule that indexing nothing answers empty"],
        ["data/behavior/formulas/builtins.ts", "241", "new", "Thirty-three functions. IF, IFERROR and IFEMPTY are lazy; DATE is computed rather than asked of a clock"],
        ["data/behavior/formulas/values.ts", "131", "new", "Coercion, comparison and the shapes. Where a blank stops being a zero"],
        ["data/behavior/formulas/refusals.ts", "99", "new", "The token vocabulary with a sentence each, and how a refusal travels out of a deep walk without a class"],
        ["data/behavior/formulas/addresses.ts", "90", "new", "How an id is written inside a formula, and how every address is lifted back out by scanning"],
        ["data/behavior/formulas/names.ts", "35", "new", "What a legal word is, and why a name cannot be B4 or contain a hyphen"],
        ["data/behavior/formulas/test/unit/", "681", "new", "Seventy-five cases: arithmetic, names, references, both slicings, emptiness, every built-in group, dates"]
      ]
    }
  },
  {
    title: "The sheet's half",
    detail:
      "Everything that knows both a grid and a formula. It sits in the spreadsheets domain, which now declares that it reaches formulas — the one direction that edge runs.",
    files: {
      columns,
      mono: [0],
      rows: [
        ["data/behavior/spreadsheets/translation.ts", "266", "new", "A1 to ids and back, the lock masks, and shifting every reference when a formula is filled down a column"],
        ["data/behavior/spreadsheets/formulas.ts", "269", "new", "The sheet's resolver, the dependency order, recalculation, and one edit carrying its consequences"],
        ["data/behavior/spreadsheets/addressing.ts", "188", "new", "Moved down from the editor unchanged. A capability needs to say where a cell is as much as a view does"],
        ["data/behavior/spreadsheets/test/unit/", "315", "new", "Thirty cases: the round trip, the locks, a row inserted above, dependency order, cycles, refusals that travel"]
      ]
    }
  },
  {
    title: "The representation",
    detail:
      "Four changes agreed in review before any of this was written, and one that was not. Nothing else in the tree moved.",
    files: {
      columns,
      mono: [0],
      rows: [
        ["data/types/content/formula-value.ts", "+12", "changed", "Gained the reference member and ReferenceTarget, so a pointer is a value kind rather than a table of tables"],
        ["data/types/content/variable-value.ts", "24", "changed", "VariableValue became an alias of FormulaValue, and VariableType was added. The two lists are one list now"],
        ["data/types/spreadsheets/cell.ts", "+8", "changed", "expression is the formula addressed by ids; failure carries the refusal; anchors carries the locks"],
        ["store/tables.ts", "+3", "changed", "variables gained type and description"],
        ["configuration/representation.yaml", "+2", "changed", "Declares the formulas domain and the one edge from spreadsheets to it"]
      ]
    }
  },
  {
    title: "The capability",
    detail:
      "The ruling was that the capability recomputes and that resolution runs next to the rows. Both are true here: a change set is answered again on acceptance, with every sheet and every variable in the project in reach.",
    files: {
      columns,
      mono: [0],
      rows: [
        ["capabilities/spreadsheet/api/shared/answering.ts", "180", "new", "Recomputes on acceptance, mints and retires formulas rows, and writes what each formula points at"],
        ["capabilities/spreadsheet/api/submit-spreadsheet-changes/", "+6", "changed", "Answers and writes formulas between applying the ops and writing the cells; the canonical form learned three fields"],
        ["capabilities/variables/", "278", "new", "Read, save and remove. A name is checked and a declared type is enforced before a row is stored"],
        ["capabilities/spreadsheet/test/unit/spreadsheet.test.ts", "+11", "changed", "The store mock grew the three tables the new step reads and writes"]
      ]
    }
  },
  {
    title: "The editor",
    detail:
      "The category lost its own evaluator and gained two procedures and a panel. Every lens still calls one function to apply an edit; what that function does underneath is now the project's.",
    files: {
      columns,
      mono: [0],
      rows: [
        ["procedures/evaluate.ts", "546", "gone", "The editor's own evaluator, and its test. Replaced by the domain, as review said it would be"],
        ["procedures/recalculation.ts", "76", "new", "What a lens calls: the sheet's facts, drawing a stored formula, and one edit with its consequences"],
        ["procedures/variables.svelte.ts", "50", "new", "The project's names, held once so a lens can answer one while an edit is being applied"],
        ["context/variables.svelte", "150", "new", "The panel. The rail entry had been drawing the shell's placeholder"],
        ["procedures/references.ts", "185", "changed", "Reads what a formula points at off its ids instead of scanning its text, so a precedent is exact"],
        ["procedures/cells.ts", "+20", "changed", "Typing a formula translates it and stores the locks beside it"],
        ["procedures/values.ts", "-30", "changed", "The error vocabulary moved to the representation; a refusal is read from the cell rather than from its value"],
        ["procedures/scene.ts", "+8", "changed", "A refused cell draws its token, and the grid hands the editor A1 rather than ids"],
        ["procedures/addresses.ts", "40", "changed", "Now a re-export of the behaviour it used to hold, so forty importers did not have to move"],
        ["procedures/find.ts · clipboard.ts · structure.ts", "+20", "changed", "Search, paste and duplicate all work in what a person reads, and carry the locks"],
        ["procedures/fill.ts", "+18", "changed", "Filling a formula shifts its references instead of refusing, which is what the parser was missing"],
        ["content · context · inspector", "+30", "changed", "Eleven components call the new procedure and hand it the sheet they are looking at"]
      ]
    }
  },
  {
    title: "The seeds and the documents",
    detail: "So that opening the editor shows the language working rather than a page of refusals.",
    files: {
      columns,
      mono: [0],
      rows: [
        ["seed/sheetCells.json", "61", "changed", "Every seeded formula translated from A1 to ids, with its locks"],
        ["seed/variables.json", "6", "new", "A number, text, logic, a date, a list and an alias, so every kind is visible in the panel"],
        ["spreadsheet-editor.md", "+20", "changed", "Says the language is not the editor's, and what the two procedures own"],
        ["development-views/formula-language-reference/", "+2 pages", "changed", "This page, and As built rewritten against what now runs"]
      ]
    }
  },
  {
    title: "What review asked for afterwards",
    detail:
      "Twelve findings over two rounds, all of them about the editor rather than the language. Two of them moved the surface, which is shared, so they are named here as well.",
    files: {
      columns,
      mono: [0],
      rows: [
        ["sheet-surface.svelte", "589", "changed", "Boundary handles drawn from the grid's own bounds, so a row height drags and the cursor says so; a keystroke opens no editor of its own; trailing rows freeze; a cell draws its border; the scrollbar is the document's"],
        ["sheet-surface-glide.ts", "318", "changed", "Draws a cell's border inside its rect, dashed as asked"],
        ["sheet-surface-types.ts", "102", "changed", "A scene says how many rows are pinned and a cell carries its border"],
        ["procedures/picking.svelte.ts", "50", "new", "Replaces picking.ts: one channel for what is being typed, wherever it is typed, and one signal that says writing began"],
        ["procedures/anchoring.ts", "62", "changed", "What a lock is, which reference the caret is in, and what F4 and the four buttons both move"],
        ["components/cell-head.svelte", "263", "changed", "Takes the caret when the grid is typed on, and shows the four locks for the reference the caret sits in"],
        ["components/format-band.svelte", "374", "changed", "Style on its own row, font beside size, then cell style and border as their own sections"],
        ["context/grid.svelte", "234", "changed", "The frozen row count is a field rather than a note about the library"],
        ["inspector/variable.svelte", "148", "new", "A variable is inspected where everything else is, and enter is the save"],
        ["inspector/error-cell.svelte", "147", "changed", "The lens says what refused and nothing else"],
        ["content/sheet.svelte", "678", "changed", "Boxes every cell the expression being typed names, from the draft rather than from the stored formula"],
        ["procedures/scene.ts", "171", "changed", "Hands a cell its border and the scene its frozen row count"]
      ]
    }
  },
  {
    title: "And the round after that",
    detail:
      "A border became four borders, which moved the representation. The rest is the inspector saying more with less: no type, words instead of initials, and room between the sections.",
    files: {
      columns,
      mono: [0],
      rows: [
        ["data/types/content/block-format.ts", "+4", "changed", "A cell's border is one line per side rather than one box, which is what picking a side to edit needs"],
        ["data/behavior/content/borders.ts", "14", "new", "The four sides, the box a deck table still wants, and whether anything is drawn at all"],
        ["sheet-surface-glide.ts", "+35", "changed", "Strokes each side as its own line, set inside the grid's own hairline so a border of one pixel is not covered by it"],
        ["components/format-band.svelte", "+70", "changed", "Nothing is selected until you pick a side; the colour, width and dash then write to the sides you picked and leave the rest as they are"],
        ["components/color-pair.svelte", "50", "changed", "Text and Fill, spelled out, on the same control the border uses"],
        ["inspector/cell.svelte", "-25", "changed", "The type select is gone; the value already says what kind it is"],
        ["panel/panel-marks.svelte", "+12", "changed", "A multi-toggle can carry icons, which is what four sides need"],
        ["panel/panel-fields.svelte", "+10", "changed", "Fields can set their values against the right edge, so a range stops being cut off"],
        ["panel/panel.svelte", "+1", "changed", "Sections stand apart from each other in every panel, not only this one"],
        ["sheet-surface.svelte", "+30", "changed", "Zoom keeps the selection centred rather than the pixel you were looking at"],
        ["slide-deck-editor/", "+30", "changed", "The deck's table cells write all four sides at once, which is the border they had"]
      ]
    }
  },
  {
    title: "A merge that spans rows",
    detail:
      "The library spans columns and has no row span at all, so a merge taller than one row was three blank cells under a full one. It is drawn over the canvas now, from the same track sizes the library is given.",
    files: {
      columns,
      mono: [0],
      rows: [
        ["sheet-surface-types.ts", "+14", "changed", "A scene carries its merged blocks, each with the cell that fills it"],
        ["procedures/scene.ts", "+10", "changed", "Every row of a merge spans its columns, so no line is drawn down the middle of one"],
        ["sheet-surface.svelte", "+120", "changed", "One element per merge, and a position worked out from the scroller's own offset because getBounds answers for an unscrolled grid"],
        ["spreadsheet-editor.md", "+2", "changed", "Says a merge spans rows and why it is not drawn in the canvas"]
      ]
    }
  },
  {
    title: "Hardening: the eight the review asked for",
    detail:
      "The sheet stops borrowing the document's format, the server stops taking the client's word for history, a variable belongs to a project, the four largest files are split, and the whole editor is driven in a browser.",
    files: {
      columns,
      mono: [0],
      rows: [
        ["types/spreadsheets/cell-format.ts", "42", "new", "The sheet's own cell format and its per-side border, so a sheet change no longer reaches the deck"],
        ["types/spreadsheets/style-set.ts", "30", "changed", "TextStyle becomes CellStyle and carries borders and a number format"],
        ["behavior/spreadsheets/history.ts", "132", "new", "What a set replaced, what a remove carried away and where a track sat, worked out on the server"],
        ["submit-spreadsheet-changes/validate-*.ts", "125", "changed", "Every variant checked, every list and string bounded, and the client's history dropped"],
        ["submit-spreadsheet-changes.ts", "+30", "changed", "The sheet and its leader must exist; the change set stores the history the server derived"],
        ["behavior/spreadsheets/apply-*.ts · editing.ts", "490", "changed", "The 407-line engine as five files: dispatch, shared edits, cells, tracks, formatting"],
        ["sheet-surface-geometry.ts · -blocks · -handles", "371", "new", "The surface's tracks, its merged blocks and its resize handles, out of the 782-line component"],
        ["components/border-section.svelte · sheet-menu · sheet-strip", "530", "new", "The border section, the right-click menu and the bottom strip as their own components"],
        ["procedures/painting.ts", "55", "new", "Which cells are painted how, and where one field of a format is written"],
        ["procedures/variables.svelte.ts", "73", "changed", "Kept per project, so two projects may hold the same name and mean different numbers"],
        ["capabilities/templates/", "-190", "changed", "Spreadsheet template instantiation is refused rather than half-adapted to the new format"],
        ["test/browser/spreadsheet-editor.spec.ts", "480", "new", "Sixteen Chromium scenarios: opening, editing, saving, reload, formulas, undo, ranges, merges, zoom, scrolling and a refused submission"],
        ["capabilities/*/test/unit/", "+220", "changed", "Eighteen more cases: forged history, dead resources, bounds, and one name in two projects"]
      ]
    }
  }
];

export const SHAPE: readonly Card[] = [
  {
    title: "The language is a domain, not a feature",
    detail:
      "It sits beside content and spreadsheets in the representation, declares what it may reach, and reaches nothing else. A spreadsheet imports it; it imports no spreadsheet. That edge is checked by a lint rather than by intention.",
    tag: "ruled",
    tone: "ruled"
  },
  {
    title: "One function, two callers",
    detail:
      "The browser and the capability both recalculate through the same pure function. They cannot disagree about an answer, which is what makes optimistic editing safe and the capability's authority cheap.",
    tag: "ruled",
    tone: "ruled"
  },
  {
    title: "Nothing about A1 survives past the sheet",
    detail:
      "Translation happens on the way in and drawing on the way out, both in one file. The formula system has no code path that could read an address, which is the strongest form the ruling could take.",
    tag: "ruled",
    tone: "ruled"
  },
  {
    title: "A lock had to be remembered somewhere",
    detail:
      "The ruling put it outside the formula, so it went beside it on the cell as one mask per reference. The first change to the representation that was not agreed before it was made.",
    tag: "flagged",
    tone: "gap"
  },
  {
    title: "A border is four borders",
    detail:
      "Choosing which side to modify only means something if each side can hold its own colour, width and dash, so the format's one border became a line per side. The deck's table cells write all four alike and read the first, which is the box they had. The second change to the representation made ahead of a ruling.",
    tag: "flagged",
    tone: "gap"
  }
];
