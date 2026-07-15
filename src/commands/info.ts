import type {Command} from "commander"
import {resolve} from "node:path"
import {readFile} from "node:fs/promises"
import JSZip from "jszip"

import {ensureInit} from "../init.js"
import {FW_DOCUMENT_VERSION} from "@fiduswriter/document/schema"
import type {FidusNode} from "@fiduswriter/document"

export function registerInfoCommand(program: Command): void {
    program
        .command("info")
        .description("Display information about a .fidus file")
        .argument("<input>", "Path to the .fidus file")
        .action(async (input) => {
            await doInfo(input)
        })
}

async function doInfo(inputPath: string): Promise<void> {
    ensureInit()

    const resolved = resolve(inputPath)
    const buffer = await readFile(resolved)
    const zip = await JSZip.loadAsync(buffer)

    const filetypeVersion = await zip.file("filetype-version")?.async("string")
    const mimeType = await zip.file("mimetype")?.async("string")
    const documentText = await zip.file("document.json")?.async("string")
    const imagesText = await zip.file("images.json")?.async("string")
    const bibliographyText = await zip.file("bibliography.json")?.async("string")

    if (!filetypeVersion || !mimeType) {
        console.error("Not a valid Fidus Writer file")
        process.exit(1)
    }

    console.log(`File: ${resolved}`)
    console.log(`MIME Type: ${mimeType.trim()}`)
    console.log(`Format Version: ${filetypeVersion.trim()}`)
    console.log(`Supported Version Range: 1.6 - ${FW_DOCUMENT_VERSION}`)

    if (documentText) {
        try {
            const doc = JSON.parse(documentText)
            const title = doc.content?.[0]?.content?.[0]?.text || "Untitled"
            console.log(`Title: ${title}`)

            if (doc.attrs) {
                console.log(`Language: ${doc.attrs.language || "unknown"}`)
                console.log(`Paper Size: ${doc.attrs.papersize || "unknown"}`)
                console.log(`Citation Style: ${doc.attrs.citationstyle || "unknown"}`)
                console.log(`Document Style: ${doc.attrs.documentstyle || "unknown"}`)

                const parts = (doc.content || []).map((part: FidusNode) => part.type)
                console.log(`Document Parts: ${parts.join(", ")}`)
            }
        } catch {
            console.log("Document: (could not parse document.json)")
        }
    }

    if (imagesText) {
        try {
            const images = JSON.parse(imagesText)
            const count = Object.keys(images).length
            console.log(`Images: ${count}`)
        } catch {
            console.log("Images: (could not parse images.json)")
        }
    }

    if (bibliographyText) {
        try {
            const bib = JSON.parse(bibliographyText)
            const count = Object.keys(bib).length
            console.log(`Bibliography Entries: ${count}`)
        } catch {
            console.log("Bibliography: (could not parse bibliography.json)")
        }
    }

    const fileNames: string[] = []
    zip.forEach((relativePath) => fileNames.push(relativePath))
    console.log(`\nFiles in archive:`)
    fileNames.forEach(name => console.log(`  ${name}`))
}
