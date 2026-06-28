# Installing fidusconvert

## Prerequisites

- Node.js 18 or later
- npm (comes with Node.js)

## npm (all platforms)

```bash
npm install -g @fiduswriter/cli
```

## From source

```bash
git clone ssh://git@codeberg.org/fiduswriter/fiduswriter-cli.git
cd fiduswriter-cli
npm install
npm run build
npm link
```

## Debian / Ubuntu

```bash
# Build the .deb package
cd packaging/debian
chmod +x build.sh
./build.sh

# Install it
sudo dpkg -i fidusconvert_0.1.0_all.deb

# Fix any missing dependencies
sudo apt-get install -f
```

## Arch Linux

```bash
cd packaging/arch
makepkg -si
```

## Fedora / RHEL / CentOS

```bash
# Build the RPM
rpmbuild -bb packaging/rpm/fidusconvert.spec

# Install it
sudo dnf install ~/rpmbuild/RPMS/noarch/fidusconvert-0.1.0-1.*.noarch.rpm
```

## macOS (Homebrew)

```bash
brew install --formula packaging/homebrew/fidusconvert.rb
```

## Verify installation

```bash
fidusconvert --version
fidusconvert --help
```

## Quick start

```bash
# Convert a .fidus file to DOCX
fidusconvert document.fidus output.docx

# Convert a DOCX file to .fidus format
fidusconvert input.docx output.fidus

# Convert between any supported formats with explicit format flags
fidusconvert --from docx --to latex input.docx output.latex.zip

# Convert with a custom citation style
fidusconvert -s chicago-author-date document.fidus output.html.zip

# Show information about a .fidus file
fidusconvert info document.fidus
```

## Supported formats

### Input formats
- `fidus` — Fidus Writer native format (`.fidus`)
- `docx` — Microsoft Word (Office Open XML, `.docx`)
- `odt` — OpenDocument Text (`.odt`)
- `pandoc` — Pandoc JSON (`.json`)

### Output formats
- `fidus` — Fidus Writer native format (`.fidus`)
- `docx` — Microsoft Word (Office Open XML, `.docx`)
- `odt` — OpenDocument Text (`.odt`)
- `latex` — LaTeX (`.latex.zip`)
- `html` — HTML (`.html.zip`)
- `epub` — EPUB e-book (`.epub`)
- `jats` — Journal Article Tag Suite (`.jats.zip`)
- `pandoc` — Pandoc JSON (`.pandoc.json.zip`)

Format is auto-detected from the file extension when `--from` / `--to` are
omitted. Use the flags when the extension is ambiguous or missing.
