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

### Corpus regression check

```bash
npm run test:corpus
```

This checks the syntax fixtures, runtime packages, and scripts in the pinned
checkout. It also compares fresh and incremental trees across 1,000 reproducible edits.
It fails on compiler-valid parse errors, incremental mismatches, or crashes.
Compiler-rejected fixtures remain visible in the full differential audit.

GitHub Actions runs `npm test` and this corpus check on pushes and pull requests,
and saves the JSON audit report as the `grammar-audit` artifact.

### Strict agreement

```bash
npm run audit:grammar:strict
```

### Custom run

```bash
node scripts/audit-grammar.mjs \
  --mode all \
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

`--corpus` adds directories to the default corpus. Reports include error positions
and the full source and edit for reproducing fuzz and incremental failures. Use a fixed
`--seed` to reproduce edits, and `--rescript-root` or `RESCRIPT_ROOT` to compare
against another compiler checkout.

## Publishing

Version tags (`v0.9.1`, for example) trigger `.github/workflows/publish.yml`.
The workflow runs the full test suite and corpus check, verifies that the tag
matches `package.json`, then builds and publishes to npm. Only stable versions
are supported.

Before the first automated release, push the workflow and configure a
[Trusted Publisher](https://docs.npmjs.com/trusted-publishers/) in the npm settings
for `@tsnobip/rescript-lezer`:

- GitHub user: `tsnobip`
- Repository: `rescript-lezer`
- Workflow filename: `publish.yml`
- Allow direct publishing with `npm publish`

Publishing uses OIDC, so no npm token secret is needed.
To release from a clean checkout of the release branch:

```bash
npm version patch # or minor / major
git push origin HEAD --follow-tags
```

`npm version` updates the package and lockfile, commits the change, and creates
the version tag. Failed workflow runs can be rerun from GitHub Actions.

The code is licensed under an MIT license.
