package wiring

import (
	"os"
	"path/filepath"
	"testing"
)

func TestLogOutputEmptyDirIsStderr(t *testing.T) {
	w, closer, err := logOutput("")
	if err != nil {
		t.Fatalf("logOutput(\"\"): %v", err)
	}
	if w != os.Stderr {
		t.Fatalf("empty dir should log to stderr, got %T", w)
	}
	if closer != nil {
		t.Fatal("stderr must not be returned as a closer")
	}
}

func TestLogOutputDirWritesFile(t *testing.T) {
	dir := t.TempDir()
	w, closer, err := logOutput(dir)
	if err != nil {
		t.Fatalf("logOutput(dir): %v", err)
	}
	if closer == nil {
		t.Fatal("a file output must return a closer")
	}
	defer closer.Close()
	if _, err := w.Write([]byte("hello\n")); err != nil {
		t.Fatalf("write: %v", err)
	}
	path := filepath.Join(dir, logFileName)
	b, err := os.ReadFile(path)
	if err != nil {
		t.Fatalf("read %s: %v", path, err)
	}
	if string(b) != "hello\n" {
		t.Fatalf("log file = %q", b)
	}
}

func TestLogOutputCreatesMissingDir(t *testing.T) {
	dir := filepath.Join(t.TempDir(), "nested", "logs")
	_, closer, err := logOutput(dir)
	if err != nil {
		t.Fatalf("logOutput(missing dir): %v", err)
	}
	if closer != nil {
		closer.Close()
	}
	if _, err := os.Stat(filepath.Join(dir, logFileName)); err != nil {
		t.Fatalf("log file not created in a missing dir: %v", err)
	}
}
