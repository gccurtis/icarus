package connector

import (
	"testing"
	"time"
)

func newTestConnectors() *Connectors {
	return New(NewMemoryStore(func() time.Time { return time.Unix(0, 0).UTC() }))
}

func TestCreateAssignsIDAndDefaults(t *testing.T) {
	c := newTestConnectors()
	got, err := c.Create("proj1", Actor{ID: "u1", Name: "Ada"}, "Sales drive", SubKindLocalFolder)
	if err != nil {
		t.Fatalf("Create: %v", err)
	}
	if got.ID == "" {
		t.Fatal("expected an assigned ID")
	}
	if got.Name != "Sales drive" || got.SubKind != SubKindLocalFolder || got.CreatorID != "u1" {
		t.Fatalf("unexpected connector: %+v", got)
	}
	if got.Path != "" {
		t.Fatalf("expected empty path before configure, got %q", got.Path)
	}
}

func TestCreateRejectsBadInput(t *testing.T) {
	c := newTestConnectors()
	if _, err := c.Create("proj1", Actor{ID: "u1"}, "   ", SubKindLocalFolder); err != ErrInvalidName {
		t.Fatalf("blank name: got %v, want ErrInvalidName", err)
	}
	if _, err := c.Create("proj1", Actor{ID: "u1"}, "ok", SubKind("dropbox")); err != ErrInvalidSubKind {
		t.Fatalf("bad subkind: got %v, want ErrInvalidSubKind", err)
	}
}

func TestConfigureSetsEndpointAndRejectsBlank(t *testing.T) {
	c := newTestConnectors()
	made, _ := c.Create("p", Actor{ID: "u1"}, "drive", SubKindLocalFolder)
	got, err := c.Configure("p", made.ID, "http://127.0.0.1:9099")
	if err != nil {
		t.Fatalf("Configure: %v", err)
	}
	if got.Path != "http://127.0.0.1:9099" {
		t.Fatalf("endpoint = %q", got.Path)
	}
	if _, err := c.Configure("p", made.ID, "   "); err != ErrInvalidPath {
		t.Fatalf("blank endpoint: got %v, want ErrInvalidPath", err)
	}
}

func TestGetRenameDeleteAndProjectIsolation(t *testing.T) {
	c := newTestConnectors()
	made, _ := c.Create("p", Actor{ID: "u1"}, "drive", SubKindLocalFolder)
	if _, err := c.Get("other", made.ID); err != ErrNotFound {
		t.Fatalf("cross-project Get: got %v, want ErrNotFound", err)
	}
	renamed, err := c.Rename("p", Actor{ID: "u1"}, made.ID, "Renamed")
	if err != nil || renamed.Name != "Renamed" {
		t.Fatalf("Rename: %v %+v", err, renamed)
	}
	if err := c.Delete("p", Actor{ID: "u1"}, made.ID); err != nil {
		t.Fatalf("Delete: %v", err)
	}
	if _, err := c.Get("p", made.ID); err != ErrNotFound {
		t.Fatalf("after delete: got %v, want ErrNotFound", err)
	}
}

func TestSetSyncStateReflectsInGet(t *testing.T) {
	s := NewMemoryStore(nil)
	if err := s.InsertConnector(Connector{ID: "c1", ProjectID: "p", Name: "d", SubKind: SubKindLocalFolder}); err != nil {
		t.Fatal(err)
	}
	at := time.Unix(5, 0).UTC()
	if err := s.SetConnectorSyncState("p", "c1", "fp-xyz", 2, at); err != nil {
		t.Fatalf("SetConnectorSyncState: %v", err)
	}
	got, err := s.ConnectorByID("p", "c1")
	if err != nil {
		t.Fatal(err)
	}
	if got.Fingerprint != "fp-xyz" || got.SyncSeq != 2 || !got.SyncedAt.Equal(at) {
		t.Fatalf("sync state not reflected: %+v", got)
	}
}
