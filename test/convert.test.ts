import {describe, it, before, after} from "node:test"
import assert from "node:assert/strict"
import {execFile} from "node:child_process"
import {mkdtemp, rm, stat, readFile} from "node:fs/promises"
import {join, dirname} from "node:path"
import {tmpdir} from "node:os"
import JSZip from "jszip"

const CLI = join(dirname(import.meta.dirname), "dist", "bin", "fidusconvert.js")
const FIXTURE = join(dirname(import.meta.dirname), "test", "test-document.fidus")
const CLASSIC_DOCX = join(dirname(import.meta.dirname), "templates", "Classic.docx")
const FREE_ODT = join(dirname(import.meta.dirname), "templates", "Free.odt")

let tmpDir: string

before(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), "fidusconvert-test-"))
})

after(async () => {
    if (tmpDir) {
        await rm(tmpDir, {recursive: true, force: true})
    }
})

function run(args: string[]): Promise<{stdout: string; stderr: string; code: number}> {
    return new Promise(resolve => {
        execFile("node", [CLI, ...args], {timeout: 30000}, (err, stdout, stderr) => {
            resolve({
                stdout: stdout || "",
                stderr: stderr || "",
                code: err && "code" in err ? (err as any).code : 0
            })
        })
    })
}

function outputPath(name: string): string {
    return join(tmpDir, name)
}

async function fileExists(path: string): Promise<boolean> {
    try {
        await stat(path)
        return true
    } catch {
        return false
    }
}

async function fileMinSize(path: string, minBytes: number): Promise<boolean> {
    try {
        const s = await stat(path)
        return s.size >= minBytes
    } catch {
        return false
    }
}

async function isZipWithEntry(path: string, entry: string): Promise<boolean> {
    try {
        const buf = await readFile(path)
        const zip = await JSZip.loadAsync(buf)
        return zip.file(entry) !== null
    } catch {
        return false
    }
}

async function isZipWithXmlEntry(path: string, entry: string, pattern: RegExp): Promise<boolean> {
    try {
        const buf = await readFile(path)
        const zip = await JSZip.loadAsync(buf)
        const xmlFile = zip.file(entry)
        if (!xmlFile) return false
        const content = await xmlFile.async("string")
        return pattern.test(content)
    } catch {
        return false
    }
}

describe("fidusconvert CLI", () => {
    it("shows version", async () => {
        const result = await run(["--version"])
        assert.equal(result.code, 0)
        assert.match(result.stdout.trim(), /^\d+\.\d+\.\d+$/)
    })

    it("shows help", async () => {
        const result = await run(["--help"])
        assert.equal(result.code, 0)
        assert.ok(result.stdout.includes("convert"))
        assert.ok(result.stdout.includes("info"))
    })

    it("fails with unknown format", async () => {
        const result = await run(["--from", "unknown", FIXTURE, outputPath("out.docx")])
        assert.notEqual(result.code, 0)
    })
})

describe("fidus → export formats", () => {
    it("fidus → docx", async () => {
        const out = outputPath("export.docx")
        const result = await run([FIXTURE, out])
        assert.equal(result.code, 0, `stderr: ${result.stderr}`)
        assert(await fileExists(out))
        assert(await fileMinSize(out, 1000))
        assert(await isZipWithEntry(out, "word/document.xml"))
    })

    it("fidus → docx with custom template", async () => {
        const out = outputPath("export-template.docx")
        const result = await run(["--docx-template", CLASSIC_DOCX, FIXTURE, out])
        assert.equal(result.code, 0, `stderr: ${result.stderr}`)
        assert(await fileExists(out))
        assert(await isZipWithEntry(out, "word/document.xml"))
    })

    it("fidus → odt", async () => {
        const out = outputPath("export.odt")
        const result = await run([FIXTURE, out])
        assert.equal(result.code, 0, `stderr: ${result.stderr}`)
        assert(await fileExists(out))
        assert(await fileMinSize(out, 500))
        assert(await isZipWithEntry(out, "content.xml"))
    })

    it("fidus → odt with custom template", async () => {
        const out = outputPath("export-template.odt")
        const result = await run(["--odt-template", FREE_ODT, FIXTURE, out])
        assert.equal(result.code, 0, `stderr: ${result.stderr}`)
        assert(await fileExists(out))
        assert(await isZipWithEntry(out, "content.xml"))
    })

    it("fidus → latex", async () => {
        const out = outputPath("export.latex.zip")
        const result = await run([FIXTURE, out])
        assert.equal(result.code, 0, `stderr: ${result.stderr}`)
        assert(await fileExists(out))
        assert(await isZipWithEntry(out, "document.tex"))
    })

    it("fidus → html", async () => {
        const out = outputPath("export.html.zip")
        const result = await run([FIXTURE, out])
        assert.equal(result.code, 0, `stderr: ${result.stderr}`)
        assert(await fileExists(out))
        assert(await isZipWithEntry(out, "document.html"))
    })

    it("fidus → epub", async () => {
        const out = outputPath("export.epub")
        const result = await run([FIXTURE, out])
        assert.equal(result.code, 0, `stderr: ${result.stderr}`)
        assert(await fileExists(out))
        assert(await fileMinSize(out, 500))
    })

    it("fidus → jats", async () => {
        const out = outputPath("export.jats.zip")
        const result = await run([FIXTURE, out])
        assert.equal(result.code, 0, `stderr: ${result.stderr}`)
        assert(await fileExists(out))
        assert(await fileMinSize(out, 200))
    })

    it("fidus → pandoc", async () => {
        const out = outputPath("export.pandoc.json.zip")
        const result = await run([FIXTURE, out])
        assert.equal(result.code, 0, `stderr: ${result.stderr}`)
        assert(await fileExists(out))
        assert(await fileMinSize(out, 100))
    })

    it("fidus → fidus", async () => {
        const out = outputPath("export.fidus")
        const result = await run([FIXTURE, out])
        assert.equal(result.code, 0, `stderr: ${result.stderr}`)
        assert(await fileExists(out))
        assert(await isZipWithEntry(out, "document.json"))
    })
})

describe("docx/odt → fidus → export (round-trip)", () => {
    it("fidus → docx → fidus", async () => {
        const docxPath = outputPath("rt1.docx")
        let result = await run([FIXTURE, docxPath])
        assert.equal(result.code, 0, `stderr: ${result.stderr}`)
        assert(await fileExists(docxPath))

        const fidusPath = outputPath("rt1.fidus")
        result = await run([docxPath, fidusPath])
        assert.equal(result.code, 0, `stderr: ${result.stderr}`)
        assert(await fileExists(fidusPath))
        assert(await isZipWithEntry(fidusPath, "document.json"))
    })

    it("fidus → odt → fidus", async () => {
        const odtPath = outputPath("rt2.odt")
        let result = await run([FIXTURE, odtPath])
        assert.equal(result.code, 0, `stderr: ${result.stderr}`)
        assert(await fileExists(odtPath))

        const fidusPath = outputPath("rt2.fidus")
        result = await run([odtPath, fidusPath])
        assert.equal(result.code, 0, `stderr: ${result.stderr}`)
        assert(await fileExists(fidusPath))
        assert(await isZipWithEntry(fidusPath, "document.json"))
    })

    it("fidus → docx → html", async () => {
        const docxPath = outputPath("rt3.docx")
        let result = await run([FIXTURE, docxPath])
        assert.equal(result.code, 0, `stderr: ${result.stderr}`)

        const htmlPath = outputPath("rt3.html.zip")
        result = await run([docxPath, htmlPath])
        assert.equal(result.code, 0, `stderr: ${result.stderr}`)
        assert(await fileExists(htmlPath))
        assert(await isZipWithEntry(htmlPath, "document.html"))
    })

    it("fidus → odt → latex", async () => {
        const odtPath = outputPath("rt4.odt")
        let result = await run([FIXTURE, odtPath])
        assert.equal(result.code, 0, `stderr: ${result.stderr}`)

        const latexPath = outputPath("rt4.latex.zip")
        result = await run([odtPath, latexPath])
        assert.equal(result.code, 0, `stderr: ${result.stderr}`)
        assert(await fileExists(latexPath))
        assert(await isZipWithEntry(latexPath, "document.tex"))
    })
})

describe("info command", () => {
    it("shows document info", async () => {
        const result = await run(["info", FIXTURE])
        assert.equal(result.code, 0, `stderr: ${result.stderr}`)
        assert.ok(result.stdout.includes("Test Document"))
        assert.ok(result.stdout.includes("en-US"))
    })

    it("fails on invalid file", async () => {
        const result = await run(["info", outputPath("nonexistent.fidus")])
        assert.notEqual(result.code, 0)
    })
})

describe("content validation", () => {
    it("docx contains title text", async () => {
        const out = outputPath("content.docx")
        const result = await run([FIXTURE, out])
        assert.equal(result.code, 0, `stderr: ${result.stderr}`)
        assert(await isZipWithXmlEntry(out, "word/document.xml", /Test Document/))
    })

    it("odt contains title text", async () => {
        const out = outputPath("content.odt")
        const result = await run([FIXTURE, out])
        assert.equal(result.code, 0, `stderr: ${result.stderr}`)
        assert(await isZipWithXmlEntry(out, "content.xml", /Test Document/))
    })

    it("jats contains body text", async () => {
        const out = outputPath("content.jats.zip")
        const result = await run([FIXTURE, out])
        assert.equal(result.code, 0, `stderr: ${result.stderr}`)
        assert(await isZipWithXmlEntry(out, "manuscript.xml", /Introduction/))
    })

    it("html contains body text", async () => {
        const out = outputPath("content.html.zip")
        const result = await run([FIXTURE, out])
        assert.equal(result.code, 0, `stderr: ${result.stderr}`)
        assert(await isZipWithXmlEntry(out, "document.html", /Introduction/))
    })

    it("latex contains body text", async () => {
        const out = outputPath("content.latex.zip")
        const result = await run([FIXTURE, out])
        assert.equal(result.code, 0, `stderr: ${result.stderr}`)
        assert(await isZipWithXmlEntry(out, "document.tex", /Introduction/))
    })
})

describe("explicit format flags", () => {
    it("--from and --to override extension", async () => {
        const out = outputPath("custom-output.bin")
        const result = await run(["--from", "fidus", "--to", "docx", FIXTURE, out])
        assert.equal(result.code, 0, `stderr: ${result.stderr}`)
        assert(await isZipWithEntry(out, "word/document.xml"))
    })

    it("--to latex with .zip extension", async () => {
        const out = outputPath("latex-out.zip")
        const result = await run(["--to", "latex", FIXTURE, out])
        assert.equal(result.code, 0, `stderr: ${result.stderr}`)
        assert(await isZipWithEntry(out, "document.tex"))
    })

    it("--jats-type book-part-wrapper", async () => {
        const out = outputPath("jats-book.jats.zip")
        const result = await run(["--jats-type", "book-part-wrapper", FIXTURE, out])
        assert.equal(result.code, 0, `stderr: ${result.stderr}`)
        assert(await fileExists(out))
    })
})

describe("edge cases", () => {
    it("fidus → fidus produces valid zip with all required entries", async () => {
        const out = outputPath("fidus-roundtrip.fidus")
        const result = await run([FIXTURE, out])
        assert.equal(result.code, 0, `stderr: ${result.stderr}`)
        assert(await isZipWithEntry(out, "document.json"))
        assert(await isZipWithEntry(out, "mimetype"))
        assert(await isZipWithEntry(out, "filetype-version"))
    })

    it("fidus → fidus preserves title in document.json", async () => {
        const out = outputPath("fidus-preserve.fidus")
        const result = await run([FIXTURE, out])
        assert.equal(result.code, 0, `stderr: ${result.stderr}`)
        const buf = await readFile(out)
        const zip = await JSZip.loadAsync(buf)
        const docText = await zip.file("document.json")!.async("string")
        const doc = JSON.parse(docText)
        const content = doc.content || doc
        const innerContent = content.content || content
        const titleNode = Array.isArray(innerContent) ? innerContent.find((n: any) => n.type === "title") : null
        assert.ok(titleNode, "title node not found")
        assert.ok(titleNode.content.some((n: any) => n.text === "Test Document"))
    })

    it("convert without subcommand still works (default command)", async () => {
        const out = outputPath("default-cmd.docx")
        const result = await run([FIXTURE, out])
        assert.equal(result.code, 0, `stderr: ${result.stderr}`)
        assert(await fileExists(out))
    })

    it("output file is non-trivial size for all export formats", async () => {
        const formats = [
            ["docx", 1000],
            ["odt", 500],
            ["latex.zip", 200],
            ["html.zip", 200],
            ["epub", 500],
            ["jats.zip", 200],
            ["pandoc.json.zip", 100],
            ["fidus", 500]
        ] as const
        for (const [ext, minSize] of formats) {
            const out = outputPath(`size-test.${ext}`)
            const result = await run([FIXTURE, out])
            assert.equal(result.code, 0, `format ${ext} failed: ${result.stderr}`)
            assert(await fileMinSize(out, minSize), `format ${ext} too small`)
        }
    })

    it("re-exporting same format produces valid output", async () => {
        const out1 = outputPath("reexport1.fidus")
        let result = await run([FIXTURE, out1])
        assert.equal(result.code, 0, `stderr: ${result.stderr}`)

        const out2 = outputPath("reexport2.fidus")
        result = await run([out1, out2])
        assert.equal(result.code, 0, `stderr: ${result.stderr}`)
        assert(await isZipWithEntry(out2, "document.json"))
    })
})
