import { LatexBookExporter } from "@fiduswriter/books/exporter/latex"
import type { Book, DocumentListEntry } from "@fiduswriter/books"
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
        updated: Date,
        outputPath: string
    ) {
        super(schema, book, user, docList, Math.floor(updated.getTime() / 1000))
        this.outputPath = outputPath
    }

    download(blob: Blob): Blob {
        return writeBlobToFile(blob, this.outputPath) as unknown as Blob
    }
}
