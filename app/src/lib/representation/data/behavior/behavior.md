# behavior

Pure functions over the declarations in `../types/`.

The bar for a file here is that it needs no context to run: same arguments, same
answer, no clock, no filesystem, no request. Anything that reads the world around
it belongs to a model object or a capability, which have somewhere to put a
lifetime and someone to ask.

It mirrors `../types/` by domain, and a domain appears only once it has
something. Most have nothing, which is the point — this application knows far
more than it computes.
