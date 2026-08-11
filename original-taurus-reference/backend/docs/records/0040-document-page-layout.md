# 0040 Document page layout

This increment makes page geometry revisioned document content. Each Base owns
width, height, and four margins plus a snapshot of the server's row metrics.
Capturing the effective metrics prevents a later configuration change from
silently changing existing documents.

## `core/capability/document/layout.go`

### Define and validate page geometry and captured rules

```go
type PageLayout struct {
	Width, Height LayoutUnit
	// four margins
}
```

All dimensions are integer typographic points. Validation requires positive
content width and enough usable height for the largest permitted row. Built-in
defaults are returned as values rather than mutable package globals.

## `core/capability/document/layout.go.md`

### Keep layout implementation verbatim

The companion contains the complete geometry, defaults, validation, legacy
normalization, and projection code.

## `core/capability/document/document.go`

### Put layout and rules in Base

```go
type Base struct {
	PageLayout  PageLayout
	LayoutRules LayoutRules
	Rows        []Row
}
```

`Documents.Options` accepts defaults for new documents. `Create` accepts an
optional page layout but always captures trusted service rules. Reads, lists,
rename responses, appends, and rebase normalize older stored bases whose new
fields are absent.

## `core/capability/document/document.go.md`

### Update the service companion

The companion now mirrors the extended Base, configured defaults, capture step,
and legacy-read normalization.

## `core/capability/document/changeset.go`

### Replay and invert whole-Base page changes

```go
OpSetPageLayout OpType = "set_page_layout"
```

The apply pipeline now threads `Base` rather than just `[]Row`.
`set_page_layout` validates against captured rules and stores the old geometry
as its exact inverse, so ordinary undo and redo work without a separate system.

## `core/capability/document/changeset.go.md`

### Explain document-level replay

The companion distinguishes the sole document-wide operation from ID-addressed
structural operations and describes its validation/inverse behavior.

## `core/handlers/document/document.go`

### Accept optional page geometry on create

The create handler binds `pageLayout`, while layout rules remain server-owned.
Invalid content or geometry returns the shared 400 response.

## `core/handlers/document/document.go.md`

### Keep the endpoint companion current

The companion reproduces the new create request shape and error wording.

## `core/platform/config/config.go`

### Add document layout defaults

`documents.layout` configures page size, margins, maximum font height, minimum
row padding, and the maximum row-height increase. Defaults are 612×792 points,
72-point margins, 24-point font height, 4-point padding, and a 144-point cap.

## `core/platform/config/config.go.md`

### Describe the captured layout configuration

The companion distinguishes page/row defaults from prompt-block tuning and
keeps the source blocks exact.

## `core/platform/config/config_test.go`

### Prove defaults and partial overlays

Tests verify every default survives unrelated manifests and that a partial
layout overlay changes only specified fields.

## `core/wiring/wiring.go`

### Translate config into domain units

The composition root converts integer manifest values into document
`LayoutUnit` values and supplies both layout/rules to the service.

## `core/wiring/wiring.go.md`

### Document composition ownership

The companion explains that wiring supplies creation defaults while each Base
owns its captured effective values.

## `etc/config.yaml`

### Surface all layout knobs

The committed template documents every `documents.layout` value with concrete
defaults; no local secret/config overlay is modified.

## `core/platform/storage/sqlite/sqlite_test.go`

### Prove opaque JSON round-trip

SQLite needs no schema migration because Base and operations are opaque JSON.
The round-trip test now includes page layout, captured rules, and both styles.

## `core/transport/transport_test.go`

### Exercise page layout change and undo

The HTTP test appends `set_page_layout`, observes resolved geometry, and undoes
it through the standard compensation endpoint.

## `dev-test/changesets/{run.sh,manual.md}`

### Exercise and explain page revisions

The executable suite changes and undoes page geometry. The manual documents
units, bounds, and the fact that effective row metrics travel with each Base.

## `dev-test/documents/manual.md`

### Replace the stale pre-change-set model

The creation walkthrough now shows page layout/rules/styles and correctly says
reads return stored Base plus pending revisions.

## `docs/architecture/configuration.md`

### Add the complete manifest schema

The configuration table lists geometry, margin, baseline, and cap defaults.

## `docs/architecture/persistence.md`

### Record layout persistence and configuration

The persistence doc explains that layout rides inside opaque Base JSON and adds
the new settings to its configuration map.

## `docs/backend-guide.md`

### Show create and change request shapes

The practical guide includes optional page geometry, resolved layout/style
fields, and all three new operation names.

## `docs/architecture/capabilities/documents/{README.md,data-model.md}`

### Make Base ownership explicit

The hierarchy, field tables, operation catalog, validation rules, and endpoint
table now treat page geometry and captured metrics as current code.

## `docs/orientation/README.md`

### Orient contributors to captured layout

The capability summary and vocabulary now state that layout is revisioned Base
content rather than renderer-only state.
