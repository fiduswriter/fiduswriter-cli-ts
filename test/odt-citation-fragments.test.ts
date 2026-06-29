import {describe, it, before, after} from "node:test"
import assert from "node:assert/strict"
import {mkdtemp, rm} from "node:fs/promises"
import {join, dirname, basename, extname} from "node:path"
import {tmpdir} from "node:os"

import {run, outputPath, fileExists, fileMinSize, isZipWithEntry} from "./helpers/cli.js"
import {
    isPandocAvailable,
    generateCorpusCase,
    buildCitationOdt,
    extractTextFromOdt,
    type CorpusCase
} from "./helpers/corpus.js"

const FRAGMENT_DIR = join(dirname(import.meta.dirname), "test", "fixtures", "odt-citation-fragments")

const FRAGMENTS: Record<string, string> = {
    "zotero.xml": "According to recent work",
    "libreoffice-native.xml": "Research methods in ecology"
}

let tmpDir: string
let baseCase: CorpusCase

before(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), "fidusconvert-odt-citations-"))
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
        describe("ODT citation fragments", () => {
            it("skips because Pandoc is not installed", () => {
                console.warn("Pandoc not available; skipping ODT citation fragment tests")
            })
        })
        return
    }

    describe("ODT citation manager fragments", () => {
        for (const [fileName, snippet] of Object.entries(FRAGMENTS)) {
            it(`imports ${basename(fileName, extname(fileName))} without crashing`, async () => {
                const fragmentPath = join(FRAGMENT_DIR, fileName)
                const syntheticOdt = outputPath(
                    tmpDir,
                    `${basename(fileName, ".xml")}-synthetic.odt`
                )
                await buildCitationOdt(baseCase.inputs.odt, fragmentPath, syntheticOdt)

                const fidusPath = outputPath(tmpDir, `${basename(fileName, ".xml")}.fidus`)
                let result = await run([syntheticOdt, fidusPath])
                assert.equal(result.code, 0, `import failed: ${result.stderr}`)
                assert(await fileExists(fidusPath))
                assert(await isZipWithEntry(fidusPath, "document.json"))

                const exportedOdt = outputPath(
                    tmpDir,
                    `${basename(fileName, ".xml")}-exported.odt`
                )
                result = await run([fidusPath, exportedOdt])
                assert.equal(result.code, 0, `export failed: ${result.stderr}`)
                assert(await fileExists(exportedOdt))
                assert(await fileMinSize(exportedOdt, 500))

                const text = await extractTextFromOdt(exportedOdt)
                assert.ok(
                    text.includes(snippet),
                    `exported ODT missing expected citation text: ${text}`
                )
            })
        }
    })
}

describeFragments()
