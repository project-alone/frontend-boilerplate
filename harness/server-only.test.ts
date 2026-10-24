import { readdirSync, readFileSync, rmSync } from 'node:fs'
import { join, relative } from 'node:path'
import { describe, expect, inject, test } from 'vitest'
import { run } from './run.ts'
import { useStarter } from './starter.ts'

// 하네스 매트릭스: 서버와 브라우저의 경계 표시. 서버에서만 실행되는 모듈은 `import 'server-only'`로, 컴포넌트가 아니면서 브라우저에서만
// 실행되는 모듈은 `import 'client-only'`로 시작해, 반대쪽에서 import하면 next build가 실패한다. 컴포넌트는 'use client'로 나눈다.
// Next.js가 서버에서만 실행하는 파일(src/app의 page·layout·route 등, src/proxy.ts, src/instrumentation.ts)은 위치로 구분되므로
// 표시하지 않고, 여러 곳에서 import하는 모듈에 표시한다.

const REPO_ROOT = join(import.meta.dirname, '..')

/** Base, Rendering Mode, Recipe가 Starter에 두는 서버 전용 모듈 */
const SERVER_ONLY_MODULES = [
  'src/shared/api/api-fetch.server.ts',
  'src/shared/api/api-instrumentation.ts',
  'src/shared/api/api-mocking.ts',
  'src/shared/api/backend-fetch.ts',
  'src/shared/api/bff-proxy.ts',
  'src/shared/mocks/node.ts',
  'src/shared/auth/auth-backend-fetch.ts',
  'src/shared/auth/auth-backend.ts',
  'src/shared/auth/auth-instrumentation.ts',
  'src/shared/auth/auth-proxy.ts',
  'src/shared/auth/refresh-session.ts',
  'src/shared/auth/server-session.ts',
  'src/shared/auth/session-routes.ts',
  'src/shared/auth/session-scope.ts',
  'src/shared/auth/session.ts',
  'src/shared/auth/token-operations.ts',
  'src/shared/i18n/i18n-proxy.ts',
  'src/shared/i18n/request.ts',
  'src/shared/seo/og-image.tsx',
  'src/shared/seo/page-routes.ts',
  'src/shared/sentry/sentry-instrumentation.ts',
]

/** 브라우저 전용 모듈. Rendering Mode static-export의 것은 static-export Starter에만 있다. */
const CLIENT_ONLY_MODULES = [
  'src/shared/analytics/analytics-instrumentation-client.ts',
  'src/shared/sentry/sentry-instrumentation-client.ts',
]
const STATIC_EXPORT_CLIENT_ONLY_MODULES = [
  'src/shared/mocks/browser-instrumentation.ts',
  'src/shared/mocks/browser.ts',
]

// 서버에서만 쓸 수 있는 import. 이것을 쓰는 모듈은 서버 전용이다.
const SERVER_IMPORT = /^import .*from '(next\/headers|iron-session|msw\/node|node:[^']+)'$/m
// 브라우저에서만 쓸 수 있는 import
const CLIENT_IMPORT = /^import .*from 'msw\/browser'$/m

/** Starter의 src에서 표시를 검사할 모듈: Next.js가 위치로 구분하는 파일, 테스트·스토리, 재생성 계층을 뺀 TS 모듈 */
function sharedModules(starterDir: string): string[] {
  const src = join(starterDir, 'src')
  return readdirSync(src, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile() && /\.tsx?$/.test(entry.name))
    .map((entry) => relative(starterDir, join(entry.parentPath, entry.name)))
    .filter(
      (path) =>
        !path.startsWith('src/app/') &&
        !/^src\/(proxy|instrumentation(-client)?)\.ts$/.test(path) &&
        !path.startsWith('src/shared/api/generated/') &&
        !/\.(test|stories)\.tsx?$/.test(path),
    )
}

/** 파일의 첫 문장(맨 위 주석 다음)이 표시(`import 'server-only'` 등)인지 */
function startsWith(starterDir: string, path: string, marker: string): boolean {
  const statements = readFileSync(join(starterDir, path), 'utf8')
    .split('\n')
    .filter((line) => line.trim() !== '' && !line.startsWith('//'))
  return statements[0] === `import '${marker}'`
}

function expectBoundaryMarkers(starterDir: string, serverOnly: readonly string[], clientOnly: readonly string[]): void {
  const modules = sharedModules(starterDir)
  expect(modules).toEqual(expect.arrayContaining([...serverOnly, ...clientOnly]))
  const source = (path: string) => readFileSync(join(starterDir, path), 'utf8')
  const expectedServerOnly = [...serverOnly, ...modules.filter((path) => SERVER_IMPORT.test(source(path)))]
  const expectedClientOnly = [...clientOnly, ...modules.filter((path) => CLIENT_IMPORT.test(source(path)))]

  expect(expectedServerOnly.filter((path) => !startsWith(starterDir, path, 'server-only'))).toEqual([])
  expect(expectedClientOnly.filter((path) => !startsWith(starterDir, path, 'client-only'))).toEqual([])
  // 'use server'는 서버 전용 표시가 아니라 Server Function을 선언해, 그 파일이 내보내는 async 함수를 브라우저가 부를 수 있게 연다.
  const allSources = readdirSync(join(starterDir, 'src'), { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile() && /\.tsx?$/.test(entry.name))
    .map((entry) => relative(starterDir, join(entry.parentPath, entry.name)))
  expect(allSources.filter((path) => /^\s*['"]use server['"]/m.test(source(path)))).toEqual([])
}

describe('모든 Recipe·Archetype을 넣은 server Starter(Showcase와 같은 조합)', () => {
  const starter = useStarter({
    prefix: 'dcgen-server-only-showcase-',
    create: (workdir) => {
      const out = join(workdir, 'showcase')
      const result = run('npm', ['run', 'showcase', '--', '--generator', inject('generatorDir'), '--out', out], REPO_ROOT)
      expect(result.status, result.output).toBe(0)
      return out
    },
  })

  test('서버 전용 모듈은 server-only로, 브라우저 전용 모듈은 client-only로 시작하고 use server를 표시로 쓰지 않는다', () => {
    expectBoundaryMarkers(starter.dir, SERVER_ONLY_MODULES, CLIENT_ONLY_MODULES)
  })
})

describe('Rendering Mode static-export Starter', () => {
  const starter = useStarter({ prefix: 'dcgen-server-only-static-export-', renderingMode: 'static-export' })

  test('브라우저의 MSW를 켜는 모듈은 client-only로, 빌드할 때 서버 컴포넌트의 요청을 보내는 모듈은 server-only로 시작한다', () => {
    const serverOnly = SERVER_ONLY_MODULES.filter(
      (path) => path.startsWith('src/shared/api/') || path.startsWith('src/shared/mocks/'),
    ).filter((path) => path !== 'src/shared/api/bff-proxy.ts')
    expectBoundaryMarkers(starter.dir, serverOnly, STATIC_EXPORT_CLIENT_ONLY_MODULES)
  })
})

describe('auth·analytics Recipe를 넣은 server Starter의 빌드', () => {
  const starter = useStarter({
    prefix: 'dcgen-server-only-build-',
    recipes: ['auth', 'analytics'],
    install: true,
  })

  /** 탐침 파일을 두고 목 빌드를 실행한 결과. 탐침은 빌드 뒤에 지운다. */
  function buildWithProbe(files: Readonly<Record<string, string>>) {
    for (const [path, content] of Object.entries(files)) starter.writeFile(path, content)
    try {
      return starter.npm(['run', 'build'], { API_MOCKING: 'enabled' })
    } finally {
      for (const path of Object.keys(files)) rmSync(join(starter.dir, path), { recursive: true, force: true })
    }
  }

  test('클라이언트 컴포넌트가 서버 전용 모듈(세션)을 import하면 next build가 실패한다', () => {
    const result = buildWithProbe({
      'src/features/harness-probe/session-name.tsx': [
        "'use client'",
        '',
        "import { sessionSecret } from '@/shared/auth/session'",
        '',
        'export function SessionName() {',
        '  return <p>{typeof sessionSecret}</p>',
        '}',
        '',
      ].join('\n'),
      'src/app/harness-probe/page.tsx': [
        "import { SessionName } from '@/features/harness-probe/session-name'",
        '',
        'export default function Page() {',
        '  return <SessionName />',
        '}',
        '',
      ].join('\n'),
    })

    expect(result.status, result.failureMessage).not.toBe(0)
    // 오류는 표시한 모듈과, 그 모듈을 클라이언트 컴포넌트로 끌어들인 탐침을 함께 알린다.
    expect(result.output).toContain('server-only')
    expect(result.output).toContain('src/shared/auth/session.ts')
    expect(result.output).toContain('src/features/harness-probe/session-name.tsx')
  })

  test('서버 컴포넌트가 브라우저 전용 모듈(분석 도구의 브라우저 조각)을 import하면 next build가 실패한다', () => {
    const result = buildWithProbe({
      'src/app/harness-probe/page.tsx': [
        "import { analyticsClientInstrumentation } from '@/shared/analytics/analytics-instrumentation-client'",
        '',
        'export default function Page() {',
        '  return <p>{typeof analyticsClientInstrumentation}</p>',
        '}',
        '',
      ].join('\n'),
    })

    expect(result.status, result.failureMessage).not.toBe(0)
    expect(result.output).toContain('client-only')
    expect(result.output).toContain('src/shared/analytics/analytics-instrumentation-client.ts')
    expect(result.output).toContain('src/app/harness-probe/page.tsx')
  })
})
