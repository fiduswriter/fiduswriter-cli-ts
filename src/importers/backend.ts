import {writeFile, mkdir} from "node:fs/promises"
import {join} from "node:path"
import JSZip from "jszip"

import type {
    E2EEOptions,
    ImageDB,
    NativeImporterBackend,
    Template
} from "@fiduswriter/document"
import {FW_DOCUMENT_VERSION} from "@fiduswriter/document/schema"

export class FilesystemNativeImporterBackend implements NativeImporterBackend {
    outputDir: string
    docId: number = 1
    path: string = ""
    images: Record<string, {filename: string; blob: Blob}> = {}
    lastOutputPath: string = ""

    constructor(outputDir: string) {
        this.outputDir = outputDir
    }

    async createDoc(
        template: Template,
        _importId: string | number | null,
        requestedPath: string,
        _e2eeOptions: E2EEOptions | null,
        _files: Record<string, File[]>
    ): Promise<{id: number; path: string}> {
        this.docId = Date.now()
        this.path = requestedPath || this.outputDir
        return {id: this.docId, path: this.path}
    }

    async saveImages(
        images: ImageDB,
        _docId: number,
        _e2eeOptions: E2EEOptions | null
    ): Promise<Record<number | string, number>> {
        const translationTable: Record<number | string, number> = {}
        let counter = 1

        for (const [id, entry] of Object.entries(images.db)) {
            const imageValue = entry.image
            if (!imageValue) continue

            let blob: Blob
            if (imageValue instanceof Blob) {
                blob = imageValue
            } else if (imageValue instanceof ArrayBuffer) {
                blob = new Blob([imageValue])
            } else {
                continue
            }

            const ext = (entry.file_type as string | undefined) || blob.type.split("/")[1] || "bin"
            const filename = `image-${id}.${ext}`
            this.images[id] = {filename, blob}
            translationTable[id] = counter++
        }

        return translationTable
    }

    async saveDocument(
        saveData: Record<string, unknown>,
        _e2eeOptions: E2EEOptions | null
    ): Promise<{added: number; updated: number}> {
        const now = Date.now()
        const docTitle = (saveData.title as string) || "untitled"
        const slug = docTitle
            .replace(/[^a-zA-Z0-9\s]/g, "")
            .toLowerCase()
            .replace(/\s/g, "-") || "untitled"

        const outputDir = join(this.outputDir, slug)
        await mkdir(outputDir, {recursive: true})

        const documentJson = JSON.stringify(saveData.content, null, 2)
        const bibliographyJson = JSON.stringify(saveData.bibliography, null, 2)
        const imagesMetaJson = JSON.stringify(
            Object.fromEntries(
                Object.entries(this.images).map(([id, {filename}]) => [
                    id,
                    {image: filename, title: "", file_type: filename.split(".").pop()}
                ])
            ),
            null,
            2
        )

        const zip = new JSZip()
        zip.file("mimetype", "application/vnd.fiduswriter+zip", {compression: "STORE"})
        zip.file("filetype-version", FW_DOCUMENT_VERSION, {compression: "STORE"})
        zip.file("document.json", documentJson)
        zip.file("bibliography.json", bibliographyJson)
        zip.file("images.json", imagesMetaJson)

        for (const {filename, blob} of Object.values(this.images)) {
            const arrayBuffer = await blob.arrayBuffer()
            zip.file(filename, arrayBuffer)
        }

        const blob = await zip.generateAsync({
            type: "nodebuffer",
            mimeType: "application/vnd.fiduswriter+zip"
        })

        const outputPath = join(outputDir, `${slug}.fidus`)
        await writeFile(outputPath, blob)
        this.lastOutputPath = outputPath

        return {added: now, updated: now}
    }

    extractTemplate = undefined
    decryptBufferToBase64 = undefined
    encryptImage = undefined
    encryptObject = undefined
    encrypt = undefined
    storeKeyInSession = undefined
}
