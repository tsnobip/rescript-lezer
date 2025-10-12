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
- **Module declarations**: `module X = { ... }` with nested modules

### Data Structures
- Arrays: `[1, 2, 3]`
- Lists: `list{1, 2, 3}`
- Dictionaries: `dict{"key": "value"}`
- Records and objects

### Advanced Features
- **Pattern matching**: `switch` expressions with all pattern types (literals, constructors, arrays, records, nested patterns)
- **Pattern guards**: `when` clauses in switch patterns for conditional matching
- **Template strings**: `` `template string` `` with full interpolation support `` `Hello ${name}` ``
- **JSX with expression children**: `<div>{React.string("text")}</div>` (always available, not a dialect)
- **Decorators**: `@decorator`
- **Extension expressions**: `%raw()`
- **Labeled parameters**: `(~param, ~optional=?)`
- Pipe operators: `->` and `|>`
- String concatenation: `++`
- Function calls and member access
- Module paths

### Known Limitations
- Single-parameter arrow functions with labeled parameters `(~param) => ...` have parsing ambiguity issues
- Type declarations (variants, records as types) not yet implemented
- External declarations not yet implemented
- `open` statements not yet implemented

**62 tests passing**, covering complex real-world ReScript code including nested switches, string interpolation, JSX components, and module declarations.
