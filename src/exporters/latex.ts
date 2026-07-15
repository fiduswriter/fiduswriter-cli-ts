import {LatexExporter} from "@fiduswriter/document/exporter/latex"
import type {BibDB, ExportDoc, ImageDB} from "@fiduswriter/document"
import {writeBlobToFile} from "../utils/file.js"

export class CLILatexExporter extends LatexExporter {
    outputPath: string

    constructor(
        doc: ExportDoc,
        bibDB: BibDB,
        imageDB: ImageDB,
        updated: Date,
        outputPath: string
    ) {
        super(doc, bibDB, imageDB, updated)
        this.outputPath = outputPath
    }

    download(blob: Blob): Promise<void> {
        return writeBlobToFile(blob, this.outputPath)
    }
}
