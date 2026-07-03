import {HTMLExporter} from "@fiduswriter/document/exporter/html"
import type {BibDB, CSL, ExportDoc, ImageDB} from "@fiduswriter/document"
import {writeBlobToFile} from "../utils/file.js"

export class CLIHtmlExporter extends HTMLExporter {
    outputPath: string

    constructor(
        doc: ExportDoc,
        bibDB: BibDB,
        imageDB: ImageDB,
        csl: CSL,
        updated: any,
        documentStyles: any[],
        outputPath: string
    ) {
        super(doc, bibDB, imageDB, csl, updated, documentStyles)
        this.outputPath = outputPath
        this.styleSheets = []
    }

    async process(): Promise<void> {
        await super.process()
        // Mathlive static assets are not available in the CLI environment.
        this.includeZips = []
    }

    download(blob: Blob): Promise<void> {
        return writeBlobToFile(blob, this.outputPath)
    }
}
