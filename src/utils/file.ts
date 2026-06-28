import {writeFile, mkdir} from "node:fs/promises"
import {dirname} from "node:path"

export async function writeBlobToFile(blob: Blob, filePath: string): Promise<void> {
    const dir = dirname(filePath)
    await mkdir(dir, {recursive: true})
    const arrayBuffer = await blob.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)
    await writeFile(filePath, buffer)
}
