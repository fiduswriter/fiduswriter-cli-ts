# @fiduswriter/cli

<p align="center"><img src="https://git.fiduswriter.org/fiduswriter/fiduswriter-cli-ts/raw/branch/main/logo.svg" alt="fidusconvert logo" width="100" height="100"></p>

Command-line tool for converting documents between
[Fidus Writer](https://fiduswriter.org) native format (`.fidus`) and other
document formats. Built on top of
[@fiduswriter/document](https://git.fiduswriter.org/fiduswriter/fiduswriter-document-ts).

## Install

```bash
npm install -g @fiduswriter/cli
```

See [INSTALL.md](./INSTALL.md) for platform-specific packages (Debian, Arch,
Fedora, macOS Homebrew) and building from source.

## Update

If you installed the package globally with npm, update it to the latest version
with:

```bash
npm install -g @fiduswriter/cli@latest
```

## Usage

### Convert documents

The `convert` command is the default and handles all format conversions:

```bash
# .fidus → DOCX
fidusconvert document.fidus output.docx

# DOCX → .fidus
fidusconvert input.docx output.fidus

# DOCX → LaTeX (explicit format flags)
fidusconvert --from docx --to latex input.docx output.latex.zip

# .fidus → HTML with a custom citation style
fidusconvert -s chicago-author-date document.fidus output.html.zip

# .fidus → DOCX with a custom template
fidusconvert --docx-template my-template.docx document.fidus output.docx

# .fidus → JATS with book-part-wrapper type
fidusconvert --jats-type book-part-wrapper document.fidus output.jats.zip
```

### Pipe through stdin/stdout

Use `-` as the input or output path to read from stdin or write to stdout.
When `-` is used, the format must be given explicitly with `--from` or `--to`.

```bash
# Markdown → Pandoc JSON → Fidus Writer
pandoc -f markdown -t json input.md | fidusconvert --from pandoc --to fidus - output.fidus

# Fidus Writer → raw Pandoc JSON → Markdown
fidusconvert --from fidus --to pandoc input.fidus - | pandoc -f json -t markdown

# .fidus → DOCX on stdout (binary, redirect to a file)
fidusconvert --from fidus --to docx input.fidus - > output.docx
```

Status messages are written to stderr so they do not mix with piped output.

When exporting to `--to pandoc -`, the raw Pandoc JSON document is emitted on
stdout (not the usual `.pandoc.json.zip` archive). For all other formats the
binary archive is written directly to stdout.

### Inspect a .fidus file

```bash
fidusconvert info document.fidus
```

This prints the file's MIME type, format version, document title, language,
paper size, citation style, image and bibliography counts, and a listing of
all files inside the `.fidus` archive.

### Options

| Option | Description |
|--------|-------------|
| `--from <format>` | Input format (auto-detected from extension if omitted) |
| `--to <format>` | Output format (auto-detected from extension if omitted) |
| `-s, --style <style>` | Citation style: `apa`, `chicago-author-date`, `ieee`, etc. (default: `apa`) |
| `--docx-template <path>` | Custom DOCX template file |
| `--odt-template <path>` | Custom ODT template file |
| `--jats-type <type>` | JATS type: `article`, `book-part-wrapper`, `book` (default: `article`) |
| `--math-output <mathml\|svg>` | Math output for HTML/EPUB export: `mathml` (default) or `svg` |

## Supported formats

| Format | Read | Write | Extension |
|--------|:----:|:-----:|-----------|
| Fidus Writer | yes | yes | `.fidus` |
| DOCX | yes | yes | `.docx` |
| ODT | yes | yes | `.odt` |
| LaTeX | | yes | `.latex.zip` |
| HTML | | yes | `.html.zip` |
| EPUB | | yes | `.epub` |
| JATS | | yes | `.jats.zip` |
| Pandoc JSON | yes | yes | `.json` / `.pandoc.json.zip` |

## Dependencies

- [@fiduswriter/document](https://git.fiduswriter.org/fiduswriter/fiduswriter-document-ts) — document schema, importers and exporters
- [fwtoolkit](https://git.fiduswriter.org/fiduswriter/fwtoolkit) — shared utilities

## Development

```bash
npm install
npm run build
```

### Tests

The full test suite uses [Pandoc](https://pandoc.org) to generate DOCX, ODT and
Pandoc-JSON fixtures from Markdown sources and to cross-check exported files.
Make sure Pandoc is installed before running the tests:

```bash
# Debian/Ubuntu
sudo apt-get install pandoc

# macOS
brew install pandoc
```

Run all tests:

```bash
npm test
```

If Pandoc is unavailable, the core CLI tests in `test/convert.test.ts` can be
run directly:

```bash
npx tsx test/convert.test.ts
```

The test suite covers:

- All supported export formats from `.fidus` files.
- Import of DOCX, ODT and Pandoc JSON files into `.fidus`.
- A full conversion matrix (Markdown → DOCX/ODT/JSON → `.fidus` → every output
  format) with content checks.
- Pre-existing DOCX and ODT fixtures, including files with tracked changes,
  comments, footnotes and citation-manager fields.
- Synthetic DOCX files built from citation-manager `word/document.xml`
  fragments (Zotero, Mendeley, EndNote and Word-native bibliographies), with
  Word-native sources bundled as `customXml/item1.xml`.
- Synthetic ODT files built from citation-manager `content.xml` fragments
  (Zotero reference marks and LibreOffice native bibliography marks).

## License

AGPL-3.0-or-later
