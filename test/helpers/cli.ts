import {spawn} from "node:child_process"
import {stat, readFile} from "node:fs/promises"
import {join} from "node:path"
import JSZip from "jszip"

const CLI = join(import.meta.dirname, "..", "..", "dist", "bin", "fidusconvert.js")

export interface RunResult {
    stdout: Buffer
    stderr: string
    code: number
}

function collectOutput(child: ReturnType<typeof spawn>): Promise<RunResult> {
    return new Promise(resolve => {
        const stdoutChunks: Buffer[] = []
        let stderr = ""
        child.stdout.on("data", (data: Buffer) => {
            stdoutChunks.push(data)
        })
        child.stderr.on("data", (data: Buffer) => {
            stderr += data.toString("utf-8")
        })
        child.on("close", code => {
            resolve({
                stdout: Buffer.concat(stdoutChunks),
                stderr,
                code: code ?? 0
            })
        })
    })
}

export function run(args: string[], timeout = 60000): Promise<RunResult> {
    return collectOutput(spawn("node", [CLI, ...args], {timeout}))
}

export function runWithStdin(
    args: string[],
    input: string | Buffer,
    timeout = 60000
): Promise<RunResult> {
    return new Promise(resolve => {
        const child = spawn("node", [CLI, ...args], {timeout})
        const promise = collectOutput(child)
        child.stdin.write(input)
        child.stdin.end()
        promise.then(resolve)
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
