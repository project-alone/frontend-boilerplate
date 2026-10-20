import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, expect, inject, test } from 'vitest'
import { freePort, run, start, waitForServer } from './run.ts'

// static-export Starter 하나를 만들어 설치·빌드해 두고, 테스트마다 다시 설치하지 않도록 모든 테스트가 함께 쓴다.
// server Starter(기본)의 빌드·E2E·Storybook은 test-tools.test.ts가 검증한다.
let workdir: string
let starter: string

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

test('스모크 E2E가 Next.js 서버 없이 정적 파일 서버로 띄운 out/을 대상으로 통과한다', async () => {
  // out/ 밖의 빌드 결과(.next/)를 지워도 동작해야 빌드 결과가 정적 파일로만 이루어진 것이다.
  rmSync(join(starter, '.next'), { recursive: true, force: true })

  expectNpmSuccess(['run', 'test:e2e'], { E2E_PORT: String(await freePort()) })
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
