# @tsnobip/rescript-lezer

This is a ReScript grammar for the
[lezer](https://lezer.codemirror.net/) parser system.

It parses ReScript syntax, including JSX which is always available in ReScript files.

The code is licensed under an MIT license.

## Status

This is an adaptation of the lezer/javascript parser for ReScript syntax. The grammar currently supports:

- Let bindings with type annotations
- Arrow functions
- Basic expressions (literals, operators, etc.)
- Arrays, lists, and dictionaries
- Records and objects
- JSX (always available, not a dialect)
- Function calls and member access
- Module paths

Many advanced ReScript features are still being added.
