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
        outputPath: string,
        converterOptions: Record<string, unknown> = {}
    ) {
        super(doc, bibDB, imageDB, csl, updated, documentStyles, converterOptions)
        this.outputPath = outputPath
        // Keep the default stylesheet ({url: staticUrl("css/document/document.css")}):
        // init.ts's staticUrl resolves it to a file: URL in the installed
        // @fiduswriter/document package, so it can be fetched and shipped.
    }

    download(blob: Blob): Promise<void> {
        return writeBlobToFile(blob, this.outputPath)
    }
}
