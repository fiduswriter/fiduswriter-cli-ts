import type {Command} from "commander"
import {mkdtemp, readFile, rm, writeFile} from "node:fs/promises"
import {extname, join, resolve} from "node:path"
import {tmpdir} from "node:os"
import JSZip from "jszip"
import {Node as PMNode} from "prosemirror-model"

import type {ExportDoc, FidusNode} from "@fiduswriter/document"
import {ensureInit} from "../init.js"
import {readFidusFile} from "../utils/fidus-reader.js"
import {loadCSL} from "../utils/csl.js"
import {loadDocxTemplate, loadOdtTemplate} from "../utils/templates.js"
import {writeBlobToFile} from "../utils/file.js"

import {generateDocxTemplate, generateOdtTemplate} from "@fiduswriter/document/exporter/template"
import {DocxImporter} from "@fiduswriter/document/importer/docx"
import {OdtImporter} from "@fiduswriter/document/importer/odt"
import {PandocImporter} from "@fiduswriter/document/importer/pandoc"
import {ShrinkFidus} from "@fiduswriter/document/exporter/native/shrink"
import {ZipFidus} from "@fiduswriter/document/exporter/native/zip"
import {acceptAllNoInsertions} from "@fiduswriter/document/transform"
import {docSchema} from "@fiduswriter/document/schema/document/index"

import {FilesystemNativeImporterBackend} from "../importers/backend.js"
import {getDefaultTemplate} from "../utils/default-template.js"
import {CLIDocxExporter} from "../exporters/docx.js"
import {CLIodtExporter} from "../exporters/odt.js"
import {CLILatexExporter} from "../exporters/latex.js"
import {CLIHtmlExporter} from "../exporters/html.js"
import {CLIEpubExporter} from "../exporters/epub.js"
import {CLIJatsExporter} from "../exporters/jats.js"
import {CLIPandocExporter} from "../exporters/pandoc.js"

const FORMATS = [
    "fidus",
    "docx",
    "odt",
    "latex",
    "html",
    "epub",
    "jats",
    "pandoc"
] as const

type Format = (typeof FORMATS)[number]

interface ConvertOptions {
    from?: string
    to?: string
    style?: string
    docxTemplate?: string
    odtTemplate?: string
    jatsType?: string
    mathOutput?: string
    trackedChanges?: string
}

interface ShrinkableDoc {
    content: FidusNode
    [key: string]: unknown
}

interface DocContent {
    content: Array<{type: string; attrs?: Record<string, unknown>}>
    attrs?: Record<string, unknown>
}

function addConvertOptions(cmd: Command): void {
    cmd
        .argument("<input>", "Path to the input file, or '-' to read from stdin")
        .argument("<output>", "Path to the output file, or '-' to write to stdout")
        .option(
            "--from <format>",
            `Input format (${FORMATS.join(", ")}; auto-detected from extension if omitted)`
        )
        .option(
            "--to <format>",
            `Output format (${FORMATS.join(", ")}; auto-detected from extension if omitted)`
        )
        .option(
            "-s, --style <style>",
            "Citation style ID from the citeproc-plus catalog (e.g. apa, chicago-author-date, ieee)"
        )
        .option("--docx-template <path>", "Custom DOCX template file")
        .option("--odt-template <path>", "Custom ODT template file")
        .option("--jats-type <type>", "JATS type: article, book-part-wrapper, book", "article")
        .option(
            "--math-output <mathml|svg>",
            "Math output for HTML/EPUB export: MathML (default) or SVG",
            "mathml"
        )
        .option(
            "--tracked-changes <resolve|include>",
            "How to handle tracked changes in HTML/EPUB/DOCX/ODT export: resolve (accept all, default) or include them in the output. Other formats always resolve tracked changes.",
            "resolve"
        )
}

export function registerConvertCommand(program: Command): void {
    // The convert command is the default action, so its options are also
    // exposed at the top level for discoverability.
    addConvertOptions(program)
    program.action(async (input, output, options) => {
        await doConvert(input, output, options)
    })

    // Keep an explicit "convert" subcommand for users who prefer it.
    const convertCmd = program.command("convert")
    convertCmd.description("Convert a document between formats")
    addConvertOptions(convertCmd)
    convertCmd.action(async (input, output, options) => {
        await doConvert(input, output, options)
    })
}

function mathOutputFromOptions(options: ConvertOptions): "mathml" | "svg" {
    const value = options.mathOutput || "mathml"
    if (value !== "mathml" && value !== "svg") {
        console.error(
            `Invalid --math-output value "${value}". Use "mathml" or "svg".`
        )
        process.exit(1)
    }
    return value
}

// Formats whose output can represent tracked changes; the `--tracked-changes`
// option applies to these. Formats that cannot represent them always resolve
// (merge) the changes before exporting.
const TRACK_CAPABLE_FORMATS: Format[] = ["html", "epub", "docx", "odt"]
const ALWAYS_RESOLVE_FORMATS: Format[] = ["latex", "jats", "pandoc"]

function trackedChangesFromOptions(
    options: ConvertOptions
): "resolve" | "include" {
    const value = options.trackedChanges || "resolve"
    if (value !== "resolve" && value !== "include") {
        console.error(
            `Invalid --tracked-changes value "${value}". Use "resolve" or "include".`
        )
        process.exit(1)
    }
    return value
}

/** Return a copy of the document with all tracked changes accepted. */
function resolveDocTrackedChanges(doc: ExportDoc): ExportDoc {
    const pmDoc = PMNode.fromJSON(docSchema as never, doc.content as never)
    const resolved = acceptAllNoInsertions(pmDoc)
    return {...doc, content: resolved.toJSON() as never}
}

/** Converter options for HTML/EPUB export: SVG math when requested, and
    `trackChanges: true` so kept tracked changes are actually rendered. */
function htmlConverterOptions(
    options: ConvertOptions,
    trackedChanges: "resolve" | "include"
): Record<string, unknown> {
    const converterOptions: Record<string, unknown> = {}
    if (mathOutputFromOptions(options) === "svg") {
        converterOptions.mathOutput = "svg"
    }
    if (trackedChanges === "include") {
        converterOptions.trackChanges = true
    }
    return converterOptions
}

async function doConvert(
    inputPath: string,
    outputPath: string,
    options: ConvertOptions
): Promise<void> {
    ensureInit()

    const inputIsStdin = inputPath === "-"
    const outputIsStdout = outputPath === "-"

    const fromFormat =
        (options.from as Format | undefined) ??
        (inputIsStdin ? undefined : detectFormat(resolve(inputPath)))
    const toFormat =
        (options.to as Format | undefined) ??
        (outputIsStdout ? undefined : detectFormat(resolve(outputPath)))

    if (!fromFormat || !FORMATS.includes(fromFormat)) {
        console.error(
            `Could not determine input format. Use --from to specify: ${FORMATS.join(", ")}`
        )
        process.exit(1)
    }
    if (!toFormat || !FORMATS.includes(toFormat)) {
        console.error(
            `Could not determine output format. Use --to to specify: ${FORMATS.join(", ")}`
        )
        process.exit(1)
    }

    const status = inputIsStdin
        ? outputIsStdout
            ? `Converting stdin (${fromFormat}) -> stdout (${toFormat})`
            : `Converting stdin (${fromFormat}) -> ${resolve(outputPath)} (${toFormat})`
        : outputIsStdout
          ? `Converting ${resolve(inputPath)} (${fromFormat}) -> stdout (${toFormat})`
          : `Converting ${resolve(inputPath)} (${fromFormat}) -> ${resolve(outputPath)} (${toFormat})`

    if (!outputIsStdout) {
        console.error(status)
    }

    let actualInputPath = inputIsStdin
        ? await stdinToTempFile(fromFormat)
        : resolve(inputPath)
    let actualOutputPath = outputIsStdout
        ? await tempOutputPath(toFormat)
        : resolve(outputPath)

    try {
        if (fromFormat === "fidus") {
            await exportFromFidus(actualInputPath, actualOutputPath, toFormat, options)
        } else {
            const fidusPath = await importToFidus(actualInputPath, fromFormat)
            await exportFromFidus(fidusPath, actualOutputPath, toFormat, options)
        }

        if (outputIsStdout) {
            await writeOutputToStdout(actualOutputPath, toFormat)
        } else {
            console.log(`Output written to ${resolve(outputPath)}`)
        }
    } finally {
        if (inputIsStdin) {
            await rm(actualInputPath, {force: true})
        }
        if (outputIsStdout) {
            await rm(actualOutputPath, {force: true})
        }
    }
}

async function exportFromFidus(
    fidusPath: string,
    outputPath: string,
    toFormat: Format,
    options: ConvertOptions
): Promise<void> {
    const {doc: readDoc, bibDB, imageDB} = await readFidusFile(fidusPath)
    const styleToUse = options.style || readDoc.settings.citationstyle || "apa"
    const {csl, styleName} = await loadCSL(styleToUse)
    // Formats that can represent tracked changes honour `--tracked-changes`;
    // the others always merge them since their output cannot show them.
    const trackedChanges = trackedChangesFromOptions(options)
    const shouldResolveTrackedChanges =
        ALWAYS_RESOLVE_FORMATS.includes(toFormat) ||
        (TRACK_CAPABLE_FORMATS.includes(toFormat) &&
            trackedChanges === "resolve")
    const doc = shouldResolveTrackedChanges
        ? resolveDocTrackedChanges(readDoc)
        : readDoc
    doc.settings.citationstyle = styleName
    const updated = new Date()

    switch (toFormat) {
        case "fidus": {
            const shrinker = new ShrinkFidus(
                doc as unknown as ShrinkableDoc,
                imageDB,
                bibDB
            )
            const {doc: shrunkDoc, shrunkImageDB, shrunkBibDB, httpIncludes} = await shrinker.init()
            const zipper = new ZipFidus(doc.id, shrunkDoc, shrunkImageDB, shrunkBibDB, httpIncludes, true, false, undefined)
            const blob = await zipper.init()
            await writeBlobToFile(blob, outputPath)
            break
        }
        case "docx": {
            const templateBlob = options.docxTemplate
                ? await loadDocxTemplate(options.docxTemplate)
                : await generateDocxTemplate(doc.content as unknown as DocContent)
            const exporter = new CLIDocxExporter(doc, "", bibDB, imageDB, csl, outputPath, templateBlob)
            await exporter.init()
            break
        }
        case "odt": {
            const templateBlob = options.odtTemplate
                ? await loadOdtTemplate(options.odtTemplate)
                : await generateOdtTemplate(doc.content as unknown as DocContent)
            const exporter = new CLIodtExporter(doc, "", bibDB, imageDB, csl, outputPath, templateBlob)
            await exporter.init()
            break
        }
        case "latex": {
            const exporter = new CLILatexExporter(doc, bibDB, imageDB, updated, outputPath)
            await exporter.init()
            break
        }
        case "html": {
            const exporter = new CLIHtmlExporter(
                doc,
                bibDB,
                imageDB,
                csl,
                updated,
                [],
                outputPath,
                htmlConverterOptions(options, trackedChanges)
            )
            await exporter.init()
            break
        }
        case "epub": {
            const exporter = new CLIEpubExporter(
                doc,
                bibDB,
                imageDB,
                csl,
                updated,
                [],
                outputPath,
                htmlConverterOptions(options, trackedChanges)
            )
            await exporter.init()
            break
        }
        case "jats": {
            const exporter = new CLIJatsExporter(doc, bibDB, imageDB, csl, updated, options.jatsType || "article", outputPath)
            await exporter.init()
            break
        }
        case "pandoc": {
            const exporter = new CLIPandocExporter(doc, bibDB, imageDB, csl, updated, outputPath)
            await exporter.init()
            break
        }
    }
}

async function importToFidus(
    inputPath: string,
    fromFormat: Format
): Promise<string> {
    const buffer = await readFile(inputPath)
    const file = new Blob([buffer])
    const user = {id: 1, name: "CLI User", username: "cli"}
    const template = getDefaultTemplate()
    const getTemplate = async () => template

    const tmpDir = join(process.cwd(), ".fiduswriter-cli-tmp")
    const backend = new FilesystemNativeImporterBackend(tmpDir)

    let result: {ok: boolean; statusText: string}

    switch (fromFormat) {
        case "docx": {
            const importer = new DocxImporter(file, user, tmpDir, "default", {
                getTemplate,
                nativeBackend: backend
            })
            const output = await importer.init()
            result = {ok: output.ok, statusText: output.statusText}
            break
        }
        case "odt": {
            const importer = new OdtImporter(file, user, tmpDir, "default", {
                getTemplate,
                nativeBackend: backend
            })
            const output = await importer.init()
            result = {ok: output.ok, statusText: output.statusText}
            break
        }
        case "pandoc": {
            const importBibliography = async () => ({db: {}})
            const importer = new PandocImporter(file, user, tmpDir, "default", {
                getTemplate,
                importBibliography,
                nativeBackend: backend
            })
            const output = await importer.init()
            result = {ok: output.ok, statusText: output.statusText}
            break
        }
        default:
            console.error(`Import from ${fromFormat} is not supported`)
            process.exit(1)
    }

    if (!result.ok) {
        console.error(`Import failed: ${result.statusText}`)
        process.exit(1)
    }

    const fidusPath = backend.lastOutputPath
    if (!fidusPath) {
        console.error("Import succeeded but no .fidus file was produced")
        process.exit(1)
    }

    return fidusPath
}

function detectFormat(filePath: string): Format | undefined {
    const ext = extname(filePath).toLowerCase()
    switch (ext) {
        case ".fidus":
            return "fidus"
        case ".docx":
            return "docx"
        case ".odt":
            return "odt"
        case ".epub":
            return "epub"
        case ".tex":
            return "latex"
        case ".json":
            return "pandoc"
        case ".zip":
            if (filePath.endsWith(".latex.zip")) return "latex"
            if (filePath.endsWith(".html.zip")) return "html"
            if (filePath.endsWith(".jats.zip")) return "jats"
            if (filePath.endsWith(".pandoc.json.zip")) return "pandoc"
            return undefined
        default:
            return undefined
    }
}

function extForFormat(format: Format): string {
    switch (format) {
        case "fidus":
            return ".fidus"
        case "docx":
            return ".docx"
        case "odt":
            return ".odt"
        case "latex":
            return ".latex.zip"
        case "html":
            return ".html.zip"
        case "epub":
            return ".epub"
        case "jats":
            return ".jats.zip"
        case "pandoc":
            return ".pandoc.json.zip"
    }
}

let tmpDirCache: string | undefined

async function getTmpDir(): Promise<string> {
    if (!tmpDirCache) {
        tmpDirCache = await mkdtemp(join(tmpdir(), "fidusconvert-"))
    }
    return tmpDirCache
}

async function stdinToTempFile(format: Format): Promise<string> {
    const tmpDir = await getTmpDir()
    const path = join(tmpDir, `stdin${extForFormat(format)}`)
    const chunks: Buffer[] = []
    for await (const chunk of process.stdin) {
        chunks.push(Buffer.from(chunk))
    }
    await writeFile(path, Buffer.concat(chunks))
    return path
}

async function tempOutputPath(format: Format): Promise<string> {
    const tmpDir = await getTmpDir()
    return join(tmpDir, `stdout${extForFormat(format)}`)
}

async function writeOutputToStdout(
    outputPath: string,
    toFormat: Format
): Promise<void> {
    if (toFormat === "pandoc") {
        const buf = await readFile(outputPath)
        const zip = await JSZip.loadAsync(buf)
        const jsonFile = zip.file("document.json")
        if (!jsonFile) {
            throw new Error("Pandoc output is missing document.json")
        }
        const json = await jsonFile.async("string")
        process.stdout.write(json)
    } else {
        const buf = await readFile(outputPath)
        process.stdout.write(buf)
    }
}
