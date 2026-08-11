// This nested go.mod exists only to exclude the experimental snapshot from the
// parent module's build (`go build ./...` skips directories that have their own
// go.mod). The code here is a reference copy, not compiled as part of the app.
//
// The files still import their original paths under
// github.com/gccurtis/taurus-omega/core/... — they were extracted from the
// fully-integrated version at commit b0fd447 and are not wired to build in this
// location. See README.md.
module github.com/gccurtis/taurus-omega/experimental

go 1.26.4
