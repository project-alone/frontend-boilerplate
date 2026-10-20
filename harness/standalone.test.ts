import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { beforeAll, expect, test } from 'vitest'
import { type BackgroundProcess, freePort, start, waitForServer } from './run.ts'
import { useStarter } from './starter.ts'

// Starter 하나를 만들어 설치하고 빌드해 두고, 모든 테스트가 같은 빌드 결과를 쓴다.
const starter = useStarter({ prefix: 'dcgen-standalone-', install: true })

beforeAll(() => {
  starter.expectNpmSuccess(['run', 'build'])
})

// 배포한 서버처럼 MSW를 끄고 백엔드 주소를 넣어 띄운다. 홈 페이지는 백엔드를 부르지 않으므로 이 주소로 요청이 가지 않는다.
// 주소가 없으면 Starter의 서버는 요청을 처리하지 않는다(README의 "API 계층").
const DEPLOYED_ENV = { API_MOCKING: 'disabled', API_BASE_URL: 'https://backend.example.com' }

/** 띄운 서버에서 홈 페이지를 받아 상태 코드와 HTML을 돌려주고 서버를 끈다. */
async function fetchHomePage(origin: string, server: BackgroundProcess) {
  try {
    const response = await waitForServer(`${origin}/`, server)
    return { status: response.status, html: await response.text(), output: server.output() }
  } finally {
    await server.stop()
  }
}

test('빌드하면 standalone 서버가 만들어지고, 이 서버만으로 페이지를 응답한다', async () => {
  const port = String(await freePort())
  // standalone 서버는 포트와 주소를 환경 변수로 받는다.
  const server = start('node', [join('.next', 'standalone', 'server.js')], starter.dir, {
    ...DEPLOYED_ENV,
    PORT: port,
    HOSTNAME: '127.0.0.1',
  })

  const { status, html, output } = await fetchHomePage(`http://127.0.0.1:${port}`, server)

  expect(status, output).toBe(200)
  expect(html).toContain('<h1>Starter</h1>')
})

test('standalone으로 빌드한 Starter는 npm start(next start)로도 실행된다', async () => {
  const port = String(await freePort())
  const server = start('npm', ['start', '--', '--port', port], starter.dir, DEPLOYED_ENV)

  const { status, html, output } = await fetchHomePage(`http://localhost:${port}`, server)

  expect(status, output).toBe(200)
  expect(html).toContain('<h1>Starter</h1>')
})

test('Starter에는 Vercel 전용 설정 파일과 패키지가 없다', () => {
  const pkg = JSON.parse(readFileSync(join(starter.dir, 'package.json'), 'utf8')) as {
    dependencies?: Record<string, string>
    devDependencies?: Record<string, string>
  }
  const packages = Object.keys({ ...pkg.dependencies, ...pkg.devDependencies })

  // vercel.json, vercel.ts, .vercelignore, .vercel/ 같은 Vercel 설정은 모두 프로젝트 최상위에 둔다.
  expect(readdirSync(starter.dir).filter((name) => /vercel/i.test(name))).toEqual([])
  expect(packages.filter((name) => name === 'vercel' || name.startsWith('@vercel/'))).toEqual([])
})
