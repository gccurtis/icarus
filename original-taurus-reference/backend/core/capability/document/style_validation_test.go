package document_test

import (
	"errors"
	"strings"
	"testing"

	"github.com/gccurtis/taurus-omega/core/capability/document"
)

func TestValidateLinkHrefContract(t *testing.T) {
	t.Parallel()
	for _, href := range []string{
		"https://example.com/x?y=1#z",
		"http://example.com",
		"mailto:a@b.c",
		"/docs/page",
		"#anchor",
		"?query=one",
	} {
		if err := document.ValidateLinkHref(href); err != nil {
			t.Errorf("ValidateLinkHref(%q) = %v", href, err)
		}
	}
	for _, href := range []string{
		"",
		"javascript:alert(1)",
		"java\tscript:alert(1)",
		"data:text/html,<script>",
		"vbscript:msgbox(1)",
		"//evil.example/path",
		`/docs\evil`,
		"relative/path",
		"http:example.com",
		"https://",
		" https://example.com",
	} {
		err := document.ValidateLinkHref(href)
		var styleErr *document.StyleValidationError
		if !errors.As(err, &styleErr) || styleErr.Code != document.StyleValidationCode || styleErr.Field != "link.href" {
			t.Errorf("ValidateLinkHref(%q) = %#v, want typed link.href rejection", href, err)
		}
	}
}

func TestValidateFontContract(t *testing.T) {
	t.Parallel()
	for _, family := range []string{
		"Arial",
		"IBM Plex Sans, Helvetica, 'Segoe UI', sans-serif",
		`Noto Sans, "Noto Color Emoji"`,
		"Source_Code-Pro.2",
		"ヒラギノ角ゴ",
	} {
		if err := document.ValidateFontFamily(family); err != nil {
			t.Errorf("ValidateFontFamily(%q) = %v", family, err)
		}
	}
	for _, family := range []string{
		"",
		"Arial;background:url(//evil.example)",
		"Arial{}",
		"Arial\nserif",
		" Arial",
		strings.Repeat("x", 129),
	} {
		if err := document.ValidateFontFamily(family); err == nil {
			t.Errorf("ValidateFontFamily(%q) accepted", family)
		}
	}

	for _, size := range []string{"16px", "13.5pt", "1.5rem", ".75em", "120%"} {
		if err := document.ValidateFontSize(size); err != nil {
			t.Errorf("ValidateFontSize(%q) = %v", size, err)
		}
	}
	for _, size := range []string{"", "0px", "-1px", "16", "16 px", "calc(100vw)", "1e2px", " 16px"} {
		if err := document.ValidateFontSize(size); err == nil {
			t.Errorf("ValidateFontSize(%q) accepted", size)
		}
	}
}

func TestCanonicalMarkAndCustomTypographyAdmission(t *testing.T) {
	store := document.NewMemoryStore()
	docs := document.New(store, document.Options{})
	doc, err := docs.Create("p", "Doc", oneAtomDoc("hello"))
	if err != nil {
		t.Fatal(err)
	}

	badMark := document.Mark{
		ID:    "bad-link",
		Kind:  document.MarkKindLink,
		Attrs: map[string]string{"href": "javascript:alert(1)"},
		Start: document.Anchor{AtomID: "a1", Offset: 0},
		End:   document.Anchor{AtomID: "a1", Offset: 5},
	}
	_, err = docs.SubmitChanges("p", doc.ID, "u1", document.ChangeSubmission{
		SubmissionID:     "unsafe-link",
		ExpectedRevision: 0,
		Operations: []document.ChangeOp{{
			Op: document.OpAddMark, BlockID: "b1", Mark: &badMark,
		}},
	})
	var styleErr *document.StyleValidationError
	if !errors.As(err, &styleErr) || styleErr.Field != "link.href" {
		t.Fatalf("unsafe link = %v, want typed link.href error", err)
	}

	stored, err := store.DocumentByID("p", doc.ID)
	if err != nil {
		t.Fatal(err)
	}
	changes, err := store.ChangeSetsSince(doc.ID, 0)
	if err != nil {
		t.Fatal(err)
	}
	if stored.Revision != 0 || len(changes) != 0 || len(store.ActivityFacts()) != 1 {
		t.Fatalf("rejection mutated projections: revision=%d changes=%d activity=%d",
			stored.Revision, len(changes), len(store.ActivityFacts()))
	}
	got, err := docs.Get("p", doc.ID)
	if err != nil {
		t.Fatal(err)
	}
	if len(got.Base.Rows[0].Blocks[0].Marks) != 0 {
		t.Fatalf("unsafe mark reached the resolved base: %+v", got.Base.Rows[0].Blocks[0].Marks)
	}
	if docs.StyleValidationRejections() != 1 {
		t.Fatalf("style rejection counter = %d, want 1", docs.StyleValidationRejections())
	}

	_, err = submitChanges(docs, "p", doc.ID, "u1", []document.ChangeOp{{
		Op:      document.OpSetBlockCustomTypography,
		BlockID: "b1",
		CustomTypography: &document.CustomTypography{
			FontFamily: "Arial;background:url(//evil.example)",
			FontSize:   "calc(100vw)",
			Foreground: "red;}html{display:none",
		},
	}})
	if !errors.As(err, &styleErr) || styleErr.Field != "font.family" {
		t.Fatalf("unsafe custom typography = %v, want typed font.family error", err)
	}
}

func TestWholeBasePathsRejectUnsafeStylesAndPreserveSafeStyles(t *testing.T) {
	unsafe := oneAtomDoc("hello")
	unsafe.DefaultTypography = &document.CustomTypography{Foreground: "red;}body{display:none"}
	unsafe.Rows[0].Blocks[0].Marks = []document.Mark{{
		ID:    "m1",
		Kind:  document.MarkKindLink,
		Attrs: map[string]string{"href": "data:text/html,boom"},
		Start: document.Anchor{AtomID: "a1", Offset: 0},
		End:   document.Anchor{AtomID: "a1", Offset: 5},
	}}
	docs := newDocs()
	if _, err := docs.Create("p", "Unsafe", unsafe); err == nil {
		t.Fatal("Create accepted unsafe whole-base style payloads")
	}
	if _, err := docs.ImportMarkdown("p", "Unsafe import", "[hello](javascript:alert(1))"); err == nil {
		t.Fatal("ImportMarkdown bypassed whole-base link validation")
	}

	safe := oneAtomDoc("hello")
	safe.DefaultTypography = &document.CustomTypography{FontFamily: "Georgia", FontSize: "12pt", Foreground: "#222"}
	safe.Template = &document.TemplateInfo{IsTemplate: true}
	safe.Rows[0].Blocks[0].Marks = []document.Mark{{
		ID:    "m1",
		Kind:  document.MarkKindLink,
		Attrs: map[string]string{"href": "/docs/page"},
		Start: document.Anchor{AtomID: "a1", Offset: 0},
		End:   document.Anchor{AtomID: "a1", Offset: 5},
	}}
	source, err := docs.Create("p", "Safe", safe)
	if err != nil {
		t.Fatal(err)
	}
	duplicate, err := docs.Duplicate("p", source.ID, document.Actor{ID: "u1", Name: "Ada"})
	if err != nil {
		t.Fatal(err)
	}
	if duplicate.Base.DefaultTypography == nil ||
		duplicate.Base.DefaultTypography.FontFamily != "Georgia" ||
		duplicate.Base.Rows[0].Blocks[0].Marks[0].Attrs["href"] != "/docs/page" {
		t.Fatalf("safe duplicate changed typography: %+v", duplicate.Base)
	}
	instance, err := docs.CreateFromTemplate("p", source.ID)
	if err != nil {
		t.Fatal(err)
	}
	if instance.Base.DefaultTypography == nil ||
		instance.Base.DefaultTypography.FontFamily != "Georgia" ||
		instance.Base.Rows[0].Blocks[0].Marks[0].Attrs["href"] != "/docs/page" {
		t.Fatalf("safe template instance changed typography: %+v", instance.Base)
	}
	templates, err := docs.Templates("p")
	if err != nil {
		t.Fatal(err)
	}
	if len(templates) != 2 {
		t.Fatalf("template listing count = %d, want source and duplicate", len(templates))
	}
	for _, template := range templates {
		if template.Base.DefaultTypography == nil ||
			template.Base.DefaultTypography.FontFamily != "Georgia" ||
			template.Base.Rows[0].Blocks[0].Marks[0].Attrs["href"] != "/docs/page" {
			t.Fatalf("safe template listing changed typography: %+v", templates)
		}
	}
}

func FuzzValidateLinkHrefControls(f *testing.F) {
	f.Add("https://example.com")
	f.Add("java\tscript:alert(1)")
	f.Add("/docs/page")
	f.Fuzz(func(t *testing.T, raw string) {
		hasControl := false
		for _, r := range raw {
			if r < 0x20 || r == 0x7f {
				hasControl = true
				break
			}
		}
		if hasControl && document.ValidateLinkHref(raw) == nil {
			t.Fatalf("accepted URL containing a control character: %q", raw)
		}
	})
}

func FuzzValidateFontGrammar(f *testing.F) {
	f.Add("IBM Plex Sans")
	f.Add("Arial;background:url(x)")
	f.Add("Noto_Sans-2")
	f.Fuzz(func(t *testing.T, raw string) {
		if document.ValidateFontFamily(raw) != nil {
			return
		}
		for _, r := range raw {
			if (r >= 'a' && r <= 'z') || (r >= 'A' && r <= 'Z') || (r >= '0' && r <= '9') ||
				r == ' ' || r == '\'' || r == '"' || r == ',' || r == '-' || r == '.' || r == '_' ||
				r > 127 {
				continue
			}
			t.Fatalf("accepted forbidden font-family character %q in %q", r, raw)
		}
	})
}
