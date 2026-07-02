import {createCSL} from "@fiduswriter/document/citations/create_csl"
import {CSL} from "citeproc-plus"
import type {CSL as DocumentCSL} from "@fiduswriter/document"

const DEFAULT_STYLE = "apa"

export interface LoadedCSL {
    csl: DocumentCSL
    styleName: string
}

/**
 * Build a CSL instance configured for the requested citation style.
 *
 * The style is resolved against citeproc-plus's bundled catalog. If the
 * requested style is not available, a warning is printed and the default
 * style is used instead.
 */
export async function loadCSL(styleName?: string): Promise<LoadedCSL> {
    const requestedName = styleName || DEFAULT_STYLE
    const catalog = new CSL()
    const styles = await catalog.getStyles()

    const resolvedName = styles[requestedName] ? requestedName : DEFAULT_STYLE

    if (resolvedName !== requestedName) {
        console.error(
            `Unknown citation style "${requestedName}". ` +
                `Falling back to the default style "${DEFAULT_STYLE}".`
        )
    }

    const style = await catalog.getStyle(resolvedName)
    const csl = await createCSL({[resolvedName]: style})
    return {csl, styleName: resolvedName}
}
