import {execFile} from "node:child_process"
import {readFile} from "node:fs/promises"
import {basename, extname, join} from "node:path"
import {promisify} from "node:util"
import JSZip from "jszip"
import {XMLParser} from "fast-xml-parser"

const execFileAsync = promisify(execFile)

let pandocCache: string | undefined | null = null

export function isPandocAvailable(): boolean {
    return findPandoc() !== null
}

function findPandoc(): string | null {
    if (pandocCache !== null) {
        return pandocCache
    }
    const candidates = ["pandoc", "/usr/bin/pandoc", "/usr/local/bin/pandoc"]
    for (const candidate of candidates) {
        try {
            execFileSync(candidate, ["--version"])
            pandocCache = candidate
            return candidate
        } catch {
            // try next candidate
        }
    }
    pandocCache = null
    return null
}

// Imported lazily because `promisify` is already set up above; execFileSync is
// used only for the availability probe.
import {execFileSync} from "node:child_process"

export interface GeneratedInputs {
    name: string
    docx: string
    odt: string
    json: string
}

export interface CorpusCase {
    name: string
    snippet: string
    inputs: GeneratedInputs
}

const DEFAULT_SNIPPET = "MatrixSnippet2024"

export async function buildCitationDocx(
    baseDocxPath: string,
    fragmentXmlPath: string,
    outputPath: string,
    sourcesXmlPath?: string
): Promise<string> {
    const baseBuf = await readFile(baseDocxPath)
    const fragmentXml = await readFile(fragmentXmlPath, "utf-8")

    const zip = await JSZip.loadAsync(baseBuf)
    zip.remove("word/document.xml")
    zip.file("word/document.xml", fragmentXml)
    if (sourcesXmlPath) {
        zip.file("customXml/item1.xml", await readFile(sourcesXmlPath, "utf-8"))
    }

    const outputBuf = await zip.generateAsync({type: "nodebuffer"})
    const {writeFile} = await import("node:fs/promises")
    await writeFile(outputPath, outputBuf)

    return outputPath
}

export async function buildCitationOdt(
    baseOdtPath: string,
    fragmentXmlPath: string,
    outputPath: string
): Promise<string> {
    const baseBuf = await readFile(baseOdtPath)
    const fragmentXml = await readFile(fragmentXmlPath, "utf-8")

    const zip = await JSZip.loadAsync(baseBuf)
    zip.remove("content.xml")
    zip.file("content.xml", fragmentXml)

    const outputBuf = await zip.generateAsync({type: "nodebuffer"})
    const {writeFile} = await import("node:fs/promises")
    await writeFile(outputPath, outputBuf)

    return outputPath
}

export async function generateCorpusCase(
    markdownPath: string,
    outputDir: string
): Promise<CorpusCase> {
    const pandoc = findPandoc()
    if (!pandoc) {
        throw new Error("Pandoc is not available")
    }

    const name = basename(markdownPath, extname(markdownPath))
    const docx = join(outputDir, `${name}.docx`)
    const odt = join(outputDir, `${name}.odt`)
    const json = join(outputDir, `${name}.json`)

    await runPandoc(pandoc, [markdownPath, "-f", "markdown", "-t", "docx", "-o", docx])
    await runPandoc(pandoc, [markdownPath, "-f", "markdown", "-t", "odt", "-o", odt])
    await runPandoc(pandoc, [markdownPath, "-f", "markdown", "-t", "json", "-o", json])

    return {
        name,
        snippet: DEFAULT_SNIPPET,
        inputs: {name, docx, odt, json}
    }
}

async function runPandoc(pandoc: string, args: string[]): Promise<void> {
    const {stderr} = await execFileAsync(pandoc, args)
    if (stderr && stderr.trim()) {
        // Pandoc warnings are common and should not fail generation.
        console.warn(`pandoc warning: ${stderr.trim()}`)
    }
}

export async function pandocToPlain(
    inputPath: string,
    fromFormat: "docx" | "odt" | "epub" | "html" | "latex"
): Promise<string> {
    const pandoc = findPandoc()
    if (!pandoc) {
        throw new Error("Pandoc is not available")
    }
    const {stdout} = await execFileAsync(pandoc, [
        inputPath,
        "-f",
        fromFormat,
        "-t",
        "plain"
    ])
    return stdout
}

export async function fileText(path: string): Promise<string> {
    const buf = await readFile(path)
    return buf.toString("utf-8")
}

export async function extractTextFromDocx(path: string): Promise<string> {
    return extractTextFromZipEntry(path, "word/document.xml")
}

export async function extractTextFromOdt(path: string): Promise<string> {
    return extractTextFromZipEntry(path, "content.xml")
}

export async function extractTextFromZipEntry(
    path: string,
    entryName: string
): Promise<string> {
    const content = await readZipEntry(path, entryName)
    return stripXmlTags(content)
}

export async function extractTextFromEpub(path: string): Promise<string> {
    const buf = await readFile(path)
    const zip = await JSZip.loadAsync(buf)
    const texts: string[] = []
    for (const [fileName, file] of Object.entries(zip.files)) {
        if (file.dir) continue
        if (/\.(xhtml|html|htm)$/i.test(fileName)) {
            const html = await file.async("string")
            texts.push(stripXmlTags(html))
        }
    }
    return texts.join(" ")
}

export async function readZipEntry(
    path: string,
    entryName: string
): Promise<string> {
    const buf = await readFile(path)
    const zip = await JSZip.loadAsync(buf)
    const file = zip.file(entryName)
    if (!file) {
        throw new Error(`Missing ${entryName} in ${path}`)
    }
    return file.async("string")
}

export async function assertValidXml(
    path: string,
    entryName?: string
): Promise<void> {
    const content = entryName
        ? await readZipEntry(path, entryName)
        : await fileText(path)
    const parser = new XMLParser()
    parser.parse(content)
}

function stripXmlTags(xml: string): string {
    return xml
        .replace(/<[^>]+>/g, " ")
        .replace(/\s+/g, " ")
        .trim()
}
