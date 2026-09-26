---
name: computed-colours-are-oklch
description: getComputedStyle returns oklch() when tokens are authored that way, so regex-parsed contrast maths is silently wrong
metadata: { type: gotcha }
---
With design tokens authored in `oklch()`, `getComputedStyle(el).color` returns
`oklch(0.551 0.027 264.4)` — not `rgb(...)`. A contrast checker that pulls the first three numbers out
with a regex then treats `0.551, 0.027, 264.4` as RGB and reports a confident, meaningless ratio
(observed: 1.09:1 for text that actually measures 16.96:1).

**How to apply:** convert through the browser instead of parsing. Paint the colour into a 1×1 canvas
and read the pixel:

```js
context.fillStyle = colour; context.fillRect(0, 0, 1, 1);
const [r, g, b] = context.getImageData(0, 0, 1, 1).data;
```

That works for any CSS colour syntax, now and after the next colour-space change.
