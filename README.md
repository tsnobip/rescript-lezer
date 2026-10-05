# rescript-lezer

This is a ReScript grammar for the
[lezer](https://lezer.codemirror.net/) parser system.

The `top` option can be set to `"SingleExpression"` to parse an expression instead of a
full program.

## Grammar Audit

Use the audit script to find remaining grammar bugs against the official ReScript parser.

The compiler and corpus are pinned in the `vendored/rescript` Git submodule.
Initialize it once, then build the parser comparator with ReScript's OCaml/dune
dependencies installed (see its `CONTRIBUTING.md`):

```bash
git submodule update --init vendored/rescript
cd vendored/rescript
dune build compiler/bsc/rescript_compiler_main.exe
cd ../..
```

### Quick run

```bash
npm run build
npm run audit:grammar
```

### Strict mode (CI-friendly)

```bash
npm run audit:grammar:strict
```

### Custom run

```bash
node scripts/audit-grammar.mjs \
  --mode all \
  --corpus vendored/rescript/packages \
  --corpus vendored/rescript/scripts/res \
  --max-files 10000 \
  --fuzz-cases 500 \
  --incremental-cases 300 \
  --include-idempotency \
  --report /tmp/rescript-lezer-audit.json
```

### What it checks

- Differential parse agreement vs ReScript (`-only-parse`) on upstream corpus files
- Mutation fuzzing with mismatch detection
- Incremental parse consistency (incremental tree vs fresh parse)

`--corpus` adds real source directories to the syntax fixtures. Use a fixed
`--seed` to reproduce edits, and `--rescript-root` or `RESCRIPT_ROOT` to compare
against another compiler checkout.

The code is licensed under an MIT license.
