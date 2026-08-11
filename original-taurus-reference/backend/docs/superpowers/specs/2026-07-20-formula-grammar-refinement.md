# Formula grammar refinement — design

Three coordinated, **breaking** changes to the `formula/v1` language. Formula is
still unwired (no consumer), so the blast radius is ~0 — this is the right time.
Build order: (1) tighten field access, then (2) boolean query predicates.

## 1. Field names are identifiers only

A field name must be identifier-shaped everywhere it appears: record literals
(`{a: 1}`), `TABLE(...)`, projections (`.{a, b}`), and query fields. A name with a
space or other non-identifier character is a **parse error** (source) or a
**construction error** (Go `Value` API). This removes the only reason `["text"]`
existed. (Confirmed: nothing in the merged tree — including the knowledge tool's
record output — uses non-identifier field names.)

## 2. Square brackets are positional only

`[ ]` accepts a numeric index or a slice, nothing else:

- `people[2]`, `people[position]`, `people[n+1]` — index by a number; the index is
  just an expression that must evaluate to a number. **No parens needed** —
  `[(x)]` is now ordinary grouping, not a special "force numeric" form.
- `people[1:3]`, `items[2:]` — slice (unchanged).
- `people["score"]` and `people[score]` (field-by-name) — **removed**. Field access
  is `people.score` only.

Implementation: the parser already parses `[expr]` generically; the change is in
the evaluator — drop the "identifier/text index → field access" routing so a
non-numeric index is `invalid_index`.

## 3. Boolean query predicates in `.{ }`

`.{ }` gains a real boolean predicate over comparison leaves, replacing the fixed
comma-only conjunction.

```text
people.{ score >= 88 || score < 10 }
people.{ (score >= cutoff || vip = true) && active = true }
people.{ (score > 88) ^ (vip = true) }
people.{ !(archived = true), score > 0 }
```

**Operators & precedence (loosest → tightest):**

| Level | Operator | Meaning |
|---|---|---|
| 1 | `,` | AND (outermost separator; keeps every existing `.{a, b}` working) |
| 2 | `\|\|` | OR |
| 3 | `^` | XOR |
| 4 | `&&` | AND |
| 5 | `!` (prefix) | NOT |
| — | `( )` | grouping |

- **Leaf** = `field <op> expr`, `op ∈ = != < <= > >=`. The **left** side is always a
  bare field (column) name; the **right** side is an expression evaluated **once in
  binding scope** before row scanning (so `score > cutoff` compares each row's
  `score` to the binding `cutoff`). Field-to-field comparison stays unsupported —
  RHS is binding-scope — just now combinable with OR/XOR/grouping.
- The RHS expression is parsed at the additive level (below comparison and below
  the logical operators), so a predicate-level `||`/`^`/`&&` is never swallowed by
  the RHS, and an arithmetic `^` (power) inside the RHS never collides with the
  predicate-level `^` (XOR) — they live at different grammar tiers.
- **Projection vs. query** disambiguation (unchanged in spirit): bare field list
  (`.{name, score}`) → projection; anything containing a comparison, or starting
  with `(` or `!` → query.

**`^` dual role:** XOR between boolean operands at the predicate level; power
between numbers inside a comparison's RHS. Documented explicitly.

## Deferred (not in this change)

- `|` (pipe) "conditional" operator — its distinction from AND is still being
  worked out; add later once its use case is pinned.
- Field-to-field (per-row RHS) comparisons.
- Non-identifier field names.

## Impact

Breaking grammar change. Touches the parser (`syntax.go` — predicate grammar,
identifier-only field names), the evaluator (`evaluate.go` — positional-only index,
predicate-tree evaluation), value construction (`value.go` — identifier field-name
check), the DoS re-validator (`validateExpression` must walk the new predicate
tree — the security-critical part), the `querying.md` / `supported-formulas.md` /
`data-model.md` docs, the verbatim `*.go.md` companions, and tests. Landed as two
commits with a change record (0019).
