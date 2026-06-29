# @fiduswriter/cli

<p align="center"><img src="https://codeberg.org/fiduswriter/fiduswriter-cli/raw/branch/main/logo.svg" alt="fidusconvert logo" width="100" height="100"></p>

Command-line tool for converting documents between
[Fidus Writer](https://fiduswriter.org) native format (`.fidus`) and other
document formats. Built on top of
[@fiduswriter/document](https://codeberg.org/fiduswriter/fiduswriter-document).

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

- [@fiduswriter/document](https://codeberg.org/fiduswriter/fiduswriter-document) — document schema, importers and exporters
- [fwtoolkit](https://codeberg.org/fiduswriter/fwtoolkit) — shared utilities

## Development

```bash
npm install
npm run build
```

## License

AGPL-3.0-or-later
