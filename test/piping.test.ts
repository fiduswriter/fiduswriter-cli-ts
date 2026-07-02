import {describe, it, before, after} from "node:test"
import assert from "node:assert/strict"
import {spawn} from "node:child_process"
import {mkdtemp, rm} from "node:fs/promises"
import {join, dirname} from "node:path"
import {tmpdir} from "node:os"
import JSZip from "jszip"

import {run, runWithStdin, outputPath, fileExists, isZipWithEntry} from "./helpers/cli.js"
import {isPandocAvailable} from "./helpers/corpus.js"

const FIXTURE = join(dirname(import.meta.dirname), "test", "test-document.fidus")

function spawnWithStdin(
    command: string,
    args: string[],
    input: string | Buffer
): Promise<{stdout: string; stderr: string; code: number}> {
    return new Promise(resolve => {
        const child = spawn(command, args)
        let stdout = ""
        let stderr = ""
        child.stdout.on("data", (data: Buffer) => {
            stdout += data.toString("utf-8")
        })
        child.stderr.on("data", (data: Buffer) => {
            stderr += data.toString("utf-8")
        })
        child.on("close", code => {
            resolve({stdout, stderr, code: code ?? 0})
        })
        child.stdin.write(input)
        child.stdin.end()
    })
}

let tmpDir: string

before(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), "fidusconvert-pipe-"))
})

after(async () => {
    if (tmpDir) {
        await rm(tmpDir, {recursive: true, force: true})
    }
})

function describePiping() {
    if (!isPandocAvailable()) {
        describe("stdin/stdout piping", () => {
            it("skips because Pandoc is not installed", () => {
                console.warn("Pandoc not available; skipping piping tests")
            })
        })
        return
    }

    describe("stdin/stdout piping", () => {
        it("reads Pandoc JSON from stdin and writes a .fidus file", async () => {
            const markdown = "# Piped Document\n\nHello from stdin.\n"
            const pandocResult = await spawnWithStdin(
                "pandoc",
                ["-f", "markdown", "-t", "json"],
                markdown
            )
            assert.equal(pandocResult.code, 0, `pandoc stderr: ${pandocResult.stderr}`)

            const fidusPath = outputPath(tmpDir, "from-stdin.fidus")
            const result = await runWithStdin(
                ["--from", "pandoc", "--to", "fidus", "-", fidusPath],
                pandocResult.stdout
            )
            assert.equal(result.code, 0, `stderr: ${result.stderr}`)
            assert(await fileExists(fidusPath))
            assert(await isZipWithEntry(fidusPath, "document.json"))
        })

        it("writes raw Pandoc JSON to stdout", async () => {
            const result = await run([FIXTURE, "-", "--to", "pandoc"])
            assert.equal(result.code, 0, `stderr: ${result.stderr}`)
            const doc = JSON.parse(result.stdout.toString("utf-8"))
            const text = JSON.stringify(doc)
            assert.ok(text.includes("Test") && text.includes("Document"), "stdout missing document title")
        })

        it("passes binary output to stdout", async () => {
            const result = await run([FIXTURE, "-", "--to", "fidus"])
            assert.equal(result.code, 0, `stderr: ${result.stderr}`)
            const zip = await JSZip.loadAsync(result.stdout)
            assert.ok(zip.file("document.json"), "stdout missing document.json")
        })
    })
}

describePiping()
