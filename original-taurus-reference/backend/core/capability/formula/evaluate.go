package formula

import "math/big"

// Bindings supplies immutable, request-scoped values for identifiers. Binding
// names and field names are case-sensitive; built-in function names are not.
type Bindings map[string]Value

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

// Evaluate parses and evaluates source with DefaultLimits.
func Evaluate(source string, bindings Bindings) (Value, error) {
	return NewService().Evaluate(source, bindings)
}

// Evaluate parses and evaluates source against exact request-scoped bindings.
func (s *Service) Evaluate(source string, bindings Bindings) (Value, error) {
	expression, err := s.Parse(source)
	if err != nil {
		return Value{}, err
	}
	return s.EvaluateExpression(expression, bindings)
}

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

func growSize(total *int, amount, limit int, span Span) *FormulaError {
	if amount < 0 || amount > limit-*total {
		return limitError(span, "output_bytes")
	}
	*total += amount
	return nil
}

func (e *evaluator) charge(span Span, work int) *FormulaError {
	if work < 0 || work > e.limits.MaxSteps-e.steps {
		return limitError(span, "evaluation_steps")
	}
	e.steps += work
	return nil
}

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

func decimalDigitsUpper(bits int) int {
	if bits <= 1 {
		return 1
	}
	return bits*30103/100000 + 1
}

func escapedSizeBound(text string) int {
	const maxInt = int(^uint(0) >> 1)
	if len(text) > maxInt/6 {
		return maxInt
	}
	return len(text) * 6
}

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

func (e *evaluator) finishNumber(number *big.Rat, span Span) (Value, *FormulaError) {
	if err := e.checkNumber(number, span); err != nil {
		return Value{}, err
	}
	return ratValue(number), nil
}

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

func productExceeds(bits int, multiplier int64, limit int) bool {
	if bits == 0 || multiplier == 0 {
		return false
	}
	return multiplier > int64(limit/bits)
}
