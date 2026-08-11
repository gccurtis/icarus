package formula

import (
	"fmt"
	"strconv"
	"unicode/utf8"
)

// NodeType identifies one public AST node shape.
type NodeType string

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

// Expression is parsed, versioned Formula source and its syntax tree.
type Expression struct {
	LanguageVersion string `json:"languageVersion"`
	Source          string `json:"source"`
	Root            *Node  `json:"root"`
}

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

// RecordField is one ordered field in a record literal.
type RecordField struct {
	Name  string `json:"name"`
	Span  Span   `json:"span"`
	Value *Node  `json:"value"`
}

// FieldName is one statically named field in a postfix projection.
type FieldName struct {
	Name string `json:"name"`
	Span Span   `json:"span"`
}

type tokenKind string

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

type token struct {
	kind tokenKind
	lit  string
	span Span
}

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

func isSpace(c byte) bool {
	return c == ' ' || c == '\t' || c == '\n' || c == '\r'
}

func isDigit(c byte) bool { return c >= '0' && c <= '9' }

func isIdentStart(c byte) bool {
	return c == '_' || c >= 'A' && c <= 'Z' || c >= 'a' && c <= 'z'
}

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

type parser struct {
	tokens []token
	pos    int
	limits Limits
	nodes  int
	source string
}

// Parse parses source with DefaultLimits.
func Parse(source string) (*Expression, error) {
	return NewService().Parse(source)
}

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

func (p *parser) parseExpression(depth int) (*Node, *FormulaError) {
	if depth > p.limits.MaxDepth {
		return nil, limitError(p.peek().span, "parse_depth")
	}
	return p.parseLogicalOr(depth)
}

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

func isConditionToken(kind tokenKind) bool {
	switch kind {
	case tokenEqual, tokenNotEqual, tokenLess, tokenLessEq, tokenGreater, tokenGreaterEq:
		return true
	default:
		return false
	}
}

func isConditionOperator(operator string) bool {
	switch operator {
	case "=", "!=", "<", "<=", ">", ">=":
		return true
	default:
		return false
	}
}

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

func (p *parser) node(node Node) (*Node, *FormulaError) {
	p.nodes++
	if p.nodes > p.limits.MaxNodes {
		return nil, limitError(node.Span, "ast_nodes")
	}
	return &node, nil
}

func (p *parser) match(kind tokenKind) bool {
	if p.peek().kind != kind {
		return false
	}
	p.pos++
	return true
}

func (p *parser) expect(kind tokenKind, message string) (token, *FormulaError) {
	if p.peek().kind != kind {
		return token{}, errorAt(ErrorParse, p.peek().span, "%s", message)
	}
	return p.advance(), nil
}

func (p *parser) advance() token {
	token := p.peek()
	if p.pos < len(p.tokens)-1 {
		p.pos++
	}
	return token
}

func (p *parser) previous() token {
	if p.pos == 0 {
		return p.tokens[0]
	}
	return p.tokens[p.pos-1]
}

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

func lowerASCII(source string) string {
	bytes := []byte(source)
	for i, char := range bytes {
		if char >= 'A' && char <= 'Z' {
			bytes[i] = char + ('a' - 'A')
		}
	}
	return string(bytes)
}

func upperASCII(source string) string {
	bytes := []byte(source)
	for i, char := range bytes {
		if char >= 'a' && char <= 'z' {
			bytes[i] = char - ('a' - 'A')
		}
	}
	return string(bytes)
}
