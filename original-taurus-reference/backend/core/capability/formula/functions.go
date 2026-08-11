package formula

import "math/big"

func (e *evaluator) evalCall(node *Node, depth int) (Value, *FormulaError) {
	name := upperASCII(node.Name)
	if !isBuiltinCall(name) {
		fn, found, err := e.resolveOptional(node.Name, node.Span, depth)
		if err != nil {
			return Value{}, err
		}
		if !found {
			return Value{}, errorAt(ErrorUnknownFunction, node.Span, "unknown function %q", node.Name)
		}
		if fn.Kind() != KindFunction {
			return Value{}, errorAt(ErrorType, node.Span, "%q is not a function", node.Name)
		}
		args := make([]Value, len(node.Args))
		for i, arg := range node.Args {
			value, argErr := e.eval(arg, depth)
			if argErr != nil {
				return Value{}, argErr
			}
			args[i] = value
		}
		return e.apply(fn, args, node.Span, depth)
	}
	if err := validateCall(name, len(node.Args), node.Span); err != nil {
		return Value{}, err
	}
	if name == "IF" {
		condition, err := e.eval(node.Args[0], depth)
		if err != nil {
			return Value{}, err
		}
		logic, ok := condition.Logic()
		if !ok {
			return Value{}, errorAt(ErrorType, node.Args[0].Span, "IF condition must be logic, got %s", condition.Kind())
		}
		branch := node.Args[2]
		if logic {
			branch = node.Args[1]
		}
		return e.eval(branch, depth)
	}
	args := make([]Value, len(node.Args))
	for i, arg := range node.Args {
		value, err := e.eval(arg, depth)
		if err != nil {
			return Value{}, err
		}
		args[i] = value
	}
	switch name {
	case "SUM":
		return e.sum(args, node.Span)
	case "PRODUCT":
		return e.product(args, node.Span)
	case "MIN":
		return e.minimum(args, node.Span)
	case "MAX":
		return e.maximum(args, node.Span)
	case "AVG", "AVERAGE":
		return e.average(args, node.Span)
	case "COUNT":
		return e.count(args, node.Span)
	case "ABS":
		return e.absolute(args, node.Span)
	case "MOD":
		return e.modulo(args, node.Span)
	case "POWER", "POW":
		return e.powerFunction(args, node.Span)
	case "ROUND":
		return e.round(args, node.Span)
	case "FLOOR":
		return e.floor(args, node.Span)
	case "CEIL", "CEILING":
		return e.ceiling(args, node.Span)
	case "TABLE":
		return e.table(args, node.Span)
	case "ROWS":
		return e.rows(args, node.Span)
	case "COLUMNS":
		return e.columns(args, node.Span)
	default:
		return Value{}, errorAt(ErrorUnknownFunction, node.Span, "unknown function %q", node.Name)
	}
}

// isBuiltinCall reports whether an (already upper-cased) call name is a builtin.
// A non-builtin name is a user-function application resolved from scope or the
// resolver. FUNCTION/LAMBDA never reach here (they parse to NodeFunction).
func isBuiltinCall(name string) bool {
	switch name {
	case "SUM", "PRODUCT", "MIN", "MAX", "AVG", "AVERAGE", "COUNT", "ABS", "MOD",
		"POWER", "POW", "ROUND", "FLOOR", "CEIL", "CEILING", "TABLE", "ROWS", "COLUMNS", "IF":
		return true
	default:
		return false
	}
}

// IsReservedName reports whether s collides with a Formula builtin or keyword,
// case-insensitively. A name manager rejects such names so, for example, SUM
// always means the builtin and null always means the literal.
func IsReservedName(s string) bool {
	upper := upperASCII(s)
	if isBuiltinCall(upper) || upper == "FUNCTION" || upper == "LAMBDA" {
		return true
	}
	switch lowerASCII(s) {
	case "true", "false", "null":
		return true
	default:
		return false
	}
}

func validateCall(name string, count int, span Span) *FormulaError {
	switch name {
	case "SUM", "PRODUCT", "COUNT", "TABLE":
		return nil
	case "MIN", "MAX", "AVG", "AVERAGE":
		if count < 1 {
			return errorAt(ErrorWrongArity, span, "%s expects at least 1 argument", name)
		}
		return nil
	case "ABS", "FLOOR", "CEIL", "CEILING", "ROWS", "COLUMNS":
		if count != 1 {
			return errorAt(ErrorWrongArity, span, "%s expects 1 argument, got %d", name, count)
		}
		return nil
	case "MOD", "POWER", "POW":
		if count != 2 {
			return errorAt(ErrorWrongArity, span, "%s expects 2 arguments, got %d", name, count)
		}
		return nil
	case "ROUND":
		if count < 1 || count > 2 {
			return errorAt(ErrorWrongArity, span, "ROUND expects 1 or 2 arguments, got %d", count)
		}
		return nil
	case "IF":
		if count != 3 {
			return errorAt(ErrorWrongArity, span, "IF expects 3 arguments, got %d", count)
		}
		return nil
	default:
		return errorAt(ErrorUnknownFunction, span, "unknown function %q", name)
	}
}

func (e *evaluator) sum(args []Value, span Span) (Value, *FormulaError) {
	numbers, err := e.collectNumbers(args, span)
	if err != nil {
		return Value{}, err
	}
	total := new(big.Rat)
	for _, number := range numbers {
		total, err = e.addNumbers(total, number, span)
		if err != nil {
			return Value{}, err
		}
	}
	return ratValue(total), nil
}

func (e *evaluator) product(args []Value, span Span) (Value, *FormulaError) {
	numbers, err := e.collectNumbers(args, span)
	if err != nil {
		return Value{}, err
	}
	total := new(big.Rat).SetInt64(1)
	for _, number := range numbers {
		total, err = e.multiplyNumbers(total, number, span)
		if err != nil {
			return Value{}, err
		}
	}
	return ratValue(total), nil
}

func (e *evaluator) minimum(args []Value, span Span) (Value, *FormulaError) {
	numbers, err := e.collectNumbers(args, span)
	if err != nil {
		return Value{}, err
	}
	if len(numbers) == 0 {
		return Value{}, errorAt(ErrorType, span, "MIN needs at least one number")
	}
	minimum := new(big.Rat).Set(numbers[0])
	for _, number := range numbers[1:] {
		if err := e.chargeNumbers(span, minimum, number); err != nil {
			return Value{}, err
		}
		if number.Cmp(minimum) < 0 {
			minimum.Set(number)
		}
	}
	return ratValue(minimum), nil
}

func (e *evaluator) maximum(args []Value, span Span) (Value, *FormulaError) {
	numbers, err := e.collectNumbers(args, span)
	if err != nil {
		return Value{}, err
	}
	if len(numbers) == 0 {
		return Value{}, errorAt(ErrorType, span, "MAX needs at least one number")
	}
	maximum := new(big.Rat).Set(numbers[0])
	for _, number := range numbers[1:] {
		if err := e.chargeNumbers(span, maximum, number); err != nil {
			return Value{}, err
		}
		if number.Cmp(maximum) > 0 {
			maximum.Set(number)
		}
	}
	return ratValue(maximum), nil
}

func (e *evaluator) average(args []Value, span Span) (Value, *FormulaError) {
	numbers, err := e.collectNumbers(args, span)
	if err != nil {
		return Value{}, err
	}
	if len(numbers) == 0 {
		return Value{}, errorAt(ErrorType, span, "AVERAGE needs at least one number")
	}
	total := new(big.Rat)
	for _, number := range numbers {
		total, err = e.addNumbers(total, number, span)
		if err != nil {
			return Value{}, err
		}
	}
	average, err := e.divideNumbers(total, new(big.Rat).SetInt64(int64(len(numbers))), span)
	if err != nil {
		return Value{}, err
	}
	return ratValue(average), nil
}

func (e *evaluator) count(args []Value, span Span) (Value, *FormulaError) {
	count := 0
	for _, arg := range args {
		valueCount, err := e.countValue(arg, span, 1)
		if err != nil {
			return Value{}, err
		}
		count += valueCount
	}
	return integerValue(int64(count)), nil
}

func (e *evaluator) countValue(value Value, span Span, depth int) (int, *FormulaError) {
	if depth > e.limits.MaxDepth {
		return 0, limitError(span, "value_depth")
	}
	if err := e.charge(span, 1); err != nil {
		return 0, err
	}
	switch value.Kind() {
	case KindNull:
		return 0, nil
	case KindList, KindRecord, KindTable:
		table, _ := value.Table()
		total := 0
		for _, row := range table.rows {
			for _, cell := range row {
				count, err := e.countValue(cell, span, depth+1)
				if err != nil {
					return 0, err
				}
				total += count
			}
		}
		return total, nil
	default:
		return 1, nil
	}
}

func (e *evaluator) absolute(args []Value, span Span) (Value, *FormulaError) {
	number, err := oneNumber("ABS", args, span)
	if err != nil {
		return Value{}, err
	}
	if err := e.chargeNumbers(span, number); err != nil {
		return Value{}, err
	}
	return e.finishNumber(new(big.Rat).Abs(number), span)
}

func (e *evaluator) modulo(args []Value, span Span) (Value, *FormulaError) {
	if err := exactArity("MOD", args, 2, span); err != nil {
		return Value{}, err
	}
	left, leftOK := args[0].Number()
	right, rightOK := args[1].Number()
	if !leftOK || !rightOK {
		return Value{}, errorAt(ErrorType, span, "MOD expects two numbers")
	}
	return e.integerRemainder(left, right, span)
}

func (e *evaluator) powerFunction(args []Value, span Span) (Value, *FormulaError) {
	if err := exactArity("POWER", args, 2, span); err != nil {
		return Value{}, err
	}
	base, baseOK := args[0].Number()
	exponent, exponentOK := args[1].Number()
	if !baseOK || !exponentOK {
		return Value{}, errorAt(ErrorType, span, "POWER expects two numbers")
	}
	return e.power(base, exponent, span)
}

func (e *evaluator) round(args []Value, span Span) (Value, *FormulaError) {
	if len(args) < 1 || len(args) > 2 {
		return Value{}, errorAt(ErrorWrongArity, span, "ROUND expects 1 or 2 arguments")
	}
	number, ok := args[0].Number()
	if !ok {
		return Value{}, errorAt(ErrorType, span, "ROUND expects a number")
	}
	places := int64(0)
	if len(args) == 2 {
		placesNumber, ok := args[1].Number()
		if !ok || !placesNumber.IsInt() || !placesNumber.Num().IsInt64() {
			return Value{}, errorAt(ErrorType, span, "ROUND places must be an integer")
		}
		places = placesNumber.Num().Int64()
	}
	if places > int64(e.limits.MaxRoundPlaces) || places < -int64(e.limits.MaxRoundPlaces) {
		return Value{}, limitError(span, "round_places")
	}
	absolutePlaces := places
	if absolutePlaces < 0 {
		absolutePlaces = -absolutePlaces
	}
	factor := new(big.Int).Exp(big.NewInt(10), big.NewInt(absolutePlaces), nil)
	if err := e.chargeNumbers(span, number); err != nil {
		return Value{}, err
	}
	scaled := new(big.Rat).Set(number)
	if places >= 0 {
		scaled.Mul(scaled, new(big.Rat).SetInt(factor))
	} else {
		scaled.Quo(scaled, new(big.Rat).SetInt(factor))
	}
	rounded := roundIntegerAway(scaled)
	result := new(big.Rat).SetInt(rounded)
	if places >= 0 {
		result.Quo(result, new(big.Rat).SetInt(factor))
	} else {
		result.Mul(result, new(big.Rat).SetInt(factor))
	}
	return e.finishNumber(result, span)
}

func (e *evaluator) floor(args []Value, span Span) (Value, *FormulaError) {
	number, err := oneNumber("FLOOR", args, span)
	if err != nil {
		return Value{}, err
	}
	if err := e.chargeNumbers(span, number); err != nil {
		return Value{}, err
	}
	quotient, remainder := new(big.Int), new(big.Int)
	quotient.QuoRem(number.Num(), number.Denom(), remainder)
	if number.Sign() < 0 && remainder.Sign() != 0 {
		quotient.Sub(quotient, big.NewInt(1))
	}
	return e.finishNumber(new(big.Rat).SetInt(quotient), span)
}

func (e *evaluator) ceiling(args []Value, span Span) (Value, *FormulaError) {
	number, err := oneNumber("CEIL", args, span)
	if err != nil {
		return Value{}, err
	}
	if err := e.chargeNumbers(span, number); err != nil {
		return Value{}, err
	}
	quotient, remainder := new(big.Int), new(big.Int)
	quotient.QuoRem(number.Num(), number.Denom(), remainder)
	if number.Sign() > 0 && remainder.Sign() != 0 {
		quotient.Add(quotient, big.NewInt(1))
	}
	return e.finishNumber(new(big.Rat).SetInt(quotient), span)
}

func roundIntegerAway(number *big.Rat) *big.Int {
	quotient, remainder := new(big.Int), new(big.Int)
	quotient.QuoRem(number.Num(), number.Denom(), remainder)
	twiceRemainder := new(big.Int).Lsh(new(big.Int).Abs(remainder), 1)
	if twiceRemainder.Cmp(number.Denom()) >= 0 {
		if number.Sign() < 0 {
			quotient.Sub(quotient, big.NewInt(1))
		} else {
			quotient.Add(quotient, big.NewInt(1))
		}
	}
	return quotient
}

func (e *evaluator) table(args []Value, span Span) (Value, *FormulaError) {
	records := args
	if len(args) == 1 && args[0].Kind() == KindList {
		records, _ = args[0].Items()
	}
	if len(records) > e.limits.MaxRows {
		return Value{}, limitError(span, "rows")
	}
	if len(records) == 0 {
		value, _ := TableValue(nil, nil)
		return value, nil
	}
	fields, first, ok := records[0].Fields()
	if !ok {
		return Value{}, errorAt(ErrorType, span, "TABLE expects records")
	}
	if len(fields) > e.limits.MaxFields {
		return Value{}, limitError(span, "fields")
	}
	rows := make([][]Value, len(records))
	rows[0] = first
	for i, record := range records[1:] {
		recordFields, _, ok := record.Fields()
		if !ok {
			return Value{}, errorAt(ErrorType, span, "TABLE row %d is %s; expected record", i+2, record.Kind())
		}
		if len(recordFields) != len(fields) {
			return Value{}, errorAt(ErrorInvalidTable, span, "TABLE row %d has a different field set", i+2)
		}
		row := make([]Value, len(fields))
		for column, field := range fields {
			value, exists := record.Field(field)
			if !exists {
				return Value{}, errorAt(ErrorInvalidTable, span, "TABLE row %d is missing field %q", i+2, field)
			}
			row[column] = value
		}
		rows[i+1] = row
	}
	if len(fields)*len(rows) > e.limits.MaxCells {
		return Value{}, limitError(span, "cells")
	}
	if err := e.charge(span, len(rows)*max(1, len(fields))); err != nil {
		return Value{}, err
	}
	value, err := TableValue(fields, rows)
	if err != nil {
		return Value{}, errorAt(ErrorInvalidTable, span, "%v", err)
	}
	return value, nil
}

func (e *evaluator) rows(args []Value, span Span) (Value, *FormulaError) {
	if err := exactArity("ROWS", args, 1, span); err != nil {
		return Value{}, err
	}
	return integerValue(int64(args[0].Shape().Rows)), nil
}

func (e *evaluator) columns(args []Value, span Span) (Value, *FormulaError) {
	if err := exactArity("COLUMNS", args, 1, span); err != nil {
		return Value{}, err
	}
	return integerValue(int64(args[0].Shape().Fields)), nil
}

func (e *evaluator) collectNumbers(values []Value, span Span) ([]*big.Rat, *FormulaError) {
	var numbers []*big.Rat
	var visit func(Value, int) *FormulaError
	visit = func(value Value, depth int) *FormulaError {
		if depth > e.limits.MaxDepth {
			return limitError(span, "value_depth")
		}
		if number, ok := value.Number(); ok {
			numbers = append(numbers, number)
			return e.charge(span, 1)
		}
		if value.Kind() == KindNull {
			// Numeric aggregates skip null cells, matching COUNT — e.g.
			// SUM([1, null, 3]) is 4 and AVG([1, null, 3]) is 2. The visit is
			// still charged so an all-null collection remains bounded.
			return e.charge(span, 1)
		}
		if value.Kind() != KindList && value.Kind() != KindRecord && value.Kind() != KindTable {
			return errorAt(ErrorType, span, "expected number, got %s", value.Kind())
		}
		table, _ := value.Table()
		for _, row := range table.rows {
			for _, cell := range row {
				if err := visit(cell, depth+1); err != nil {
					return err
				}
			}
		}
		return nil
	}
	for _, value := range values {
		if err := visit(value, 1); err != nil {
			return nil, err
		}
	}
	return numbers, nil
}

func oneNumber(name string, args []Value, span Span) (*big.Rat, *FormulaError) {
	if err := exactArity(name, args, 1, span); err != nil {
		return nil, err
	}
	number, ok := args[0].Number()
	if !ok {
		return nil, errorAt(ErrorType, span, "%s expects a number", name)
	}
	return number, nil
}

func exactArity(name string, args []Value, count int, span Span) *FormulaError {
	if len(args) != count {
		return errorAt(ErrorWrongArity, span, "%s expects %d arguments, got %d", name, count, len(args))
	}
	return nil
}
