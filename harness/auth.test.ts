import { mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, inject, test } from 'vitest'
import { freePort, run, start, waitForServer } from './run.ts'
import { expectFileToPass, newStarter, runVitestScript, useStarter } from './starter.ts'

test('auth Recipe는 요청을 받는 서버가 있어야 하므로 static-export Starter에는 이유와 함께 넣지 않는다', () => {
  const workdir = mkdtempSync(join(tmpdir(), 'dcgen-auth-static-'))
  try {
    const result = run(
      inject('dcgenBin'),
      ['new', 'my-app', '--rendering-mode', 'static-export', '--recipe', 'auth', '--skip-install'],
      workdir,
    )

    expect(result.status).not.toBe(0)
    expect(result.output).toContain('Recipe auth은(는) Rendering Mode static-export에서 쓸 수 없습니다')
    expect(result.output).toContain('요청을 받는 Next.js 서버')
    expect(readdirSync(workdir)).toEqual([])
  } finally {
    rmSync(workdir, { recursive: true, force: true })
  }
})

// 다른 Recipe와 같은 확장 지점(머리글)에 끼어든다. 모든 Recipe를 켠 Starter의 스크립트는 showcase-starter.test.ts가 본다.
test('auth Recipe를 dark-mode Recipe와 함께 켜면 머리글에 두 Recipe의 항목이 order 순으로 놓인다', () => {
  const workdir = mkdtempSync(join(tmpdir(), 'dcgen-auth-dark-mode-'))
  try {
    const starter = newStarter(workdir, ['--recipe', 'auth', '--recipe', 'dark-mode', '--skip-install'])

    const appShell = readFileSync(join(starter, 'src/app/app-shell.tsx'), 'utf8')
    const header = /<header[^>]*>([\s\S]*?)<\/header>/.exec(appShell)?.[1] ?? ''
    expect(header.match(/<\w+ \/>/g)).toEqual(['<ThemeSwitcher />', '<UserMenu />'])
  } finally {
    rmSync(workdir, { recursive: true, force: true })
  }
})

// 하네스 매트릭스: Base에 auth Recipe를 넣은 server Starter를 만들어, Starter 자신의 스크립트와 Recipe가 함께 넣은 테스트
// (세션 쿠키, BFF 프록시의 토큰 첨부와 refresh, proxy의 보호된 라우트, 로그인 Route Handler, 로그인 폼, e2e/auth.spec.ts)가
// 통과하는지 본다. auth는 server만 지원한다.
describe('Rendering Mode server에 auth Recipe를 넣은 Starter', () => {
  const starter = useStarter({
    prefix: 'dcgen-auth-',
    renderingMode: 'server',
    recipes: ['auth'],
    install: true,
    playwright: true,
  })

  test('타입 검사, 린트, 포맷 검사, 단위 테스트(동시에 여러 요청이 401을 받아도 refresh는 한 번), 스토리 검사를 통과한다', () => {
    for (const script of [['run', 'typecheck'], ['run', 'lint'], ['run', 'format:check']]) {
      starter.expectNpmSuccess(script)
    }
    const report = runVitestScript(starter, ['test'])
    for (const file of [
      'session.test.ts',
      'auth-backend-fetch.test.ts',
      'auth-proxy.test.ts',
      'session-routes.test.ts',
      'login-form.test.tsx',
    ]) {
      expectFileToPass(report, file, 1)
    }
    starter.expectNpmSuccess(['run', 'test:storybook'])
  })

  test('빌드를 통과하고, 빌드한 앱에서 E2E(로그인, 보호된 라우트와 역할, 토큰 만료 뒤 자동 refresh, 로그아웃)가 통과한다', async () => {
    starter.expectNpmSuccess(['run', 'build'])

    starter.expectNpmSuccess(['run', 'test:e2e'], { E2E_PORT: String(await freePort()) })
  })

  // 위 빌드 결과를 띄운다.
  test('SESSION_SECRET을 넣지 않은 서버는 요청을 처리하지 않고 무엇을 넣어야 하는지 알린다', async () => {
    const port = await freePort()
    // 하네스를 띄운 셸에 SESSION_SECRET이 있어도 결과가 같도록 빈 값으로 덮는다(빈 값은 없는 것으로 본다).
    const app = start('npm', ['run', 'start', '--', '--port', String(port)], starter.dir, {
      API_MOCKING: 'enabled',
      SESSION_SECRET: '',
    })

    try {
      const response = await waitForServer(`http://localhost:${String(port)}/`, app)

      expect(response.status, app.output()).toBe(500)
      expect(app.output()).toContain('SESSION_SECRET 환경 변수가 없습니다')
    } finally {
      await app.stop()
    }
  })
})
