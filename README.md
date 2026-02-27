# rescript-lezer

This is a ReScript grammar for the
[lezer](https://lezer.codemirror.net/) parser system.

The `top` option can be set to `"SingleExpression"` to parse an expression instead of a
full program.

## Grammar Audit

Use the audit script to find remaining grammar bugs against the official ReScript parser.

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
  --rescript-root ../rescript \
  --max-files 800 \
  --fuzz-cases 500 \
  --incremental-cases 300 \
  --include-idempotency \
  --report /tmp/rescript-lezer-audit.json
```

### What it checks

- Differential parse agreement vs ReScript (`-only-parse`) on upstream corpus files
- Mutation fuzzing with mismatch detection
- Incremental parse consistency (incremental tree vs fresh parse)

The code is licensed under an MIT license.
