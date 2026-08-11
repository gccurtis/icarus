// Package formula implements Taurus's pure, deterministic expression language.
// It owns parsing, typed in-memory values, evaluation, and bounded table-shaped
// queries. It deliberately performs no storage, network, clock, random, model,
// or cross-capability work.
package formula

import "fmt"

// LanguageVersion identifies the syntax and semantics implemented by this
// package. Stored expressions will eventually pin this value; for now it makes
// the compatibility boundary explicit in the headless API.
const LanguageVersion = "formula/v1"

// ErrorKind is a stable machine-readable Formula failure category. Messages
// explain the particular failure but are not themselves a compatibility
// contract.
type ErrorKind string

const (
	ErrorParse              ErrorKind = "parse_error"
	ErrorUnknownIdentifier  ErrorKind = "unknown_identifier"
	ErrorUnknownFunction    ErrorKind = "unknown_function"
	ErrorWrongArity         ErrorKind = "wrong_arity"
	ErrorType               ErrorKind = "type_error"
	ErrorDivideByZero       ErrorKind = "divide_by_zero"
	ErrorNumeric            ErrorKind = "numeric_error"
	ErrorInvalidIndex       ErrorKind = "invalid_index"
	ErrorIndexOutOfRange    ErrorKind = "index_out_of_range"
	ErrorUnknownField       ErrorKind = "unknown_field"
	ErrorInvalidTable       ErrorKind = "invalid_table"
	ErrorCardinality        ErrorKind = "cardinality_error"
	ErrorLimitExceeded      ErrorKind = "limit_exceeded"
	ErrorUnsupportedVersion ErrorKind = "unsupported_version"
)

// Span is a half-open UTF-8 byte range in Formula source.
type Span struct {
	Start int `json:"start"`
	End   int `json:"end"`
}

// FormulaError is a safe structured parser, evaluator, or value-model error.
// Limit is populated only for ErrorLimitExceeded.
type FormulaError struct {
	Kind    ErrorKind `json:"kind"`
	Message string    `json:"message"`
	Span    Span      `json:"span"`
	Limit   string    `json:"limit,omitempty"`
}

func (e *FormulaError) Error() string {
	if e == nil {
		return ""
	}
	if e.Span != (Span{}) {
		return fmt.Sprintf("%s at [%d:%d]: %s", e.Kind, e.Span.Start, e.Span.End, e.Message)
	}
	return fmt.Sprintf("%s: %s", e.Kind, e.Message)
}

func errorAt(kind ErrorKind, span Span, format string, args ...any) *FormulaError {
	return &FormulaError{Kind: kind, Message: fmt.Sprintf(format, args...), Span: span}
}

func limitError(span Span, name string) *FormulaError {
	return &FormulaError{
		Kind:    ErrorLimitExceeded,
		Message: fmt.Sprintf("formula exceeded the %s limit", name),
		Span:    span,
		Limit:   name,
	}
}

// Limits bounds parsing, evaluation work, and values produced by one call.
// Wall-clock time is intentionally absent: Formula semantics depend only on the
// source, bindings, language version, and these deterministic counters.
type Limits struct {
	MaxSourceBytes int
	MaxTokens      int
	MaxNodes       int
	MaxDepth       int
	MaxSteps       int
	MaxFields      int
	MaxRows        int
	MaxCells       int
	MaxOutputBytes int
	MaxNumberBits  int
	MaxPower       int
	MaxRoundPlaces int
}

var defaultLimits = Limits{
	MaxSourceBytes: 16 * 1024,
	MaxTokens:      4096,
	MaxNodes:       4096,
	MaxDepth:       64,
	MaxSteps:       100_000,
	MaxFields:      256,
	MaxRows:        10_000,
	MaxCells:       100_000,
	MaxOutputBytes: 1 << 20,
	MaxNumberBits:  1 << 20,
	MaxPower:       1024,
	MaxRoundPlaces: 100,
}

// DefaultLimits returns the production-safe bounds for one headless
// evaluation.
func DefaultLimits() Limits { return defaultLimits }

func (l Limits) withDefaults() Limits {
	d := DefaultLimits()
	if l.MaxSourceBytes > 0 {
		d.MaxSourceBytes = min(d.MaxSourceBytes, l.MaxSourceBytes)
	}
	if l.MaxTokens > 0 {
		d.MaxTokens = min(d.MaxTokens, l.MaxTokens)
	}
	if l.MaxNodes > 0 {
		d.MaxNodes = min(d.MaxNodes, l.MaxNodes)
	}
	if l.MaxDepth > 0 {
		d.MaxDepth = min(d.MaxDepth, l.MaxDepth)
	}
	if l.MaxSteps > 0 {
		d.MaxSteps = min(d.MaxSteps, l.MaxSteps)
	}
	if l.MaxFields > 0 {
		d.MaxFields = min(d.MaxFields, l.MaxFields)
	}
	if l.MaxRows > 0 {
		d.MaxRows = min(d.MaxRows, l.MaxRows)
	}
	if l.MaxCells > 0 {
		d.MaxCells = min(d.MaxCells, l.MaxCells)
	}
	if l.MaxOutputBytes > 0 {
		d.MaxOutputBytes = min(d.MaxOutputBytes, l.MaxOutputBytes)
	}
	if l.MaxNumberBits > 0 {
		d.MaxNumberBits = min(d.MaxNumberBits, l.MaxNumberBits)
	}
	if l.MaxPower > 0 {
		d.MaxPower = min(d.MaxPower, l.MaxPower)
	}
	if l.MaxRoundPlaces > 0 {
		d.MaxRoundPlaces = min(d.MaxRoundPlaces, l.MaxRoundPlaces)
	}
	return d
}

// Options configures a Service. Zero-valued limits use DefaultLimits; positive
// values may tighten but never raise those hard ceilings.
type Options struct {
	Limits Limits
}

// Service is an immutable Formula parser/evaluator configured with deterministic
// bounds. It is safe for concurrent use.
type Service struct {
	limits Limits
}

// New constructs a Formula service.
func New(options Options) *Service {
	return &Service{limits: options.Limits.withDefaults()}
}

// NewService constructs a Formula service with DefaultLimits.
func NewService() *Service {
	return New(Options{})
}

// Limits returns the effective limits used by the service.
func (s *Service) Limits() Limits {
	if s == nil {
		return DefaultLimits()
	}
	return s.limits.withDefaults()
}
