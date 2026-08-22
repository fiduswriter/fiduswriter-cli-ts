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
 * The HTML/EPUB exporters resolve stylesheet URLs (e.g.
 * `css/document/document.css`) through `staticUrl` and then `fetch` them. In
 * the CLI, `staticUrl` resolves `@fiduswriter/document`'s stylesheets and
 * fonts to `file:` URLs pointing into the installed package, which the
 * `file:`-aware fetch in init.ts can read. `runWithStubbedAssets` therefore
 * only needs to stub truly unfetchable relative URLs while letting absolute
 * (`http(s):`, `file:`, `data:`) URLs through.
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
        // Relative asset paths that staticUrl could not resolve (e.g. custom
        // document-style files with no backend to serve them) cannot be
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
