import {initSettings} from "fwtoolkit"
import {Window} from "happy-dom"
import {fileURLToPath} from "node:url"
import {dirname, join} from "node:path"

let initialized = false

export function getPackageDir(): string {
    return dirname(dirname(fileURLToPath(import.meta.url)))
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
    initSettings({
        apiUrl: (url: string) => url,
        getCsrfToken: () => "",
        gettext: (msgid: string) => msgid,
        staticUrl: (path: string) => path,
        interpolate: (fmt: string, _args: unknown[], _named?: boolean) => fmt
    })
    initialized = true
}
