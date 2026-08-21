class Fidusconvert < Formula
  desc "Command-line tool for Fidus Writer document conversion"
  homepage "https://fiduswriter.org"
  url "https://git.fiduswriter.org/fiduswriter/fiduswriter-cli-ts/archive/v0.1.0.tar.gz"
  sha256 "SKIP"
  license "AGPL-3.0-or-later"

  depends_on "node"

  def install
    system "npm", "install"
    system "npm", "run", "build"

    libexec.install Dir["*"]
    bin.install_symlink libexec/"dist/bin/fidusconvert.js" => "fidusconvert"
  end

  test do
    system bin/"fidusconvert", "--version"
  end
end
