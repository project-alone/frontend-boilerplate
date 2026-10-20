#!/usr/bin/env node
import { readFileSync } from 'node:fs'
import { relative } from 'node:path'
import { Command, Option } from 'commander'
import { createStarter, TargetNotEmptyError } from './create-starter.js'
import { DEFAULT_RENDERING_MODE, RENDERING_MODES, type RenderingMode } from './rendering-mode.js'

const { version } = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')) as {
  version: string
}

const program = new Command('dcgen').version(version)

program
  .command('new')
  .description('Base로 새 Starter를 만든다')
  .argument('<name>', 'Starter 이름이자 만들 디렉터리')
  .addOption(
    new Option('--rendering-mode <mode>', 'Starter 전체의 Rendering Mode')
      .choices(RENDERING_MODES)
      .default(DEFAULT_RENDERING_MODE),
  )
  .action(async (name: string, options: { renderingMode: RenderingMode }) => {
    const target = await createStarter(name, process.cwd(), options.renderingMode).catch((error: unknown) => {
      if (error instanceof TargetNotEmptyError) program.error(error.message)
      throw error
    })
    const path = relative(process.cwd(), target)
    console.log(`Starter를 만들었습니다: ${target}\n\n  cd ${path}\n  npm install\n  npm run dev\n`)
  })

await program.parseAsync()
