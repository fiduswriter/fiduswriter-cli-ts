import { EpubBookExporter } from "@fiduswriter/books-document/exporter/epub"
import type {
    Book,
    BookStyles,
    DocumentListEntry
} from "@fiduswriter/books-document"
import type { CSL, User } from "@fiduswriter/document"
import type { Schema } from "prosemirror-model"

import { writeBlobToFile } from "../utils/file.js"
import { runWithStubbedAssets } from "./book-template.js"

export class CLIBookEpubExporter extends EpubBookExporter {
    outputPath: string

    constructor(
        schema: Schema,
        csl: CSL,
        bookStyles: BookStyles,
        book: Book,
        user: User,
        docList: DocumentListEntry[],
        updated: number,
        outputPath: string
    ) {
        super(schema, csl, bookStyles, book, user, docList, updated)
        this.outputPath = outputPath
        // No web server hosts the book stylesheet in the CLI.
        this.styleSheets = []
    }

    init(): Promise<Blob | false> {
        return runWithStubbedAssets(() =>
            Promise.resolve(super.init())
        ) as Promise<Blob | false>
    }

    download(blob: Blob): Blob {
        return writeBlobToFile(blob, this.outputPath) as unknown as Blob
    }
}
