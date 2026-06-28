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

program.parse()
