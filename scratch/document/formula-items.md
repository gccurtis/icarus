# Document capability — Formula items

## Purpose and ownership

A Formula item is a first-class, atomic inline item. It gives a Document a
typed place to embed a deterministic Formula expression without making
Document responsible for Formula syntax, values, evaluation, or diagnostics.

| Concern | Owner |
| --- | --- |
| Formula language version, parsing, binding, evaluation, value encoding, and diagnostics | Formula capability |
| Expression placement, accepted evaluation snapshot, deterministic display text, text-range marks, and ChangeSets | Document capability |
| Values and stable names used by an expression | Structured Data, Spreadsheet, Analysis, or the owner that exposes the value |

Document receives the public platform `Formula` interface at construction.
Formula has already been constructed with Name Manager and owns name
recognition, resolver-snapshot construction, binding, and evaluation. Document
owns only the asynchronous attempt lifecycle, accepted result, display text,
and logging around each call. Automatic dependency refresh can be added without
changing the stored item shape.

## Canonical item

```ts
type InlineAtom =
  | { id: string; kind: "text"; text: string }
  | { id: string; kind: "formula"; formula: FormulaItem }
  | { id: string; kind: "reference"; target: DocumentReferenceTarget; provenance: ProvenanceLink[] };

interface FormulaItem {
  languageVersion: "formula/v1";
  expression: string;
  state: "pending" | "current" | "stale" | "error";
  evaluation?: FormulaEvaluationSnapshot;
}

interface FormulaEvaluationSnapshot {
  inputManifest?: FormulaInputManifest; // absent only when parsing failed before resolution
  value?: FormulaWireValue;
  displayText: string;
  diagnostics: FormulaDiagnosticSummary[];
  evaluationDigest?: string;
  evaluatorVersion?: string;
  evaluatedAt: string;
}

interface FormulaInputManifest {
  digest: string;
  dependencies: FormulaDependency[];
}

interface FormulaDependency {
  kind: "structured-name" | "structured-cell" | "spreadsheet-cell" | "analysis-output";
  id: string;
  version: string;
}
```

`FormulaWireValue` is imported from Formula's public wire contract, not copied
into Document. It remains a tagged, lossless Formula value. `Formula` returns a
typed `FormulaEvaluation`; Document encodes that value and applies its
deterministic `formulaValueToDisplayText` function. The resulting `displayText`
is accepted into the Document snapshot alongside the value and input manifest.

Formula items are atomic for ordinary text editing: `text.splice` does not enter
their expression or evaluated display. A user edits the expression with
`formula.set-expression`, or removes/replaces the item as a whole. Marks and
text-range styles may address any substring of the accepted `displayText`.

## Evaluation process

```text
formula.set-expression / inline.insert(formula)
  → append ChangeSet with Formula item in pending state
  → queue an evaluation attempt
  → freeze atom ID + language version + expression digest
  → Formula.evaluate(expression, scopeId = documentId)
       Formula obtains Name Manager state and resolves names internally
  → encode FormulaValue and derive displayText
  → serially check that the Formula item has not changed
       same: append formula.apply-evaluation ChangeSet and transform its marks
       changed: retain stale attempt, make no Document mutation
```

Successful evaluation state is paired with the exact expression,
`FormulaInputManifest`, Formula evaluation digest, and evaluator version. It can
therefore be loaded from an exact historical snapshot without re-evaluating
against a newer project state. A parse failure occurs before resolver
construction and has no input manifest. In either state, `displayText` is the
string used by text positions, marks, styles, search indexing, and Prompt
protected-token serialization.

On a parse, binding, or evaluation failure, Document accepts an `error`
evaluation snapshot containing the Formula diagnostics and a stable diagnostic
display string. It does not convert the Formula item into ordinary text. A
later expression change or refresh can move the item back to `pending` and then
`current`.

## Operations and Formula integration

```ts
type FormulaOperation =
  | { type: "inline.insert"; blockId: string; atom: InlineAtom; afterAtomId?: string }
  | { type: "formula.set-expression"; blockId: string; atomId: string; languageVersion: "formula/v1"; expression: string }
  | { type: "formula.apply-evaluation"; blockId: string; atomId: string; evaluation: FormulaEvaluationSnapshot };

// Imported from 0-platform/formula and injected unchanged.
interface Formula {
  parse(req: ParseFormulaRequest): FormulaResult<FormulaExpression>;
  validate(req: ValidateFormulaRequest): Promise<FormulaResult<FormulaValidation>>;
  dependencies(req: FormulaDependencyRequest): Promise<FormulaResult<FormulaDependencyResult>>;
  evaluate(req: EvaluateFormulaRequest): Promise<FormulaResult<FormulaEvaluation>>;
  explain(req: ExplainFormulaRequest): Promise<FormulaResult<FormulaExplanation>>;
}

interface FormulaEvaluationAttempt {
  id: string;
  documentId: string;
  blockId: string;
  atomId: string;
  clientRequestId: string;
  frozenDocumentRevision: number;
  frozenExpressionDigest: string;
  languageVersion: "formula/v1";
  state: "requested" | "evaluating" | "proposed" | "settled" | "failed" | "stale" | "canceled";
  evaluation?: FormulaEvaluationSnapshot;
  settledChangeSetId?: string;
}
```

The injected `Formula` is the exact public interface from the
[Formula design](../formula-design.md). An evaluation request supplies formula
source, language version, and the Document ID as `scopeId`. Formula recognizes
names, obtains Name Manager snapshots, evaluates referenced name bodies, and
returns the exact dependency and evaluation manifests. Document never calls
Name Manager and never constructs or receives a resolver snapshot.

`formulaValueToDisplayText` is Document-owned and deterministic. Its formatting
version participates in the evaluation-attempt digest. A successful engine
result supplies the typed value and Formula evaluation/dependency digests;
Document supplies the display string and `evaluatedAt`. A failed engine result
supplies Formula diagnostics and a stable diagnostic display string without
converting the atom into ordinary text.

`formula.apply-evaluation` is internal: it can be emitted only after Formula
returns a normalized result. The reducer verifies that the expression
and result manifest match the frozen attempt. It replaces the prior
`displayText` as a whole and transforms marks over that atom using the same
clipping and boundary rules as a text replacement.

Formula performs its own internal logging through the Logger supplied when
Formula is constructed. Document separately logs its request, proposal, and
settlement stages through `DocumentDependencies.logger`; logs contain digests
and diagnostic codes, not Formula values.

A rebuildable `document_formula_dependency_index` can map each accepted
dependency to Formula-item IDs. It is an optimization for later automatic
refresh, not a source of truth. Manual formula refresh stays possible even
without that index.

## History

Every expression edit and accepted evaluation is a normal Document ChangeSet
with an inverse. The cross-resource Activity layer can therefore compensate
either event in chronological order. The inline Formula item does not need an
unbounded private result-history array; retained ChangeSets and Bases are the
historical record.
