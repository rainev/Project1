---
name: one-bad-token-discards-the-rest
description: A malformed theme token value silently discards every token declared after it, because they share one :root rule
metadata: { type: gotcha }
---
`compileTheme` renders all tokens into a single rule:

```css
:root{--color-canvas:#07080c;…;--brand-gradient:linear-gradient(90deg,;--hero-size:clamp(…);…}
```

The truncated `linear-gradient(90deg,` left an unbalanced parenthesis, and the CSS parser swallowed
the rest of the rule. `--hero-size`, `--hero-tracking` and `--section-rhythm` were all in the served
HTML and all absent from `getComputedStyle(document.documentElement)`.

No error at boot and none in the browser. The order of keys in the YAML file decided which tokens
survived.

**How to apply:** when a theme token does not apply, do not debug that token. Read the served
`:root` rule and look for a malformed value EARLIER in it. Confirm with
`getComputedStyle(document.documentElement).getPropertyValue('--name')` rather than by reading the
HTML, because the HTML shows tokens the parser then discarded. Logged as AUD-080.
