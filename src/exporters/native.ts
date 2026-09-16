import {ExportFidusFile} from "@fiduswriter/document/exporter/native"
import type {BibDB, ExportDoc, ImageDB} from "@fiduswriter/document"
import {writeBlobToFile} from "../utils/file.js"

export class CLIFidusExporter extends ExportFidusFile {
    outputPath: string

    constructor(
        doc: ExportDoc,
        bibDB: BibDB,
        imageDB: ImageDB,
        includeTemplate: boolean,
        outputPath: string
    ) {
        super(doc, bibDB, imageDB, includeTemplate, false, undefined)
        this.outputPath = outputPath
    }

    async download(blob: Blob): Promise<boolean> {
        await writeBlobToFile(blob, this.outputPath)
        return true
    }
}
