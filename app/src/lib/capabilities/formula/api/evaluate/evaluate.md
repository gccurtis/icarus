# API: `evaluate`

Computes one expression against the cells around it.

Registered as `api.capabilities.formula.evaluate`, built from `projectQuery`.

## Procedure Tree

```text
evaluate(ctx, scope, expression, cells)
├── parse(expression)                       parse.ts
├── reduce(ctx, scope, node, cells)         reduce.ts
│   ├── rangeValue(from, to, cells)         reduce.ts
│   ├── findVariable(ctx, scope, name)      ../../../name-manager/api/shared/find-variable.ts
│   ├── asTable(name, value)                ../../../name-manager/types/table.ts
│   ├── apply(operator, left, right)        arithmetic.ts
│   └── BUILTINS[name](args)                builtins.ts
└── catch FormulaError → { state: "error" } evaluate.ts
```

## A refusal becomes a result; a fault stays a fault

A formula that cannot be computed is an ordinary outcome the block displays, so
every `FormulaError` is caught and returned as `state: "error"` with its message.
Anything else — a bug here, a database that failed — propagates. Reporting those
as a failed formula would hide them behind a red cell forever.

That is Convex's own refusal/fault line, drawn again inside one function.

## Empty is carried through, never collapsed

A reference to a blank cell reduces to `empty`. Arithmetic on it refuses rather
than treating it as zero, and an aggregate skips it rather than counting a gap as
a value. Both halves matter: `=A1*2` answering `0` for a cell nobody filled in
reads exactly like an answer, and an average that divides by the blank row is
wrong in the way nobody notices.

## Names resolve one way

A bare name that is not a builtin is asked of the name manager, in this same
transaction. The name manager asks nothing of this capability — see
[its overview](../../../name-manager/overview.md#it-evaluates-nothing).

A name is a name because of its *shape*: anything matching a cell address is a
cell. So `Q3` is a cell reference and always will be, which is what makes an
expression mean the same thing wherever it is pasted.
