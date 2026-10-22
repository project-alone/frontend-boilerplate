import { readdirSync, rmSync } from 'node:fs'
import { createServer } from 'node:http'
import { join } from 'node:path'
import { setTimeout } from 'node:timers/promises'
import { gunzipSync } from 'node:zlib'
import { afterAll, beforeAll, describe, expect, test } from 'vitest'
import { type BackgroundProcess, freePort, start, waitForServer } from './run.ts'
import { expectFileToPass, runPlaywrightAgainst, runVitestScript, type Starter, useStarter } from './starter.ts'

// 하네스 매트릭스: Base에 sentry Recipe를 넣은 Starter를 지원하는 Rendering Mode마다 만들어, Starter 자신의 스크립트와 Recipe가
// 함께 넣은 테스트(src/shared/sentry/*.test.ts, e2e/sentry.spec.ts)가 통과하는지 본다. 이어서 DSN을 하네스가 띄운 가짜 수집
// 서버(로컬)로 가리켜 만든 배포용 빌드가 브라우저와 서버에서 난 오류를 실제로 보내는지, 목 빌드와 개발 서버는 DSN이 있어도
// 아무것도 보내지 않는지 본다. 진짜 Sentry로는 아무것도 보내지 않는다. analytics와 함께 켠 조합은 analytics.test.ts가 본다.

const CLIENT_ERROR = 'harness-sentry-client-error'
const SERVER_ERROR = 'harness-sentry-server-error'
/** 렌더링할 때마다 SERVER_ERROR를 던지는 탐침 페이지. 요청을 받는 서버가 있는 server Starter에만 만든다. */
const SERVER_ERROR_ROUTE = '/harness-sentry'
/**
 * SERVER_ERROR_ROUTE의 상태 코드. Base의 앱 수준 로딩 상태(src/app/loading.tsx)가 요청마다 렌더링하는 페이지의 응답을 먼저
 * 보내므로(스트리밍), 그 뒤에 난 렌더링 오류는 200 응답에 담겨 브라우저의 오류 화면으로 알려진다.
 */
const SERVER_ERROR_STATUS = 200
/** 브라우저로 SERVER_ERROR_ROUTE를 열어 앱 수준의 오류 화면을 확인한 뒤 SDK가 보낼 시간을 기다리는 Playwright 테스트 */
const SERVER_ERROR_SPEC = 'e2e/harness-sentry-server.spec.ts'
/** 서버 컴포넌트의 오류가 브라우저에 넘어올 때 Next.js가 메시지 대신 넣는 문장(배포용 빌드). digest만 함께 담긴다. */
const SERVER_ERROR_IN_BROWSER = 'An error occurred in the Server Components render'
/** 브라우저에서 처리하지 못한 오류(CLIENT_ERROR)를 내고 SDK가 보낼 시간을 기다리는 Playwright 테스트 */
const CLIENT_ERROR_SPEC = 'e2e/harness-sentry-client.spec.ts'
const RENDER_ERROR = 'harness-sentry-render-error'
/** 버튼을 누르면 브라우저에서 렌더링하다 RENDER_ERROR를 던지는 탐침 페이지. 라우트에 error.tsx가 없어 앱 수준의 오류 경계가 받는다. */
const RENDER_ERROR_ROUTE = '/harness-sentry-render'
/** RENDER_ERROR를 내고 앱 수준의 오류 화면을 확인한 뒤 SDK가 보낼 시간을 기다리는 Playwright 테스트 */
const RENDER_ERROR_SPEC = 'e2e/harness-sentry-render.spec.ts'
/** 목을 끈 서버가 뜨려면 백엔드 주소가 있어야 한다(api-instrumentation.ts). 탐침은 백엔드를 부르지 않으므로 아무 데도 닿지 않는 주소를 준다. */
const UNUSED_BACKEND_URL = 'http://127.0.0.1:9'

interface FakeIngest {
  /** 이 서버를 가리키는 DSN */
  dsn: string
  /** 지금까지 받은 envelope 본문 */
  envelopes: () => string[]
  close: () => Promise<void>
}

/** Sentry의 수집 서버(ingest) 흉내. DSN의 envelope 엔드포인트(/api/<프로젝트>/envelope/)로 온 본문을 모은다. */
async function startFakeIngest(): Promise<FakeIngest> {
  const received: string[] = []
  const server = createServer((request, response) => {
    const chunks: Buffer[] = []
    request.on('data', (chunk: Buffer) => chunks.push(chunk))
    request.on('end', () => {
      const body = Buffer.concat(chunks)
      if (request.url?.startsWith('/api/1/envelope/') === true) {
        received.push((request.headers['content-encoding'] === 'gzip' ? gunzipSync(body) : body).toString('utf8'))
      }
      // 브라우저 SDK가 다른 origin에서 보내므로 CORS를 열어 둔다.
      response.writeHead(200, { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*' })
      response.end('{}')
    })
  })
  const port = await freePort()
  await new Promise<void>((resolve) => server.listen(port, '127.0.0.1', resolve))
  return {
    dsn: `http://harness@127.0.0.1:${String(port)}/1`,
    envelopes: () => [...received],
    close: () => new Promise((resolve) => server.close(() => resolve())),
  }
}

/** 오류를 내는 탐침(서버 페이지는 server Starter에만)을 Starter에 둔다. removeProbes로 지운다. */
function writeProbes(starter: Starter, { serverPage }: { serverPage: boolean }): void {
  if (serverPage) {
    starter.writeFile(
      `src/app${SERVER_ERROR_ROUTE}/page.tsx`,
      `export const dynamic = 'force-dynamic'

export default function HarnessSentryPage(): never {
  throw new Error('${SERVER_ERROR}')
}
`,
    )
    starter.writeFile(
      SERVER_ERROR_SPEC,
      `import { expect, test } from '@playwright/test'

test('서버에서 렌더링하다 난 오류를 앱 수준의 오류 화면이 받는다', async ({ page }) => {
  await page.goto('${SERVER_ERROR_ROUTE}')

  await expect(page.getByRole('button', { name: '다시 시도' })).toBeVisible()
  await page.waitForTimeout(3000)
})
`,
    )
  }
  starter.writeFile(
    CLIENT_ERROR_SPEC,
    `import { expect, test } from '@playwright/test'

test('브라우저에서 처리하지 못한 오류를 낸다', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.goto('/')

  await page.evaluate(() => {
    setTimeout(() => {
      throw new Error('${CLIENT_ERROR}')
    })
  })

  await expect.poll(() => errors).toContain('${CLIENT_ERROR}')
  await page.waitForTimeout(3000)
})
`,
  )
  starter.writeFile(
    `src/app${RENDER_ERROR_ROUTE}/page.tsx`,
    `'use client'

import { useState } from 'react'

export default function HarnessSentryRenderPage() {
  const [failing, setFailing] = useState(false)
  if (failing) throw new Error('${RENDER_ERROR}')
  return (
    <main>
      <button type="button" onClick={() => setFailing(true)}>
        렌더링 오류 내기
      </button>
    </main>
  )
}
`,
  )
  starter.writeFile(
    RENDER_ERROR_SPEC,
    `import { expect, test } from '@playwright/test'

test('브라우저에서 렌더링하다 난 오류를 앱 수준의 오류 화면이 받는다', async ({ page }) => {
  await page.goto('${RENDER_ERROR_ROUTE}')
  await page.getByRole('button', { name: '렌더링 오류 내기' }).click()

  await expect(page.getByRole('button', { name: '다시 시도' })).toBeVisible()
  await page.waitForTimeout(3000)
})
`,
  )
}

function removeProbes(starter: Starter): void {
  rmSync(join(starter.dir, CLIENT_ERROR_SPEC), { force: true })
  rmSync(join(starter.dir, RENDER_ERROR_SPEC), { force: true })
  rmSync(join(starter.dir, SERVER_ERROR_SPEC), { force: true })
  rmSync(join(starter.dir, `src/app${SERVER_ERROR_ROUTE}`), { recursive: true, force: true })
  rmSync(join(starter.dir, `src/app${RENDER_ERROR_ROUTE}`), { recursive: true, force: true })
}

/** CLIENT_ERROR_SPEC를 origin에 띄운 앱에 대고 실행한다. */
function throwInBrowser(starter: Starter, origin: string, serverOutput: () => string): void {
  const result = runPlaywrightAgainst(starter.dir, origin, [CLIENT_ERROR_SPEC])
  expect(result.status, `${result.output}\n${serverOutput()}`).toBe(0)
}

/** origin에 띄운 앱(server Starter)에서 서버와 브라우저의 오류를 내고, 앱이 오류를 냈지만 수집 서버는 아무것도 받지 않았는지 본다. */
async function expectNothingSent(
  starter: Starter,
  origin: string,
  app: BackgroundProcess,
  ingest: FakeIngest,
): Promise<void> {
  expect((await fetch(`${origin}${SERVER_ERROR_ROUTE}`)).status).toBe(SERVER_ERROR_STATUS)
  throwInBrowser(starter, origin, app.output)

  await setTimeout(2000)
  expect(app.output()).toContain(SERVER_ERROR)
  expect(ingest.envelopes()).toEqual([])
}

/** 수집 서버가 text를 담은 envelope를 받을 때까지(최대 15초) 기다린다. */
async function expectReceived(ingest: FakeIngest, text: string): Promise<void> {
  await expect
    .poll(() => ingest.envelopes().some((envelope) => envelope.includes(text)), { timeout: 15_000 })
    .toBe(true)
}

/** directory 아래의 소스맵(.map) 파일 */
function sourceMaps(directory: string): string[] {
  return readdirSync(directory, { recursive: true, encoding: 'utf8' }).filter((path) => path.endsWith('.map'))
}

describe.each(['server', 'static-export'] as const)(
  'Rendering Mode %s에 sentry Recipe를 넣은 Starter',
  (renderingMode) => {
    const starter = useStarter({
      prefix: `dcgen-sentry-${renderingMode}-`,
      renderingMode,
      recipes: ['sentry'],
      install: true,
      playwright: true,
    })

    test('타입 검사, 린트, 포맷 검사, 단위 테스트(SDK를 초기화하는 조건, 서버 SDK가 보내는 오류)를 통과한다', () => {
      for (const script of [
        ['run', 'typecheck'],
        ['run', 'lint'],
        ['run', 'format:check'],
      ]) {
        starter.expectNpmSuccess(script)
      }

      const report = runVitestScript(starter, ['test'])
      expectFileToPass(report, 'src/shared/sentry/sentry.test.ts', 1)
      expectFileToPass(report, 'src/shared/sentry/sentry-instrumentation.test.ts', 1)
    })

    test('DSN과 인증 토큰 없이 빌드를 통과하고, 브라우저가 받을 수 있는 곳에 소스맵을 남기지 않는다', () => {
      // CI는 커밋 SHA로 release 이름을 정하므로(GitLab CI의 CI_COMMIT_SHA), 같은 조건에서 빌드한다.
      const result = starter.expectNpmSuccess(['run', 'build'], { CI_COMMIT_SHA: 'ci-commit-sha' })

      // 소스맵을 올릴 인증 토큰이 없으면 소스맵을 만들지 않는다. 만들면 올리지 못한 소스맵이 배포 결과에 남아 소스가 드러난다.
      const published = renderingMode === 'server' ? join(starter.dir, '.next', 'static') : join(starter.dir, 'out')
      expect(sourceMaps(published)).toEqual([])
      // 올릴 것이 없으므로 인증 토큰이 없다는 Sentry 빌드 도구의 경고도 내지 않는다.
      expect(result.output).not.toMatch(/auth token/i)
    })

    // server는 위 빌드 결과를 띄워 검사하고, static-export는 E2E가 MSW를 켜고 직접 다시 빌드한다(playwright.config.ts).
    test('빌드한 앱에서 E2E가 통과한다(DSN이 없으면 브라우저에서 오류가 나도 앱 밖으로 요청을 보내지 않는다)', async () => {
      starter.expectNpmSuccess(['run', 'test:e2e'], { E2E_PORT: String(await freePort()) })
    })

    describe('DSN을 가짜 수집 서버로 가리켜 만든 배포용 빌드', () => {
      let ingest: FakeIngest
      let server: BackgroundProcess
      let origin: string

      beforeAll(async () => {
        ingest = await startFakeIngest()
        writeProbes(starter, { serverPage: renderingMode === 'server' })
        // 브라우저의 DSN(NEXT_PUBLIC_SENTRY_DSN)은 빌드할 때 코드에 박히고, 서버의 DSN(SENTRY_DSN)은 서버를 띄울 때 읽는다.
        starter.expectNpmSuccess(['run', 'build'], { NEXT_PUBLIC_SENTRY_DSN: ingest.dsn })

        const port = await freePort()
        origin = `http://localhost:${String(port)}`
        server = start('npm', ['run', 'start', '--', '--port', String(port)], starter.dir, {
          SENTRY_DSN: ingest.dsn,
          API_BASE_URL: UNUSED_BACKEND_URL,
        })
        await waitForServer(origin, server)
      })

      afterAll(async () => {
        await server?.stop()
        await ingest?.close()
        removeProbes(starter)
      })

      test('브라우저에서 처리하지 못한 오류를 Sentry로 보낸다', async () => {
        throwInBrowser(starter, origin, server.output)

        await expectReceived(ingest, CLIENT_ERROR)
      })

      // 오류 경계가 잡은 오류는 Next.js가 콘솔에만 남기므로 SDK가 저절로 받지 못한다. Recipe가 앱 수준의 오류 경계에서 보낸다.
      test('브라우저에서 렌더링하다 난 오류는 앱 수준의 오류 경계가 받아 화면을 바꾸고, Sentry로도 보낸다', async () => {
        const result = runPlaywrightAgainst(starter.dir, origin, [RENDER_ERROR_SPEC])
        expect(result.status, `${result.output}\n${server.output()}`).toBe(0)

        await expectReceived(ingest, RENDER_ERROR)
      })

      test.runIf(renderingMode === 'server')('서버가 페이지를 렌더링하다 난 오류를 Sentry로 보낸다', async () => {
        const response = await fetch(`${origin}${SERVER_ERROR_ROUTE}`)
        expect(response.status).toBe(SERVER_ERROR_STATUS)

        await expectReceived(ingest, SERVER_ERROR)
      })

      test.runIf(renderingMode === 'server')(
        '서버 컴포넌트에서 난 오류는 서버가 보내므로, 그 오류를 받은 브라우저의 오류 화면은 다시 보내지 않는다',
        async () => {
          const result = runPlaywrightAgainst(starter.dir, origin, [SERVER_ERROR_SPEC])
          expect(result.status, `${result.output}\n${server.output()}`).toBe(0)

          await expectReceived(ingest, SERVER_ERROR)
          expect(ingest.envelopes().filter((envelope) => envelope.includes(SERVER_ERROR_IN_BROWSER))).toEqual([])
        },
      )
    })

    // 목 빌드와 개발 서버는 Rendering Mode와 상관없이 같은 코드로 SDK를 초기화하지 않으므로, 브라우저와 서버의 오류를 함께 낼 수
    // 있는 server에서만 본다.
    test.runIf(renderingMode === 'server')(
      '목 빌드(E2E, GitLab CI의 build 잡)는 빌드하는 환경과 서버에 DSN이 있어도 브라우저와 서버의 오류를 Sentry로 보내지 않는다',
      async () => {
        const ingest = await startFakeIngest()
        writeProbes(starter, { serverPage: true })
        let app: BackgroundProcess | undefined
        try {
          starter.expectNpmSuccess(['run', 'build'], { API_MOCKING: 'enabled', NEXT_PUBLIC_SENTRY_DSN: ingest.dsn })
          const port = await freePort()
          const origin = `http://localhost:${String(port)}`
          app = start('npm', ['run', 'start', '--', '--port', String(port)], starter.dir, {
            API_MOCKING: 'enabled',
            SENTRY_DSN: ingest.dsn,
          })
          await waitForServer(origin, app)

          await expectNothingSent(starter, origin, app, ingest)
        } finally {
          await app?.stop()
          await ingest.close()
          removeProbes(starter)
        }
      },
    )

    test.runIf(renderingMode === 'server')(
      '개발 서버는 DSN이 있어도 브라우저와 서버의 오류를 Sentry로 보내지 않는다',
      async () => {
        const ingest = await startFakeIngest()
        writeProbes(starter, { serverPage: true })
        const port = await freePort()
        const origin = `http://localhost:${String(port)}`
        const devServer = start('npm', ['run', 'dev', '--', '--port', String(port)], starter.dir, {
          SENTRY_DSN: ingest.dsn,
          NEXT_PUBLIC_SENTRY_DSN: ingest.dsn,
        })

        try {
          await waitForServer(origin, devServer)

          await expectNothingSent(starter, origin, devServer, ingest)
        } finally {
          await devServer.stop()
          await ingest.close()
          removeProbes(starter)
        }
      },
    )
  },
)
