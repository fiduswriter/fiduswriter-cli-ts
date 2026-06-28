import {createCSL} from "@fiduswriter/document/citations/create_csl"
import {CSL} from "citeproc-plus"
import type {CSL as DocumentCSL} from "@fiduswriter/document"

const DEFAULT_STYLE = "apa"

/**
 * Build a CSL instance configured for the requested citation style.
 *
 * The style is resolved against citeproc-plus's bundled catalog of 2000+
 * CSL styles. If the requested style is not available, an error is thrown
 * listing the available styles.
 */
export async function loadCSL(styleName?: string): Promise<DocumentCSL> {
    const resolvedName = styleName || DEFAULT_STYLE
    const catalog = new CSL()
    const styles = await catalog.getStyles()

    if (!styles[resolvedName]) {
        const available = Object.keys(styles)
        throw new Error(
            `Unknown citation style "${resolvedName}". ` +
                `Use any ID from the citeproc-plus catalog (${available.length} styles, ` +
                `e.g. apa, chicago-author-date, ieee).`
        )
    }

    const style = await catalog.getStyle(resolvedName)
    return createCSL({[resolvedName]: style})
}
