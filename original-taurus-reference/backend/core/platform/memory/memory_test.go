package memory

import (
	"strings"
	"testing"
)

func TestMemTotalReadsTheKernelsLine(t *testing.T) {
	// Every case is content /proc/meminfo could plausibly hold. want 0 means the
	// reading must FAIL, because a caps derivation built on a misread number is
	// worse than one that admits it does not know: the caller falls back to the
	// fixed default and says so.
	cases := []struct {
		name    string
		content string
		want    int64
	}{
		{
			name: "a real meminfo",
			content: "MemTotal:       32791156 kB\n" +
				"MemFree:         1234567 kB\n" +
				"MemAvailable:   20000000 kB\n",
			want: 32791156 * 1024,
		},
		{
			name:    "MemTotal is not the first line",
			content: "SwapTotal:  8 kB\nMemTotal: 1024 kB\n",
			want:    1024 * 1024,
		},
		{
			name:    "irregular spacing",
			content: "MemTotal:1024kB\n",
			want:    1024 * 1024,
		},
		{
			name:    "no MemTotal line at all",
			content: "MemFree: 100 kB\nSwapTotal: 8 kB\n",
			want:    0,
		},
		{
			name:    "empty file",
			content: "",
			want:    0,
		},
		{
			// A prefix match is not a match. MemTotalHuge would report the wrong
			// machine's worth of memory and nothing downstream could tell.
			name:    "a line that only starts like MemTotal",
			content: "MemTotalHuge: 999999 kB\n",
			want:    0,
		},
		{
			name:    "the number is not a number",
			content: "MemTotal:       lots kB\n",
			want:    0,
		},
		{
			name:    "no value at all",
			content: "MemTotal:\n",
			want:    0,
		},
		{
			name:    "zero memory",
			content: "MemTotal:       0 kB\n",
			want:    0,
		},
		{
			name:    "negative memory",
			content: "MemTotal:       -8 kB\n",
			want:    0,
		},
		{
			// 2^63 kB would overflow into a negative byte count, which would then
			// derive a negative budget and a nonsense ceiling.
			name:    "a value that overflows when scaled to bytes",
			content: "MemTotal:       9223372036854775807 kB\n",
			want:    0,
		},
		{
			name:    "a unit we do not understand",
			content: "MemTotal:       32791156 GB\n",
			want:    0,
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			got, err := memTotal(tc.content)
			if tc.want == 0 {
				if err == nil {
					t.Fatalf("memTotal(%q) = %d, want an error", tc.content, got)
				}
				return
			}
			if err != nil {
				t.Fatalf("memTotal(%q): %v", tc.content, err)
			}
			if got != tc.want {
				t.Errorf("memTotal(%q) = %d, want %d", tc.content, got, tc.want)
			}
		})
	}
}

func TestParseSizeAcceptsTheUnitsAnOperatorWillWrite(t *testing.T) {
	cases := []struct {
		in   string
		want int64
		bad  bool
	}{
		{in: "1024", want: 1024},
		{in: "512B", want: 512},
		{in: "8GiB", want: 8 << 30},
		{in: "8 GiB", want: 8 << 30},
		{in: "8gib", want: 8 << 30},
		{in: "512MiB", want: 512 << 20},
		{in: "2TiB", want: 2 << 40},
		// SI spellings mean what they say. An operator who writes GB and gets
		// 7.5% more than they asked for has been lied to quietly.
		{in: "1GB", want: 1_000_000_000},
		{in: "500MB", want: 500_000_000},
		{in: "", bad: true},
		{in: "GiB", bad: true},
		{in: "8 gigs", bad: true},
		{in: "-1GiB", bad: true},
		{in: "0", bad: true},
		{in: "1.5GiB", bad: true},
	}

	for _, tc := range cases {
		got, err := parseSize(tc.in)
		if tc.bad {
			if err == nil {
				t.Errorf("parseSize(%q) = %d, want an error", tc.in, got)
			}
			continue
		}
		if err != nil {
			t.Errorf("parseSize(%q): %v", tc.in, err)
			continue
		}
		if got != tc.want {
			t.Errorf("parseSize(%q) = %d, want %d", tc.in, got, tc.want)
		}
	}
}

func TestBudgetHonoursAConfiguredSize(t *testing.T) {
	got, derivation, err := Budget("8GiB")
	if err != nil {
		t.Fatalf("Budget: %v", err)
	}
	if got != 8<<30 {
		t.Errorf("budget = %d, want %d", got, 8<<30)
	}
	// The derivation is logged at startup, so a configured budget has to be
	// distinguishable from a derived one that happens to land on the same number.
	if !strings.Contains(derivation, "configured") {
		t.Errorf("derivation = %q, want it to say the number was configured", derivation)
	}
}

func TestBudgetRefusesAConfiguredSizeItCannotRead(t *testing.T) {
	// A typo must not silently become the derived default: the operator asked for
	// a specific bound and did not get one, and only they can tell which they meant.
	if _, _, err := Budget("8 gigs"); err == nil {
		t.Fatal("Budget(\"8 gigs\") = nil error, want a refusal")
	}
}

func TestBudgetDerivesAndExplainsItself(t *testing.T) {
	got, derivation, err := Budget("")
	if err != nil {
		// Deriving never fails: an unreadable /proc/meminfo is the fixed default's
		// reason to exist, not an error the process should die on.
		t.Fatalf("Budget(\"\"): %v", err)
	}
	if got <= 0 {
		t.Fatalf("budget = %d, want a positive number of bytes", got)
	}
	if derivation == "" {
		t.Fatal("derivation is empty; a number nobody can explain is worse than a fixed one")
	}
	if !strings.Contains(derivation, "GiB") && !strings.Contains(derivation, "MiB") {
		t.Errorf("derivation = %q, want a human-readable size in it", derivation)
	}
}

func TestDerivedBudgetIsAQuarterOfSystemRAM(t *testing.T) {
	const total = 32 << 30
	got, derivation := derive(total, nil)
	if got != total/4 {
		t.Errorf("budget = %d, want %d", got, int64(total/4))
	}
	if !strings.Contains(derivation, "32.0 GiB") || !strings.Contains(derivation, "8.0 GiB") {
		t.Errorf("derivation = %q, want both the RAM and the share spelled out", derivation)
	}
}

func TestDerivedBudgetFallsBackWhenSystemRAMIsUnknown(t *testing.T) {
	got, derivation := derive(0, errNoMemTotal)
	if got != DefaultBudget {
		t.Errorf("budget = %d, want the fixed default %d", got, DefaultBudget)
	}
	if !strings.Contains(derivation, errNoMemTotal.Error()) {
		t.Errorf("derivation = %q, want the reason the derivation was abandoned", derivation)
	}
}

func TestArtifactCeilingCountsVectorsInTheBudget(t *testing.T) {
	// 8 GiB of frontier at 12 KiB a vector. The spec's own arithmetic: ~200k
	// artifacts is ~2.4GB, so 8 GiB should be around 700k.
	if got, want := ArtifactCeiling(8<<30), (8<<30)/12288; got != want {
		t.Errorf("ArtifactCeiling(8GiB) = %d, want %d", got, want)
	}
	// Never zero, and never negative, whatever it is handed. Knowledge reads a
	// non-positive ceiling as "unbounded", so a derivation that rounded down to
	// zero would remove the very bound it was asked to compute.
	for _, budget := range []int64{0, -1, 1, 12287} {
		if got := ArtifactCeiling(budget); got < 1 {
			t.Errorf("ArtifactCeiling(%d) = %d, want at least 1", budget, got)
		}
	}
}

func TestCommitWindowsOnlyEverShrinksTheDefault(t *testing.T) {
	// A slice larger than the hand-picked default buys nothing — embedding chunks
	// at the provider's batch size regardless — and costs more re-work when a sync
	// fails, so a large machine does not get a larger slice.
	for _, budget := range []int64{8 << 30, 64 << 30, 1 << 40} {
		if got := CommitWindows(budget); got != defaultCommitWindows {
			t.Errorf("CommitWindows(%d) = %d, want the default %d", budget, got, defaultCommitWindows)
		}
	}
	// A small machine does get a smaller slice: that is the whole point of
	// deriving it.
	small := CommitWindows(256 << 20)
	if small >= defaultCommitWindows || small < minCommitWindows {
		t.Errorf("CommitWindows(256MiB) = %d, want between %d and %d", small, minCommitWindows, defaultCommitWindows)
	}
	// And never below the floor, where an embedding request would be smaller than
	// the provider's per-request batch allows.
	if got := CommitWindows(1); got != minCommitWindows {
		t.Errorf("CommitWindows(1) = %d, want the floor %d", got, minCommitWindows)
	}
}

func TestFormatSizeIsReadable(t *testing.T) {
	cases := map[int64]string{
		8 << 30:   "8.0 GiB",
		512 << 20: "512.0 MiB",
		1536:      "1.5 KiB",
		512:       "512 B",
	}
	for in, want := range cases {
		if got := formatSize(in); got != want {
			t.Errorf("formatSize(%d) = %q, want %q", in, got, want)
		}
	}
}
