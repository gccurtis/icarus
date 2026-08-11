# syntax.go

`syntax.go` turns Formula source into a public, versioned abstract syntax tree. Its
lexer recognizes numeric and quoted-text spellings, identifiers, arithmetic,
comparison and logical punctuation, collections, navigation, dot-curly selections, and
strict or optional promotion while attaching half-open byte spans and enforcing
source/token budgets.

A recursive-descent parser applies explicit precedence and associativity and builds
literals, calls, collections, comparisons, short-circuit logic, and chained postfix
operations. A separate whole-tree validator checks depth, node count, spans, required
children, condition operators, and collection widths for parsed and external trees.

## Code breakdown

### Package declaration

```go
package formula

```

The syntax layer lives in `formula`, sharing value constructors, structured errors,
spans, and service limits with evaluation.

### Parser dependencies

```go
import (
	"fmt"
	"strconv"
	"unicode/utf8"
)

```

`fmt` formats delimiter diagnostics, `strconv` decodes quoted text, and `unicode/utf8`
validates selector field names in caller-built or decoded ASTs.

### Public AST node kinds

```go
// NodeType identifies one public AST node shape.
type NodeType string

```

`NodeType` identifies the syntax shapes visible to callers, including projection,
condition-query, strict-promotion, and optional-promotion nodes as well as ordinary
expressions.

### The NodeLiteral constants

```go
const (
	NodeLiteral    NodeType = "literal"
	NodeName       NodeType = "name"
	NodeGroup      NodeType = "group"
	NodeUnary      NodeType = "unary"
	NodeBinary     NodeType = "binary"
	NodeCall       NodeType = "call"
	NodeList       NodeType = "list"
	NodeRecord     NodeType = "record"
	NodeField      NodeType = "field"
	NodeIndex      NodeType = "index"
	NodeSlice      NodeType = "slice"
	NodeProjection NodeType = "projection"
	NodeQuery      NodeType = "query"
	// Query predicate nodes. A query's Predicate is a boolean tree whose leaves
	// are NodePredCompare (field <op> expr) combined by these operators.
	NodePredAnd     NodeType = "pred_and"
	NodePredOr      NodeType = "pred_or"
	NodePredXor     NodeType = "pred_xor"
	NodePredNot     NodeType = "pred_not"
	NodePredCompare NodeType = "pred_compare"
	NodePromote     NodeType = "promote"
	NodeOptional    NodeType = "optional"
	NodeFunction    NodeType = "function"
	NodeApply       NodeType = "apply"
)

```

This block defines the AST node kinds. Alongside the primary and postfix forms, a
query carries a boolean **predicate tree**: `NodePredCompare` leaves (`field <op>
expr`) combined by `NodePredAnd`/`NodePredOr`/`NodePredXor`/`NodePredNot`. Comma and
`&&` both build `NodePredAnd`. `NodeFunction` is a `FUNCTION`/`LAMBDA` definition —
its parameters live in `Node.Params` and its unevaluated body in `Node.Target`;
`NodeApply` is a postfix `(...)` call against any expression (not just a bare name),
covering both a named function value and an immediately-invoked inline lambda.

### Versioned parsed expression

```go
// Expression is parsed, versioned Formula source and its syntax tree.
type Expression struct {
	LanguageVersion string `json:"languageVersion"`
	Source          string `json:"source"`
	Root            *Node  `json:"root"`
}

```

An `Expression` binds the language version, exact source text, and root AST together.
Keeping all three makes parsed expressions portable within the declared compatibility
boundary.

### Compact AST node

```go
// Node is a compact JSON-friendly Formula AST node. Only fields relevant to
// Type are populated.
type Node struct {
	Type       NodeType      `json:"type"`
	Span       Span          `json:"span"`
	Value      *Value        `json:"value,omitempty"`
	Name       string        `json:"name,omitempty"`
	Operator   string        `json:"operator,omitempty"`
	Left       *Node         `json:"left,omitempty"`
	Right      *Node         `json:"right,omitempty"`
	Target     *Node         `json:"target,omitempty"`
	Index      *Node         `json:"index,omitempty"`
	SliceStart *Node         `json:"sliceStart,omitempty"`
	SliceEnd   *Node         `json:"sliceEnd,omitempty"`
	Args       []*Node       `json:"args,omitempty"`
	Items      []*Node       `json:"items,omitempty"`
	Fields     []RecordField `json:"fields,omitempty"`
	Projection []FieldName   `json:"projection,omitempty"`
	Params     []FieldName   `json:"params,omitempty"`
	Source     string        `json:"source,omitempty"`
	Predicate  *Node         `json:"predicate,omitempty"`
}

```

`Node` uses one JSON-friendly structure whose populated fields depend on `Type`. Every
node carries its source span; slots cover ordinary expression children, static
projection names, and — for a query — the root of its boolean predicate tree. A
`NodeFunction` stores its ordered parameters in `Params`, its exact defining source
text in `Source` (sliced once, at parse time, from the source the parser was given —
see `parseFunction` below — so it stays correct even when the node is later turned
into a function value by an evaluator running over a *different* top-level source
string), and its body in the shared `Target` slot (the same slot used by field
access, index, slice, and promotion targets); `NodeApply` stores the callee in
`Target` and its evaluated-at-call-time arguments in the shared `Args` slot (the
same slot `NodeCall` uses).

### Ordered record fields

```go
// RecordField is one ordered field in a record literal.
type RecordField struct {
	Name  string `json:"name"`
	Span  Span   `json:"span"`
	Value *Node  `json:"value"`
}

```

`RecordField` keeps a field's name, name span, and value expression. Record order is
preserved because it becomes table column order at evaluation time.

### The FieldName type

```go
// FieldName is one statically named field in a postfix projection.
type FieldName struct {
	Name string `json:"name"`
	Span Span   `json:"span"`
}

```

This block defines FieldName as one public or internal shape in the Formula implementation.
A query condition is no longer a separate flat type — comparisons are `NodePredCompare`
leaves inside the query's predicate tree (see `parsePredicate` and `evalQuery`).

### Internal token model

```go
type tokenKind string

```

The private token kinds cover literals, identifiers, operators, and all collection
delimiters. Each token stores decoded or source literal content alongside its exact byte
span; the EOF sentinel anchors end-of-input errors.

### The tokenEOF constants

```go
const (
	tokenEOF       tokenKind = "eof"
	tokenNumber    tokenKind = "number"
	tokenText      tokenKind = "text"
	tokenIdent     tokenKind = "identifier"
	tokenPlus      tokenKind = "+"
	tokenMinus     tokenKind = "-"
	tokenStar      tokenKind = "*"
	tokenSlash     tokenKind = "/"
	tokenPercent   tokenKind = "%"
	tokenCaret     tokenKind = "^"
	tokenLParen    tokenKind = "("
	tokenRParen    tokenKind = ")"
	tokenLBracket  tokenKind = "["
	tokenRBracket  tokenKind = "]"
	tokenLBrace    tokenKind = "{"
	tokenRBrace    tokenKind = "}"
	tokenComma     tokenKind = ","
	tokenColon     tokenKind = ":"
	tokenDot       tokenKind = "."
	tokenEqual     tokenKind = "="
	tokenNotEqual  tokenKind = "!="
	tokenLess      tokenKind = "<"
	tokenLessEq    tokenKind = "<="
	tokenGreater   tokenKind = ">"
	tokenGreaterEq tokenKind = ">="
	tokenBang      tokenKind = "!"
	tokenQuestion  tokenKind = "?"
	tokenAnd       tokenKind = "&&"
	tokenOr        tokenKind = "||"
)

```

This block defines the constants beginning with tokenEOF for this part of Formula.

### The token type

```go
type token struct {
	kind tokenKind
	lit  string
	span Span
}

```

This block defines token as one public or internal shape in the Formula implementation.

### Bounded lexical analysis

```go
func lex(source string, limits Limits) ([]token, *FormulaError) {
	if len(source) > limits.MaxSourceBytes {
		return nil, limitError(Span{Start: 0, End: len(source)}, "source_bytes")
	}
	tokens := make([]token, 0, min(len(source)/2, limits.MaxTokens))
	emit := func(kind tokenKind, lit string, start, end int) *FormulaError {
		if len(tokens) >= limits.MaxTokens {
			return limitError(Span{Start: start, End: end}, "tokens")
		}
		tokens = append(tokens, token{kind: kind, lit: lit, span: Span{Start: start, End: end}})
		return nil
	}
	for i := 0; i < len(source); {
		if isSpace(source[i]) {
			i++
			continue
		}
		start := i
		switch source[i] {
		case '+':
			i++
			if err := emit(tokenPlus, "+", start, i); err != nil {
				return nil, err
			}
		case '-':
			i++
			if err := emit(tokenMinus, "-", start, i); err != nil {
				return nil, err
			}
		case '*':
			i++
			if err := emit(tokenStar, "*", start, i); err != nil {
				return nil, err
			}
		case '/':
			i++
			if err := emit(tokenSlash, "/", start, i); err != nil {
				return nil, err
			}
		case '%':
			i++
			if err := emit(tokenPercent, "%", start, i); err != nil {
				return nil, err
			}
		case '^':
			i++
			if err := emit(tokenCaret, "^", start, i); err != nil {
				return nil, err
			}
		case '(':
			i++
			if err := emit(tokenLParen, "(", start, i); err != nil {
				return nil, err
			}
		case ')':
			i++
			if err := emit(tokenRParen, ")", start, i); err != nil {
				return nil, err
			}
		case '[':
			i++
			if err := emit(tokenLBracket, "[", start, i); err != nil {
				return nil, err
			}
		case ']':
			i++
			if err := emit(tokenRBracket, "]", start, i); err != nil {
				return nil, err
			}
		case '{':
			i++
			if err := emit(tokenLBrace, "{", start, i); err != nil {
				return nil, err
			}
		case '}':
			i++
			if err := emit(tokenRBrace, "}", start, i); err != nil {
				return nil, err
			}
		case ',':
			i++
			if err := emit(tokenComma, ",", start, i); err != nil {
				return nil, err
			}
		case ':':
			i++
			if err := emit(tokenColon, ":", start, i); err != nil {
				return nil, err
			}
		case '.':
			i++
			if err := emit(tokenDot, ".", start, i); err != nil {
				return nil, err
			}
		case '=':
			i++
			if err := emit(tokenEqual, "=", start, i); err != nil {
				return nil, err
			}
		case '!':
			i++
			kind := tokenBang
			if i < len(source) && source[i] == '=' {
				i++
				kind = tokenNotEqual
			}
			if err := emit(kind, source[start:i], start, i); err != nil {
				return nil, err
			}
		case '?':
			i++
			if err := emit(tokenQuestion, "?", start, i); err != nil {
				return nil, err
			}
		case '<':
			i++
			kind := tokenLess
			if i < len(source) && source[i] == '=' {
				i++
				kind = tokenLessEq
			}
			if err := emit(kind, source[start:i], start, i); err != nil {
				return nil, err
			}
		case '>':
			i++
			kind := tokenGreater
			if i < len(source) && source[i] == '=' {
				i++
				kind = tokenGreaterEq
			}
			if err := emit(kind, source[start:i], start, i); err != nil {
				return nil, err
			}
		case '&':
			i++
			if i >= len(source) || source[i] != '&' {
				return nil, errorAt(ErrorParse, Span{Start: start, End: i}, "expected '&' after '&'")
			}
			i++
			if err := emit(tokenAnd, "&&", start, i); err != nil {
				return nil, err
			}
		case '|':
			i++
			if i >= len(source) || source[i] != '|' {
				return nil, errorAt(ErrorParse, Span{Start: start, End: i}, "expected '|' after '|'")
			}
			i++
			if err := emit(tokenOr, "||", start, i); err != nil {
				return nil, err
			}
		case '"':
			i++
			for i < len(source) && source[i] != '"' {
				if source[i] == '\\' {
					i++
					if i >= len(source) {
						return nil, errorAt(ErrorParse, Span{Start: start, End: len(source)}, "unterminated text literal")
					}
				}
				i++
			}
			if i >= len(source) {
				return nil, errorAt(ErrorParse, Span{Start: start, End: len(source)}, "unterminated text literal")
			}
			i++
			decoded, err := strconv.Unquote(source[start:i])
			if err != nil {
				return nil, errorAt(ErrorParse, Span{Start: start, End: i}, "invalid text literal: %v", err)
			}
			if err := emit(tokenText, decoded, start, i); err != nil {
				return nil, err
			}
		default:
			switch {
			case isDigit(source[i]):
				i = scanNumber(source, i)
				if err := emit(tokenNumber, source[start:i], start, i); err != nil {
					return nil, err
				}
			case isIdentStart(source[i]):
				i++
				for i < len(source) && isIdentContinue(source[i]) {
					i++
				}
				if err := emit(tokenIdent, source[start:i], start, i); err != nil {
					return nil, err
				}
			default:
				return nil, errorAt(ErrorParse, Span{Start: start, End: start + 1}, "unexpected character %q", source[i])
			}
		}
	}
	tokens = append(tokens, token{kind: tokenEOF, span: Span{Start: len(source), End: len(source)}})
	return tokens, nil
}

```

`lex` first enforces the source-byte budget, then scans ASCII syntax and whitespace in
one pass. It decodes escaped text, preserves numeric spellings for bounded parsing,
accepts identifier characters, reports the first unexpected byte, and enforces the token
budget at every emission.

### Number scanning and validation

```go
func scanNumber(source string, start int) int {
	i := start
	for i < len(source) && isDigit(source[i]) {
		i++
	}
	if i < len(source) && source[i] == '.' {
		i++
		for i < len(source) && isDigit(source[i]) {
			i++
		}
	}
	if i < len(source) && (source[i] == 'e' || source[i] == 'E') {
		i++
		if i < len(source) && (source[i] == '+' || source[i] == '-') {
			i++
		}
		for i < len(source) && isDigit(source[i]) {
			i++
		}
	}
	return i
}

```

`scanNumber` consumes integer, optional decimal, and optional signed exponent components
without allocating a numeric value. Primary parsing later sends that spelling through
the bounded exact-number constructor.

### Character classifiers

```go
func isSpace(c byte) bool {
	return c == ' ' || c == '\t' || c == '\n' || c == '\r'
}

```

Small ASCII classifiers define Formula whitespace, decimal digits, and identifier
starts/continuations. Restricting identifier syntax here keeps tokenization
deterministic and byte-oriented.

### The isDigit operation

```go
func isDigit(c byte) bool { return c >= '0' && c <= '9' }

```

This block implements isDigit as one bounded part of Formula parsing or evaluation.

### The isIdentStart operation

```go
func isIdentStart(c byte) bool {
	return c == '_' || c >= 'A' && c <= 'Z' || c >= 'a' && c <= 'z'
}

```

This block implements isIdentStart as one bounded part of Formula parsing or evaluation.

### The isIdentContinue operation

```go
func isIdentContinue(c byte) bool { return isIdentStart(c) || isDigit(c) }

// validFieldName reports whether s is a legal field name: a non-empty identifier
// (a letter or underscore, then letters, digits, or underscores). Field names are
// identifier-shaped everywhere they appear — record literals, TABLE, projections,
// and queries — so a name a dot cannot spell (for example one containing a space)
// is rejected. It is applied to names built through the Go value API, where the
// lexer's token rules do not; source names are already identifier tokens.
func validFieldName(s string) bool {
	if s == "" || !isIdentStart(s[0]) {
		return false
	}
	for i := 1; i < len(s); i++ {
		if !isIdentContinue(s[i]) {
			return false
		}
	}
	return true
}

// IsIdentifier reports whether s is a legal Formula identifier — the same rule
// as a field name (a letter or underscore, then letters, digits, or
// underscores). Name-manager entry and column names must satisfy it so they are
// referenceable from an expression.
func IsIdentifier(s string) bool {
	return validFieldName(s)
}

```

`isIdentContinue` extends `isIdentStart` with digits. `validFieldName` builds on both
to enforce the language rule that a field name is an identifier: source formulas get
this for free (a field position accepts only an identifier *token*), so the helper's
real job is guarding names supplied through the Go value API — `newTable` calls it so
a space-containing name cannot be constructed programmatically either. `IsIdentifier`
is the exported form of the same rule: the `names` package (a per-project namespace
of stored values and functions, built on top of this evaluator) uses it to validate
entry and column names before they are stored, so anything referenceable from an
expression is guaranteed to parse as a name.

### Parser state

```go
type parser struct {
	tokens []token
	pos    int
	limits Limits
	nodes  int
	source string
}

```

The parser tracks the immutable token stream, current cursor, effective limits,
number of AST nodes admitted so far, and the exact source text it was given —
the last of which exists solely so `parseFunction` can slice a `NodeFunction`'s
defining span out of the *correct* string at parse time, rather than an
evaluator having to slice it later out of whatever source it happens to be
running over (see `parseFunction` and `Node.Source` above).

### Parse entry points

```go
// Parse parses source with DefaultLimits.
func Parse(source string) (*Expression, error) {
	return NewService().Parse(source)
}

```

The package-level `Parse` uses the default service. The service method lexes and parses
under configured limits, rejects trailing tokens, attaches source and language version,
and runs whole-tree validation before returning without evaluating.

### The Service Parse operation

```go
// Parse parses source into a versioned syntax tree without evaluating it.
func (s *Service) Parse(source string) (*Expression, error) {
	limits := s.Limits()
	tokens, err := lex(source, limits)
	if err != nil {
		return nil, err
	}
	p := parser{tokens: tokens, limits: limits, source: source}
	root, parseErr := p.parseExpression(1)
	if parseErr != nil {
		return nil, parseErr
	}
	if p.peek().kind != tokenEOF {
		return nil, errorAt(ErrorParse, p.peek().span, "unexpected %q after expression", p.peek().lit)
	}
	expression := &Expression{LanguageVersion: LanguageVersion, Source: source, Root: root}
	if err := validateExpression(expression, limits); err != nil {
		return nil, err
	}
	return expression, nil
}

```

This block implements Service Parse as one bounded part of Formula parsing or evaluation.

### Whole-tree AST validation

```go
func validateExpression(expression *Expression, limits Limits) *FormulaError {
	if expression == nil || expression.Root == nil {
		return errorAt(ErrorParse, Span{}, "expression is empty")
	}
	if expression.LanguageVersion != LanguageVersion {
		return errorAt(ErrorUnsupportedVersion, expression.Root.Span, "unsupported Formula language version %q", expression.LanguageVersion)
	}
	if len(expression.Source) > limits.MaxSourceBytes {
		return limitError(Span{Start: 0, End: len(expression.Source)}, "source_bytes")
	}
	type entry struct {
		node  *Node
		depth int
	}
	stack := []entry{{node: expression.Root, depth: 1}}
	visited := 0
	for len(stack) > 0 {
		current := stack[len(stack)-1]
		stack = stack[:len(stack)-1]
		visited++
		if visited > limits.MaxNodes {
			return limitError(current.node.Span, "ast_nodes")
		}
		if current.depth > limits.MaxDepth {
			return limitError(current.node.Span, "parse_depth")
		}
		if current.node.Span.Start < 0 || current.node.Span.End < current.node.Span.Start || current.node.Span.End > len(expression.Source) {
			return errorAt(ErrorParse, current.node.Span, "AST node span is outside the source")
		}
		push := func(child *Node) *FormulaError {
			if child == nil {
				return errorAt(ErrorParse, current.node.Span, "AST node %q has a missing child", current.node.Type)
			}
			if len(stack) >= limits.MaxNodes-visited {
				return limitError(current.node.Span, "ast_nodes")
			}
			stack = append(stack, entry{node: child, depth: current.depth + 1})
			return nil
		}
		pushMany := func(children []*Node) *FormulaError {
			if len(children) > limits.MaxNodes-visited-len(stack) {
				return limitError(current.node.Span, "ast_nodes")
			}
			for _, child := range children {
				if err := push(child); err != nil {
					return err
				}
			}
			return nil
		}
		switch current.node.Type {
		case NodeLiteral:
			if current.node.Value == nil {
				return errorAt(ErrorParse, current.node.Span, "literal has no value")
			}
		case NodeName:
			if current.node.Name == "" {
				return errorAt(ErrorParse, current.node.Span, "name is empty")
			}
		case NodeGroup:
			if err := push(current.node.Left); err != nil {
				return err
			}
		case NodeUnary:
			if err := push(current.node.Right); err != nil {
				return err
			}
		case NodeBinary:
			if err := pushMany([]*Node{current.node.Left, current.node.Right}); err != nil {
				return err
			}
		case NodeCall:
			if current.node.Name == "" {
				return errorAt(ErrorParse, current.node.Span, "function name is empty")
			}
			if err := pushMany(current.node.Args); err != nil {
				return err
			}
		case NodeList:
			if len(current.node.Items) > limits.MaxRows {
				return limitError(current.node.Span, "rows")
			}
			if len(current.node.Items) > limits.MaxCells {
				return limitError(current.node.Span, "cells")
			}
			if err := pushMany(current.node.Items); err != nil {
				return err
			}
		case NodeRecord:
			if len(current.node.Fields) > limits.MaxFields {
				return limitError(current.node.Span, "fields")
			}
			if len(current.node.Fields) > limits.MaxCells {
				return limitError(current.node.Span, "cells")
			}
			children := make([]*Node, len(current.node.Fields))
			for i, field := range current.node.Fields {
				children[i] = field.Value
			}
			if err := pushMany(children); err != nil {
				return err
			}
		case NodeField:
			if err := push(current.node.Target); err != nil {
				return err
			}
		case NodeIndex:
			if err := pushMany([]*Node{current.node.Target, current.node.Index}); err != nil {
				return err
			}
		case NodeSlice:
			if err := push(current.node.Target); err != nil {
				return err
			}
			if current.node.SliceStart != nil {
				if err := push(current.node.SliceStart); err != nil {
					return err
				}
			}
			if current.node.SliceEnd != nil {
				if err := push(current.node.SliceEnd); err != nil {
					return err
				}
			}
		case NodeProjection:
			if err := push(current.node.Target); err != nil {
				return err
			}
			if len(current.node.Projection) == 0 {
				return errorAt(ErrorParse, current.node.Span, "projection requires at least one field")
			}
			if len(current.node.Projection) > limits.MaxFields {
				return limitError(current.node.Span, "fields")
			}
			seen := make(map[string]bool, len(current.node.Projection))
			for _, field := range current.node.Projection {
				if field.Name == "" || !utf8.ValidString(field.Name) {
					return errorAt(ErrorParse, field.Span, "projection field name is empty or invalid UTF-8")
				}
				if seen[field.Name] {
					return errorAt(ErrorInvalidTable, field.Span, "projection field %q is duplicated", field.Name)
				}
				seen[field.Name] = true
			}
		case NodeQuery:
			if err := push(current.node.Target); err != nil {
				return err
			}
			if err := push(current.node.Predicate); err != nil {
				return err
			}
		case NodePredAnd, NodePredOr, NodePredXor:
			if err := push(current.node.Left); err != nil {
				return err
			}
			if err := push(current.node.Right); err != nil {
				return err
			}
		case NodePredNot:
			if err := push(current.node.Target); err != nil {
				return err
			}
		case NodePredCompare:
			if current.node.Name == "" || !utf8.ValidString(current.node.Name) {
				return errorAt(ErrorParse, current.node.Span, "query field name is empty or invalid UTF-8")
			}
			if !isConditionOperator(current.node.Operator) {
				return errorAt(ErrorParse, current.node.Span, "query operator %q is not supported", current.node.Operator)
			}
			if err := push(current.node.Right); err != nil {
				return err
			}
		case NodePromote:
			if err := push(current.node.Target); err != nil {
				return err
			}
		case NodeOptional:
			if err := push(current.node.Target); err != nil {
				return err
			}
		case NodeFunction:
			if len(current.node.Params) > limits.MaxFields {
				return limitError(current.node.Span, "fields")
			}
			seen := make(map[string]bool, len(current.node.Params))
			for _, param := range current.node.Params {
				if param.Name == "" || !validFieldName(param.Name) {
					return errorAt(ErrorParse, param.Span, "function parameter name is empty or invalid")
				}
				if seen[param.Name] {
					return errorAt(ErrorParse, param.Span, "duplicate function parameter %q", param.Name)
				}
				seen[param.Name] = true
			}
			if err := push(current.node.Target); err != nil {
				return err
			}
		case NodeApply:
			if err := push(current.node.Target); err != nil {
				return err
			}
			if err := pushMany(current.node.Args); err != nil {
				return err
			}
		default:
			return errorAt(ErrorParse, current.node.Span, "unsupported AST node %q", current.node.Type)
		}
	}
	return nil
}

```

`validateExpression` iteratively walks every node before evaluation. It checks language
version and source size, actual node count and depth, span containment, required
children and names, supported node kinds, and list/record shape limits; stack-growth
checks happen before appending children, so a forged high-fanout AST cannot allocate
past `MaxNodes`. A `NodeFunction`'s parameters are bounded by `MaxFields` and checked
for identifier shape and uniqueness — the same rule `parseFunction` already enforces
for parsed source, applied again here so a directly constructed or decoded AST gets it
too — before its body is pushed; a `NodeApply` pushes its callee and its argument list,
so both a definition and an application are ordinary tree-shaped nodes bounded by the
same `MaxNodes`/`MaxDepth` ceilings as everything else.

### Complete precedence entry point

```go
func (p *parser) parseExpression(depth int) (*Node, *FormulaError) {
	if depth > p.limits.MaxDepth {
		return nil, limitError(p.peek().span, "parse_depth")
	}
	return p.parseLogicalOr(depth)
}

```

The precedence pipeline descends through logical OR, logical AND, comparison,
arithmetic, unary, power, and postfix forms. Local checks fail early and final
validation measures the complete constructed tree.

### The parser parseLogicalOr operation

```go
func (p *parser) parseLogicalOr(depth int) (*Node, *FormulaError) {
	left, err := p.parseLogicalAnd(depth)
	if err != nil {
		return nil, err
	}
	for p.match(tokenOr) {
		right, err := p.parseLogicalAnd(depth)
		if err != nil {
			return nil, err
		}
		left, err = p.node(Node{Type: NodeBinary, Span: Span{Start: left.Span.Start, End: right.Span.End}, Operator: "||", Left: left, Right: right})
		if err != nil {
			return nil, err
		}
	}
	return left, nil
}

```

This block implements parser parseLogicalOr as one bounded part of Formula parsing or evaluation.

### The parser parseLogicalAnd operation

```go
func (p *parser) parseLogicalAnd(depth int) (*Node, *FormulaError) {
	left, err := p.parseComparison(depth)
	if err != nil {
		return nil, err
	}
	for p.match(tokenAnd) {
		right, err := p.parseComparison(depth)
		if err != nil {
			return nil, err
		}
		left, err = p.node(Node{Type: NodeBinary, Span: Span{Start: left.Span.Start, End: right.Span.End}, Operator: "&&", Left: left, Right: right})
		if err != nil {
			return nil, err
		}
	}
	return left, nil
}

```

This block implements parser parseLogicalAnd as one bounded part of Formula parsing or evaluation.

### The parser parseComparison operation

```go
func (p *parser) parseComparison(depth int) (*Node, *FormulaError) {
	left, err := p.parseAdditive(depth)
	if err != nil {
		return nil, err
	}
	if !isConditionToken(p.peek().kind) {
		return left, nil
	}
	operator := p.advance()
	right, err := p.parseAdditive(depth)
	if err != nil {
		return nil, err
	}
	return p.node(Node{Type: NodeBinary, Span: Span{Start: left.Span.Start, End: right.Span.End}, Operator: operator.lit, Left: left, Right: right})
}

```

This block implements parser parseComparison as one bounded part of Formula parsing or evaluation.

### The parser parseAdditive operation

```go
func (p *parser) parseAdditive(depth int) (*Node, *FormulaError) {
	left, err := p.parseMultiplicative(depth)
	if err != nil {
		return nil, err
	}
	for p.peek().kind == tokenPlus || p.peek().kind == tokenMinus {
		op := p.advance()
		right, err := p.parseMultiplicative(depth)
		if err != nil {
			return nil, err
		}
		left, err = p.node(Node{Type: NodeBinary, Span: Span{Start: left.Span.Start, End: right.Span.End}, Operator: op.lit, Left: left, Right: right})
		if err != nil {
			return nil, err
		}
	}
	return left, nil
}

```

This block implements parser parseAdditive as one bounded part of Formula parsing or evaluation.

### The parser parseMultiplicative operation

```go
func (p *parser) parseMultiplicative(depth int) (*Node, *FormulaError) {
	left, err := p.parseUnary(depth)
	if err != nil {
		return nil, err
	}
	for p.peek().kind == tokenStar || p.peek().kind == tokenSlash || p.peek().kind == tokenPercent {
		op := p.advance()
		right, err := p.parseUnary(depth)
		if err != nil {
			return nil, err
		}
		left, err = p.node(Node{Type: NodeBinary, Span: Span{Start: left.Span.Start, End: right.Span.End}, Operator: op.lit, Left: left, Right: right})
		if err != nil {
			return nil, err
		}
	}
	return left, nil
}

```

This block implements parser parseMultiplicative as one bounded part of Formula parsing or evaluation.

### The parser parseUnary operation

```go
func (p *parser) parseUnary(depth int) (*Node, *FormulaError) {
	if p.peek().kind == tokenPlus || p.peek().kind == tokenMinus || p.peek().kind == tokenBang {
		op := p.advance()
		right, err := p.parseUnary(depth + 1)
		if err != nil {
			return nil, err
		}
		return p.node(Node{Type: NodeUnary, Span: Span{Start: op.span.Start, End: right.Span.End}, Operator: op.lit, Right: right})
	}
	return p.parsePower(depth)
}

```

This block implements parser parseUnary as one bounded part of Formula parsing or evaluation.

### The parser parsePower operation

```go
func (p *parser) parsePower(depth int) (*Node, *FormulaError) {
	left, err := p.parsePostfix(depth)
	if err != nil {
		return nil, err
	}
	if p.match(tokenCaret) {
		right, err := p.parseUnary(depth + 1)
		if err != nil {
			return nil, err
		}
		return p.node(Node{Type: NodeBinary, Span: Span{Start: left.Span.Start, End: right.Span.End}, Operator: "^", Left: left, Right: right})
	}
	return left, nil
}

```

This block implements parser parsePower as one bounded part of Formula parsing or evaluation.

### Chained postfix operations

```go
func (p *parser) parsePostfix(depth int) (*Node, *FormulaError) {
	target, err := p.parsePrimary(depth)
	if err != nil {
		return nil, err
	}
	for {
		switch {
		case p.match(tokenDot):
			if p.match(tokenLBrace) {
				target, err = p.parseSelection(target, p.previous(), depth+1)
				if err != nil {
					return nil, err
				}
				continue
			}
			field := p.advance()
			if field.kind != tokenIdent {
				return nil, errorAt(ErrorParse, field.span, "expected a field name or '{' after '.'")
			}
			target, err = p.node(Node{Type: NodeField, Span: Span{Start: target.Span.Start, End: field.span.End}, Target: target, Name: field.lit})
			if err != nil {
				return nil, err
			}
		case p.match(tokenLBracket):
			startSpan := p.previous().span
			if p.match(tokenColon) {
				var end *Node
				if p.peek().kind != tokenRBracket {
					end, err = p.parseExpression(depth + 1)
					if err != nil {
						return nil, err
					}
				}
				close, closeErr := p.expect(tokenRBracket, "expected ']' after slice")
				if closeErr != nil {
					return nil, closeErr
				}
				target, err = p.node(Node{Type: NodeSlice, Span: Span{Start: target.Span.Start, End: close.span.End}, Target: target, SliceEnd: end})
				if err != nil {
					return nil, err
				}
				continue
			}
			if p.peek().kind == tokenRBracket {
				return nil, errorAt(ErrorParse, Span{Start: startSpan.Start, End: p.peek().span.End}, "empty index is not allowed; use [:] for a full slice")
			}
			first, firstErr := p.parseExpression(depth + 1)
			if firstErr != nil {
				return nil, firstErr
			}
			if p.match(tokenColon) {
				var end *Node
				if p.peek().kind != tokenRBracket {
					end, err = p.parseExpression(depth + 1)
					if err != nil {
						return nil, err
					}
				}
				close, closeErr := p.expect(tokenRBracket, "expected ']' after slice")
				if closeErr != nil {
					return nil, closeErr
				}
				target, err = p.node(Node{Type: NodeSlice, Span: Span{Start: target.Span.Start, End: close.span.End}, Target: target, SliceStart: first, SliceEnd: end})
				if err != nil {
					return nil, err
				}
				continue
			}
			close, closeErr := p.expect(tokenRBracket, "expected ']' after index")
			if closeErr != nil {
				return nil, closeErr
			}
			target, err = p.node(Node{Type: NodeIndex, Span: Span{Start: target.Span.Start, End: close.span.End}, Target: target, Index: first})
			if err != nil {
				return nil, err
			}
		case p.match(tokenLParen):
			args, close, err := p.parseDelimited(depth+1, tokenRParen, "call arguments")
			if err != nil {
				return nil, err
			}
			target, err = p.node(Node{Type: NodeApply, Span: Span{Start: target.Span.Start, End: close.span.End}, Target: target, Args: args})
			if err != nil {
				return nil, err
			}
		case p.match(tokenBang):
			target, err = p.node(Node{Type: NodePromote, Span: Span{Start: target.Span.Start, End: p.previous().span.End}, Target: target})
			if err != nil {
				return nil, err
			}
		case p.match(tokenQuestion):
			target, err = p.node(Node{Type: NodeOptional, Span: Span{Start: target.Span.Start, End: p.previous().span.End}, Target: target})
			if err != nil {
				return nil, err
			}
		default:
			return target, nil
		}
	}
}

```

`parsePostfix` repeatedly extends a primary with field access, dot-curly selection,
bracket indexing or slicing, a call/apply `(...)`, strict `!` promotion, and optional
`?` promotion. Each suffix chains over the value produced by the preceding suffix. The
apply case makes `(...)` a postfix operator on *any* expression, not just a bare name —
so both `double(21)` (a name resolved to a function at evaluation time) and
`(FUNCTION(x, x))(5)` (an inline lambda invoked immediately) parse the same way, and a
returned function value can itself be applied again (`f(x)(y)`).

### The parser parseSelection operation

```go
// parseSelection parses a dot-curly `.{ ... }`. It is a projection (a
// comma-separated list of bare field names) or a query (a boolean predicate over
// field comparisons). The two are disambiguated by lookahead: a leading '(' or '!'
// is a query, and an identifier followed by a comparison operator is a query;
// otherwise a leading identifier begins a projection.
func (p *parser) parseSelection(target *Node, open token, depth int) (*Node, *FormulaError) {
	query := false
	switch p.peek().kind {
	case tokenLParen, tokenBang:
		query = true
	case tokenIdent:
		if isConditionToken(p.peekAt(1).kind) {
			query = true
		}
	default:
		return nil, errorAt(ErrorParse, p.peek().span, "expected a field name or condition inside '.{...}'")
	}

	if query {
		predicate, err := p.parsePredicate(depth + 1)
		if err != nil {
			return nil, err
		}
		close, err := p.expect(tokenRBrace, "expected '}' after query")
		if err != nil {
			return nil, err
		}
		return p.node(Node{
			Type:      NodeQuery,
			Span:      Span{Start: target.Span.Start, End: close.span.End},
			Target:    target,
			Predicate: predicate,
		})
	}

	first := p.advance()
	fields := []FieldName{{Name: first.lit, Span: first.span}}
	seen := map[string]bool{first.lit: true}
	for p.match(tokenComma) {
		field := p.advance()
		if field.kind != tokenIdent {
			return nil, errorAt(ErrorParse, field.span, "projection field names must be identifiers")
		}
		if seen[field.lit] {
			return nil, errorAt(ErrorInvalidTable, field.span, "projection field %q is duplicated", field.lit)
		}
		seen[field.lit] = true
		fields = append(fields, FieldName{Name: field.lit, Span: field.span})
	}
	close, err := p.expect(tokenRBrace, "expected ',' or '}' after projection field")
	if err != nil {
		return nil, err
	}
	return p.node(Node{
		Type:       NodeProjection,
		Span:       Span{Start: target.Span.Start, End: close.span.End},
		Target:     target,
		Projection: fields,
	})
}

```

`parseSelection` disambiguates projection from query with a one-token lookahead: a
leading `(` or `!`, or an identifier followed by a comparison operator, starts a query
predicate; otherwise a leading identifier begins a projection. Projection field names
are identifiers, deduplicated. A query defers to `parsePredicate`.

### The predicate parser

```go
// parsePredicate parses a boolean query predicate. Precedence, loosest to
// tightest: comma (AND) · || (OR) · ^ (XOR) · && (AND) · ! (NOT); parentheses
// group. Leaves are `field <op> expr`. Comma and && both build NodePredAnd.
func (p *parser) parsePredicate(depth int) (*Node, *FormulaError) {
	if depth > p.limits.MaxDepth {
		return nil, limitError(p.peek().span, "parse_depth")
	}
	left, err := p.parsePredOr(depth)
	if err != nil {
		return nil, err
	}
	for p.match(tokenComma) {
		right, rerr := p.parsePredOr(depth)
		if rerr != nil {
			return nil, rerr
		}
		left, err = p.node(Node{Type: NodePredAnd, Span: Span{Start: left.Span.Start, End: right.Span.End}, Left: left, Right: right})
		if err != nil {
			return nil, err
		}
	}
	return left, nil
}

func (p *parser) parsePredOr(depth int) (*Node, *FormulaError) {
	left, err := p.parsePredXor(depth)
	if err != nil {
		return nil, err
	}
	for p.match(tokenOr) {
		right, rerr := p.parsePredXor(depth)
		if rerr != nil {
			return nil, rerr
		}
		left, err = p.node(Node{Type: NodePredOr, Span: Span{Start: left.Span.Start, End: right.Span.End}, Left: left, Right: right})
		if err != nil {
			return nil, err
		}
	}
	return left, nil
}

func (p *parser) parsePredXor(depth int) (*Node, *FormulaError) {
	left, err := p.parsePredAnd(depth)
	if err != nil {
		return nil, err
	}
	for p.match(tokenCaret) {
		right, rerr := p.parsePredAnd(depth)
		if rerr != nil {
			return nil, rerr
		}
		left, err = p.node(Node{Type: NodePredXor, Span: Span{Start: left.Span.Start, End: right.Span.End}, Left: left, Right: right})
		if err != nil {
			return nil, err
		}
	}
	return left, nil
}

func (p *parser) parsePredAnd(depth int) (*Node, *FormulaError) {
	left, err := p.parsePredNot(depth)
	if err != nil {
		return nil, err
	}
	for p.match(tokenAnd) {
		right, rerr := p.parsePredNot(depth)
		if rerr != nil {
			return nil, rerr
		}
		left, err = p.node(Node{Type: NodePredAnd, Span: Span{Start: left.Span.Start, End: right.Span.End}, Left: left, Right: right})
		if err != nil {
			return nil, err
		}
	}
	return left, nil
}

func (p *parser) parsePredNot(depth int) (*Node, *FormulaError) {
	if p.match(tokenBang) {
		bang := p.previous()
		inner, err := p.parsePredNot(depth + 1)
		if err != nil {
			return nil, err
		}
		return p.node(Node{Type: NodePredNot, Span: Span{Start: bang.span.Start, End: inner.Span.End}, Target: inner})
	}
	return p.parsePredPrimary(depth)
}

func (p *parser) parsePredPrimary(depth int) (*Node, *FormulaError) {
	if p.match(tokenLParen) {
		inner, err := p.parsePredicate(depth + 1)
		if err != nil {
			return nil, err
		}
		if _, err := p.expect(tokenRParen, "expected ')' in query predicate"); err != nil {
			return nil, err
		}
		return inner, nil
	}
	field := p.advance()
	if field.kind != tokenIdent {
		return nil, errorAt(ErrorParse, field.span, "expected a field name in query condition")
	}
	operator := p.advance()
	if !isConditionToken(operator.kind) {
		return nil, errorAt(ErrorParse, operator.span, "expected a comparison operator after query field")
	}
	// The right-hand side is an additive expression: below comparison and the
	// predicate's own logical operators, so a predicate-level ||/^/&& is not
	// swallowed here, and an arithmetic ^ (power) inside the RHS does not collide
	// with a predicate-level ^ (XOR).
	value, err := p.parseAdditive(depth + 1)
	if err != nil {
		return nil, err
	}
	return p.node(Node{
		Type:     NodePredCompare,
		Span:     Span{Start: field.span.Start, End: value.Span.End},
		Name:     field.lit,
		Operator: operator.lit,
		Right:    value,
	})
}

```

These functions are a recursive-descent parser for the query predicate, one function
per precedence level: `parsePredicate` (comma = AND, loosest) descends through OR, XOR,
AND, and NOT to `parsePredPrimary`, which is either a parenthesized sub-predicate or a
`field <op> expr` comparison leaf. Comma and `&&` both produce `NodePredAnd`. The
comparison's right-hand side is parsed with `parseAdditive` — deliberately below both
comparison and the logical operators — so a predicate-level `||`/`^`/`&&` is never
consumed by the RHS, and an arithmetic `^` (power) inside the RHS stays separate from a
predicate-level `^` (XOR); consequently XOR operands must be parenthesized. `parsePredicate`
and the `(`/`!` recursions carry a depth check, and every node passes through `p.node`,
so parse work is bounded by `MaxDepth` and `MaxNodes`.

### The isConditionToken operation

```go
func isConditionToken(kind tokenKind) bool {
	switch kind {
	case tokenEqual, tokenNotEqual, tokenLess, tokenLessEq, tokenGreater, tokenGreaterEq:
		return true
	default:
		return false
	}
}

```

This block implements isConditionToken as one bounded part of Formula parsing or evaluation.

### The isConditionOperator operation

```go
func isConditionOperator(operator string) bool {
	switch operator {
	case "=", "!=", "<", "<=", ">", ">=":
		return true
	default:
		return false
	}
}

```

This block implements isConditionOperator as one bounded part of Formula parsing or evaluation.

### Primary expressions

```go
func (p *parser) parsePrimary(depth int) (*Node, *FormulaError) {
	tok := p.advance()
	switch tok.kind {
	case tokenNumber:
		value, numberErr := parseNumberValue(tok.lit, p.limits.MaxNumberBits, tok.span)
		if numberErr != nil {
			return nil, numberErr
		}
		return p.node(Node{Type: NodeLiteral, Span: tok.span, Value: &value})
	case tokenText:
		value, textErr := TextValue(tok.lit)
		if textErr != nil {
			return nil, errorAt(ErrorParse, tok.span, "text literal is not valid UTF-8")
		}
		return p.node(Node{Type: NodeLiteral, Span: tok.span, Value: &value})
	case tokenIdent:
		switch lowerASCII(tok.lit) {
		case "true":
			value := LogicValue(true)
			return p.node(Node{Type: NodeLiteral, Span: tok.span, Value: &value})
		case "false":
			value := LogicValue(false)
			return p.node(Node{Type: NodeLiteral, Span: tok.span, Value: &value})
		case "null":
			value := NullValue()
			return p.node(Node{Type: NodeLiteral, Span: tok.span, Value: &value})
		}
		if !p.match(tokenLParen) {
			return p.node(Node{Type: NodeName, Span: tok.span, Name: tok.lit})
		}
		if name := lowerASCII(tok.lit); name == "function" || name == "lambda" {
			return p.parseFunction(tok, depth+1)
		}
		args, close, err := p.parseDelimited(depth+1, tokenRParen, "function arguments")
		if err != nil {
			return nil, err
		}
		return p.node(Node{Type: NodeCall, Span: Span{Start: tok.span.Start, End: close.span.End}, Name: tok.lit, Args: args})
	case tokenLParen:
		inner, err := p.parseExpression(depth + 1)
		if err != nil {
			return nil, err
		}
		close, closeErr := p.expect(tokenRParen, "expected ')' after expression")
		if closeErr != nil {
			return nil, closeErr
		}
		return p.node(Node{Type: NodeGroup, Span: Span{Start: tok.span.Start, End: close.span.End}, Left: inner})
	case tokenLBracket:
		items, close, err := p.parseDelimited(depth+1, tokenRBracket, "list items")
		if err != nil {
			return nil, err
		}
		return p.node(Node{Type: NodeList, Span: Span{Start: tok.span.Start, End: close.span.End}, Items: items})
	case tokenLBrace:
		return p.parseRecord(tok, depth+1)
	case tokenEOF:
		return nil, errorAt(ErrorParse, tok.span, "expected an expression")
	default:
		return nil, errorAt(ErrorParse, tok.span, "expected an expression, found %q", tok.lit)
	}
}

```

Primary parsing constructs size-bounded exact numbers, valid-UTF-8 text,
case-insensitive logic/null keywords, case-sensitive names, function calls,
parenthesized groups, list literals, and record literals. Unexpected EOF, invalid text,
and malformed tokens produce span-local parse errors. An identifier that is (ASCII
case-insensitively) `FUNCTION` or `LAMBDA`, immediately followed by `(`, is not an
ordinary call — it is a function definition, handed off to `parseFunction`.

### Function definitions

```go
// parseFunction parses FUNCTION(p1, …, body) / LAMBDA(…). The opening '(' has
// already been consumed. Every argument but the last is a bare parameter
// identifier; the last is the body expression. Zero parameters are allowed.
func (p *parser) parseFunction(fn token, depth int) (*Node, *FormulaError) {
	args, close, err := p.parseDelimited(depth, tokenRParen, "function definition")
	if err != nil {
		return nil, err
	}
	if len(args) < 1 {
		return nil, errorAt(ErrorParse, Span{Start: fn.span.Start, End: close.span.End}, "%s requires a body expression", upperASCII(fn.lit))
	}
	params := make([]FieldName, 0, len(args)-1)
	seen := map[string]bool{}
	for _, arg := range args[:len(args)-1] {
		if arg.Type != NodeName {
			return nil, errorAt(ErrorParse, arg.Span, "function parameters must be identifiers")
		}
		if seen[arg.Name] {
			return nil, errorAt(ErrorParse, arg.Span, "duplicate function parameter %q", arg.Name)
		}
		seen[arg.Name] = true
		params = append(params, FieldName{Name: arg.Name, Span: arg.Span})
	}
	return p.node(Node{
		Type:   NodeFunction,
		Span:   Span{Start: fn.span.Start, End: close.span.End},
		Params: params,
		Target: args[len(args)-1],
		Source: p.source[fn.span.Start:close.span.End],
	})
}

```

`parseFunction` reuses `parseDelimited` to parse a comma-separated argument list, then
reinterprets it: every argument but the last must be a bare identifier (a parsed
`NodeName`) naming a parameter, and the last is the body expression, unevaluated at
parse time. Zero parameters (`FUNCTION(body)`) are allowed but a body is mandatory, so
`FUNCTION()` is a parse error. Parameter names are deduplicated here, at parse time,
independent of `validateExpression`'s own duplicate check (which also protects a
directly constructed or decoded AST that skipped this parser). The returned node's
`Source` is sliced from `p.source` — the exact string this parser was constructed
over (see `(s *Service) Parse` above) — by the function's own span (`fn.span.Start`
through the closing paren), so it is always in-bounds and valid UTF-8 without a
guard: the span and the source it indexes are guaranteed to agree, unlike an
evaluator later slicing the same span out of a possibly different source string.

### Delimited expression lists

```go
func (p *parser) parseDelimited(depth int, closing tokenKind, description string) ([]*Node, token, *FormulaError) {
	if p.match(closing) {
		return nil, p.previous(), nil
	}
	var values []*Node
	for {
		value, err := p.parseExpression(depth)
		if err != nil {
			return nil, token{}, err
		}
		values = append(values, value)
		if p.match(closing) {
			return values, p.previous(), nil
		}
		if _, err := p.expect(tokenComma, fmt.Sprintf("expected ',' or closing delimiter in %s", description)); err != nil {
			return nil, token{}, err
		}
	}
}

```

This helper parses empty or comma-separated sequences until a requested closing token.
Calls and lists share it, producing consistent delimiter handling and diagnostics.

### Record literals

```go
func (p *parser) parseRecord(open token, depth int) (*Node, *FormulaError) {
	if p.match(tokenRBrace) {
		return p.node(Node{Type: NodeRecord, Span: Span{Start: open.span.Start, End: p.previous().span.End}})
	}
	fields := make([]RecordField, 0)
	seen := map[string]bool{}
	for {
		name := p.advance()
		if name.kind != tokenIdent {
			return nil, errorAt(ErrorParse, name.span, "record field names must be identifiers")
		}
		if seen[name.lit] {
			return nil, errorAt(ErrorInvalidTable, name.span, "duplicate record field %q", name.lit)
		}
		seen[name.lit] = true
		if _, err := p.expect(tokenColon, "expected ':' after record field name"); err != nil {
			return nil, err
		}
		value, err := p.parseExpression(depth)
		if err != nil {
			return nil, err
		}
		fields = append(fields, RecordField{Name: name.lit, Span: name.span, Value: value})
		if p.match(tokenRBrace) {
			return p.node(Node{Type: NodeRecord, Span: Span{Start: open.span.Start, End: p.previous().span.End}, Fields: fields})
		}
		if _, err := p.expect(tokenComma, "expected ',' or '}' after record field"); err != nil {
			return nil, err
		}
	}
}

```

Record parsing accepts identifier or quoted-text field names, preserves declaration
order, rejects duplicates immediately, requires colons and commas, and creates a record
node spanning both braces.

### AST node accounting

```go
func (p *parser) node(node Node) (*Node, *FormulaError) {
	p.nodes++
	if p.nodes > p.limits.MaxNodes {
		return nil, limitError(node.Span, "ast_nodes")
	}
	return &node, nil
}

```

Every AST allocation passes through `node`, which increments the deterministic node
counter and reports `ast_nodes` exhaustion at the new node's span.

### Token cursor helpers

```go
func (p *parser) match(kind tokenKind) bool {
	if p.peek().kind != kind {
		return false
	}
	p.pos++
	return true
}

```

`match`, `expect`, `advance`, `previous`, and `peek` centralize cursor movement. They
keep lookahead safe at EOF and make required-token failures consistently span-aware.

### The parser expect operation

```go
func (p *parser) expect(kind tokenKind, message string) (token, *FormulaError) {
	if p.peek().kind != kind {
		return token{}, errorAt(ErrorParse, p.peek().span, "%s", message)
	}
	return p.advance(), nil
}

```

This block implements parser expect as one bounded part of Formula parsing or evaluation.

### The parser advance operation

```go
func (p *parser) advance() token {
	token := p.peek()
	if p.pos < len(p.tokens)-1 {
		p.pos++
	}
	return token
}

```

This block implements parser advance as one bounded part of Formula parsing or evaluation.

### The parser previous operation

```go
func (p *parser) previous() token {
	if p.pos == 0 {
		return p.tokens[0]
	}
	return p.tokens[p.pos-1]
}

```

This block implements parser previous as one bounded part of Formula parsing or evaluation.

### The parser peek operation

```go
func (p *parser) peek() token { return p.tokens[p.pos] }

// peekAt returns the token ahead of the cursor by offset, saturating at the EOF
// sentinel so a lookahead past the end is safe.
func (p *parser) peekAt(offset int) token {
	i := p.pos + offset
	if i >= len(p.tokens) {
		i = len(p.tokens) - 1
	}
	return p.tokens[i]
}

```

`peek` reads the current token; `peekAt` reads one at a fixed offset ahead, clamped to
the EOF sentinel. `parseSelection` uses the one-token lookahead to tell a projection
(`field ,`) from a query (`field <op>`).

### ASCII case normalization

```go
func lowerASCII(source string) string {
	bytes := []byte(source)
	for i, char := range bytes {
		if char >= 'A' && char <= 'Z' {
			bytes[i] = char + ('a' - 'A')
		}
	}
	return string(bytes)
}

```

The lower- and upper-case helpers normalize only ASCII letters without locale behavior.
Keywords and built-in functions can therefore be case-insensitive while binding and
field names remain untouched.

### The upperASCII operation

```go
func upperASCII(source string) string {
	bytes := []byte(source)
	for i, char := range bytes {
		if char >= 'a' && char <= 'z' {
			bytes[i] = char - ('a' - 'A')
		}
	}
	return string(bytes)
}
```

This block implements upperASCII as one bounded part of Formula parsing or evaluation.
