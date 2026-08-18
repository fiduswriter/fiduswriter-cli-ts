# AGENTS.md — @fiduswriter/cli

This file contains information for AI coding agents working on the
`fiduswriter-cli` repository. Read this first if you are unfamiliar with the
project.

## Project overview

`@fiduswriter/cli` is a Node.js command-line interface and programmatic library
for converting Fidus Writer documents and books between formats. It reuses the
same import/export logic as the main Fidus Writer application through
`@fiduswriter/document` and `@fiduswriter/books-document`.

- Package name: `@fiduswriter/cli`
- License: `AGPL-3.0-or-later`
- Repository: `https://git.fiduswriter.org/fiduswriter/fiduswriter-cli-ts.git`
- Author: Johannes Wilm

## Scope

Code in this repository should be limited to:

- CLI entry points (`src/bin/`).
- Command implementations (`src/commands/`).
- Thin exporter/importer wrappers that adapt the document libraries to a
  Node.js / CLI environment (`src/exporters/`, `src/importers/`).
- Utility helpers for CSL, default templates, file I/O, etc.

Do **not** put in this repository:

- Document model code (belongs in `@fiduswriter/document`).
- Book-level export logic (belongs in `@fiduswriter/books-document`).
- UI components (belongs in `fwtoolkit` or the main app).
- Django-specific logic.

## Technology stack

- **Language:** TypeScript 5.8+.
- **Module system:** ESM (`"type": "module"`).
- **Build tool:** `tsc` only; no bundler is used.
- **Test runner:** Node built-in test runner (`node --test`) invoked via `tsx`.
- **DOM environment:** `happy-dom` for browser APIs needed by `fwtoolkit` and
  the document libraries.

## Directory layout

```
.
├── src/                  # TypeScript source files
│   ├── bin/              # CLI entry point
│   ├── commands/         # Subcommand implementations
│   ├── exporters/        # Export filter wrappers
│   ├── importers/        # Import filter wrappers
│   └── utils/            # CSL, templates, file helpers, etc.
├── dist/                 # Compiled JS, .d.ts and source maps (generated)
├── templates/            # Default DOCX/ODT templates shipped with the CLI
├── test/                 # Node test runner tests
├── packaging/            # Packaging helpers for npm/global install
├── package.json
└── tsconfig.json
```

## Build and test commands

```bash
# Install dependencies
pnpm install

# Compile TypeScript to dist/
pnpm run build

# Run the test suite
pnpm test

# Run linting and formatting checks
pnpm run lint
pnpm run format:check
```

This repository uses pnpm for day-to-day development. Run `pnpm install` to
install dependencies; `package-lock.json` is not tracked (pnpm maintains
`pnpm-lock.yaml`).

## Pre-commit / pre-publish

- `pnpm run prepare` runs `pnpm run build`.
- `npm publish` triggers `prepublishOnly`, which also builds.
- There is no pre-commit hook in this repository; rely on CI and run tests
  before committing.

## Code style guidelines

- Use ES modules and TypeScript strict mode.
- Import local files with the `.js` extension even when the source file is
  `.ts`.
- Avoid `any` unless necessary.
- Keep CLI concerns separate from conversion logic; the CLI should mostly
  delegate to the document libraries.

## CLI usage

```bash
# Convert a single Fidus document
fidusconvert input.fidus output.docx

# Convert a Fidus book
fidusconvert book.fidusbook output.html

# List supported formats
fidusconvert --help
```

## Static assets in the CLI environment

The CLI does not have access to the Django static-file pipeline. When a
converter needs static assets (e.g. MathLive CSS for HTML/EPUB output), the CLI
resolves them from `@fiduswriter/document/static-libs/`.

## Testing instructions

Tests live in `test/` and run with the Node test runner via `tsx`.

- Use `pnpm test` to run the full suite.
- Tests cover conversion between many formats and round-trip fixtures.
- Test fixtures are in `test/`.

## Consumers

This package is published to npm and installed globally or per-project. It does
not have library consumers in the same sense as `@fiduswriter/document`, but
both the main app and plugin code should stay aligned with the CLI's
expectations.

When publishing a new version:

- Ensure the latest `@fiduswriter/document` and `@fiduswriter/books-document`
  releases are reflected in `package.json`.
- Run `pnpm test` before publishing.

## Release checklist

- Ensure `pnpm run build` succeeds.
- Ensure `pnpm test` passes.
- Update `package.json` version if needed (`npm version patch|minor|major`).
- `npm publish` triggers `prepublishOnly`, which builds.
- Push commits and tags.

## Useful references

- `package.json` — scripts, exports and dependency versions.
- `tsconfig.json` — compiler options.
- `src/index.ts` — programmatic library entry point.
- `@fiduswriter/document` and `@fiduswriter/books-document` — the libraries
  this CLI wraps.
