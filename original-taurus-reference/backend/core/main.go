// Command core is the core of the Taurus Omega application: the authoritative
// backend the rest of the system (including any frontend) is a view onto.
//
// main is a thin composition shell: it hands off to the composition root, which
// creates the initial objects and runs the server.
package main

import "github.com/gccurtis/taurus-omega/core/wiring"

func main() {
	wiring.Run()
}
