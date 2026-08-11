# style.go

Current state companion for `style.go`. This file mirrors the source exactly in one verbatim block so the documented view cannot drift from the implementation.

## Code breakdown

### Complete source

```go
package document

import (
	"sort"
	"strings"
	"unicode"
	"unicode/utf8"
)

const (
	MaxStyleIDBytes   = 128
	MaxStyleNameBytes = 80
)

type SemanticTypography string

const (
	TypographyBody      SemanticTypography = "body"
	TypographyBodySmall SemanticTypography = "body_small"
	TypographyLabel     SemanticTypography = "label"
	TypographyTitle     SemanticTypography = "title"
	TypographyHeading   SemanticTypography = "heading"
	TypographyDisplay   SemanticTypography = "display"
	TypographyCode      SemanticTypography = "code"
	TypographyQuote     SemanticTypography = "quote"
)

type SemanticSpacing string

const (
	SpacingNone     SemanticSpacing = "none"
	SpacingTight    SemanticSpacing = "tight"
	SpacingCompact  SemanticSpacing = "compact"
	SpacingNormal   SemanticSpacing = "normal"
	SpacingRelaxed  SemanticSpacing = "relaxed"
	SpacingSpacious SemanticSpacing = "spacious"
)

type SemanticPadding string

const (
	PaddingNone    SemanticPadding = "none"
	PaddingCompact SemanticPadding = "compact"
	PaddingNormal  SemanticPadding = "normal"
	PaddingRoomy   SemanticPadding = "roomy"
)

type SemanticBorder string

const (
	BorderNone   SemanticBorder = "none"
	BorderSubtle SemanticBorder = "subtle"
	BorderStrong SemanticBorder = "strong"
	BorderAccent SemanticBorder = "accent"
)

type SemanticBackground string

const (
	BackgroundNone     SemanticBackground = "none"
	BackgroundSubtle   SemanticBackground = "subtle"
	BackgroundMuted    SemanticBackground = "muted"
	BackgroundEmphasis SemanticBackground = "emphasis"
	BackgroundInverse  SemanticBackground = "inverse"
)

type SemanticTone string

const (
	ToneNeutral  SemanticTone = "neutral"
	ToneAccent   SemanticTone = "accent"
	TonePositive SemanticTone = "positive"
	ToneCaution  SemanticTone = "caution"
	ToneCritical SemanticTone = "critical"
)

type StyleOverrideKey string

const (
	OverrideTypography StyleOverrideKey = "typography"
	OverrideSpacing    StyleOverrideKey = "spacing"
	OverridePadding    StyleOverrideKey = "padding"
	OverrideBorder     StyleOverrideKey = "border"
	OverrideBackground StyleOverrideKey = "background"
	OverrideTone       StyleOverrideKey = "tone"
)

type StyleRegistry struct {
	Definitions []StyleDefinition `json:"definitions,omitempty"`
	Defaults    []StyleDefault    `json:"defaults,omitempty"`
}

type StyleDefinition struct {
	ID             string             `json:"id"`
	Name           string             `json:"name"`
	AppliesTo      []string           `json:"appliesTo"`
	Typography     SemanticTypography `json:"typography"`
	Spacing        SemanticSpacing    `json:"spacing"`
	Padding        SemanticPadding    `json:"padding"`
	Border         SemanticBorder     `json:"border"`
	Background     SemanticBackground `json:"background"`
	Tone           SemanticTone       `json:"tone"`
	AllowOverrides []StyleOverrideKey `json:"allowOverrides,omitempty"`
	// Custom is the definition's default free-form typography — the sub-kind level
	// of the typography cascade. Nil means the sub-kind sets no custom typography.
	Custom *CustomTypography `json:"custom,omitempty"`
}

type StyleDefault struct {
	BlockKind string `json:"blockKind"`
	StyleID   string `json:"styleId"`
}

type BlockStyleRef struct {
	StyleID   string         `json:"styleId"`
	Overrides StyleOverrides `json:"overrides,omitempty"`
}

type StyleOverrides struct {
	Typography *SemanticTypography `json:"typography,omitempty"`
	Spacing    *SemanticSpacing    `json:"spacing,omitempty"`
	Padding    *SemanticPadding    `json:"padding,omitempty"`
	Border     *SemanticBorder     `json:"border,omitempty"`
	Background *SemanticBackground `json:"background,omitempty"`
	Tone       *SemanticTone       `json:"tone,omitempty"`
	// CustomTypography is a free-form typography escape hatch: arbitrary font
	// family, size, and color the backend stores verbatim (only length-bounded).
	// Unlike the semantic fields it is not gated by a style definition's
	// allowOverrides list — it is set through the dedicated
	// set_block_custom_typography op.
	Custom *CustomTypography `json:"custom,omitempty"`
}

// Custom typography field length bounds. Values are stored verbatim; these caps
// only keep a single override from being unbounded.
const (
	maxCustomFontFamily = 128
	maxCustomFontSize   = 32
	maxCustomColor      = 64
)

// CustomTypography carries arbitrary (non-semantic) typography for one block, one
// sub-kind, or the document default. Every field is optional; an empty value
// leaves that property to the next level of the cascade. FontSize is a string so
// any CSS unit round-trips ("14px", "1.2em", "120%"). Foreground (fg) and
// Background (bg) are the two color style elements.
type CustomTypography struct {
	FontFamily string `json:"fontFamily,omitempty"`
	FontSize   string `json:"fontSize,omitempty"`
	Foreground string `json:"fg,omitempty"`
	Background string `json:"bg,omitempty"`
}

func (c CustomTypography) empty() bool {
	return strings.TrimSpace(c.FontFamily) == "" && strings.TrimSpace(c.FontSize) == "" &&
		strings.TrimSpace(c.Foreground) == "" && strings.TrimSpace(c.Background) == ""
}

// validCSSColor reports whether s is a safe CSS color the backend will store and
// the frontend can apply directly: a hex color (#rgb / #rgba / #rrggbb /
// #rrggbbaa), a functional color (rgb/rgba/hsl/hsla) over a restricted character
// set, or a plain alphabetic named color. The character restriction keeps a
// value from smuggling extra CSS (';', ':', '{', and the like).
func validCSSColor(s string) bool {
	s = strings.TrimSpace(s)
	if s == "" || len(s) > maxCustomColor {
		return false
	}
	lower := strings.ToLower(s)
	for _, fn := range []string{"rgb(", "rgba(", "hsl(", "hsla("} {
		if strings.HasPrefix(lower, fn) && strings.HasSuffix(s, ")") {
			for _, r := range s {
				if !(r >= '0' && r <= '9') && !(r >= 'a' && r <= 'z') && !(r >= 'A' && r <= 'Z') &&
					r != '.' && r != ',' && r != '%' && r != ' ' && r != '(' && r != ')' {
					return false
				}
			}
			return true
		}
	}
	if strings.HasPrefix(s, "#") {
		hex := s[1:]
		if l := len(hex); l != 3 && l != 4 && l != 6 && l != 8 {
			return false
		}
		for _, r := range hex {
			if !((r >= '0' && r <= '9') || (r >= 'a' && r <= 'f') || (r >= 'A' && r <= 'F')) {
				return false
			}
		}
		return true
	}
	for _, r := range s {
		if !((r >= 'a' && r <= 'z') || (r >= 'A' && r <= 'Z')) {
			return false
		}
	}
	return true
}

type styleUsageSnapshot struct {
	DefaultKinds []string
	Blocks       []styleBlockUsage
}

type styleBlockUsage struct {
	BlockID string
	Kind    string
	Ref     BlockStyleRef
}

func normalizeStoredStyleState(base *Base) {
	normalizeStyleRegistry(&base.StyleRegistry)
	for ri := range base.Rows {
		for bi := range base.Rows[ri].Blocks {
			normalizeBlockStyleRef(&base.Rows[ri].Blocks[bi].StyleRef)
		}
	}
}

func normalizeStyleRegistry(registry *StyleRegistry) {
	for i := range registry.Definitions {
		normalizeStyleDefinition(&registry.Definitions[i])
	}
	for i := range registry.Defaults {
		registry.Defaults[i].BlockKind = strings.TrimSpace(registry.Defaults[i].BlockKind)
		registry.Defaults[i].StyleID = strings.TrimSpace(registry.Defaults[i].StyleID)
	}
	sort.Slice(registry.Definitions, func(i, j int) bool {
		return registry.Definitions[i].ID < registry.Definitions[j].ID
	})
	sort.Slice(registry.Defaults, func(i, j int) bool {
		return registry.Defaults[i].BlockKind < registry.Defaults[j].BlockKind
	})
}

func normalizeStyleDefinition(def *StyleDefinition) {
	def.ID = strings.TrimSpace(def.ID)
	def.Name = strings.TrimSpace(def.Name)
	if def.Typography == "" {
		def.Typography = TypographyBody
	}
	if def.Spacing == "" {
		def.Spacing = SpacingNormal
	}
	if def.Padding == "" {
		def.Padding = PaddingNone
	}
	if def.Border == "" {
		def.Border = BorderNone
	}
	if def.Background == "" {
		def.Background = BackgroundNone
	}
	if def.Tone == "" {
		def.Tone = ToneNeutral
	}
	def.AppliesTo = normalizeStringSet(def.AppliesTo)
	def.AllowOverrides = normalizeOverrideKeySet(def.AllowOverrides)
	def.Custom = normalizeCustomTypography(def.Custom)
}

func normalizeBlockStyleRef(ref **BlockStyleRef) {
	if ref == nil || *ref == nil {
		return
	}
	(*ref).StyleID = strings.TrimSpace((*ref).StyleID)
	normalizeStyleOverrides(&(*ref).Overrides)
	if styleRefClears(*ref) {
		*ref = nil
	}
}

func normalizeStyleOverrides(overrides *StyleOverrides) {
	if overrides == nil {
		return
	}
	if overrides.Typography != nil && *overrides.Typography == "" {
		overrides.Typography = nil
	}
	if overrides.Spacing != nil && *overrides.Spacing == "" {
		overrides.Spacing = nil
	}
	if overrides.Padding != nil && *overrides.Padding == "" {
		overrides.Padding = nil
	}
	if overrides.Border != nil && *overrides.Border == "" {
		overrides.Border = nil
	}
	if overrides.Background != nil && *overrides.Background == "" {
		overrides.Background = nil
	}
	if overrides.Tone != nil && *overrides.Tone == "" {
		overrides.Tone = nil
	}
	overrides.Custom = normalizeCustomTypography(overrides.Custom)
}

// normalizeCustomTypography trims each field and collapses an all-empty value to
// nil, so a cleared custom typography does not linger as an empty object.
func normalizeCustomTypography(custom *CustomTypography) *CustomTypography {
	if custom == nil {
		return nil
	}
	custom.FontFamily = strings.TrimSpace(custom.FontFamily)
	custom.FontSize = strings.TrimSpace(custom.FontSize)
	custom.Foreground = strings.TrimSpace(custom.Foreground)
	custom.Background = strings.TrimSpace(custom.Background)
	if custom.empty() {
		return nil
	}
	return custom
}

func normalizeStringSet(values []string) []string {
	if len(values) == 0 {
		return nil
	}
	seen := make(map[string]bool, len(values))
	out := make([]string, 0, len(values))
	for _, value := range values {
		value = strings.TrimSpace(value)
		if value == "" || seen[value] {
			continue
		}
		seen[value] = true
		out = append(out, value)
	}
	sort.Strings(out)
	if len(out) == 0 {
		return nil
	}
	return out
}

func normalizeOverrideKeySet(values []StyleOverrideKey) []StyleOverrideKey {
	if len(values) == 0 {
		return nil
	}
	seen := make(map[StyleOverrideKey]bool, len(values))
	out := make([]StyleOverrideKey, 0, len(values))
	for _, value := range values {
		if value == "" || seen[value] {
			continue
		}
		seen[value] = true
		out = append(out, value)
	}
	sort.Slice(out, func(i, j int) bool { return out[i] < out[j] })
	if len(out) == 0 {
		return nil
	}
	return out
}

func validStyleID(id string) bool {
	if id == "" || len(id) > MaxStyleIDBytes || !utf8.ValidString(id) || strings.TrimSpace(id) != id {
		return false
	}
	for _, r := range id {
		if unicode.IsControl(r) {
			return false
		}
	}
	return true
}

func validStyleName(name string) bool {
	return name != "" && len(name) <= MaxStyleNameBytes && utf8.ValidString(name) && strings.TrimSpace(name) == name
}

func validSemanticTypography(value SemanticTypography) bool {
	switch value {
	case TypographyBody, TypographyBodySmall, TypographyLabel, TypographyTitle,
		TypographyHeading, TypographyDisplay, TypographyCode, TypographyQuote:
		return true
	}
	return false
}

func validSemanticSpacing(value SemanticSpacing) bool {
	switch value {
	case SpacingNone, SpacingTight, SpacingCompact, SpacingNormal, SpacingRelaxed, SpacingSpacious:
		return true
	}
	return false
}

func validSemanticPadding(value SemanticPadding) bool {
	switch value {
	case PaddingNone, PaddingCompact, PaddingNormal, PaddingRoomy:
		return true
	}
	return false
}

func validSemanticBorder(value SemanticBorder) bool {
	switch value {
	case BorderNone, BorderSubtle, BorderStrong, BorderAccent:
		return true
	}
	return false
}

func validSemanticBackground(value SemanticBackground) bool {
	switch value {
	case BackgroundNone, BackgroundSubtle, BackgroundMuted, BackgroundEmphasis, BackgroundInverse:
		return true
	}
	return false
}

func validSemanticTone(value SemanticTone) bool {
	switch value {
	case ToneNeutral, ToneAccent, TonePositive, ToneCaution, ToneCritical:
		return true
	}
	return false
}

func validStyleOverrideKey(value StyleOverrideKey) bool {
	switch value {
	case OverrideTypography, OverrideSpacing, OverridePadding, OverrideBorder, OverrideBackground, OverrideTone:
		return true
	}
	return false
}

func validateStyleDefinitionPayload(def StyleDefinition) error {
	normalizeStyleDefinition(&def)
	if !validStyleID(def.ID) || !validStyleName(def.Name) || len(def.AppliesTo) == 0 ||
		!validSemanticTypography(def.Typography) || !validSemanticSpacing(def.Spacing) ||
		!validSemanticPadding(def.Padding) || !validSemanticBorder(def.Border) ||
		!validSemanticBackground(def.Background) || !validSemanticTone(def.Tone) {
		return ErrInvalidChangeSet
	}
	seenKinds := make(map[string]bool, len(def.AppliesTo))
	for _, kind := range def.AppliesTo {
		if !blockKinds[kind] || seenKinds[kind] {
			return ErrInvalidChangeSet
		}
		seenKinds[kind] = true
	}
	seenOverrides := make(map[StyleOverrideKey]bool, len(def.AllowOverrides))
	for _, key := range def.AllowOverrides {
		if !validStyleOverrideKey(key) || seenOverrides[key] {
			return ErrInvalidChangeSet
		}
		seenOverrides[key] = true
	}
	return validateCustomTypography(def.Custom)
}

func validateStyleRefPayload(ref BlockStyleRef) error {
	if !validStyleID(strings.TrimSpace(ref.StyleID)) {
		return ErrInvalidChangeSet
	}
	return validateStyleOverridesPayload(ref.Overrides)
}

func validateStyleRefAssignmentPayload(ref *BlockStyleRef) error {
	if ref == nil {
		return ErrInvalidChangeSet
	}
	clone := cloneBlockStyleRef(ref)
	normalizeBlockStyleRef(&clone)
	if clone == nil {
		return nil
	}
	if !validStyleID(clone.StyleID) {
		return ErrInvalidChangeSet
	}
	return validateStyleOverridesPayload(clone.Overrides)
}

func validateStyleOverridesPayload(overrides StyleOverrides) error {
	normalizeStyleOverrides(&overrides)
	if overrides.Typography != nil && !validSemanticTypography(*overrides.Typography) {
		return ErrInvalidChangeSet
	}
	if overrides.Spacing != nil && !validSemanticSpacing(*overrides.Spacing) {
		return ErrInvalidChangeSet
	}
	if overrides.Padding != nil && !validSemanticPadding(*overrides.Padding) {
		return ErrInvalidChangeSet
	}
	if overrides.Border != nil && !validSemanticBorder(*overrides.Border) {
		return ErrInvalidChangeSet
	}
	if overrides.Background != nil && !validSemanticBackground(*overrides.Background) {
		return ErrInvalidChangeSet
	}
	if overrides.Tone != nil && !validSemanticTone(*overrides.Tone) {
		return ErrInvalidChangeSet
	}
	if err := validateCustomTypography(overrides.Custom); err != nil {
		return err
	}
	return nil
}

// validateCustomTypography bounds each free-form field's length. Values are
// otherwise arbitrary — the backend stores whatever the client sends. A nil
// payload is valid (it clears the block's custom typography).
func validateCustomTypography(custom *CustomTypography) error {
	if custom == nil {
		return nil
	}
	if len(strings.TrimSpace(custom.FontFamily)) > maxCustomFontFamily ||
		len(strings.TrimSpace(custom.FontSize)) > maxCustomFontSize ||
		len(strings.TrimSpace(custom.Foreground)) > maxCustomColor ||
		len(strings.TrimSpace(custom.Background)) > maxCustomColor {
		return ErrInvalidChangeSet
	}
	return nil
}

func validStyleRegistry(registry StyleRegistry) bool {
	seenIDs := make(map[string]bool, len(registry.Definitions))
	for _, definition := range registry.Definitions {
		if validateStyleDefinitionPayload(definition) != nil || seenIDs[definition.ID] {
			return false
		}
		seenIDs[definition.ID] = true
	}
	seenDefaults := make(map[string]bool, len(registry.Defaults))
	for _, def := range registry.Defaults {
		if !blockKinds[def.BlockKind] || seenDefaults[def.BlockKind] || !validStyleID(def.StyleID) {
			return false
		}
		style, _, ok := styleDefinitionByID(registry, def.StyleID)
		if !ok || !styleAppliesTo(style, def.BlockKind) {
			return false
		}
		seenDefaults[def.BlockKind] = true
	}
	return true
}

func validStyleSystem(base Base) bool {
	if !validStyleRegistry(base.StyleRegistry) {
		return false
	}
	for _, row := range base.Rows {
		for _, block := range row.Blocks {
			if !validStoredStyleRef(base.StyleRegistry, block) {
				return false
			}
		}
	}
	return true
}

func validStoredStyleRef(registry StyleRegistry, block Block) bool {
	if block.StyleRef == nil {
		return true
	}
	ref := block.StyleRef
	// A style-less ref is valid only as the custom-typography escape hatch: no
	// StyleID, so it may carry ONLY custom typography (semantic overrides need a
	// style definition to gate against). This keeps validStyleSystem true for a
	// block that has custom typography but no assigned style.
	if strings.TrimSpace(ref.StyleID) == "" {
		return onlyCustomOverrides(ref.Overrides) && validateCustomTypography(ref.Overrides.Custom) == nil
	}
	if validateStyleRefPayload(*ref) != nil {
		return false
	}
	definition, _, ok := styleDefinitionByID(registry, ref.StyleID)
	if !ok || !styleAppliesTo(definition, block.Kind) {
		return false
	}
	return overridesAllowed(definition, ref.Overrides)
}

// onlyCustomOverrides reports that a style ref's overrides carry no semantic
// override — only (optionally) custom typography.
func onlyCustomOverrides(o StyleOverrides) bool {
	return o.Typography == nil && o.Spacing == nil && o.Padding == nil &&
		o.Border == nil && o.Background == nil && o.Tone == nil
}

func styleDefinitionByID(registry StyleRegistry, id string) (StyleDefinition, int, bool) {
	for i, definition := range registry.Definitions {
		if definition.ID == id {
			return definition, i, true
		}
	}
	return StyleDefinition{}, -1, false
}

func styleDefaultIndex(defaults []StyleDefault, blockKind string) int {
	for i, def := range defaults {
		if def.BlockKind == blockKind {
			return i
		}
	}
	return -1
}

func styleAppliesTo(definition StyleDefinition, blockKind string) bool {
	for _, kind := range definition.AppliesTo {
		if kind == blockKind {
			return true
		}
	}
	return false
}

func styleRefClears(ref *BlockStyleRef) bool {
	return ref != nil && strings.TrimSpace(ref.StyleID) == "" && emptyStyleOverrides(ref.Overrides)
}

func emptyStyleOverrides(overrides StyleOverrides) bool {
	return overrides.Typography == nil && overrides.Spacing == nil && overrides.Padding == nil &&
		overrides.Border == nil && overrides.Background == nil && overrides.Tone == nil &&
		overrides.Custom == nil
}

func overridesAllowed(definition StyleDefinition, overrides StyleOverrides) bool {
	allowed := make(map[StyleOverrideKey]bool, len(definition.AllowOverrides))
	for _, key := range definition.AllowOverrides {
		allowed[key] = true
	}
	for _, key := range overrideKeys(overrides) {
		if !allowed[key] {
			return false
		}
	}
	return validateStyleOverridesPayload(overrides) == nil
}

func overrideKeys(overrides StyleOverrides) []StyleOverrideKey {
	var out []StyleOverrideKey
	if overrides.Typography != nil {
		out = append(out, OverrideTypography)
	}
	if overrides.Spacing != nil {
		out = append(out, OverrideSpacing)
	}
	if overrides.Padding != nil {
		out = append(out, OverridePadding)
	}
	if overrides.Border != nil {
		out = append(out, OverrideBorder)
	}
	if overrides.Background != nil {
		out = append(out, OverrideBackground)
	}
	if overrides.Tone != nil {
		out = append(out, OverrideTone)
	}
	return out
}

func cloneStyleRegistry(registry StyleRegistry) StyleRegistry {
	if len(registry.Definitions) > 0 {
		definitions := registry.Definitions
		registry.Definitions = make([]StyleDefinition, len(definitions))
		for i, definition := range definitions {
			registry.Definitions[i] = cloneStyleDefinition(definition)
		}
	}
	if len(registry.Defaults) > 0 {
		registry.Defaults = append([]StyleDefault(nil), registry.Defaults...)
	}
	return registry
}

func cloneStyleDefinition(definition StyleDefinition) StyleDefinition {
	definition.AppliesTo = append([]string(nil), definition.AppliesTo...)
	definition.AllowOverrides = append([]StyleOverrideKey(nil), definition.AllowOverrides...)
	if definition.Custom != nil {
		custom := *definition.Custom
		definition.Custom = &custom
	}
	return definition
}

func cloneBlockStyleRef(ref *BlockStyleRef) *BlockStyleRef {
	if ref == nil {
		return nil
	}
	clone := *ref
	clone.Overrides = cloneStyleOverrides(clone.Overrides)
	return &clone
}

func cloneStyleOverrides(overrides StyleOverrides) StyleOverrides {
	if overrides.Typography != nil {
		value := *overrides.Typography
		overrides.Typography = &value
	}
	if overrides.Spacing != nil {
		value := *overrides.Spacing
		overrides.Spacing = &value
	}
	if overrides.Padding != nil {
		value := *overrides.Padding
		overrides.Padding = &value
	}
	if overrides.Border != nil {
		value := *overrides.Border
		overrides.Border = &value
	}
	if overrides.Background != nil {
		value := *overrides.Background
		overrides.Background = &value
	}
	if overrides.Tone != nil {
		value := *overrides.Tone
		overrides.Tone = &value
	}
	if overrides.Custom != nil {
		value := *overrides.Custom
		overrides.Custom = &value
	}
	return overrides
}

func styleUsage(base Base, styleID string) styleUsageSnapshot {
	usage := styleUsageSnapshot{}
	for _, def := range base.StyleRegistry.Defaults {
		if def.StyleID == styleID {
			usage.DefaultKinds = append(usage.DefaultKinds, def.BlockKind)
		}
	}
	for _, row := range base.Rows {
		for _, block := range row.Blocks {
			if block.StyleRef != nil && block.StyleRef.StyleID == styleID {
				usage.Blocks = append(usage.Blocks, styleBlockUsage{
					BlockID: block.ID,
					Kind:    block.Kind,
					Ref:     *cloneBlockStyleRef(block.StyleRef),
				})
			}
		}
	}
	return usage
}

func applyStyleOp(base Base, op ChangeOp) (Base, error) {
	switch op.Op {
	case OpPutStyleDefinition:
		if op.Style == nil {
			return Base{}, ErrInvalidChangeSet
		}
		definition := cloneStyleDefinition(*op.Style)
		normalizeStyleDefinition(&definition)
		if validateStyleDefinitionPayload(definition) != nil {
			return Base{}, ErrInvalidChangeSet
		}
		if _, index, ok := styleDefinitionByID(base.StyleRegistry, definition.ID); ok {
			base.StyleRegistry.Definitions[index] = definition
		} else {
			base.StyleRegistry.Definitions = append(base.StyleRegistry.Definitions, definition)
		}
		normalizeStyleRegistry(&base.StyleRegistry)
		if !validStyleSystem(base) {
			return Base{}, ErrConflict
		}
		return base, nil

	case OpDeleteStyleDefinition:
		_, index, ok := styleDefinitionByID(base.StyleRegistry, op.StyleID)
		if !ok {
			return Base{}, ErrConflict
		}
		usage := styleUsage(base, op.StyleID)
		if len(usage.DefaultKinds) > 0 || len(usage.Blocks) > 0 {
			return Base{}, ErrConflict
		}
		defs := base.StyleRegistry.Definitions
		base.StyleRegistry.Definitions = append(defs[:index:index], defs[index+1:]...)
		return base, nil

	case OpSetStyleDefault:
		if !blockKinds[op.DefaultBlockKind] {
			return Base{}, ErrInvalidChangeSet
		}
		if op.StyleID != "" {
			definition, _, ok := styleDefinitionByID(base.StyleRegistry, op.StyleID)
			if !ok || !styleAppliesTo(definition, op.DefaultBlockKind) {
				return Base{}, ErrConflict
			}
		}
		index := styleDefaultIndex(base.StyleRegistry.Defaults, op.DefaultBlockKind)
		if op.StyleID == "" {
			if index >= 0 {
				defaults := base.StyleRegistry.Defaults
				base.StyleRegistry.Defaults = append(defaults[:index:index], defaults[index+1:]...)
			}
			return base, nil
		}
		if index >= 0 {
			base.StyleRegistry.Defaults[index].StyleID = op.StyleID
		} else {
			base.StyleRegistry.Defaults = append(base.StyleRegistry.Defaults, StyleDefault{BlockKind: op.DefaultBlockKind, StyleID: op.StyleID})
		}
		normalizeStyleRegistry(&base.StyleRegistry)
		if !validStyleSystem(base) {
			return Base{}, ErrConflict
		}
		return base, nil

	case OpAssignBlockStyle:
		ri, bi, ok := blockLoc(base.Rows, op.BlockID)
		if !ok {
			return Base{}, ErrConflict
		}
		if op.StyleRef == nil {
			base.Rows[ri].Blocks[bi].StyleRef = nil
			return base, nil
		}
		ref := cloneBlockStyleRef(op.StyleRef)
		normalizeBlockStyleRef(&ref)
		if ref == nil {
			base.Rows[ri].Blocks[bi].StyleRef = nil
			return base, nil
		}
		definition, _, ok := styleDefinitionByID(base.StyleRegistry, ref.StyleID)
		if !ok || !styleAppliesTo(definition, base.Rows[ri].Blocks[bi].Kind) || !overridesAllowed(definition, ref.Overrides) {
			return Base{}, ErrConflict
		}
		base.Rows[ri].Blocks[bi].StyleRef = ref
		return base, nil

	case OpSetBlockStyleOverrides:
		if op.StyleOverrides == nil {
			return Base{}, ErrInvalidChangeSet
		}
		ri, bi, ok := blockLoc(base.Rows, op.BlockID)
		if !ok {
			return Base{}, ErrConflict
		}
		block := &base.Rows[ri].Blocks[bi]
		if block.StyleRef == nil || block.StyleRef.StyleID == "" {
			return Base{}, ErrConflict
		}
		definition, _, ok := styleDefinitionByID(base.StyleRegistry, block.StyleRef.StyleID)
		if !ok {
			return Base{}, ErrConflict
		}
		overrides := cloneStyleOverrides(*op.StyleOverrides)
		normalizeStyleOverrides(&overrides)
		if !overridesAllowed(definition, overrides) {
			return Base{}, ErrConflict
		}
		block.StyleRef.Overrides = overrides
		return base, nil

	case OpSetBlockCustomTypography:
		ri, bi, ok := blockLoc(base.Rows, op.BlockID)
		if !ok {
			return Base{}, ErrConflict
		}
		block := &base.Rows[ri].Blocks[bi]
		// Clearing: drop the custom typography, then let normalization nil a ref
		// that no longer carries anything.
		if op.CustomTypography == nil || op.CustomTypography.empty() {
			if block.StyleRef != nil {
				block.StyleRef.Overrides.Custom = nil
				normalizeBlockStyleRef(&block.StyleRef)
			}
			return base, nil
		}
		// Custom typography is ungated by the semantic allowOverrides list, so a
		// block needs no assigned style to carry it: create a bare ref if absent.
		if block.StyleRef == nil {
			block.StyleRef = &BlockStyleRef{}
		}
		custom := *op.CustomTypography
		block.StyleRef.Overrides.Custom = &custom
		normalizeBlockStyleRef(&block.StyleRef)
		return base, nil

	case OpReplaceStyle:
		oldDefinition, oldIndex, ok := styleDefinitionByID(base.StyleRegistry, op.StyleID)
		if !ok {
			return Base{}, ErrConflict
		}
		replacement, _, ok := styleDefinitionByID(base.StyleRegistry, op.ReplacementStyleID)
		if !ok || replacement.ID == oldDefinition.ID {
			return Base{}, ErrConflict
		}
		usage := styleUsage(base, oldDefinition.ID)
		for _, blockKind := range usage.DefaultKinds {
			if !styleAppliesTo(replacement, blockKind) {
				return Base{}, ErrConflict
			}
		}
		for _, block := range usage.Blocks {
			if !styleAppliesTo(replacement, block.Kind) || !overridesAllowed(replacement, block.Ref.Overrides) {
				return Base{}, ErrConflict
			}
		}
		for i := range base.StyleRegistry.Defaults {
			if base.StyleRegistry.Defaults[i].StyleID == oldDefinition.ID {
				base.StyleRegistry.Defaults[i].StyleID = replacement.ID
			}
		}
		for ri := range base.Rows {
			for bi := range base.Rows[ri].Blocks {
				ref := base.Rows[ri].Blocks[bi].StyleRef
				if ref != nil && ref.StyleID == oldDefinition.ID {
					ref.StyleID = replacement.ID
				}
			}
		}
		defs := base.StyleRegistry.Definitions
		base.StyleRegistry.Definitions = append(defs[:oldIndex:oldIndex], defs[oldIndex+1:]...)
		normalizeStyleRegistry(&base.StyleRegistry)
		if !validStyleSystem(base) {
			return Base{}, ErrConflict
		}
		return base, nil
	}
	return Base{}, ErrInvalidChangeSet
}
```

This section reproduces the current source exactly.
