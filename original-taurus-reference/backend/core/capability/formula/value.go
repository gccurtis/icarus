package formula

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"math/big"
	"strconv"
	"strings"
	"unicode/utf8"
)

// Kind identifies one Formula value type.
type Kind string

const (
	KindNull     Kind = "null"
	KindNumber   Kind = "number"
	KindText     Kind = "text"
	KindLogic    Kind = "logic"
	KindList     Kind = "list"
	KindRecord   Kind = "record"
	KindTable    Kind = "table"
	KindFunction Kind = "function"
)

// Shape describes the table-shaped dimensions of a value. Scalars are
// conceptually one field by one row; lists are one field by N rows, records are
// N fields by one row, and tables are N fields by M rows.
type Shape struct {
	Fields int `json:"fields"`
	Rows   int `json:"rows"`
}

// Table is the immutable rectangular carrier shared by list, record, and table
// values. Field names are ordered and unique, every row has exactly the same
// width, and accessors return deep copies.
type Table struct {
	fields []string
	rows   [][]Value
	index  map[string]int
}

// NewTable validates and copies an ordered field/row relation.
func NewTable(fields []string, rows [][]Value) (Table, error) {
	return newTable(fields, rows, Span{})
}

func newTable(fields []string, rows [][]Value, span Span) (Table, error) {
	index := make(map[string]int, len(fields))
	fieldCopy := append([]string(nil), fields...)
	for i, field := range fieldCopy {
		if field == "" {
			return Table{}, errorAt(ErrorInvalidTable, span, "table field %d is empty", i+1)
		}
		if !utf8.ValidString(field) {
			return Table{}, errorAt(ErrorInvalidTable, span, "table field %d is not valid UTF-8", i+1)
		}
		if !validFieldName(field) {
			return Table{}, errorAt(ErrorInvalidTable, span, "table field %q is not a valid name; field names must be identifiers", field)
		}
		if _, exists := index[field]; exists {
			return Table{}, errorAt(ErrorInvalidTable, span, "duplicate table field %q", field)
		}
		index[field] = i
	}
	rowCopy := make([][]Value, len(rows))
	for i, row := range rows {
		if len(row) != len(fieldCopy) {
			return Table{}, errorAt(ErrorInvalidTable, span, "table row %d has %d cells; expected %d", i+1, len(row), len(fieldCopy))
		}
		rowCopy[i] = cloneValues(row)
	}
	return Table{fields: fieldCopy, rows: rowCopy, index: index}, nil
}

// Fields returns the table's ordered field names.
func (t Table) Fields() []string {
	return append([]string(nil), t.fields...)
}

// Rows returns a deep copy of the table's rows.
func (t Table) Rows() [][]Value {
	rows := make([][]Value, len(t.rows))
	for i, row := range t.rows {
		rows[i] = cloneValues(row)
	}
	return rows
}

// Shape returns the table's field and row dimensions.
func (t Table) Shape() Shape {
	return Shape{Fields: len(t.fields), Rows: len(t.rows)}
}

// Field returns a copied column in row order.
func (t Table) Field(name string) ([]Value, bool) {
	i, ok := t.index[name]
	if !ok {
		return nil, false
	}
	values := make([]Value, len(t.rows))
	for row := range t.rows {
		values[row] = t.rows[row][i].clone()
	}
	return values, true
}

func (t Table) row(i int) []Value {
	return cloneValues(t.rows[i])
}

func (t Table) cell(row int, field string) (Value, bool) {
	column, ok := t.index[field]
	if !ok {
		return Value{}, false
	}
	return t.rows[row][column].clone(), true
}

func (t Table) clone() Table {
	cloned, _ := newTable(t.fields, t.rows, Span{})
	return cloned
}

// Value is one immutable Formula value. Structured values carry the common
// table-shaped representation described by Shape; scalar payloads stay typed
// and cannot be silently coerced.
type Value struct {
	kind   Kind
	number *big.Rat
	text   string
	logic  bool
	table  *Table
	fn     *functionValue
}

// NullValue constructs null.
func NullValue() Value { return Value{kind: KindNull} }

// NumberValue parses an exact base-10 integer, decimal, exponent, or
// numerator/denominator spelling into a rational value. Formula arithmetic
// therefore never introduces binary floating-point ambiguity.
func NumberValue(source string) (Value, error) {
	value, err := parseNumberValue(source, DefaultLimits().MaxNumberBits, Span{})
	if err != nil {
		return Value{}, err
	}
	return value, nil
}

func parseNumberValue(source string, maxBits int, span Span) (Value, *FormulaError) {
	zero, err := preflightNumber(source, maxBits, span)
	if err != nil {
		return Value{}, err
	}
	if zero {
		return ratValue(new(big.Rat)), nil
	}
	n, ok := new(big.Rat).SetString(source)
	if !ok {
		return Value{}, errorAt(ErrorNumeric, span, "invalid number %q", source)
	}
	if n.Num().BitLen() > maxBits || n.Denom().BitLen() > maxBits {
		return Value{}, limitError(span, "number_bits")
	}
	return ratValue(n), nil
}

func preflightNumber(source string, maxBits int, span Span) (bool, *FormulaError) {
	if maxBits < 1 {
		maxBits = DefaultLimits().MaxNumberBits
	}
	maxDigits := maxDecimalDigits(maxBits)
	if maxDigits < 1 {
		maxDigits = 1
	}
	if strings.Count(source, "/") == 1 {
		parts := strings.Split(source, "/")
		numerator := strings.TrimPrefix(strings.TrimPrefix(parts[0], "+"), "-")
		denominator := parts[1]
		if !decimalDigits(numerator) || !decimalDigits(denominator) {
			return false, errorAt(ErrorNumeric, span, "invalid number %q", source)
		}
		if strings.Trim(denominator, "0") == "" {
			return false, errorAt(ErrorNumeric, span, "invalid number %q", source)
		}
		if int64(len(strings.TrimLeft(numerator, "0"))) > maxDigits || int64(len(strings.TrimLeft(denominator, "0"))) > maxDigits {
			return false, limitError(span, "number_bits")
		}
		return strings.Trim(numerator, "0") == "", nil
	}

	mantissa := source
	if len(mantissa) > 0 && (mantissa[0] == '+' || mantissa[0] == '-') {
		mantissa = mantissa[1:]
	}
	exponentText := ""
	if i := strings.IndexAny(mantissa, "eE"); i >= 0 {
		exponentText = mantissa[i+1:]
		mantissa = mantissa[:i]
	}
	parts := strings.Split(mantissa, ".")
	if len(parts) > 2 || len(parts) == 0 || !decimalDigits(parts[0]) || len(parts) == 2 && parts[1] != "" && !decimalDigits(parts[1]) {
		return false, errorAt(ErrorNumeric, span, "invalid number %q", source)
	}
	fractionDigits := 0
	digits := parts[0]
	if len(parts) == 2 {
		fractionDigits = len(parts[1])
		digits += parts[1]
	}
	significant := strings.TrimLeft(digits, "0")
	if significant == "" {
		if exponentText != "" && !signedDecimalDigits(exponentText) {
			return false, errorAt(ErrorNumeric, span, "invalid number %q", source)
		}
		return true, nil
	}
	exponent := int64(0)
	if exponentText != "" {
		if !signedDecimalDigits(exponentText) {
			return false, errorAt(ErrorNumeric, span, "invalid number %q", source)
		}
		unsigned := strings.TrimPrefix(strings.TrimPrefix(exponentText, "+"), "-")
		if len(strings.TrimLeft(unsigned, "0")) > 18 {
			return false, limitError(span, "number_bits")
		}
		parsed, parseErr := strconv.ParseInt(exponentText, 10, 64)
		if parseErr != nil {
			return false, limitError(span, "number_bits")
		}
		exponent = parsed
	}
	fraction := int64(fractionDigits)
	if exponent > fraction+maxDigits || exponent < fraction-maxDigits {
		return false, limitError(span, "number_bits")
	}
	scale := fraction - exponent
	numeratorDigits := int64(len(significant))
	if scale < 0 {
		numeratorDigits += -scale
	}
	if numeratorDigits > maxDigits || scale > maxDigits {
		return false, limitError(span, "number_bits")
	}
	return false, nil
}

func decimalDigits(source string) bool {
	if source == "" {
		return false
	}
	for i := range source {
		if source[i] < '0' || source[i] > '9' {
			return false
		}
	}
	return true
}

func signedDecimalDigits(source string) bool {
	if source != "" && (source[0] == '+' || source[0] == '-') {
		source = source[1:]
	}
	return decimalDigits(source)
}

func maxDecimalDigits(bits int) int64 {
	const maxInt64 = int64(^uint64(0) >> 1)
	bits64 := int64(bits)
	if bits64 > maxInt64/30102 {
		return maxInt64
	}
	return max(1, bits64*30102/100000)
}

func ratValue(number *big.Rat) Value {
	if number == nil {
		return Value{kind: KindNumber, number: new(big.Rat)}
	}
	return Value{kind: KindNumber, number: new(big.Rat).Set(number)}
}

func integerValue(number int64) Value {
	return ratValue(new(big.Rat).SetInt64(number))
}

// TextValue constructs valid UTF-8 text.
func TextValue(text string) (Value, error) {
	if !utf8.ValidString(text) {
		return Value{}, errorAt(ErrorType, Span{}, "text is not valid UTF-8")
	}
	return Value{kind: KindText, text: text}, nil
}

// LogicValue constructs a logic value.
func LogicValue(logic bool) Value { return Value{kind: KindLogic, logic: logic} }

// ListValue constructs a one-field, N-row table-shaped list.
func ListValue(items []Value) Value {
	rows := make([][]Value, len(items))
	for i, item := range items {
		rows[i] = []Value{item}
	}
	table, _ := newTable([]string{"value"}, rows, Span{})
	return structuredValue(KindList, table)
}

// RecordValue constructs an N-field, one-row table-shaped record.
func RecordValue(fields []string, values []Value) (Value, error) {
	if len(fields) != len(values) {
		return Value{}, errorAt(ErrorInvalidTable, Span{}, "record has %d fields and %d values", len(fields), len(values))
	}
	table, err := newTable(fields, [][]Value{values}, Span{})
	if err != nil {
		return Value{}, err
	}
	return structuredValue(KindRecord, table), nil
}

// TableValue constructs an N-field, M-row table value.
func TableValue(fields []string, rows [][]Value) (Value, error) {
	table, err := newTable(fields, rows, Span{})
	if err != nil {
		return Value{}, err
	}
	return structuredValue(KindTable, table), nil
}

func structuredValue(kind Kind, table Table) Value {
	copy := table.clone()
	return Value{kind: kind, table: &copy}
}

// Kind returns the value's type.
func (v Value) Kind() Kind { return v.kind }

// Shape returns the value's table-shaped dimensions.
func (v Value) Shape() Shape {
	if v.table != nil {
		return v.table.Shape()
	}
	return Shape{Fields: 1, Rows: 1}
}

// Number returns a copy of the exact rational number.
func (v Value) Number() (*big.Rat, bool) {
	if v.kind != KindNumber || v.number == nil {
		return nil, false
	}
	return new(big.Rat).Set(v.number), true
}

// NumberString returns the canonical number spelling. Terminating decimals are
// rendered as decimals; repeating rational results use a reduced fraction.
func (v Value) NumberString() (string, bool) {
	if v.kind != KindNumber || v.number == nil {
		return "", false
	}
	return formatRat(v.number), true
}

// Text returns the text payload.
func (v Value) Text() (string, bool) {
	return v.text, v.kind == KindText
}

// Logic returns the logic payload.
func (v Value) Logic() (bool, bool) {
	return v.logic, v.kind == KindLogic
}

// Table returns a deep copy of a list, record, or table's common carrier.
func (v Value) Table() (Table, bool) {
	if v.table == nil {
		return Table{}, false
	}
	return v.table.clone(), true
}

// Items returns a list's values in order.
func (v Value) Items() ([]Value, bool) {
	if v.kind != KindList || v.table == nil {
		return nil, false
	}
	items := make([]Value, len(v.table.rows))
	for i := range v.table.rows {
		items[i] = v.table.rows[i][0].clone()
	}
	return items, true
}

// Fields returns a record's ordered field names and values.
func (v Value) Fields() ([]string, []Value, bool) {
	if v.kind != KindRecord || v.table == nil {
		return nil, nil, false
	}
	return v.table.Fields(), v.table.row(0), true
}

// Field returns one record field, or one table column as a list.
func (v Value) Field(name string) (Value, bool) {
	if v.table == nil {
		return Value{}, false
	}
	switch v.kind {
	case KindRecord:
		return v.table.cell(0, name)
	case KindTable:
		column, ok := v.table.Field(name)
		if !ok {
			return Value{}, false
		}
		return ListValue(column), true
	default:
		return Value{}, false
	}
}

func (v Value) clone() Value {
	switch v.kind {
	case KindNumber:
		return ratValue(v.number)
	case KindList, KindRecord, KindTable:
		if v.table == nil {
			return Value{kind: v.kind}
		}
		return structuredValue(v.kind, *v.table)
	default:
		return v
	}
}

func cloneValues(values []Value) []Value {
	out := make([]Value, len(values))
	for i, value := range values {
		out[i] = value.clone()
	}
	return out
}

// Equal reports deep typed equality. Record and table field/row order is part
// of the value.
func (v Value) Equal(other Value) bool {
	if v.kind != other.kind {
		return false
	}
	switch v.kind {
	case KindNull:
		return true
	case KindNumber:
		return v.number != nil && other.number != nil && v.number.Cmp(other.number) == 0
	case KindText:
		return v.text == other.text
	case KindLogic:
		return v.logic == other.logic
	case KindList, KindRecord, KindTable:
		if v.table == nil || other.table == nil || len(v.table.fields) != len(other.table.fields) || len(v.table.rows) != len(other.table.rows) {
			return false
		}
		for i := range v.table.fields {
			if v.table.fields[i] != other.table.fields[i] {
				return false
			}
		}
		for row := range v.table.rows {
			for column := range v.table.rows[row] {
				if !v.table.rows[row][column].Equal(other.table.rows[row][column]) {
					return false
				}
			}
		}
		return true
	case KindFunction:
		if v.fn == nil || other.fn == nil {
			return false
		}
		if len(v.fn.params) != len(other.fn.params) {
			return false
		}
		for i := range v.fn.params {
			if v.fn.params[i] != other.fn.params[i] {
				return false
			}
		}
		return v.fn.source == other.fn.source
	default:
		return false
	}
}

// String returns a deterministic, human-readable representation.
func (v Value) String() string {
	switch v.kind {
	case KindNull:
		return "null"
	case KindNumber:
		return formatRat(v.number)
	case KindText:
		return strconv.Quote(v.text)
	case KindLogic:
		return strconv.FormatBool(v.logic)
	case KindList:
		items, _ := v.Items()
		parts := make([]string, len(items))
		for i, item := range items {
			parts[i] = item.String()
		}
		return "[" + strings.Join(parts, ", ") + "]"
	case KindRecord:
		fields, values, _ := v.Fields()
		parts := make([]string, len(fields))
		for i, field := range fields {
			parts[i] = field + ": " + values[i].String()
		}
		return "{" + strings.Join(parts, ", ") + "}"
	case KindTable:
		if v.table == nil {
			return "TABLE()"
		}
		rows := make([]string, len(v.table.rows))
		for i, row := range v.table.rows {
			record, _ := RecordValue(v.table.fields, row)
			rows[i] = record.String()
		}
		return "TABLE(" + strings.Join(rows, ", ") + ")"
	case KindFunction:
		if v.fn == nil {
			return "<function>"
		}
		return v.fn.source
	default:
		return "<invalid>"
	}
}

func formatRat(number *big.Rat) string {
	if number == nil || number.Sign() == 0 {
		return "0"
	}
	denominator := new(big.Int).Set(number.Denom())
	twos := int(denominator.TrailingZeroBits())
	denominator.Rsh(denominator, uint(twos))
	fives := factorCount(denominator, 5)
	if fives > 0 {
		power := new(big.Int).Exp(big.NewInt(5), big.NewInt(int64(fives)), nil)
		denominator.Quo(denominator, power)
	}
	if denominator.Cmp(big.NewInt(1)) != 0 {
		return number.RatString()
	}
	places := max(twos, fives)
	text := number.FloatString(places)
	if strings.Contains(text, ".") {
		text = strings.TrimRight(strings.TrimRight(text, "0"), ".")
	}
	if text == "-0" {
		return "0"
	}
	return text
}

func factorCount(number *big.Int, factor int64) int {
	if number == nil || number.Sign() == 0 {
		return 0
	}
	low, high := 0, number.BitLen()/2+2
	base := big.NewInt(factor)
	for low+1 < high {
		middle := low + (high-low)/2
		power := new(big.Int).Exp(base, big.NewInt(int64(middle)), nil)
		if new(big.Int).Mod(number, power).Sign() == 0 {
			low = middle
		} else {
			high = middle
		}
	}
	return low
}

// MarshalJSON encodes a typed, deterministic Formula value. Exact numbers are
// strings so repeating rational results cannot be rounded by JSON.
func (v Value) MarshalJSON() ([]byte, error) {
	type wireValue struct {
		Kind   Kind      `json:"kind"`
		Shape  Shape     `json:"shape"`
		Number *string   `json:"number,omitempty"`
		Text   *string   `json:"text,omitempty"`
		Logic  *bool     `json:"logic,omitempty"`
		Fields []string  `json:"fields,omitempty"`
		Rows   [][]Value `json:"rows,omitempty"`
		Params []string  `json:"params,omitempty"`
		Source *string   `json:"source,omitempty"`
	}
	out := wireValue{Kind: v.kind, Shape: v.Shape()}
	switch v.kind {
	case KindNumber:
		number := formatRat(v.number)
		out.Number = &number
	case KindText:
		out.Text = &v.text
	case KindLogic:
		out.Logic = &v.logic
	case KindList, KindRecord, KindTable:
		if v.table != nil {
			out.Fields = v.table.Fields()
			out.Rows = v.table.Rows()
		}
	case KindFunction:
		if v.fn == nil {
			return nil, fmt.Errorf("formula: function value has no payload")
		}
		out.Params = append([]string(nil), v.fn.params...)
		source := v.fn.source
		out.Source = &source
	case KindNull:
	default:
		return nil, fmt.Errorf("formula: cannot encode invalid value kind %q", v.kind)
	}
	return json.Marshal(out)
}

// UnmarshalJSON decodes the strict typed representation emitted by MarshalJSON.
func (v *Value) UnmarshalJSON(data []byte) error {
	if v == nil {
		return fmt.Errorf("formula: cannot decode into a nil Value")
	}
	if !utf8.Valid(data) {
		return fmt.Errorf("formula: value JSON is not valid UTF-8")
	}
	var members map[string]json.RawMessage
	if err := json.Unmarshal(data, &members); err != nil {
		return fmt.Errorf("formula: decode value: %w", err)
	}
	var kind Kind
	if err := json.Unmarshal(members["kind"], &kind); err != nil || kind == "" {
		return fmt.Errorf("formula: value requires a kind")
	}
	allowed := map[string]bool{"kind": true, "shape": true}
	switch kind {
	case KindNull:
	case KindNumber:
		allowed["number"] = true
	case KindText:
		allowed["text"] = true
	case KindLogic:
		allowed["logic"] = true
	case KindList, KindRecord, KindTable:
		allowed["fields"], allowed["rows"] = true, true
	case KindFunction:
		return fmt.Errorf("formula: function values cannot be decoded")
	default:
		return fmt.Errorf("formula: unknown value kind %q", kind)
	}
	for field := range members {
		if !allowed[field] {
			return fmt.Errorf("formula: value kind %q cannot carry field %q", kind, field)
		}
	}
	var raw struct {
		Kind   Kind            `json:"kind"`
		Shape  *Shape          `json:"shape"`
		Number json.RawMessage `json:"number"`
		Text   json.RawMessage `json:"text"`
		Logic  json.RawMessage `json:"logic"`
		Fields []string        `json:"fields"`
		Rows   [][]Value       `json:"rows"`
	}
	decoder := json.NewDecoder(bytes.NewReader(data))
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(&raw); err != nil {
		return fmt.Errorf("formula: decode value: %w", err)
	}
	if err := decoder.Decode(&struct{}{}); err != io.EOF {
		return fmt.Errorf("formula: value must contain exactly one JSON object")
	}
	var decoded Value
	var err error
	switch raw.Kind {
	case KindNull:
		decoded = NullValue()
	case KindNumber:
		var number string
		if len(raw.Number) == 0 || json.Unmarshal(raw.Number, &number) != nil {
			return fmt.Errorf("formula: number value requires a string number")
		}
		decoded, err = NumberValue(number)
	case KindText:
		var text string
		if len(raw.Text) == 0 || json.Unmarshal(raw.Text, &text) != nil {
			return fmt.Errorf("formula: text value requires text")
		}
		decoded, err = TextValue(text)
	case KindLogic:
		if len(raw.Logic) == 0 || json.Unmarshal(raw.Logic, &decoded.logic) != nil {
			return fmt.Errorf("formula: logic value requires logic")
		}
		decoded.kind = KindLogic
	case KindList, KindRecord, KindTable:
		table, tableErr := NewTable(raw.Fields, raw.Rows)
		if tableErr != nil {
			err = tableErr
			break
		}
		switch raw.Kind {
		case KindList:
			if len(raw.Fields) != 1 || raw.Fields[0] != "value" {
				return fmt.Errorf("formula: list value requires the single field %q", "value")
			}
		case KindRecord:
			if len(raw.Rows) != 1 {
				return fmt.Errorf("formula: record value requires exactly one row")
			}
		}
		decoded = structuredValue(raw.Kind, table)
	default:
		return fmt.Errorf("formula: unknown value kind %q", raw.Kind)
	}
	if err != nil {
		return err
	}
	if raw.Shape == nil || *raw.Shape != decoded.Shape() {
		return fmt.Errorf("formula: value shape does not match its payload")
	}
	*v = decoded
	return nil
}
