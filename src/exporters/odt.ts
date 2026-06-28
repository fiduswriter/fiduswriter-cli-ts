import {ODTExporter} from "@fiduswriter/document/exporter/odt"
import type {BibDB, CSL, ExportDoc, ImageDB} from "@fiduswriter/document"
import {writeBlobToFile} from "../utils/file.js"

export class CLIodtExporter extends ODTExporter {
    outputPath: string

    constructor(
        doc: ExportDoc,
        templateUrl: string,
        bibDB: BibDB,
        imageDB: ImageDB,
        csl: CSL,
        outputPath: string,
        templateBlob?: Blob
    ) {
        super(doc, templateUrl, bibDB, imageDB, csl, templateBlob)
        this.outputPath = outputPath
    }

    download(blob: Blob): Promise<void> {
        return writeBlobToFile(blob, this.outputPath)
    }
}
