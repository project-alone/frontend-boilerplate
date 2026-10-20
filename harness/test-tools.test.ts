import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { afterAll, beforeAll, describe, expect, inject, test } from 'vitest'
import { freePort, run, start, waitForServer } from './run.ts'

// Base의 MSW 예시 핸들러(src/shared/mocks/handlers.ts)가 받는 요청과 돌려주는 응답
const EXAMPLE_API = {
  url: 'https://api.example.com/greeting',
  body: { message: 'MSW가 보낸 인사입니다' },
}

// Starter 하나를 만들어 설치해 두고, 테스트마다 다시 설치하지 않도록 모든 테스트가 함께 쓴다.
let workdir: string
let starter: string

function npm(args: readonly string[], env?: NodeJS.ProcessEnv) {
  const result = run('npm', args, starter, env)
  return { ...result, failureMessage: `npm ${args.join(' ')}\n${result.output}` }
}

function expectNpmSuccess(args: readonly string[], env?: NodeJS.ProcessEnv) {
  const result = npm(args, env)
  expect(result.status, result.failureMessage).toBe(0)
  return result
}

// 개발자가 Starter에 파일을 추가하는 상황을 흉내 낸다.
function writeStarterFile(path: string, content: string) {
  const file = join(starter, path)
  mkdirSync(dirname(file), { recursive: true })
  writeFileSync(file, content)
}

// 서버 컴포넌트가 렌더링할 때마다 API를 부르는 페이지. Next.js 서버 안에서 MSW가 요청을 받는지 확인할 때 쓴다.
const MSW_PROBE_ROUTE = '/harness-msw'

function writeMswProbePage() {
  writeStarterFile(
    `src/app${MSW_PROBE_ROUTE}/page.tsx`,
    `export default async function HarnessMswPage() {
  const response = await fetch('${EXAMPLE_API.url}', { cache: 'no-store' })
  const { message } = (await response.json()) as { message: string }
  return <p>{message}</p>
}
`,
  )
}

beforeAll(() => {
  workdir = mkdtempSync(join(tmpdir(), 'dcgen-test-tools-'))
  const created = run(inject('dcgenBin'), ['new', 'my-app'], workdir)
  expect(created.status, created.output).toBe(0)
  starter = join(workdir, 'my-app')

  expectNpmSuccess(['install', '--no-audit', '--no-fund'])
  // Storybook 테스트와 E2E가 쓰는 Chromium. 이미 받아 두었으면 건너뛴다.
  expectNpmSuccess(['run', 'playwright:install'])
})

afterAll(() => {
  rmSync(workdir, { recursive: true, force: true })
})

describe('Vitest와 Testing Library', () => {
  test('Starter의 단위·컴포넌트 테스트가 통과한다', () => {
    expectNpmSuccess(['test'])
  })

  test('Testing Library로 작성한 컴포넌트 테스트를 npm test로 실행할 수 있다', () => {
    writeStarterFile(
      'src/app/harness-component.test.tsx',
      `import { render, screen } from '@testing-library/react'
import { expect, test } from 'vitest'

function Greeting({ name }: { name: string }) {
  return <p>안녕하세요, {name}</p>
}

test('인사말을 보여 준다', () => {
  render(<Greeting name="하네스" />)

  expect(screen.getByText('안녕하세요, 하네스')).toBeInTheDocument()
})
`,
    )

    expectNpmSuccess(['test', '--', 'src/app/harness-component.test.tsx'])
  })

  test('테스트가 보내는 요청은 MSW가 받고, 테스트마다 응답을 바꿀 수 있다', () => {
    writeStarterFile(
      'src/app/harness-msw.test.ts',
      `import { http, HttpResponse } from 'msw'
import { expect, test } from 'vitest'
import { server } from '@/shared/mocks/node'

test('Base의 예시 핸들러가 응답한다', async () => {
  const response = await fetch('${EXAMPLE_API.url}')

  expect(await response.json()).toEqual(${JSON.stringify(EXAMPLE_API.body)})
})

test('server.use로 이 테스트에서만 응답을 바꾼다', async () => {
  server.use(http.get('${EXAMPLE_API.url}', () => HttpResponse.json({ message: '바꾼 응답' })))

  const response = await fetch('${EXAMPLE_API.url}')

  expect(await response.json()).toEqual({ message: '바꾼 응답' })
})
`,
    )

    expectNpmSuccess(['test', '--', 'src/app/harness-msw.test.ts'])
  })
})

describe('Storybook', () => {
  test('Storybook 개발 서버가 뜬다', () => {
    expectNpmSuccess(['run', 'storybook', '--', '--ci', '--smoke-test'])
  })

  test('스토리마다 axe 접근성 검사가 돌고, Starter의 스토리는 모두 통과한다', () => {
    expectNpmSuccess(['run', 'test:storybook'])
  })

  test('WCAG 2.2 AA를 어기는 스토리가 있으면 접근성 검사가 실패한다', () => {
    const story = 'src/app/harness-a11y.stories.tsx'
    // 24px보다 작은 버튼 두 개를 붙여 둔다(WCAG 2.2 성공 기준 2.5.8 위반).
    writeStarterFile(
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
      const result = npm(['run', 'test:storybook', '--', story])

      expect(result.status, result.failureMessage).not.toBe(0)
      expect(result.output).toContain('target-size')
    } finally {
      rmSync(join(starter, story))
    }
  })
})

describe('Playwright', () => {
  let e2eEnv: NodeJS.ProcessEnv

  beforeAll(async () => {
    e2eEnv = { E2E_PORT: String(await freePort()) }
    writeMswProbePage()
    expectNpmSuccess(['run', 'build'])
  })

  test('스모크 E2E가 빌드된 Starter를 대상으로 통과한다', () => {
    expectNpmSuccess(['run', 'test:e2e'], e2eEnv)
  })

  test('E2E 대상 서버가 보내는 API 요청은 MSW가 받는다', () => {
    const spec = 'e2e/harness-msw.spec.ts'
    writeStarterFile(
      spec,
      `import { expect, test } from '@playwright/test'

test('서버 컴포넌트가 받은 MSW 응답을 보여 준다', async ({ page }) => {
  await page.goto('${MSW_PROBE_ROUTE}')

  await expect(page.getByText('${EXAMPLE_API.body.message}')).toBeVisible()
})
`,
    )

    expectNpmSuccess(['run', 'test:e2e', '--', spec], e2eEnv)
  })
})

describe('개발 서버', () => {
  test('개발 서버가 보내는 API 요청은 MSW가 받는다', async () => {
    writeMswProbePage()
    const port = await freePort()
    const devServer = start('npm', ['run', 'dev', '--', '--port', String(port)], starter)

    try {
      const response = await waitForServer(`http://localhost:${port}${MSW_PROBE_ROUTE}`, devServer)

      expect(response.status, devServer.output()).toBe(200)
      expect(await response.text()).toContain(EXAMPLE_API.body.message)
    } finally {
      await devServer.stop()
    }
  })
})
