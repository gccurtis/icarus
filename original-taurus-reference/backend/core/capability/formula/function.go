package formula

// functionValue is the immutable payload of a KindFunction value: the ordered
// parameter names, the parsed body, and the exact source text used for display
// and equality. The lexical closure captured at definition is added in
// evaluate.go (the captured field) once the scope type exists.
type functionValue struct {
	params   []string
	body     *Node
	source   string
	captured *scope
}
