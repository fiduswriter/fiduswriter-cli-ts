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

function getDocumentStaticDir(): string {
    if (documentStaticDir) {
        return documentStaticDir
    }
    // Resolve the package root from the main entry point (dist/index.js).
    const mainUrl = import.meta.resolve("@fiduswriter/document")
    documentStaticDir = resolve(dirname(fileURLToPath(mainUrl)), "..", "static-libs")
    return documentStaticDir
}

function resolveStaticUrl(path: string): string {
    // Leave absolute URLs and data URIs untouched.
    if (/^(https?:|file:|\/|data:)/i.test(path)) {
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
    return new Response(new Blob([buffer]), {status: 200, statusText: "OK"})
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
