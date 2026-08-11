// Package memory resolves the process's memory budget and the caps derived from
// it.
//
// One number — how much memory this deployment may spend on indexing — decides
// two others: how many artifacts a project's lattice may hold, and how many
// windows one ingest slice accumulates before committing. Both were hand-picked
// constants, which meant the same figure was simultaneously too large for a 1 GB
// container and a fraction of what a 128 GB host could use. A machine that
// crossed the artifact figure did not refuse the work; it was killed by the OOM
// killer mid-sync.
//
// The derivation lives here, beside the budget it comes from, rather than in the
// composition root. The root forwards — it is not the place to put arithmetic
// nobody can run a test against — and these two conversions are exactly the part
// that needs a test: they turn bytes into counts using assumptions about vector
// size that will change the first time the embedding dimension does.
//
// Every derived number travels with a sentence explaining itself. A cap that
// varies per machine and cannot be accounted for is harder to operate than a
// fixed one that is merely wrong, because nobody can tell whether it is working.
//
// No new dependency: /proc/meminfo is a text file, and this package parses it.
package memory

import (
	"errors"
	"fmt"
	"math"
	"os"
	"runtime"
	"strconv"
	"strings"
)

// DefaultBudget is what a deployment gets when the system's RAM cannot be read —
// a non-Linux host, or a /proc that is not mounted.
//
// It is 25% of 8 GiB: the smallest machine we expect to run on. Guessing low is
// the safe direction, because the number's failure mode is asymmetric. Too low
// refuses a sync that would in fact have fit, with a message naming the setting
// that would let it through; too high is an OOM kill halfway through someone's
// folder, which is the failure this whole derivation exists to replace.
const DefaultBudget int64 = 2 << 30

const (
	// budgetShare is the fraction of system RAM the indexer may claim, as a
	// divisor. A quarter: the process shares the machine with SQLite's page
	// cache, the Go heap's own headroom, and whatever else the host is running,
	// and the budget bounds only the indexing working set, not the process.
	budgetShare = 4

	// nominalDims is the embedding dimension the derivation assumes. The
	// resolved identity is not known at startup — a cast is only an alias and
	// configuration may re-point it — so the ceiling is computed against the
	// dimension the deployment's default embedding model actually uses. A model
	// with fewer dimensions makes the ceiling conservative, which is the safe
	// direction; a much larger one is a reason to set max_artifacts explicitly.
	nominalDims = 1536

	// vectorBytes is one artifact's cost in a rebuild: its vector, held as
	// float64. This is what the ceiling counts, because the corpus rebuild holds
	// every frontier vector at once and that is the wall the process hits.
	vectorBytes = nominalDims * 8 // 12 KiB

	// inFlightBytes is one window's cost while a slice is being accumulated: its
	// vector plus its own text (~4000 runes, up to four bytes each), so ~20 KiB.
	inFlightBytes = vectorBytes + 8<<10

	// commitShare is the fraction of the budget one commit slice may hold, as a
	// divisor. The slice is transient and the frontier is not, so the slice gets
	// a sixteenth and the ceiling is computed against the whole budget: at the
	// default slice size the overlap is tens of megabytes against gigabytes.
	commitShare = 16

	// defaultCommitWindows is the hand-picked slice size the derivation will not
	// exceed, matching knowledge's own default. Deriving this cap can only ever
	// shrink it, because a larger slice buys nothing — embeddings chunk at the
	// provider's batch size no matter how many windows are resident — while
	// costing more re-work when a sync fails partway.
	defaultCommitWindows = 2000

	// minCommitWindows is the floor. Below a few hundred, an embedding request is
	// smaller than the provider's per-request batch allows and the sync makes
	// more calls than it needs to.
	minCommitWindows = 256
)

// errNoMemTotal is the reading that found no memory. It is a value so the
// fallback's derivation string can name the reason without the caller parsing
// prose.
var errNoMemTotal = errors.New("no usable MemTotal line")

// Budget resolves the memory budget in bytes and returns the sentence that
// explains where the number came from, which the composition root logs.
//
// configured is a byte size from the manifest ("8GiB", "512MB", a bare byte
// count); empty derives the budget from system RAM. A configured value that
// cannot be read is an error rather than a silent fall back to the default: the
// operator asked for a specific bound and did not get one, and only they know
// which they meant.
//
// Deriving, by contrast, never fails. An unreadable /proc/meminfo is precisely
// what the fixed default is for, and refusing to start over it would make the
// service unrunnable on a platform where the bound is merely less well informed.
func Budget(configured string) (int64, string, error) {
	if strings.TrimSpace(configured) != "" {
		bytes, err := parseSize(configured)
		if err != nil {
			return 0, "", fmt.Errorf("memory budget %q: %w", configured, err)
		}
		// Both what was written and what it resolved to: "512MB = 488.3 MiB" is
		// the one line that settles whether an operator got the units they meant.
		return bytes, fmt.Sprintf("configured %s = %s", strings.TrimSpace(configured), formatSize(bytes)), nil
	}
	total, err := systemRAM()
	bytes, derivation := derive(total, err)
	return bytes, derivation, nil
}

// derive turns a reading of system RAM into the budget and its explanation. It
// takes the reading rather than making it so the arithmetic and the wording are
// testable without a machine of a particular size.
func derive(total int64, err error) (int64, string) {
	if err == nil && total/budgetShare <= 0 {
		err = errNoMemTotal
	}
	if err != nil {
		return DefaultBudget, fmt.Sprintf("fixed default %s, system RAM unavailable: %v", formatSize(DefaultBudget), err)
	}
	bytes := total / budgetShare
	return bytes, fmt.Sprintf("%d%% of %s system RAM = %s", 100/budgetShare, formatSize(total), formatSize(bytes))
}

// ArtifactCeiling reports how many lattice artifacts a budget holds — the count
// a project may not exceed, because a corpus rebuild holds every frontier vector
// at once.
//
// It never returns less than one. A non-positive ceiling reads downstream as "no
// ceiling", so a budget too small to hold a single vector must not round down
// into the absence of the bound it was asked to compute.
func ArtifactCeiling(budget int64) int {
	return clamp(budget/vectorBytes, 1, math.MaxInt)
}

// CommitWindows reports how many windows one ingest slice may accumulate before
// it is embedded, written and released.
//
// It is bounded above by the default rather than scaling with the machine, for
// the reason on defaultCommitWindows: a bigger slice is not a faster sync, only
// a larger unit of work to lose. Deriving it protects the small host, where the
// fixed default was a slice the machine could not hold.
func CommitWindows(budget int64) int {
	return clamp(budget/commitShare/inFlightBytes, minCommitWindows, defaultCommitWindows)
}

func clamp(n int64, lo, hi int) int {
	if n < int64(lo) {
		return lo
	}
	if n > int64(hi) {
		return hi
	}
	return int(n)
}

// systemRAM reads the machine's total memory. Linux answers from /proc/meminfo;
// every other platform reports that it cannot, and takes the fixed default.
// Reading a file is the whole implementation, which is what keeps the dependency
// list at five.
func systemRAM() (int64, error) {
	if runtime.GOOS != "linux" {
		return 0, fmt.Errorf("no reader for %s", runtime.GOOS)
	}
	data, err := os.ReadFile("/proc/meminfo")
	if err != nil {
		return 0, err
	}
	return memTotal(string(data))
}

// memTotal extracts the byte count from /proc/meminfo content.
//
// It is separate from the read so every way the file can disappoint — absent,
// truncated, a value that is not a number, a unit the kernel does not currently
// use, a total that overflows when scaled — is testable without a machine that
// has that much memory or that little.
//
// Anything it cannot read confidently is an error, never a guess. A budget
// derived from a misparsed number would be wrong in a way nothing downstream
// could detect, whereas the fixed default announces itself.
func memTotal(content string) (int64, error) {
	for _, line := range strings.Split(content, "\n") {
		rest, ok := strings.CutPrefix(line, "MemTotal:")
		if !ok {
			continue
		}
		// The kernel writes "MemTotal:       32791156 kB". Only kB has ever been
		// written here; an unrecognized unit is refused rather than assumed,
		// because assuming wrongly is a 1024× error in the budget.
		fields := strings.Fields(rest)
		switch len(fields) {
		case 2:
			if !strings.EqualFold(fields[1], "kB") {
				return 0, fmt.Errorf("MemTotal in unknown units %q", fields[1])
			}
		case 1:
			// Either no unit, or one written without a space ("MemTotal:1024kB").
			// The suffix trim below handles the second; the first is read as kB,
			// which is the only unit the kernel has ever used here.
		default:
			return 0, errNoMemTotal
		}
		kb, err := strconv.ParseInt(strings.TrimSuffix(strings.TrimSuffix(fields[0], "kB"), "kb"), 10, 64)
		if err != nil {
			// Handles "MemTotal:1024kB" as well as a genuinely bad value: the
			// suffix trim above already ran, so what is left must be digits.
			return 0, fmt.Errorf("MemTotal is not a number: %q", fields[0])
		}
		if kb <= 0 {
			return 0, fmt.Errorf("MemTotal is %d kB", kb)
		}
		if kb > math.MaxInt64/1024 {
			return 0, fmt.Errorf("MemTotal of %d kB overflows", kb)
		}
		return kb * 1024, nil
	}
	return 0, errNoMemTotal
}

// sizeUnits maps a written unit to its multiplier. SI and IEC spellings mean
// what they say — GB is a billion bytes and GiB is 2³⁰ — because an operator who
// writes one and silently gets 7.4% of the other has been misled by the config
// rather than served by it.
var sizeUnits = []struct {
	suffix string
	mult   int64
}{
	{"kib", 1 << 10}, {"mib", 1 << 20}, {"gib", 1 << 30}, {"tib", 1 << 40},
	{"kb", 1000}, {"mb", 1000 * 1000}, {"gb", 1000 * 1000 * 1000}, {"tb", 1000 * 1000 * 1000 * 1000},
	{"b", 1},
}

// parseSize reads a byte size written the way a person writes one: a whole
// number, optionally followed by a unit. A bare number is bytes.
//
// Fractions ("1.5GiB") are refused rather than rounded, so there is one way to
// write a size and no question about which byte it lands on. Zero and negatives
// are refused because neither is a budget — the way to say "do not bound this"
// is the setting that means it, not a number that quietly disables one.
func parseSize(s string) (int64, error) {
	text := strings.ToLower(strings.TrimSpace(s))
	if text == "" {
		return 0, errors.New("empty size")
	}
	mult := int64(1)
	for _, u := range sizeUnits {
		if digits, ok := strings.CutSuffix(text, u.suffix); ok {
			mult = u.mult
			text = strings.TrimSpace(digits)
			break
		}
	}
	n, err := strconv.ParseInt(text, 10, 64)
	if err != nil {
		return 0, fmt.Errorf("not a whole number of bytes")
	}
	if n <= 0 {
		return 0, fmt.Errorf("must be positive")
	}
	if n > math.MaxInt64/mult {
		return 0, fmt.Errorf("too large")
	}
	return n * mult, nil
}

// formatSize renders a byte count the way the derivation string reads it back:
// binary units, one decimal, because "8.0 GiB" is the number an operator
// recognizes and 8589934592 is not.
func formatSize(bytes int64) string {
	const unit = 1024
	if bytes < unit {
		return fmt.Sprintf("%d B", bytes)
	}
	div, exp := int64(unit), 0
	for n := bytes / unit; n >= unit; n /= unit {
		div *= unit
		exp++
	}
	return fmt.Sprintf("%.1f %ciB", float64(bytes)/float64(div), "KMGT"[exp])
}
