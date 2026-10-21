import {
  appendFileSync,
  cpSync,
  existsSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, dirname, join, relative, resolve } from 'node:path'
import { setTimeout } from 'node:timers/promises'
import { afterEach, beforeEach, expect, inject, test } from 'vitest'
import { type BackgroundProcess, freePort, run, start, waitForServer } from './run.ts'
import { SAMPLE_PRODUCTS } from './starter.ts'

// Showcase(apps/showcase): Base에 Rendering Mode server와 모든 Recipe·Archetype을 덧입혀 생성하고 커밋한 Starter(ADR-0002).
// 레포 최상위의 npm 스크립트(showcase, showcase:check, showcase:watch, showcase:dev)를 실행해 검증한다.
// Showcase를 설치해 Starter의 스크립트를 실행하는 검사(모든 Recipe·Archetype을 켠 조합)는 showcase-starter.test.ts에 있다.

const REPO_ROOT = resolve(import.meta.dirname, '..')
const SHOWCASE_DIR = join(REPO_ROOT, 'apps', 'showcase')
const RECIPES_DIR = join(REPO_ROOT, 'packages', 'devc-frontend-generator', 'recipes')
const ARCHETYPES_DIR = join(REPO_ROOT, 'packages', 'devc-frontend-generator', 'archetypes')

// 하네스가 npm pack으로 설치한 Generator로 Showcase를 만든다. 배포되는 패키지에 Base와 Recipe가 빠짐없이 담겼는지
// (npm pack이 빼는 dotfile 등)도 함께 드러난다.
const generatorArgs = () => ['--generator', inject('generatorDir')]

function npmAtRoot(args: readonly string[], env?: NodeJS.ProcessEnv) {
  return run('npm', args, REPO_ROOT, env)
}

let workdir: string

beforeEach(() => {
  workdir = mkdtempSync(join(tmpdir(), 'dcgen-showcase-'))
})

afterEach(() => {
  rmSync(workdir, { recursive: true, force: true })
})

/** workdir/showcase에 Showcase를 만든다. */
function generateInto(out: string): void {
  const result = npmAtRoot(['run', 'showcase', '--', ...generatorArgs(), '--out', out])
  expect(result.status, result.output).toBe(0)
}

/** 커밋할 Showcase 파일. git이 무시하는 파일은 빼고, 아직 커밋하지 않은 파일은 넣는다. */
function showcaseFiles(): string[] {
  const result = run('git', ['ls-files', '-z', '--cached', '--others', '--exclude-standard'], SHOWCASE_DIR)
  expect(result.status, result.output).toBe(0)
  return result.output.split('\0').filter((path) => path !== '' && existsSync(join(SHOWCASE_DIR, path)))
}

function readShowcase(path: string): string {
  return readFileSync(join(SHOWCASE_DIR, path), 'utf8')
}

/** 파일의 첫 몇 줄. 생성 안내는 파일 맨 위에 있다. */
function head(text: string): string {
  return text.split('\n').slice(0, 5).join('\n')
}

test('커밋된 Showcase는 Base에 server와 모든 Recipe를 덧입혀 다시 만든 결과와 같다(CI의 어긋남 검사)', () => {
  const result = npmAtRoot(['run', 'showcase:check', '--', ...generatorArgs()])

  expect(result.status, result.output).toBe(0)
})

test('레포의 Generator로 검사해도(CI) 기여자가 흘린 파일(.DS_Store 등)은 npm pack처럼 빼고 만든다', () => {
  // git과 npm pack이 무시하는 파일. Finder가 폴더를 열면 생긴다.
  const stray = join(REPO_ROOT, 'packages/devc-frontend-generator/base/src/app/.DS_Store')
  writeFileSync(stray, 'Finder가 남긴 파일')
  try {
    const result = npmAtRoot(['run', 'showcase:check'])

    expect(result.status, result.output).toBe(0)
  } finally {
    rmSync(stray, { force: true })
  }
})

test('Showcase가 원본과 어긋나면 어긋남 검사가 다른 파일을 모두 알리며 실패하고, 다시 만들면 원본대로 돌아간다', () => {
  const out = join(workdir, 'showcase')
  generateInto(out)
  appendFileSync(join(out, 'src/app/page.tsx'), '// 손으로 고친 줄\n')
  writeFileSync(join(out, 'notes.md'), '손으로 더한 파일\n')
  rmSync(join(out, 'next.config.ts'))

  const drifted = npmAtRoot(['run', 'showcase:check', '--', ...generatorArgs(), '--out', out])

  expect(drifted.status).not.toBe(0)
  for (const path of ['src/app/page.tsx', 'notes.md', 'next.config.ts']) expect(drifted.output).toContain(path)
  expect(drifted.output).toContain('npm run showcase')

  generateInto(out)
  expect(existsSync(join(out, 'notes.md'))).toBe(false)
  const restored = npmAtRoot(['run', 'showcase:check', '--', ...generatorArgs(), '--out', out])
  expect(restored.status, restored.output).toBe(0)
})

// 형식마다 맨 위 주석이 시작하는 모양. 여기에 없는 형식(JSON, .nvmrc 등)은 주석을 달 수 없다.
const COMMENT_STARTS: readonly (readonly [RegExp, string])[] = [
  [/\.[cm]?[jt]sx?$/, '// '],
  [/(?:^|\/)tsconfig\.json$/, '// '],
  [/\.css$/, '/*'],
  [/\.ya?ml$/, '# '],
  [/(?:^|\/)\.(?:env\.[\w.]+|gitignore|prettierignore|dockerignore)$/, '# '],
  [/(?:^|\/)Dockerfile$/, '# '],
]

test('주석을 달 수 있는 Showcase 파일은 생성된 파일이니 고치지 말라는 안내로 시작하고, 나머지는 README가 알린다', () => {
  const readme = readShowcase('README.md')
  const withoutComments: string[] = []

  for (const path of showcaseFiles()) {
    const start = COMMENT_STARTS.find(([pattern]) => pattern.test(path))?.[1]
    if (start === undefined) {
      if (path !== 'README.md') withoutComments.push(path)
      continue
    }
    const top = head(readShowcase(path))
    expect(top.startsWith(start), `${path}\n${top}`).toBe(true)
    expect(top, path).toContain('직접 고치지 마세요')
    expect(top, path).toContain('npm run showcase')
  }

  // README는 맨 위에서 눈에 보이게 알리고, 주석을 달 수 없는 파일을 하나하나 적는다.
  expect(readme.split('\n')[0]).toMatch(/^> .*생성된 Showcase/)
  expect(head(readme)).toContain('직접 고치지 마세요')
  expect(withoutComments).toContain('package.json')
  for (const path of withoutComments) expect(readme, path).toContain(`\`${path}\``)
})

test('생성 안내는 고칠 원본(Base 파일, Recipe 파일, Recipe·Archetype의 패치, 확장 지점의 선언)을 알린다', () => {
  expect(head(readShowcase('.storybook/preview.tsx'))).toContain(
    'base/.storybook/preview.tsx, recipes/dark-mode/.storybook/preview.tsx.patch',
  )
  expect(head(readShowcase('src/app/app-shell.tsx'))).toContain(
    'base/extensions.json, recipes/auth/extensions.json, recipes/dark-mode/extensions.json',
  )
  expect(head(readShowcase('src/shared/api/backend-fetch.ts'))).toContain('원본(packages/devc-frontend-generator/): recipes/auth/extensions.json')
  // MSW 핸들러 목록은 Base 파일이 아니라 mockHandlers를 선언한 Base와 Recipe의 extensions.json으로 조립한다.
  expect(head(readShowcase('src/shared/mocks/handlers.ts'))).toContain(
    '원본(packages/devc-frontend-generator/): base/extensions.json, recipes/auth/extensions.json',
  )
  expect(head(readShowcase('src/shared/mocks/handlers.ts'))).toContain('recipes/table/extensions.json')
  expect(head(readShowcase('src/instrumentation.ts'))).toContain('원본(packages/devc-frontend-generator/): base/extensions.json')
  // sitemap 규칙은 seo의 sitemap이 쓰지만, 규칙을 선언한 Recipe의 extensions.json으로 조립한다.
  expect(head(readShowcase('src/app/sitemap-rules.ts'))).toContain(
    '원본(packages/devc-frontend-generator/): recipes/auth/extensions.json, recipes/i18n/extensions.json',
  )
  expect(head(readShowcase('src/features/theme-switcher/theme-switcher.tsx'))).toContain(
    'recipes/dark-mode/src/features/theme-switcher/theme-switcher.tsx',
  )
  expect(head(readShowcase('src/app/rendering/isr/page.tsx'))).toContain(
    'recipes/route-rendering/src/app/rendering/isr/page.tsx',
  )
  expect(head(readShowcase('.gitignore'))).toContain('base/_gitignore')
  // Archetype은 Recipe를 모두 덧입힌 뒤에 덧입히므로, Archetype의 파일과 Recipe 파일에 대한 Archetype의 패치도 원본으로 알린다.
  expect(head(readShowcase('src/app/dashboard/page.tsx'))).toContain('archetypes/dashboard/src/app/dashboard/page.tsx')
  expect(head(readShowcase('src/shared/auth/access-rules.ts'))).toContain(
    'recipes/auth/src/shared/auth/access-rules.ts, archetypes/dashboard/src/shared/auth/access-rules.ts.patch',
  )
  expect(head(readShowcase('src/app/app-shell.tsx'))).toContain('archetypes/dashboard/extensions.json')
  expect(head(readShowcase('openapi.yaml'))).toContain('archetypes/dashboard/openapi.yaml')
})

test('Showcase는 Generator에 담긴 모든 Recipe와 Archetype을 켠, 배포하지 않는 server Starter다', () => {
  const readme = readShowcase('README.md')

  const overlays = [
    ...readdirSync(RECIPES_DIR).map((name) => ({ kind: 'Recipe', dir: join(RECIPES_DIR, name), name })),
    ...readdirSync(ARCHETYPES_DIR).map((name) => ({ kind: 'Archetype', dir: join(ARCHETYPES_DIR, name), name })),
  ]
  expect(overlays.filter(({ kind }) => kind === 'Archetype').length).toBeGreaterThan(0)
  for (const { kind, dir, name } of overlays) {
    // overlay가 Starter에 그대로 더하는 파일(선언, 병합하는 package.json·README·명세 조각, 지울 목록, 패치를 뺀 나머지)이
    // 모두 있다.
    const added = readdirSync(dir, { recursive: true, withFileTypes: true })
      .filter((entry) => entry.isFile())
      .map((entry) => relative(dir, join(entry.parentPath, entry.name)))
      .filter(
        (path) =>
          ![
            'recipe.json',
            'archetype.json',
            'extensions.json',
            'openapi.yaml',
            'package.json',
            'README.md',
            'remove.txt',
          ].includes(path),
      )
      .filter((path) => !path.endsWith('.patch'))
    expect(added.length, `${kind} ${name}`).toBeGreaterThan(0)
    for (const path of added) expect(existsSync(join(SHOWCASE_DIR, path)), `${kind} ${name}: ${path}`).toBe(true)
    expect(readme, `${kind} ${name}`).toContain(`\`${name}\``)
  }

  const pkg = JSON.parse(readShowcase('package.json')) as { name: string; private?: boolean }
  expect(pkg).toMatchObject({ name: 'showcase', private: true })
  // Rendering Mode server(Base 그대로)다. static-export는 output: 'export'다.
  expect(readShowcase('next.config.ts')).toContain("output: 'standalone'")
})

/** condition이 참이 될 때까지(1분) 기다린다. 끝내 참이 되지 않으면 description과 process의 출력으로 실패한다. */
async function waitUntil(
  condition: () => boolean | Promise<boolean>,
  process: BackgroundProcess,
  description: string,
): Promise<void> {
  const deadline = Date.now() + 60_000
  while (!(await condition())) {
    if (Date.now() > deadline) throw new Error(`${description}\n${process.output()}`)
    await setTimeout(300)
  }
}

function readIfExists(path: string): string {
  return existsSync(path) ? readFileSync(path, 'utf8') : ''
}

test('showcase:watch는 Generator의 Base나 Recipe가 바뀌면 Showcase를 다시 만든다', async () => {
  // 하네스의 Generator를 복사해 고친다. 같은 node_modules에 두어 Generator의 의존성을 그대로 찾게 한다.
  const source = inject('generatorDir')
  const generator = join(dirname(source), `devc-frontend-generator-${basename(workdir)}`)
  cpSync(source, generator, { recursive: true })
  const out = join(workdir, 'showcase')
  const watch = start('npm', ['run', 'showcase:watch', '--', '--generator', generator, '--out', out], REPO_ROOT)

  try {
    // 처음 만든 뒤 지켜보기 시작했다고 알릴 때까지 기다린다. 그 전에 고친 파일은 다시 만드는 계기가 되지 않는다.
    await waitUntil(() => watch.output().includes('파일이 바뀌면'), watch, '지켜보기 시작했다고 알리지 않았습니다.')
    expect(existsSync(join(out, 'README.md')), watch.output()).toBe(true)

    writeFileSync(
      join(generator, 'recipes/dark-mode/src/shared/theme/watch-probe.ts'),
      "export const probe = 'recipe'\n",
    )
    await waitUntil(
      () => readIfExists(join(out, 'src/shared/theme/watch-probe.ts')).includes("probe = 'recipe'"),
      watch,
      'Recipe에 더한 파일이 Showcase에 생기지 않았습니다.',
    )

    // i18n Recipe가 홈(src/app/page.tsx)을 대신하므로 Recipe가 손대지 않는 Base의 페이지를 고친다.
    const basePage = join(generator, 'base/src/app/products/page.tsx')
    writeFileSync(basePage, readFileSync(basePage, 'utf8').replace('<h1>상품</h1>', '<h1>Watched</h1>'))
    await waitUntil(
      () => readIfExists(join(out, 'src/app/products/page.tsx')).includes('<h1>Watched</h1>'),
      watch,
      'Base에서 고친 내용이 Showcase에 반영되지 않았습니다.',
    )
  } finally {
    await watch.stop()
    rmSync(generator, { recursive: true, force: true })
  }
})

test('showcase:dev는 Showcase를 레포 밖에 설치해 MSW 목으로 개발 서버를 띄우고, Showcase가 바뀌면 따라 바꾼다', async () => {
  const showcase = join(workdir, 'showcase')
  generateInto(showcase)
  const runDir = join(workdir, 'run')
  const port = await freePort()
  const origin = `http://localhost:${String(port)}`
  const dev = start(
    'npm',
    ['run', 'showcase:dev', '--', '--showcase', showcase, '--run-dir', runDir, '--port', String(port)],
    REPO_ROOT,
  )

  try {
    // 처음에는 Showcase의 의존성을 설치하므로 오래 걸린다.
    const products = await waitForServer(`${origin}/products`, dev, 5 * 60_000)
    expect(products.status, dev.output()).toBe(200)
    // 서버 컴포넌트가 부른 샘플 API에 MSW가 샘플 명세의 example로 응답했다.
    const html = await products.text()
    for (const { name } of SAMPLE_PRODUCTS) expect(html, dev.output()).toContain(name)
    expect(existsSync(join(runDir, 'node_modules')), dev.output()).toBe(true)
    expect(existsSync(join(showcase, 'node_modules'))).toBe(false)

    const page = join(showcase, 'src/app/products/page.tsx')
    writeFileSync(page, readFileSync(page, 'utf8').replace('<h1>상품</h1>', '<h1>Mirrored</h1>'))
    await waitUntil(
      async () => (await (await fetch(`${origin}/products`)).text()).includes('<h1>Mirrored</h1>'),
      dev,
      'Showcase에서 고친 내용이 개발 서버에 반영되지 않았습니다.',
    )
  } finally {
    await dev.stop()
  }
})
