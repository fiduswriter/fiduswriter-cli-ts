import { HTMLBookExporter } from "@fiduswriter/books-document/exporter/html"
import type {
    Book,
    BookStyles,
    DocumentListEntry
} from "@fiduswriter/books-document"
import type { CSL, User } from "@fiduswriter/document"
import type { Schema } from "prosemirror-model"

import { writeBlobToFile } from "../utils/file.js"
import { runWithStubbedAssets } from "./book-template.js"

export class CLIBookHtmlExporter extends HTMLBookExporter {
    outputPath: string

    constructor(
        schema: Schema,
        csl: CSL,
        bookStyles: BookStyles,
        book: Book,
        user: User,
        docList: DocumentListEntry[],
        updated: number,
        outputPath: string,
        multiDoc = true
    ) {
        super(schema, csl, bookStyles, book, user, docList, updated, multiDoc, {
            relativeUrls: true
        })
        this.outputPath = outputPath
        // Keep the default stylesheets (document.css + book.css): init.ts's
        // staticUrl resolves them to file: URLs in the installed packages, so
        // they can be fetched and shipped.
    }

    init(): Promise<Blob | false | void> {
        return runWithStubbedAssets(() => Promise.resolve(super.init()))
    }

    download(blob: Blob): Blob {
        return writeBlobToFile(blob, this.outputPath) as unknown as Blob
    }
}
