import { DOCXBookExporter } from "@fiduswriter/books-document/exporter/docx"
import type { Book, DocumentListEntry } from "@fiduswriter/books-document"
import type { CSL, User } from "@fiduswriter/document"
import type { Schema } from "prosemirror-model"

import { writeBlobToFile } from "../utils/file.js"
import { runWithTemplateBlob } from "./book-template.js"

const TEMPLATE_SENTINEL = "fidusbook-cli-template://docx"

export class CLIBookDocxExporter extends DOCXBookExporter {
    outputPath: string
    templateBlob: Blob

    constructor(
        schema: Schema,
        csl: CSL,
        book: Book,
        user: User,
        docList: DocumentListEntry[],
        updated: any,
        outputPath: string,
        templateBlob: Blob
    ) {
        super(schema, csl, book, user, docList, updated)
        this.outputPath = outputPath
        this.templateBlob = templateBlob
        this.templateUrl = TEMPLATE_SENTINEL
    }

    init(): Promise<Blob> | false {
        return runWithTemplateBlob(TEMPLATE_SENTINEL, this.templateBlob, () =>
            Promise.resolve(super.init())
        ) as Promise<Blob>
    }

    download(blob: Blob): Blob {
        return writeBlobToFile(blob, this.outputPath) as unknown as Blob
    }
}
