import {initSettings} from "fwtoolkit"
import {Window} from "happy-dom"
import {existsSync} from "node:fs"
import {readFile} from "node:fs/promises"
import {fileURLToPath, pathToFileURL} from "node:url"
import {dirname, resolve} from "node:path"

let initialized = false
let documentStaticDir: string | undefined
let originalFetch: typeof fetch | undefined

export function getPackageDir(): string {
    return dirname(dirname(fileURLToPath(import.meta.url)))
}

function getDocumentRoot(): string {
    // Resolve the package root from the main entry point (dist/index.js).
    const mainUrl = import.meta.resolve("@fiduswriter/document")
    return resolve(dirname(fileURLToPath(mainUrl)), "..")
}

function getBooksDocumentRoot(): string {
    // Resolve the package root from the main entry point (dist/index.js).
    const mainUrl = import.meta.resolve("@fiduswriter/books-document")
    return resolve(dirname(fileURLToPath(mainUrl)), "..")
}

function getDocumentStaticDir(): string {
    if (documentStaticDir) {
        return documentStaticDir
    }
    documentStaticDir = resolve(getDocumentRoot(), "static-libs")
    return documentStaticDir
}

function resolveStaticUrl(path: string): string {
    // Leave absolute URLs and data URIs untouched.
    if (/^(https?:|file:|\/|data:)/i.test(path)) {
        return path
    }
    // CSS shipped by @fiduswriter/document lives in the package's css/
    // directory (served as css/document/... in the main app). The document
    // exporters reference it as css/document/..., so map that to the css/
    // directory of the installed package.
    if (path.startsWith("css/document/")) {
        const filePath = resolve(
            getDocumentRoot(),
            "css",
            path.slice("css/document/".length)
        )
        if (existsSync(filePath)) {
            return pathToFileURL(filePath).href
        }
        return path
    }
    // css/book.css is shipped by @fiduswriter/books-document (served at
    // /static/css/book.css in the main app).
    if (path.startsWith("css/book.css")) {
        const filePath = resolve(getBooksDocumentRoot(), "css", "book.css")
        if (existsSync(filePath)) {
            return pathToFileURL(filePath).href
        }
        return path
    }
    const staticDir = getDocumentStaticDir()
    const filePath = resolve(staticDir, path)
    if (existsSync(filePath)) {
        return pathToFileURL(filePath).href
    }
    return path
}

async function fileFetch(url: string): Promise<Response> {
    const buffer = await readFile(fileURLToPath(url))
    // Return the raw bytes through blob() (like stubResponse in
    // exporters/book-template.ts) so jszip can write binary assets (e.g. the
    // bundled fallback fonts) without relying on a browser FileReader.
    return {
        ok: true,
        status: 200,
        statusText: "OK",
        text: async () => new TextDecoder().decode(buffer),
        blob: async () => buffer,
        arrayBuffer: async () =>
            buffer.buffer.slice(
                buffer.byteOffset,
                buffer.byteOffset + buffer.byteLength
            )
    } as unknown as Response
}

function ensureFileFetch(): void {
    if (originalFetch) {
        return
    }
    originalFetch = globalThis.fetch
    globalThis.fetch = async (
        input: RequestInfo | URL,
        init?: RequestInit
    ): Promise<Response> => {
        let url: string
        if (typeof input === "string") {
            url = input
        } else if (input instanceof URL) {
            url = input.href
        } else {
            url = input.url
        }
        if (url.startsWith("file:")) {
            return fileFetch(url)
        }
        return originalFetch!(input, init)
    }
}

function ensureDOMGlobals(): void {
    if (typeof globalThis.window !== "undefined") {
        return
    }
    const window = new Window()
    const g = globalThis as unknown as Record<string, unknown>
    g.window = window
    g.document = window.document
    Object.defineProperty(g, "navigator", {
        value: window.navigator,
        configurable: true,
        writable: true
    })
    Object.defineProperty(g, "location", {
        value: window.location,
        configurable: true,
        writable: true
    })
}

export function ensureInit(): void {
    if (initialized) {
        return
    }
    ensureDOMGlobals()
    ensureFileFetch()
    initSettings({
        apiUrl: (url: string) => url,
        getCsrfToken: () => "",
        gettext: (msgid: string) => msgid,
        staticUrl: resolveStaticUrl,
        interpolate: (fmt: string, _args: unknown[], _named?: boolean) => fmt
    })
    initialized = true
}
