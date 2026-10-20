#!/usr/bin/env node
import { Command } from 'commander'
import { registerGenerateCommand } from './generate-command.js'
import { generatorPackage } from './generator-package.js'
import { newCommand } from './new-command.js'

const program = new Command('dcgen').version(generatorPackage.version)

program.addCommand(newCommand())

registerGenerateCommand(program)

await program.parseAsync()
