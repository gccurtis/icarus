package document

// Typography cascade. The effective typography of an atom span resolves per
// property (font family, font size, foreground color, background) from the first
// level that sets it:
//
//	inline mark → block override → sub-kind default → document default → built-in
//
// Higher levels win per property, not wholesale — an inline color leaves the
// family to be inherited from a lower level. This mirror lives in the backend so
// the layers are validated and stored consistently; a client renders by running
// the same cascade.

// EffectiveTypography is the resolved per-property typography for an atom span.
type EffectiveTypography struct {
	FontFamily string `json:"fontFamily,omitempty"`
	FontSize   string `json:"fontSize,omitempty"`
	Foreground string `json:"fg,omitempty"`
	Background string `json:"bg,omitempty"`
}

// builtinSubKindTypography is the lowest cascade level: the typography shipped for
// each built-in text sub-kind (body and the heading levels). A custom sub-kind
// has no built-in entry — it contributes only through its style definition.
var builtinSubKindTypography = map[string]CustomTypography{
	SubKindBody:     {FontSize: "16px"},
	SubKindHeading1: {FontSize: "32px"},
	SubKindHeading2: {FontSize: "28px"},
	SubKindHeading3: {FontSize: "24px"},
	SubKindHeading4: {FontSize: "20px"},
	SubKindHeading5: {FontSize: "18px"},
	SubKindHeading6: {FontSize: "16px"},
}

// ResolveTypography computes a block's effective typography, taking each property
// from the first level that sets it: the collapsed inline marks over the span,
// then the block override, the sub-kind default, the document default, and
// finally the built-in sub-kind typography.
func ResolveTypography(base Base, block Block, inline CustomTypography) EffectiveTypography {
	levels := []*CustomTypography{
		&inline,
		blockOverrideTypography(block),
		subKindDefaultTypography(base, block),
		base.DefaultTypography,
		builtinTypography(block.SubKind),
	}
	var eff EffectiveTypography
	for _, level := range levels {
		if level == nil {
			continue
		}
		if eff.FontFamily == "" && level.FontFamily != "" {
			eff.FontFamily = level.FontFamily
		}
		if eff.FontSize == "" && level.FontSize != "" {
			eff.FontSize = level.FontSize
		}
		if eff.Foreground == "" && level.Foreground != "" {
			eff.Foreground = level.Foreground
		}
		if eff.Background == "" && level.Background != "" {
			eff.Background = level.Background
		}
	}
	return eff
}

// blockOverrideTypography is a block's own custom-typography override, if any.
func blockOverrideTypography(block Block) *CustomTypography {
	if block.StyleRef == nil {
		return nil
	}
	return block.StyleRef.Overrides.Custom
}

// subKindDefaultTypography is the custom typography a block's sub-kind sets via
// its style definition. Only a custom (registry-backed) sub-kind contributes
// here; a built-in sub-kind's typography is the built-in level.
func subKindDefaultTypography(base Base, block Block) *CustomTypography {
	if block.Kind != BlockKindText || block.SubKind == "" || builtinTextSubKinds[block.SubKind] {
		return nil
	}
	if definition, _, ok := styleDefinitionByID(base.StyleRegistry, block.SubKind); ok {
		return definition.Custom
	}
	return nil
}

// builtinTypography is the built-in typography for a text block's sub-kind (nil
// for a non-built-in sub-kind or a non-text block).
func builtinTypography(subKind string) *CustomTypography {
	if t, ok := builtinSubKindTypography[subKind]; ok {
		return &t
	}
	return nil
}
