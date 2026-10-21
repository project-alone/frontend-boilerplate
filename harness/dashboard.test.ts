import { mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, inject, test } from 'vitest'
import { freePort, run } from './run.ts'
import { buildRouteLine, expectFileToPass, readTree, runVitestScript, useStarter } from './starter.ts'

test('대시보드 Archetype은 server만 지원하는 auth Recipe를 쓰므로 static-export Starter에는 이유와 함께 넣지 않는다', () => {
  const workdir = mkdtempSync(join(tmpdir(), 'dcgen-dashboard-static-'))
  try {
    const result = run(
      inject('dcgenBin'),
      ['new', 'my-app', '--rendering-mode', 'static-export', '--archetype', 'dashboard', '--skip-install'],
      workdir,
    )

    expect(result.status).not.toBe(0)
    expect(result.output).toContain('Archetype dashboard은(는) Rendering Mode static-export에서 쓸 수 없습니다(지원: server).')
    expect(result.output).toContain('Recipe auth은(는) Rendering Mode static-export에서 쓸 수 없습니다')
    expect(result.output).toContain('요청을 받는 Next.js 서버')
    expect(result.output).toContain('Archetype dashboard에 필요해 함께 넣으려던 Recipe입니다.')
    expect(readdirSync(workdir)).toEqual([])
  } finally {
    rmSync(workdir, { recursive: true, force: true })
  }
})

// 하네스 매트릭스: Base에 대시보드 Archetype을 넣은 server Starter를 만들어, Starter 자신의 스크립트와 Archetype이 함께 넣은
// 테스트(로그인과 역할을 확인하는 목 백엔드, 사용자 통계, 정렬·필터가 되는 사용자 목록, 사용자 추가·수정 폼, 역할 규칙,
// e2e/dashboard.spec.ts)가 Archetype이 쓰는 Recipe(auth, chart, table)의 테스트와 함께 통과하는지 본다. 모든 Recipe·Archetype을 켠 조합은 showcase-starter.test.ts가 본다.
describe('Rendering Mode server에 대시보드 Archetype을 넣은 Starter', () => {
  const starter = useStarter({
    prefix: 'dcgen-dashboard-',
    renderingMode: 'server',
    archetypes: ['dashboard'],
    install: true,
    playwright: true,
  })

  test('Archetype이 쓰는 Recipe가 함께 들어 있고, 머리글에 대시보드 링크가 맨 앞에 놓인다', () => {
    const pkg = JSON.parse(readFileSync(join(starter.dir, 'package.json'), 'utf8')) as {
      dependencies: Record<string, string>
    }
    // auth(iron-session), table(TanStack Table), chart(Recharts)의 의존성
    expect(Object.keys(pkg.dependencies)).toEqual(
      expect.arrayContaining(['iron-session', '@tanstack/react-table', 'recharts']),
    )
    const appShell = readFileSync(join(starter.dir, 'src/app/app-shell.tsx'), 'utf8')
    const header = /<header[^>]*>([\s\S]*?)<\/header>/.exec(appShell)?.[1] ?? ''
    expect(header.match(/<\w+ \/>/g)).toEqual(['<DashboardLink />', '<UserMenu />'])
  })

  // Archetype의 Query Domain은 `npm run g`의 query·mutation이 만드는 코드 그대로다. 지우고 같은 순서로 다시 만들면 같은 코드가
  // 나오고, 아래 검사가 이 코드로 돈다.
  test('Query Domain(src/queries/users)은 npm run g -- query·mutation이 만드는 코드와 같다', () => {
    const users = join(starter.dir, 'src/queries/users')
    const archetype = readTree(users)
    rmSync(users, { recursive: true })

    for (const [schematic, operationId] of [
      ['query', 'listUsers'],
      ['query', 'getUserStats'],
      ['query', 'getUser'],
      ['mutation', 'createUser'],
      ['mutation', 'updateUser'],
    ] as const) {
      starter.expectNpmSuccess(['run', 'g', '--', schematic, operationId])
    }

    expect(readTree(users)).toEqual(archetype)
  })

  test('타입 검사, 린트, 포맷 검사, 단위 테스트(목 백엔드의 401·403, 통계, 목록의 정렬·필터, 추가·수정 폼, 역할 규칙), 스토리 검사를 통과한다', () => {
    for (const script of [['run', 'typecheck'], ['run', 'lint'], ['run', 'format:check']]) {
      starter.expectNpmSuccess(script)
    }
    const report = runVitestScript(starter, ['test'])
    for (const file of [
      // 목 백엔드는 실제 백엔드처럼 로그인하지 않은 요청을 401로, 관리자가 아닌 사용자의 추가·수정을 403으로 거절한다.
      'src/shared/mocks/users.test.ts',
      'src/features/user-stats/user-stats-overview.test.tsx',
      'src/features/user-table/user-table.test.tsx',
      'src/features/user-form/create-user-form.test.tsx',
      'src/features/user-form/update-user-form.test.tsx',
      'src/shared/dashboard/dashboard-routes.test.ts',
      // Archetype이 쓰는 Recipe의 테스트도 함께 돈다.
      'src/shared/auth/access-rules.test.ts',
      'src/shared/auth/mock-session.test.ts',
      'src/features/member-table/member-table.test.tsx',
      'src/features/stats-charts/stats-charts.test.tsx',
    ]) {
      expectFileToPass(report, file, 1)
    }

    const stories = runVitestScript(starter, ['run', 'test:storybook'])
    for (const file of [
      'src/features/user-form/create-user-form.stories.tsx',
      'src/features/user-form/update-user-form.stories.tsx',
      'src/features/user-stats/user-status-chart.stories.tsx',
    ]) {
      expectFileToPass(stories, file, 1)
    }
  })

  test('빌드를 통과하고, 빌드한 앱에서 E2E(로그인 → 통계 확인 → 사용자 추가 → 목록 반영, 역할 확인, 백엔드의 401·403)가 통과한다', async () => {
    const build = starter.expectNpmSuccess(['run', 'build'])

    // 세션을 읽는 대시보드 화면은 요청마다 렌더링하고(ƒ), 데이터를 미리 가져오지 않는 추가 화면은 미리 렌더링한다(○).
    // 어느 쪽이든 proxy가 로그인과 역할을 먼저 확인한다.
    expect(buildRouteLine(build.output, '/dashboard'), build.output).toContain('ƒ')
    expect(buildRouteLine(build.output, '/dashboard/users'), build.output).toContain('ƒ')
    expect(buildRouteLine(build.output, '/dashboard/users/new'), build.output).toContain('○')

    starter.expectNpmSuccess(['run', 'test:e2e'], { E2E_PORT: String(await freePort()) })
  })
})
