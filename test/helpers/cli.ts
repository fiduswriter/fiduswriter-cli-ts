import {execFile} from "node:child_process"
import {stat, readFile} from "node:fs/promises"
import {join} from "node:path"
import JSZip from "jszip"

const CLI = join(import.meta.dirname, "..", "..", "dist", "bin", "fidusconvert.js")

export interface RunResult {
    stdout: string
    stderr: string
    code: number
}

export function run(args: string[], timeout = 60000): Promise<RunResult> {
    return new Promise(resolve => {
        execFile("node", [CLI, ...args], {timeout}, (err, stdout, stderr) => {
            resolve({
                stdout: stdout || "",
                stderr: stderr || "",
                code: err && "code" in err ? (err as any).code : 0
            })
        })
    })
}

export function outputPath(tmpDir: string, name: string): string {
    return join(tmpDir, name)
}

export async function fileExists(path: string): Promise<boolean> {
    try {
        await stat(path)
        return true
    } catch {
        return false
    }
}

export async function fileMinSize(path: string, minBytes: number): Promise<boolean> {
    try {
        const s = await stat(path)
        return s.size >= minBytes
    } catch {
        return false
    }
}

export async function isZipWithEntry(path: string, entry: string): Promise<boolean> {
    try {
        const buf = await readFile(path)
        const zip = await JSZip.loadAsync(buf)
        return zip.file(entry) !== null
    } catch {
        return false
    }
}
