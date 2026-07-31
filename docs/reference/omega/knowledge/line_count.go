package knowledge

import "strings"

// CountLines is the persisted source line-count convention. It remains in
// Knowledge because the lattice records metadata about its indexed evidence,
// not because Knowledge owns exact source reading.
func CountLines(text string) int {
	if text == "" {
		return 0
	}
	lines := strings.Count(text, "\n")
	if strings.HasSuffix(text, "\n") {
		return lines
	}
	return lines + 1
}
