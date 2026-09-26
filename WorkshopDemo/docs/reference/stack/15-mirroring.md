# Mirroring a reference

Translating a reference implementation into configuration. The vocabulary below is the one a
Tailwind-built reference actually uses, counted across the five pages of the app this framework was
first measured against — `mt-*` appears 107 times, `gap-*` 60, `mt`/`mb`/`p`/`px`/`py` together
more than 250.

**Look a value up here before reaching for a framework change.** Every row is a prop that exists;
[`13-screens.md`](13-screens.md) is where each is defined. What genuinely has no mapping is listed
at the end, and adding one is a framework decision taken deliberately, not mid-transcription.

## Spacing

| Reference | Config |
|---|---|
| `mt-7` on an element | `offset: 1.75rem` on that element |
| `mb-7` before the next | `offset` on the **next** element |
| `space-y-3` on a container | `gap: 0.75rem` on the `Stack` |
| `gap-4` | `gap: 1rem` |
| `gap-x-5 gap-y-3` | `gap: 0.75rem 1.25rem` — CSS `gap` takes two values |
| `p-6` · `px-5` · `py-4` | `pad: 1.5rem` · `pad: 0 1.25rem` · `pad: 1rem 0` |
| `p-6 sm:p-10 lg:p-14` | `pad: clamp(1.5rem, 4vw, 3.5rem)` |
| `mx-auto` with a `max-w-*` | `measure` + `center: true` |

**Spacing belongs to the element, not the container.** A reference spaces each element itself, so one
uniform `gap` on a `Stack` lands the whole column in the wrong place. Use `offset` per child and
leave `gap` unset when the spacing varies.

## Type

| Reference | Config |
|---|---|
| `text-xs` … `text-6xl` | `scale: xs` … `scale: 6xl` |
| `text-4xl sm:text-6xl` | `scale: 4xl` + `scaleUp: 6xl` |
| `text-[clamp(…)]` | `size: clamp(…)` |
| a project display class | `display: lg \| md \| plain` on `Heading` |
| `font-black` · `font-bold` · `font-semibold` | `weight: "900"` · `"700"` · `"600"` |
| `tracking-[-.06em]` · `tracking-tight` | `tracking: -0.06em` |
| `leading-relaxed` · `leading-[.92]` | `leading: "1.625"` · `leading: "0.92"` |
| `uppercase` | `transform: uppercase` |
| `text-center` · `text-left` | `align: center` · `align: left` |
| `font-mono` | `mono: true` |
| `max-w-2xl` on a paragraph | `measure: 42rem` |
| `line-through decoration-[#ff4d5f] decoration-[3px]` | `strike: true` + `strikeInk` + `strikeWidth` |
| `<br />` inside a heading | a newline in `text` |
| a gradient-filled run inside a heading | `[[marked]]` inside `text` |

**A size and a line-height are one decision.** `scale` sets both. Setting `size` alone leaves the
line-height inherited, which compounds down a column — a `text-xs` that inherits `1.5` is 2px tall
per line more than one that pairs `12px` with `16px`.

## Colour

| Reference | Config |
|---|---|
| a themed ink | `tone: ink \| muted \| accent \| canvas` |
| `text-white/60` · `text-[#ffd08b]` | `ink: rgba(255, 255, 255, 0.6)` · `ink: "#ffd08b"` |
| `bg-[#121016]` · `bg-white/[.035]` | `background:` on `Box`, `Row` or `Stack` |
| `bg-gradient-to-r from-… via-… to-…` | `gradient: "linear-gradient(90deg, …)"` |
| a themed surface | `tone: hero \| card \| band \| invert \| gradient` |
| `border-white/12` | `border: true` + `borderInk:` |

## Layout

| Reference | Config |
|---|---|
| `flex` + `gap-3` | `Row` with `gap` |
| `flex-col` | `Stack` |
| `flex-col sm:flex-row` | `Row` with `tracks: { sm: … }`, or `wrap: true` |
| `items-center` · `justify-between` | `align: center` · `justify: space-between` |
| `sm:grid-cols-2` | `tracks: { sm: 1fr 1fr }` |
| `md:grid-cols-2 lg:grid-cols-3` | `tracks: { md: 1fr 1fr, lg: 1fr 1fr 1fr }` |
| `lg:grid-cols-[.78fr_1.22fr]` | `tracks: { lg: .78fr 1.22fr }` |
| `lg:col-start-2` | `column: "2"` |
| `lg:justify-self-end` | `place: end` |
| `w-full` | the default; a `Stack` fills its track |
| `max-w-6xl mx-auto` | `width: 1152px` + `insetGutter: true` on `PageShell` |
| a full-width band | `bleed: true` on a `Box` |

**Every grid names the width its columns begin at.** A reference uses `sm`, `md` and `lg` for
different grids on one page; one blanket breakpoint puts columns on where the design is still
stacked. `tracks` as a bare string means "from `md`".

## Surface and decoration

| Reference | Config |
|---|---|
| `rounded-2xl` · `rounded-[2rem]` | `radius: 1rem` · `radius: 2rem` |
| `border` · `border-t` · `border-y` | `border: true` · `border: t` · `border: y` |
| `divide-y` on a list container | `divide: true` on the `Stack` |
| `shadow-[0_30px_100px_rgba(0,0,0,.4)]` | `shadow: 0 30px 100px rgba(0, 0, 0, 0.4)` |
| `backdrop-blur` | `blur: 8px` |
| `overflow-hidden` | `clip: true` |
| `absolute … blur-3xl` inside a `relative` box | `relative: true` on the box + a `Decor` child |
| a gradient hairline across a panel's top | a `Decor` with `gradient` and a `height` |

## State and interaction

| Reference | Config |
|---|---|
| `hover:-translate-y-1 hover:border-white/20 hover:bg-white/[.055]` | `lift: true` on the `Box` |
| a focus ring | nothing — every interactive element gets one from `--color-focus` |
| `transition` | nothing — the framework transitions what it animates |
| `animate-bounce` | `animate: bounce` on an `Icon` |
| `<details>` / `<summary>` | `Disclosure` |
| `<select>` over a short enum | `select: [field]` on `FormScreen` |
| a link inside a control's label | `[[text\|/href]]` in the field's `title` |
| `scroll-mt-8` + an `id` | `anchor:` on the `Stack` or `Box` |

## Page frame

| Reference | Config |
|---|---|
| a page-level shell class | `width` + `insetGutter` + `gutter` on `PageShell` |
| a section's vertical rhythm | `pad: clamp(5rem, 9vw, 8rem) 0` on the section `Stack` |
| a page that is one centred card | `rhythm: false` + `pad:` on `PageShell` |
| no branding bar on a page | omit `brand` |
| a backdrop behind the first fold only | `backdrop: hero` |
| a backdrop behind the whole page | `backdrop: page` |
| `min-h-screen` on a hero | `heroMin: 100vh` |
| the space and rule a hero ends with | `heroClose:` + `heroRule: true` |

## What has no mapping, and what to do about it

| | |
|---|---|
| A named colour, radius, font or gradient | It is a **theme token**, not a prop. Declare it in `config/theme.yaml`; see [`01-configuration-and-boot.md`](01-configuration-and-boot.md#themeyaml--design-tokens). |
| An icon | The app's own vocabulary in [`config/icons.yaml`](01-configuration-and-boot.md#iconsyaml--the-icon-vocabulary). An icon declares the **shapes** that draw it — a circle approximated as a path is a different drawing. |
| `flex-1` on a child, `lg:items-start`, `min-h-*` on a control | **Known gaps** — no mapping yet; use CSS on the one element, the default breakpoint, or the built-in control height. Tracked in the framework's own backlog. Found by walking a page through this table before transcribing it, which is what step 3 below is for. |
| Anything else | A genuine framework gap. **List it and decide before transcribing**, rather than extending the framework mid-page. |

## How to use this

1. Read the reference's **source**, not its rendered page.
2. Map the journeys first — routes, actors, where each ends.
3. Walk every declared value in the section through the tables above. Collect what does not map.
4. **Stop on the collected list.** A framework gap is a decision.
5. Transcribe, then verify per [`14-verification.md`](14-verification.md).

## Related

| | |
|---|---|
| [`13-screens.md`](13-screens.md) | What each component and prop is |
| [`14-verification.md`](14-verification.md) | How to check the result |
| [`01-configuration-and-boot.md`](01-configuration-and-boot.md) | Theme, icons, and the rest of the config families |
