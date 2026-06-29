#!/usr/bin/env node

import {createRequire} from "node:module"

import {program} from "commander"
import {registerConvertCommand} from "../commands/convert.js"
import {registerInfoCommand} from "../commands/info.js"

const require = createRequire(import.meta.url)
const {version} = require("../../package.json")

program
    .name("fidusconvert")
    .description("Convert documents between Fidus Writer and other formats")
    .version(version)

registerConvertCommand(program)
registerInfoCommand(program)

program.addHelpText(
    "after",
    `
Piping:
  Use "-" as the input or output path to read from stdin or write to stdout.
  When "-" is used, the format must be given explicitly with --from or --to.

  Examples:
    pandoc -f markdown -t json input.md | fidusconvert --from pandoc --to fidus - output.fidus
    fidusconvert --from fidus --to pandoc input.fidus - | pandoc -f json -t markdown
    fidusconvert --from fidus --to docx input.fidus - > output.docx

  Status messages are written to stderr so they do not mix with piped output.
  Exporting to --to pandoc - emits the raw Pandoc JSON, not a zip archive.
`
)

program.parse()
