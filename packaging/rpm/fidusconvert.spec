Name:           fidusconvert
Version:        0.1.0
Release:        1%{?dist}
Summary:        Command-line tool for Fidus Writer document conversion

License:        AGPL-3.0-or-later
URL:            https://fiduswriter.org
Source0:        https://git.fiduswriter.org/fiduswriter/fiduswriter-cli-ts/archive/v%{version}.tar.gz

BuildArch:      noarch
BuildRequires:  nodejs >= 18, npm, typescript
Requires:       nodejs >= 18

%description
fidusconvert provides command-line tools for converting between
Fidus Writer (.fidus) document format and various other formats including
DOCX, ODT, LaTeX, HTML, EPUB, JATS, and Pandoc JSON.

%prep
%autosetup -n fiduswriter-cli-ts

%build
npm install
npm run build

%install
mkdir -p %{buildroot}/usr/lib/node_modules/@fiduswriter/cli
cp -r dist templates package.json %{buildroot}/usr/lib/node_modules/@fiduswriter/cli/
cd %{buildroot}/usr/lib/node_modules/@fiduswriter/cli
npm install --production --ignore-scripts

mkdir -p %{buildroot}/usr/bin
ln -sf /usr/lib/node_modules/@fiduswriter/cli/dist/bin/fidusconvert.js %{buildroot}/usr/bin/fidusconvert

%files
%license LICENSE
/usr/lib/node_modules/@fiduswriter/cli
/usr/bin/fidusconvert

%changelog
* Sun Jun 28 2026 Johannes Wilm <johannes@wilm.one> - 0.1.0-1
- Initial package
