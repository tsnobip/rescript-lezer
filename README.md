# @tsnobip/rescript-lezer

This is a ReScript grammar for the
[lezer](https://lezer.codemirror.net/) parser system.

It parses ReScript syntax, including JSX which is always available in ReScript files.

The code is licensed under an MIT license.

## Status

This is an adaptation of the lezer/javascript parser for ReScript syntax. The grammar currently supports:

### Core Features
- Let bindings with type annotations
- Recursive let bindings (`let rec`)
- Arrow functions
- Basic expressions (literals, operators, etc.)

### Data Structures
- Arrays: `[1, 2, 3]`
- Lists: `list{1, 2, 3}`
- Dictionaries: `dict{"key": "value"}`
- Records and objects

### Advanced Features
- **Pattern matching**: `switch` expressions with all pattern types (literals, constructors, arrays, records, nested patterns)
- **Template strings**: `` `template string` ``
- JSX (always available, not a dialect)
- Decorators: `@decorator`
- Extension expressions: `%raw()`
- Pipe operators: `->` and `|>`
- String concatenation: `++`
- Function calls and member access
- Module paths

### Not Yet Supported
- Module system (`open`, `module` declarations)
- Type declarations (variants, records as types)
- Template string interpolation (`${...}`)
- Pattern guards (`when` clauses)
- External declarations

50 tests passing.
