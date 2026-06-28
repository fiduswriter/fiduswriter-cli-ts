import {initSettings} from "fwtoolkit"
import {fileURLToPath} from "node:url"
import {dirname, join} from "node:path"

let initialized = false

export function getPackageDir(): string {
    return dirname(dirname(fileURLToPath(import.meta.url)))
}

export function ensureInit(): void {
    if (initialized) {
        return
    }
    initSettings({
        apiUrl: (url: string) => url,
        getCsrfToken: () => "",
        gettext: (msgid: string) => msgid,
        staticUrl: (path: string) => path,
        interpolate: (fmt: string, _args: unknown[], _named?: boolean) => fmt
    })
    initialized = true
}
