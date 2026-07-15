import {EpubExporter} from "@fiduswriter/document/exporter/epub"
import type {BibDB, CSL, ExportDoc, ImageDB} from "@fiduswriter/document"
import {writeBlobToFile} from "../utils/file.js"

type DocumentStyle = {
    slug: string
    contents: string
    documentstylefile_set: Array<[string, string]>
}

export class CLIEpubExporter extends EpubExporter {
    outputPath: string

    constructor(
        doc: ExportDoc,
        bibDB: BibDB,
        imageDB: ImageDB,
        csl: CSL,
        updated: Date,
        documentStyles: DocumentStyle[],
        outputPath: string
    ) {
        super(doc, bibDB, imageDB, csl, updated, documentStyles)
        this.outputPath = outputPath
        this.styleSheets = []
    }

    download(blob: Blob): Promise<void> {
        return writeBlobToFile(blob, this.outputPath)
    }
}
