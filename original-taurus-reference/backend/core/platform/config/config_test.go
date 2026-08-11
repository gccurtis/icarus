package config

import (
	"os"
	"path/filepath"
	"testing"
)

func TestLoadOverlaysDefaults(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, "config.yaml")
	// Set only addr; logging.requests should keep its default (true).
	if err := os.WriteFile(path, []byte("server:\n  addr: \":9090\"\n"), 0o644); err != nil {
		t.Fatal(err)
	}

	cfg, err := Load(path)
	if err != nil {
		t.Fatalf("Load: %v", err)
	}
	if cfg.Server.Addr != ":9090" {
		t.Errorf("Addr = %q, want %q", cfg.Server.Addr, ":9090")
	}
	if !cfg.Logging.Requests {
		t.Errorf("Logging.Requests = false, want default true")
	}
	// Unset document tuning keeps its defaults.
	if cfg.Documents.RebaseThreshold != 50 {
		t.Errorf("Documents.RebaseThreshold = %d, want default 50", cfg.Documents.RebaseThreshold)
	}
	if cfg.Documents.HistoryLimit != 0 {
		t.Errorf("Documents.HistoryLimit = %d, want default 0", cfg.Documents.HistoryLimit)
	}
	if cfg.Documents.Layout.PageWidth != 612 || cfg.Documents.Layout.PageHeight != 792 ||
		cfg.Documents.Layout.MaxFontHeight != 24 || cfg.Documents.Layout.MinRowPadding != 4 ||
		cfg.Documents.Layout.CharWidth != 8 {
		t.Errorf("Documents.Layout defaults = %+v", cfg.Documents.Layout)
	}
}

func TestLoadDocumentTuning(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, "config.yaml")
	if err := os.WriteFile(path, []byte("documents:\n  rebase_threshold: 10\n  history_limit: 200\n  layout:\n    max_font_height: 30\n    char_width: 10\n"), 0o644); err != nil {
		t.Fatal(err)
	}

	cfg, err := Load(path)
	if err != nil {
		t.Fatalf("Load: %v", err)
	}
	if cfg.Documents.RebaseThreshold != 10 || cfg.Documents.HistoryLimit != 200 {
		t.Errorf("Documents = %+v, want {10 200}", cfg.Documents)
	}
	if cfg.Documents.Layout.MaxFontHeight != 30 ||
		cfg.Documents.Layout.CharWidth != 10 ||
		cfg.Documents.Layout.PageWidth != 612 ||
		cfg.Documents.Layout.MinRowPadding != 4 {
		t.Errorf("Documents.Layout overlay = %+v", cfg.Documents.Layout)
	}
}

func TestLoadMissingFileReturnsError(t *testing.T) {
	cfg, err := Load(filepath.Join(t.TempDir(), "does-not-exist.yaml"))
	if !os.IsNotExist(err) {
		t.Fatalf("err = %v, want a not-exist error", err)
	}
	// Even on error, the returned config is the usable set of defaults.
	if cfg.Server.Addr != Default().Server.Addr {
		t.Errorf("Addr = %q, want default %q", cfg.Server.Addr, Default().Server.Addr)
	}
}
