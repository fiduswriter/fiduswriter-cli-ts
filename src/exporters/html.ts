import {HTMLExporter} from "@fiduswriter/document/exporter/html"
import type {BibDB, CSL, ExportDoc, ImageDB} from "@fiduswriter/document"
import {writeBlobToFile} from "../utils/file.js"

type DocumentStyle = {
    slug: string
    contents: string
    documentstylefile_set: Array<[string, string]>
}

export class CLIHtmlExporter extends HTMLExporter {
    outputPath: string

    constructor(
        doc: ExportDoc,
        bibDB: BibDB,
        imageDB: ImageDB,
        csl: CSL,
        updated: Date,
        documentStyles: DocumentStyle[],
        outputPath: string,
        converterOptions: Record<string, unknown> = {}
    ) {
        super(doc, bibDB, imageDB, csl, updated, documentStyles, converterOptions)
        this.outputPath = outputPath
        this.styleSheets = []
    }

    download(blob: Blob): Promise<void> {
        return writeBlobToFile(blob, this.outputPath)
    }
}
