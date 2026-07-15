import type { Command } from "commander"
import { extname, resolve } from "node:path"

import { ensureInit } from "../init.js"
import { readFidusBookFile } from "../utils/fidus-book-reader.js"
import { loadCSL } from "../utils/csl.js"
import { loadDocxTemplate, loadOdtTemplate } from "../utils/templates.js"

import { CLIBookDocxExporter } from "../exporters/book-docx.js"
import { CLIBookOdtExporter } from "../exporters/book-odt.js"
import { CLIBookLatexExporter } from "../exporters/book-latex.js"
import { CLIBookHtmlExporter } from "../exporters/book-html.js"
import { CLIBookEpubExporter } from "../exporters/book-epub.js"
import { CLIBookJatsExporter } from "../exporters/book-jats.js"
import { CLIBookNativeExporter } from "../exporters/book-native.js"

const INPUT_FORMATS = ["fidusbook"] as const
const OUTPUT_FORMATS = [
    "fidusbook",
    "docx",
    "odt",
    "latex",
    "html",
    "epub",
    "jats"
] as const

type InputFormat = (typeof INPUT_FORMATS)[number]
type OutputFormat = (typeof OUTPUT_FORMATS)[number]

interface ConvertBookOptions {
    from?: string
    to?: string
    style?: string
    docxTemplate?: string
    odtTemplate?: string
    jatsType?: string
}

const CLI_USER = { id: 1, name: "CLI User", username: "cli" }

export function registerConvertBookCommand(program: Command): void {
    const bookCmd = program.command("book")
    bookCmd.description(
        "Convert a Fidus Writer book (.fidusbook) between formats"
    )
    bookCmd
        .argument("<input>", "Path to the input .fidusbook file")
        .argument("<output>", "Path to the output file")
        .option(
            "--from <format>",
            `Input format (${INPUT_FORMATS.join(", ")}; auto-detected from extension if omitted)`
        )
        .option(
            "--to <format>",
            `Output format (${OUTPUT_FORMATS.join(", ")}; auto-detected from extension if omitted)`
        )
        .option(
            "-s, --style <style>",
            "Citation style ID from the citeproc-plus catalog (e.g. apa, chicago-author-date, ieee)"
        )
        .option("--docx-template <path>", "Custom DOCX template file")
        .option("--odt-template <path>", "Custom ODT template file")
        .option(
            "--jats-type <type>",
            "JATS type (accepted for parity with the document command; book JATS always uses BITS)",
            "book"
        )
    bookCmd.action(async (input, output, options) => {
        await doConvertBook(input, output, options)
    })
}

async function doConvertBook(
    inputPath: string,
    outputPath: string,
    options: ConvertBookOptions
): Promise<void> {
    ensureInit()

    const fromFormat =
        (options.from as InputFormat | undefined) ??
        detectInputFormat(resolve(inputPath))
    const toFormat =
        (options.to as OutputFormat | undefined) ??
        detectOutputFormat(resolve(outputPath))

    if (!fromFormat || !INPUT_FORMATS.includes(fromFormat)) {
        console.error(
            `Could not determine input format. Use --from to specify: ${INPUT_FORMATS.join(", ")}`
        )
        process.exit(1)
    }
    if (!toFormat || !OUTPUT_FORMATS.includes(toFormat)) {
        console.error(
            `Could not determine output format. Use --to to specify: ${OUTPUT_FORMATS.join(", ")}`
        )
        process.exit(1)
    }

    const absoluteInput = resolve(inputPath)
    const absoluteOutput = resolve(outputPath)

    console.error(
        `Converting ${absoluteInput} (${fromFormat}) -> ${absoluteOutput} (${toFormat})`
    )

    console.error("DEBUG about to exportBook")
    await exportBook(absoluteInput, absoluteOutput, toFormat, options)
    console.error("DEBUG exportBook done")

    console.log(`Output written to ${absoluteOutput}`)
}

async function exportBook(
    inputPath: string,
    outputPath: string,
    toFormat: OutputFormat,
    options: ConvertBookOptions
): Promise<void> {
    const { book, documentList } = await readFidusBookFile(inputPath)

    if (documentList.length === 0) {
        console.error("The book has no chapters to export.")
        process.exit(1)
    }

    const { docSchema } =
        await import("@fiduswriter/document/schema/document/index")

    const originalStyle = options.style
    console.error("DEBUG options.style", options.style)
    const styleToUse =
        options.style || documentList[0].settings.citationstyle || "apa"
    console.error("DEBUG loadCSL", styleToUse)
    const { csl, styleName } = await loadCSL(styleToUse)
    console.error("DEBUG loadCSL done", styleName)
    if (originalStyle && styleName !== originalStyle) {
        console.error(
            `Unknown citation style "${originalStyle}". Falling back to the default style "${styleName}".`
        )
    }
    // Book exporters format citations per chapter using each chapter's own
    // settings; align them all with the resolved style.
    documentList.forEach(doc => {
        doc.settings.citationstyle = styleName
    })

    const now = new Date()
    const nowSeconds = Math.floor(now.getTime() / 1000)

    switch (toFormat) {
        case "fidusbook": {
            const exporter = new CLIBookNativeExporter(
                docSchema,
                book,
                CLI_USER,
                documentList,
                now,
                outputPath
            )
            await exporter.init()
            break
        }
        case "docx": {
            const templateBlob = await loadDocxTemplate(options.docxTemplate)
            const exporter = new CLIBookDocxExporter(
                docSchema,
                csl,
                book,
                CLI_USER,
                documentList,
                now,
                outputPath,
                templateBlob
            )
            await exporter.init()
            break
        }
        case "odt": {
            const templateBlob = await loadOdtTemplate(options.odtTemplate)
            const exporter = new CLIBookOdtExporter(
                docSchema,
                csl,
                book,
                CLI_USER,
                documentList,
                now,
                outputPath,
                templateBlob
            )
            await exporter.init()
            break
        }
        case "latex": {
            const exporter = new CLIBookLatexExporter(
                docSchema,
                book,
                CLI_USER,
                documentList,
                now,
                outputPath
            )
            await exporter.init()
            break
        }
        case "html": {
            const exporter = new CLIBookHtmlExporter(
                docSchema,
                csl,
                [],
                book,
                CLI_USER,
                documentList,
                nowSeconds,
                outputPath
            )
            await exporter.init()
            break
        }
        case "epub": {
            const exporter = new CLIBookEpubExporter(
                docSchema,
                csl,
                [],
                book,
                CLI_USER,
                documentList,
                nowSeconds,
                outputPath
            )
            await exporter.init()
            break
        }
        case "jats": {
            const exporter = new CLIBookJatsExporter(
                docSchema,
                csl,
                book,
                CLI_USER,
                documentList,
                now,
                outputPath
            )
            await exporter.init()
            break
        }
    }
}

function detectInputFormat(filePath: string): InputFormat | undefined {
    if (extname(filePath).toLowerCase() === ".fidusbook") {
        return "fidusbook"
    }
    return undefined
}

function detectOutputFormat(filePath: string): OutputFormat | undefined {
    const lower = filePath.toLowerCase()
    const ext = extname(lower)
    switch (ext) {
        case ".fidusbook":
            return "fidusbook"
        case ".docx":
            return "docx"
        case ".odt":
            return "odt"
        case ".epub":
            return "epub"
        case ".zip":
            if (lower.endsWith(".latex.zip")) return "latex"
            if (lower.endsWith(".html.zip")) return "html"
            if (lower.endsWith(".jats.zip")) return "jats"
            if (lower.endsWith(".bits.zip")) return "jats"
            return undefined
        default:
            return undefined
    }
}
