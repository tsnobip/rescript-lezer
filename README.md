# @tsnobip/rescript-lezer

This is a ReScript grammar for the
[lezer](https://lezer.codemirror.net/) parser system.

It parses ReScript syntax, and supports a `"jsx"` dialect to parse JSX.

The code is licensed under an MIT license.

## Status

This is a work-in-progress adaptation of the lezer/javascript parser for ReScript syntax. The grammar currently supports:

- Let bindings
- Type declarations (records and variants)
- Module declarations
- Basic expressions
- JSX (with jsx dialect)

Many advanced ReScript features are not yet supported.
