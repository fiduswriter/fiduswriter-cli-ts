#!/usr/bin/env node
/**
 * Regenerate the pandoc-derived files in test/corpus/ from the markdown
 * sources next to them. The generated files are committed fixtures: the
 * tests read them from disk so they can be modified and reviewed by hand,
 * and this script exists to refresh them deliberately (for example after
 * editing a .md source or changing the pandoc version).
 *
 * Usage: node scripts/update-test-corpus.mjs
 */
import {execFileSync} from "node:child_process"
import {readdirSync} from "node:fs"
import {basename, dirname, extname, join} from "node:path"
import {fileURLToPath} from "node:url"

const corpusDir = join(
    dirname(fileURLToPath(import.meta.url)),
    "..",
    "test",
    "corpus"
)

const TARGETS = [
    {extension: "docx", args: ["-t", "docx"]},
    {extension: "odt", args: ["-t", "odt"]},
    {extension: "json", args: ["-t", "json"]},
    {extension: "html", args: ["-t", "html5", "-s"]}
]

const sources = readdirSync(corpusDir).filter(file => extname(file) === ".md")

for (const source of sources) {
    const input = join(corpusDir, source)
    const name = basename(source, ".md")
    for (const target of TARGETS) {
        const output = join(corpusDir, `${name}.${target.extension}`)
        execFileSync(
            "pandoc",
            [input, "-f", "markdown", ...target.args, "-o", output],
            {stdio: "inherit"}
        )
        console.log(`${source} -> ${basename(output)}`)
    }
}
