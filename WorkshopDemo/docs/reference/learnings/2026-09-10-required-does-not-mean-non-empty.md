---
name: required-does-not-mean-non-empty
description: JSON Schema `required` is satisfied by an empty string, so a required text field passes validation with ""
metadata: { type: gotcha }
---
`required: [reason]` only asserts the property is *present*. `{"reason": ""}` validates, so an empty
form field sails through validation and reaches the handler.

Observed 2026-09-10: a confirmation dialog submitted with an untouched required input passed Ajv, the
action handler then threw, and the caller got **500 internal_error** for what was plainly bad input.

**How to apply:** the framework now injects `minLength: 1` into derived schemas for any required
property of type `string` that does not declare its own `minLength`. This makes "required" mean
"present and non-empty", matching the stance taken for secrets in [[tmpdir-is-not-durable]]'s sibling
rule (an empty value is a missing value). Authors can still widen it by setting `minLength: 0`
explicitly.
