#!/usr/bin/env node
import { readFileSync } from 'node:fs'
import { relative } from 'node:path'
import { Command } from 'commander'
import { createStarter, TargetNotEmptyError } from './create-starter.js'

const { version } = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')) as {
  version: string
}

const program = new Command('dcgen').version(version)

program
  .command('new')
  .description('Base로 새 Starter를 만든다')
  .argument('<name>', 'Starter 이름이자 만들 디렉터리')
  .action(async (name: string) => {
    const target = await createStarter(name, process.cwd()).catch((error: unknown) => {
      if (error instanceof TargetNotEmptyError) program.error(error.message)
      throw error
    })
    const path = relative(process.cwd(), target)
    console.log(`Starter를 만들었습니다: ${target}\n\n  cd ${path}\n  npm install\n  npm run dev\n`)
  })

await program.parseAsync()
