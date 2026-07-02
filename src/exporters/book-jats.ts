import { BITSBookExporter } from "@fiduswriter/books-document/exporter/bits"
import type { Book, DocumentListEntry } from "@fiduswriter/books-document"
import type { CSL, User } from "@fiduswriter/document"
import type { Schema } from "prosemirror-model"

import { writeBlobToFile } from "../utils/file.js"

/**
 * Book-level JATS export.
 *
 * `@fiduswriter/books-document` has no standalone "jats" book exporter; the
 * book-level equivalent of the single-document JATS exporter is BITS (Book
 * Interchange Tag Suite, a JATS extension for books).  The CLI therefore maps
 * the `jats` book output format to the BITS exporter, producing a
 * `manuscript.xml` / `manifest.xml` pair inside a zip.
 */
export class CLIBookJatsExporter extends BITSBookExporter {
    outputPath: string

    constructor(
        schema: Schema,
        csl: CSL,
        book: Book,
        user: User,
        docList: DocumentListEntry[],
        updated: any,
        outputPath: string
    ) {
        super(schema, csl, book, user, docList, updated)
        this.outputPath = outputPath
    }

    download(blob: Blob): Blob {
        return writeBlobToFile(blob, this.outputPath) as unknown as Blob
    }
}
