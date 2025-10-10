# ReScript Lezer Parser Adaptation Notes

This document describes the adaptation of the lezer/javascript parser to support ReScript syntax.

## Changes Made

### 1. Package Configuration
- **package.json**: Updated package name to `@tsnobip/rescript-lezer`, version to `0.1.0`
- Updated repository URL and build scripts to reference `rescript.grammar` instead of `javascript.grammar`

### 2. Grammar File (`src/rescript.grammar`)
- Created new grammar file based on JavaScript grammar but adapted for ReScript
- Removed TypeScript-specific constructs
- Simplified to focus on core ReScript features

**Key Grammar Changes:**
- Replaced `var`/`const` with let-only bindings (VariableDeclaration)
- Added support for type annotations with `:` syntax
- Defined basic module structure (not fully functional yet)
- Added uppercase identifier tokens for modules and constructors
- Simplified expression syntax to match ReScript patterns

**Dialects:**
- Kept JSX dialect support (untested)
- Removed TypeScript dialect

### 3. Token Handling (`src/tokens.js`)
- Simplified external tokenizers
- Removed JavaScript-specific operators (++/--, ?.)
- Kept basic newline tracking and semicolon insertion
- Simplified JSX tokenizer

### 4. Syntax Highlighting (`src/highlight.js`)
- Renamed export from `jsHighlight` to `rescriptHighlight`
- Updated keywords to ReScript-specific ones (let, rec, module, type, open, external, etc.)
- Removed JavaScript/TypeScript-specific highlighting
- Added ReScript-specific highlighting for constructors, modules

### 5. Tests (`test/`)
- Removed all JavaScript/TypeScript test files
- Created `test/rescript.txt` with 15 passing tests
- Renamed `test-javascript.js` to `test-rescript.js`
- Tests cover: let bindings, functions, expressions, literals, operators

### 6. Documentation
- **README.md**: Updated to describe ReScript parser and current status
- **CHANGELOG.md**: Added v0.1.0 entry documenting the adaptation
- **ADAPTATION_NOTES.md**: This file

## What Works (15 Passing Tests)

✅ Let bindings: `let x = 5`
✅ Let bindings with type annotations: `let name: string = "John"`  
✅ Function expressions: `let add = (a, b) => a + b`
✅ Boolean literals: `true`, `false`
✅ Number literals: integers, floats, hex, binary
✅ String literals with escape sequences
✅ List/Array expressions: `[1, 2, 3]`
✅ Record/Object expressions: `{x: 1, y: 2}`
✅ Function calls: `log("Hello")`
✅ Member access: `Belt.Option.map`
✅ Parenthesized expressions
✅ Unary expressions: `-5`, `!true`
✅ Binary expressions: `a + b`, `a * b`, `a < b`
✅ Logical expressions: `a && b`, `a || b`
✅ Comments (line and block)

## Known Limitations

❌ **Module System**: `open`, `module` declarations don't parse correctly
  - Issue: Keywords defined with `kw<>` aren't being recognized
  - They're parsed as regular identifiers instead

❌ **Type Declarations**: `type person = {name: string}` doesn't parse
  - Grammar rules exist but keyword recognition fails

❌ **External Declarations**: `external log: string => unit = "..."` doesn't work
  - Same keyword recognition issue

❌ **Pattern Matching**: `switch` expressions not implemented
  - Grammar structure defined but needs work

❌ **ReScript Operators**:
  - String concatenation `++` not recognized
  - Pipe operators `->` and `|>` not working
  - Need to be added to token definitions

❌ **If Expressions**: Block-based if expressions don't parse correctly
  - ReScript uses block syntax, parser expects parenthesized conditions

❌ **Advanced Features**:
  - Variants with constructors
  - Pattern matching in function parameters
  - Labeled/optional arguments
  - Polymorphic variants
  - First-class modules
  - Functors

## Technical Challenges

### Keyword Recognition
The main blocker is that lowercase keywords like `open`, `module`, `type`, `external` are defined using `@specialize` but aren't being properly recognized during parsing. They get parsed as regular identifiers instead.

**Possible Solutions:**
1. Use different token strategy for keywords
2. Add explicit keyword tokens instead of relying on @specialize
3. Post-process identifier tokens to recognize keywords

### Grammar Conflicts
The grammar has several shift/reduce and reduce/reduce conflicts that were left unresolved:
- Unit literal `()` vs empty parameter list
- Variable definition vs variable name in patterns
- Type parentheses vs function type syntax
- Variant constructors with/without arguments

These conflicts are handled by the parser's default precedence rules but may cause unexpected behavior in some cases.

## Next Steps for Full ReScript Support

1. **Fix Keyword Recognition**
   - Modify token strategy to properly recognize ReScript keywords
   - Test with module, type, and external declarations

2. **Add Missing Operators**
   - String concatenation `++`
   - Pipe operators `->` and `|>`
   - Spread operator `...`

3. **Implement Pattern Matching**
   - Switch expressions with pattern matching
   - Pattern destructuring in let bindings
   - Constructor patterns

4. **Enhance Type System**
   - Type declarations with variants
   - Type parameters and constraints
   - Function types with labeled arguments

5. **Module System**
   - Module declarations and signatures
   - Open statements with various syntaxes
   - Functors and first-class modules

6. **Test JSX Support**
   - Verify JSX parsing works with ReScript syntax
   - Test React component syntax

## Building and Testing

```bash
# Install dependencies
npm install

# Build the parser
npm run build

# Run tests
npm test

# All 15 tests should pass
```

## References

- [ReScript Language Manual](https://rescript-lang.org/docs/manual/latest/introduction)
- [Lezer Parser System](https://lezer.codemirror.net/)
- [Original lezer/javascript parser](https://github.com/lezer-parser/javascript)
