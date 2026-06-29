import {describe, it, before, after} from "node:test"
import assert from "node:assert/strict"
import {mkdtemp, rm, readFile} from "node:fs/promises"
import {join, dirname} from "node:path"
import {tmpdir} from "node:os"
import JSZip from "jszip"

import {
    isPandocAvailable,
    generateCorpusCase,
    extractTextFromDocx,
    extractTextFromOdt,
    extractTextFromZipEntry,
    extractTextFromEpub,
    readZipEntry,
    assertValidXml,
    pandocToPlain,
    type CorpusCase
} from "./helpers/corpus.js"
import {run, outputPath, fileExists, fileMinSize, isZipWithEntry} from "./helpers/cli.js"

const CORPUS_DIR = join(dirname(import.meta.dirname), "test", "corpus")
const SOURCES = ["minimal.md", "inline.md", "structured.md"]

const tmpDir = await mkdtemp(join(tmpdir(), "fidusconvert-matrix-"))
const corpusCases: CorpusCase[] = []
if (isPandocAvailable()) {
    for (const source of SOURCES) {
        corpusCases.push(
            await generateCorpusCase(join(CORPUS_DIR, source), tmpDir)
        )
    }
}

after(async () => {
    await rm(tmpDir, {recursive: true, force: true})
})

const OUTPUT_FORMATS = [
    {format: "docx", ext: "docx", minSize: 1000, xmlEntry: "word/document.xml"},
    {format: "odt", ext: "odt", minSize: 500, xmlEntry: "content.xml"},
    {format: "latex", ext: "latex.zip", minSize: 200, xmlEntry: "document.tex"},
    {format: "html", ext: "html.zip", minSize: 200, xmlEntry: "document.html"},
    {format: "epub", ext: "epub", minSize: 500},
    {format: "jats", ext: "jats.zip", minSize: 200, xmlEntry: "manuscript.xml"},
    {format: "pandoc", ext: "pandoc.json.zip", minSize: 100, jsonEntry: "document.json"},
    {format: "fidus", ext: "fidus", minSize: 500}
] as const

const IMPORT_FORMATS = [
    {format: "docx", input: (c: CorpusCase) => c.inputs.docx},
    {format: "odt", input: (c: CorpusCase) => c.inputs.odt},
    {format: "pandoc", input: (c: CorpusCase) => c.inputs.json}
] as const

function describeMatrix() {
    if (!isPandocAvailable()) {
        describe("conversion matrix", () => {
            it("skips because Pandoc is not installed", () => {
                console.warn("Pandoc not available; skipping conversion matrix tests")
            })
        })
        return
    }

    for (const corpusCase of corpusCases) {
        describe(`${corpusCase.name} corpus`, () => {
            for (const importFmt of IMPORT_FORMATS) {
                const inputPath = importFmt.input(corpusCase)

                describe(`${importFmt.format} → fidus → all formats`, () => {
                    let fidusPath: string

                    before(async () => {
                        fidusPath = outputPath(tmpDir, `${corpusCase.name}-${importFmt.format}.fidus`)
                        const result = await run([inputPath, fidusPath])
                        assert.equal(result.code, 0, `import failed: ${result.stderr}`)
                        assert(await fileExists(fidusPath))
                        assert(await isZipWithEntry(fidusPath, "document.json"))
                    })

                    for (const outputFmt of OUTPUT_FORMATS) {
                        it(`→ ${outputFmt.format}`, async () => {
                            const out = outputPath(
                                tmpDir,
                                `${corpusCase.name}-${importFmt.format}-${outputFmt.format}.${outputFmt.ext}`
                            )
                            const result = await run([fidusPath, out])
                            assert.equal(
                                result.code,
                                0,
                                `export to ${outputFmt.format} failed: ${result.stderr}`
                            )
                            assert(await fileExists(out))
                            assert(
                                await fileMinSize(out, outputFmt.minSize),
                                `${outputFmt.format} output is too small`
                            )
                            await assertOutputContains(
                                out,
                                outputFmt.format,
                                outputFmt.xmlEntry,
                                outputFmt.jsonEntry,
                                corpusCase.snippet
                            )
                        })
                    }
                })
            }
        })
    }
}

async function assertOutputContains(
    path: string,
    format: string,
    xmlEntry: string | undefined,
    jsonEntry: string | undefined,
    snippet: string
): Promise<void> {
    const contains = (text: string, needle: string) =>
        normalizeWhitespace(text).includes(normalizeWhitespace(needle))

    switch (format) {
        case "docx": {
            await assertValidXml(path, xmlEntry!)
            const text = await extractTextFromDocx(path)
            assert.ok(contains(text, snippet), `DOCX text missing snippet: ${text}`)
            const plain = await pandocToPlain(path, "docx")
            assert.ok(contains(plain, snippet), `DOCX plain text missing snippet: ${plain}`)
            break
        }
        case "odt": {
            await assertValidXml(path, xmlEntry!)
            const text = await extractTextFromOdt(path)
            assert.ok(contains(text, snippet), `ODT text missing snippet: ${text}`)
            const plain = await pandocToPlain(path, "odt")
            assert.ok(contains(plain, snippet), `ODT plain text missing snippet: ${plain}`)
            break
        }
        case "latex":
        case "html":
        case "jats": {
            await assertValidXml(path, xmlEntry!)
            const text = await extractTextFromZipEntry(path, xmlEntry!)
            assert.ok(contains(text, snippet), `${format} text missing snippet: ${text}`)
            break
        }
        case "epub": {
            const text = await extractTextFromEpub(path)
            assert.ok(contains(text, snippet), `EPUB text missing snippet: ${text}`)
            const plain = await pandocToPlain(path, "epub")
            assert.ok(contains(plain, snippet), `EPUB plain text missing snippet: ${plain}`)
            break
        }
        case "pandoc": {
            const jsonText = await readZipEntry(path, jsonEntry!)
            const doc = JSON.parse(jsonText)
            const plain = pandocAstToPlain(doc)
            assert.ok(contains(plain, snippet), `Pandoc JSON missing snippet: ${plain}`)
            break
        }
        case "fidus": {
            const buf = await readFile(path)
            const zip = await JSZip.loadAsync(buf)
            const docText = await zip.file("document.json")!.async("string")
            const doc = JSON.parse(docText)
            const content = doc.content ?? doc
            const text = flattenProseMirror(content)
            assert.ok(contains(text, snippet), `Fidus document missing snippet: ${text}`)
            break
        }
    }
}

function normalizeWhitespace(text: string): string {
    return text.replace(/\s+/g, " ").trim()
}

function pandocAstToPlain(doc: any): string {
    const blocks = doc.blocks ?? doc.pandoc?.blocks ?? []
    return blocks.map(blockToPlain).join(" ")
}

function blockToPlain(block: any): string {
    if (!block) return ""
    if (Array.isArray(block)) {
        return block.map(blockToPlain).join(" ")
    }
    if (block.t === "Str") return block.c ?? ""
    if (block.t === "Space" || block.t === "SoftBreak") return " "
    if (block.c && Array.isArray(block.c)) {
        return block.c.map(blockToPlain).join(" ")
    }
    return ""
}

function flattenProseMirror(node: any): string {
    if (!node) return ""
    if (typeof node === "string") return node
    if (Array.isArray(node)) return node.map(flattenProseMirror).join(" ")
    let text = ""
    if (node.text) text += node.text + " "
    if (node.content) text += flattenProseMirror(node.content)
    return text
}

describeMatrix()
