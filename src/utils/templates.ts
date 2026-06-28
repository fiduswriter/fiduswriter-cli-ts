import {readFile} from "node:fs/promises"
import {join} from "node:path"
import {getPackageDir} from "../init.js"

export async function loadDocxTemplate(templatePath?: string): Promise<Blob> {
    if (templatePath) {
        const buffer = await readFile(templatePath)
        return new Blob([buffer], {type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document"})
    }
    const pkgDir = getPackageDir()
    const defaultPath = join(pkgDir, "templates", "Classic.docx")
    const buffer = await readFile(defaultPath)
    return new Blob([buffer], {type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document"})
}

export async function loadOdtTemplate(templatePath?: string): Promise<Blob> {
    if (templatePath) {
        const buffer = await readFile(templatePath)
        return new Blob([buffer], {type: "application/vnd.oasis.opendocument.text"})
    }
    const pkgDir = getPackageDir()
    const defaultPath = join(pkgDir, "templates", "Free.odt")
    const buffer = await readFile(defaultPath)
    return new Blob([buffer], {type: "application/vnd.oasis.opendocument.text"})
}
