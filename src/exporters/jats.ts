import {JATSExporter} from "@fiduswriter/document/exporter/jats"
import type {BibDB, CSL, ExportDoc, ImageDB} from "@fiduswriter/document"
import {writeBlobToFile} from "../utils/file.js"

export class CLIJatsExporter extends JATSExporter {
    outputPath: string

    constructor(
        doc: ExportDoc,
        bibDB: BibDB,
        imageDB: ImageDB,
        csl: CSL,
        updated: any,
        jatsType: string,
        outputPath: string
    ) {
        super(doc, bibDB, imageDB, csl, updated, jatsType)
        this.outputPath = outputPath
    }

    download(blob: Blob): Promise<void> {
        return writeBlobToFile(blob, this.outputPath)
    }
}
