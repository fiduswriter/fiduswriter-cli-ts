#!/bin/bash
set -e

PKG_NAME="fidusconvert"
PKG_VERSION="${1:-0.1.0}"
PKG_DIR="${PKG_NAME}_${PKG_VERSION}_all"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SRC_DIR="$(dirname "$SCRIPT_DIR")"

rm -rf "$PKG_DIR"
mkdir -p "$PKG_DIR/DEBIAN"
mkdir -p "$PKG_DIR/usr/bin"
mkdir -p "$PKG_DIR/usr/lib/node_modules/@fiduswriter/cli"

cp "$SCRIPT_DIR/control" "$PKG_DIR/DEBIAN/control"
sed -i "s/Version:.*/Version: $PKG_VERSION/" "$PKG_DIR/DEBIAN/control"

cp "$SRC_DIR/package.json" "$PKG_DIR/usr/lib/node_modules/@fiduswriter/cli/"
cp -r "$SRC_DIR/dist" "$PKG_DIR/usr/lib/node_modules/@fiduswriter/cli/" 2>/dev/null || true
cp -r "$SRC_DIR/templates" "$PKG_DIR/usr/lib/node_modules/@fiduswriter/cli/"

if [ -d "$SRC_DIR/dist" ]; then
    ln -sf "/usr/lib/node_modules/@fiduswriter/cli/dist/bin/fidusconvert.js" "$PKG_DIR/usr/bin/fidusconvert"
else
    echo "Error: dist/ directory not found. Run 'npm run build' first."
    rm -rf "$PKG_DIR"
    exit 1
fi

dpkg-deb --build "$PKG_DIR"
rm -rf "$PKG_DIR"

echo "Built ${PKG_DIR}.deb"
