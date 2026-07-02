import { LatexBookExporter } from "@fiduswriter/books-document/exporter/latex"
import type { Book, DocumentListEntry } from "@fiduswriter/books-document"
import type { User } from "@fiduswriter/document"
import type { Schema } from "prosemirror-model"

import { writeBlobToFile } from "../utils/file.js"

export class CLIBookLatexExporter extends LatexBookExporter {
    outputPath: string

    constructor(
        schema: Schema,
        book: Book,
        user: User,
        docList: DocumentListEntry[],
        updated: any,
        outputPath: string
    ) {
        super(schema, book, user, docList, updated)
        this.outputPath = outputPath
    }

    download(blob: Blob): Blob {
        return writeBlobToFile(blob, this.outputPath) as unknown as Blob
    }
}
