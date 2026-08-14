# Integrations

An integration is an independently removable translation from canonical
`--token-*` values into vocabulary imposed by an external system. It cannot
introduce palette values, semantic decisions, or references to private stages.

Each integration owns a same-name document and directory. There is no generic
integration generator: the adapters share structure but not an implementation
interface.
