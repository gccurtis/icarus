package intelligence

import "context"

// Attribution: which piece of work a provider call belongs to.
//
// A CallEvent already says which cast selected a model, which model served it,
// what it cost and how long it took. It could not say *what the call was for* —
// so summing one agent task's true spend meant correlating log lines by
// timestamp and hoping no two runs overlapped. Under concurrent jobs that is not
// merely tedious, it is wrong.
//
// The subject travels in the context rather than in each request struct because
// it is ambient to a unit of work, not a property of any single call. One task
// makes a planning call, a tool loop and possibly a corrective re-ask; threading
// an attribution argument through every one of those signatures would put the
// same value in four places and let any of them forget it.

type subjectKey struct{}

// WithSubject attributes every provider call made under ctx to subject — a
// stable identifier for the unit of work, conventionally "kind:id" (for example
// "task:9f2c", "chat:41ab", "document:7d1e#block-2").
//
// The FIRST subject wins. Work nests — a task runs an Ask, which plans and then
// answers — and the outermost scope is the one a cost belongs to. Letting an
// inner scope re-attribute would split a single run's spend across two subjects
// and undercount both, which is the opposite of what this exists to do.
func WithSubject(ctx context.Context, subject string) context.Context {
	if subject == "" || ctx == nil {
		return ctx
	}
	if existing, ok := ctx.Value(subjectKey{}).(string); ok && existing != "" {
		return ctx
	}
	return context.WithValue(ctx, subjectKey{}, subject)
}

// subjectFrom returns the attribution set on ctx, or "" when the call was made
// outside any attributed unit of work — a legitimate state (a direct API call
// belongs to no task) rather than an error.
func subjectFrom(ctx context.Context) string {
	if ctx == nil {
		return ""
	}
	subject, _ := ctx.Value(subjectKey{}).(string)
	return subject
}
