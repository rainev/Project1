# App-Stack 1.5.1 — the reference

One document per layer: the mechanism, the contract, the configuration that drives it, the failure
modes, and how to verify it. Everything here was written from the code and checked against it
running.

**Building something? Start with [16-building-a-feature.md](16-building-a-feature.md)**, which
crosses the layers once in the order you work. Come back here when you need a layer in full.

| | |
|---|---|
| [00](00-overview.md) overview · [01](01-configuration-and-boot.md) config and boot | what exists, and when it compiles |
| [02](02-models.md) models · [03](03-derived-schemas.md) derived schemas | what a resource is |
| [04](04-dispatch-and-pipeline.md) dispatch · [05](05-gates.md) gates | what happens to a request |
| [06](06-persistence.md) persistence · [07](07-encryption.md) encryption · [08](08-files.md) files | what is stored |
| [09](09-secrets.md) secrets · [10](10-auth-and-sessions.md) auth and sessions | who is asking |
| [11](11-projection-and-frontend.md) projection · [12](12-forms.md) forms · [13](13-screens.md) screens | what is rendered |
| [14](14-verification.md) verification · [15](15-mirroring.md) mirroring | how it is proved |

The traps that bite an app author are in [../learnings](../learnings) — one file each, including the
three YAML shapes that parse cleanly and mean something other than what you wrote.

Some documents cite framework source by path. `packages/core` and `packages/cli` ship with this
release and those citations resolve; a handful naming `packages/ui` components do not, because the
components are compiled into `dist/` rather than shipped as source. They are provenance, never a
step you are asked to take.
