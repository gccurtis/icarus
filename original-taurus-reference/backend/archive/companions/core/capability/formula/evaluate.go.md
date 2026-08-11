# evaluate.go

`evaluate.go` executes validated Formula trees against immutable, request-scoped
bindings. It evaluates exact arithmetic, comparisons, short-circuit logic, collections,
navigation, dot-curly projection/query operations, and strict or optional row promotion
without side effects or implicit coercion.

Evaluation revalidates language compatibility and the complete AST before execution,
deep-clones values at its public boundary, and charges deterministic work throughout.
Every admitted input, intermediate collection or call result, and final output is
checked for depth, shape, display size, and exact-number size, so discarded
intermediates and externally supplied values remain bounded too.

## Code breakdown

### Package declaration

```go
package formula

```

The evaluator shares Formula's syntax tree, typed values, structured errors, and
deterministic service limits.

### Exact-arithmetic dependency

```go
import "math/big"

```

`math/big` implements rational arithmetic, integer remainder, and bounded integer
exponentiation without floating-point loss.

### Request-scoped bindings

```go
// Bindings supplies immutable, request-scoped values for identifiers. Binding
// names and field names are case-sensitive; built-in function names are not.
type Bindings map[string]Value

```

`Bindings` maps case-sensitive names to typed Formula values. The map is an immutable
input by contract for the duration of a call; evaluation never writes through it and
clones each value before returning it into computation.

### The Resolver port

```go
// Resolver is the evaluator's only channel for resolving a top-level
// identifier. Bindings implements it, so the map-based API is unchanged; the
// name manager provides a resolver over an immutable snapshot of stored names.
// Determinism holds only if the resolver itself is deterministic.
type Resolver interface {
	Resolve(name string) (value Value, ok bool, err error)
}

// Resolve makes a Bindings map a Resolver.
func (b Bindings) Resolve(name string) (Value, bool, error) {
	v, ok := b[name]
	return v, ok, nil
}

```

`Resolver` is the one seam through which the evaluator reaches outside the current call
for a name — today that is always a `Bindings` map, but the same interface lets a future
name manager resolve identifiers from an immutable snapshot of stored names without the
evaluator knowing the difference. `Bindings.Resolve` makes the existing map-based API a
`Resolver` for free, so every current caller keeps working unchanged.

### Parse-and-evaluate entry points

```go
// Evaluate parses and evaluates source with DefaultLimits.
func Evaluate(source string, bindings Bindings) (Value, error) {
	return NewService().Evaluate(source, bindings)
}

```

The package helper uses default limits, and the service method parses under that
service's configuration before delegating to parsed-expression evaluation. Parse
failures therefore stop before any execution occurs.

### The Service Evaluate operation

```go
// Evaluate parses and evaluates source against exact request-scoped bindings.
func (s *Service) Evaluate(source string, bindings Bindings) (Value, error) {
	expression, err := s.Parse(source)
	if err != nil {
		return Value{}, err
	}
	return s.EvaluateExpression(expression, bindings)
}

```

This block implements Service Evaluate as one bounded part of Formula parsing or evaluation.

### Parsed-expression evaluation

```go
// EvaluateExpression evaluates an already parsed expression against bindings.
func (s *Service) EvaluateExpression(expression *Expression, bindings Bindings) (Value, error) {
	return s.EvaluateExpressionWith(expression, bindings)
}

// EvaluateWith parses and evaluates source against a resolver.
func (s *Service) EvaluateWith(source string, resolver Resolver) (Value, error) {
	expression, err := s.Parse(source)
	if err != nil {
		return Value{}, err
	}
	return s.EvaluateExpressionWith(expression, resolver)
}

// EvaluateExpressionWith evaluates an already parsed expression against a
// resolver. It rejects an unknown language version rather than silently applying
// current semantics.
func (s *Service) EvaluateExpressionWith(expression *Expression, resolver Resolver) (Value, error) {
	if err := validateExpression(expression, s.Limits()); err != nil {
		return Value{}, err
	}
	evaluator := evaluator{limits: s.Limits(), resolver: resolver}
	value, err := evaluator.eval(expression.Root, 1)
	if err != nil {
		return Value{}, err
	}
	if err := evaluator.admitValue(value, expression.Root.Span, 1); err != nil {
		return Value{}, err
	}
	return value.clone(), nil
}

```

`EvaluateExpression` is now a thin wrapper over `EvaluateExpressionWith`, since a
`Bindings` map is itself a `Resolver`; the public bindings-based API is unchanged.
`EvaluateWith`/`EvaluateExpressionWith` are the resolver-based entry points: they
revalidate the complete tree and language version under the service's hard ceilings,
create fresh evaluator counters over the resolver, execute the root, admit the final
result, and return a deep clone. Directly constructed or decoded ASTs therefore
receive the same structural checks as parsed source. The evaluator itself carries no
copy of the expression's source text — a function's defining source was captured once
by the parser onto the `NodeFunction` node (`Node.Source`; see `syntax.go`) rather than
sliced back out of a source string at evaluation time, so nothing here needs it.

### Per-evaluation state

```go
type evaluator struct {
	limits   Limits
	resolver Resolver
	steps    int
	// rowScope, when set, is the current row of a query being matched. Inside a
	// query an identifier resolves to a row field first (see NodeName) and only
	// falls back to a binding when no such field exists.
	rowScope *queryRowScope
	scope    *scope
}

// queryRowScope holds the column layout and the current row of a query in
// progress, so identifier lookups can prefer a field over a like-named binding.
type queryRowScope struct {
	index map[string]int
	row   []Value
}

// scope is one frame of a function's lexical environment: parameter (and
// enclosing) bindings, chained to the scope captured at definition. It is nil
// outside any function application, so non-function evaluation is unchanged.
type scope struct {
	names  map[string]Value
	parent *scope
}

```

The evaluator holds effective limits, the root `Resolver` (bindings or, later, a name
manager snapshot), a step counter, and — only while a query is matching — a `rowScope`
pointing at the current row, and — only while inside a function application — a
`scope` chain of parameter frames. The row scope is the mechanism behind field-first
identifier resolution inside `.{...}`; the function scope is the mechanism behind
lexical closures (see `resolveOptional` and `apply` below). Both are nil outside their
respective contexts, so ordinary evaluation is unchanged; nothing else mutable
survives a call, so evaluation stays deterministic. The evaluator does not keep its own
copy of the source text: a function's defining span is captured once by the parser,
onto the `NodeFunction` node itself (`Node.Source`), so `makeFunction` below only ever
reads `node.Source` — never slices a source string — and is therefore correct even
when the node is evaluated by an evaluator running over a different top-level source
than the one it was originally parsed from (for example a stored function resolved
and applied from another expression).

### AST dispatch

```go
func (e *evaluator) eval(node *Node, depth int) (Value, *FormulaError) {
	if node == nil {
		return Value{}, errorAt(ErrorParse, Span{}, "expression contains an empty node")
	}
	if depth > e.limits.MaxDepth {
		return Value{}, limitError(node.Span, "evaluation_depth")
	}
	if err := e.charge(node.Span, 1); err != nil {
		return Value{}, err
	}
	switch node.Type {
	case NodeLiteral:
		if node.Value == nil {
			return Value{}, errorAt(ErrorParse, node.Span, "literal has no value")
		}
		if err := e.admitValue(*node.Value, node.Span, depth); err != nil {
			return Value{}, err
		}
		return node.Value.clone(), nil
	case NodeName:
		return e.resolveIdentifier(node.Name, node.Span, depth)
	case NodeGroup:
		return e.eval(node.Left, depth+1)
	case NodeUnary:
		value, err := e.eval(node.Right, depth+1)
		if err != nil {
			return Value{}, err
		}
		return e.evalUnary(node.Operator, value, node.Span)
	case NodeBinary:
		left, err := e.eval(node.Left, depth+1)
		if err != nil {
			return Value{}, err
		}
		if node.Operator == "&&" || node.Operator == "||" {
			leftLogic, ok := left.Logic()
			if !ok {
				return Value{}, errorAt(ErrorType, node.Left.Span, "operator %s expects logic, got %s", node.Operator, left.Kind())
			}
			if node.Operator == "&&" && !leftLogic || node.Operator == "||" && leftLogic {
				return LogicValue(leftLogic), nil
			}
			right, err := e.eval(node.Right, depth+1)
			if err != nil {
				return Value{}, err
			}
			rightLogic, ok := right.Logic()
			if !ok {
				return Value{}, errorAt(ErrorType, node.Right.Span, "operator %s expects logic, got %s", node.Operator, right.Kind())
			}
			return LogicValue(rightLogic), nil
		}
		right, err := e.eval(node.Right, depth+1)
		if err != nil {
			return Value{}, err
		}
		return e.evalBinary(node.Operator, left, right, node.Span)
	case NodeList:
		if len(node.Items) > e.limits.MaxRows {
			return Value{}, limitError(node.Span, "rows")
		}
		if len(node.Items) > e.limits.MaxCells {
			return Value{}, limitError(node.Span, "cells")
		}
		items := make([]Value, len(node.Items))
		for i, item := range node.Items {
			value, err := e.eval(item, depth+1)
			if err != nil {
				return Value{}, err
			}
			items[i] = value
		}
		if err := e.charge(node.Span, len(items)); err != nil {
			return Value{}, err
		}
		value := ListValue(items)
		if err := e.admitValue(value, node.Span, depth); err != nil {
			return Value{}, err
		}
		return value, nil
	case NodeRecord:
		if len(node.Fields) > e.limits.MaxFields {
			return Value{}, limitError(node.Span, "fields")
		}
		if len(node.Fields) > e.limits.MaxCells {
			return Value{}, limitError(node.Span, "cells")
		}
		fields := make([]string, len(node.Fields))
		values := make([]Value, len(node.Fields))
		for i, field := range node.Fields {
			value, err := e.eval(field.Value, depth+1)
			if err != nil {
				return Value{}, err
			}
			fields[i], values[i] = field.Name, value
		}
		if err := e.charge(node.Span, len(values)); err != nil {
			return Value{}, err
		}
		value, recordErr := RecordValue(fields, values)
		if recordErr != nil {
			return Value{}, errorAt(ErrorInvalidTable, node.Span, "%v", recordErr)
		}
		if err := e.admitValue(value, node.Span, depth); err != nil {
			return Value{}, err
		}
		return value, nil
	case NodeCall:
		value, err := e.evalCall(node, depth+1)
		if err != nil {
			return Value{}, err
		}
		if err := e.admitValue(value, node.Span, depth); err != nil {
			return Value{}, err
		}
		return value, nil
	case NodeField:
		target, err := e.eval(node.Target, depth+1)
		if err != nil {
			return Value{}, err
		}
		return e.evalField(target, node.Name, node.Span)
	case NodeIndex:
		target, err := e.eval(node.Target, depth+1)
		if err != nil {
			return Value{}, err
		}
		index, err := e.eval(node.Index, depth+1)
		if err != nil {
			return Value{}, err
		}
		return e.evalIndex(target, index, node.Span)
	case NodeSlice:
		target, err := e.eval(node.Target, depth+1)
		if err != nil {
			return Value{}, err
		}
		var start, end *Value
		if node.SliceStart != nil {
			value, err := e.eval(node.SliceStart, depth+1)
			if err != nil {
				return Value{}, err
			}
			start = &value
		}
		if node.SliceEnd != nil {
			value, err := e.eval(node.SliceEnd, depth+1)
			if err != nil {
				return Value{}, err
			}
			end = &value
		}
		return e.evalSlice(target, start, end, node.Span)
	case NodeProjection:
		target, err := e.eval(node.Target, depth+1)
		if err != nil {
			return Value{}, err
		}
		value, projectionErr := e.evalProjection(target, node.Projection, node.Span)
		if projectionErr != nil {
			return Value{}, projectionErr
		}
		if err := e.admitValue(value, node.Span, depth); err != nil {
			return Value{}, err
		}
		return value, nil
	case NodeQuery:
		target, err := e.eval(node.Target, depth+1)
		if err != nil {
			return Value{}, err
		}
		value, queryErr := e.evalQuery(target, node.Predicate, node.Span, depth+1)
		if queryErr != nil {
			return Value{}, queryErr
		}
		if err := e.admitValue(value, node.Span, depth); err != nil {
			return Value{}, err
		}
		return value, nil
	case NodePromote:
		target, err := e.eval(node.Target, depth+1)
		if err != nil {
			return Value{}, err
		}
		value, promoteErr := e.evalPromote(target, node.Span)
		if promoteErr != nil {
			return Value{}, promoteErr
		}
		if err := e.admitValue(value, node.Span, depth); err != nil {
			return Value{}, err
		}
		return value, nil
	case NodeOptional:
		target, err := e.eval(node.Target, depth+1)
		if err != nil {
			return Value{}, err
		}
		value, optionalErr := e.evalOptional(target, node.Span)
		if optionalErr != nil {
			return Value{}, optionalErr
		}
		if err := e.admitValue(value, node.Span, depth); err != nil {
			return Value{}, err
		}
		return value, nil
	case NodeFunction:
		value := e.makeFunction(node)
		if err := e.admitValue(value, node.Span, depth); err != nil {
			return Value{}, err
		}
		return value, nil
	case NodeApply:
		target, err := e.eval(node.Target, depth+1)
		if err != nil {
			return Value{}, err
		}
		args := make([]Value, len(node.Args))
		for i, arg := range node.Args {
			argValue, err := e.eval(arg, depth+1)
			if err != nil {
				return Value{}, err
			}
			args[i] = argValue
		}
		value, err := e.apply(target, args, node.Span, depth)
		if err != nil {
			return Value{}, err
		}
		if err := e.admitValue(value, node.Span, depth); err != nil {
			return Value{}, err
		}
		return value, nil
	default:
		return Value{}, errorAt(ErrorParse, node.Span, "unsupported AST node %q", node.Type)
	}
}

```

The central dispatcher checks evaluation depth and charges a step before interpreting
each node. It admits values before cloning, bounds collections before allocation,
short-circuits logic, and dispatches arithmetic, comparison, navigation, projection,
query, and promotion nodes; malformed nodes fail as structured parse errors. `NodeFunction`
builds a function value that captures the current lexical scope (`makeFunction`);
`NodeApply` evaluates its callee and every argument — left to right, eagerly, exactly
like a builtin call — before handing both to `apply`, so an application's result is
admitted the same way as any other node's.

### Unary operators

```go
func (e *evaluator) evalUnary(operator string, value Value, span Span) (Value, *FormulaError) {
	if operator == "!" {
		logic, ok := value.Logic()
		if !ok {
			return Value{}, errorAt(ErrorType, span, "operator ! expects logic, got %s", value.Kind())
		}
		return LogicValue(!logic), nil
	}
	number, ok := value.Number()
	if !ok {
		return Value{}, errorAt(ErrorType, span, "operator %s expects number, got %s", operator, value.Kind())
	}
	if err := e.chargeNumbers(span, number); err != nil {
		return Value{}, err
	}
	switch operator {
	case "+":
		return e.finishNumber(number, span)
	case "-":
		return e.finishNumber(new(big.Rat).Neg(number), span)
	default:
		return Value{}, errorAt(ErrorParse, span, "unknown unary operator %q", operator)
	}
}

```

Prefix `!` negates logic. Unary plus copies and unary minus negates an exact number;
numeric operations reject other kinds and charge magnitude-aware work.

### Binary comparison and arithmetic

```go
func (e *evaluator) evalBinary(operator string, left, right Value, span Span) (Value, *FormulaError) {
	if isConditionOperator(operator) {
		result, err := compareQueryValues(left, right, operator, span)
		if err != nil {
			return Value{}, err
		}
		return LogicValue(result), nil
	}
	leftNumber, leftOK := left.Number()
	rightNumber, rightOK := right.Number()
	if !leftOK || !rightOK {
		return Value{}, errorAt(ErrorType, span, "operator %s expects numbers, got %s and %s", operator, left.Kind(), right.Kind())
	}
	switch operator {
	case "+":
		result, err := e.addNumbers(leftNumber, rightNumber, span)
		if err != nil {
			return Value{}, err
		}
		return ratValue(result), nil
	case "-":
		if err := e.chargeNumbers(span, leftNumber, rightNumber); err != nil {
			return Value{}, err
		}
		return e.finishNumber(new(big.Rat).Sub(leftNumber, rightNumber), span)
	case "*":
		result, err := e.multiplyNumbers(leftNumber, rightNumber, span)
		if err != nil {
			return Value{}, err
		}
		return ratValue(result), nil
	case "/":
		if rightNumber.Sign() == 0 {
			return Value{}, errorAt(ErrorDivideByZero, span, "division by zero")
		}
		result, err := e.divideNumbers(leftNumber, rightNumber, span)
		if err != nil {
			return Value{}, err
		}
		return ratValue(result), nil
	case "%":
		return e.integerRemainder(leftNumber, rightNumber, span)
	case "^":
		return e.power(leftNumber, rightNumber, span)
	default:
		return Value{}, errorAt(ErrorParse, span, "unknown binary operator %q", operator)
	}
}

```

Comparisons return logic using strict equality and exact numeric ordering. Arithmetic
requires numbers and implements exact addition, subtraction, multiplication, division,
remainder, and exponentiation under the numeric work and size bounds.

### Integer remainder

```go
func (e *evaluator) integerRemainder(left, right *big.Rat, span Span) (Value, *FormulaError) {
	if !left.IsInt() || !right.IsInt() {
		return Value{}, errorAt(ErrorType, span, "remainder expects integer operands")
	}
	if right.Sign() == 0 {
		return Value{}, errorAt(ErrorDivideByZero, span, "remainder by zero")
	}
	if err := e.chargeNumbers(span, left, right); err != nil {
		return Value{}, err
	}
	return e.finishNumber(new(big.Rat).SetInt(new(big.Int).Rem(left.Num(), right.Num())), span)
}

```

Remainder accepts integers only, rejects a zero divisor, charges work based on operand
size, and validates the exact integer result through the common numeric guard.

### Bounded exponentiation

```go
func (e *evaluator) power(base, exponent *big.Rat, span Span) (Value, *FormulaError) {
	if !exponent.IsInt() || !exponent.Num().IsInt64() {
		return Value{}, errorAt(ErrorType, span, "power exponent must be an integer")
	}
	power := exponent.Num().Int64()
	if power > int64(e.limits.MaxPower) || power < -int64(e.limits.MaxPower) {
		return Value{}, limitError(span, "power")
	}
	abs := power
	if abs < 0 {
		abs = -abs
	}
	if power < 0 && base.Sign() == 0 {
		return Value{}, errorAt(ErrorDivideByZero, span, "zero cannot be raised to a negative power")
	}
	numeratorBits, denominatorBits := base.Num().BitLen(), base.Denom().BitLen()
	if power < 0 {
		numeratorBits, denominatorBits = denominatorBits, numeratorBits
	}
	if productExceeds(numeratorBits, abs, e.limits.MaxNumberBits) || productExceeds(denominatorBits, abs, e.limits.MaxNumberBits) {
		return Value{}, limitError(span, "number_bits")
	}
	estimatedBits := max(int64(numeratorBits)*abs, int64(denominatorBits)*abs)
	if err := e.charge(span, int(abs)+1+int(estimatedBits/256)); err != nil {
		return Value{}, err
	}
	numerator := new(big.Int).Exp(base.Num(), big.NewInt(abs), nil)
	denominator := new(big.Int).Exp(base.Denom(), big.NewInt(abs), nil)
	result := new(big.Rat).SetFrac(numerator, denominator)
	if power < 0 {
		result.Inv(result)
	}
	return e.finishNumber(result, span)
}

```

Power requires an integer exponent representable as `int64`, constrains its magnitude,
rejects zero to a negative power, and preflights numerator and denominator growth before
allocating exponentiation results. Its work charge scales with both exponent and
estimated output size, and negative powers invert the exact rational result.

### Field selection

```go
func (e *evaluator) evalField(target Value, field string, span Span) (Value, *FormulaError) {
	if target.Kind() != KindRecord && target.Kind() != KindTable {
		return Value{}, errorAt(ErrorType, span, "field access expects record or table, got %s", target.Kind())
	}
	value, ok := target.Field(field)
	if !ok {
		return Value{}, errorAt(ErrorUnknownField, span, "unknown field %q", field)
	}
	return value, nil
}

```

Dot access works only on records and tables. Records yield the selected cell; tables
yield the selected column as a list, and missing fields retain their own stable error
kind.

### Index dispatch

```go
func (e *evaluator) evalIndex(target, index Value, span Span) (Value, *FormulaError) {
	switch target.Kind() {
	case KindList:
		items, _ := target.Items()
		position, err := collectionIndex(index, len(items), span)
		if err != nil {
			return Value{}, err
		}
		return items[position], nil
	case KindTable:
		table, _ := target.Table()
		position, err := collectionIndex(index, table.Shape().Rows, span)
		if err != nil {
			return Value{}, err
		}
		record, recordErr := RecordValue(table.fields, table.row(position))
		if recordErr != nil {
			return Value{}, errorAt(ErrorInvalidTable, span, "%v", recordErr)
		}
		return record, nil
	case KindRecord:
		return Value{}, errorAt(ErrorInvalidIndex, span, "records do not support indexing; use .field to read a field")
	default:
		return Value{}, errorAt(ErrorType, span, "indexing expects list or table, got %s", target.Kind())
	}
}

```

Indexing is now purely positional. A numeric index selects a list item or converts a
table row into a record; a non-number index (text, logic, …) fails as `invalid_index`
through `collectionIndex`. Records are not indexable at all — field access is `.field`
only — so `record[...]` is rejected outright. Field-by-name in brackets no longer
exists; `["text"]` and `[identifier]` are gone.

### One-based collection indexes

```go
func collectionIndex(index Value, length int, span Span) (int, *FormulaError) {
	number, ok := index.Number()
	if !ok || !number.IsInt() || !number.Num().IsInt64() {
		return 0, errorAt(ErrorInvalidIndex, span, "collection index must be a non-zero integer")
	}
	requested := number.Num().Int64()
	if requested == 0 {
		return 0, errorAt(ErrorInvalidIndex, span, "collection indexes are one-based; zero is invalid")
	}
	position := requested - 1
	if requested < 0 {
		position = int64(length) + requested
	}
	if position < 0 || position >= int64(length) {
		return 0, errorAt(ErrorIndexOutOfRange, span, "index %d is outside a collection of length %d", requested, length)
	}
	return int(position), nil
}

```

Collection indexes must be nonzero integers. Positive positions are one-based, negative
positions count back from the end, and resolved positions are range-checked before
access.

### List and table slicing

```go
func (e *evaluator) evalSlice(target Value, startValue, endValue *Value, span Span) (Value, *FormulaError) {
	var length int
	switch target.Kind() {
	case KindList:
		length = target.Shape().Rows
	case KindTable:
		length = target.Shape().Rows
	default:
		return Value{}, errorAt(ErrorType, span, "slicing expects list or table, got %s", target.Kind())
	}
	start, err := sliceBoundary(startValue, length, false, span)
	if err != nil {
		return Value{}, err
	}
	end, err := sliceBoundary(endValue, length, true, span)
	if err != nil {
		return Value{}, err
	}
	if end < start {
		end = start
	}
	if target.Kind() == KindList {
		items, _ := target.Items()
		if err := e.charge(span, end-start); err != nil {
			return Value{}, err
		}
		return ListValue(items[start:end]), nil
	}
	table, _ := target.Table()
	if err := e.charge(span, (end-start)*max(1, len(table.fields))); err != nil {
		return Value{}, err
	}
	value, tableErr := TableValue(table.fields, table.rows[start:end])
	if tableErr != nil {
		return Value{}, errorAt(ErrorInvalidTable, span, "%v", tableErr)
	}
	return value, nil
}

```

Slicing applies only to list rows or table rows, normalizes optional bounds, turns
reversed ranges into empty results, and preserves the target's structured kind. Copy
work and table cell work are charged before constructing the result.

### The evaluator evalProjection operation

```go
func (e *evaluator) evalProjection(target Value, fields []FieldName, span Span) (Value, *FormulaError) {
	if target.Kind() != KindRecord && target.Kind() != KindTable {
		return Value{}, errorAt(ErrorType, span, "projection expects record or table, got %s", target.Kind())
	}
	table, _ := target.Table()
	columns := make([]int, len(fields))
	names := make([]string, len(fields))
	for i, field := range fields {
		column, ok := table.index[field.Name]
		if !ok {
			return Value{}, errorAt(ErrorUnknownField, field.Span, "unknown field %q", field.Name)
		}
		columns[i] = column
		names[i] = field.Name
	}
	if err := e.charge(span, len(fields)); err != nil {
		return Value{}, err
	}
	rows := make([][]Value, len(table.rows))
	for row := range table.rows {
		rows[row] = make([]Value, len(columns))
		for i, column := range columns {
			rows[row][i] = table.rows[row][column].clone()
		}
	}
	if err := e.charge(span, len(rows)*max(1, len(fields))); err != nil {
		return Value{}, err
	}
	if target.Kind() == KindRecord {
		value, err := RecordValue(names, rows[0])
		if err != nil {
			return Value{}, errorAt(ErrorInvalidTable, span, "%v", err)
		}
		return value, nil
	}
	value, err := TableValue(names, rows)
	if err != nil {
		return Value{}, errorAt(ErrorInvalidTable, span, "%v", err)
	}
	return value, nil
}

```

`evalProjection` resolves all static fields and copies cells in requested order. It
preserves record/table kind and row order and charges resolution and materialization.

### The evaluator evalQuery operation

```go
func (e *evaluator) evalQuery(target Value, predicate *Node, span Span, depth int) (Value, *FormulaError) {
	if target.Kind() != KindRecord && target.Kind() != KindTable {
		return Value{}, errorAt(ErrorType, span, "query expects record or table, got %s", target.Kind())
	}
	table, _ := target.Table()
	// Inside the query, an identifier resolves to a row field first (SQL-style)
	// and falls back to a binding only when no such field exists — so a comparison
	// can name two columns of the same row. The comparison sides are therefore
	// evaluated per row rather than once. Nested queries save and restore the
	// previous scope.
	scope := &queryRowScope{index: table.index}
	previous := e.rowScope
	e.rowScope = scope
	defer func() { e.rowScope = previous }()

	rows := make([][]Value, 0, len(table.rows))
	for _, row := range table.rows {
		scope.row = row
		match, matchErr := e.matchPredicate(predicate, depth)
		if matchErr != nil {
			return Value{}, matchErr
		}
		if match {
			rows = append(rows, cloneValues(row))
		}
	}
	if err := e.charge(span, len(rows)*max(1, len(table.fields))); err != nil {
		return Value{}, err
	}
	value, tableErr := TableValue(table.fields, rows)
	if tableErr != nil {
		return Value{}, errorAt(ErrorInvalidTable, span, "%v", tableErr)
	}
	return value, nil
}

// matchPredicate evaluates the predicate tree against the row currently in
// e.rowScope. A comparison leaf costs a step, so per-row work stays bounded; &&
// and || short-circuit. The tree depth is bounded by validateExpression (which
// runs before evaluation), so this recursion is bounded too.
func (e *evaluator) matchPredicate(node *Node, depth int) (bool, *FormulaError) {
	switch node.Type {
	case NodePredCompare:
		if err := e.charge(node.Span, 1); err != nil {
			return false, err
		}
		left, err := e.resolveIdentifier(node.Name, node.Span, depth)
		if err != nil {
			return false, err
		}
		right, err := e.eval(node.Right, depth+1)
		if err != nil {
			return false, err
		}
		return compareQueryValues(left, right, node.Operator, node.Span)
	case NodePredAnd:
		left, err := e.matchPredicate(node.Left, depth)
		if err != nil || !left {
			return false, err
		}
		return e.matchPredicate(node.Right, depth)
	case NodePredOr:
		left, err := e.matchPredicate(node.Left, depth)
		if err != nil || left {
			return left, err
		}
		return e.matchPredicate(node.Right, depth)
	case NodePredXor:
		left, err := e.matchPredicate(node.Left, depth)
		if err != nil {
			return false, err
		}
		right, rerr := e.matchPredicate(node.Right, depth)
		if rerr != nil {
			return false, rerr
		}
		return left != right, nil
	case NodePredNot:
		inner, err := e.matchPredicate(node.Target, depth)
		if err != nil {
			return false, err
		}
		return !inner, nil
	default:
		return false, errorAt(ErrorParse, node.Span, "unsupported query predicate node %q", node.Type)
	}
}

// resolveOptional resolves an identifier without erroring when it is absent:
// function scope (lexical) first, then the current query row, then the root
// resolver. It returns found=false when nothing matches.
func (e *evaluator) resolveOptional(name string, span Span, depth int) (Value, bool, *FormulaError) {
	for s := e.scope; s != nil; s = s.parent {
		if value, ok := s.names[name]; ok {
			if err := e.admitValue(value, span, depth); err != nil {
				return Value{}, false, err
			}
			return value.clone(), true, nil
		}
	}
	if e.rowScope != nil {
		if pos, ok := e.rowScope.index[name]; ok {
			value := e.rowScope.row[pos]
			if err := e.admitValue(value, span, depth); err != nil {
				return Value{}, false, err
			}
			return value.clone(), true, nil
		}
	}
	if e.resolver != nil {
		value, ok, rerr := e.resolver.Resolve(name)
		if rerr != nil {
			return Value{}, false, errorAt(ErrorUnknownIdentifier, span, "resolve %q: %v", name, rerr)
		}
		if ok {
			if err := e.admitValue(value, span, depth); err != nil {
				return Value{}, false, err
			}
			return value.clone(), true, nil
		}
	}
	return Value{}, false, nil
}

// makeFunction builds a function value from a NodeFunction, capturing the
// current lexical scope and the exact source text (for display and equality).
func (e *evaluator) makeFunction(node *Node) Value {
	params := make([]string, len(node.Params))
	for i, param := range node.Params {
		params[i] = param.Name
	}
	return Value{kind: KindFunction, fn: &functionValue{
		params:   params,
		body:     node.Target,
		source:   node.Source,
		captured: e.scope,
	}}
}

// apply calls a function value with already-evaluated arguments. It charges one
// step and evaluates the body one level deeper, so recursion terminates against
// MaxSteps and MaxDepth. Parameters bind in a new frame over the function's
// captured scope, so closures are lexical.
func (e *evaluator) apply(fn Value, args []Value, span Span, depth int) (Value, *FormulaError) {
	if fn.Kind() != KindFunction || fn.fn == nil {
		return Value{}, errorAt(ErrorType, span, "value of kind %s is not callable", fn.Kind())
	}
	if len(args) != len(fn.fn.params) {
		return Value{}, errorAt(ErrorWrongArity, span, "function expects %d argument(s), got %d", len(fn.fn.params), len(args))
	}
	if err := e.charge(span, 1); err != nil {
		return Value{}, err
	}
	names := make(map[string]Value, len(fn.fn.params))
	for i, param := range fn.fn.params {
		names[param] = args[i]
	}
	previous := e.scope
	e.scope = &scope{names: names, parent: fn.fn.captured}
	defer func() { e.scope = previous }()
	return e.eval(fn.fn.body, depth+1)
}

// resolveIdentifier resolves a bare identifier or reports unknown_identifier.
func (e *evaluator) resolveIdentifier(name string, span Span, depth int) (Value, *FormulaError) {
	value, ok, err := e.resolveOptional(name, span, depth)
	if err != nil {
		return Value{}, err
	}
	if !ok {
		return Value{}, errorAt(ErrorUnknownIdentifier, span, "unknown identifier %q", name)
	}
	return value, nil
}

```

`evalQuery` runs the boolean query with **field-first** resolution: it points
`e.rowScope` at each row in turn and keeps the rows for which `matchPredicate`
returns true, returning a same-schema table in source order. `matchPredicate` walks
the predicate tree against the current row — resolving a leaf's left field and
evaluating its right-hand expression against that row (`&&`/`||` short-circuit, `^`
is operand inequality, `!` negates), charging a step per comparison.

`resolveOptional` is the one place identifier lookup actually happens: it tries, in
order, the function-scope chain (innermost frame outward, so a parameter shadows an
enclosing one), the current query row, and finally the root resolver — returning
`found=false` rather than an error when nothing matches, so callers that want to try a
name without committing to `unknown_identifier` (namely `evalCall`'s user-function
path) can do so. A resolver error is folded into `unknown_identifier` rather than
surfaced as its own kind, keeping the error contract stable regardless of resolver
implementation. `resolveIdentifier` — used by ordinary `NodeName` evaluation and by
query predicate leaves — is now a thin wrapper that turns a `resolveOptional` miss into
`unknown_identifier`. This is what lets a query compare two columns of the same row
(`spent > budget`) as well as a column to a variable, and a function body reference a
parameter, an enclosing closure's parameter, a query row's field, or a resolver name,
all through one lookup path, with no sigil. Because the right-hand side of a query
comparison may reference a column, it is evaluated per row rather than once; the step
budget keeps that bounded, and the tree depth was already bounded by
`validateExpression`.

`makeFunction` turns a `NodeFunction` into a `KindFunction` value: it copies the
parameter names in order, copies the exact defining source text out of `node.Source`
(what `String()` and `Equal` use — captured once by the parser at parse time, in
`syntax.go`'s `parseFunction`, rather than sliced here out of a source string), and —
critically — captures `e.scope` as the function's `captured` scope. That capture is
what makes the closure lexical: whatever scope chain was active at the point
`FUNCTION`/`LAMBDA` was evaluated is preserved inside the value, independent of where
the value is later called from. Reading `node.Source` rather than slicing `e.source`
by span matters for a *nested* function: an inner `NodeFunction`'s value is only
built when the outer function is applied, which can happen under a different
top-level evaluation source than the one the inner node was originally parsed from
(for example, a function resolved through a `Resolver` and applied from another
expression) — slicing the inner node's span out of that different source would index
the wrong string, silently corrupting `String()`/`Equal`/`MarshalJSON` for the inner
closure. Because the node's span was assigned by the parser against the same source
its `Source` field was sliced from, no bounds guard is needed here.

`apply` is the one path through which a function value is invoked, whether from
`NodeApply` (postfix `(...)`) or from `evalCall`'s user-function branch in
`functions.go`. It checks kind and arity up front (`type_error`/`wrong_arity`),
charges exactly one step per application (so recursion is bounded by `MaxSteps`) and
delegates to `e.eval` at `depth+1` (so recursion is bounded by `MaxDepth`), then swaps
in a fresh scope frame — parameters bound to the call's arguments, chained onto the
function's own `captured` scope, not onto the caller's current scope — before
evaluating the body and restoring the previous scope via `defer`. Chaining onto
`captured` rather than the live scope is what keeps a closure's free identifiers bound
to its definition site even when it is invoked from deep inside another function's
call stack.

### The compareQueryValues operation

```go
func compareQueryValues(left, right Value, operator string, span Span) (bool, *FormulaError) {
	switch operator {
	case "=":
		return left.Equal(right), nil
	case "!=":
		return !left.Equal(right), nil
	}
	if left.Kind() == KindNull || right.Kind() == KindNull {
		return false, nil
	}
	leftNumber, leftOK := left.Number()
	rightNumber, rightOK := right.Number()
	if !leftOK || !rightOK {
		return false, errorAt(ErrorType, span, "query ordering expects numbers, got %s and %s", left.Kind(), right.Kind())
	}
	comparison := leftNumber.Cmp(rightNumber)
	switch operator {
	case "<":
		return comparison < 0, nil
	case "<=":
		return comparison <= 0, nil
	case ">":
		return comparison > 0, nil
	case ">=":
		return comparison >= 0, nil
	default:
		return false, errorAt(ErrorParse, span, "query operator %q is not supported", operator)
	}
}

```

`compareQueryValues` provides deep typed equality and number-only ordering. Null never
matches ordering; another non-number ordering operand is `type_error`.

### The evaluator evalPromote operation

```go
func (e *evaluator) evalPromote(target Value, span Span) (Value, *FormulaError) {
	if target.Kind() == KindRecord {
		return target.clone(), nil
	}
	if target.Kind() != KindTable {
		return Value{}, errorAt(ErrorType, span, "promotion expects record or table, got %s", target.Kind())
	}
	table, _ := target.Table()
	if len(table.rows) != 1 {
		return Value{}, errorAt(ErrorCardinality, span, "promotion expects exactly one row, got %d", len(table.rows))
	}
	value, err := RecordValue(table.fields, table.row(0))
	if err != nil {
		return Value{}, errorAt(ErrorInvalidTable, span, "%v", err)
	}
	return value, nil
}

```

`evalPromote` copies a record or converts an exactly-one-row table to a record. Other
table cardinalities produce `cardinality_error`; other value kinds produce `type_error`.

### The evaluator evalOptional operation

```go
func (e *evaluator) evalOptional(target Value, span Span) (Value, *FormulaError) {
	if target.Kind() == KindRecord {
		return target.clone(), nil
	}
	if target.Kind() != KindTable {
		return Value{}, errorAt(ErrorType, span, "optional promotion expects record or table, got %s", target.Kind())
	}
	table, _ := target.Table()
	if len(table.rows) == 0 {
		return NullValue(), nil
	}
	if len(table.rows) != 1 {
		return Value{}, errorAt(ErrorCardinality, span, "optional promotion expects at most one row, got %d", len(table.rows))
	}
	value, err := RecordValue(table.fields, table.row(0))
	if err != nil {
		return Value{}, errorAt(ErrorInvalidTable, span, "%v", err)
	}
	return value, nil
}

```

`evalOptional` copies a record, returns `null` for an empty table, and converts a
one-row table to a record. A multi-row table produces `cardinality_error`, while other
value kinds produce `type_error`.

### Slice-bound normalization

```go
func sliceBoundary(value *Value, length int, end bool, span Span) (int, *FormulaError) {
	if value == nil {
		if end {
			return length, nil
		}
		return 0, nil
	}
	number, ok := value.Number()
	if !ok || !number.IsInt() || !number.Num().IsInt64() {
		return 0, errorAt(ErrorInvalidIndex, span, "slice bounds must be non-zero integers")
	}
	requested := number.Num().Int64()
	if requested == 0 {
		return 0, errorAt(ErrorInvalidIndex, span, "slice bounds are one-based; zero is invalid")
	}
	var position int64
	if requested > 0 {
		position = requested - 1
	} else {
		position = int64(length) + requested
	}
	position = max(int64(0), min(position, int64(length)))
	return int(position), nil
}

```

A missing start means the first row and a missing end means the length. Explicit bounds
use the same nonzero one-based/negative convention as indexes, then clamp to the
collection so slices remain safe and deterministic.

### Recursive value admission

```go
func (e *evaluator) admitValue(value Value, span Span, depth int) *FormulaError {
	size, err := e.inspectValue(value, span, depth)
	if err != nil {
		return err
	}
	if size > e.limits.MaxOutputBytes {
		return limitError(span, "output_bytes")
	}
	return nil
}

```

`admitValue` delegates to recursive inspection and compares its conservative
display-size bound with `MaxOutputBytes`. This single gate is used for bindings,
literals, intermediate collections and calls, and the final result.

### Recursive shape and output inspection

```go
func (e *evaluator) inspectValue(value Value, span Span, depth int) (int, *FormulaError) {
	if depth > e.limits.MaxDepth {
		return 0, limitError(span, "value_depth")
	}
	switch value.Kind() {
	case KindNull:
		return 4, nil
	case KindLogic:
		return 5, nil
	case KindNumber:
		if value.number == nil {
			return 0, errorAt(ErrorNumeric, span, "number has no payload")
		}
		if err := e.checkNumber(value.number, span); err != nil {
			return 0, err
		}
		if err := e.chargeNumbers(span, value.number); err != nil {
			return 0, err
		}
		return estimatedNumberBytes(value.number), nil
	case KindText:
		text, _ := value.Text()
		return 2 + escapedSizeBound(text), nil
	case KindList, KindRecord, KindTable:
		if value.table == nil {
			return 0, errorAt(ErrorInvalidTable, span, "%s value has no table payload", value.Kind())
		}
		table := value.table
		shape := table.Shape()
		if shape.Fields > e.limits.MaxFields {
			return 0, limitError(span, "fields")
		}
		if shape.Rows > e.limits.MaxRows {
			return 0, limitError(span, "rows")
		}
		cells := shape.Fields * shape.Rows
		if cells > e.limits.MaxCells {
			return 0, limitError(span, "cells")
		}
		if err := e.charge(span, shape.Rows*max(1, shape.Fields)); err != nil {
			return 0, err
		}
		if value.Kind() == KindList && (shape.Fields != 1 || table.fields[0] != "value") {
			return 0, errorAt(ErrorInvalidTable, span, "list must have the single field %q", "value")
		}
		if value.Kind() == KindRecord && shape.Rows != 1 {
			return 0, errorAt(ErrorInvalidTable, span, "record must have exactly one row")
		}
		size := 2
		if value.Kind() == KindTable {
			size = 7
		}
		for _, field := range table.fields {
			if err := growSize(&size, len(field)+2, e.limits.MaxOutputBytes, span); err != nil {
				return 0, err
			}
		}
		for rowIndex, row := range table.rows {
			if rowIndex > 0 {
				if err := growSize(&size, 2, e.limits.MaxOutputBytes, span); err != nil {
					return 0, err
				}
			}
			if value.Kind() == KindTable {
				if err := growSize(&size, 2, e.limits.MaxOutputBytes, span); err != nil {
					return 0, err
				}
			}
			for column, cell := range row {
				if column > 0 {
					if err := growSize(&size, 2, e.limits.MaxOutputBytes, span); err != nil {
						return 0, err
					}
				}
				if value.Kind() != KindList {
					if err := growSize(&size, len(table.fields[column])+2, e.limits.MaxOutputBytes, span); err != nil {
						return 0, err
					}
				}
				cellSize, err := e.inspectValue(cell, span, depth+1)
				if err != nil {
					return 0, err
				}
				if err := growSize(&size, cellSize, e.limits.MaxOutputBytes, span); err != nil {
					return 0, err
				}
			}
			if value.Kind() == KindTable {
				if err := growSize(&size, 1, e.limits.MaxOutputBytes, span); err != nil {
					return 0, err
				}
			}
		}
		return size, nil
	case KindFunction:
		if value.fn == nil {
			return 0, errorAt(ErrorType, span, "function value has no payload")
		}
		return 2 + escapedSizeBound(value.fn.source), nil
	default:
		return 0, errorAt(ErrorType, span, "invalid value kind %q", value.Kind())
	}
}

```

`inspectValue` validates value depth, exact numbers, UTF-8-backed text size, table
payloads, dimensions, and list/record carrier invariants while charging traversal work.
It recursively builds a conservative upper bound for the value's deterministic display
form, including field names, separators, row wrappers, and nested cells. A function
value's display bound is its exact source text (escaped-size bound), since `String()`
renders it verbatim rather than through the table-shaped machinery.

### Overflow-safe size accumulation

```go
func growSize(total *int, amount, limit int, span Span) *FormulaError {
	if amount < 0 || amount > limit-*total {
		return limitError(span, "output_bytes")
	}
	*total += amount
	return nil
}

```

`growSize` adds display-size components without overflowing `int` or crossing the
configured output ceiling. Every structured separator, field, and nested value uses this
common guard.

### Work accounting

```go
func (e *evaluator) charge(span Span, work int) *FormulaError {
	if work < 0 || work > e.limits.MaxSteps-e.steps {
		return limitError(span, "evaluation_steps")
	}
	e.steps += work
	return nil
}

```

`charge` safely adds deterministic units to the evaluation counter. It avoids
overflow-prone addition and returns a named limit error before work can exceed the
configured budget.

### Scalar output-size estimates

```go
func estimatedNumberBytes(number *big.Rat) int {
	if number == nil {
		return 0
	}
	size := decimalDigitsUpper(number.Num().BitLen()) + number.Denom().BitLen() + 2
	if number.Sign() < 0 {
		size++
	}
	return size
}

```

These helpers conservatively bound scalar display sizes without rendering them. Rational
estimates cover both repeating fractions and terminating decimals from large
power-of-two denominators; decimal digit conversion and worst-case quoted-text escaping
remain overflow-safe.

### The decimalDigitsUpper operation

```go
func decimalDigitsUpper(bits int) int {
	if bits <= 1 {
		return 1
	}
	return bits*30103/100000 + 1
}

```

This block implements decimalDigitsUpper as one bounded part of Formula parsing or evaluation.

### The escapedSizeBound operation

```go
func escapedSizeBound(text string) int {
	const maxInt = int(^uint(0) >> 1)
	if len(text) > maxInt/6 {
		return maxInt
	}
	return len(text) * 6
}

```

This block implements escapedSizeBound as one bounded part of Formula parsing or evaluation.

### Bounded numeric helpers

```go
func (e *evaluator) addNumbers(left, right *big.Rat, span Span) (*big.Rat, *FormulaError) {
	if err := e.chargeNumbers(span, left, right); err != nil {
		return nil, err
	}
	result := new(big.Rat).Add(left, right)
	if err := e.checkNumber(result, span); err != nil {
		return nil, err
	}
	return result, nil
}

```

The numeric helpers make arbitrary-precision arithmetic resource-safe. Addition,
multiplication, and division charge by operand bit length, preflight predictable growth,
and validate every result; shared finish/check helpers enforce both number-bit and
output ceilings, while `productExceeds` performs overflow-safe exponent-growth tests.

### The evaluator multiplyNumbers operation

```go
func (e *evaluator) multiplyNumbers(left, right *big.Rat, span Span) (*big.Rat, *FormulaError) {
	if err := e.chargeNumbers(span, left, right); err != nil {
		return nil, err
	}
	if left.Num().BitLen()+right.Num().BitLen() > e.limits.MaxNumberBits || left.Denom().BitLen()+right.Denom().BitLen() > e.limits.MaxNumberBits {
		return nil, limitError(span, "number_bits")
	}
	result := new(big.Rat).Mul(left, right)
	if err := e.checkNumber(result, span); err != nil {
		return nil, err
	}
	return result, nil
}

```

This block implements evaluator multiplyNumbers as one bounded part of Formula parsing or evaluation.

### The evaluator divideNumbers operation

```go
func (e *evaluator) divideNumbers(left, right *big.Rat, span Span) (*big.Rat, *FormulaError) {
	if err := e.chargeNumbers(span, left, right); err != nil {
		return nil, err
	}
	if left.Num().BitLen()+right.Denom().BitLen() > e.limits.MaxNumberBits || left.Denom().BitLen()+right.Num().BitLen() > e.limits.MaxNumberBits {
		return nil, limitError(span, "number_bits")
	}
	result := new(big.Rat).Quo(left, right)
	if err := e.checkNumber(result, span); err != nil {
		return nil, err
	}
	return result, nil
}

```

This block implements evaluator divideNumbers as one bounded part of Formula parsing or evaluation.

### The evaluator finishNumber operation

```go
func (e *evaluator) finishNumber(number *big.Rat, span Span) (Value, *FormulaError) {
	if err := e.checkNumber(number, span); err != nil {
		return Value{}, err
	}
	return ratValue(number), nil
}

```

This block implements evaluator finishNumber as one bounded part of Formula parsing or evaluation.

### The evaluator checkNumber operation

```go
func (e *evaluator) checkNumber(number *big.Rat, span Span) *FormulaError {
	if number == nil {
		return errorAt(ErrorNumeric, span, "number has no payload")
	}
	if number.Num().BitLen() > e.limits.MaxNumberBits || number.Denom().BitLen() > e.limits.MaxNumberBits {
		return limitError(span, "number_bits")
	}
	if estimatedNumberBytes(number) > e.limits.MaxOutputBytes {
		return limitError(span, "output_bytes")
	}
	return nil
}

```

This block implements evaluator checkNumber as one bounded part of Formula parsing or evaluation.

### The evaluator chargeNumbers operation

```go
func (e *evaluator) chargeNumbers(span Span, numbers ...*big.Rat) *FormulaError {
	bits := 0
	for _, number := range numbers {
		if err := e.checkNumber(number, span); err != nil {
			return err
		}
		bits = max(bits, number.Num().BitLen(), number.Denom().BitLen())
	}
	return e.charge(span, 1+bits/256)
}

```

This block implements evaluator chargeNumbers as one bounded part of Formula parsing or evaluation.

### The productExceeds operation

```go
func productExceeds(bits int, multiplier int64, limit int) bool {
	if bits == 0 || multiplier == 0 {
		return false
	}
	return multiplier > int64(limit/bits)
}
```

This block implements productExceeds as one bounded part of Formula parsing or evaluation.
