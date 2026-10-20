import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, expect, inject, test } from 'vitest'
import { freePort, run, start, waitForServer } from './run.ts'

// static-export Starter 하나를 만들어 설치·빌드해 두고, 테스트마다 다시 설치하지 않도록 모든 테스트가 함께 쓴다.
// server Starter(기본)의 빌드·E2E·Storybook은 test-tools.test.ts가 검증한다.
// 배포용 빌드(beforeAll의 npm run build)를 보는 테스트는 E2E보다 앞에 둔다. E2E가 MSW를 켜고 out/을 다시 빌드한다.
let workdir: string
let starter: string

// 샘플 명세(openapi.yaml)의 listProducts example. MSW가 이 값을 돌려준다.
const SAMPLE_PRODUCT_NAMES = ['기본 티셔츠', '데님 재킷']

function expectNpmSuccess(args: readonly string[], env?: NodeJS.ProcessEnv) {
  const result = run('npm', args, starter, env)
  expect(result.status, `npm ${args.join(' ')}\n${result.output}`).toBe(0)
}

beforeAll(() => {
  workdir = mkdtempSync(join(tmpdir(), 'dcgen-static-export-'))
  const created = run(inject('dcgenBin'), ['new', 'my-app', '--rendering-mode', 'static-export'], workdir)
  expect(created.status, created.output).toBe(0)
  starter = join(workdir, 'my-app')

  expectNpmSuccess(['install', '--no-audit', '--no-fund'])
  // Storybook 테스트와 E2E가 쓰는 Chromium. 이미 받아 두었으면 건너뛴다.
  expectNpmSuccess(['run', 'playwright:install'])
  expectNpmSuccess(['run', 'build'])
})

afterAll(() => {
  rmSync(workdir, { recursive: true, force: true })
})

test('빌드는 페이지를 미리 렌더링한 HTML을 out/에 만든다', () => {
  const html = readFileSync(join(starter, 'out', 'index.html'), 'utf8')

  expect(html).toContain('<h1>Starter</h1>')
})

test('API를 쓰는 샘플 페이지는 데이터 없이 미리 렌더링되고, 배포용 빌드에는 MSW 코드가 들어가지 않는다', () => {
  const html = readFileSync(join(starter, 'out', 'products.html'), 'utf8')
  expect(html).toContain('<h1>상품</h1>')
  for (const name of SAMPLE_PRODUCT_NAMES) expect(html).not.toContain(name)

  // 브라우저의 MSW(msw/browser)는 서비스 워커의 기본 주소를 코드에 담고 있다.
  const scripts = readdirSync(join(starter, 'out', '_next'), { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith('.js'))
    .map((entry) => join(entry.parentPath, entry.name))
  expect(scripts.filter((script) => readFileSync(script, 'utf8').includes('mockServiceWorker.js'))).toEqual([])
})

test('Next.js 서버 없이 out/만 정적 파일 서버로 띄워도 페이지를 응답한다', async () => {
  // out/ 밖의 빌드 결과(.next/)를 지워도 동작해야 빌드 결과가 정적 파일로만 이루어진 것이다.
  rmSync(join(starter, '.next'), { recursive: true, force: true })
  const port = await freePort()
  const server = start('npm', ['run', 'start', '--', '--port', String(port)], starter)

  try {
    const home = await waitForServer(`http://localhost:${String(port)}/`, server)
    expect(home.status, server.output()).toBe(200)
    expect(await home.text()).toContain('<h1>Starter</h1>')

    const products = await fetch(`http://localhost:${String(port)}/products`)
    expect(products.status, server.output()).toBe(200)
    expect(await products.text()).toContain('<h1>상품</h1>')
  } finally {
    await server.stop()
  }
})

test('E2E는 정적 파일 서버로 띄운 out/을 대상으로 통과하고, 브라우저가 백엔드에 직접 보낸 요청은 MSW 서비스 워커가 받는다', async () => {
  // Starter의 e2e/products.spec.ts가 MSW가 돌려준 상품 목록이 그려지는지 본다.
  expectNpmSuccess(['run', 'test:e2e'], { E2E_PORT: String(await freePort()) })
})

test('public/mockServiceWorker.js는 Starter가 고정한 MSW로 다시 만들어도 같다', () => {
  const worker = join(starter, 'public', 'mockServiceWorker.js')
  const packaged = readFileSync(worker, 'utf8')
  rmSync(worker)

  // 인자 없이 실행하면 package.json의 msw.workerDirectory에 서비스 워커를 만든다(README의 "API 목킹(MSW)").
  const result = run('npx', ['--no', 'msw', 'init'], starter)

  expect(result.status, result.output).toBe(0)
  expect(readFileSync(worker, 'utf8')).toBe(packaged)
})

test('static-export Starter의 스토리도 axe 접근성 검사를 모두 통과한다', () => {
  expectNpmSuccess(['run', 'test:storybook'])
})

// Base의 src/instrumentation.ts를 static-export Starter에도 그대로 두는 이유다. 빌드에는 영향이 없고 개발 서버에서만 쓰인다.
test('개발 서버에서는 서버 컴포넌트가 보내는 API 요청을 MSW가 받는다', async () => {
  const probeDir = join(starter, 'src/app/harness-msw')
  mkdirSync(probeDir)
  writeFileSync(
    join(probeDir, 'page.tsx'),
    `export default async function HarnessMswPage() {
  const response = await fetch('https://api.example.com/products')
  const products = (await response.json()) as { id: number; name: string }[]
  return (
    <ul>
      {products.map((product) => (
        <li key={product.id}>{product.name}</li>
      ))}
    </ul>
  )
}
`,
  )
  const port = await freePort()
  const devServer = start('npm', ['run', 'dev', '--', '--port', String(port)], starter)

  try {
    const response = await waitForServer(`http://localhost:${port}/harness-msw`, devServer)

    expect(response.status, devServer.output()).toBe(200)
    // 샘플 명세(openapi.yaml)의 listProducts example
    expect(await response.text()).toContain('기본 티셔츠')
  } finally {
    await devServer.stop()
    rmSync(probeDir, { recursive: true, force: true })
  }
})

test('개발 서버에서는 브라우저가 백엔드로 보내는 API 요청을 MSW 서비스 워커가 받는다', async () => {
  const port = await freePort()
  const baseURL = `http://localhost:${String(port)}`
  // 빌드 결과 대신 이미 떠 있는 개발 서버를 검사하도록 Playwright 설정을 따로 둔다.
  const config = 'playwright.harness-dev.config.ts'
  writeFileSync(
    join(starter, config),
    `import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: 'e2e',
  use: { baseURL: '${baseURL}' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
})
`,
  )
  const devServer = start('npm', ['run', 'dev', '--', '--port', String(port)], starter)

  try {
    const response = await waitForServer(`${baseURL}/products`, devServer)
    expect(response.status, devServer.output()).toBe(200)

    const result = run('npx', ['playwright', 'test', '--config', config, 'e2e/products.spec.ts'], starter)
    expect(result.status, `${result.output}\n${devServer.output()}`).toBe(0)
  } finally {
    await devServer.stop()
    rmSync(join(starter, config))
  }
})
