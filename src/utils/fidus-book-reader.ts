/**
 * Pure reader for `.fidusbook` archives, mirroring the patterns used by
 * `fidus-reader.ts` for single documents.
 *
 * Opens the ZIP, validates the mimetype/version, reads `book.json`, and for
 * each chapter reconstructs a full document (`content` / `rawContent`), its
 * bibliography and its image database (with decoded image blobs).  Returns
 * `{book, documentList}` in the shape the book exporters expect.
 *
 * The archive's `book.json` chapters only carry `number`, `part` and
 * `chapter_index` — the link to a document id is *not* stored.  This reader
 * therefore assigns each chapter a synthetic document id and sets
 * `chapter.text` accordingly so the exporters can pair chapters with docs.
 */

import { readFile } from "node:fs/promises"
import JSZip from "jszip"

import type {
    Book,
    Chapter,
    DocumentListEntry
} from "@fiduswriter/books-document"
import type {
    FidusDoc,
    ImageDBEntry,
    ImageDBEntries
} from "@fiduswriter/document"
import { updateFile } from "@fiduswriter/document/importer/native/update"
import { FW_DOCUMENT_VERSION } from "@fiduswriter/document/schema"

import { fillDefaultAttrs } from "./fidus-reader.js"

export interface FidusBookReadResult {
    book: Book
    documentList: DocumentListEntry[]
}

export const FIDUSBOOK_MIMETYPE = "application/fidusbook+zip"
export const FIDUSBOOK_VERSION = "1.0"
const MIN_FIDUSBOOK_VERSION = 1.0
const MAX_FIDUSBOOK_VERSION = 1.0

const CURRENT_DOCUMENT_VERSION = Number.parseFloat(FW_DOCUMENT_VERSION)

interface ArchivedChapter {
    number: number
    part?: string
    chapter_index: number
}

interface ShrunkChapterDoc {
    title?: string
    path?: string
    settings?: Record<string, unknown>
    comments?: Record<string, unknown>
    content: Record<string, unknown>
    rawContent?: Record<string, unknown>
    e2ee?: boolean
    e2ee_salt?: string
    e2ee_iterations?: number
}

const DEFAULT_SETTINGS = {
    citationstyle: "apa",
    documentstyle: "default",
    language: "en-US",
    papersize: "A4",
    metadata: {}
}

export async function readFidusBookFile(
    filePath: string
): Promise<FidusBookReadResult> {
    const buffer = await readFile(filePath)
    const zip = await JSZip.loadAsync(buffer)

    const mimeTypeText = (await zip.file("mimetype")?.async("string"))?.trim()
    const filetypeVersionText = (
        await zip.file("filetype-version")?.async("string")
    )?.trim()
    const bookText = await zip.file("book.json")?.async("string")

    if (!filetypeVersionText || !bookText) {
        throw new Error(
            "Not a valid Fidusbook file: missing filetype-version or book.json"
        )
    }

    // The mimetype file is present in archives produced by the native exporter;
    // if present it must match, but we do not hard-require it.
    if (mimeTypeText && mimeTypeText !== FIDUSBOOK_MIMETYPE) {
        throw new Error(
            `Not a Fidusbook file. Expected mimetype "${FIDUSBOOK_MIMETYPE}", got "${mimeTypeText}"`
        )
    }

    const filetypeVersion = Number.parseFloat(filetypeVersionText)
    if (
        Number.isNaN(filetypeVersion) ||
        filetypeVersion < MIN_FIDUSBOOK_VERSION ||
        filetypeVersion > MAX_FIDUSBOOK_VERSION
    ) {
        throw new Error(
            `Unsupported Fidusbook version "${filetypeVersionText}". Expected ${FIDUSBOOK_VERSION}.`
        )
    }

    const book = JSON.parse(bookText) as Book
    if (!book.settings) {
        book.settings = { language: "en-US" }
    }
    if (!book.settings.language) {
        book.settings.language = "en-US"
    }
    if (!book.metadata) {
        book.metadata = {}
    }

    const archivedChapters = [
        ...((book.chapters as unknown as ArchivedChapter[]) || [])
    ].sort((a, b) => a.chapter_index - b.chapter_index)

    const documentList: DocumentListEntry[] = []
    const chapters: Chapter[] = []

    for (const archivedChapter of archivedChapters) {
        const ci = archivedChapter.chapter_index

        const docText = await zip
            .file(`chapters/${ci}/document.json`)
            ?.async("string")
        const imagesText = await zip
            .file(`chapters/${ci}/images.json`)
            ?.async("string")
        const bibText = await zip
            .file(`chapters/${ci}/bibliography.json`)
            ?.async("string")

        if (!docText || !imagesText || !bibText) {
            throw new Error(`Missing chapter data for chapter index ${ci}`)
        }

        const docJson = JSON.parse(docText) as ShrunkChapterDoc
        const imagesJson = JSON.parse(imagesText) as Record<
            string,
            ImageDBEntry & { file_type?: string }
        >
        const bibJson = JSON.parse(bibText) as Record<string, unknown>

        // Reconstruct a full document from the shrunk (mini-JSON) content, the
        // same way fidus-reader.ts does for single documents.
        const updated = updateFile(
            docJson.content as unknown as FidusDoc,
            CURRENT_DOCUMENT_VERSION,
            bibJson,
            imagesJson as ImageDBEntries
        )
        const content = fillDefaultAttrs(
            updated.doc
        ) as DocumentListEntry["content"]

        const images = await buildChapterImageDB(zip, ci, imagesJson)

        const settingsSource =
            docJson.settings ||
            ((content as unknown as { attrs?: Record<string, unknown> })
                .attrs ??
                {})

        let title = docJson.title || ""
        if (!title) {
            const firstChild = (
                content as unknown as { content?: Array<Record<string, any>> }
            ).content?.[0]
            if (firstChild?.content?.[0]?.text) {
                title = firstChild.content[0].text
            }
        }

        const id = ci + 1
        documentList.push({
            id,
            title: title || "Untitled",
            path: docJson.path || "",
            content,
            rawContent: JSON.parse(JSON.stringify(content)),
            settings: {
                ...DEFAULT_SETTINGS,
                ...settingsSource
            } as DocumentListEntry["settings"],
            comments: (docJson.comments || {}) as DocumentListEntry["comments"],
            images,
            bibliography: bibJson as DocumentListEntry["bibliography"],
            e2ee: docJson.e2ee,
            e2ee_salt: docJson.e2ee_salt,
            e2ee_iterations: docJson.e2ee_iterations
        } as DocumentListEntry)

        chapters.push({
            text: id,
            number: archivedChapter.number,
            part: archivedChapter.part || "",
            chapter_index: ci
        })
    }

    book.chapters = chapters

    return { book, documentList }
}

/**
 * Build a chapter image database, decoding each referenced binary from the
 * archive into a Blob stored on `entry.image`.
 */
async function buildChapterImageDB(
    zip: JSZip,
    chapterIndex: number,
    imagesJson: Record<string, ImageDBEntry & { file_type?: string }>
): Promise<DocumentListEntry["images"]> {
    const db: Record<string, ImageDBEntry & { file_type?: string }> = {}

    for (const [imageId, entry] of Object.entries(imagesJson)) {
        const relativePath = entry.image as string | undefined
        if (!relativePath) {
            db[imageId] = entry
            continue
        }

        // In the archive the binary lives under `chapters/<n>/<entry.image>`,
        // e.g. `chapters/0/images/foo.png` for `entry.image === "images/foo.png"`.
        const zipEntry = zip.file(`chapters/${chapterIndex}/${relativePath}`)
        if (zipEntry) {
            const blob = await zipEntry.async("blob")
            const file_type =
                entry.file_type || relativePath.split(".").pop() || "bin"
            db[imageId] = {
                ...entry,
                image: blob as unknown as string,
                file_type
            }
        } else {
            db[imageId] = entry
        }
    }

    return db as DocumentListEntry["images"]
}
