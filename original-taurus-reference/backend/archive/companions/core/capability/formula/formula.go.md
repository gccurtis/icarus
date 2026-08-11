# formula.go

`formula.go` establishes Formula's public package boundary: a versioned, pure,
deterministic expression service with structured failures and hard resource ceilings.
Formula owns only parsing, typed in-memory evaluation, and bounded table-shaped
computation; it has no storage, network, clock, randomness, model, or cross-capability
effects.

The error model separates stable machine-readable kinds from explanatory messages and
attaches byte spans to failures. The limits model bounds source and tree size, work,
table shape, display output, exact-number size, powers, and rounding; callers may
tighten those production ceilings but cannot raise them.

## Code breakdown

### Package contract

```go
// Package formula implements Taurus's pure, deterministic expression language.
// It owns parsing, typed in-memory values, evaluation, and bounded table-shaped
// queries. It deliberately performs no storage, network, clock, random, model,
// or cross-capability work.
package formula

```

The package comment defines Formula as a headless computation boundary and explicitly
lists the effects it must never perform. Keeping that constraint beside the package
declaration makes purity part of the implementation contract.

### Formatting dependency

```go
import "fmt"

```

`fmt` renders stable error text and interpolates the contextual details supplied by
parser, evaluator, and value-model call sites.

### Language version

```go
// LanguageVersion identifies the syntax and semantics implemented by this
// package. Stored expressions will eventually pin this value; for now it makes
// the compatibility boundary explicit in the headless API.
const LanguageVersion = "formula/v1"

```

`LanguageVersion` names the exact syntax-and-semantics contract implemented here. Parsed
expressions carry this value so evaluation can reject incompatible trees instead of
silently changing their meaning.

### Stable error categories

```go
// ErrorKind is a stable machine-readable Formula failure category. Messages
// explain the particular failure but are not themselves a compatibility
// contract.
type ErrorKind string

```

`ErrorKind` and its constants provide the machine-readable failure vocabulary. The
categories distinguish syntax, names and functions, arity and type errors, numeric and
indexing failures, malformed tables, promotion cardinality failures, deterministic
limit exhaustion, and version incompatibility.

### The ErrorParse constants

```go
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

```

These constants are Formula's stable failure vocabulary. `ErrorCardinality` reports a
strict promotion without exactly one row or an optional promotion with more than one;
callers should depend on kinds rather than explanatory message text.

### Source spans

```go
// Span is a half-open UTF-8 byte range in Formula source.
type Span struct {
	Start int `json:"start"`
	End   int `json:"end"`
}

```

A `Span` is a half-open byte interval into UTF-8 Formula source. Errors and AST nodes
use byte coordinates so a caller can point back into the original source without the
engine owning presentation concerns.

### Structured Formula errors

```go
// FormulaError is a safe structured parser, evaluator, or value-model error.
// Limit is populated only for ErrorLimitExceeded.
type FormulaError struct {
	Kind    ErrorKind `json:"kind"`
	Message string    `json:"message"`
	Span    Span      `json:"span"`
	Limit   string    `json:"limit,omitempty"`
}

```

`FormulaError` carries a stable kind, safe explanatory message, source span, and an
optional limit name. `Error` supplies readable text, while `errorAt` and `limitError`
centralize construction so every layer reports the same shape.

### The FormulaError Error operation

```go
func (e *FormulaError) Error() string {
	if e == nil {
		return ""
	}
	if e.Span != (Span{}) {
		return fmt.Sprintf("%s at [%d:%d]: %s", e.Kind, e.Span.Start, e.Span.End, e.Message)
	}
	return fmt.Sprintf("%s: %s", e.Kind, e.Message)
}

```

This block implements FormulaError Error as one bounded part of Formula parsing or evaluation.

### The errorAt operation

```go
func errorAt(kind ErrorKind, span Span, format string, args ...any) *FormulaError {
	return &FormulaError{Kind: kind, Message: fmt.Sprintf(format, args...), Span: span}
}

```

This block implements errorAt as one bounded part of Formula parsing or evaluation.

### The limitError operation

```go
func limitError(span Span, name string) *FormulaError {
	return &FormulaError{
		Kind:    ErrorLimitExceeded,
		Message: fmt.Sprintf("formula exceeded the %s limit", name),
		Span:    span,
		Limit:   name,
	}
}

```

This block implements limitError as one bounded part of Formula parsing or evaluation.

### Deterministic resource limits

```go
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

```

`Limits` names every deterministic ceiling: source bytes, tokens, AST nodes and depth,
evaluation steps, structured dimensions, display-output bytes, exact-number bits,
exponent magnitude, and rounding places. `defaultLimits` is the hard production profile;
`withDefaults` fills zero fields and takes the minimum for positive fields, so callers
may tighten but never enlarge any ceiling.

### Implementation block

```go
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

```

This block contains one logical part of the Formula implementation.

### The DefaultLimits operation

```go
// DefaultLimits returns the production-safe bounds for one headless
// evaluation.
func DefaultLimits() Limits { return defaultLimits }

```

This block implements DefaultLimits as one bounded part of Formula parsing or evaluation.

### The Limits withDefaults operation

```go
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

```

This block implements Limits withDefaults as one bounded part of Formula parsing or evaluation.

### Service options

```go
// Options configures a Service. Zero-valued limits use DefaultLimits; positive
// values may tighten but never raise those hard ceilings.
type Options struct {
	Limits Limits
}

```

`Options` is the construction surface. Its `Limits` value permits partial, tightening
overrides while every zero field inherits the production default.

### Immutable service state

```go
// Service is an immutable Formula parser/evaluator configured with deterministic
// bounds. It is safe for concurrent use.
type Service struct {
	limits Limits
}

```

`Service` stores only its effective limits. Because that configuration is immutable and
request data lives in evaluation-local state, one service can be shared safely by
concurrent callers.

### Service constructors

```go
// New constructs a Formula service.
func New(options Options) *Service {
	return &Service{limits: options.Limits.withDefaults()}
}

```

`New` resolves partial options through the hard-ceiling policy, while `NewService`
offers the default configuration. The pair keeps stricter per-use services possible
without permitting a caller to relax production safety bounds.

### The NewService operation

```go
// NewService constructs a Formula service with DefaultLimits.
func NewService() *Service {
	return New(Options{})
}

```

This block implements NewService as one bounded part of Formula parsing or evaluation.

### Effective-limit access

```go
// Limits returns the effective limits used by the service.
func (s *Service) Limits() Limits {
	if s == nil {
		return DefaultLimits()
	}
	return s.limits.withDefaults()
}
```

`Limits` exposes the service's effective bounds, treats a nil receiver as the default
service, and reapplies `withDefaults` before returning. The returned value is a copy,
preserving immutable concurrent configuration.
