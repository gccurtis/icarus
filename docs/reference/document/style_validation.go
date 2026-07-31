package document

import (
	"fmt"
	"math"
	"net/url"
	"regexp"
	"strconv"
	"strings"
	"unicode"
	"unicode/utf8"
)

const (
	// StyleValidationCode is the stable public code for a rejected link, color,
	// font family, or font size.
	StyleValidationCode = "document.invalid_style"
	// MaxLinkHrefBytes bounds one stored link target.
	MaxLinkHrefBytes = 2048
)

var fontSizePattern = regexp.MustCompile(`^(?:[0-9]+(?:\.[0-9]+)?|\.[0-9]+)(?:px|pt|em|rem|%)$`)

// StyleValidationError identifies a rejected style field without retaining or
// rendering the unsafe value. It deliberately matches both invalid-content and
// invalid-change sentinels so callers can keep their existing broad handling
// while HTTP clients receive Code and Field.
type StyleValidationError struct {
	Code       string `json:"code"`
	Field      string `json:"field"`
	Reason     string `json:"-"`
	ProjectID  string `json:"-"`
	DocumentID string `json:"-"`
}

func (e *StyleValidationError) Error() string {
	reason := e.Reason
	if reason == "" {
		reason = "value is not allowed"
	}
	message := fmt.Sprintf("%s: %s: %s", e.Code, e.Field, reason)
	if e.ProjectID != "" {
		message += " project=" + e.ProjectID
	}
	if e.DocumentID != "" {
		message += " document=" + e.DocumentID
	}
	return message
}

func (e *StyleValidationError) Is(target error) bool {
	return target == ErrInvalidChangeSet || target == ErrInvalidContent
}

func invalidStyle(field, reason string) error {
	return &StyleValidationError{Code: StyleValidationCode, Field: field, Reason: reason}
}

// ValidateLinkHref accepts absolute http/https/mailto URLs and root-relative,
// fragment, or query references. It rejects controls before parsing, leading or
// trailing whitespace, protocol-relative URLs, backslashes, malformed absolute
// URLs, and every other scheme. The accepted string is never rewritten.
func ValidateLinkHref(raw string) error {
	if raw == "" || len(raw) > MaxLinkHrefBytes || !utf8.ValidString(raw) ||
		raw != strings.TrimSpace(raw) {
		return invalidStyle("link.href", "must be a canonical, bounded URL")
	}
	for _, r := range raw {
		if unicode.IsControl(r) {
			return invalidStyle("link.href", "control characters are not allowed")
		}
	}
	if strings.ContainsRune(raw, '\\') || strings.HasPrefix(raw, "//") {
		return invalidStyle("link.href", "protocol-relative and backslash URLs are not allowed")
	}

	parsed, err := url.Parse(raw)
	if err != nil {
		return invalidStyle("link.href", "URL is malformed")
	}
	if parsed.Scheme == "" {
		if strings.HasPrefix(raw, "/") || strings.HasPrefix(raw, "#") || strings.HasPrefix(raw, "?") {
			return nil
		}
		return invalidStyle("link.href", "relative URLs must begin with /, #, or ?")
	}

	switch strings.ToLower(parsed.Scheme) {
	case "http", "https":
		if parsed.Host == "" || parsed.Opaque != "" {
			return invalidStyle("link.href", "http and https URLs require a host")
		}
	case "mailto":
		if parsed.Opaque == "" {
			return invalidStyle("link.href", "mailto URLs require a recipient")
		}
	default:
		return invalidStyle("link.href", "URL scheme is not allowed")
	}
	return nil
}

// ValidateFontFamily accepts a bounded font-family data string containing only
// Unicode letters/digits, spaces, quotes, commas, hyphens, periods, and
// underscores. At least one letter or digit is required.
func ValidateFontFamily(raw string) error {
	if raw == "" || len(raw) > maxCustomFontFamily || !utf8.ValidString(raw) ||
		raw != strings.TrimSpace(raw) {
		return invalidStyle("font.family", "must be a canonical, bounded font family")
	}
	hasName := false
	for _, r := range raw {
		switch {
		case unicode.IsLetter(r), unicode.IsDigit(r):
			hasName = true
		case r == ' ', r == '\'', r == '"', r == ',', r == '-', r == '.', r == '_':
		default:
			return invalidStyle("font.family", "contains a character outside the font-family grammar")
		}
	}
	if !hasName {
		return invalidStyle("font.family", "must contain a letter or digit")
	}
	return nil
}

// ValidateFontSize accepts a positive decimal followed immediately by px, pt,
// em, rem, or %. The accepted string is never normalized.
func ValidateFontSize(raw string) error {
	if raw == "" || len(raw) > maxCustomFontSize || raw != strings.TrimSpace(raw) ||
		!fontSizePattern.MatchString(raw) {
		return invalidStyle("font.size", "must be a positive decimal followed by px, pt, em, rem, or %")
	}
	unitAt := strings.IndexFunc(raw, func(r rune) bool {
		return (r < '0' || r > '9') && r != '.'
	})
	if unitAt < 0 {
		return invalidStyle("font.size", "unit is required")
	}
	value, err := strconv.ParseFloat(raw[:unitAt], 64)
	if err != nil || value <= 0 || math.IsInf(value, 0) || math.IsNaN(value) {
		return invalidStyle("font.size", "numeric value must be positive")
	}
	return nil
}

// ValidateCSSColor accepts the deliberately small color grammar shared by
// inline marks and custom typography: #rgb/#rgba/#rrggbb/#rrggbbaa,
// rgb/rgba/hsl/hsla functions over a restricted character set, or an ASCII
// alphabetic named color.
func ValidateCSSColor(raw string) error {
	s := strings.TrimSpace(raw)
	if s == "" || s != raw || len(s) > maxCustomColor {
		return invalidStyle("color.value", "must be a canonical, bounded CSS color")
	}
	lower := strings.ToLower(s)
	for _, fn := range []string{"rgb(", "rgba(", "hsl(", "hsla("} {
		if strings.HasPrefix(lower, fn) && strings.HasSuffix(s, ")") {
			for _, r := range s {
				if !(r >= '0' && r <= '9') && !(r >= 'a' && r <= 'z') && !(r >= 'A' && r <= 'Z') &&
					r != '.' && r != ',' && r != '%' && r != ' ' && r != '(' && r != ')' {
					return invalidStyle("color.value", "contains a character outside the color grammar")
				}
			}
			return nil
		}
	}
	if strings.HasPrefix(s, "#") {
		hex := s[1:]
		if l := len(hex); l != 3 && l != 4 && l != 6 && l != 8 {
			return invalidStyle("color.value", "hex colors must contain 3, 4, 6, or 8 digits")
		}
		for _, r := range hex {
			if !((r >= '0' && r <= '9') || (r >= 'a' && r <= 'f') || (r >= 'A' && r <= 'F')) {
				return invalidStyle("color.value", "hex color contains a non-hex digit")
			}
		}
		return nil
	}
	for _, r := range s {
		if !((r >= 'a' && r <= 'z') || (r >= 'A' && r <= 'Z')) {
			return invalidStyle("color.value", "named colors must be alphabetic")
		}
	}
	return nil
}

// ValidateCustomTypography applies the canonical font and color validators to
// every present field. Empty fields are absent cascade values and remain valid.
func ValidateCustomTypography(custom CustomTypography) error {
	if custom.FontFamily != "" {
		if err := ValidateFontFamily(custom.FontFamily); err != nil {
			return err
		}
	}
	if custom.FontSize != "" {
		if err := ValidateFontSize(custom.FontSize); err != nil {
			return err
		}
	}
	if custom.Foreground != "" {
		if err := ValidateCSSColor(custom.Foreground); err != nil {
			return remapStyleField(err, "color.fg")
		}
	}
	if custom.Background != "" {
		if err := ValidateCSSColor(custom.Background); err != nil {
			return remapStyleField(err, "color.bg")
		}
	}
	return nil
}

func remapStyleField(err error, field string) error {
	if style, ok := err.(*StyleValidationError); ok {
		return &StyleValidationError{
			Code: style.Code, Field: field, Reason: style.Reason,
			ProjectID: style.ProjectID, DocumentID: style.DocumentID,
		}
	}
	return err
}
