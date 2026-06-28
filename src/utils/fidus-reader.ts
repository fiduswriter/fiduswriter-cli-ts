import {readFile} from "node:fs/promises"
import JSZip from "jszip"

import type {BibDB, BibDBEntries, ExportDoc, FidusDoc, ImageDB, ImageDBEntries, ImageDBEntry} from "@fiduswriter/document"

import {updateFile} from "@fiduswriter/document/importer/native/update"
import {FW_DOCUMENT_VERSION} from "@fiduswriter/document/schema"

export interface FidusReadResult {
    doc: ExportDoc
    bibDB: BibDB
    imageDB: ImageDB
}

const MIN_FW_DOCUMENT_VERSION = 1.6
const MAX_FW_DOCUMENT_VERSION = Number.parseFloat(FW_DOCUMENT_VERSION)

export async function readFidusFile(filePath: string): Promise<FidusReadResult> {
    const buffer = await readFile(filePath)
    const zip = await JSZip.loadAsync(buffer)

    const filetypeVersionText = await zip.file("filetype-version")?.async("string")
    const mimeTypeText = await zip.file("mimetype")?.async("string")

    if (!filetypeVersionText || !mimeTypeText) {
        throw new Error("Not a valid Fidus Writer file: missing filetype-version or mimetype")
    }

    const filetypeVersion = Number.parseFloat(filetypeVersionText)
    if (
        mimeTypeText.trim() !== "application/fidus+zip" ||
        filetypeVersion < MIN_FW_DOCUMENT_VERSION ||
        filetypeVersion > MAX_FW_DOCUMENT_VERSION
    ) {
        throw new Error(
            `Not a supported Fidus Writer file. Expected mimetype application/fidus+zip with version ${MIN_FW_DOCUMENT_VERSION}-${MAX_FW_DOCUMENT_VERSION}, got mimetype "${mimeTypeText.trim()}" with version ${filetypeVersion}`
        )
    }

    const documentText = await zip.file("document.json")?.async("string")
    const bibliographyText = await zip.file("bibliography.json")?.async("string")
    const imagesText = await zip.file("images.json")?.async("string")

    if (!documentText || !bibliographyText || !imagesText) {
        throw new Error("Not a valid Fidus Writer file: missing document.json, bibliography.json, or images.json")
    }

    const docJson = JSON.parse(documentText)
    const bibJson: BibDBEntries = JSON.parse(bibliographyText)
    const imagesJson: ImageDBEntries = JSON.parse(imagesText) as ImageDBEntries

    let docNode: unknown
    let docSettings: Record<string, unknown> = {}
    let docTitle = ""

    if (docJson.type === "doc") {
        docNode = docJson
        docSettings = docJson.attrs || {}
    } else if (docJson.title !== undefined || docJson.settings !== undefined) {
        docNode = docJson.content
        docSettings = docJson.settings || {}
        docTitle = docJson.title || ""
    } else {
        docNode = docJson
    }

    const updated = updateFile(docNode as FidusDoc, filetypeVersion, bibJson as Record<string, unknown>, imagesJson)

    const imageDB = await buildImageDB(zip, updated.images)

    if (!docTitle && updated.doc?.content?.[0]) {
        const firstChild = updated.doc.content[0]
        if (firstChild.content?.[0]?.text) {
            docTitle = firstChild.content[0].text
        }
    }

    const defaultSettings = {
        citationstyle: "apa",
        documentstyle: "default",
        language: "en-US",
        papersize: "A4",
        metadata: {}
    }

    const exportDoc: ExportDoc = {
        id: filePath,
        title: docTitle || "Untitled",
        content: fillDefaultAttrs(updated.doc) as ExportDoc["content"],
        settings: {...defaultSettings, ...docSettings} as ExportDoc["settings"],
        version: FW_DOCUMENT_VERSION
    }

    return {
        doc: exportDoc,
        bibDB: {db: updated.bibliography as BibDBEntries},
        imageDB
    }
}

async function buildImageDB(zip: JSZip, imagesMeta: ImageDBEntries): Promise<ImageDB> {
    const db: Record<string, ImageDBEntry & {file_type?: string}> = {}

    for (const [id, entry] of Object.entries(imagesMeta) as [string, ImageDBEntry & {file_type?: string}][]) {
        const filename = entry.image as string | undefined
        if (!filename) {
            db[id] = entry
            continue
        }

        const zipEntry = zip.file(filename)
        if (zipEntry) {
            const blob = await zipEntry.async("blob")
            const file_type = entry.file_type || filename.split(".").pop() || "bin"
            db[id] = {
                ...entry,
                image: blob,
                file_type
            }
        } else {
            db[id] = entry
        }
    }

    return {db}
}

const NODE_DEFAULT_ATTRS: Record<string, Record<string, unknown>> = {
    title: {id: "title"},
    heading1: {id: false, track: []},
    heading2: {id: false, track: []},
    heading3: {id: false, track: []},
    heading4: {id: false, track: []},
    heading5: {id: false, track: []},
    heading6: {id: false, track: []},
    paragraph: {track: []},
    blockquote: {track: []},
    horizontal_rule: {track: []},
    code_block: {track: [], language: "", category: "", title: "", id: ""},
    figure: {category: "none", caption: false, id: false, track: [], aligned: "center", width: "100"},
    image: {image: false},
    figure_equation: {equation: false},
    citation: {format: "autocite", references: []},
    equation: {equation: ""},
    cross_reference: {id: false, title: null},
    footnote: {footnote: [{type: "paragraph"}]},
    ordered_list: {id: false, order: 1, track: []},
    bullet_list: {id: false, track: []},
    list_item: {track: []},
    table: {id: false, track: [], width: "100", aligned: "center", layout: "fixed", category: "none", caption: false},
    table_cell: {colspan: 1, rowspan: 1, colwidth: null},
    table_header: {colspan: 1, rowspan: 1, colwidth: null},
    contributor: {firstname: false, lastname: false, email: false, institution: false, id_type: false, id_value: false},
    tag: {tag: ""},
    richtext_part: {title: "", id: "", locking: false, language: false, optional: false, hidden: false, help: false, initial: false, deleted: false},
    heading_part: {title: "", id: "", locking: false, language: false, optional: false, hidden: false, help: false, initial: false, deleted: false},
    contributors_part: {title: "", id: "", locking: false, language: false, optional: false, hidden: false, help: false, initial: false, deleted: false},
    tags_part: {title: "", id: "", locking: false, language: false, optional: false, hidden: false, help: false, initial: false, deleted: false},
    table_part: {title: "", id: "", locking: false, language: false, optional: false, hidden: false, help: false, initial: false, deleted: false},
    table_of_contents: {title: "Table of Contents", id: "toc", optional: false, hidden: false},
    separator_part: {id: "separator"}
}

function fillDefaultAttrs(node: unknown): unknown {
    if (!node || typeof node !== "object" || Array.isArray(node)) return node
    const n = node as Record<string, unknown>
    if (typeof n.type !== "string") return node

    const defaults = NODE_DEFAULT_ATTRS[n.type]
    if (defaults) {
        const existingAttrs = (n.attrs || {}) as Record<string, unknown>
        const merged: Record<string, unknown> = {}
        for (const [key, val] of Object.entries(defaults)) {
            merged[key] = key in existingAttrs ? existingAttrs[key] : val
        }
        for (const [key, val] of Object.entries(existingAttrs)) {
            if (!(key in merged)) merged[key] = val
        }
        n.attrs = merged
    }

    if (Array.isArray(n.content)) {
        n.content = (n.content as unknown[]).map(fillDefaultAttrs)
    }
    if (n.footnote && Array.isArray(n.footnote)) {
        n.footnote = (n.footnote as unknown[]).map(fillDefaultAttrs)
    }

    return node
}
