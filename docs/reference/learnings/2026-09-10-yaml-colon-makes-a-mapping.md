---
name: yaml-colon-makes-a-mapping
description: An unquoted colon in a YAML list item silently turns the string into a key/value mapping
metadata: { type: gotcha }
---
```yaml
items:
  - Three gates run before anything else: may you act, which rows, which fields.
```
YAML reads that item as a **mapping**, not a string. It parses cleanly, validates cleanly, and then
renders in the UI as `{ "Three gates run before anything else": "may you act, …" }`.

Observed 2026-09-10 on the compendium page. Nothing errored — view config props are passed to
components untyped, so a malformed value simply becomes JSON on screen. Only looking at the rendered
page caught it.

**How to apply:** quote any YAML scalar containing `: `, `#`, or a leading `*`/`&`/`%`. More
generally: view config is not schema-validated yet, so components that render free text should coerce
defensively — and a browser check should assert that prose looks like prose (no `{` or `"` in
rendered copy).

**Boot now refuses it.** `assertNoYamlTraps` (`packages/core/src/config/yaml-traps.ts`) reports the line, the key the sentence became, and the quoted fix. The tell is a **key containing a space**: real keys here are identifiers, so a spaced key is prose that lost its quotes — `https://…`, `at: 09:30` and a mid-sentence colon all stay silent. Third of the three YAML traps of this class; siblings [[2026-09-18-yaml-hash-starts-a-comment]] and [[2026-09-18-yaml-flow-mapping-commas]].
