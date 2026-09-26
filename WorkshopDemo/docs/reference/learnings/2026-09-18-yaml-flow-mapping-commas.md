---
name: yaml-flow-mapping-commas
description: An unquoted comma inside a YAML flow mapping is a separator, so prose in `{ key: value }` silently becomes extra keys
metadata: { type: gotcha }
---
This view config was refused at boot:

```yaml
- { marker: "01", title: CRM & lead management, body: Capture inquiries, organize prospects, and improve follow-up. }
```

YAML read the commas in the `body` as entry separators, so the mapping gained `organize prospects`
and `and improve follow-up.` as keys. The error was a wall of
`must NOT have additional properties` naming no key, because the extra keys were the prose.

Block style takes the prose unchanged:

```yaml
- marker: "01"
  title: CRM & lead management
  body: Capture inquiries, organize prospects, and improve follow-up.
```

**How to apply:** use flow mappings only for short atomic values in config. Any value that is a
sentence goes in block style. Same family as the trap `Prose.vue` documents, where an unquoted colon
turns a list item into a mapping: flow syntax reads punctuation that authored copy contains.

The boot refusal is what caught it, so `COMPONENT_PROPS` with `additionalProperties: false` is worth
declaring on every new component for this reason alone.

**Boot now refuses it by name.** `assertNoYamlTraps` (`packages/core/src/config/yaml-traps.ts`) reports `line 37: a comma inside the flow mapping "{type: Text, text: One session, two outcomes}" ends the entry, so "two outcomes" is read as a key` — where the meta-schema alone said `/node/children/0 must NOT have additional properties`, naming neither the comma nor the line.
