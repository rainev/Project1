---
name: yaml-hash-starts-a-comment
description: An unquoted `#` in a YAML value starts a comment, so a hex colour truncates the value silently
metadata: { type: gotcha }
---
This theme token lost most of its value:

```yaml
brandGradient: linear-gradient(90deg, #ffbf24, #ff7b25, #ff3e6c)
```

YAML read ` #ffbf24, …` as a comment, so the value was `linear-gradient(90deg,`. Nothing warned:
the theme meta-schema validates the CHARACTERS a value may contain, not whether it is valid CSS, so
a truncated function passed and was written into the document.

The consequence was larger than the token. See [[2026-09-18-one-bad-token-discards-the-rest]].

**How to apply:** quote any YAML value containing `#`, which in practice means every hex colour and
every gradient. Sibling of [[2026-09-18-yaml-flow-mapping-commas]]: flow syntax and comment syntax
both read punctuation that authored values legitimately contain.

**Boot now refuses it.** `assertNoYamlTraps` (`packages/core/src/config/yaml-traps.ts`) reads the raw
text before the parse and fails with the file, the line, the truncated value and the quoted fix. This
entry stands because the *shape* is still easy to write, not because it still ships silently.
