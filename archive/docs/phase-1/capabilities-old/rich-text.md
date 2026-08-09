# Rich Text

## Summary / Concept

<aside>
🧭

**Build position:** Rich Text is a shared Platform foundation used by Document, Slides, Spreadsheet, Knowledge Derived Outputs, comments, and editor adapters.

</aside>

Rich Text defines the canonical editable text vocabulary used throughout Icarus. It owns stable text-container, block, atom, mark, position, range, validation, normalization, codec, and pure transformation contracts. Resource capabilities embed Rich Text inside their own aggregates and persist it with their own Base and ChangeSets.

Document owns Rows and Document Blocks. Slides owns Slides, Groups, Shapes, and Notes. Spreadsheet owns Cells. Rich Text supplies the content stored inside those resource-specific containers.

### Prerequisites

- Platform Formula supplies formula source, resolution, evaluation, value encoding, and diagnostics for Formula atoms.
- Stable resource and component identities supply targets for reference atoms and link marks.

### Downstream consumers

- Document rich-text Blocks and Prompt Blocks.
- Slide Text Shapes and Slide Notes.
- Spreadsheet text-valued Cells.
- Knowledge Derived Output revisions whose output kind is `rich-text`.
- Comments whose anchors select an exact text range.

## Types & Interfaces

```tsx
type FormulaWireValue = import("#formula").FormulaWireValue;

interface RichContent {
  id: string;
  blocks: RichTextBlock[];
  revision: number;
}

interface RichTextBlock {
  id: string;
  rank: string;
  kind: "paragraph" | "heading" | "list-item" | "quote" | "code";
  level?: number;
  atoms: RichTextAtom[];
  marks: RichTextMark[];
}

type RichTextAtom =
  | {
      id: string;
      kind: "text";
      text: string;
    }
  | {
      id: string;
      kind: "formula";
      expression: string;
      acceptedValue?: FormulaWireValue;
      displayText: string;
      diagnostic?: RichTextFormulaDiagnostic;
    }
  | {
      id: string;
      kind: "reference";
      target: LinkTarget;
      displayText: string;
    }
  | {
      id: string;
      kind: "hard-break";
    };

interface TextPosition {
  blockId: string;
  atomId: string;
  offset: number;
}

interface TextRange {
  start: TextPosition;
  end: TextPosition;
}

type RichTextMark =
  | RangeMark<"bold">
  | RangeMark<"italic">
  | RangeMark<"underline">
  | RangeMark<"strike">
  | RangeMark<"code">
  | {
      id: string;
      kind: "style";
      range: TextRange;
      properties: TextStyleProperties;
    }
  | {
      id: string;
      kind: "link";
      range: TextRange;
      targets: LinkTarget[];
    };

interface RangeMark<TKind extends string> {
  id: string;
  kind: TKind;
  range: TextRange;
}

type LinkTarget =
  | { kind: "url"; href: string }
  | { kind: "resource"; resourceKind: string; resourceId: string; locator?: string }
  | { kind: "evidence"; evidenceId: string }
  | { kind: "question"; questionId: string }
  | { kind: "data"; entryId: string; locator?: string };

interface ReferenceAttachment {
  id: string;
  targets: LinkTarget[];
}

interface RichTextFormulaDiagnostic {
  code: string;
  message: string;
  sourceRange?: { start: number; end: number };
}

interface TextStyleProperties {
  fontFamily?: string;
  fontSize?: number;
  fontWeight?: number;
  color?: string;
  backgroundColor?: string;
  letterSpacing?: number;
  lineHeight?: number;
}
```

A link mark may contain one or several targets. Link identity and styling are independent: the text may remain visually quiet while the editor exposes its targets when selected or inspected. A visible citation section is ordinary Rich Text whose link marks or reference atoms point to the cited resources, Evidence, Data entries, Questions, or URLs.

Offsets use UTF-16 code units to match TypeScript and browser editor APIs. Ranges are half-open. Validation rejects endpoints outside their atoms and offsets that split a surrogate pair.

## Runtime Objects

```tsx
interface RichTextEngine {
  validate(content: RichContent): RichTextValidationResult;
  normalize(content: RichContent): RichContent;
  apply(content: RichContent, operations: RichTextOperation[]): RichTextApplyResult;
  clone(content: RichContent, ids: RichTextIdFactory): RichContent;
  plainText(content: RichContent): string;
}

interface RichTextCodec {
  encode(content: RichContent): Uint8Array;
  decode(bytes: Uint8Array): RichContent;
}

interface RichTextIdFactory {
  contentId(): string;
  blockId(): string;
  atomId(): string;
  markId(): string;
}

interface RichTextValidationResult {
  ok: boolean;
  diagnostics: RichTextDiagnostic[];
}

interface RichTextApplyResult {
  content: RichContent;
  inverse: RichTextOperation[];
  footprint: RichTextFootprint;
}
```

The engine is pure. A resource capability loads its aggregate, passes embedded content and operations to Rich Text, and places the result inside the resource ChangeSet. Formula evaluation, Knowledge refresh, persistence, comments, selection, and browser rendering remain outside the Rich Text engine.

## Change Operations

```tsx
type RichTextOperation =
  | { type: "insert-text"; at: TextPosition; text: string }
  | { type: "delete-range"; range: TextRange }
  | { type: "replace-range"; range: TextRange; text: string }
  | { type: "insert-atom"; at: TextPosition; atom: RichTextAtom }
  | { type: "delete-atom"; blockId: string; atomId: string }
  | { type: "split-block"; at: TextPosition; nextBlockId: string; nextRank: string }
  | { type: "join-blocks"; firstBlockId: string; secondBlockId: string }
  | { type: "insert-block"; block: RichTextBlock }
  | { type: "delete-block"; blockId: string }
  | { type: "move-block"; blockId: string; rank: string }
  | { type: "add-mark"; mark: RichTextMark }
  | { type: "remove-mark"; markId: string }
  | { type: "set-link-targets"; markId: string; targets: LinkTarget[] }
  | { type: "set-formula-expression"; blockId: string; atomId: string; expression: string }
  | { type: "apply-formula-result"; blockId: string; atomId: string; value: FormulaWireValue; displayText: string };
```

Text replacement clips or removes affected marks and normalizes adjacent equivalent marks. Split and join operations deterministically remap positions. Formula and reference atoms remain atomic during ordinary character editing. IDs are supplied before reduction and are never reused after removal.

A resource may apply one Rich Text operation or a batch as part of a larger atomic resource operation. Cross-block selections become one normalized range per affected block.

## Endpoints

Rich Text has no independent HTTP endpoints. Document, Slides, Spreadsheet, and other hosts expose resource-specific endpoints and carry `RichTextOperation[]` inside their request contracts.

## Jobs

Rich Text does not create Jobs or choose a queue. Host capability jobs invoke its pure engine inside their own serial mutation stage. Formula atoms may cause the host to schedule Formula evaluation through the host's established serial–concurrent–serial path.

## SQL Tables

Rich Text owns no SQL tables. Canonical content is embedded in the host capability's Base, component tables, and ChangeSets. Derived search text, layout fragments, link indexes, and comment-anchor indexes are rebuildable projections owned by the appropriate host or consuming capability.

## Governing Invariants

1. Rich Text IDs are stable within the host resource.
2. Resource containers remain owned by their resource capability.
3. Marks address exact atom-relative ranges and never own content.
4. Link marks and reference atoms carry explicit targets without creating refresh dependencies.
5. Formula source and accepted display remain distinct.
6. Normalization is deterministic and idempotent.
7. The same encoded content produces the same semantic digest.
8. Host ChangeSets remain the authority for persistence, conflict detection, undo, and redo.

## Related Pages

- Capability — Icarus Document Runtime Model
- Capability — Icarus Slides Runtime Model
- Capability — Icarus Spreadsheet Runtime Model
- Platform — Icarus Knowledge Runtime Model