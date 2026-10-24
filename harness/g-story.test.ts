import { existsSync, readdirSync, readFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, test } from 'vitest'
import { parse } from 'yaml'
import { freePort, run } from './run.ts'
import {
  dcgen,
  expectFilesToMatchSnapshots,
  expectFileToPass,
  readTree,
  runVitestScript,
  type Starter,
  useStarter,
} from './starter.ts'

// 생성 결과 스냅샷
const SNAPSHOTS = './__snapshots__/g-story'

// story Schematic이 Storybook을 더할 때 만드는 설정 파일
const STORYBOOK_FILES = ['.storybook/main.ts', '.storybook/preview.tsx', '.storybook/vitest-project.ts']

interface PackageJson {
  scripts: Record<string, string>
  devDependencies: Record<string, string>
  dependencies: Record<string, string>
}

function readPackageJson(starter: Starter): PackageJson {
  return JSON.parse(readFileSync(join(starter.dir, 'package.json'), 'utf8')) as PackageJson
}

/** Starter에서 node_modules와 빌드 결과를 빼고, 이름이나 내용에 Storybook이 나오는 파일. README는 story Schematic을 안내하므로 뺀다. */
function filesMentioningStorybook(starter: Starter): string[] {
  const skipped = new Set(['node_modules', '.next', '.git', 'package-lock.json', 'README.md'])
  const found: string[] = []
  const visit = (directory: string, prefix: string) => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      if (skipped.has(entry.name)) continue
      const path = `${prefix}${entry.name}`
      if (entry.isDirectory()) visit(join(directory, entry.name), `${path}/`)
      else if (/storybook|stories/i.test(path) || /storybook/i.test(readFileSync(join(directory, entry.name), 'utf8'))) {
        found.push(path)
      }
    }
  }
  visit(starter.dir, '')
  return found
}

/** Storybook을 더하지 않은 Starter. 고른 Recipe의 파일까지 Storybook에 관한 것이 하나도 없다. */
function expectNoStorybook(starter: Starter): void {
  const pkg = readPackageJson(starter)
  const packages = Object.keys({ ...pkg.dependencies, ...pkg.devDependencies })
  expect(packages.filter((name) => /storybook|@vitest\/browser/.test(name))).toEqual([])
  expect(Object.keys(pkg.scripts).filter((name) => name.includes('storybook'))).toEqual([])
  expect(filesMentioningStorybook(starter)).toEqual([])
}

describe('server Starter', () => {
  const starter = useStarter({ prefix: 'dcgen-g-story-', install: true, playwright: true })

  test('dcgen new로 만든 Starter에는 Storybook 설정, 의존성, 스크립트, 스토리가 없다', () => {
    expectNoStorybook(starter)
  })

  test('Storybook이 없으면 g story가 Storybook을 더하고 의존성을 설치한 뒤 컴포넌트 옆에 스토리를 만든다', async () => {
    const result = dcgen(starter, ['g', 'story', 'src/app/not-found.tsx'])

    expect(result.status, result.output).toBe(0)
    for (const path of [...STORYBOOK_FILES, 'src/app/not-found.stories.tsx']) {
      expect(result.output).toContain(`만듦  ${path}`)
      expect(existsSync(join(starter.dir, path)), path).toBe(true)
    }
    for (const path of ['package.json', 'config/vitest.config.ts', 'tsconfig.json', '.gitignore', '.gitlab-ci.yml', 'README.md']) {
      expect(result.output).toContain(`고침  ${path}`)
    }
    await expectFilesToMatchSnapshots(starter, SNAPSHOTS, 'src/app', ['not-found.stories.tsx'])

    // 의존성과 스크립트를 더하고 설치까지 했다.
    const pkg = readPackageJson(starter)
    expect(pkg.scripts).toMatchObject({
      storybook: 'storybook dev -p 6006',
      'test:storybook': 'vitest run --config config/vitest.config.ts --project storybook',
    })
    expect(Object.keys(pkg.devDependencies)).toEqual(
      expect.arrayContaining(['storybook', '@storybook/nextjs-vite', '@storybook/addon-a11y', '@storybook/addon-vitest']),
    )
    expect(existsSync(join(starter.dir, 'node_modules/storybook/package.json'))).toBe(true)

    // 사용자가 고칠 수 있는 설정은 덮어쓰지 않고 Storybook에 필요한 것만 더했다.
    expect(readFileSync(join(starter.dir, 'config/vitest.config.ts'), 'utf8')).toContain('storybookProject')
    const tsconfig = readFileSync(join(starter.dir, 'tsconfig.json'), 'utf8')
    expect(tsconfig).toContain('".storybook/**/*.tsx"')
    expect(tsconfig).toContain('// next build가 요구하는 값이다.')
    expect(readFileSync(join(starter.dir, '.gitignore'), 'utf8')).toContain('storybook-static/')
    const ci = parse(readFileSync(join(starter.dir, '.gitlab-ci.yml'), 'utf8')) as Record<string, unknown>
    expect(ci['test:storybook']).toMatchObject({ extends: '.chromium', stage: 'check', script: ['npm run test:storybook'] })
    expect(readFileSync(join(starter.dir, 'README.md'), 'utf8')).toContain('## Storybook')

    // Base Starter에는 dark-mode Recipe가 없으므로 Recipe의 Storybook 설정(테마 툴바)이 들어가지 않는다.
    expect(readFileSync(join(starter.dir, '.storybook/preview.tsx'), 'utf8')).not.toContain('theme')
  })

  test('Storybook이 있으면 g story는 스토리만 만들고, 이름으로 내보낸 컴포넌트의 children을 채운다', async () => {
    const before = readPackageJson(starter)

    const result = starter.npm(['run', 'g', '--', 'story', 'src/shared/ui/button.tsx'])

    expect(result.status, result.failureMessage).toBe(0)
    expect(result.output).toContain('만듦  src/shared/ui/button.stories.tsx')
    expect(result.output).not.toContain('고침')
    expect(readPackageJson(starter)).toEqual(before)
    await expectFilesToMatchSnapshots(starter, SNAPSHOTS, 'src/shared/ui', ['button.stories.tsx'])
  })

  test('현재 디렉터리 기준 경로를 받고, 필수 props(오류 객체, 함수)에 넘길 값을 정한다', async () => {
    const result = run('npx', ['--no', '--', 'dcgen', 'g', 'story', 'error.tsx'], join(starter.dir, 'src/app'))

    expect(result.status, result.output).toBe(0)
    expect(result.output).toContain('만듦  src/app/error.stories.tsx')
    await expectFilesToMatchSnapshots(starter, SNAPSHOTS, 'src/app', ['error.stories.tsx'])
  })

  test('component Schematic이 만든 Feature의 컴포넌트와, --component로 고른 컴포넌트의 스토리를 만든다', async () => {
    expect(dcgen(starter, ['g', 'component', 'order-summary', '--feature', 'orders']).status).toBe(0)

    const feature = dcgen(starter, ['g', 'story', 'src/features/orders/order-summary.tsx'])
    const icon = dcgen(starter, ['g', 'story', 'src/shared/ui/icons.tsx', '--component', 'ChevronDownIcon'])

    expect(feature.status, feature.output).toBe(0)
    expect(icon.status, icon.output).toBe(0)
    await expectFilesToMatchSnapshots(starter, SNAPSHOTS, 'src/features/orders', ['order-summary.stories.tsx'])
    await expectFilesToMatchSnapshots(starter, SNAPSHOTS, 'src/shared/ui', ['chevron-down-icon.stories.tsx'])
  })

  test('데이터를 가져오는 컴포넌트면 스토리에서 데이터를 정하는 방법을 알린다', () => {
    // 브라우저에서 데이터를 가져오는 클라이언트 컴포넌트. apiFetch는 서버에서만 서버 전용 모듈(#api-fetch.server)을 불러오므로,
    // Storybook(Vite)에서도 불러오기가 깨지지 않고 요청이 실패한 화면을 보여야 한다(아래 test:storybook).
    starter.writeFile(
      'src/features/product-count/product-count.tsx',
      `'use client'

import { useQuery } from '@tanstack/react-query'
import { listProductsQueryOptions } from '@/queries/products/products.queries'

export function ProductCount() {
  const { data, isError } = useQuery(listProductsQueryOptions())

  if (isError) return <p role="alert">상품을 불러오지 못했습니다.</p>
  return <p>{data === undefined ? '불러오는 중입니다.' : \`상품 \${String(data.length)}개\`}</p>
}
`,
    )

    const result = dcgen(starter, ['g', 'story', 'src/features/product-count/product-count.tsx'])

    expect(result.status, result.output).toBe(0)
    expect(result.output).toContain('TanStack Query')
    expect(result.output).toContain('README의 "Storybook"')
  })

  test.each([
    {
      problem: '이미 스토리가 있는 컴포넌트',
      args: ['src/shared/ui/button.tsx'],
      reason: '같은 이름의 파일이 이미 있어 덮어쓰지 않았습니다',
    },
    { problem: '없는 파일', args: ['src/shared/ui/missing.tsx'], reason: '파일이 없습니다: src/shared/ui/missing.tsx' },
    {
      problem: 'src 밖의 파일',
      args: ['playwright.config.ts'],
      reason: 'src 아래의 컴포넌트 파일(.tsx)',
    },
    {
      problem: '컴포넌트를 내보내지 않는 파일',
      args: ['src/shared/ui/class-name.ts'],
      reason: 'src 아래의 컴포넌트 파일(.tsx)',
    },
    {
      problem: '이름이 파일과 다른 컴포넌트를 여럿 내보내는 파일',
      args: ['src/shared/ui/icons.tsx'],
      reason: '--component로 고르세요',
    },
    {
      problem: '파일이 내보내지 않는 --component',
      args: ['src/shared/ui/field.tsx', '--component', 'Missing'],
      reason: "field.tsx는 'Missing' 컴포넌트를 내보내지 않습니다",
    },
    {
      problem: '서버 컴포넌트(async)',
      args: ['src/app/products/page.tsx'],
      reason: '서버 컴포넌트(async 함수)는 Storybook이 그리지 못합니다',
    },
  ])('$problem: 이유를 알리고 아무 파일도 만들지 않은 채 실패한다', ({ args, reason }) => {
    const before = readTree(join(starter.dir, 'src'))

    const result = dcgen(starter, ['g', 'story', ...args])

    expect(result.status).not.toBe(0)
    expect(result.output).toContain(reason)
    expect(readTree(join(starter.dir, 'src'))).toEqual(before)
  })

  test('스토리 Schematic이 만든 Storybook과 스토리로 Starter의 검사가 모두 통과한다', () => {
    for (const script of [['run', 'typecheck'], ['run', 'lint'], ['run', 'format:check'], ['test']]) {
      starter.expectNpmSuccess(script)
    }

    const report = runVitestScript(starter, ['run', 'test:storybook'])
    for (const story of [
      'src/app/not-found.stories.tsx',
      'src/app/error.stories.tsx',
      'src/shared/ui/button.stories.tsx',
      'src/shared/ui/chevron-down-icon.stories.tsx',
      'src/features/orders/order-summary.stories.tsx',
      'src/features/product-count/product-count.stories.tsx',
    ]) {
      expectFileToPass(report, story, 1)
    }
    starter.expectNpmSuccess(['run', 'build'])
  })

  test('더한 Storybook의 개발 서버가 뜬다', async () => {
    // Starter의 스크립트는 -p 6006으로 띄운다. 다른 워크트리의 하네스나 개발자의 Storybook이 6006을 쓰고 있어도 흔들리지 않도록
    // 빈 포트를 뒤에 넘겨 덮어쓰고(뒤의 --port가 이긴다), 그 포트가 아니면 다른 포트로 옮기지 않고 실패하게 한다.
    const port = String(await freePort())
    starter.expectNpmSuccess(['run', 'storybook', '--', '--ci', '--smoke-test', '--port', port, '--exact-port'])
  })

  test('WCAG 2.2 AA를 어기는 스토리가 있으면 test:storybook의 접근성 검사가 실패한다', () => {
    const story = 'src/app/harness-a11y.stories.tsx'
    // 24px보다 작은 버튼 두 개를 붙여 둔다(WCAG 2.2 성공 기준 2.5.8 위반). 실제 브라우저에서 크기를 재야 잡히는 위반이다.
    starter.writeFile(
      story,
      `import type { Meta, StoryObj } from '@storybook/nextjs-vite'

function TinyButtons() {
  const style = { width: 12, height: 12, padding: 0, margin: 0, fontSize: 8 }
  return (
    <div>
      <button type="button" style={style}>A</button>
      <button type="button" style={style}>B</button>
    </div>
  )
}

const meta = { component: TinyButtons } satisfies Meta<typeof TinyButtons>

export default meta

export const Default: StoryObj<typeof meta> = {}
`,
    )

    try {
      const result = starter.npm(['run', 'test:storybook', '--', story])

      expect(result.status, result.failureMessage).not.toBe(0)
      expect(result.output).toContain('target-size')
    } finally {
      rmSync(join(starter.dir, story))
    }
  })
})

// Recipe의 Storybook 설정(dark-mode의 테마 툴바와 다크 모드 브라우저)은 Storybook을 더할 때 그 Recipe가 Starter에 있으면 함께 들어간다.
// static-export Starter의 설정(next.config.ts 등)에서도 Storybook이 도는지 함께 본다.
describe('static-export Starter에 dark-mode Recipe를 넣은 Starter', () => {
  const starter = useStarter({
    prefix: 'dcgen-g-story-static-dark-',
    renderingMode: 'static-export',
    recipes: ['dark-mode'],
    install: true,
    playwright: true,
  })

  test('dcgen new로 만든 Starter에는 Recipe의 것까지 Storybook에 관한 것이 없다', () => {
    expectNoStorybook(starter)
  })

  test('--skip-install이면 설치하지 않고 다음에 할 일을 알린다. 설치하면 Recipe의 Storybook 설정까지 검사가 통과한다', () => {
    const result = dcgen(starter, ['g', 'story', 'src/features/theme-switcher/theme-switcher.tsx', '--skip-install'])

    expect(result.status, result.output).toBe(0)
    expect(result.output).toContain('npm install')
    expect(existsSync(join(starter.dir, 'node_modules/storybook'))).toBe(false)
    expect(readFileSync(join(starter.dir, '.storybook/preview.tsx'), 'utf8')).toContain('THEME_CHOICES')
    expect(readFileSync(join(starter.dir, '.storybook/vitest-project.ts'), 'utf8')).toContain("colorScheme: 'dark'")

    starter.expectNpmSuccess(['install', '--no-audit', '--no-fund'])
    for (const script of [['run', 'typecheck'], ['run', 'lint'], ['run', 'format:check']]) starter.expectNpmSuccess(script)
    // 스토리는 라이트 모드 브라우저와 다크 모드 브라우저에서 한 번씩 돈다.
    const report = runVitestScript(starter, ['run', 'test:storybook'])
    expectFileToPass(report, 'src/features/theme-switcher/theme-switcher.stories.tsx', 2)
  })
})
