import {TEIExporter} from "@fiduswriter/document/exporter/tei"
import type {BibDB, CSL, ExportDoc, ImageDB} from "@fiduswriter/document"
import {writeBlobToFile} from "../utils/file.js"

export class CLITEIExporter extends TEIExporter {
    outputPath: string

    constructor(
        doc: ExportDoc,
        bibDB: BibDB,
        imageDB: ImageDB,
        csl: CSL,
        updated: Date,
        outputPath: string
    ) {
        super(doc, bibDB, imageDB, csl, updated)
        this.outputPath = outputPath
    }

    download(blob: Blob): Promise<void> {
        return writeBlobToFile(blob, this.outputPath)
    }
}
