/**
 * Helpers for controlling `fetch` during book export.
 *
 * The book DOCX/ODT exporters load their template through `XmlZip`, which
 * `fetch`es `book.docx_template` / `book.odt_template` and then reads the
 * response via `response.blob()`.  In Node the resulting (undici) Blob cannot
 * be read by jszip, so instead of a real URL we point the exporter at a
 * sentinel URL and intercept it here, returning the template as a
 * jszip-readable `Uint8Array`.  All other requests pass through unchanged and
 * the original `fetch` is restored afterwards.
 *
 * The HTML/EPUB exporters resolve stylesheet URLs (e.g. `css/document.css`)
 * through `staticUrl` and then `fetch` them.  There is no web server hosting
 * those assets in the CLI, so `runWithStubbedAssets` returns empty content for
 * any relative/unfetchable URL while letting absolute (`http(s):`, `data:`)
 * URLs through.
 */

function urlOf(input: RequestInfo | URL): string {
    if (typeof input === "string") {
        return input
    }
    if (input instanceof URL) {
        return input.href
    }
    return (input as Request).url
}

function stubResponse(body: Uint8Array = new Uint8Array()): Response {
    return {
        ok: true,
        status: 200,
        text: async () => new TextDecoder().decode(body),
        blob: async () => body,
        arrayBuffer: async () => body.buffer
    } as unknown as Response
}

function isAbsoluteUrl(url: string): boolean {
    try {
        new URL(url)
        return true
    } catch {
        return false
    }
}

export async function runWithTemplateBlob<T>(
    sentinelUrl: string,
    templateBlob: Blob,
    run: () => Promise<T>
): Promise<T> {
    const originalFetch = globalThis.fetch
    globalThis.fetch = (async (
        input: RequestInfo | URL,
        init?: RequestInit
    ): Promise<Response> => {
        if (urlOf(input) === sentinelUrl) {
            const arrayBuffer = await templateBlob.arrayBuffer()
            return stubResponse(new Uint8Array(arrayBuffer))
        }
        return originalFetch(input, init)
    }) as typeof fetch

    try {
        return await run()
    } finally {
        globalThis.fetch = originalFetch
    }
}

export async function runWithStubbedAssets<T>(
    run: () => Promise<T>
): Promise<T> {
    const originalFetch = globalThis.fetch
    globalThis.fetch = (async (
        input: RequestInfo | URL,
        init?: RequestInit
    ): Promise<Response> => {
        const url = urlOf(input)
        // Relative asset paths (css/document.css, css/book.css, ...) cannot be
        // fetched: there is no server. Return empty content for them.
        if (!isAbsoluteUrl(url)) {
            return stubResponse()
        }
        return originalFetch(input, init)
    }) as typeof fetch

    try {
        return await run()
    } finally {
        globalThis.fetch = originalFetch
    }
}
