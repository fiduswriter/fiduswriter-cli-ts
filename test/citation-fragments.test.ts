import {describe, it, before, after} from "node:test"
import assert from "node:assert/strict"
import {mkdtemp, rm} from "node:fs/promises"
import {join, dirname, basename, extname} from "node:path"
import {tmpdir} from "node:os"

import {run, outputPath, fileExists, fileMinSize, isZipWithEntry} from "./helpers/cli.js"
import {
    isPandocAvailable,
    generateCorpusCase,
    buildCitationDocx,
    extractTextFromDocx,
    type CorpusCase
} from "./helpers/corpus.js"

const FRAGMENT_DIR = join(dirname(import.meta.dirname), "test", "fixtures", "citation-fragments")

interface FragmentSpec {
    snippet: string
    sources?: string
}

const FRAGMENTS: Record<string, FragmentSpec> = {
    "zotero.xml": {snippet: "Hawking"},
    "mendeley-v3.xml": {snippet: "According to recent research"},
    "endnote.xml": {snippet: "Bronk Ramsey"},
    "word-native.xml": {
        snippet: "Advances in testing methodology",
        sources: "word-native-sources.xml"
    }
}

let tmpDir: string
let baseCase: CorpusCase

before(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), "fidusconvert-citations-"))
    if (isPandocAvailable()) {
        baseCase = await generateCorpusCase(
            join(dirname(import.meta.dirname), "test", "corpus", "minimal.md"),
            tmpDir
        )
    }
})

after(async () => {
    if (tmpDir) {
        await rm(tmpDir, {recursive: true, force: true})
    }
})

function describeFragments() {
    if (!isPandocAvailable()) {
        describe("citation fragments", () => {
            it("skips because Pandoc is not installed", () => {
                console.warn("Pandoc not available; skipping citation fragment tests")
            })
        })
        return
    }

    describe("citation manager DOCX fragments", () => {
        for (const [fileName, spec] of Object.entries(FRAGMENTS)) {
            it(`imports ${basename(fileName, extname(fileName))} without crashing`, async () => {
                const fragmentPath = join(FRAGMENT_DIR, fileName)
                const syntheticDocx = outputPath(
                    tmpDir,
                    `${basename(fileName, ".xml")}-synthetic.docx`
                )
                const sourcesPath = spec.sources
                    ? join(FRAGMENT_DIR, spec.sources)
                    : undefined
                await buildCitationDocx(baseCase.inputs.docx, fragmentPath, syntheticDocx, sourcesPath)

                const fidusPath = outputPath(
                    tmpDir,
                    `${basename(fileName, ".xml")}.fidus`
                )
                let result = await run([syntheticDocx, fidusPath])
                assert.equal(result.code, 0, `import failed: ${result.stderr}`)
                assert(await fileExists(fidusPath))
                assert(await isZipWithEntry(fidusPath, "document.json"))

                const exportedDocx = outputPath(
                    tmpDir,
                    `${basename(fileName, ".xml")}-exported.docx`
                )
                result = await run([fidusPath, exportedDocx])
                assert.equal(result.code, 0, `export failed: ${result.stderr}`)
                assert(await fileExists(exportedDocx))
                assert(await fileMinSize(exportedDocx, 1000))

                const text = await extractTextFromDocx(exportedDocx)
                assert.ok(
                    text.includes(spec.snippet),
                    `exported DOCX missing expected citation text: ${text}`
                )
            })
        }
    })
}

describeFragments()
