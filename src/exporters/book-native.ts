import { NativeBookExporter } from "@fiduswriter/books-document/exporter/native"
import type { Book, DocumentListEntry } from "@fiduswriter/books-document"
import type { User } from "@fiduswriter/document"
import type { Schema } from "prosemirror-model"

import { writeBlobToFile } from "../utils/file.js"

/**
 * Re-export a book to a `.fidusbook` archive.
 */
export class CLIBookNativeExporter extends NativeBookExporter {
    outputPath: string

    constructor(
        schema: Schema,
        book: Book,
        user: User,
        documentList: DocumentListEntry[],
        updated: Date,
        outputPath: string
    ) {
        super(schema, book, user, documentList, Math.floor(updated.getTime() / 1000))
        this.outputPath = outputPath
    }

    download(blob: Blob): Blob {
        return writeBlobToFile(blob, this.outputPath) as unknown as Blob
    }
}
